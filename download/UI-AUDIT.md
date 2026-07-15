# ممیزی UI — سند تحلیلی (بدون تغییر کد)

> این سند فقط تحلیل است. هیچ کدی تغییر نکرده است.
> هدف: مشخص کردن دقیقاً چه چیزی کجاست و چرا، قبل از هرگونه اقدام.
> **نکته:** این سند قبلاً ساخته شده بود اما با ریست container محلی از بین رفت. دوباره بازسازی شد.

---

## ۰. وضعیت گیت (تأیید قطعی با `git ls-remote`)

```
git ls-remote origin
→ 3086d913b21e54f0c7b590c8a679fc3ab443fcf3  refs/heads/main
```

**GitHub main = `3086d91`** — تمام کار UIController سالم است روی GitHub.
Container محلی موقتاً به `5d93060` (قبل از rewrite) ریست شده بود، اما با `git fetch + git reset --hard origin/main` دوباره همگام شد.

**توصیه:** فعال‌سازی branch protection rule («Do not allow force pushes») روی `main` در GitHub — مستقل از علت این‌بار.

---

## ۱. باگ‌های تأییدشده با خواندن کد (روی HEAD = `3086d91`)

### B1 — ستون راست Pause Menu غیرقابل انتخاب است (کیبورد/گیم‌پد)

**علت ریشه‌ای:** `UIController.findNearest()` فقط دو جهت دارد: `'up' | 'down'`.
هیچ پشتیبانی از left/right برای حرکت بین ستون‌ها وجود ندارد.

**مسیر کد:**
- `UIController.ts` خط 326: `private findNearest(direction: 'up' | 'down')`
- `UIController.update()` خط 293-294: فقط `findNearest('up')` / `findNearest('down')`
- `keyHandler` خط 472-483: ArrowLeft/ArrowRight فقط اگر `this.tabs.length > 0` باشد
- `PauseMenuUI` هیچ‌گاه `addTabs()` صدا نمی‌زند → `tabs.length === 0`

**نتیجه:** در Pause Menu با ۲ ستون دکمه، حرکت از ستون چپ به راست غیرممکن است.

**شدت:** بحرانی — ۴ دکمه از ۹ دکمه غیرقابل دسترسی هستند.

### B1-legacy — همین باگ در `508f3e6` (قبل از rewrite) هم وجود داشت

**تأیید شده با تست agent-browser روی `508f3e6`:**
- Arrow Down: RESUME → CHECKPOINT → NEURAL CORTEX → MISSION LOG → SETTINGS (فقط ستون چپ!)
- Arrow Right/Left: هیچ کاری نمی‌کند
- RETURN TO HUB, RESTART, DATA VAULT, QUIT — همگی غیرقابل دسترسی با کیبورد

**نکته مهم:** این یک **باگ قدیمی و مستقل از UIController** است، نه رگرشن ناشی از بازنویسی. رفع‌کردنش ربطی به تصمیم rollback ندارد و در هر دو مسیر باید جدا فیکس شود.

### B1-hitarea — مشکل hit-area در Pause Menu (بحرانی، جدا از B1)

**تأیید شده با تست agent-browser روی `508f3e6`:**
- Hover روی موقعیت بصری RESTART: focus به RESUME پرید (نه RESTART!)
- Click روی موقعیت RETURN TO HUB: **NEURAL CORTEX باز شد!** (یعنی hit-area کاملاً اشتباه است)

**علت احتمالی:** مختصات hit-area با موقعیت بصری دکمه‌ها مطابقت ندارد — ممکن است_due to canvas scaling (DPI)، یا layout قدیمی که hit-area آپدیت نشده.

**شدت:** بحرانی — کاربر می‌تواند به‌طور کاملاً غیرمنتظره وارد بخش اشتباه شود. این خطرناک‌تر از صرفاً «غیرقابل‌دسترس‌بودن» است.

### B2 — کلید Space دکمه را دوبار فعال می‌کند

**تأیید شده با تست agent-browser:**
- Enter روی RESUME در `508f3e6`: **۲ oscillator** ساخته شد (دوبار)
- Space روی RESUME در `508f3e6`: ۱ oscillator (یک بار)

**علت در HEAD (`3086d91`):** دو مسیر ورودی موازی:
- `InputSystem` Space → `kbEdge.jump` → `state.jumpPressed` → `UIController.update()` activates
- `UIController.keyHandler` Space → activates

**علت در `508f3e6`:** Enter در InputSystem هندل نمی‌شود، اما چیزی باعث دوبار پخش صدا می‌شود. **ریشه هنوز مشخص نیست — نیاز به console.trace واقعی.**

**شدت:** بالا — رفتار غیرقابل پیش‌بینی.

### B3 — بعد از tab switch در Hangar، focus روی EXIT می‌افتد

**مسیر کد (`HangarUI.ts` خط 155-168):** ترتیب re-registration: clearFocusables → addButton(EXIT) → addButton(tabs) → addButton(content). اولین دکمه = EXIT.

**شدت:** متوسط.

### B4 — `findNearest` fallback روی disabled buttons می‌رود

**مسیر کد (`UIController.ts` خط 350-353):** fallback `disabled` را چک نمی‌کند.

**شدت:** پایین.

### B5 — `processCursorHover` به internals خصوصی Phaser دسترسی دارد

**مسیر کد (`UIController.ts` خط 361-380):** `_list` و `manager.hitTest` خصوصی/غیرمستند.

**شدت:** متوسط — fragility.

### B6 — `navElements` و `ctrl.focusables` می‌توانند OutOf Sync شوند

**تله‌ی آینده:** اگر کسی `updateNavFocus()` را دوباره فعال کند، باگ بلافاصله برمی‌گردد.

**شدت:** پایین (فعلاً).

---

## ۲. مشکلات معماری

### A1 — سه مسیر ورودی موازی در UIController
| مسیر | منبع | چه چیزی را فعال می‌کند |
|------|------|------------------------|
| `update()` | polling هر frame | gamepad + keyboard edges |
| `keyHandler` | `window.addEventListener('keydown')` | keyboard |
| `bg.on('pointerdown')` | Phaser pointer events | mouse + touch |

### A2 — `findNearest` فقط up/down دارد (بعد از rewrite)

### A3 — `MenuNavHelper` اکثراً dead code است

### A4 — N کنترل‌کننده ورودی مستقل، هر کدام `keydown` listener

### A5 — `OverlayManager.open()` دو بار `show()` صدا می‌زند

### A6 — `clearFocusables()` tabs را پاک نمی‌کند

---

## ۳. باگ‌شناسی گیت: 15 کامیت، 10 پچ

| # | Hash | نوع | موضوع |
|---|------|-----|--------|
| 1 | `adf0991` | feat | UIController foundation |
| 2 | `4fb2c4a` | feat | migrate OverlayManager + GameScene |
| 3 | `f7e8074` | feat | migrate PauseMenuUI |
| 4 | `014c2a3` | feat | migrate NavigableOverlay |
| 5 | `d56eaf8` | cleanup | delete VirtualCursor |
| 6 | `2d69157` | fix | cursor mode + HangarUI crash |
| 7 | `10a8a48` | fix | P0: double-registration, keyboard stacking |
| 8 | `149a7a1` | fix | manual splice → registerNav |
| 9 | `717b44a` | fix | SettingsUI manual splice → registerNav |
| 10 | `34039ad` | feat | addTabs() + tab index sync |
| 11 | `626768e` | cleanup | dead code removal |
| 12 | `54998a5` | fix | gameplay callbacks blocked + Hangar crash |
| 13 | `9cad276` | fix | HangarUI re-entrancy + PauseMenu triggerFirst |
| 14 | `e5d20b5` | fix | 5 critical + 3 high bugs |
| 15 | `3086d91` | fix | Enter key (revert of C4) |

**الگو:** ۵ کامیت برای ساخت + ۱۰ کامیت برای پچ. پینگ‌پنگ C4 ↔ 3086d91.

---

## ۴. مقایسه‌ی `508f3e6` در برابر HEAD (`3086d91`)

| فیچر | `508f3e6` | HEAD | وضعیت |
|------|-----------|------|-------|
| HangarUI L1/R1 tab switch | ✅ داشت | ✅ دارد | حفظ شد |
| Settings/Inventory/SkillTree L1/R1 | ❌ نداشت | ✅ دارد | NEW |
| VirtualCursor | ✅ داشت (فایل جدا) | ❌ حذف شد | حذف شد |
| Cursor Mode در UIController | ❌ نداشت | ✅ دارد | NEW |
| PauseMenu navigation | خطی (up/down) | 2D spatial اما فقط up/down | CHANGED |
| PauseMenu ستون راست با موس | ⚠️ hit-area خراب | ✅ کار می‌کند | بهتر شد |
| PauseMenu ستون راست با کیبورد | ❌ غیرقابل دسترسی (B1-legacy) | ❌ غیرقابل دسترسی (B1) | هر دو مشکل دارند |
| Gameplay blocking در pause | ❌ نداشت | ✅ دارد | NEW |
| یکپارچه‌سازی navigation | ❌ هر UI جدا | ✅ UIController | NEW |

---

## ۵. توصیه

**نه rollback کور، نه fix کور.** 

1. **B1-legacy و B1:** هر دو نسخه مشکل ستون راست دارند — باید جدا فیکس شود (left/right به findNearest اضافه شود)
2. **B1-hitarea:** ✅ **تأیید شد که در HEAD فیکس شده** (کلیک روی RETURN TO HUB درست به Hub می‌رود، نه NEURAL CORTEX). این نقطه‌ای است که HEAD بهتر است.
3. **B2:** ✅ **ریشه در HEAD پیدا شد** (console.trace):
   - ENTER (2 صدا): `UIController.keyHandler` (line 459) + `GameScene.togglePause` (line 789) via onSelect
   - SPACE (3 صدا): `PlayerEntity.tryJump` (via InputSystem) + `UIController.keyHandler` + `GameScene.togglePause`
   - **علت معماری:** `keyHandler` هم صدا پخش می‌کند هم onSelect را صدا می‌زند، و onSelect ممکن است خودش صدا پخش کند
4. **بقیه باگ‌ها (B3-B6):** مختص HEAD، ناشی از UIController rewrite

## ۶. یافته‌های تست agent-browser (تأییدشده)

### تست روی HEAD (`3086d91` + docs commit `63005f8`)

| تست | نتیجه | توضیح |
|------|-------|-------|
| Menu: Arrow Down START→SETTINGS | ✅ کار می‌کند | focus درست حرکت می‌کند |
| Menu: Arrow Up SETTINGS→START | ✅ کار می‌کند | |
| Menu: Enter روی START | ✅ کار می‌کند | وارد Mission Select می‌شود |
| Pause: ESC باز کردن | ✅ کار می‌کند | |
| **B1-hitarea: Click روی RETURN TO HUB** | ✅ **درست در HEAD** | وارد Hub شد (نه NEURAL CORTEX) |
| **B1-hitarea: Hover روی RESTART** | ✅ **درست در HEAD** | focus به RESTART رفت (نه RESUME) |
| B1: Arrow Down در Pause | ⚠️ متفاوت اما هنوز مشکل دارد | RESUME→DATA VAULT→RETURN TO HUB→QUIT (ستون راست!) اما left/right کار نمی‌کند |
| **B2: Enter روی RESUME** | ❌ **2 oscillator** | keyHandler + togglePause |
| **B2: Space روی RESUME** | ❌ **3 oscillator** | tryJump + keyHandler + togglePause |

### تست روی `508f3e6` (قسمتی)

| تست | نتیجه | توضیح |
|------|-------|-------|
| Menu: Arrow Down START→SETTINGS | ✅ کار می‌کند | |
| Menu: Enter روی START | ✅ کار می‌کند | |
| Pause: ESC باز کردن | ✅ کار می‌کند | |
| **B1-legacy: Arrow Down در Pause** | ❌ فقط ستون چپ | RESUME→CHECKPOINT→NEURAL CORTEX→MISSION LOG→SETTINGS |
| **B1-legacy: Arrow Left/Right** | ❌ هیچ کاری نمی‌کند | |
| **B1-hitarea: Click روی RETURN TO HUB** | ❌ **بحرانی** | NEURAL CORTEX باز شد (دکمه‌ی اشتباه!) |
| **B1-hitarea: Hover روی RESTART** | ❌ focus به RESUME پرید | |
| **B2: Enter روی RESUME** | ❌ **2 oscillator** | ریشه هنوز ناشناخته (نیاز به console.trace) |
| **B2: Space روی RESUME** | ❌ **1 oscillator** | (در `508f3e6` Space فقط 1 صدا دارد — بهتر از HEAD!) |
| Hangar: باز کردن از Hub | ✅ کار می‌کند | (با موس روی nav button) |
| Hangar: S1 stress test | ⚠️ **ناتمام** | سیستم branch را mid-test عوض کرد (مشکل infrastructure) |

### محدودیت تست

**مشکل infrastructure:** در حین تست `508f3e6`، سیستم به‌طور خودکار branch را به `main` برمی‌گرداند (احتمالاً یک فرآیند خودکار). این باعث می‌شود dev server کد HEAD را کامپایل کند (Fast Refresh)، که باعث reload بازی و از دست رفتن state تست می‌شود.

**تأثیر:** نمی‌توان تست `508f3e6` را به‌طور قابل‌اعتماد کامل کرد. اما یافته‌های کلیدی (B1-legacy، B1-hitarea، B2 در `508f3e6`) قبل از این مشکل تأیید شده‌اند.

## ۷. نتیجه‌گیری نهایی

### مقایسه HEAD vs `508f3e6`

| معیار | HEAD (`3086d91`) | `508f3e6` | برنده |
|-------|------------------|-----------|-------|
| B1 (کیبورد ستون راست Pause) | ❌ وجود دارد (spatial اما فقط up/down) | ❌ وجود دارد (linear فقط ستون چپ) | مساوی — هر دو مشکل دارند |
| **B1-hitarea (موس)** | ✅ **فیکس شده** | ❌ **بحرانی** (کلیک اشتباه) | **HEAD** |
| B2 (Enter) | ❌ 2 صدا (ریشه شناخته شده) | ❌ 2 صدا (ریشه ناشناخته) | مساوی |
| B2 (Space) | ❌ 3 صدا (بدتر) | ❌ 1 صدا (بهتر) | **`508f3e6`** |
| Gameplay blocking در pause | ✅ دارد | ❌ ندارد | **HEAD** |
| L1/R1 tabs برای Settings/Inventory/SkillTree | ✅ دارد | ❌ ندارد | **HEAD** |
| یکپارچه‌سازی navigation | ✅ UIController | ❌ پراکنده | **HEAD** (از نظر معماری) |
| Hangar S1 stress test | ⚠️ تست نشد | ⚠️ تست نشد (infrastructure) | نا‌مشخص |

### توصیه نهایی

**HEAD را نگه دارید، نه rollback.** دلایل:
1. **B1-hitarea فیکس شده** در HEAD (بحرانی‌ترین باگ)
2. **Gameplay blocking** اضافه شده
3. **B2 ریشه‌یابی شد** — فیکس مشخص است: `UIController.keyHandler` نباید صدا پخش کند، فقط onSelect را صدا بزند (onSelect مسئول صدا است)
4. `508f3e6` هم B1-legacy و B2 را دارد، پس rollback مشکل را حل نمی‌کند

### فیکس‌های پیشنهادی (به ترتیب اولویت)

1. **B2 فیکس:** در `UIController.keyHandler` (line 459)، `AudioSystem.play('uiClick')` را حذف کنید. فقط `f.onSelect()` را صدا بزنید. onSelect مسئول پخش صدا است (یا نباشد). یک قرارداد روشن: «keyHandler هرگز صدا پخش نمی‌کند».

2. **B1 فیکس:** در `UIController.findNearest()`، پشتیبانی از `'left' | 'right'` اضافه کنید. در `update()`، `input.heldLeft/heldRight` را برای focus navigation (مستقل از tab switching) استفاده کنید.

3. **B3 فیکس:** در `HangarUI.showTab()`، بعد از re-registration، `focusIndex` را روی اولین content button بگذارید (نه EXIT).

4. **A3 فیکس:** dead code را از `MenuNavHelper` حذف کنید.

**هیچ تغییری در کد داده نشده است. این سند فقط تحلیل است.**
