# چک‌لیست تست دستی UI — MECHA: LAST PROTOCOL

> برای هر کامیت UI، این چک‌لیست مو‌به‌مو اجرا شود.
> هر آیتم: ✅ کار می‌کند / ❌ کار نمی‌کند / ⚠️ ناقص / **N/A** (در این نسخه وجود ندارد).
> **نکته:** این سند قبلاً ساخته شده بود اما با ریست container محلی از بین رفت. دوباره بازسازی شد.

---

## ⚠️ نحوه اجرای تست‌ها — حیاتی

### مشکل: شبیه‌سازی ورودی در مرورگر headless

در نشست قبلی، کلیک روی canvas با Playwright/agent-browser قابل‌اعتماد نبود. برای جلوگیری از «✅ تست شد» بدون تست واقعی:

| روش ورودی | چطور تست شود | سطح اطمینان |
|-----------|--------------|-------------|
| **کیبورد** | Playwright `press` یا ارسال واقعی KeyboardEvent | بالا |
| **موس** | Playwright `mouse.click(x, y)` + بررسی تغییر state | متوسط |
| **گیم‌پد** | (الف) گیم‌پد فیزیکی، (ب) mock `navigator.getGamepads()` | پایین برای (ب) |

### قانون شفافیت

هر گزارش تست باید شامل باشد از:
1. **روش اجرا:** کدام روش استفاده شد
2. **دلیل روش:** چرا این روش
3. **خروجی واقعی:** لاگ console یا screenshot، نه فقط «کار کرد»
4. **اگر mock شد:** دقیقاً چه چیزی mock شد

---

## نشان‌گذاری آیتم‌ها

| نشان | معنی |
|------|------|
| (بدون نشان) | در هر دو نسخه وجود دارد — باید کار کند |
| **[NEW]** | بعد از `adf0991` اضافه شد. در `508f3e6` وجود ندارد. |
| **[CHANGED]** | در هر دو نسخه وجود دارد اما رفتارش متفاوت است. |

---

## بخش ۱: Menu (تست شده روی `508f3e6`)

### ۱.۱ ناوبری کیبورد
- ✅ Arrow Down: focus از START به SETTINGS می‌رود (تأیید با VLM)
- ✅ Arrow Up: focus به START برمی‌گردد (تأیید با VLM)
- ✅ Enter: وارد Mission Select می‌شود (تأیید با VLM)
- [ ] Space: (نیاز به تست)
- [ ] ESC: (نیاز به تست)

### ۱.۲-۱.۴ ناوبری گیم‌پد/موس/عملکردها
- [ ] نیاز به تست کامل

---

## بخش ۲: Hub (تست جزئی روی `508f3e6`)

### ۲.۱ ناوبری کیبورد
- ⚠️ Arrow Down: به "Abandoned Factory" mission card می‌رود (نه nav bar پایین)
- [ ] nav bar پایین (HANGAR/SKILLS/INVENTORY/QUESTS/SETTINGS) با کیبورد قابل دسترسی است؟
- [ ] Enter روی nav button: overlay باز می‌شود؟

### ۲.۲-۲.۴
- [ ] نیاز به تست کامل

---

## بخش ۳: Hangar

### ۳.۱ ناوبری کیبورد
- [ ] Arrow Down/Up: بین آیتم‌های لیست
- [ ] Arrow Left/Right: بین تب‌ها
- [ ] Enter/Space: آیتم focused انتخاب می‌شود (یک بار)
- [ ] ESC: بسته می‌شود

### ۳.۲ ناوبری گیم‌پد
- [ ] D-pad/stick Up/Down: بین آیتم‌ها
- [ ] L1/R1: بین تب‌ها **[CHANGED]**
- [ ] A button: انتخاب
- [ ] B button: بستن

### ۳.۳ ناوبری موس
- [ ] Click روی تب: تب عوض می‌شود (**S1**)
- [ ] Click روی آیتم لیست: انتخاب
- [ ] Click روی SELECT button: equip
- [ ] Click روی EXIT: بستن
- [ ] Click دوم روی تب دیگر: آیا کار می‌کند؟ (**S1**)

### ۳.۴ عملکردها
- [ ] تب Chassis: آیتم‌ها + preview + stats
- [ ] تب Loadout: placeholder
- [ ] تب Companion: کارت‌ها
- [ ] تب Paint: آیتم‌ها + preview
- [ ] انتخاب chassis: SaveSystem آپدیت
- [ ] انتخاب paint: SaveSystem آپدیت
- [ ] **بعد از tab switch، focus کجاست؟** (**B3**) **[NEW concern]**

### ۳.۵ تست استرس S1 (مهم)
- [ ] **در Hangar، ظرف ۵ ثانیه حداقل ۱۰ بار پشت‌سرهم و سریع بین تب‌ها کلیک/سوییچ کنید — آیا crash می‌کند؟**
- [ ] **روش اجرا:**
- [ ] **نتیجه:**

### ۳.۶ تست ورود/خروج مکرر
- [ ] **۱۰ بار پشت‌سرهم وارد Hangar شوید و خارج شوید — کرش یا کندی؟**

### ۳.۷ تست پایداری انتخاب
- [ ] **chassis/paint انتخاب‌شده، بعد از خروج و ورود دوباره، همان می‌ماند؟**

---

## بخش ۴: Pause Menu (تست شده روی `508f3e6`)

### ۴.۱ باز کردن
- ✅ ESC در play: Pause Menu باز می‌شود (تأیید)
- [ ] Start button (گیم‌پد): باز می‌شود؟
- [ ] بازی متوقف می‌شود؟

### ۴.۲ ناوبری کیبورد
- ✅ Arrow Down: RESUME → CHECKPOINT → NEURAL CORTEX → MISSION LOG → SETTINGS (فقط ستون چپ) **(B1-legacy)**
- ❌ Arrow Right: هیچ کاری نمی‌کند **(B1-legacy)**
- ❌ Arrow Left: هیچ کاری نمی‌کند **(B1-legacy)**
- [ ] Enter/Space: (تأیید B2 — Enter دوبار صدا)
- [ ] ESC: بستن Pause

### ۴.۳ ناوبری گیم‌پد
- [ ] نیاز به تست

### ۴.۴ ناوبری موس
- ❌ Hover روی RESTART: focus به RESUME پرید **(B1-hitarea)**
- ❌ Click روی RETURN TO HUB موقعیت: NEURAL CORTEX باز شد! **(B1-hitarea — بحرانی)**
- [ ] Click روی RESUME: back به play (تأیید کار می‌کند)
- [ ] Click روی سایر دکمه‌های ستون چپ: نیاز به تست

### ۴.۵ عملکردها
- ✅ RESUME: بازی resume شد (تأیید)
- [ ] بقیه: نیاز به تست

### ۴.۶ مسدودسازی gameplay در حالت pause
- [ ] **در Pause، دکمه‌ی fire/jump/melee/dash را بزنید — کاراکتر عکس‌العمل نشان نمی‌دهد؟**

---

## بخش ۵: Inventory (Data Vault)

### ۵.۱ ناوبری کیبورد
- [ ] Arrow Up/Down: بین آیتم‌ها
- [ ] Arrow Left/Right: بین تب‌ها **[CHANGED]**
- [ ] Enter/Space: فعال‌سازی slot
- [ ] ESC: بستن

### ۵.۲ ناوبری گیم‌پد
- [ ] L1/R1: تب‌سوییچ **[NEW]** — در `508f3e6` وجود نداشت. در rollback: **N/A**

### ۵.۳ ناوبری موس
- [ ] Click روی تب: تب عوض می‌شود
- [ ] Click روی slot: فعال
- [ ] Click روی BACK: بستن

### ۵.۴ عملکردها
- [ ] تب‌ها محتوای متفاوت
- [ ] slot‌ها قابل فعال‌سازی

---

## بخش ۶: Skill Tree (Neural Cortex)

### ۶.۱ ناوبری کیبورد
- [ ] Arrow Up/Down/Left/Right: بین node‌ها
- [ ] Enter/Space: unlock
- [ ] ESC: بستن

### ۶.۲ ناوبری گیم‌پد
- [ ] L1/R1: بین tree‌ها **[NEW]** — در rollback: **N/A**

### ۶.۳ ناوبری موس
- [ ] Click روی node: unlock
- [ ] Click روی tree tab: تب عوض
- [ ] Click روی BACK: بستن

### ۶.۴ عملکردها
- [ ] node unlock: SaveSystem آپدیت
- [ ] node‌های locked غیرقابل کلیک

---

## بخش ۷: Settings

### ۷.۱ ناوبری کیبورد
- [ ] Arrow Up/Down: بین تنظیمات
- [ ] Arrow Left/Right: slider nudge / تب‌سوییچ **[CHANGED]**
- [ ] Enter/Space: toggle
- [ ] ESC: بستن

### ۷.۲ ناوبری گیم‌پد
- [ ] L1/R1: تب‌سوییچ **[NEW]** — در `508f3e6` L1/R1 slider nudge بود

### ۷.۳ ناوبری موس
- [ ] Click روی تب: تب عوض
- [ ] Click روی slider: jump به مقدار
- [ ] Click روی toggle: on/off
- [ ] Click روی BACK: بستن

### ۷.۴ عملکردها
- [ ] تغییر volume: AudioSystem آپدیت
- [ ] تغییر زبان: UI reload
- [ ] تنظیمات ذخیره

---

## بخش ۸: Quest Log

### ۸.۱ ناوبری
- [ ] کیبورد: Up/Down + Enter + ESC
- [ ] گیم‌پد: D-pad/stick + A + B
- [ ] موس: click روی quest + BACK

### ۸.۲ عملکردها
- [ ] quest‌ها نمایش
- [ ] quest فعال highlight
- [ ] توضیحات quest

---

## بخش ۹: World Map

### ۹.۱ ناوبری
- [ ] کیبورد: Up/Down/Left/Right + Enter + ESC
- [ ] گیم‌پد: D-pad/stick + A + B
- [ ] موس: click روی area + BACK

### ۹.۲ عملکردها
- [ ] area‌های unlocked قابل کلیک
- [ ] area‌های locked غیرقابل کلیک
- [ ] fast travel کار

---

## بخش ۱۰: Overlay Stacking

### ۱۰.۱ Settings از Pause
- [ ] ESC در play → Pause
- [ ] Click روی SETTINGS → Settings overlay
- [ ] ناوبری در Settings
- [ ] ESC در Settings: Settings بسته، Pause دوباره
- [ ] ناوبری در Pause دوباره

### ۱۰.۲ Settings از Hub
- [ ] در Hub → Settings
- [ ] ESC: بسته، back به Hub
- [ ] ناوبری در Hub دوباره

### ۱۰.۳ Hangar از Hub
- [ ] در Hub → Hangar
- [ ] ESC: بسته، back به Hub

### ۱۰.۴ Keyboard stacking test
- [ ] Settings از Pause باز است. Enter بزنید. فقط Settings فعال می‌شود؟ **[CHANGED]**

### ۱۰.۵ بازگشت cursor بعد از بستن overlay
- [ ] **بعد از بستن overlay، cursor در دسترس است؟**

---

## بخش ۱۱: Cursor Mode (گیم‌پد) **[CHANGED]**

> در `508f3e6` به‌صورت `VirtualCursor` جدا. در HEAD یکپارچه در `UIController`.

### ۱۱.۱ فعال‌سازی
- [ ] right stick → cursor ظاهر می‌شود **[CHANGED]**
- [ ] cursor با right stick حرکت

### ۱۱.۲ ناوبری cursor
- [ ] cursor روی دکمه hover → highlight (**S2**)
- [ ] A button وقتی cursor روی دکمه: فعال
- [ ] حرکت cursor خارج: highlight پاک

### ۱۱.۳ خروج از cursor mode
- [ ] D-pad/stick left → cursor ناپدید، focus mode **[NEW behavior]**
- [ ] focus روی دکمه فعلی می‌ماند یا reset؟

---

## بخش ۱۲: تست‌های Cross-cutting

### ۱۲.۱ سوییچ لحظه‌ای بین روش‌های ورودی
- [ ] **موس → D-pad → کیبورد — بدون قطع‌شدگی؟**

### ۱۲.۲ صدای دوبل (تأیید B2 در `508f3e6`)
- ✅ **Enter روی RESUME در `508f3e6`: ۲ oscillator (دوبار)** — تأیید با AudioContext instrumentation
- ✅ **Space روی RESUME در `508f3e6`: ۱ oscillator (یک بار)**
- [ ] **ریشه با console.trace:** کدام دو call-site صدا را پخس می‌کنند؟
- [ ] Menu: (نیاز به تست)
- [ ] Hub: (نیاز به تست)
- [ ] Hangar: (نیاز به تست)
- [ ] Pause: ✅ Enter = 2x, Space = 1x (تأیید)
- [ ] Settings: (نیاز به تست)
- [ ] Inventory: (نیاز به تست)
- [ ] SkillTree: (نیاز به تست)

### ۱۲.۳ پایداری state بین overlay‌ها
- [ ] play → Pause → Settings → ESC → ESC → back to play. state سالم؟
- [ ] hub → Hangar → esc → Settings → esc → back to hub. state سالم؟

---

## خلاصه نهایی

| بخش | کیبورد | گیم‌پد | موس | عملکرد | تست‌های خاص |
|------|--------|--------|-----|--------|--------------|
| ۱ Menu | ۳/۵ ✅ | ۰/۴ | ۰/۳ | ۱/۳ ✅ | — |
| ۲ Hub | ۱/۴ ⚠️ | ۰/۴ | ۰/۳ | ۰/۴ | — |
| ۳ Hangar | ۰/۴ | ۰/۴ | ۰/۵ | ۰/۷ | ۰/۳ |
| ۴ Pause | ۴/۶ (B1,B2) | ۰/۴ | ۲/۱۲ (B1-hitarea) | ۲/۵ ✅ | ۰/۱ |
| ۵ Inventory | ۰/۴ | ۰/۴ | ۰/۳ | ۰/۲ | — |
| ۶ SkillTree | ۰/۳ | ۰/۴ | ۰/۳ | ۰/۲ | — |
| ۷ Settings | ۰/۴ | ۰/۴ | ۰/۴ | ۰/۳ | — |
| ۸ Quest | ۰/۳ | ۰/۳ | ۰/۲ | ۰/۳ | — |
| ۹ Map | ۰/۳ | ۰/۳ | ۰/۲ | ۰/۳ | — |
| ۱۰ Stacking | — | — | — | ۰/۴ | ۰/۱ |
| ۱۱ Cursor | — | ۰/۴ | — | ۰/۲ | — |
| ۱۲ Cross | — | — | — | ۰/۲ | ۲/۲ (B2 تأیید) |

**تعداد کل آیتم‌ها:** ~140
**تأییدشده:** ~12 آیتم (بخش‌های ۱، ۲، ۴، ۱۲.۲)
**باگ‌های تأییدشده:** B1-legacy, B1-hitarea, B2 (در `508f3e6`)

---

## کشف باگ جدید

اگر باگ جدیدی کشف کردید:

```
### B# — [نام باگ]
**بخش:** [مثلاً Hangar]
**روش ورودی:** [کیبورد/گیم‌پد/موس]
**روش اجرا:** [Playwright / mock گیم‌پد / دستی]
**تکرار:** [همیشه/گاهی/یک‌بار]
**مراحل:**
1. ...
**انتظار:** ...
**واقعیت:** ...
**لاگ/screenshot:** (پیوست)
**شدت:** [بحرانی/بالا/متوسط/پایین]
```
