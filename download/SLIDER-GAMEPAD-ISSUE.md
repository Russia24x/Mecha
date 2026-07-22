# مستندات فنی: مشکل اسلایدر تنظیمات با گیم‌پد

**تاریخ:** 2026-07-23
**وضعیت:** حل‌نشده — نیاز به راهنمایی معماری

---

## ۱. خلاصه‌ی مشکل

اسلایدرهای تنظیمات (Master Volume, SFX Volume, Brightness) با **موس** کار می‌کنند (click-to-jump + drag)، ولی با **گیم‌پد** فقط یک بار قابل تنظیم‌اند — بعد از اولین تغییر، دیگه نمی‌شه مقدار رو تغییر داد.

## ۲. معماری فعلی

### فایل‌های درگیر
- `src/game/ui/settings/SettingsUI.ts` — `makeSlider()` اسلایدر رو می‌سازه
- `src/game/ui/UIController.ts` — input navigation رو هندل می‌کنه
- `src/game/ui/NavigableOverlay.ts` — base class برای overlay‌ها
- `src/game/ui/OverlayManager.ts` — overlay lifecycle و update dispatch

### جریان input (هر فریم)

```
GameScene.update()
  → OverlayManager.updateInput()
    → ctrl.update()  (UIController.update)
      → focus mode یا cursor mode
      → tab switching (L1/R1 یا leftStickX)
      → focus navigation (D-pad up/down)
      → A button activation (gpJumpPressed/gpFirePressed → onSelect)
```

### ساختار اسلایدر فعلی

هر اسلایدر شامل:
- `labelEl` — نام (مثلاً "Master Volume")
- `track` — rectangle ۳۰۰×۸ (خط زمینه)
- `fill` — rectangle (پر شدن)
- `handle` — circle ۱۰px (دایره قابل drag)
- `valueText` — درصد (مثلاً "70%")
- `sliderBg` — rectangle ۳۴۰×۳۶ با alpha=0.01 (hit area)

### ثبت input فعلی

۱. **موس (کار می‌کنه):**
   - `scene.input.on('pointerdown', clickToJump)` — bounds check + click-to-jump
   - `sliderBg.on('pointerdown', ...)` — برای cursor-mode A button
   - `handle.setInteractive()` + `setDraggable()` — drag handle
   - `sliderBg.setDraggable()` — drag anywhere on track

۲. **گیم‌پد focus mode (کار نمی‌کنه):**
   - `sliderBg.setData('sliderData', {getValue, setValue})` — ذخیره‌ی توابع
   - `scene.events.on('preupdate', preUpdateHandler)` — چک می‌کنه آیا slider focus شده و left/right held هست
   - اگه بله: `sliderData.setValue()` صدا می‌زنه + `_sliderAdjusting` flag روی ctrl ست می‌کنه

۳. **گیم‌پد A button (کار می‌کنه):**
   - `registerNav(sliderBg, labelEl, onSelect)` — onSelect = nudge 5%
   - UIController.update() وقتی `gpJumpPressed` صدا می‌زنه `f.onSelect()`

## ۳. ریشه‌ی مشکل

### مشکل اصلی: تداخل tab switching با slider adjustment

تو `UIController.update()` (خط ۳۰۵-۳۲۰):

```typescript
// Tab switching (L1/R1, stick left/right)
if (this.tabs.length > 0 && !sliderAdjusting) {
  if (input.gpWeaponPrevPressed || input.leftStickX < -0.3) {
    // tab switch left
    this.currentTabIndex = ...
    this.tabs[this.currentTabIndex].onSelect();  // ← این refreshOptions() صدا می‌زنه!
    return;
  }
  if (input.gpWeaponNextPressed || input.leftStickX > 0.3) {
    // tab switch right
    ...
  }
}
```

SettingsUI تب‌ داره (AUDIO/DISPLAY/LANGUAGE). وقتی کاربر left stick رو برای تنظیم اسلایدر به چپ/راست هل می‌ده، `leftStickX < -0.3` یا `> 0.3` true می‌شه.

### مشکل timing

```
فریم N:
  1. preUpdateHandler اجرا می‌شه
     - چک می‌کنه آیا slider focus شده؟ (بله)
     - leftStickX < -0.3؟ (بله)
     - sliderData.setValue() صدا می‌زنه (مقدار کم می‌شه)
     - ctrl._sliderAdjusting = true ست می‌کنه
  2. UIController.update() اجرا می‌شه
     - sliderAdjusting = true → tab switch skip می‌شه ✓
     - اما focus navigation هم چک می‌شه:
       left = this.tabs.length === 0 && ... (false، چون tabs.length > 0)
       right = this.tabs.length === 0 && ... (false)
     - پس focus navigation هم skip می‌شه ✓
  3. انتهای update: _sliderAdjusting = false ست می‌شه

فریم N+1:
  1. preUpdateHandler اجرا می‌شه
     - slider focus هنوز هست؟ (باید بله باشه)
     - leftStickX هنوز < -0.3؟ (اگه held باشه، بله)
     - sliderData.setValue() دوباره صدا می‌زنه ✓
```

**اما کاربر می‌گه فقط یک بار کار می‌کنه.** پس یه چیزی تو این flow اشتباهه.

### فرضیه‌های احتمالی

۱. **`sliderData.getValue()` مقدار اشتباه برمی‌گردونه**
   - `getValue: () => parseFloat(valueText.text) / 100`
   - اگه `valueText.text` درست به‌روز نشه، getValue مقدار قدیمی برمی‌گردونه
   - ولی `setValue` هر بار `valueText.setText()` صدا می‌زنه، پس باید درست باشه

۲. **focus از slider خارج می‌شه**
   - شاید بعد از setValue، یه چیزی focus رو عوض می‌کنه
   - ولی preUpdateHandler چک می‌کنه `currentFocus?.bg !== sliderBg` و return می‌کنه

۳. **`gpWeaponPrevPressed` edge-triggered هست و tab switch می‌کنه**
   - `gpWeaponPrevPressed` فقط لحظه‌ی فشار دادن true می‌شه
   - ولی `leftStickX < -0.3` continuous هست
   - اگه `sliderAdjusting` flag درست ست بشه، tab switch نباید اتفاق بیفته

۴. **preUpdateHandler قبل از UIController.update اجرا نمی‌شه**
   - `scene.events.on('preupdate')` قبل از scene.update اجرا می‌شه
   - ولی OverlayManager.updateInput کجا صدا زده می‌شه؟

۵. **`navCooldown` جلوی preUpdateHandler رو نمی‌گیره، ولی جلوی UIController.update رو می‌گیره**
   - اگه navCooldown > 0 باشه، UIController.update return می‌کنه (خط ۲۹۹)
   - ولی preUpdateHandler هیچ cooldown‌ای نداره
   - پس preUpdateHandler هر فریم اجرا می‌شه، ولی UIController.update شاید skip بشه

### سؤالات بی‌جواب

۱. آیا `scene.events.on('preupdate')` واقعاً قبل از `OverlayManager.updateInput()` اجرا می‌شه؟
۲. آیا `ctrl.focusIndex` بعد از `setValue()` تغییر می‌کنه؟
۳. آیا `sliderBg` بعد از `setValue()` هنوز تو `ctrl.focusables` هست؟
۴. آیا `InputSystem.getState()` هر فریم به‌روز می‌شه، یا stale هست؟

## ۴. تغییرات انجام‌شده (که ممکنه side effect داشته باشن)

### SettingsUI.ts
- `makeSlider()`: sliderBg width از ۳۲۰ به ۳۴۰، height از ۲۴ به ۳۶، alpha از ۰ به ۰.۰۱
- `makeSlider()`: اضافه‌شدن `scene.input.on('pointerdown', clickToJump)` با bounds check
- `makeSlider()`: اضافه‌شدن `sliderBg.on('pointerdown', ...)` برای cursor mode
- `makeSlider()`: اضافه‌شدن `sliderBg.setData('sliderData', {getValue, setValue})`
- `makeSlider()`: اضافه‌شدن `scene.events.on('preupdate', preUpdateHandler)`
- `makeSlider()`: اضافه‌شدن `scene.input.setDraggable(sliderBg)` + drag handler
- `refreshOptions()`: اضافه‌شدن cleanup برای `_sliderCleanups` قبل از destroy
- `destroy()`: اضافه‌شدن cleanup برای `_sliderCleanups`
- `handleNavigation()`: override شده ولی **استفاده نمی‌شه** (OverlayManager ctrl.update() صدا می‌زنه)

### UIController.ts
- `update()`: اضافه‌شدن `_sliderAdjusting` flag check برای skip tab switching
- `update()`: پاک‌سازی `_sliderAdjusting` در انتهای update

## ۵. ریسک‌های احتمالی

۱. **`scene.input.on('pointerdown')` listener‌ها ممکنه leak بشن** اگه cleanup درست کار نکنه
۲. **`scene.events.on('preupdate')` listener‌ها ممکنه leak بشن** اگه cleanup درست کار نکنه
۳. **`_sliderAdjusting` flag ممکنه تو state غلط بمونه** اگه exception پرتاب بشه
۴. **تغییر UIController.update()** ممکنه affects بقیه UI‌ها که tab دارن (Inventory, SkillTree, etc.)

## ۶. پیشنهادها برای مشاور

### گزینه A: debugging دقیق
- اضافه‌کردن console.log تو preUpdateHandler و UIController.update برای دیدن جریان واقعی
- چک‌کردن آیا preUpdateHandler اصلاً صدا زده می‌شه
- چک‌کردن آیا focusIndex بعد از setValue تغییر می‌کنه

### گزینه B: طراحی مجدد
- به‌جای rely کردن به preUpdateHandler، یه مکانیزم تمیزتر طراحی بشه
- مثلاً: UIController یه `isSliderFocused` property داشته باشه که subclasses ست کنن
- یا: slider‌ها یه `onFocus()` / `onBlur()` callback داشته باشن که input mode رو عوض کنن

### گزینه C: rollback
- تغییرات اسلایدر گیم‌پد رو برگردونیم به حالت قبل (فقط nudge 5% با A button)
- تا زمانی که یه راه‌حل تمیز طراحی بشه

## ۷. توصیه

**توصیه:** گزینه C (rollback) + بعد گزینه B (طراحی مجدد). 

دلیل: تغییرات فعلی پیچیده‌ست، side effect‌های نامعلوم داره، و مطمئن نیستیم درست کار می‌کنه. بهتره اول rollback بشه، بعد یه طراحی تمیز با مشاور انجام بشه.
