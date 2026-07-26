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
```
Player walks near bonfire → prompt "▼ REST" appears
Player presses J (interact key) → 
  1. refillRepair() (heal HP + energy)
  2. SaveSystem.saveCheckpoint({x: bonfire.x, y: bonfire.y, section: bonfire.section})
  3. bonfire.isLit = true → SaveSystem.lightBonfire(bonfire.id)
  4. Show quick-menu: "Continue / Fast Travel / Quit to Hub"
```

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
- فیزیک: Matter sensor (مثل checkpoint trigger)
- وقتی player از آن عبور می‌کند: `WorldSystem.travelTo(toAreaId, toSection)` + auto-checkpoint
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
**هدف:** پیاده‌سازی مکانیک Bonfire

| # | کار | فایل‌ها | زمان |
|---|-----|--------|------|
| B1 | ساخت `BonfireController.ts` (interact, light, refill, menu) | New: BonfireController.ts | 90 min |
| B2 | AreaLoader: ساخت bonfire GameObjects + sensors | AreaLoader.ts | 45 min |
| B3 | CollisionController: route `onBonfire` | CollisionController.ts | 15 min |
| B4 | GameScene: wire onBonfire → BonfireController | GameScene.ts | 15 min |
| B5 | حذف checkpoint triggers قدیمی (جایگزین با bonfire) | AreaLoader.ts | 15 min |
| B6 | SaveSystem: `lightBonfire()`, `isBonfireLit()`, `getLitBonfires()` | SaveSystem.ts | 15 min |

**مجموع Phase B:** ~3 ساعت

### Phase C — Exit Gate System
**هدف:** انتقال بین Areas با gate فیزیکی

| # | کار | فایل‌ها | زمان |
|---|-----|--------|------|
| C1 | AreaLoader: ساخت exit gate sensors | AreaLoader.ts | 30 min |
| C2 | CollisionController: route `onAreaExit` | CollisionController.ts | 15 min |
| C3 | GameScene: wire onAreaExit → WorldSystem.travelTo + cleanupPlay + buildPlay | GameScene.ts | 30 min |
| C4 | بصری‌سازی gate (Graphics: طاق + نور) | AreaLoader.ts یا Strategy | 30 min |

**مجموع Phase C:** ~1.5 ساعت

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
- [ ] Bonfire با فشردن J کار می‌کند (heal + save)
- [ ] Exit gate بین areas هم‌اکت کار می‌کند
- [ ] Fast travel به bonfire‌های lit از World Map کار می‌کند
- [ ] باس هر اکت فقط در آخرین Area است
- [ ] Duplicate boss ID رفع شده
- [ ] Migration برای save data قدیمی کار می‌کند
- [ ] FPS ≥ 45 در تمام areas (با areas کوچک‌تر)
- [ ] tsc 0 errors
- [ ] 0 console errors
