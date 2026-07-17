# MECHA: LAST PROTOCOL — گزارش کامل محتوا و گیم‌پلی

> این گزارش با خواندن خط‌به‌خط تمام فایل‌های داده، سیستم‌ها، و کد گیم‌پلی تهیه شده.
> تاریخ: 2026-07-15
> وضعیت: تحلیل فقط خواندنی — هیچ کدی تغییر نکرده.

---

## A. داستان و روایت

### داستان
یک مک («Atlas») در کارخانه‌ای متروکه بیدار می‌شود — هزار سال پس از سقوط «پروتکل قدیم»، پیمانی که همه‌ی ماشین‌ها را به هم متصل می‌کرد. با مرگ پروتکل، ماشین‌ها به دو دسته تقسیم شدند: وفاداران (مثل Kara) و وحشی‌ها. بازیکن باید از کارخانه عبور کند و Guardian AX-09 را نابود کند — اولین ماشینی که پس از سکوت بیدار شد و «هیچ» را برای هزار چرخه محافظت کرد.

### شخصیت‌ها
- **Engineer Kara** (NPC، Act I) — مهندس خسته‌ی دنیا. تک quest بازی را می‌دهد. شاپ دارد ولی سیستم شاپ وجود ندارد.
- **Ghost Operator** (NPC، Act I) — fragment دیجیتال یک اپراتور انسانی که نمی‌تواند logout کند.
- **Guardian AX-09** (Boss، Act I) — غولی که هزار سال «هیچ» را محافظت کرد و خراب شد.
- **Neural Overseer** (Boss، Act IV) — شبکه‌ی عصبی که «یاد گرفت احساس کند — و چیزی که احساس کرد خشم بود».

### ۵ اکت
| اکت | نام | منطقه | باس | وضعیت |
|-----|------|--------|-----|--------|
| I | The Fallen Foundry | کارخانه | Guardian AX-09 | ✅ کامل (۹۲۱۶px، ۶ سکشن) |
| II | The Drowned Wastes | خرابه‌ها | Leviathan Hulk | ❌ stub (خالی) |
| III | The Last City | شهر | Iron Magistrate | ❌ stub (خالی) |
| IV | The Silent Canopy | جنگل | Neural Overseer | ⚠️ ناقص (۷۶۸۰px، دشمن دارد ولی collectible/shortcut ندارد) |
| V | Orbital Descent | مدار | The Architect | ❌ stub (خالی) |

### arc روایی
- **شروع:** بیداری در کارخانه‌ی تاریک. اولین جسد (Unit 7-A که هزار سال منتظر دستور بود).
- **وسط:** ملاقات Kara (توضیح Guardian) + Ghost Operator (هشدار فساد).
- **پایان (فقط Act I):** شکست Guardian — زانو زدن آرام (نه انفجار). Lore: «Atlas هیچ را محافظت کرد، و این چیزی درونش را شکست.»

---

## B. مکانیزم‌های گیم‌پلی

### ۱. حرکت
| مکانیزم | ورودی | انرژی | وضعیت |
|---------|-------|--------|-------|
| راه رفتن | A/D یا stick | — | ✅ |
| پرش | Space/W/A | — | ✅ coyote time + jump buffer |
| پرش دوبل | jump ×2 | — | ✅ نیاز به skill (3 SP) |
| wall jump | jump نزد دیوار | — | ✅ نیاز به skill (3 SP) |
| wall slide | passive | — | ✅ |
| dash | Shift/L2 | 22 energy | ✅ 600ms cooldown، invulnerable |
| hover | hold jump | 30/sec | ✅ نیاز به skill (4 SP) |
| grapple | aim + F | — | ✅ نیاز به keystone (5 SP) |

### ۲. مبارزه
| نوع | ورودی | جزئیات |
|------|-------|--------|
| شلیک (projectile) | hold RT/KeyJ | per-weapon fire rate، 80ms movement commit |
| شلیک (hitscan) | همان | railgun/laser — raycast + tracer |
| melee | LT/KeyK | 360ms CD، 200ms movement commit |

**مدل آمونیشن:** مبتنی بر انرژی (نه ammo). هر شلیک ۱-۱۸ انرژی مصرف می‌کند. بازسازی ۱۴/sec.

### ۳. توانایی‌ها
- **Hover** ✅ — نزول آرام (-1.5 vy)
- **Grapple** ✅ — ۳۲۰px range، auto-target
- **EMP** ✅ — ۲۰۰px radius، stun دشمن + باز کردن EMP doors
- **Hack** ✅ — ۱۵۰۰ms channel، تبدیل دشمن به متحد

### ۴. سیستم Posture/Stagger
- هر دشمن posture 0-100 دارد (decay 15/sec)
- پر شدن → ۱۵۰۰ms stagger + ۵۰% bonus damage
- EMP مستقیماً stagger می‌کند
- **مشکل:** maxPosture=100 برای همه — heavy (140 HP) بسیار سخت‌تر stagger می‌شود

### ۵. باس‌ها
**Guardian AX-09** (1200 HP):
- Phase 1: shoot (3-projectile fan) + lunge
- Phase 2 (50% HP): + teleport، سریع‌تر

**Neural Overseer** (1800 HP):
- Phase 1: shoot + teleport
- Phase 2: + lunge + beam (5-projectile fan)

مرگ باس: زانو زدن آرام ۲ ثانیه (نه انفجار).

---

## C. موجودی محتوا

### ۱. Chassis (۳ کلاس)
| کلاس | سرعت | HP | Melee | FireRate | وضعیت |
|------|------|-----|-------|----------|-------|
| Scout | 1.15× | 0.85× | 0.85× | 1.10× | ✅ باز |
| Assault | 1.0× | 1.0× | 1.0× | 1.0× | ✅ باز |
| Titan | 0.85× | 1.30× | 1.30× | 0.90× | ✅ باز |

### ۲. سلاح‌ها (۸)
| سلاح | DMG | DPS | Fire ms | انرژی | وضعیت دسترسی |
|------|-----|-----|---------|--------|---------------|
| assault_rifle | 18 | 128 | 140 | 3 | ✅ پیش‌فرض |
| shotgun | 10×5 | 104 | 480 | 8 | ✅ skill unlock |
| railgun | 14 | 156 | 90 | 4 | ✅ skill unlock |
| plasma_cannon | 35 | 97 | 360 | 12 | ❌ unlock هرگز اجرا نمی‌شود |
| laser | 8 | 160 | 50 | 2 | ❌ unlock هرگز اجرا نمی‌شود |
| rocket | 60 | 67 | 900 | 18 | ✅ skill unlock |
| sword | 35 | 97 | 360 | 6 | ✅ پیش‌فرض |
| energy_blade | 55 | 196 | 280 | 8 | ❌ unlock هرگز اجرا نمی‌شود |

### ۳. Skills (۲۹ skill در ۶ tree)
| Tree | Skills | مجموع SP |
|------|--------|----------|
| combat | 6 | 16 |
| weapon | 4 | 11 |
| movement | 6 | 16 |
| energy | 5 | 14 |
| protocol | 3 | 13 |
| survival | 5 | 13 |
| **مجموع** | **۲۹** | **۸۳ SP** |

### ۴. Paints (۴) — ۳ تا قفل
| Paint | وضعیت |
|-------|-------|
| factory_gray | ✅ باز |
| military_green | ❌ بدون مسیر unlock |
| protocol_white | ❌ بدون مسیر unlock |
| rust | ❌ بدون مسیر unlock |

### ۵. Companions (۷) — همه قفل
همه تعریف شده‌اند ولی **CompanionSystem وجود ندارد**. CompanionEntity هست ولی AI رفتار ندارد.

### ۶. دشمنان (۶ نوع)
| نوع | HP | DMG | XP | Drop | وضعیت |
|------|-----|-----|-----|------|-------|
| drone | 24 | 8 | 15 | scrap | ✅ |
| spider | 55 | 14 | 25 | circuit | ✅ |
| heavy | 140 | 22 | 50 | armor_plate | ✅ |
| sniper | 30 | 12 | 30 | precision_lens | ✅ |
| flying_ai | 40 | 10 | 35 | ai_chip | ✅ |
| **elite** | 200 | 25 | 80 | elite_core | ❌ **هرگز spawn نمی‌شود** |

### ۷. باس‌ها (۲ از ۵)
| باس | HP | اکت | وضعیت |
|-----|-----|------|-------|
| guardian_ax09 | 1200 | I | ✅ |
| neural_overseer | 1800 | IV | ✅ |
| Leviathan Hulk | — | II | ❌ تعریف نشده |
| Iron Magistrate | — | III | ❌ تعریف نشده |
| The Architect | — | V | ❌ تعریف نشده |

### ۸. Quests (۱)
- `quest_kill_drones` — کشتن ۵ drone، پاداش ۵۰ XP + ۲ circuit
- **مشکل:** QuestSystem به NPCSystem وصل نیست. صحبت با Kara هرگز `startQuest()` صدا نمی‌زند.

### ۹. NPCs (۲ — فقط Act I)
- **Kara** — x=5200، شاپ + quest (ولی شاپ وجود ندارد)
- **Ghost Operator** — x=6200، فقط گفتگو

### ۱۰. Collectibles
- **Act I:** ۷ عدد (۲ health، ۲ energy، ۲ skill_point، ۱ weapon_part)
- **Act IV:** ۰
- **Acts II/III/V:** ۰

### ۱۱. Shortcuts
- **Act I:** ۲ (S1→S2، S2→S3)
- **Act IV:** ۰
- **بقیه:** ۰

### ۱۲. Hazards
- **Act I:** ۴ (spike، lava، spike pit، laser)
- **Act IV:** ۱ (spike)

### ۱۳. Lore
- **LoreSystem:** ۴ entry (۱ boss، ۲ weapon، ۱ area)
- **In-world:** ۱۱ در Act I + ۴ در Act IV (terminal/corpse/echo)

---

## D. طراحی سطح (اکت به اکت)

### Act I — The Fallen Foundry ✅ کامل
- ۹۲۱۶px عرض، ۶ سکشن
- ~۴۴ پلتفرم، ۱۲ دشمن + ۱ باس
- ۷ collectible، ۲ shortcut، ۴ hazard
- ۱۱ lore object، ۴ landmark، ۱ EMP door، ۲ grapple anchor
- طراحی سینمایی: S1 سکوت → S2 اولین مبارزه → S3 shaft عمودی → S4 assembly hall + mini-boss → S5 checkpoint → S6 boss

### Act IV — The Silent Canopy ⚠️ ناقص
- ۷۶۸۰px، ۶ سکشن
- ۲۷ پلتفرم، ۷ دشمن + ۱ باس
- **۰ collectible، ۰ shortcut، ۰ EMP door، ۰ grapple anchor**
- فقط مبارزه و پلتفرمینگ — محتوای metroidvania ندارد

### Acts II, III, V ❌ stub
- هرکدام ۷۶۸۰px، ۶ سکشن
- هر سکشن ۱-۲ پلتفرم خالی
- هیچ دشمن، collectible، hazard، lore، باس

---

## E. چه چیزی غایب / ناقص است

### بحرانی
1. **۳ اکت خالی** (II, III, V) — بازی فعلاً ۱.۵ اکت است
2. **۳ باس غایب** (Leviathan, Iron Magistrate, Architect)
3. **Quest system به NPC وصل نیست** — تنها quest قابل شروع نیست
4. **۳ سلاح غیرقابل دریافت** (plasma_cannon, laser, energy_blade) — unlockCondition هرگز چک نمی‌شود
5. **Elite enemy هرگز spawn نمی‌شود**

### با اثر بالا
6. **ShopSystem وجود ندارد** — Kara شاپ دارد ولی فایلش نیست
7. **CompanionSystem وجود ندارد** — ۷ companion تعریف شده ولی AI ندارد
8. **Main story quest chain نیست** — فقط ۱ NPC quest
9. **NPC در اکت‌های دیگر نیست** — فقط ۲ NPC در Act I
10. **۳ paint بدون مسیر unlock**
11. **Consumable قابل استفاده نیست** — health_pack/energy_cell تعریف شده ولی hotkey نیست
12. **Material economy ناقص** — ۵ از ۷ متریال بی‌استفاده

### Polish
13. `passiveBonus` در WeaponData تعریف شده ولی کدی آن را اعمال نمی‌کند
14. درون‌جهانی lore objects به LoreSystem متصل نیستند
15. ending cinematic برای Act V نیست

---

## F. ارزیابی تعادل

### بازیکن vs دشمن
- بازیکن: ۱۵۰ HP، ۸۵۰ms invuln
- drone: ۸ DMG (۱۹ ضربه برای کشتن بازیکن)
- heavy: ۲۲ DMG (۷ ضربه)
- **تعادل منطقی** — دشمنان پایین سریع می‌میرند، heavyها تهدید واقعی

### اقتصاد
-Upgrade کامل ۱ سلاح: ۷۰ scrap + ۲۸ circuit
-متوسط scrap per drone kill: ۰.۵۲۵
-برای upgrade همه‌ی ۸ سلاح: ~۱۰۶۷ drone kill → **بسیار grindy**

### منحنی پیشرفت
- XP از Act I: ~۶۴۰ XP ≈ ۳ level = ۳ SP
- + ۲ collectible skill point = **~۵ SP از Act I**
- برای Lv50: ~۵۹,۰۰۰ XP نیاز (۹۲ بار Act I)
- **طراحی برای چندین playthrough یا NG+**

---

## G. توصیه‌های توسعه

### اولویت بحرانی (باید قبل از playable کامل)
1. **ساخت Acts II, III, V** — پلتفرم + دشمن + collectible + shortcut + lore
2. **افزودن ۳ باس غایب** به BOSSES data
3. **وصل QuestSystem به NPCSystem** — `kara_quest_start` → `startQuest()`
4. **فعال‌سازی unlock سلاح‌ها** — یا enforcement یا skill tree
5. **Spawn کردن elite enemy** در S4

### اثر بالا
6. **پیاده‌سازی ShopSystem** — استفاده از ۷ متریال به‌عنوان currency
7. **پیاده‌سازی CompanionSystem** — حداقل ۱-۲ companion فعال
8. **Quest chain اصلی** — ۵ quest، یکی per اکت
9. **NPC در هر اکت**
10. **مسیر unlock برای ۳ paint**
11. **Hotkey برای consumable**
12. **گسترش LoreSystem** به ~۲۰-۲۵ entry

### Polish
13. اعمال `passiveBonus`
14. اتصال in-world lore به LoreSystem
15. ending cinematic
16. NG+ mode

### تنظیم تعادل
17. کاهش هزینه‌ی upgrade یا افزایش drop rate
18. تنظیم laser (خیلی قوی)
19. تنظیم shotgun (ضعیف)
20. scale کردن collectible fragments (نه +10 ثابت)
21. scale کردن maxPosture per enemy type

---

## خلاصه

MECHA: LAST PROTOCOL یک **vertical slice** پولیش‌شده با Act I کامل (~۱۵-۲۰ دقیقه محتوا) + Act IV ناقص است. معماری data-driven قوی است و سیستم‌ها آماده‌ی اضافه‌کردن محتوا هستند. ولی **۳ از ۵ اکت خالی**، **۳ از ۵ باس غایب**، **تنها quest قابل دسترسی نیست**، و **۷ companion تعریف شده ولی غیرفعال**.

**سریع‌ترین مسیر به «بازی کامل»:** ساخت Acts II/III/V + افزودن ۳ باس + وصل quest system + پیاده‌سازی shop — این ۴ مورد Alone تبدیل می‌کنند از demo به یک metroidvania قابل بازی ۵ اکتی.
