# MECHA: LAST PROTOCOL
## Audio Bible v1.0

> **Silence is part of the soundtrack.**
> **40% Ambient | 30% Drone | 20% Silence | 10% Music**

---

## فلسفه

صدای MECHA نباید "موسیقی بازی" باشد. باید "صدای جهان" باشد.
بازیکن نباید موسیقی را بشنود — باید محیط را بشنود.

---

## Region Audio Profiles

| Region | Ambient | Combat | Boss | Silence |
|--------|---------|--------|------|---------|
| **Fallen Foundry** | فلز، بخار، ترانس صنعتی، تق‌تق | Percussion سنگین، ضربات فلزی | Choir + Drone، کرال تاریک | بعد از مرگ باس |
| **Drowned Wastes** | باد، آب، صدای موجودات دوردست | Drum کند، غوطه‌ور | Bass سنگین، لرزش | مه، سکوت مطلق |
| **Last City** | آژیر، ضربان، انفجار دوردست | Industrial، متالیک | نظامی، درام‌های جنگی | سنگر، تنفس |
| **Silent Canopy** | برگ، باد، پرندگان غریب | Strings، ارگ | Choir، طبیعی | بیشترین سکوت |
| **Orbital Descent** | نویز دیجیتال، هوم الکترونیکی | Industrial، سینث | Synthetic Choir، سرد | سکوت فضایی |
| **Last Protocol** | یک نت. فقط یک نت. | سکوت رهایی | کرال نهایی | سکوت مطلق |

---

## Sound Categories

| Category | Volume | Description |
|----------|--------|-------------|
| **Music** | ۰.۴ | فقط لحظات خاص: ورود باس، کشف لور، پایان Act |
| **Ambient** | ۰.۵ | صدای محیطی مداوم (دrone صنعتی، باد، آب) |
| **Combat** | ۰.۸ | ضربه، انفجار، مرگ، dash، jump |
| **Weapons** | ۰.۸ | شلیک، ضربه نزدیک، تعویض سلاح |
| **UI** | ۰.۶ | کلیک، hover، level up، skill unlock |
| **NPC** | ۰.۷ | دیالوگ (آینده) |
| **Environment** | ۰.۴ | باد، فلز، چکه آب (آینده) |
| **Voice** | ۰.۹ | صدای NPCها (آینده) |

---

## Vertical Slice — Sound List

### محیط (Ambient/Environment)
| ID | Type | Description |
|----|------|-------------|
| `ambient.factory` | Drone | هوم صنعتی ۵۵Hz + ۸۲Hz |
| `ambient.boss` | Drone | Bass ۴۰Hz + dissonant ۵۸Hz + eerie ۸۷Hz |
| `env.metal_creak` | SFX | صدای فلز که در باد ناله می‌کند |
| `env.steam_hiss` | SFX | بخار از لوله فرسوده |
| `env.water_drip` | SFX | چکه آب در سکوت |

### بازیکن (Combat/Weapons)
| ID | Type | Description |
|----|------|-------------|
| `player.jump` | SFX | Thruster burst (sweep 200→500Hz) |
| `player.double_jump` | SFX | Thruster قوی‌تر (sweep 400→800Hz) |
| `player.dash` | SFX | Whoosh (sweep 200→600Hz sine) |
| `player.hit` | SFX | ضربه接收 (noise burst) |
| `player.death` | SFX | مرگ (sweep 400→50Hz sawtooth) |
| `weapon.fire` | SFX | شلیک (square 800Hz) |
| `weapon.melee` | SFX | ضربه نزدیک (sweep 300→80Hz sawtooth) |
| `weapon.switch` | SFX | تعویض (square 500Hz) |

### دشمن (Combat)
| ID | Type | Description |
|----|------|-------------|
| `enemy.hit` | SFX | ضربه دشمن (square 400Hz) |
| `enemy.death` | SFX | مرگ دشمن (explosion noise) |
| `boss.hit` | SFX | ضربه باس (square 200Hz) |
| `boss.death` | SFX | مرگ باس (sweep 200→50Hz) |
| `boss.phase` | SFX | تغییر فاز (sweep 100→300Hz) |

### رابط کاربری (UI)
| ID | Type | Description |
|----|------|-------------|
| `ui.click` | SFX | کلیک (square 600Hz) |
| `ui.hover` | SFX | Hover (square 400Hz) |
| `ui.checkpoint` | SFX | چک‌پوینت (sine 800+1200Hz) |
| `ui.levelup` | SFX | سطح بالا (sine C-E-G) |
| `ui.skill_unlock` | SFX | باز کردن مهارت (sine 880+1320Hz) |
| `ui.victory` | SFX | پیروزی (sine C-E-G arpeggio) |

---

## قانون طلایی صدا

> **هیچ صدایی نباید بدون دلیل پخش شود.**
> هر صدا باید:
> 1. اطلاعات بدهد (کجا، چه چیزی، چقدر خطرناک)
> 2. احساس ایجاد کند (تنش، آرامش، غم)
> 3. با محیط همخوان باشد (فلز در کارخانه، آب در باتلاق)

---

## سکوت

سکوت مهم‌ترین ابزار صوتی است.

| لحظه | صدا |
|--------|-----|
| قبل از اولین دشمن | فقط ambient + چکه آب |
| قبل از ورود باس | سکوت مطلق (۲ ثانیه) |
| بعد از مرگ باس | سکوت مطلق (۳ ثانیه) |
| بین combat encounters | برگشت به ambient |
| هنگام خواندن لور | mute ambient، فقط متن |

---

## آینده (post-Vertical Slice)

- Phaser Loader برای فایل‌های OGG/MP3
- Spatial audio (PannerNode)
- Adaptive music layers (intensity per combat state)
- Audio analyser برای visualization
- Voice acting برای NPCها
