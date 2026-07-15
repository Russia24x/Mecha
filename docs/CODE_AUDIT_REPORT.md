# Code Audit Report — MECHA: LAST PROTOCOL (Phaser 4.2.1)

> **Audit date:** 2026-07-11
> **Files audited:** 25 source files (~6000 lines)
> **Issues found:** 55 total — 11 CRITICAL, 12 HIGH, 18 MEDIUM, 14 LOW

---

## خلاصه اجرایی (Executive Summary)

بازی چند مشکل ساختاری بزرگ دارد که با هم باعث هنگ کردن/کرش بعد از چند بار بازی می‌شوند:

1. **Memory leak عظیم در `cleanupPlay()`** — Player, Enemies, Boss, Solids, Triggers, Tweens هرگز destroy نمی‌شوند. بعد از ۳-۵ بار restart، صدها Matter body و GameObject و event listener جمع می‌شود.
2. **Duplicate keyboard listeners** — Player هم روی Phaser keyboard هم روی window listener ثبت می‌کند → هر key دو بار fire می‌شود (دو بار weapon switch، دو بار jump cut).
3. **Window listeners هرگز پاک نمی‌شوند** — بعد از Player reconstruction، listener‌های قدیمی روی Player مخرب اشاره می‌کنند.
4. **UIScene RESTART bug** — GameScene resume فراموش شده، stage فریز می‌ماند.
5. **Continue از checkpoint به stage اشتباه می‌رود** — `Save.get().bossesKilled` وجود ندارد (در SkillTree است).
6. **Phaser 3 dead code** — `CinematicPipeline`, `Destructible.ts`, `Raycast.ts`, `fixedStep` همگی برای Phaser 3 نوشته شده‌اند و در 4.2 یا بی‌اثرند یا crash می‌کنند.

---

## 🔴 CRITICAL Issues (11)

### C1. `UIScene.ts:38-43` — RESTART STAGE بازی را فریز می‌کند
**Category:** Logic error
**Description:** دکمه RESTART STAGE ابتدا `this.scene.stop()` را فراخوانی می‌کند، سپس `gs.setState('play')`، اما هرگز `this.scene.resume('GameScene')` را صدا نمی‌زند. سایر دکمه‌ها (QUIT TO MAP, QUIT TO MENU) به درستی resume را فراخوانی می‌کنند. نتیجه: بعد از restart، update loop بازی اجرا نمی‌شود و stage فریز می‌ماند.
**Fix:** قبل از `gs.setState('play')`، `this.scene.resume('GameScene')` را اضافه کنید.

### C2. `GameScene.ts:159` — CONTINUE همیشه به Stage 1 می‌رود
**Category:** Logic error / Null pointer
**Description:** کد می‌نویسد `Save.get().bossesKilled > 0` اما `SaveData` فیلد `bossesKilled` ندارد (این در `SkillTree` است). `undefined > 0` برابر `false` است، پس `currentStageId` همیشه ۱ می‌شود حتی وقتی checkpoint در Stage 2/3 است. بازیکن در Stage 1 با section number مربوط به Stage 2/3 respawn می‌شود.
**Fix:** `SkillTree.get().bossesKilled >= 1` (و برای Stage 3: `>= 2`).

### C3. `GameScene.ts:435-461` — `cleanupPlay()` تقریباً همه object‌ها را leak می‌کند
**Category:** Memory leak
**Description:** این متد HUD, BossBar, parallax, atmosphere, graphics, tutorial hints, health pickups, stage bg, FloatingText را destroy می‌کند اما **نه**: `this.player` (متد destroy دارد)، `this.enemies[]` (هر کدام sprite + visualGfx + telegraphGfx دارند)، `this.boss` (متد destroy دارد)، `this.solids[]` (Matter images + Graphics + neon glow rect + spike-trap glow rect — هیچ‌یک track نشده‌اند)، `this.sectionTriggers[]`، `this.bossArenaTrigger`، checkpoint triggers (lines 792-797 هرگز ذخیره نمی‌شوند)، destructible crate graphics، spike-trap graphics، `this.physics` (PhysicsWorld متد destroy ندارد)، `this.damageSystem`، و tween‌های بی‌نهایت روی هر neon glow / spike-trap glow. هر replay صدها GameObject و Matter body leak می‌کند.
**Fix:** تمام GameObject‌های ساخته‌شده را در آرایه track کنید و در cleanupPlay همه را destroy کنید: `this.player?.destroy()`, `this.boss?.destroy()`, `this.enemies.forEach(e => e.destroy())`, `this.solids.forEach(s => s.destroy())`, `this.sectionTriggers.forEach(t => t.destroy())`, `this.tweens.killAll()`.

### C4. `GameScene.ts:1156-1160` — Phase-2 boss، phase-1 boss را leak می‌کند
**Category:** Memory leak
**Description:** `handleBossStageDefeated()` ابتدا `this.boss = null` سپس `this.boss = new Boss(...)` می‌کند. Phase-1 Boss (sprite, matter body, tweens, HP bar references) هرگز destroy نمی‌شود — در display list و matter world باقی می‌ماند.
**Fix:** قبل از reassign، `this.boss?.destroy()` را صدا بزنید.

### C5. `GameScene.ts:1053-1070` — Timer نظرسنجی gamepad در game-over هرگز cancel نمی‌شود
**Category:** Memory leak / Performance
**Description:** `this.time.addEvent({ delay: 100, loop: true, ... })` بدون ذخیره handle ساخته می‌شود. دکمه‌های RETRY/QUIT overlay را destroy می‌کنند اما timer را پاک نمی‌کنند؛ هر ۱۰۰ms برای همیشه `GamepadManager.getState()` را صدا می‌زند. بعد از چند game-over، ده‌ها timer جمع می‌شود.
**Fix:** handle را در `this.gameOverPoll` ذخیره کنید و در هر button onClick آن را `.remove()` کنید.

### C6. `GameScene.ts:441` — `matter.world.off` آرگومان context را ندارد
**Category:** Phaser 3→4 incompatibility / Listener leak
**Description:** listener با context `this` ثبت شده (line 790: `this.matter.world.on('collisionstart', this.onCollisionStart, this)`). اما `off` بدون context صدا زده می‌شود. Phaser 4 برای تطبیق مطمئن به context نیاز دارد. بدون آن listener ممکن است در session بعدی باقی بماند → handler تکراری هر replay + null reference به player/solids مخرب.
**Fix:** `this.matter.world.off('collisionstart', this.onCollisionStart, this);`

### C7. `Projectile.ts:97` — `opts.ttl` نادیده گرفته می‌شود، 1500ms hardcoded
**Category:** Logic error
**Description:** constructor چیزی از `opts.ttl` ذخیره نمی‌کند. چک TTL از `1500` hardcoded استفاده می‌کند. caller‌هایی که `ttl: weapon.ttl` می‌فرستند (Player.ts:442, Enemy.ts, Boss.ts) بی‌اثرند. projectile‌های slow زود می‌میرند؛ weapon‌های long-range قابل تنظیم نیستند.
**Fix:** `this.ttl = opts.ttl ?? 1500` در constructor و استفاده از `this.ttl` در line 97.

### C8. `Hitscan.ts:41-69` — hits بر اساس distance مرتب نمی‌شوند
**Category:** Logic error
**Description:** `intersectRay` آرایه‌ای بدون ترتیب distance برمی‌گرداند. حلقه روی اولین enemy/solid break می‌کند که ممکن است پشت یک دیوار نزدیک‌تر باشد. یعنی دیوار جلوی بازیکن beam را متوقف نمی‌کند اما دشمن دور همچنان damage می‌گیرد.
**Fix:** `hits.sort((a,b) => dist(origin, a.position) - dist(origin, b.position))` قبل از iterate.

### C9. `Enemy.ts:140-146` — `hasLineOfSight` تقریباً همیشه false برمی‌گرداند
**Category:** Logic error
**Description:** `intersectRay` از داخل بدن خود دشمن شروع می‌شود → بدن خود دشمن در `hits` است. کد فقط `hits[0]` را چک می‌کند. اگر `hits[0]` خود دشمن باشد (که غالباً اینطور است)، LOS false می‌شود و دشمن هرگز از patrol به aggro نمی‌رود.
**Fix:** خود بدن دشمن را فیلتر کنید و چک کنید آیا hit باقی‌مانده `label.startsWith('solid')` دارد:
```ts
const hits = this.scene.matter.intersectRay(...) as MatterJS.BodyType[];
const wallBetween = hits.some(b => b !== this.sprite.body && b.label.startsWith('solid'));
return !wallBetween;
```

### C10. `Boss.ts:261, 265` — Teleport فیزیک sprite را alpha 1 می‌کند (مستطیل سفید قابل مشاهده)
**Category:** Logic error
**Description:** در constructor sprite alpha 0 است (line 56). teleport ابتدا `setAlpha(0.3)` سپس بعد از 200ms `setAlpha(1)` می‌کند. بعد از teleport، فیزیک sprite (image `'__white'` با alpha 1) پشت bossGfx کشیده می‌شود → بازیکن مستطیل سفید پشت boss art می‌بیند.
**Fix:** تغییرات alpha باید روی `this.bossGfx` باشد نه `this.sprite`:
```ts
this.bossGfx?.setAlpha(0.3);
this.scene.time.delayedCall(200, () => this.bossGfx?.setAlpha(1));
```

### C11. `SkillTree.ts:110-115` — ریسک infinite loop با save خراب
**Category:** Logic error (potential hang)
**Description:** `while (data.xp >= this.xpForLevel(data.level))` — `xpForLevel(0) = 100 * 0^1.5 = 0`. اگر save خراب `level: 0` داشته باشد، شرط `data.xp >= 0` همیشه true است و loop بی‌نهایت می‌شود → هنگ بازی در اولین XP award.
**Fix:** قبل از loop `if (data.level < 1) data.level = 1;` اضافه کنید.

---

## 🟠 HIGH Issues (12)

### H1. `Player.ts:139-153 + 156-196` — Duplicate keyboard listeners
**Category:** Logic error / Duplicate listeners
**Description:** هر کلید (SPACE, J, K, 1-4, E, Q, SHIFT) هم روی Phaser keyboard plugin هم روی window ثبت می‌شود. هر دو در یک فشرده fire می‌شوند: `switchWeapon` دو بار (دو weapon skip)، `cutJump` دو بار (jump خیلی کوتاه)، `weaponSwitch` sound دو بار.
**Fix:** فقط یک منبع input نگه دارید — window listeners را حذف کنید یا Phaser listeners را.

### H2. `Player.ts:156-196` — Window listeners هرگز در `destroy()` پاک نمی‌شوند
**Category:** Memory leak
**Description:** `setupInput()` دو listener anonymous روی window اضافه می‌کند. `destroy()` فقط GameObjects را نابود می‌کند. بدتر: `GameScene.cleanupPlay()` هرگز `this.player?.destroy()` را صدا نمی‌زند. بعد از N restart، N+1 listener وجود دارد که به Player مخرب اشاره می‌کنند.
**Fix:** handler‌ها را به‌عنوان field ذخیره کنید و در `destroy()` با `removeEventListener` پاک کنید. همچنین `this.player?.destroy()` را در `cleanupPlay` صدا بزنید.

### H3. `Boss.ts:170-173` — `setTint` روی sprite نامرئی بی‌اثر است
**Category:** Phaser 3→4 incompatibility / Logic error
**Description:** sprite alpha 0 است (line 56). `takeDamage` در phase change از `setTint(0xffffff)` استفاده می‌کند که بی‌اثر است. همچنین Phaser 4 `setTint` additive است نه fill — باید `setTintMode(Phaser.TintModes.FILL)` یا `setTintFill()` استفاده می‌شد.
**Fix:** flash را روی `bossGfx` اعمال کنید (redraw با رنگ متفاوت) یا یک مستطیل سفید موقت overlay کنید.

### H4. `GamepadManager.ts:132, 134` — RB button هم melee هم weapon switch
**Category:** Logic error
**Description:** `meleePressed = edge(3) || edge(5)` (Y یا RB) و `weaponNextPressed = edge(5)` (RB). فشردن RB هم melee می‌زند هم weapon عوض می‌کند. همان مشکل برای B button (1): هم `dashPressed` هم `backPressed`.
**Fix:** هر button فقط یک نقش داشته باشد. melee روی Y(3)، weapon switch روی LB/RB(4/5).

### H5. `Enemy.ts:365` vs `EnemyTypes.ts:35` — `fireRateMs` (2200ms) نادیده گرفته می‌شود
**Category:** Logic error / Dead config
**Description:** `fire()` چک می‌کند `this.scene.time.now - this.lastFireAt < 100` (100ms hardcoded). `fireRateMs: 2200` هرگز خوانده نمی‌شود. نرخ آتش واقعی ~1.3s است نه 2.2s.
**Fix:** `this.data.fireRateMs ?? 100` به جای literal `100`.

### H6. `Graphics.ts:42` — F3 listener هرگز پاک نمی‌شود
**Category:** Listener leak
**Description:** `scene.input.keyboard?.on('keydown-F3', ...)` در constructor ثبت می‌شود اما `destroy()` فقط container را نابود می‌کند. بعد از N replay، F3 را N بار toggle می‌کند و N closure در حافظه می‌ماند.
**Fix:** listener را ذخیره کنید و در `destroy()` با `off` پاک کنید.

### H7. `Graphics.ts:245-251` — `cmFilter` در destroy از camera پاک نمی‌شود
**Category:** Memory leak / Phaser 4 API misuse
**Description:** `setBrightness` یک ColorMatrix filter به camera اضافه می‌کند اما `destroy()` آن را پاک نمی‌کند. `removeCinematicGrade` از `filters.internal.clear()` استفاده می‌کند که همه filter‌ها را پاک می‌کند، اما reference‌های `cmFilter` stale می‌شوند.
**Fix:** در `destroy()`، `cam.filters.internal.remove(this.cmFilter)` را با try/catch صدا بزنید.

### H8. `StageAtmosphere.ts:144-148` — Rain timer هرگز cancel نمی‌شود
**Category:** Memory leak
**Description:** `time.addEvent({ delay: 40, loop: true, ... })` بدون ذخیره handle. `destroy()` فقط `enabled = false` می‌کند. timer هر 40ms برای همیشه fire می‌شود.
**Fix:** handle را ذخیره کنید و در `destroy()` آن را `.remove()` کنید.

### H9. `StageAtmosphere.ts:108-134` — Neon glow rects + tween‌های بی‌نهایت هرگز destroy نمی‌شوند
**Category:** Memory leak
**Description:** `glow` rectangle (line 109) هرگز به `this.neonSigns` اضافه نمی‌شود. دو tween بی‌نهایت (`repeat: -1`) به ازای هر sign. `destroy()` فقط sign body‌ها را destroy می‌کند، نه glow‌ها و tween‌ها را.
**Fix:** `glow` را هم track کنید و در `destroy()` هم glow و هم tween‌ها را پاک کنید.

### H10. `PhaserGame.ts:92-97` — F11 listener در HMR/re-create جمع می‌شود
**Category:** Listener leak
**Description:** `window.addEventListener('keydown', ...)` در `create()` هر بار اضافه می‌شود. `create()` instance قبلی را destroy می‌کند اما listener قبلی را پاک نمی‌کند. بعد از HMR، N listener روی F11 جمع می‌شود.
**Fix:** handler را به‌عنوان static field ذخیره و قبل از re-add، remove کنید.

### H11. `GameScene.ts:929-932, 1152-1153, 1181-1189, 1221-1224, 1283-1285` — `delayedCall` handle‌ها هرگز ذخیره نمی‌شوند
**Category:** Logic error / Memory leak
**Description:** چندین `delayedCall` دنباله‌های death → game-over, boss-stage-defeated, boss-dead, boss-lore, boss-rewards را orchestration می‌کنند. هیچ handle‌ای ذخیره نمی‌شود. اگر بازیکن mid-sequence restart/quit کند، callback‌ها روی scene/state مخرب fire می‌شوند.
**Fix:** handle‌ها را در آرایه ذخیره کنید و در `cleanupPlay()` همه را `.remove()` کنید.

### H12. `Enemy.ts` — کلاس `destroy()` ندارد
**Category:** Memory leak
**Description:** برخلاف Player و Boss، Enemy متد destroy ندارد. cleanupPlay آرایه enemies را iterate نمی‌کند. وقتی scene shutdown می‌شود Phaser display list را auto-destroy می‌کند اما tween‌های pending روی telegraphGfx ممکن است به target مخرب دسترسی پیدا کنند.
**Fix:** متد `destroy()` اضافه کنید (sprite, visualGfx, telegraphGfx, telegraphExtra) و از cleanupPlay صدا بزنید.

---

## 🟡 MEDIUM Issues (18)

### M1. `PhysicsWorld.ts:47-49` — `bodiesInArea` با arg اشتباه همیشه `[]` برمی‌گرداند
`query.region` نیاز به bodies array + Bounds دارد، اما کد یک Circle می‌فرستد. همیشه خالی برمی‌گرداند.
**Fix:** `this.scene.matter.intersectRect(x-r, y-r, r*2, r*2)` استفاده کنید.

### M2. `DamageSystem.ts:26` — `localWorld.bodies` به جای `getAllBodies()`
Phaser 4 recommends `world.getAllBodies()` (recursive). فعلاً کار می‌کند چون composite تودرتو نداریم.
**Fix:** `this.scene.matter.world.getAllBodies()`.

### M3. `Projectile.ts:89-90` — `this.sprite.body!` بدون null check
اگر body mid-frame حذف شود crash می‌کند.
**Fix:** `const b = this.sprite.body; if (!b) { this.kill(); return; }`.

### M4. `Projectile.ts:122-129` — `scene.children.list` هر frame iterate می‌شود (O(N×M))
با 30 projectile و 200 children = 6000 iteration/frame.
**Fix:** registry از entityType‌ها بسازید.

### M5. `DamageSystem.ts:61-72` — `delayedCall` در hit-stop جمع می‌شود
هر hit یک timer جدید می‌سازد. تحت beam weapon 10 closure/sec.
**Fix:** timer handle را ذخیره و قبل از جدید، قدیمی را remove کنید.

### M6. `Boss.ts:166-167` — `health` منفی می‌شود، phase logic با ratio منفی
`this.health -= amount` بدون `Math.max(0, ...)`. phase event با `healthPct` منفی emit می‌شود.
**Fix:** `this.health = Math.max(0, this.health - amount);`.

### M7. `Boss.ts:64` — `BOSS_PHASE` از constructor قبل از subscription emit می‌شود
اگر Boss قبل از register handler ساخته شود، event گم می‌شود.
**Fix:** subscription را قبل از Boss construction تضمین کنید.

### M8. `Effects.ts:210-223` — `stopMusic` با ctx=null، `pendingMusic` را پاک نمی‌کند
اگر playMusic قبل از audio init صدا زده شود، `pendingMusic` set می‌شود. اگر stopMusic قبل از init صدا زده شود، `pendingMusic` پاک نمی‌شود و بعد از gesture، music اشتباه پخش می‌شود.
**Fix:** در stopMusic همیشه `pendingMusic = null` و `currentMusic = null`.

### M9. `GameScene.ts:519-528` — `removeCinematicGrade` از `clear()` استفاده می‌کند
همه filter‌ها را پاک می‌کند از جمله brightness ColorMatrix. reference‌های stale می‌مانند.
**Fix:** فقط filter‌هایی که این scene اضافه کرده را remove کنید.

### M10. `GameScene.ts:241-247` — `load.once('complete')` race در map preview
اگر texture از قبل cached باشد، `load.start()` کاری نمی‌کند و complete fire نمی‌شود.
**Fix:** ابتدا `textures.exists` چک کنید (line 237 دارد) و skip کنید.

### M11. `GameScene.ts:877, 904, 1163` — `follow` callback هر frame Vector2 جدید می‌سازد
10+ light = 10+ allocation/frame → GC pressure.
**Fix:** scratch Vector2 استفاده کنید.

### M12. `Parallax.ts:30-37` — 480 fillRect برای sky gradient
بیش از حد wasteful.
**Fix:** `fillGradientStyle` با یک fillRect.

### M13. `Graphics.ts:258-288` — `CinematicPipeline` dead code + Phaser 3 shader syntax
GLSL قدیمی (`precision mediump float`, `varying`). Phaser 4 WebGL 2.0 نیاز به GLSL 3.00 دارد.
**Fix:** حذف کنید (استفاده نمی‌شود).

### M14. `BootScene.ts:47-50` — `load.on('progress')` هرگز پاک نمی‌شود
**Fix:** در `create()` با `off` پاک کنید.

### M15. `GameScene.ts:846-853` — متغیر mislabel + unsafe sprite access
`enemySprite` اسم غلط برای x-coordinate.
**Fix:** rename به `enemyX` و guard `sprite?.active`.

### M16. `GameScene.ts:1088-1093` — `enemy.sprite.x` بعد از destroy
Enemy.die() sprite را destroy می‌کند سپس ENEMY_DEAD emit می‌کند. handler به sprite مخرب دسترسی می‌زند.
**Fix:** position را در payload ارسال کنید.

### M17. `GameScene.ts:1159` — Phase-2 boss hardcode `2` برای stage
Stage 3 از config اشتباه (Stage 2 Enraged) استفاده می‌کند.
**Fix:** همان `bossStage` computation را reuse کنید.

### M18. `PhaserGame.ts:74` — `fixedStep: true` در matter config
Phaser 4.2 این property را ندارد. TypeScript باید error بدهد اما silently ignore می‌شود.
**Fix:** حذف کنید.

---

## 🟢 LOW Issues (14)

| # | File:Line | Description |
|---|-----------|-------------|
| L1 | `Player.ts:143-145` | Dead `keydown-ESC` handler (no-op) |
| L2 | `Player.ts:598-612` | Thruster trail هر frame circle + tween می‌سازد |
| L3 | `Player.ts:451-458` | Recoil tween با updateAnimation می‌جنگد |
| L4 | `Player.ts:302,312,316` | `body!` assertions بدون null check |
| L5 | `Player.ts:504-509` | setWeapon حتی وقتی weapon همان است sound پخش می‌کند |
| L6 | `Enemy.ts:184-185` | Cover state frame-rate dependent (Math.random) |
| L7 | `Enemy.ts:157-164` | takeDamage همیشه true برمی‌گرداند |
| L8 | `Enemy.ts:41` | telegraphExtra به‌جای Arc به‌عنوان GameObject تایپ شده |
| L9 | `EnemyTypes.ts:56-58` | enemyCounter هرگز reset نمی‌شود |
| L10 | `Boss.ts:186` | `_deltaMs` پارامتر استفاده نشده |
| L11 | `Boss.ts:199` | lungeVel.scale decay frame-rate dependent |
| L12 | `GamepadManager.ts:161-166` | `destroy()` هرگز صدا زده نمی‌شود |
| L13 | `Effects.ts:42-44` | 3 gesture listener با `{ once: true }` فقط یکی fire می‌شود |
| L14 | `Save.ts:32-33` | Comment می‌گوید "Default 0.6" اما مقدار 0.8 است |

---

## 📊 آمار

| Severity | تعداد |
|----------|-------|
| CRITICAL | 11 |
| HIGH | 12 |
| MEDIUM | 18 |
| LOW | 14 |
| **مجموع** | **55** |

## 🎯 اولویت‌های تعمیر (Top 5)

1. **C3** — `cleanupPlay()` را کامل کنید (player, enemies, boss, solids, triggers, tweens)
2. **C1** — UIScene RESTART را fix کنید (`scene.resume` اضافه کنید)
3. **C2** — Continue checkpoint از `SkillTree.get().bossesKilled` استفاده کند
4. **H1 + H2** — Player duplicate listeners را حذف و window listeners را در destroy پاک کنید
5. **C9** — Enemy LOS را fix کنید (self-body را فیلتر کنید)

## 🧹 Dead Code برای حذف

- `src/game/features/combat/Destructible.ts` (تمام فایل — هرگز instantiate نمی‌شود)
- `src/game/features/physics/Raycast.ts` (تمام فایل — هرگز import نمی‌شود)
- `CinematicPipeline` class در `Graphics.ts:258-288` (هرگز استفاده نمی‌شود)
- `fixedStep: true` در `PhaserGame.ts:74` (Phaser 4 آن را ندارد)
- `DamageSystem.spawnSpark`, `DamageSystem.damageEntity`, `DamageSystem.sparks` field
- `Player.ts:143-145` (dead ESC handler)
- `Effects.ts:142-144` (`sweep` alias)

## ⚡ Performance Hotspots

1. `Projectile.update` — `scene.children.list.forEach` هر frame (O(N×M))
2. `Player.ts:598-612` — thruster trail هر frame circle + tween
3. `GameScene.ts:877,904,1163` — `follow` callback هر frame Vector2 تخصیص می‌دهد
4. `Parallax.ts:30-37` — 480 fillRect برای sky gradient
5. `DamageSystem.ts:61-72` — hit-stop delayedCall accumulation

## ✅ چیزهایی که مشکل نیستند (تایید شده)

- `Phaser.Physics.Matter.Matter.Body.*` و `Matter.Bounds.*` هنوز در Phaser 4.2.1 معتبرند
- هیچ `setInterval`/`setTimeout` خام استفاده نشده — همه از `scene.time` استفاده می‌کنند
- `setPostPipeline` misuse در فایل‌های audit‌شده پیدا نشد (فقط در `CinematicPipeline` dead code)

---

*Audit version 1.0 — 2026-07-11*
