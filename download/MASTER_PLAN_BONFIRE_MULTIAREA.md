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
- دشمنان area respawn می‌شوند (به‌جز boss/mini-boss)

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

> **الگوی معماری:** BonfireController دو متد دارد:
> - `updatePrompt(loadedArea, player)` — per-frame از `PlayController.update()` صدا زده می‌شود (مثل `npcInteraction.updatePrompt`). پرامپت شناور `[E] REST` نمایش/پنهان می‌کند.
> - `tryInteract(loadedArea, player)` — از `GameScene.tryInteract()` صدا زده می‌شود (بعد از NPC/Lore branches). اگر player نزدیک bonfire باشد، heal+save+light+toast انجام می‌دهد.
>
> **هیچ Matter sensor، هیچ CollisionController route، هیچ cleanup در unload() لازم نیست.**
> این الگو دقیقاً همان NpcInteractionController/MetroidvaniaController است.

| # | کار | فایل‌ها | زمان |
|---|-----|--------|------|
| B1 | ساخت `BonfireController.ts`: `spawnBonfires(areaId)` + `updatePrompt(loadedArea, player)` + `tryInteract(loadedArea, player)` (heal+save+light+toast) + `cleanup()` | New: `src/game/controllers/BonfireController.ts` | 60 min |
| B2 | AreaLoader: ساخت bonfire GameObjects (آمبر terminal + glow container) در `loadArea()` — **بدون** Matter sensor | `src/game/world/AreaLoader.ts` | 30 min |
| B3 | PlayController.update: اضافه‌کردن `r.bonfire?.updatePrompt(r.loadedArea, r.player)` بعد از `npcInteraction.updatePrompt` (خط ۳۴۷) | `src/game/controllers/PlayController.ts` | 5 min |
| B4 | GameScene.tryInteract: اضافه‌کردن bonfire branch بعد از lore branch (خط ۸۲۴) | `src/game/features/scenes/GameScene.ts` | 10 min |
| B5 | GameScene.buildPlay: instantiate `BonfireController` + cleanup در `cleanupPlay` | `src/game/features/scenes/GameScene.ts` | 10 min |
| B6 | (انتقال به Phase D) منوی Continue/Fast Travel/Quit to Hub — فعلاً فقط heal+save+toast کافی است | — | defer |

> **اسکوپ منو (per advisor):** Phase B فقط heal+save+toast پیاده می‌کند. منوی کامل Continue/Fast Travel/Quit to Hub به Phase D موکول می‌شود چون در غیر این صورت منطق با `WorldMapUI` تکرار می‌شود. در Phase D، وقتی `WorldMapUI` برای fast-travel به bonfire‌های lit گسترش پیدا می‌کند، منوی bonfire همان WorldMapUI را باز می‌کند (single source of truth).

**مجموع Phase B:** ~2 ساعت

### Phase C — Exit Gate System
**هدف:** انتقال بین Areas با gate فیزیکی + telegraph

> **الگوی معماری:** الگوی **Matter sensor + CollisionController route** در اینجا درست است چون می‌خواهیم auto-trigger با عبور فیزیکی (مثل checkpoint فعلی). اما برای جلوگیری از عبور تصادفی وسط نبرد، 0.5s fade telegraph قبل از travel واقعی اضافه می‌شود.

| # | کار | فایل‌ها | زمان |
|---|-----|--------|------|
| C1 | AreaLoader: ساخت exit gate GameObjects (طاق + نور آمبر) با Matter sensor در `loadArea()` | `src/game/world/AreaLoader.ts` | 30 min |
| C2 | CollisionController: اضافه‌کردن `onExitGate?: (gateId, toAreaId, toSection, toX, toY) => void` به `CollisionRoutes` + dispatch detection (مثل onSection/onCheckpoint pattern) | `src/game/controllers/CollisionController.ts` | 15 min |
| C3 | GameScene: wire `collision.routes.onExitGate` → شروع 0.5s fade telegraph + بعد از fade: `WorldSystem.travelTo(toAreaId, toSection)` + `SaveSystem.lightBonfire(<entry bonfire of destination>)` + cleanupPlay + buildPlay | `src/game/features/scenes/GameScene.ts` | 45 min |
| C4 | بصری‌سازی gate (Graphics: طاق + نور) + بصری‌سازی telegraph (camera fade-out + flash) + صدا (`AudioSystem.play('gate_travel')`) | `src/game/world/AreaLoader.ts` یا Strategy + AudioSystem | 30 min |

> **preLit policy enforcement (per A3-followup):** C3 وقتی gate crossing رخ می‌دهد، `SaveSystem.lightBonfire()` را برای entry bonfire مقصد صدا می‌زند. این single source of truth است — نه یک flag دستی static در داده‌ها.

**مجموع Phase C:** ~2 ساعت

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
| E6 | تست کامل: ورود به هر area → bonfire → gate → area بعدی | Manual | 60 min |

**مجموع Phase E:** ~3 ساعت

### **مجموع کل:** ~13.5 ساعت

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
- [ ] Exit gate بین areas هم‌اکت کار می‌کند (با 0.5s fade telegraph قبل از travel)
- [ ] عبور از exit gate به‌طور خودکار entry bonfire مقصد را روشن می‌کند (preLit policy)
- [ ] Fast travel به bonfire‌های lit از World Map کار می‌کند
- [ ] باس هر اکت فقط در آخرین Area است
- [ ] Duplicate boss ID رفع شده
- [ ] Migration برای save data قدیمی کار می‌کند
- [ ] FPS ≥ 45 در تمام areas (با areas کوچک‌تر)
- [ ] tsc 0 errors
- [ ] 0 console errors
