# Stage 2.0 — Enemy Sleep-Culling Design Document

> **تاریخ:** 2026-07-24
> **وضعیت:** پیش‌نویس برای مشاور
> **هدف:** کاهش CPU consumption دشمنان دور از viewport با sleep-culling واقعی

---

## ۱) تحلیل وضعیت فعلی

### مشکل
- 25+ دشمن فعال همزمان در Act II Wastes (وقتی بازیکن به section 8 می‌رسد)
- هر دشمن در هر فریم: physics integration + gravity + AI FSM update + visual update
- دشمنان هرگز sleep نمی‌شوند — هیچ isSleeping/Body.set در EnemyEntity نیست
- دشمنان هرگز despawn نمی‌شوند — فقط هنگام مرگ splice می‌شوند

### بررسی معماری دشمن

| ویژگی | مقدار | منبع |
|------|-------|------|
| Body type | **dynamic** (نه static) | `EnemyEntity.ts:73` — `scene.matter.add.image(...)` بدون `isStatic` |
| Flying enemies | `setIgnoreGravity(true)` | `EnemyEntity.ts:82` — برای mosquito_drone و flying_ai |
| FSM states | `patrol → aggro → attack (telegraph→window→recovery) → stagger` | `EnemyEntity.ts:32` |
| Posture decay | هر فریم اگر `posture > 0` و `time.now > flashUntil` | `EnemyEntity.ts:255-257` |
| Stagger | `staggeredUntil` timestamp — وقتی تمام شود، به `patrol` برمی‌گردد | `EnemyEntity.ts:261-264` |
| Hacked | `hacked` boolean — وقتی true، دشمن دوستانه می‌شود | `EnemyEntity.ts:57` |
| Telegraph visual | دایره‌ی قرمز/نارنجی با tween | `EnemyEntity.ts:305-310` (disabled در Stage 1 FPS test — باید restore شود) |

### بررسی مکانیزم‌های برخورد

| مکانیزم | نوع | تأثیر sleep |
|--------|-----|-------------|
| Player-enemy contact | **Matter `collisionstart` event** | ✅ ایمن — `Detector.js:96`: `bodyAStatic = player.isStatic \|\| player.isSleeping = false` → collision check انجام می‌شود |
| Projectile-enemy hit | **Manual distance check** (`tryHitEntity`) | ✅ ایمن — position-based، به Matter body وابسته نیست |
| Hazard-player contact | Matter collision (sensor) | ✅ ایمن — player بیدار است |
| Section-enter | Matter collision (sensor) | ✅ ایمن — player بیدار است |

**نتیجه:** sleep کردن enemy body تأثیری روی collision detection ندارد. فقط integration + gravity را skip می‌کند.

---

## ۲) طراحی

### ۲.۱ مکانیزم Sleep

```typescript
// In PlayController.update() — enemy loop (lines 353-364)
const cam = r.scene.cameras.main;
const viewLeft = cam.scrollX - ENEMY_CULL_MARGIN;
const viewRight = cam.scrollX + cam.width + ENEMY_CULL_MARGIN;
const Body = r.scene.matter.body;  // cached once

for (let i = r.enemies.length - 1; i >= 0; i--) {
  const e = r.enemies[i];
  if (!e.isAlive || !e.sprite || !e.sprite.active) {
    r.targetRegistry.unregisterEnemy(e);
    r.enemies.splice(i, 1);
    continue;
  }

  // ── Enemy sleep-culling (Stage 2.0) ──
  const ex = e.sprite.x;
  const offscreen = ex < viewLeft || ex > viewRight;
  const matterBody = e.sprite.body as MatterJS.BodyType;

  if (offscreen) {
    // Sleep: skip physics integration + AI update + visual update
    if (matterBody && !matterBody.isSleeping) {
      Body.set(matterBody, 'isSleeping', true);
    }
    continue;  // skip e.update() entirely
  } else {
    // Wake: resume physics + AI + visual
    if (matterBody && matterBody.isSleeping) {
      Body.set(matterBody, 'isSleeping', false);
    }
  }

  try { e.update(deltaMs, playerPos); } catch {
    r.targetRegistry.unregisterEnemy(e);
    r.enemies.splice(i, 1);
    continue;
  }
}
```

### ۲.۲ Margin

```typescript
const ENEMY_CULL_MARGIN = 300;  // Same as VisualCuller.VIEWPORT_MARGIN
```

**چرا 300px (همان VisualCuller):**
- اگر margin متفاوت باشد، ممکن است enemy هنوز *دیده* شود ولی فیزیکش خواب باشد
- با margin یکسان، enemy همزمان visible و awake می‌شود
- VisualCuller با 300px کار می‌کند — هماهنگی ضروری است

### ۲.۳ Wake Trigger

**مکانیزم:** در همان loop که sleep می‌کنیم، wake هم انجام می‌شود. وقتی camera scroll می‌کند و enemy دوباره وارد viewport + margin می‌شود، `Body.set(matterBody, 'isSleeping', false)` صدا زده می‌شود. این symmetric است — همان loop هم sleep هم wake انجام می‌دهد.

### ۲.۴ دامنه‌ی دقیق چیزی که skip می‌شود

وقتی enemy خواب است، **کدام چیزها skip می‌شوند و کدام نه:**

| عملیات | skip می‌شود؟ | چرا |
|--------|-------------|-----|
| **Physics integration** (position/velocity update) | ✅ بله | Matter.js: `if (body.isStatic \|\| body.isSleeping) continue` in `_bodiesUpdate` |
| **Gravity application** | ✅ بله | Matter.js: `if (body.isStatic \|\| body.isSleeping) continue` in `_bodiesApplyGravity` |
| **AI FSM update** (`e.update()`) | ✅ بله | `continue` in enemy loop — کل update skip می‌شود |
| **Posture decay** | ✅ بله | داخل `e.update()` است |
| **Stagger timer** | ✅ بله | داخل `e.update()` است — اما `staggeredUntil` timestamp است، نه counter، پس وقتی بیدار شود درست محاسبه می‌شود |
| **Telegraph visual tween** | ⚠️ conditional | اگر telegraph در حال اجراست و enemy خواب می‌شود، tween همچنان فعال است (PauseManager نتوانست آن را بگیرد). اما چون enemy دور است، player نمی‌بیند — بی‌ضرر |
| **Hacked state** | ❌ نه | `hacked` boolean است، نه timer — حفظ می‌شود |
| **Collision detection** (player-enemy contact) | ❌ نه | `Detector.js:96`: player بیدار است → collision check انجام می‌شود |
| **Projectile hit** | ❌ نه | `tryHitEntity`: position-based، به body.isSleeping وابسته نیست |
| **TargetRegistry membership** | ❌ نه | enemy در registry باقی می‌ماند — projectile‌ها هنوز آن را پیدا می‌کنند |

### ۲.۵ FSM State Preservation

**سؤال:** وقتی enemy خواب است و بعد بیدار می‌شود، آیا FSM درست resume می‌شود؟

**تحلیل کد واقعی (EnemyEntity.ts):**

| متغیر | نوع timing | رفتار هنگام sleep | ایمن؟ |
|------|-----------|-------------------|-------|
| `stateTime` (line 33, 252) | **delta-accumulation** (`stateTime += deltaMs`) | ✅ فریز می‌شود — چون `update()` skip می‌شود، `stateTime` اضافه نمی‌شود | ✅ ایمن |
| `attackPhase` | enum string | حفظ می‌شود | ✅ ایمن |
| `staggeredUntil` (line 141) | **timestamp** (`scene.time.now + duration`) | `scene.time.now` ادامه می‌یابد — وقتی بیدار شود، اگر گذشته باشد، `isStaggered = false` → FSM به patrol/aggro برمی‌گردد | ✅ ایمن |
| `flashUntil` (line 120) | timestamp | ممکن است منقضی شده باشد — فقط visual flash | ✅ بی‌ضرر |
| `lastFireAt` (line 473) | timestamp | ممکن است منقضی شده باشد — فقط rate-limit | ✅ بی‌ضرر |
| `hacked` (line 57) | boolean | حفظ می‌شود | ✅ ایمن |
| `posture` (line 50) | number | هنگام sleep decay نمی‌شود (چون update skip) | ✅ ایمن |

**نکته‌ی کلیدی:** `stateTime` **delta-accumulation** است، نه timestamp.

این یعنی مشاور اشاره کرد به سناریوی "telegraph-skip" — اما **این سناریو غیرممکن است** چون:
1. وقتی enemy خواب است، `update()` skip می‌شود
2. `stateTime` فریز می‌شود (deltaMs اضافه نمی‌شود)
3. وقتی بیدار شود، `stateTime` از همان مقدار قبلی ادامه می‌دهد
4. telegraph نمی‌تواند skip شود — `stateTime` جلو نرفته

**سناریوی مشاور با تحلیل صحیح:**
1. Player با enemy درگیر → enemy وارد `attack → telegraph` (stateTime=0، شروع accumulation)
2. Player دور می‌شود → enemy خواب می‌رود → `update()` skip → **stateTime فریز روی (مثلاً 200ms)**
3. Player برمی‌گردد → enemy بیدار می‌شود → **stateTime از 200ms ادامه می‌دهد**
4. telegraph از همان نقطه ادامه می‌یابد — player telegraph را می‌بیند ✅

**forceResetToBaseline() — YAGNI:**
مشاور پیشنهاد داد `forceResetToBaseline()` اضافه شود. اما چون `stateTime` delta-accumulation است، این متد **لازم نیست**:
- مشکل telegraph-skip وجود ندارد
- اضافه‌کردن = کد مرده
- اگر در آینده FSM به timestamp-based تغییر کند، آن زمان اضافه می‌کنیم

**مشکل واقعی (minor):** `telegraphGfx` leak هنگام sleep:
- اگر enemy در حال `telegraph` خواب برود، `telegraphGfx` (دایره‌ی قرمز) ایجاد شده اما destroy نمی‌شود
- چون `update()` skip می‌شود، `telegraphGfx` در display list باقی می‌ماند
- اگر enemy دور باشد، player نمی‌بیند — بی‌ضرر
- وقتی enemy بیدار شود و telegraph تمام شود، `telegraphGfx` destroy می‌شود
- **این یک باگ موجود است** (نه جدید) — enemy death هم باعث leak می‌شود

**نتیجه:** FSM state preservation **ایمن** است. `forceResetToBaseline()` لازم نیست (YAGNI).

---

## ۳) تست رفتاری T8

**تعریف:** enemy دور از دوربین می‌خوابد، نزدیک‌شدن player → بیدار می‌شود → FSM state معتبر است، نه گیر کرده در telegraph، نه حمله‌ی بدون‌هشدار.

### روش تست

1. **PerformanceOverlay counter** (راه‌حل جایگزین probe):
   - اضافه‌کردن "ENEMIES: N sleep / M awake" به PerformanceOverlay
   - کاربر می‌تواند با چشم ببیند: وقتی scroll می‌کند، sleep count باید زیاد شود
   - وقتی player نزدیک می‌شود، awake count باید زیاد شود

2. **سناریوی تست دستی — basic:**
   - وارد Wastes section 2 شوید (3 drowned_walkers)
   - به section 3 بروید (4 mosquito_drones)
   - F3 را بزنید → باید ببینید "ENEMIES: 5 sleep / 4 awake" یا مشابه
   - به section 2 برگردید → باید ببینید "ENEMIES: 4 sleep / 5 awake" یا مشابه
   - دشمنان section 2 باید به‌درستی behave کنند (patrol، aggro وقتی نزدیک می‌شوید، attack)

3. **سناریوی تست — telegraph-skip (CRITICAL):**
   - با یک drowned_walkers درگیر شوید تا وارد attack/telegraph شود
   - **در حین telegraph** (دایره‌ی قرمز قابل‌مشاهده) سریع دور شوید (dash)
   - enemy باید خواب برود (F3: sleep count زیاد شود)
   - برگردید — enemy باید:
     - ✅ telegraph را از همان نقطه ادامه دهد (نه از صفر)
     - ❌ نباید مستقیم به window/حمله بپرد بدون telegraph
     - ❌ نباید در حالت نامعتبر گیر کند
   - اگر player دور باشد، enemy باید به patrol برگردد (چون inRange false است)

4. **سناریوی تست — combat resume:**
   - چند enemy را تا نیمه‌ی سلامت بزنید (posture > 0)
   - دور شوید (enemies خواب می‌شوند)
   - برگردید — posture باید همان مقدار قبلی باشد (decay نشده چون update skip شد)
   - دشمنان باید به‌درستی attack کنند

5. **سناریوی تست — stagger recovery:**
   - یک enemy را stagger کنید (پر کردن posture bar)
   - سریع دور شوید (enemy خواب می‌رود در حالی که staggeredUntil timestamp است)
   - ۲ ثانیه صبر کنید
   - برگردید — enemy باید از stagger خارج شده باشد (چون staggeredUntil گذشته است)
   - enemy باید به patrol/aggro برگشته باشد (نه گیر کرده در stagger)

### معیار پذیرش T8

- [ ] PerformanceOverlay نشان می‌دهد "ENEMIES: N sleep / M awake"
- [ ] وقتی player به section 3 می‌رود، enemies section 2 sleep می‌شوند
- [ ] وقتی player به section 2 برمی‌گردد، enemies بیدار می‌شوند
- [ ] **telegraph-skip test:** enemy در حال telegraph دور می‌شود، برمی‌گردد → telegraph ادامه می‌یابد (نه skip)
- [ ] **combat resume test:** posture حفظ می‌شود بعد از sleep/wake
- [ ] **stagger recovery test:** stagger به‌درستی expire می‌شود بعد از sleep
- [ ] دشمنان بیدار شده به‌درستی behave می‌کنند (patrol، aggro، attack)
- [ ] projectile‌ها به دشمنان خوابیده برخورد می‌کنند
- [ ] player-enemy contact رخ می‌دهد
- [ ] FPS ≥ 48 (انتظار +3-5 FPS از 45)

---

## ۴) ریسک‌ها و کاهش

| ریسک | احتمال | شدت | کاهش |
|------|--------|------|------|
| Enemy برای همیشه خواب بماند | پایین | بالا | Wake logic در همان loop — هر فریم چک می‌شود |
| FSM در حالت نامعتبر گیر کند | پایین | متوسط | تحلیل ۲.۵ نشان داد state preservation ایمن است |
| Margin mismatch با VisualCuller | حذف شده | — | Margin یکسان (300px) |
| Projectile به enemy خوابیده نخورد | حذف شده | — | Projectile position-based است، نه Matter collision |
| Player-enemy contact رخ ندهد | حذف شده | — | Detector.js:96 — player بیدار است → collision check انجام می‌شود |
| Telegraph visual tween leak | پایین | پایین | Enemy دور است، player نمی‌بیند — بی‌ضرر |
| Boss (Leviathan) نباید sleep شود | — | — | Boss در enemy loop نیست — جدا مدیریت می‌شود |

**ریسک کلی:** **متوسط** (نه کم) — به دلیل FSM complexity، اما تحلیل نشان می‌دهد ایمن است.

---

## ۵) پیاده‌سازی

### تغییرات مورد نیاز

| فایل | تغییر | زمان |
|------|-------|------|
| `PlayController.ts` | اصلاح enemy loop: اضافه‌کردن sleep/wake logic + `continue` برای sleep شده‌ها | 20 min |
| `PerformanceOverlay.ts` | اضافه‌کردن "ENEMIES: N sleep / M awake" counter | 15 min |
| `EnemyEntity.ts` | (بدون تغییر) — body مدیریت توسط PlayController | 0 |
| `OPTIMIZATION_PLAN.md` | به‌روزرسانی status | 5 min |

**مجموع:** ~40 دقیقه

### ترتیب اجرا

1. اضافه‌کردن counter به PerformanceOverlay (برای verification)
2. اصلاح enemy loop در PlayController
3. tsc check
4. commit + push
5. کاربر تست: F3 در Wastes → ببیند counter کار می‌کند
6. کاربر تست: scroll → sleep count تغییر کند
7. کاربر تست: combat → دشمنان به‌درستی behave کنند

---

## ۶) معیار پذیرش

- [ ] tsc --strict: 0 errors
- [ ] PerformanceOverlay نشان می‌دهد "ENEMIES: N sleep / M awake"
- [ ] وقتی player به section 3 می‌رود، enemies section 2 sleep می‌شوند (N زیاد می‌شود)
- [ ] وقتی player به section 2 برمی‌گردد، enemies بیدار می‌شوند (M زیاد می‌شود)
- [ ] دشمنان بیدار شده به‌درستی behave می‌کنند (patrol، aggro، attack)
- [ ] projectile‌ها به دشمنان خوابیده برخورد می‌کنند (اگر player از دور شلیک کند)
- [ ] player-enemy contact رخ می‌دهد (player می‌تواند به enemy برخورد کند)
- [ ] FPS ≥ 48 (انتظار +3-5 FPS از 45)
