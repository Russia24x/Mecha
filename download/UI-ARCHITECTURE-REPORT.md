# گزارش معماری کامل — سیستم ورودی/ناوبری/UI

> این گزارش با خواندن خط‌به‌خط کد تهیه شده، نه با تست رفتاری.
> هدف: نقشه‌ی کامل لوله‌کشی ورودی و کنترل برای ریشه‌یابی باگ‌های ساختاری.

---

## ساختار کلی

```
InputSystem (منبع ورودی — 421 خط)
  ├─ onKeyDown → kbEdge buffer + callbacks (gate شده با gameplayBlocked)
  ├─ onKeyUp → kbHeld state
  └─ update() → merge kbEdge + gamepad → state (شامل gp* flags جدید)
         │
         ▼
  InputState (snapshot هر frame)
         │
    ┌────┴────────────────────┐
    ▼                         ▼
UIController              GameScene.update()
(548 خط)                  (1099 خط)
  ├─ keyHandler              ├─ B8 priority chain (ESC/back)
  │   (keydown listener)     ├─ OverlayManager.handleInput → ctrl.update
  ├─ update()                ├─ pauseMenuUI.handleNavigation → ctrl.update
  │   (polling هر frame)     └─ sharedController.update
  ├─ addButton()
  │   └─ bg.setInteractive + pointerover/pointerdown
  ├─ clearFocusables()
  │   └─ bg.removeInteractive (مشکل S1!)
  └─ findNearest (up/down/left/right)
```

---

## فایل‌ها و نقش‌ها

### 1. InputSystem.ts — منبع ورودی
- **کیبورد:** `onKeyDown` → `kbEdge` buffer (edge flags) + `callbacks.*` (gate شده با gameplayBlocked)
- **گیم‌پد:** polling در `update()` → `gp*` flags (جدید، B2 fix)
- **Merge:** `state.X = kbEdge.X || gpX` (مخلوط، برای گیم‌پلی) + `state.gpX = gpX` (جدیداً، برای UI)
- **B7 fix:** callbacks در `onKeyDown` با `gameplayBlocked` gate شده‌اند

### 2. UIController.ts — ناوبری یکپارچه
- **دو مسیر ورودی:**
  - `keyHandler` (keydown event) — Enter/Space/Arrow/WASD
  - `update()` (polling) — gp* flags + leftStick + heldX
- **addButton():** `bg.setInteractive()` + `pointerover/pointerdown` handlers
- **clearFocusables():** `bg.removeInteractive()` روی همه — **مشکل S1 اینجاست**
- **B2 fix:** update() فقط gp* flags می‌خواند (نه mixed)
- **A4 fix:** setupKeyboard فقط در show() صدا زده می‌شود (نه constructor)

### 3. NavigableOverlay.ts — پایه‌ی overlayها
- abstract base برای Settings/Inventory/SkillTree/Quest/Map
- `registerNav()` → `ctrl.addButton()`
- `clearNavElements()` → `ctrl.clearFocusables()` — **مشکل S1**

### 4. OverlayManager.ts — مدیر overlay stack
- `open()` → `ui.show()` + `ctrl.show()` (دو بار show! — redundant)
- `close()` → `ctrl.hide()` + `ui.hide()` + `ui.destroy()` + `AudioSystem.play()`
- `handleInput()` → `backPressed` → `close()`؛ وگرنه `ctrl.update()`

### 5. MenuNavHelper.ts — wrapper نازک
- `makeMenuBtn/makeHubNavBtn/makeHubCardBtn` → `ctrl.addButton()` (shared controller)
- همه‌ی متدهای nav (handleGamepadNav, setupNav, updateFocus) **no-op** هستند

### 6. HangarUI.ts — overlay مستقل
- **overlay با 4 تب** (chassis/loadout/companion/paint) + EXIT
- `showTab()` — **S1 fix اعمال شده**: `delayedCall(0)` برای deferral
- `clearFocusables()` + re-register EXIT + tabs + content هر بار
- **B3 fix:** `focusButtonFrom(5)` بعد از re-registration

### 7. PauseMenuUI.ts — overlay خاص
- **در OverlayManager نیست** — GameScene مستقیماً مدیریت می‌کند
- `handleNavigation()` → `backPressed` → `triggerFirst()` (RESUME)؛ وگرنه `ctrl.update()`
- **10 دکمه‌ی ثابت** — هیچ‌گاه rebuild نمی‌شود (نه مثل Hangar)

### 8-10. SettingsUI/InventoryUI/SkillTreeUI — NavigableOverlay subclasses
- **همه تب/category switch سینکرون دارند** (نه deferred)
- `refresh()/refreshOptions()/refreshTree()` → destroy old bgs + registerNav new
- **ctrl.focusables leak:** bgs قدیمی هرگز از `ctrl.focusables` پاک نمی‌شوند
- **S1 risk (HIGH):** InventoryUI.activateSlot و SkillTreeUI.unlockAction

### 11-12. QuestUI/WorldMapUI — NavigableOverlay (view-only)
- `refresh()` فقط از constructor صدا زده می‌شود — **نه از pointerdown**
- **S1 risk: None** (دکمه‌ها فقط خواندنی هستند)

### 13-14. HubBuilder/MenuBuilder — builders (نه overlay)
- از MenuNavHelper (shared controller) استفاده می‌کنند
- **MenuBuilder S1 risk (HIGH):** `showHowToPlay()` → `c.removeAll(true)` از داخل pointerdown

### 15. GameScene.ts — state machine + wiring
- `update()` با **B8 priority chain** برای ESC/back
- `setState()` → `cleanupState()` → destroy shared controller + stateContainer
- `openOverlay()` → `OverlayManager.open()`
- `togglePause()` با 200ms debounce

---

## جریان ورودی (Input Flow)

### 1. کلیک موس روی nav button در Hub
```
موس کلیک → Phaser hitTest → bg.emit('pointerdown')
→ AudioSystem.play('uiClick') + onSelect()
→ HubBuilder.callbacks.onOpenOverlay('hangar')
→ GameScene.openOverlay('hangar')
→ new HangarUI() + OverlayManager.open()
→ ui.show() → showTab('chassis') [delayed] + ctrl.show() [setupKeyboard]
```

### 2. کلیک موس روی tab در Hangar
```
موس کلیک → bg.emit('pointerdown')
→ onSelect() → showTab('loadout')
→ delayedCall(0, () => {
    clearFocusables() [removeInteractive — SAFE چون deferred]
    addButton(EXIT) + addButton(tabs) + addTabs()
    renderLoadoutTab()
    focusButtonFrom(5)
  })
```

### 3. ESC در Hangar
```
ESC → InputSystem.onKeyDown → kbEdge.pause + kbEdge.back
→ GameScene.update() → B8 chain → OverlayManager.hasOpen? YES
→ OverlayManager.handleInput → backPressed → close()
→ ctrl.hide() + ui.hide() + ui.destroy() + AudioSystem.play()
→ onClose('hub') → sharedController.show()
→ return (single consumption)
```

### 4. Arrow Down در Pause
```
ArrowDown → keyHandler (synchronous) → findNearest('down') + updateFocusVisual
→ navCooldown = 120
→ Next frame: ctrl.update() → navCooldown > 0 → skip (no double-fire)
```

### 5. Space در Pause (PHANTOM JUMP!)
```
Space → InputSystem.onKeyDown → kbEdge.jump = true (در حین pause!)
→ keyHandler → onSelect() → togglePause() (unpause)
→ ctrl.hide() (keyHandler حذف می‌شود)
→ Next frame: InputSystem.update() → state.jumpPressed = kbEdge.jump = TRUE
→ updatePlay() → PlayerEntity.tryJump() → کاراکتر می‌پرد!
```
**این یک باگ است:** Space در Pause هم unpause می‌کند هم یک "phantom jump" ایجاد می‌کند.

---

## سایت‌های کرش S1 (removeInteractive حین pointerdown)

### HIGH risk (bg کلیک‌شده mutate می‌شود)

| # | فایل | trigger | علت |
|---|------|---------|-----|
| 1 | MenuBuilder.ts:179 | کلیک HOW TO PLAY | `c.removeAll(true)` دکمه‌ی کلیک‌شده را destroy می‌کند |
| 2 | MenuBuilder.ts:240 | کلیک BACK در How To Play | `c.removeAll(true)` + `nav.reset()` → `clearFocusables()` |
| 3 | InventoryUI.ts:441 | کلیک روی item slot (upgrade/use) | `activateSlot()` → `refresh()` → destroy slot bg کلیک‌شده |
| 4 | SkillTreeUI.ts:430 | کلیک روی diamond node (unlock) | `unlockAction()` → `refreshTree()` → destroy diamond bg کلیک‌شده |

### MEDIUM risk (bg دیگر mutate می‌شود، اما حین event)

| # | فایل | trigger | علت |
|---|------|---------|-----|
| 5 | SettingsUI.ts:89 | کلیک روی category | `refreshOptions()` option bgs را destroy + register می‌کند |
| 6 | InventoryUI.ts:188 | کلیک روی tab | `refresh()` slot bgs را destroy + register می‌کند |
| 7 | SkillTreeUI.ts:197 | کلیک روی tree tab | `refreshTree()` node bgs را destroy + register می‌کند |

### FIXED (الگوی درست)

| فایل | fix |
|------|-----|
| HangarUI.ts:141 | `delayedCall(0)` — `clearFocusables` به فریم بعد موکول شده |

---

## مسائل معماری دیگر

### 1. ctrl.focusables leak
SettingsUI/InventoryUI/SkillTreeUI: `navElements` فیلتر می‌شود اما `ctrl.focusables` هرگز پاک نمی‌شود. bgs قدیمی برای همیشه می‌مانند.

### 2. Phantom jump بعد از unpause
Space در Pause: `kbEdge.jump` set می‌شود، بعد unpause، `updatePlay` آن را می‌خواند → پرش ناخواسته.

### 3. Double show در OverlayManager.open
`ui.show()` (که `ctrl.show()` را صدا می‌زند) + `ctrl.show(280)` مجدداً — redundant.

### 4. navCooldown فرض 60fps
`navCooldown -= 16` hardcoded — در 144fps اشتباه است.

### 5. Tab double-registration
Settings/Inventory/SkillTree: tabs یک بار با `registerNav` (موس/Enter) و یک بار با `ctrl.addTabs` (L1/R1) ثبت می‌شوند — دو مسیر جدا.

---

## توصیه برای فیکس S1

### رویکرد ۱: delayedCall (الگوی HangarUI)
برای سایت‌های HIGH risk #1-#4: `delayedCall(0)` مثل HangarUI. **اما تست کاربر نشان داد این کامل کار نمی‌کند** (کلیک سوم باز هم موس را کشت).

### رویکرد ۲: جداسازی persistent vs content (بهتر)
بدون `clearFocusables()` برای persistent buttons (EXIT + tabs)، فقط content را rebuild کن:
```
// به‌جای clearFocusables + re-register همه:
// 1. فقط contentContainer را destroy کن
// 2. فقط content buttons را از ctrl.focusables حذف کن (نه persistent)
// 3. content جدید را register کن
```
این یعنی `ctrl.focusables` باید یک متد `removeContentButtons(startIndex)` داشته باشد که فقط content را پاک کند، نه persistent را.

### رویکرد ۳: عدم removeInteractive روی persistent buttons
EXIT + tabs هرگز `removeInteractive` نشوند — فقط `off('pointerdown')` + `on('pointerdown')` برای update handler.
