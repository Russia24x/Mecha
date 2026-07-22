# مستندات فنی نهایی: مشکل اسلایدر تنظیمات با گیم‌پد

**تاریخ:** 2026-07-23
**وضعیت:** ریشه‌یابندی شدده — نیاز به تست با گیم‌پد فیزیکی + fix

---

## ۱. ریشه‌ی مشکل (تأییدشده با کد + تست)

سه عامل ترکیبی:

### عامل ۱: Category‌ها هم tab هستن هم focusable
- `SettingsUI.ts` خط ۸۹: `registerNav(bg, label, ...)` — category‌ها به‌عنوان focusable ثبت می‌شن
- `SettingsUI.ts` خط ۹۷-۱۰۰: `addTabs(...)` — همون category‌ها به‌عنوان tab ثبت می‌شن
- **اشتباه تاریخیه**: ابتدا فقط focusable بودن، بعد tabs اضافه شده ولی focusable‌ها حذف نشدن

### عامل ۲: D-pad نمی‌تونه به slider‌ها برسه
- Category‌ها تو ستون چپ (x ≈ 200)، slider‌ها تو ستون راست (x ≈ 590)
- `findNearest('down')` از AUDIO category، نزدیک‌ترین عنصر پایین رو پیدا می‌کنه → DISPLAY category (مستقیماً زیر AUDIO)
- slider‌ها به‌سمت راست هستن، نه پایین → D-pad up/down بهشون نمی‌رسه

### عامل ۳: leftStickX تداخل داره
- وقتی tabs وجود داره، `UIController.update()` از `leftStickX` برای tab switching استفاده می‌کنه
- `preUpdateHandler` هم از `leftStickX` برای slider adjustment استفاده می‌کنه
- `_sliderAdjusting` flag باید جلوی tab switching رو بگیره، ولی چون focus هیچ‌وقت روی slider نیست (عامل ۲)، `preUpdateHandler` همیشه return می‌کنه و flag ست نمی‌شه

## ۲. شکاف‌های تست

### شکاف ۱: موس و focusIndex
- **از کد:** `pointerover` (hover) در `addButton` (UIController.ts خط ۱۲۳-۱۲۶) `focusIndex` رو ست می‌کنه
- **از تست:** نتونستم با agent-browser تأیید کنم (موس agent-browser به‌طور قابل‌اعتماد به Phaser canvas نمی‌رسه)
- **از تجربه‌ی کاربر:** "موس خیلی بهتر شد" — یعسی با موس واقعی کار می‌کنه
- **نتیجه:** فرضیه محتمله ولی تأییدنشده

### شکاف ۲: keyboard ≠ گیم‌پد
- Keyboard ArrowLeft/Right → `heldLeft`/`heldRight` (InputSystem.ts خط ۲۱۵/۲۱۹)
- Gamepad D-pad → `leftStickX` (InputSystem.ts خط ۳۵۴-۳۵۵)
- Gamepad left stick → `leftStickX` (InputSystem.ts خط ۳۲۳)
- **نتیجه:** تست با keyboard مسیر متفاوتی از گیم‌پد رو تست می‌کنه

### شکاف ۳: نیاز به تست با گیم‌پد فیزیکی
- همه‌ی تست‌ها با agent-browser (keyboard) انجام شده
- **قبل از fix نهایی، تست با گیم‌پد فیزیکی واقعی لازمه**

## ۳. پیشنهاد fix

### قدم ۱: حذف category‌ها از focusable list
```typescript
// SettingsUI.ts — خط ۸۹
// تغییر: this.registerNav(bg, label, ...) → حذف registerNav برای category‌ها
// category‌ها فقط از طریق tabs (L1/R1) قابل‌تعویض باشن
```

### قدم ۲: D-pad up/down فقط بین slider‌ها + back
- بعد از حذف category‌ها از focusable list، D-pad up/down فقط بین slider‌ها و back button حرکت می‌کنه
- focus شروع از اولین slider

### قدم ۳: leftStickX برای slider adjustment
- وقتی slider focus هست، `preUpdateHandler` کار می‌کنه و `_sliderAdjusting` flag ست می‌شه
- `_sliderAdjusting` جلوی tab switching رو می‌گیره
- leftStickX برای slider adjustment استفاده می‌شه

### قدم ۴: try/finally برای `_sliderAdjusting`
- **اعمال شده** (commit b398215): `UIController.update()` تو `try/finally` پیچیده شده

## ۴. ریسک‌ها

۱. **حذف category‌ها از focusable list** ممکنه affects کنه:
   - Cursor mode (موس): `pointerover` روی category‌ها هنوز کار می‌کنه (چون `setInteractive` رو دارن)
   - ولی `focusIndex` دیگه روی category‌ها ست نمی‌شه

۲. **D-pad up/down فقط بین slider‌ها** ممکنه گیج‌کننده باشه اگه کاربر از D-pad برای category switching انتظار داشته باشه

۳. **نیاز به تست با گیم‌پد فیزیکی** قبل از deploy

## ۵. توصیه

۱. **قبل از fix:** تست با گیم‌پد فیزیکی واقعی برای تأیید مدل ذهنی
۲. **Fix:** حذف category‌ها از focusable list (فقط `registerNav` خط ۸۹ رو comment کن)
۳. **بعد از fix:** تست با گیم‌پد فیزیکی برای تأیید
۴. **اگه کار نکرد:** rollback و طراحی مجدد با interface `onAxisHeld`
