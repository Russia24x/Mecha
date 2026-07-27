# MECHA: LAST PROTOCOL — Master Plan: Bonfire + Multi-Area Refactor

> **تاریخ:** 2026-07-27
> **وضعیت:** پیش‌نویس برای مشاور + کاربر
> **هدف:** سیستم Bonfire (Dark Souls-like) + تقسیم تمام Acts به Areas مستقل + Fast Travel + Inter-area transitions

---

## ۱) خلاصه‌ی تحلیل معماری فعلی

### چه چیزی موجود است
| سیستم | وضعیت | نقاط قوت | شکاف‌ها |
|------|-------|---------|--------|
| **Checkpoint** | walk-through sensor، single-slot | کار می‌کند، ساده | عدم interact، عدم refill، عدم fast-travel از checkpoint |
| **Multi-Area** | فقط Act III (۳ area) | الگو اثبات شده | Acts I/II/IV/V هنوز تک-area |
| **Fast Travel** | Hub + WorldMap هر دو کار می‌کنند | از قبل پیاده شده | section همیشه ۱ (نه bonfire خاص) |
| **Inter-Area Travel** | **وجود ندارد** | — | فقط menu-travel، بدون gate/portal |
| **Enemy Culling** | per-frame Body.set | کار می‌کند | با areas کوچک‌تر تأثیر کمتر |
| **Save System** | v4 IndexedDB | قوی، race-safe | bonfire-lit state ذخیره نمی‌شود |

### مشکلات کشف‌شده
1. **Duplicate boss ID**: `iron_magistrate` هم در `act3_ward_2` هم در `act3_courthouse`
2. **Hardcoded fallback**: `getRespawnPosition` → `{x:200, y:420}` (نادیده می‌گیرد geometry)
3. **Section forced to 1**: fast-travel همیشه به ابتدای area می‌رود
4. **No adjacency graph**: نقشه‌ی فعلی ترتیبی است، نه توپولوژی واقعی

---

## ۲) طراحی Bonfire System

### ۲.۱ مفهوم
هر Area دارای ۲-۳ «ترمینال ذخیره» (bonfire معادل) است:
- **ابتدای Area** (always lit)
- **اواسط Area** (near checkpoint section)
- **انتهای Area** (near boss/exit gate)

### ۲.۲视觉
ترمینال مکا با نور آمبر — وقتی player نزدیک می‌شود، prompt `▼ REST` نمایش داده می‌شود. وقتی interact می‌کند:
- HP/Energy پر می‌شود (refillRepair)
- Game save می‌شود
- منوی Fast Travel باز می‌شود (اختیاری)
- دشمنان area respawn می‌شوند (به‌جز boss/mini-boss) — **deferred to Phase F** (per advisor Point 2)

> **Enemy Respawn (تصمیم صریح محدوده‌ی B، per advisor):** در Phase B پیاده **نمی‌شود**. نسخه‌ی اول Bonfire فقط heal+save+light+toast است.
> Respawn به Phase F موکول می‌شود چون نیاز به تصمیم طراحی دارد:
> - آیا mini-boss هم respawn نشود؟
> - آیا لوت جمع‌شده دوباره ظاهر شود؟
> - چه اتفاقی برای دشمنانی که player همین الان دارد با آن‌ها می‌جنگد می‌افتد اگر بی‌احتیاط نزدیک bonfire استراحت کند؟
> - هماهنگی با `TargetRegistry` و `spawnEnemiesForSection`
> Phase F بعد از Phase E (Cleanup+Polish) و قبل از release نهایی اجرا می‌شود.

### ۲.۳ Data Structure
```typescript
// New in types.ts
interface BonfireData {
  id: string;          // 'bf_factory_1', 'bf_ward1_2', etc.
  x: number;
  y: number;
  section: number;
  isLit: boolean;      // whether player has activated it
}

// Extension to AreaData
interface AreaData {
  // ... existing fields ...
  bonfires?: BonfireData[];
  exitGates?: ExitGateData[];  // inter-area transitions
}

// New: Exit Gate (inter-area portal)
interface ExitGateData {
  id: string;
  x: number;
  y: number;
  toAreaId: string;
  toSection: number;
  toX: number;
  toY: number;
  label?: string;      // 'CHECKPOINT — INNER WARD'
}

// Extension to SaveData
interface SaveData {
  // ... existing fields ...
  litBonfires: string[];  // IDs of activated bonfires
}
```

### ۲.۴ Bonfire Interaction

> **الگوی معماری (تصمیم نهایی، per advisor):** الگوی **NPC/Lore** — فاصله + پرامپت شناور + کلید تعامل.
> الگوی **Matter-sensor + CollisionController.onBonfire** استفاده **نمی‌شود** چون با UX "بازیکن باید *انتخاب* کند استراحت کند" سازگار نیست (auto-trigger می‌شد).

```
Per-frame (از PlayController.update):
  BonfireController.updatePrompt(loadedArea, player)
    → چک فاصله به هر bonfire (< 70px)
    → اگر نزدیک است: پرامپت شناور [E] REST نمایش بده (مشابه NpcInteractionController.updatePrompt)
    → اگر دور است: پرامپت را پنهان کن

وقتی input.interactPressed در GameScene.tryInteract() رخ می‌دهد:
  GameScene.tryInteract() → اول NPC، بعد Lore، بعد Bonfire را چک می‌کند
  → اگر player نزدیک bonfire است (< 70px):
      1. refillRepair() (heal HP + energy)
      2. SaveSystem.saveCheckpoint({x: bonfire.x, y: bonfire.y, section: bonfire.section})
      3. SaveSystem.lightBonfire(bonfire.id)
      4. toast("✓ BONFIRE LIT") + AudioSystem.play('checkpoint')
      [Phase D: منوی Fast Travel باز می‌شود — نه در Phase B]
```

> **کلید تعامل = `E`** (نه `J` که در متن قدیمی سند بود). `J` = شلیک اسلحه است (InputSystem.ts:155). `E` = interact (InputSystem.ts:169) که توسط NpcInteractionController و tryHack() هم استفاده می‌شود.

> **تداخل پرامپت (per advisor Point 1, تصمیم گزینه‌ی الف):** یک پرامپت واحد برای همه‌ی تعامل‌پذیرها.
> به‌جای اینکه BonfireController.updatePrompt جدا بسازد، `NpcInteractionController.updatePrompt` با بررسی `loadedArea.bonfires` نیز بسط داده می‌شود تا nearest-check شامل NPC + Lore + Bonfire در یک حلقه باشد. `nearestKind` به `'npc' | 'lore' | 'bonfire'` گسترش می‌یابد و متن اکشن برای bonfire `'REST'` می‌شود. این الگو همان لایه‌ی واحد تصمیم‌گیری است که قبلاً برای NPC و Lore استفاده می‌شد (worklog `visual-fixes-round-2`) و تضمین می‌کند هرگز دو پرامپت همزمان روی صفحه نباشد. BonfireController فقط `spawnBonfires` + `tryInteract` + `syncLitState` + `cleanup` را پیاده می‌کند — بدون `updatePrompt`.

### ۲.۵ Bonfire Placement Rule
هر Area (~6144px, 4 sections):
- **Bonfire 1**: x = 200 (section 1 start) — always lit
- **Bonfire 2**: x = sectionWidth * (checkpointSection-1) + 640 — mid-area
- **Bonfire 3** (optional): near boss arena or exit gate

---

## ۳) طراحی Multi-Area Split

### ۳.۱ قاعده‌ی کلی
هر Act به ۲-۳ Area تقسیم می‌شود:
- هر Area: ~6144px، 4 sections، 1-2 bonfire، 0-1 boss
- هر Area: ۱-۲ تصویر بکگراند (max)
- Boss همیشه در آخرین Area اکت

### ۳.۲ تقسیم پیشنهادی

| Act | Areas | Area IDs | Boss | bg Images |
|-----|-------|----------|------|-----------|
| **I** | 3 | `factory_1`, `factory_2`, `factory_3` | Guardian AX-09 (factory_3) | factory_bg_1, factory_bg_2 |
| **II** | 3 | `wastes_1`, `wastes_2`, `wastes_3` | Leviathan Hulk (wastes_3) | wastes_bg_1, wastes_bg_2, wastes_bg_3 |
| **III** | 3 | `act3_ward_1`, `act3_ward_2`, `act3_courthouse` | Iron Magistrate (courthouse) | city_bg_1, city_bg_2, city_bg_3, city_bg_4 |
| **IV** | 2 | `forest_1`, `forest_2` | Neural Overseer (forest_2) | (no bg art yet) |
| **V** | 2 | `orbital_1`, `orbital_2` | The Architect (orbital_2, TBD) | (no bg art yet) |

**مجموع: ۱۳ Area** (از ۷ تا فعلی)

### ۳.۳ Exit Gate (Transition بین Areas)
در انتهای آخرین section هر Area، یک `ExitGateData` قرار دارد:
```typescript
{ id: 'gate_factory1_to_2', x: 5900, y: 460, toAreaId: 'factory_2', toSection: 1, toX: 200, toY: 420 }
```
- بصری: طاق فلزی یا دروازه‌ی بزرگ با نور آمبر
- فیزیک: **Matter sensor** (مثل checkpoint trigger) — اینجا Matter-sensor درست است چون auto-trigger می‌خواهیم
- وقتی player از آن عبور می‌کند: **0.5s fade telegraph** (نه confirm dialog) سپس `WorldSystem.travelTo(toAreaId, toSection)` + auto-checkpoint + `SaveSystem.lightBonfire(<entry bonfire of destination>)` (per preLit policy)
- **Telegraph (per advisor):** قبل از travel واقعی، 0.5 ثانیه fade-out + صدا (`AudioSystem.play('gate_travel')`) تا عبور تصادفی وسط نبرد، بازیکن را ناخواسته به area بعدی نیندازد. این یک confirm dialog کامل نیست — فقط یک نشانه‌ی کوتاه که «این یک نقطه‌ی بازگشت‌ناپذیر است».
- یک‌طرفه است (مثل عبور از جبهه‌ی جنگی) — Return via Hub/Map

### ۳.۴ Inter-Act Transition
وقتی باس اکت شکست داده می‌شود:
- Toast: «منطقه جدید باز شد»
- در Hub، اکت بعدی قابل‌انتخاب است
- همچنین exit gate از آخرین area اکت فعلی به اولین area اکت بعدی (اگر unlock شده)

---

## ۴) طراحی Fast Travel

### ۴.۱ فعلی
- Hub: کارت برای هر Area، کلیک → travelTo(areaId, 1)
- WorldMap: hex node برای هر Area، کلیک → travelTo(areaId, 1)

### ۴.۲ جدید
- Hub: تغییری نمی‌کند (انتخاب Area سطح بالا)
- WorldMap: هر Area node دارای زیر-nodes برای bonfire‌های lit شده
  - کلیک روی bonfire → travelTo(areaId, bonfire.section, bonfire.id)
  - فقط bonfire‌های lit شده قابل‌انتخاب هستند
- travelTo امضای جدید:
  ```typescript
  static travelTo(areaId: string, section: number = 1, bonfireId?: string): boolean
  ```

---

## ۵) برنامه‌ی اجرا (مرحله‌بندی‌شده)

### Phase A — Data Layer (Foundation)
**هدف:** تعریف داده‌های Bonfire + ExitGate + تقسیم Acts

| # | کار | فایل‌ها | زمان |
|---|-----|--------|------|
| A1 | اضافه‌کردن `BonfireData`, `ExitGateData` به types.ts | types.ts | 15 min |
| A2 | اضافه‌کردن `litBonfires` به SaveData + SaveSystem methods | SaveSystem.ts, types.ts | 20 min |
| A3 | تقسیم Act I به ۳ Area (factory_1/2/3) | acts.ts | 45 min |
| A4 | تقسیم Act II به ۳ Area (wastes_1/2/3) | acts.ts | 60 min |
| A5 | تقسیم Act IV به ۲ Area (forest_1/2) | acts.ts | 30 min |
| A6 | تقسیم Act V به ۲ Area (orbital_1/2) | acts.ts | 30 min |
| A7 | رفع duplicate boss ID (iron_magistrate → فقط courthouse) | acts.ts | 5 min |
| A8 | اضافه‌کردن bonfire + exitGate data به هر Area | acts.ts | 60 min |
| A9 | migration: old area IDs → new | SaveSystem.ts | 15 min |

**مجموع Phase A:** ~4 ساعت

### Phase B — Bonfire System
**هدف:** پیاده‌سازی مکانیک Bonfire با الگوی NPC (نه Matter-sensor)

> **الگوی معماری:** BonfireController چهار متد دارد:
> - `spawnBonfires(areaId, loadedArea)` — ساخت GameObjects (آمبر terminal + glow container) در AreaLoader
> - `syncLitState(loadedArea)` — apply وضعیت ذخیره‌شده روی bonfire GameObjects تازه‌ساخته (مثل `MetroidvaniaController.hidePreCollectedItems`)، از `buildPlay()` صدا می‌شود
> - `tryInteract(loadedArea, player)` — از `GameScene.tryInteract()` صدا زده می‌شود (بعد از NPC/Lore branches). اگر player نزدیک bonfire باشد، heal+save+light+toast انجام می‌دهد.
> - `cleanup()` — destroy همه visuals
>
> **هیچ Matter sensor، هیچ CollisionController route، هیچ cleanup در unload() لازم نیست.**
> این الگو دقیقاً همان NpcInteractionController/MetroidvaniaController است.
>
> **پرامپت یکپارچه (per advisor Point 1, تصمیم گزینه‌ی الف):** یک پرامپت واحد برای همه‌ی تعامل‌پذیرها.
> به‌جای اینکه BonfireController.updatePrompt جدا بسازد، `NpcInteractionController.updatePrompt` با بررسی `loadedArea.bonfires` نیز بسط داده می‌شود تا nearest-check شامل NPC + Lore + Bonfire در یک حلقه باشد. `nearestKind` به `'npc' | 'lore' | 'bonfire'` گسترش می‌یابد و متن اکشن برای bonfire `'REST'` می‌شود. این الگو همان لایه‌ی واحد تصمیم‌گیری است که قبلاً برای NPC و Lore استفاده می‌شد (worklog `visual-fixes-round-2`) و تضمین می‌کند هرگز دو پرامپت همزمان روی صفحه نباشد. BonfireController فقط `spawnBonfires` + `tryInteract` + `syncLitState` + `cleanup` را پیاده می‌کند — بدون `updatePrompt`.

| # | کار | فایل‌ها | زمان |
|---|-----|--------|------|
| B1 | ساخت `BonfireController.ts`: `spawnBonfires(areaId)` + `syncLitState(loadedArea)` (apply `SaveSystem.isBonfireLit()` روی GameObjects تازه‌ساخته) + `tryInteract(loadedArea, player)` (heal+save+light+toast) + `cleanup()` | New: `src/game/controllers/BonfireController.ts` | 60 min |
| B2 | AreaLoader: ساخت bonfire GameObjects (آمبر terminal + glow container) در `loadArea()` — **بدون** Matter sensor. ذخیره در `loadedArea.bonfires` | `src/game/world/AreaLoader.ts` | 30 min |
| B3 | PlayController.build: اضافه‌کردن `r.bonfire?.spawnBonfires(areaId, loadedArea)` + `r.bonfire?.syncLitState(loadedArea)` بعد از `metroidvania.hidePreCollectedItems` (line 197) | `src/game/controllers/PlayController.ts` | 10 min |
| B4 | NpcInteractionController.updatePrompt: بسط `nearestKind` به `'npc' \| 'lore' \| 'bonfire'` + اضافه‌کردن حلقه‌ی `loadedArea.bonfires` (فاصله < 70px) + action text `'REST'` | `src/game/world/NpcInteractionController.ts` | 15 min |
| B5 | GameScene.tryInteract: اضافه‌کردن bonfire branch بعد از lore branch (line 824) → `this.bonfireController.tryInteract(loadedArea, player)` | `src/game/features/scenes/GameScene.ts` | 10 min |
| B6 | GameScene.buildPlay: instantiate `BonfireController` + cleanup در `cleanupPlay` | `src/game/features/scenes/GameScene.ts` | 10 min |
| B7 | (انتقال به Phase D) منوی Continue/Fast Travel/Quit to Hub — فعلاً فقط heal+save+toast کافی است | — | defer |
| B8 | (انتقال به Phase F) Enemy respawn هنگام rest | — | defer |

> **اسکوپ منو (per advisor):** Phase B فقط heal+save+toast پیاده می‌کند. منوی کامل Continue/Fast Travel/Quit to Hub به Phase D موکول می‌شود چون در غیر این صورت منطق با `WorldMapUI` تکرار می‌شود. در Phase D، وقتی `WorldMapUI` برای fast-travel به bonfire‌های lit گسترش پیدا می‌کند، منوی bonfire همان WorldMapUI را باز می‌کند (single source of truth).
>
> **Enemy respawn (per advisor):** به Phase F موکول شد (بعد از Phase E). نسخه‌ی اول Bonfire ساده است: heal+save+light+toast.

**مجموع Phase B:** ~2.25 ساعت

### Phase C — Exit Gate System
**هدف:** انتقال بین Areas با gate فیزیکی + telegraph

> **الگوی معماری:** الگوی **Matter sensor + CollisionController route** در اینجا درست است چون می‌خواهیم auto-trigger با عبور فیزیکی (مثل checkpoint فعلی). اما برای جلوگیری از عبور تصادفی وسط نبرد، 0.5s fade telegraph قبل از travel واقعی اضافه می‌شود.
>
> **مالکیت GameObject (per advisor Note 4):** برخلاف Bonfire (که BonfireController مالک است و LoadedArea.bonfires یک borrowed reference است)، Exit Gate از الگوی Matter-sensor استفاده می‌کند — یعنی باید مثل checkpoint/EMP-door/shortcut، **AreaLoader خودش GameObject را بسازد و در `unload()` destroy کند**. دلیل: Exit Gate یک physics body دارد (Matter sensor) که باید صراحتاً از matter.world.remove شود، درست مثل EMP-door/shortcut (pattern موجود در AreaLoader.unload lines 668-688). هیچ controller جداگانه‌ای برای Exit Gate ساخته نمی‌شود.
>
> **Sensor بودن (per advisor round-5 Note 1, بلاکر):** Exit Gate باید **`isSensor: true`** باشد — یعنی از `physics.addSensor()` استفاده می‌کند (مثل checkpoint trigger فعلی در AreaLoader line 122)، **نه** `physics.addStaticRect()` (که solid است و مسیر را می‌بندد مثل EMP-door/shortcut). تأیید شده در PhysicsSystem.ts line 38-43: `addSensor()` از `isStatic: true, isSensor: true` استفاده می‌کند — یعنی body در world هست اما عبور را مسدود نمی‌کند، فقط `collisionstart` emit می‌کند. اگر اشتباهاً از `addStaticRect()` استفاده شود، بازیکن اصلاً نمی‌تواند از gate رد شود.
>
> **gateTransitioning reset با try/finally (per advisor round-5 Note 2, بلاکر):** `audit-systems-report` مستند کرده که `buildPlay()` در GameScene L590-592 روی missing area early-return می‌کند اما state از قبل 'play' است. `PlayController.build()` هم در line 160 `return null` می‌کند اگر area پیدا نشد. اگر reset `gateTransitioning=false` صرفاً «در انتهای تابع موفق» باشد و `buildPlay()` مقصد early-return کند، کد reset هرگز اجرا نمی‌شود و `gateTransitioning` **برای همیشه true می‌ماند** — یعنی هیچ gate دیگری تا ری‌استارت کامل بازی کار نمی‌کند. راه‌حل: reset در `finally` block (یا معادلش) که حتی در مسیر early-return هم تضمین‌شده اجرا می‌شود.
>
> **Invuln موقت طی fade (per advisor round-5 Note 3, تصمیم صریح):** طبق نکته‌ی debounce، فیزیک Matter در طول `camera.fadeOut(500)` متوقف نمی‌شود — یعنی طی همان نیم‌ثانیه بازیکن هنوز می‌تواند حرکت کند، شلیک کند، یا آسیب ببیند. اگر بازیکن دقیقاً طی این پنجره بمیرد (`PLAYER_DEAD` → `onPlayerDied` → `setState('gameover')`)، `travelTo` معلق روی یک state از قبل 'gameover' اجرا می‌شود → تداخل. راه‌حل: طی شروع fade، `player.invulnUntil = scene.time.now + 600` صدا زده می‌شود (PlayerEntity line 108/327 — الگوی موجود invuln بعد از هر ضربه). 600ms = 500ms fade + 100ms buffer برای safety. این جلوی death طی fade را می‌گیرد. حرکت/شلیک بازیکن هنوز مجاز است (وفادار به حس «عبور از جبهه»)، فقط آسیب‌پذیری مسدود می‌شود.
>
> **Mid-phase checkpoint (per advisor round-5):** بعد از C1+C2 (قبل از C3/C4) یک checkpoint میانی گزارش می‌شود — چون C2 دقیقاً همان نقطه‌ای است که guard/debounce و ارتباطش با CollisionController باید درست از آب دربیاید، و بهتر است قبل از رفتن به بصری‌سازی (C4) این هسته تأیید شود.
>
> **Sequencing: event-driven با FADE_OUT_COMPLETE (per advisor round-6 Q1, BLOCKER):** الگوی **synchronous** (fadeOut + cleanupPlay + buildPlay پشت سرهم) کل هدف telegraph را بی‌اثر می‌کند — تغییر صحنه فوری است، فقط لایه‌ی سیاه رویش کشیده می‌شود، و ممکن است یک فریم overlap بین دنیای قدیم (در حال destroy) و جدید (در حال build) دیده شود. الگوی درست: `camera.fadeOut(500)` شروع می‌شود، سپس `camera.once(FADE_OUT_COMPLETE, callback)` ثبت می‌شود که فقط بعد از سیاه شدن کامل صفحه اجرا می‌شود. این الگو با الگوی موجود خودتان در `onPlayerDied` (fadeOut 700 + `scheduleDelayed(900, ...)` برای setState('gameover')) و `onBossDied` (fadeOut 600 + `scheduleDelayed(700, ...)`) هماهنگ است — فقط به‌جای `scheduleDelayed` از `camera.once` استفاده می‌کنیم که event-driven است (به‌جای time-based). `FADE_OUT_COMPLETE` در Phaser 4 موجود است (verified in `node_modules/phaser/types/phaser.d.ts` line 5068).
>
> **`gateTransitioning` location (per advisor round-6 Q2, پاسخ صریح):** flag در **GameScene** زندگی می‌کند (نه CollisionController). دلیل: CollisionController طبق `AGENT_GUIDE.md` فقط routing است — state نباید نگه دارد. این الگو با `togglePause` (که هم در GameScene است) هماهنگ است. در C1+C2 پیاده‌سازی شد: `private gateTransitioning = false` در GameScene line 185، و `handleExitGate` در GameScene این flag را چک/ست/ریست می‌کند.
>
> **Input lock طی fade (per advisor round-6 Note 4):** طی پنجره‌ی 500ms fade، `InputSystem.setGameplayBlocked(true)` صدا زده می‌شود — این تمام gameplay callbacks (jump/fire/melee/dash/interact/grapple/emp/pause) را مسدود می‌کند (InputSystem.ts line 294). این جلوی این را می‌گیرد که بازیکن طی fade با یک bonfire مجاور تعامل کند یا وارد gate دیگری شود. `setGameplayBlocked(false)` در `finally` block همراه با `gateTransitioning = false` ریست می‌شود. الگوی موجود است (برای pause استفاده می‌شود) — صفر کد جدید برای این منطق.

| # | کار | فایل‌ها | زمان |
|---|-----|--------|------|
| C1 ✅ | AreaLoader: ساخت exit gate GameObjects (طاق + نور آمبر) با **`physics.addSensor()`** (نه `addStaticRect`) در `loadArea()`. **مالکیت: AreaLoader** (build + destroy در unload، مثل EMP-door/shortcut). **`isSensor: true`** تأیید شده — gate مسیر را مسدود نمی‌کند، فقط collisionstart emit می‌کند (مثل checkpoint trigger فعلی). | `src/game/world/AreaLoader.ts` | 30 min |
| C2 ✅ | CollisionController: اضافه‌کردن `onExitGate?: (gateData) => void` به `CollisionRoutes` + dispatch detection (مثل onSection/onCheckpoint pattern). **`gateTransitioning` flag در GameScene** زندگی می‌کند (نه CollisionController) — controller فقط routing است، state در GameScene (مثل togglePause، per advisor). | `src/game/controllers/CollisionController.ts` + `src/game/features/scenes/GameScene.ts` | 20 min |
| C5 ( reordered BEFORE C3 — per advisor round-6 Note 3 ) | AudioSystem: اضافه‌کردن `'gate_travel'` به SfxName union type + SFX_REGISTRY (sweep down, sine, vol 0.3, dur 0.5). **باید قبل از C3 انجام شود** تا وقتی C3 این کلید را صدا می‌زند واقعاً صدا پخش شود — وگرنه همان الگوی باگ TOAST تکرار می‌شود (AudioSystem.play بی‌صدا return می‌کند). | `src/game/systems/AudioSystem.ts` | 10 min |
| C3 | GameScene.handleExitGate full implementation (replaces stub):
  1. اگر `gateTransitioning=true` → return (debounce, در stub فعلی تأیید شده).
  2. `gateTransitioning=true` + `InputSystem.setGameplayBlocked(true)` (input lock طی fade، per advisor round-6 Note 4).
  3. `player.invulnUntil = scene.time.now + 600` (temp invuln طی fade).
  4. `AudioSystem.play('gate_travel')` (به‌خاطر C5 قبل از C3، این کلید اکنون موجود است).
  5. `camera.fadeOut(500, 5, 7, 13)` — شروع telegraph بصری.
  6. **`camera.once(FADE_OUT_COMPLETE, ...)`** — event-driven sequencing (per advisor round-6 Q1, BLOCKER):
     ```
     camera.once(FADE_OUT_COMPLETE, () => {
       try {
         WorldSystem.travelTo(toAreaId, toSection)
         SaveSystem.lightBonfire(getEntryBonfireId(toAreaId))
         cleanupPlay()
         buildPlay()
         camera.fadeIn(300, 5, 7, 13)
       } finally {
         gateTransitioning = false
         InputSystem.setGameplayBlocked(false)
       }
     })
     ```
  این الگو تضمین می‌کند دنیای قدیمی فقط بعد از سیاه شدن کامل صفحه destroy می‌شود (نه هم‌زمان با fade start). الگوی synchronous باعث می‌شد تغییر صحنه فوری باشد و فقط لایه‌ی سیاه رویش کشیده شود — کل هدف telegraph بی‌اثر می‌شد. الگوی event-driven با `FADE_OUT_COMPLETE` در Phaser 4 موجود است (verified in phaser.d.ts line 5068). | `src/game/features/scenes/GameScene.ts` | 75 min |
| C4 | بصری‌سازی gate (Graphics: طاق + نور) در AreaLoader.createExitGate() — در C1 انجام شد. C4 فقط بصری‌سازی telegraph (camera fade-out + flash) در GameScene را اضافه می‌کند، که در C3 داخل `handleExitGate` گنجانده می‌شود. پس C4 به‌عنوان task جداگانه حذف می‌شود — بصری‌سازی telegraph در C3 کامل می‌شود. | — | merged into C3 |
| C6 (optional) | گسترش `validate-section-bounds.ts` (یا validator خواهر): چک کند هر `exitGate.toAreaId` واقعاً در دیتای Acts موجود است و `toSection` داخل رنج معتبر آن Area است. (per advisor round-5 Note 4 پیشگیرانه) | `scripts/validate-section-bounds.ts` | 15 min |

> **preLit policy enforcement (per A3-followup + advisor Note 2):** C3 وقتی gate crossing رخ می‌دهد، `SaveSystem.lightBonfire()` را برای entry bonfire مقصد صدا می‌زند. **شناسایی entry bonfire مقصد از طریق فیلد صریح `BonfireData.isEntryPoint?: boolean` است** (نه قرارداد نام‌گذاری `bf_X_1` یا ایندکس آرایه). تابع helper `getEntryBonfireId(areaId)` در AreaData پیدا می‌کند. این جلوی یک باگ خاموش در Act II/III را می‌گیرد که فقط با بازی دستی کشف می‌شود (همان کلاس باگ TOAST).
>
> **Debounce guard (per advisor Note 1, بلاکر واقعی):** طبق `audit-systems-report`، GameScene togglePause متد matter.world.pause() را صدا نمی‌زند — یعنی فیزیک Matter در طول camera.fadeOut(500) متوقف نمی‌شود. اگر بازیکن حین عبور از gate نوسان کند یا knockback بخورد، Matter می‌تواند چندین collisionstart جداگانه طی همان نیم‌ثانیه بفرستد → WorldSystem.travelTo() دو بار صدا زده شود → cleanupPlay وسط buildPlay نیمه‌کاره (state corruption). راه‌حل: flag `gateTransitioning: boolean` در GameScene که اولین collisionstart آن را true می‌کند و هر collision بعدی تا پایان travel کامل نادیده گرفته می‌شود (**reset به false در `finally` block** — نه «انتهای تابع موفق» — تا حتی اگر buildPlay early-return کند هم reset شود، per advisor round-5 Note 2). شبیه همان debounce 200ms که برای togglePause قبلاً داشتیم.
>
> **AudioSystem (per advisor Note 3 + round-6 Note 3, REORDERED):** کلید صدای `'gate_travel'` در AudioSystem وجود ندارد (verified via grep — تنها SFX موجود: fire/melee/weaponSwitch/dash/jump/doubleJump/hit/explosion/enemyHit/bossHit/bossDeath/playerDeath/phaseChange/uiClick/uiHover/checkpoint/levelUp/skillUnlock/victory). اگر بدون اضافه‌کردن به SFX_REGISTRY صدا زده شود، AudioSystem.play به‌صورت خاموش return می‌کند (line 231: `if (!def) return;`) — دقیقاً همان الگوی TOAST bug. **C5 قبل از C3 انجام می‌شود** (نه بعد) تا وقتی C3 این کلید را صدا می‌زند واقعاً صدا پخش شود — وگرنه همان الگوی باگ TOAST تکرار می‌شود و فکر می‌کنید C3 کار می‌کند چون هیچ خطایی نمی‌بینید.

**مجموع Phase C:** ~3 ساعت (افزایش به‌خاطر try/finally + invuln + mid-checkpoint + optional C6)

### Phase D — World Map Update
**هدف:** Fast travel به bonfire‌های lit شده

| # | کار | فایل‌ها | زمان |
|---|-----|--------|------|
| D1 | WorldSystem.travelTo: اضافه‌کردن bonfireId parameter | WorldSystem.ts | 15 min |
| D2 | WorldMapSystem: getBonfiresForArea() | WorldMapSystem.ts | 30 min |
| D3 | WorldMapUI: نمایش bonfire‌های lit به‌عنوان sub-nodes | WorldMapUI.ts | 60 min |
| D4 | HubBuilder: به‌روزرسانی برای area‌های جدید | HubBuilder.ts | 30 min |

**مجموع Phase D:** ~2 ساعت

### Phase E — Cleanup + Polish
**هدف:** رفع مشکلات + تست

| # | کار | فایل‌ها | زمان |
|---|-----|--------|------|
| E1 | رفع `getRespawnPosition` fallback (خواندن از area data) | CheckpointSystem.ts | 15 min |
| E2 | رفع `isBossInAreaDefeated` (per-boss tracking به‌جای count) | WorldMapSystem.ts, SaveSystem.ts | 30 min |
| E3 | بررسی enemy culling با areas کوچک‌تر (benchmark) | PlayController.ts | 30 min |
| E4 | Localization: نام bonfire‌ها + exit gate labels | en.json, fa.json | 30 min |
| E5 | Migration: تمام area ID‌های قدیمی → جدید | SaveSystem.ts | 30 min |
| E6 | **رفع `continueCurrentProfile()` bug** — متد `SaveSystem.selectSlot()` را صدا نمی‌زند، به ProfileManager.init() تکیه می‌کند که `GLOBAL_KEY_SELECTED_SLOT` را از IndexedDB می‌خواند. وقتی این global به slot اشتباه اشاره می‌کند، SaveSystem تنظیمات پیش‌فرض (locale='en') را load می‌کند. کشف شده در browser test Phase B. | GameScene.ts | 15 min |
| E7 | تست کامل: ورود به هر area → bonfire → gate → area بعدی | Manual | 60 min |

**مجموع Phase E:** ~3.25 ساعت

### Phase F — Enemy Respawn at Bonfire Rest (per advisor Point 2)
**هدف:** دشمنان area هنگام rest در bonfire respawn شوند (به‌جز boss/mini-boss)

> **تصمیم طراحی لازم قبل از اجرا:**
> - آیا mini-boss هم respawn نشود؟
> - آیا لوت جمع‌شده (collectibles) دوباره ظاهر شود؟
> - چه اتفاقی برای دشمنانی که player همین الان دارد با آن‌ها می‌جنگد می‌افتد اگر بی‌احتیاط نزدیک bonfire استراحت کند؟
> - هماهنگی با `TargetRegistry` (پاک‌سازی enemy state قدیمی) و `spawnEnemiesForSection` (rebuild از `AreaData.enemies`)

| # | کار | فایل‌ها | زمان |
|---|-----|--------|------|
| F1 | تصمیم طراحی: تعریف scope دقیق respawn (killed/loot/mini-boss) | doc | 30 min |
| F2 | پیاده‌سازی respawn logic در BonfireController.tryInteract | BonfireController.ts | 60 min |
| F3 | تست: respawn در همه‌ی areas (factory_1/2/3) | Manual | 30 min |

**مجموع Phase F:** ~2 ساعت

### **مجموع کل:** ~15.5 ساعت (Phase A 4h + B 2.25h + C 2h + D 2h + E 3h + F 2h)

---

## ۶) Preservation List (چه چیزی دست نمی‌خورد)

- ❌ Strategy pattern (Factory/Forest/Wastes/City)
- ❌ SaveSystem v4 architecture (IndexedDB + cache + dirty flag)
- ❌ VisualCuller (setVisible for off-screen objects)
- ❌ PerformanceOverlay (F3)
- ❌ Player abilities (doubleJump, wallJump, grapple, hover, EMP, hack)
- ❌ Combat system (posture, stagger, hit-stop)
- ❌ Boss sequential attack pattern (Iron Magistrate)
- ❌ All existing lore objects + landmarks + collectibles
- ❌ Localization system (en + fa)
- ❌ AudioSystem (procedural Web Audio)

---

## ۷) Acceptance Criteria

- [ ] هر Act حداقل ۲ Area دارد
- [ ] هر Area حداقل ۱ bonfire دارد
- [ ] Bonfire با فشردن **E** کار می‌کند (heal + save + toast) — نه J
- [ ] پرامپت شناور `[E] REST` نزدیک bonfire نمایش داده می‌شود (الگوی NPC، بدون Matter sensor)
- [ ] فقط یک پرامپت همزمان روی صفحه — حتی اگر bonfire نزدیک NPC/Lore باشد (unified nearest-check)
- [ ] ظاهر bonfire هنگام بارگذاری area با SaveSystem.isBonfireLit() هماهنگ است (syncLitState، مثل hidePreCollectedItems)
- [ ] Enemy respawn **در نسخه‌ی اولیه نیست** (deferred to Phase F)
- [ ] Exit gate بین areas هم‌اکت کار می‌کند (با 0.5s fade telegraph قبل از travel)
- [ ] عبور از exit gate به‌طور خودکار entry bonfire مقصد را روشن می‌کند (preLit policy)
- [ ] Fast travel به bonfire‌های lit از World Map کار می‌کند
- [ ] باس هر اکت فقط در آخرین Area است
- [ ] Duplicate boss ID رفع شده
- [ ] Migration برای save data قدیمی کار می‌کند
- [ ] FPS ≥ 45 در تمام areas (با areas کوچک‌تر)
- [ ] tsc 0 errors
- [ ] 0 console errors
