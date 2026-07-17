# MECHA: LAST PROTOCOL — گزارش اتصال محتوا به فنی و مقایسه با اسناد طراحی

> این گزارش با خواندن کامل تمام اسناد طراحی + مقایسه با کد واقعی تهیه شده.
> تاریخ: 2026-07-15
> وضعیت: تحلیل فقط خواندنی — هیچ کدی تغییر نکرده.

---

## خلاصه‌ی اجرایی

پروژه **دو واقعیت موازی** دارد:

1. **اسناد چشم‌انداز** (WORLD_BIBLE, PLAYER_EXPERIENCE_BIBLE, GDD, DESIGN_PILLARS, MOMENTS, AUDIO_BIBLE) — یک مترویدوانیا ۶ اکتی بلندپروازانه با ۶ باس فلسفی، ۵ خانواده دشمن، ۶ NPC، مبارزه‌ی سولس‌لایک، داستان‌محیطی، و «سکوت به‌عنوان موسیقی» توصیف می‌کنند. این اسناد **درون‌سازگار و زیبا** هستند.

2. **اسناد وضعیت** (PROJECT_AUDIT, GAME_DIRECTOR_REVIEW, STATUS, AGENT_GUIDE, NEXT_TASK, CURRENT_STATE, DECISIONS, docs/ARCHITECTURE.md) — یک وضعیت prototype قدیمی توصیف می‌کنند. **این اسناد به‌طور قابل‌توجهی قدیمی هستند** — ادعا می‌کنند توانایی‌ها خراب‌اند، خطرات وجود ندارند، فقط ۱۹ مهارت وجود دارد، GameScene ۱۰۸۱ خط است، و غیره. کد بسیار فراتر رفته.

3. **کد واقعی** — یک vertical slice از Act I + Act IV ناقص با همه‌ی ۵ توانایی حرکتی، ۶ نوع دشمن، ۲ باس، ۲۹ مهارت، ۸ سلاح، خطرات، میان‌برها، lore objects، و یک سیستم metroidvania کارآمد. **کد منبع حقیقت فعلی است.**

**بزرگ‌ترین شکاف:** ۳ از ۵ اکت خالی‌اند (Acts II, III, V). arc روایی ۵ اکتی WORLD_BIBLE برای ۶۰٪ طول خود **پیاده‌سازی نشده**.

---

## جدول مقایسه‌ی اصلی

### ۱. دنیا و داستان

| جنبه | اسناد طراحی می‌گویند | کد واقعاً دارد | شکاف | اولویت |
|------|---------------------|----------------|------|--------|
| تعداد اکت | ۶ (I-V + Final) | ۵ (I, II, III, IV, V) — Final نیست | کوچک | P1 |
| اکت‌های با محتوا | همه ۶ | فقط I و IV (۶۰٪ خالی) | **بحرانی** | P0 |
| باس‌ها | ۶ (Guardian, Leviathan, Iron Magistrate, Gardener, Architect, Silent Protocol) | ۲ (guardian_ax09, neural_overseer — neural_overseer در bible نیست) | **بحرانی** | P0 |
| باس به‌عنوان ایده | هر باس یک ایده‌ی فلسفی با بیان مکانیکی | ۲ باس palette-swap با ۴ حمله‌ی یکسان | بزرگ | P1 |
| خانواده‌های دشمن | ۵ خانواده با ۱۵+ نوع | ۶ نوع، بدون فیلد family | بزرگ | P1 |
| NPCها | ۶ NPC در ۳ archetype | ۲ NPC در Act I، بدون archetype | بزرگ | P1 |
| تحویل lore | محیطی (terminal/corpse/echo)، کشف‌شده نه روایت‌شده | ۱۱ lore object در Act I + ۴ در Act IV؛ LoreSystem با ۴ entry | کوچک | P2 |
| revealing حقیقت | در Final Act | Final Act وجود ندارد | **بحرانی** | P0 |

### ۲. تجربه‌ی بازیکن

| جنبه | اسناد می‌گویند | کد دارد | شکاف |
|------|---------------|---------|------|
| «هر ۳۰ ثانیه: کشف/مبارزه/پاداش/سؤال» | بله | Act I متراکم ✅؛ Act IV تُنک؛ ۳ stub کاملاً خالی | بزرگ |
| دقیقه ۰: بدون tutorial متنی | بله | BootScene متن عنوان دارد؛ ControlHintsUI نشان می‌دهد | کوچک |
| دقیقه ۱۰: اولین drone + scrap | بله | S2 چهار drone + scrap drop ✅ | هیچ |
| ساعت ۱: مرگ باس = اندوه | بله | Atlas زانو می‌زند ✅ | هیچ |
| ساعت ۵: revealing حقیقت | بله | **غایب** (Act V محتوا ندارد) | **بحرانی** |
| انتخاب پایانی | باینری (بیدار کردن Protocol / رها کردن) | **غایب** (Final Act نیست) | **بحرانی** |

### ۳. مبارزه و توانایی‌ها

| جنبه | اسناد می‌گویند | کد دارد | شکاف |
|------|---------------|---------|------|
| Heavy/Precise/Punishing | بله | commit windows ✅، posture/stagger ✅، ولی no death penalty، no parry، no dodge-roll | بزرگ |
| سیستم posture | ضمنی | ۰-۱۰۰، stagger در پر شدن، +۵۰٪ bonus damage ✅ | هیچ |
| Parry | Pillar اشاره می‌کند | **پیاده‌سازی نشده** | بزرگ |
| Dodge-roll با i-frames | Pillar اشاره می‌کند | **پیاده‌سازی نشده** (dash هست ولی movement tool) | بزرگ |
| ۵ توانایی (double jump, wall jump, grapple, hover, EMP, hack) | GDD فهرست می‌کند | همه‌ی ۵ پیاده‌سازی شده ✅ | هیچ |
| هر توانایی ≥۱ ناحیه‌ی پنهان باز می‌کند | بله | Act I: requiredAbility collectibles ✅؛ Act IV: هیچ؛ stubs: هیچ | بزرگ |
| ۶ نوع دشمن با رفتار متمایز | بله (per family) | ۶ نوع، همه کارآمد، ولی بدون family categorization | کوچک |

### ۴. پیشرفت

| جنبه | اسناد می‌گویند | کد دارد | شکاف |
|------|---------------|---------|------|
| XP curve `100 × level^1.5` | بله | بله ✅ | هیچ |
| Max level 100 | بله | بله ✅ | هیچ |
| ۶ skill tree × ۳ tier | بله | بله ✅ (۲۹ مهارت) | هیچ |
| Upgrade سلاح: ۵ سطح × +۱۰٪ damage | بله | بله ✅ | هیچ |
| سیستم chassis | **در اسناد نیست** | ۳ کلاس تعریف شده، ولی multipliers در computeStats اعمال نمی‌شود | بزرگ |
| سیستم paints | **در اسناد نیست** | ۴ paint، ۳ غیرقابل unlock | بزرگ |
| سیستم companion | **در اسناد نیست** | ۷ companion تعریف شده، CompanionSystem غایب | بزرگ |

### ۵. Metroidvania

| جنبه | اسناد می‌گویند | کد دارد | شکاف |
|------|---------------|---------|------|
| Collectibles | بله | Act I: ۷؛ Act IV: ۰؛ stubs: ۰ | بزرگ |
| Shortcuts | بله | Act I: ۲؛ Act IV: ۰؛ stubs: ۰ | بزرگ |
| Ability-gated areas | بله | Act I: ✅؛ Act IV: ۰؛ stubs: ۰ | بزرگ |
| EMP doors | ضمنی | Act I: ۱؛ Act IV: ۰ | کوچک |
| Grapple anchors | ضمنی | Act I: ۲؛ Act IV: ۰ | کوچک |

### ۶. دشمنان و باس‌ها

| جنبه | اسناد می‌گویند | کد دارد | شکاف |
|------|---------------|---------|------|
| تعداد دشمن | ۵ خانواده × ۳ = ۱۵ | ۶ نوع | بزرگ |
| تعداد باس | ۶ | ۲ | **بحرانی** |
| باس‌های متمایز فلسفی | هر باس ایده‌ای منعکس می‌کند | ۲ palette-swap | **بحرانی** |
| مرگ باس = اندوه | بله | Atlas زانو می‌زند ✅ | هیچ |
| Mini-boss | ضمنی | Elite در S4 به‌عنوان mini-boss spawn می‌شود ✅ | هیچ |
| FSM با telegraph | بله (DECISIONS #7) | بله ✅ | هیچ |

### ۷. UI/UX

| جنبه | اسناد می‌گویند | کد دارد | شکاف |
|------|---------------|---------|------|
| HUD, Inventory, SkillTree, Pause, Settings, Map, Dialogue | بله | همه ✅ | هیچ |
| Quest UI | بله | QuestUI ✅ (ولی ۱ quest، قابل شروع نیست) | کوچک |
| Hangar UI | **در اسناد نیست** | HangarUI ✅ | بزرگ (بدون پایه‌ی طراحی) |
| Lore codex | PROJECT_AUDIT: «غایب» | LoreController برای in-world lore؛ codex panel جدا نیست | کوچک |

### ۸. صدا

| جنبه | اسناد می‌گویند | کد دارد | شکاف |
|------|---------------|---------|------|
| Mix 40/30/20/10 | بله | Ambient + drone ✅، silence ✅، **music = ۰** | بزرگ |
| ۸ دسته‌ی صدا | بله | AudioSystem ۸ دسته ✅ | هیچ |
| SFX list | فهرست دقیق | اکثر procedural ✅ | کوچک |
| موسیقی در ۳ لحظه | بله | **۰ آهنگ** | **بحرانی** |

### ۹. بصری و زیبایی‌شناختی

| جنبه | اسناد می‌گویند | کد دارد | شکاف |
|------|---------------|---------|------|
| پالت رنگ | dark blue + amber + cyan | Theme.ts ✅ | هیچ |
| سبک UI: corner brackets, hex nodes | بله | ✅ | هیچ |
| Atmosphere (dust, fog, god rays) | ضمنی | AtmosphereSystem + ForestEnvironmentSystem ✅ | هیچ |
| هویت بصری per-Act | بله | Act I: factory ✅؛ Act IV: forest ✅؛ stubs: فقط bgColor | بزرگ |
| Sprite atlas / هنر واقعی | (Director Review) | همه‌ی procedural — بدون sprite atlas | بزرگ |

### ۱۰. معماری فنی

| جنبه | اسناد می‌گویند | کد دارد | شکاف |
|------|---------------|---------|------|
| Phaser 4.2 + Matter.js + Next.js + TS | بله | ✅ | هیچ |
| طراحی data-driven | بله | ✅ (۱۲ فایل داده) | هیچ |
| EventBus | ۶ event (DECISIONS #5) | **۲۰+ event** (نقض شده) | کوچک |
| God classes <۵۰۰ خط | AGENT_GUIDE rule 6 | PlayerEntity ۱۰۸۹، GameScene ۱۱۴۶، AreaLoader ۱۳۶۹ — **همه نقض** | بزرگ |
| Dead code حذف شده | GDD rule 6 | GamepadManager.ts، Effects.ts هنوز موجود | کوچک |
| Save system versioning | بله | SaveSystem v3 با migration ✅ | هیچ |

---

## اسناد قدیمی و گمراه‌کننده

این اسناد **فعلاً AI agents را گمراه می‌کنند** و باید به‌روزرسانی یا حذف شوند:

| سند | مشکل | توصیه |
|------|------|--------|
| `docs/ARCHITECTURE.md` | MVP 2.0 با ۲۰ فایل/۳۱۰۰ خط توصیف می‌کند. واقعیت: ۶۰+ فایل/۱۵۰۰۰+ خط | **حذف یا بازنویسی کامل** |
| `PROJECT_AUDIT.md` | ادعا می‌کند توانایی‌ها خراب‌اند، ۳ دشمن می‌جنگند، خطرات نیستند | **علامت‌گذاری «SUPERSEDED»** |
| `GAME_DIRECTOR_REVIEW.md` | نمره ۳.۸/۱۰ بر اساس وضعیت قدیمی | **بازبینی مجدد یا علامت‌گذاری تاریخی** |
| `STATUS.md` | مهارت=۱۹، فایل=~۴۵، خط=~۵۰۰۰ — همه اشتباه | **بازنویسی کامل** |
| `CURRENT_STATE.md` | در «v21 parallax crash fix» متوقف شده | **بازنویسی** |
| `NEXT_TASK.md` | به «Stage 2 bg» اشاره می‌کند | **جایگزینی با اولویت‌های فعلی** |
| `AGENT_GUIDE.md` | اعداد قدیمی (مهارت=۱۹، areas=۲) | **به‌روزرسانی metrics + file tree** |
| `DECISIONS.md` | تصمیم ۵ (۶ event) و ۱۲ (۳ فایل doc) نقض شده | **به‌روزرسانی** |

---

## بزرگ‌ترین شکاف‌های بین چشم‌انداز و واقعیت

1. **۳ از ۵ اکت خالی** — Acts II, III, V فقط اتاق‌های ۷۶۸۰px با ۱-۲ پلتفرم
2. **۴ از ۶ باس غایب** — Leviathan, Iron Magistrate, Gardener, Architect, Silent Protocol
3. **موسیقی صفر** — AUDIO_BIBLE می‌گوید ۱۰٪ موسیقی، با لحظات خاص
4. **تنها ۱ quest، قابل شروع نیست** — NPCSystem به QuestSystem وصل نیست
5. **حقیقت هرگز فاش نمی‌شود** — WORLD_BIBLE راز مرکزی (انسان‌ها عقب‌نشینی کردند) نیاز به Act V دارد
6. **فقط ۲ NPC در Act I** — WORLD_BIBLE ۶ NPC توصیف می‌کند
7. **سلاح‌ها داستان ندارند** — DESIGN_PILLARS: «هر سلاح داستانی روایت می‌کند» ولی WeaponData فیلد description ندارد
8. **بدون تنش مرگ سولس‌لایک** — respawn فوری، بدون از دست دادن XP

---

## توصیه: کد اول، سپس اسناد

**اسناد چشم‌انداز نباید تغییر کنند — کد باید به آن‌ها برسد.**

**اسناد وضعیت باید به‌روزرسانی شوند — ولی بعد از تغییر کد، نه قبل.**

### اولویت کد:

**P0 (بحرانی):**
1. ساخت Acts II, III, V (پلتفرم + دشمن + collectible + shortcut + lore)
2. افزودن ۳+۱ باس غایب
3. سیستم موسیقی
4. وصل QuestSystem به NPCSystem
5. باس‌های متمایز مکانیکی

**P1 (بالا):**
6. ۳+ quest اضافه
7. ۴+ NPC اضافه
8. weapon lore (descriptionKey + previousOwner)
9. اعمال chassis multipliers در computeStats
10. پیاده‌سازی CompanionSystem
11. پیاده‌سازی ShopSystem
12. اعمال passiveBonus سلاح
13. unlock path برای ۳ paint
14. unlock path برای ۳ سلاح
15. death penalty (Soulslike)
16. refactoring god classes
17. حذف dead code
18. فیکس TECH-DEBT باقی‌مانده

### اولویت اسناد:

**بعد از P0 کد:**
- به‌روزرسانی ۸ سند قدیمی
- یا حذف اسناد تکراری (STATUS, CURRENT_STATE, NEXT_TASK → یک سند واحد)

---

## نتیجه‌ی نهایی

**مهم‌ترین تصمیم:** آیا (الف) ساخت Acts II/III/V + ۳ باس برای تحقق WORLD_BIBLE، یا (ب) کاهش چشم‌انداز به ۲-۳ اکت. وضعیت فعلی — ۵ اکت در کد با ۳ تا خالی — بدترین حالت است: دامنه‌ای را implies می‌کند که کد نمی‌تواند تحویل دهد.
