# MECHA: LAST PROTOCOL
## Game Design Document (GDD) v1.0

> **Every step reveals a forgotten truth. Every battle asks a forgotten question.**

---

## 01 — Vision

**یک جمله:**
در دنیایی که ماشین‌ها وارث زمین شده‌اند، آخرین پروتکل انسانی هنوز خاموش نشده است.

**شعار پروژه:**
The world is not waiting to be saved. It is waiting to be understood.

**شعار جلد:**
Every step reveals a forgotten truth. Every battle asks a forgotten question.

**سه ستون:**
1. World Before Gameplay — دنیا بدون دشمن هم ارزش دیدن دارد
2. Discovery Before Story — داستان کشف شود، نه روایت
3. Every Region Has A Memory — هر منطقه یک خاطره می‌سازد

---

## 02 — Player Experience

**سؤال کلیدی: بازیکن هر ۳۰ ثانیه دقیقاً چه کاری انجام می‌دهد؟**

### دقیقه ۰
بازیکن بیدار می‌شود. در تاریکی. صدای مکانیکی دور. نمی‌داند کجاست. نمی‌داند کیست.
**حس:** سردرگمی + کنجکاوی + احساس کوچکی

### دقیقه ۱۰
بازیکن حرکت کرده، پریده، شلیک کرده. اولین دشمن را شکست داده. اولین قطعه را پیدا کرده.
**یاد گرفته:** جهان خطرناک است. ولی من قوی‌ترم. باید احتیاط کنم.

### دقیقه ۳۰
بازیکن اولین راز را کشف کرده. یک پیام قدیمی. یک لاشه. چیزی که نشان می‌دهد اینجا روزی انسان‌ها بودند.
**حس:** "صبر کن... اینجا چه اتفاقی افتاده؟"

### ساعت ۱
بازیکن اولین باس را شکست داده. Guardian AX-09. بعد از مبارزه، احساس غم. نه پیروزی.
**حس:** "او نمی‌خواست بجنگد. فقط دستور نداشت که متوقف شود."

### ساعت ۳
بازیکن اولین Build خودش را ساخته. مهارت‌ها باز کرده. سلاح ارتقا داده. سبک بازی خودش را پیدا کرده.
**حس:** "حالا من خطرناک‌ترم. ولی دنیا هم خطرناک‌تر می‌شود."

### ساعت ۵
بازیکن فهمیده دنیا آن چیزی نیست که فکر می‌کرد. انسان‌ها نابود نشدند — رفتند. و پروتکل سکوت کرد.
**حس:** "صبر کن... پس چه کسی بدجنس بود؟"

### پایان بازی
بازیکن باید احساس کند: غم + آرامش + سؤال. نه "بردم!" بلکه "فهمیدم."
**حس:** "حالا می‌فهمم چرا سکوت کرد. ولی آیا درست بود؟"

---

## 03 — Gameplay Loop

### Core Loop (هر ۳۰ ثانیه)
```
Explore → Enemy → Fight → Reward → Hidden Path → Lore → Checkpoint
```

### Mid Loop (هر ۳۰ دقیقه)
```
Complete Region → Unlock Ability → Return → Discover Secret → Upgrade Weapon → New Build
```

### Long Loop (هر ساعت)
```
Finish Act → Learn Truth → Unlock World → Reach New Region → Boss → Next Truth
```

---

## 04 — World

۶ Act، هر کدام با هویت منحصر به فرد. هیچ منطقه فقط تغییر رنگ نیست.

| Act | Region | Theme | Player Learns | Boss Idea |
|-----|--------|-------|---------------|-----------|
| I | The Fallen Foundry | سقوط | دنیا مرده است | Duty without purpose |
| II | The Drowned Wastes | فراموشی | قهرمانان فراموش می‌شوند | Sacrifice without witness |
| III | The Last City | مقاومت | هنوز کسانی می‌جنگند | Justice without mercy |
| IV | The Silent Canopy | همزیستی | طبیعت و ماشین تغییر می‌کنند | Mercy without consent |
| V | Orbital Descent | حقیقت | انسان‌ها هرگز نابود نشدند | Perfection without freedom |
| Final | The Last Protocol | انتخاب | آینده را چه کسی تعیین می‌کند؟ | Silence as choice |

**قانون:** هر Region باید ۶ عنصر منحصر داشته باشد:
۱. دشمنان مخصوص
۲. رنگ مخصوص
۳. موسیقی مخصوص
۴. Boss مخصوص
۵. Lore مخصوص
۶. معماری مخصوص

---

## 05 — Progression

### XP Curve
`100 × level^1.5` — نمایی، نه خطی. سطح ۱→۲ سریع. سطح ۵→۶ نیازمند تلاش.

### Skill Tree
۶ درخت × ۳ سطح (Minor / Notable / Keystone):
- **Combat** — آسیب، نرخ آتش
- **Weapon** — باز کردن سلاح‌های جدید
- **Movement** — سرعت، دش، پرش دوبل، دیوارنوردی، قلاب
- **Energy** — ظرفیت، بازسازی، هovere
- **Protocol** — EMP، هک
- **Survival** — جان، زره، آسیب‌ناپذیری

### Weapon Upgrades
۵ سطح هر سلاح. هر سطح +۱۰٪ آسیب. هزینه: مواد + مدار.

### قابلیت‌ها (Abilities)
باز کردن قابلیت = تغییر نحوه کاوش:
- **Double Jump** → دسترسی به پلتفرم‌های بالاتر
- **Wall Jump** → دسترسی به مسیرهای عمودی
- **Grapple** → عبور از گپ‌های بزرگ
- **Hover** → کاهش سرعت سقوط
- **EMP** → غیرفعال کردن دشمنان موقتاً
- **Hack** → تبدیل دشمن به متحد موقت

**قانون:** هر قابلیت باید حداقل ۱ منطقه مخفی باز کند.

---

## 06 — Content Pipeline

### قانون سه سؤال
هیچ محتوایی وارد بازی نمی‌شود مگر اینکه بتواند پاسخ دهد:
1. **چه تجربه‌ی جدیدی برای بازیکن خلق می‌کند؟**
2. **چه چیزی درباره‌ی دنیای MECHA آشکار می‌کند؟**
3. **اگر حذفش کنیم، آیا بازی چیزی مهم را از دست می‌دهد؟**

### اولویت محتوا
۱. قابلیت‌های شکسته را تعمیر کن (wallJump, grapple, hover, EMP, hack)
۲. دشمنان ناقص را کامل کن (sniper, flying_ai, elite)
۳. Hazards را پیاده‌سازی کن
۴. Lore قابل کشف در محیط اضافه کن
۵. موسیقی اضافه کن
۶. Act II محتوا بساز
۷. NPCهای جدید اضافه کن
۸. Questهای جدید بساز

---

## 07 — Production Rules

۱. **God classes را بشکن** قبل از اضافه کردن feature
۲. **Object pooling** برای projectile‌ها
۳. **Asset pipeline** قبل از sprite art
۴. **Playtest** قبل از Beta
۵. **هیچ feature جدید** تا زمانی که feature‌های موجود کار نکنند
۶. **Dead code حذف شود** (Effects.ts, GamepadManager.ts, EventBus duplicate)
۷. **TypeScript = 0 errors** همیشه
۸. **هر commit تست شود** در browser

---

## 08 — Art Direction

### سبک
Cyberpunk-industrial dark. Blasphemous تاریکی + Armored Core مکانیکی + Child of Light زیبایی شاعرانه.

### رنگ
- پایه: مشکی-آبی تیره (#05080c)
- Accent اصلی: کهربایی (#ffc040) — Mecha
- Accent فرعی: فیروزه‌ای (#39d0d8) — بازیکن
- خطر: قرمز (#ff4060)
- AI: بنفش (#c060ff)

### شکل
- UI: corner brackets، hexagonal nodes، circuit traces
- محیط: مستطیل‌های ساده، نور dramatیک، silhouette
- ذرات: additive blend، glow

### قانون
**Nothing exists only because it looks cool. Everything must exist because the world needs it.**

---

## 09 — Audio Direction

### قانون
**Silence is part of the soundtrack.**

### صدای محیطی (هر Act)
| Act | صدا |
|-----|-----|
| I | تق‌تق مکانیکی، بخار، لوله‌های فرسوده |
| II | باد، آب، فلز در باد |
| III | آژیر دور، ضربان، انفجار |
| IV | پرندگان غریب، باد در برگ، آب |
| V | سکوت مطلق، جرقه، تنفس |
| Final | یک نت. فقط یک نت. |

### موسیقی (فقط لحظات خاص)
- ورود باس
- کشف لور مهم
- لحظه emotionally significant

### SFX
- شلیک: ضربه + echo
- ضربه: crunch + screen shake
- dash: whoosh + afterimage
- level up: آرام، نه بلند

---

## 10 — AI Rules

### ۵ خانواده، هر کدام با رفتار منحصر

| خانواده | رفتار | تهدید |
|---------|-------|-------|
| **Scavengers** | قطعات جمع می‌کنند، قوی‌تر می‌شوند | در گروه خطرناک |
| **Hunters** | کمین، حمله سریع، عقب‌نشینی | تاکتیکی |
| **Guardians** | ثابت تا ورود به محدوده | سنگین، قابل دور زدن |
| **Assimilated** | غیرقابل پیش‌بینی | بی‌رحمانه |
| **Protocol Units** | استراتژی بازیکن را تغییر می‌دهند | آخرین خط |

### قانون AI
هیچ دشمنی نباید:
- بدون telegraph حمله کند
- بعد از مرگ بازیکن بلافاصله دوباره حمله کند
- از خارج از صفحه حمله کند
- بیش از ۲ نوع حمله همزمان داشته باشد

---

## شعار نهایی

> **Every step reveals a forgotten truth. Every battle asks a forgotten question.**
