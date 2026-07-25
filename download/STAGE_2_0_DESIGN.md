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

**تحلیل:**
- `state` (string) — حفظ می‌شود (هیچ reset نمی‌شود هنگام sleep)
- `stateTime` (number) — هنگام sleep frozen می‌شود (چون update skip می‌شود). هنگام wake، به همان مقدار ادامه می‌دهد
- `attackPhase` — حفظ می‌شود
- `staggeredUntil` — timestamp است، نه counter. وقتی enemy خواب است، `scene.time.now` ادامه می‌کند. وقتی بیدار شود، اگر `staggeredUntil` گذشته باشد، `isStaggered = false` می‌شود و FSM به patrol/aggro برمی‌گردد — **درست کار می‌کند**
- `hacked` — boolean، حفظ می‌شود

**ریسک:** اگر enemy در حالت `attack` و `telegraph` خواب شود، وقتی بیدار شود، `stateTime` ادامه می‌دهد. اگر `stateTime >= telegraphMs` باشد، به `window` منتقل می‌شود — این درست است. اما اگر player دور باشد، enemy بلافاصله به `patrol` برمی‌گردد (چون `inRange` false است). این هم درست است.

**نتیجه:** FSM state preservation **ایمن** است. هیچ state نامعتبری رخ نمی‌دهد.

---

## ۳) تست رفتاری T8

**تعریف:** enemy دور از دوربین می‌خوابد، نزدیک‌شدن player → بیدار می‌شود → FSM state معتبر است، نه گیر کرده در telegraph.

### روش تست

1. **PerformanceOverlay counter** (راه‌حل جایگزین probe):
   - اضافه‌کردن "ENEMIES: N sleep / M awake" به PerformanceOverlay
   - کاربر می‌تواند با چشم ببیند: وقتی scroll می‌کند، sleep count باید زیاد شود
   - وقتی player نزدیک می‌شود، awake count باید زیاد شود

2. **سناریوی تست دستی**:
   - وارد Wastes section 2 شوید (3 drowned_walkers)
   - به section 3 بروید (4 mosquito_drones)
   - F3 را بزنید → باید ببینید "ENEMIES: 5 sleep / 4 awake" یا مشابه
   - به section 2 برگردید → باید ببینید "ENEMIES: 4 sleep / 5 awake" یا مشابه
   - دشمنان section 2 باید به‌درستی behave کنند (patrol، aggro وقتی نزدیک می‌شوید، attack)

3. **سناریوی edge case**:
   - دشمن را در حال telegraph بگذارید خواب برود (دور شوید)
   - برگردید — دشمن باید یا به patrol برگردد (چون player دور است) یا به attack ادامه دهد (چون player نزدیک است)
   - نباید در حالت نامعتبر گیر کند

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
