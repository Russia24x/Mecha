# MECHA: LAST PROTOCOL
## Vertical Slice Manifest v1.0

> **From this moment: Freeze the architecture. Freeze the documentation.**
> **Every task must directly improve the first playable hour of the game.**
> **No new systems unless they are required for this vertical slice.**

---

## قانون 80/20

- **۲۰٪ زمان = طراحی و مستندسازی** (تمام شد — پنج سند بنیادین موجود است)
- **۸۰٪ زمان = ساخت تجربه‌ی قابل بازی** (از الان شروع می‌شود)

---

## Vertical Slice Goal

بازیکن در Act I شروع می‌کند. ۴۵-۶۰ دقیقه بازی می‌کند. و در پایان:

```
Player starts in Act I.
↓
Learns movement.
↓
Finds first hidden path.
↓
Finds first lore object.
↓
Meets first NPC.
↓
Unlocks first ability.
↓
Upgrades first weapon.
↓
Defeats first boss.
↓
Leaves Act I.
```

**هر چیزی که می‌سازیم باید در خدمت این یک ساعت باشد.**

---

## Pacing — ریتم Act I

```
0:00  بیداری (سکوت، تاریکی)
0:05  اولین حرکت (exploration)
0:07  اولین دشمن (combat)
0:09  سکوت (breathing room)
0:10  اولین Lore Object (discovery)
0:12  مبارزه دوم (combat)
0:15  مسیر مخفی (exploration + reward)
0:18  Checkpoint (relief)
0:20  NPC: Engineer Kara (dialogue)
0:25  Mini Boss (combat climax)
0:28  ارتقای سلاح (progression)
0:32  Unlock: Double Jump (ability)
0:35  Backtrack → مسیر مخفی جدید (metroidvania)
0:38  Lore Object مهم (truth fragment)
0:42  Boss Arena (tension)
0:45  GUARDIAN AX-09 (boss fight)
0:50  مرگ باس (sorrow, not triumph)
0:52  Lore نهایی Act I
0:55  خروج از Act I
```

**قانون:** هیچ ۳۰ ثانیه‌ای بدون یکی از این‌ها نباشد:
Discovery · Combat · Reward · Question

---

## World Density — حداقل هر Region

| مورد | حداقل Act I |
|------|------------:|
| Landmark (ساختار بصری منحصر) | ۳ |
| Hidden Area (مسیر مخفی) | ۲ |
| Lore Objects (Terminal/Corpse/Echo) | ۸ |
| NPC | ۱ |
| Mini Boss | ۱ |
| Main Boss | ۱ |
| Secret Reward (item/upgrade/lore) | ۳ |
| Environmental Stories (نشانه بصری داستانی) | ۱۰ |

---

## Rule of Three

هر بار که یک Region می‌سازیم، **همزمان** باید:

```
Gameplay (مبارزه/پلتفرمینگ/کاوش)
+
Lore (داستان محیطی/آیتم/NPC)
+
Visual Identity (landmark/رنگ/صدا)
```

نه اول مرحله، بعد لور. **همه با هم.**

---

## Vertical Slice — Task List

این وظایف به ترتیب وابستگی مرتب شده‌اند. هر task مستقیماً به vertical slice کمک می‌کند.

### فاز ۱: قابلیت‌های شکسته (۲۰ ساعت)
۱. Double Jump — باید واقعاً کار کند
۲. Wall Jump — باید مسیرهای جدید باز کند
۳. Dash i-frames — باید درست حس شود

### فاز ۲: دشمنان (۱۲ ساعت)
۴. Sniper — شلیک کند، بازیکن مجبور به پناه
۵. Flying AI — حمله غواصی
۶. Enemy telegraph تقویت — رنگ + شکل + صدا

### فاز ۳: Lore Objects (۸ ساعت)
۷. Terminal — پیام متنی قدیمی
۸. Corpse — لاشه مکا با حکاکی
۹. Echo — صدای ضبط‌شده
۱۰. ۸ Lore Object در Act I

### فاز ۴: محیط (۱۲ ساعت)
۱۱. Hazards (spike traps)
۱۲. ۳ Landmark در Act I
۱۳. ۲ Hidden Area در Act I
۱۴. ۱۰ Environmental Story در Act I

### فاز ۵: Mini Boss (۴ ساعت)
۱۵. Mini Boss برای Act I (قبل از boss اصلی)

### فاز ۶: صدا (۶ ساعت)
۱۶. Ambient soundscape Act I (تق‌تق، بخار، فلز)
۱۷. موسیقی ورود باس
۱۸. موسیقی مرگ باس

### فاز ۷: باس (۴ ساعت)
۱۹. رفع boss beam bug
۲۰. Boss fight = بازتاب ایده "Duty without purpose"

### فاز ۸: پولیش (۴ ساعت)
۲۱. Pacing تست — ۴۵-۶۰ دقیقه
۲۲. World Density تست

**مجموع: ~۷۰ ساعت**

---

## تعریف "تمام" برای Vertical Slice

Vertical Slice زمانی تمام است که:

- [ ] بازیکن ۴۵-۶۰ دقیقه بدون crash بازی کند
- [ ] بازیکن Double Jump را unlock کند و با آن مسیر مخفی پیدا کند
- [ ] بازیکن حداقل ۵ Lore Object کشف کند
- [ ] بازیکن با Kara صحبت کند
- [ ] بازیکن سلاح را ارتقا دهد
- [ ] بازیکن Mini Boss را شکست دهد
- [ ] بازیکن Guardian AX-09 را شکست دهد و احساس غم کند (نه پیروزی)
- [ ] بازیکن از Act I خارج شود
- [ ] هیچ ۳۰ ثانیه سکوت خالی نباشد
- [ ] World Density به حداقل برسد

---

## شعار نهایی

> **Every step reveals a forgotten truth. Every battle asks a forgotten question.**

> **The world is not waiting to be saved. It is waiting to be understood.**

> **Nothing exists only because it looks cool. Everything must exist because the world needs it.**

---

## قانون مطلق از این لحظه

> **دیگر سند نوشته نمی‌شود.**
> **دیگر سیستم جدید ساخته نمی‌شود.**
> **فقط تجربه‌ی قابل بازی.**
> **فقط اولین ساعت.**
