# MECHA: LAST PROTOCOL — Performance Optimization Plan

> **تاریخ:** 2026-07-24
> **وضعیت:** پیش‌نویس برای مشاور پروژه
> **هدف:** بستن شکاف 45→60 FPS در Act II بدون فدا کردن کیفیت بصری یا کد

---

## ۱) وضعیت فعلی (verified against HEAD = `5303911`)

### آنچه کار می‌کند ✅
| سیستم | وضعیت | تأثیر |
|------|-------|------|
| **VisualCuller** (`setVisible(false)` + tween pausing) | فعال، هر 250ms، margin 300px | 30 → 45 FPS |
| **Physics culling** (`body.isSleeping`) | فعال، هر 500ms، margin 200px | کاهش load فیزییک |
| **TweenManager FPS cap** (`setFps(60)`) | فعال | 4× کاهش CPU توین‌ها |
| **Bounding-box test برای platforms** | فعال (`__cullW/__cullH`) | حفظ زمین در محدوده دوربین |
| **Strategy pattern** (Factory/Forest/Wastes) | تمیز | معماری قابل توسعه |

### آنچه هنوز مشکل دارد ⚠️

#### A. شکاف FPS (15 فریم باقی‌مانده)

| # | عامل | تخمین تأثیر |
|---|------|------------|
| 1 | **~250 توین فعال دائمی** که هرگز pause نمی‌شوند (parallax/atmosphere/entity tweens) | 5-8 FPS |
| 2 | **`getTweensOf()` با هزینه O(N×M)** هنگام scroll — ~30-50 flip همزمان | 2-5 FPS (intermittent hitches) |
| 3 | **Generic Far/Mid/Near parallax layers برای Wastes** که توسط commit `35f2a03` revert شدند | 3-5 FPS |
| 4 | **40 ذره‌ی atmosphere + 11 توین آن** که همیشه update می‌شوند | 2-3 FPS |
| 5 | **`[...solids, ...hazards, ...sections]` allocation** هر 500ms + GC churn | 0.5-1 FPS |

#### B. باگ‌های کشف‌شده (correctness)

| # | باگ | محل | خطر |
|---|-----|-----|------|
| B1 | **Hazard visuals بدون setSize** — wide lava pits (200-300px) با center-point test cull می‌شوند | `WastesAreaStrategy.createHazardVisual` + Factory + Forest | متوسط (visual pop) |
| B2 | **Section 9 out-of-bounds objects** — چند object با x > 13824 (در قلمرو section 10) قرار دارند | `acts.ts:508-519` | پایین (level design) |
| B3 | **`time.now % 200 < 16` برای ambient dust** — همان باگ که برای culler fix شد، اینجا اعمال نشده | `PlayController.ts:337` | متوسط (correctness) |
| B4 | **`QualityManager.fpsTarget` هرگز اعمال نمی‌شود** — روی `game.loop.targetFps` ست نمی‌شود | `QualityManager.ts` | پایین (feature نیمه‌تمام) |

#### C. بدهی فنی (tech debt)

| # | مورد | تأثیر |
|---|------|------|
| C1 | **سه رویکرد مختلف برای cull dimensions:** `setData('__cullW')` (Graphics)، `setSize()` (Containers)، نه‌یکی (hazards — باگ) | ناسازگاری، پنهان کردن باگ |
| C2 | **`visualRects` typed as `Rectangle[]` اما heterogeneous GameObjects دارد** — هر push با `as unknown as Rectangle` | type-safety smell |
| C3 | **Worklog stale** — claims Wastes cleanup applied، اما HEAD آن را revert کرده | اشتباه در تصمیم‌گیری |
| C4 | **`AtmosphereSystem.rayTime` dead field** — increment می‌شود اما خوانده نمی‌شود | dead code |
| C5 | **`body.isSleeping = true` مستقیم** به‌جای `Matter.Body.setSleeping()` | undocumented escape hatch |

---

## ۲) برنامه‌ی مرحله‌بندی‌شده

### 🟢 Stage 1 — Quick Wins (کم‌خطر، تأثیر متوسط، ~1 ساعت)

> این‌ها **pure correctness fixes** هستند. ریسک صفر. قبل از هر چیز اجرا می‌شوند تا noise حذف شود و اندازه‌گیری Stage 2 تمیز باشد.

| # | کار | فایل‌ها | زمان | ریسک | FPS gain |
|---|-----|--------|------|------|----------|
| 1.1 | اضافه‌کردن `container.setSize(hazard.w, hazard.h)` به `createHazardVisual` در هر 3 استراتژی | WastesAreaStrategy, FactoryAreaStrategy, ForestAreaStrategy | 10 min | Low | +0.5 (correctness) |
| 1.2 | جایگزینی `[...solids, ...hazards, ...sections]` با 3 حلقه‌ی متوالی در `runCulling` | PlayController.ts:472-491 | 10 min | Low | +0.5 (GC) |
| 1.3 | Fix `time.now % 200 < 16` برای ambient dust → accumulator | PlayController.ts:337 | 10 min | Low | ~0 (correctness) |
| 1.4 | حذف dead field `AtmosphereSystem.rayTime` + aspirational comment | AtmosphereSystem.ts:47, 237 | 5 min | Low | 0 |
| 1.5 | جایگزینی `body.isSleeping = true` با `Matter.Body.setSleeping(body, true)` | PlayController.ts:487-490 | 10 min | Low | ~0 (safer) |
| 1.6 | Fix section 9 out-of-bounds objects (یا منتقل کن یا به‌عنوان intentional مستند کن) | acts.ts:508-519 | 15 min | Low | 0 |

**مجموع Stage 1:** ~1 ساعت | **FPS gain:** ~1 FPS (عمدتاً correctness + GC)

#### 🔒 Preservation List برای Stage 1:
- ❌ دست‌نزدن به VisualCuller core algorithm
- ❌ دست‌نزدن به tween creation patterns
- ❌ دست‌نزدن به Parallax/Atmosphere structure
- ❌ دست‌نزدن به QualityManager (Stage 2)
- ❌ دست‌نزدن به Strategy pattern

---

### 🟡 Stage 2 — Medium Refactors (متوسط‌خطر، تأثیر بالا، ~4-5 ساعت)

> این‌ها **real FPS gains** هستند. پس از تأیید Stage 1 با تست اجرا می‌شوند.

| # | کار | فایل‌ها | زمان | ریسک | FPS gain |
|---|-----|--------|------|------|----------|
| 2.1 | **TweenRegistry** — `WeakMap<GameObject, Tween[]>` برای cache کردن توین‌ها بر target. جایگزینی `getTweensOf()` با O(1) lookup | New: `TweenRegistry.ts`. Modified: VisualCuller, AreaLoader, ParallaxBackground, AtmosphereSystem | 2 hours | Medium | +3-5 FPS |
| 2.2 | **Re-apply Wastes visual cleanup** (commit `327e732` دوباره) — disable Generic Far/Mid/Near + depth haze + sky tint + 5 fog bands برای Wastes. بک‌گراند نقاشی‌شده این‌ها را پوشش می‌دهد | ParallaxBackground, AtmosphereSystem, WastesAreaStrategy | 1 hour | Low (proven pattern) | +3-5 FPS |
| 2.3 | **Wire QualityManager به VisualCuller** — `CULL_INTERVAL_MS` و `VIEWPORT_MARGIN` از quality config خوانده شود. Low: 500ms/150px، High: 250ms/300px | QualityManager, VisualCuller | 30 min | Low | +2-3 FPS (Low quality) |
| 2.4 | **Cull metroidvania checks by camera distance** — skip اگر `Math.abs(obj.x - player.x) > 800` | MetroidvaniaController | 30 min | Low | +1-2 FPS |
| 2.5 | **Unify cull-dimension API** — helper `setCullDimensions(go, w, h)` که بر اساس type (`setSize` یا `setData`) تصمیم می‌گیرد | New: `CullUtils.ts` یا در AreaLoader | 30 min | Low | 0 (cleanliness) |

**مجموع Stage 2:** ~4-5 ساعت | **FPS gain:** ~6-10 FPS (هدف: 60 FPS پایدار)

#### 🔒 Preservation List برای Stage 2:
- ❌ دست‌نزدن به bounding-box test logic در VisualCuller
- ❌ دست‌نزدن به Container child iteration برای tween pausing
- ❌ دست‌نزدن به static-update architecture در PlayController
- ❌ دست‌نزدن به Strategy pattern
- ❌ دست‌نزدن به Save/profile/IndexedDB systems

---

### 🔴 Stage 3 — Architectural (خطر بالا، تأثیر بالا، 5+ روز)

> فقط در صورت نیاز برای Acts بزرگ‌تر (III, IV, V). فعلاً صبر.

| # | کار | زمان | ریسک |
|---|-----|------|------|
| 3.1 | **Tile-based spatial index** برای culling (grid bucket به‌جای linear scan) | 1 day | Medium-High |
| 3.2 | **Typed unions برای visualRects** (حذف `as unknown as Rectangle` casts) | 4 hours | Medium |
| 3.3 | **Object pooling برای decorations** (streaming world) | 1 day | High |
| 3.4 | **`CullableComponent`** برای decouple کردن VisualCuller از `scene.tweens` | 1 day | High |
| 3.5 | **Section-by-section streaming** (load ±2 sections به‌جای کل Act) | 2+ days | High (fundamental change) |

**مجموع Stage 3:** 5+ روز | **FPS gain:** +5-10 FPS (و مقیاس‌پذیری برای Acts بزرگ‌تر)

---

## ۳) کارهای مستندسازی (Documentation)

| # | کار | فایل | زمان |
|---|-----|------|------|
| D1 | اضافه‌کردن section "Culling Parameters" به `GAME_VARIABLES.md` (CULL_INTERVAL_MS, VIEWPORT_MARGIN, __cullW/__cullH convention) | GAME_VARIABLES.md | 20 min |
| D2 | به‌روزرسانی worklog با "Current State vs HEAD" reconciliation — ذکر اینکه commit `35f2a03` cleanup را revert کرد | worklog.md | 15 min |
| D3 | مستندسازی Stage 2.2 (Wastes cleanup) با تصمیم‌گیری واضح: "بک‌گراند نقاشی‌شده این overlayها را پوشش می‌دهد، پس غیرفعال می‌شوند" | ParallaxBackground.ts comments | 10 min |
| D4 | اضافه‌کردن README برای `VisualCuller.ts` (الگوریتم، cost، محدودیت‌ها) | VisualCuller.ts header | 15 min |

---

## ۴) کارهای تست (Testing)

| # | تست | چرا |
|---|------|-----|
| T1 | **VisualCuller unit test** — visibility true/false بر اساس camera worldView | foundation برای هر optimization آینده |
| T2 | **Bounding-box culling test** — wide platform ناپدید نشود وقتی center off-screen است اما edge در viewport است | regression guard برای باگ 5303911 |
| T3 | **Hazard culling test** — wide lava pit با setSize | regression guard برای Stage 1.1 |
| T4 | **Tween pause/resume test** — Container با 3 child tween، بعد از cull، همه pause شوند | correctness برای Stage 2.1 |
| T5 | **runCulling body sleeping test** — solid در فاصله، isSleeping=true | correctness برای physics culling |
| T6 | **Quality manager integration test** — Low quality → CULL_INTERVAL=500ms | correctness برای Stage 2.3 |
| T7 | **Section 9 bounds test** — هیچ object با x > section.x + sectionWidth | regression guard برای باگ 1.6 |

---

## ۵) معیار پذیرش (Acceptance Criteria)

پس از اجرای Stage 1 + Stage 2، بازی باید:

- ✅ **FPS ≥ 55 پایدار** در Act II Wastes (با تمام افکت‌های فعال)
- ✅ **هیچ pop-in بصری** هنگام scroll (platforms، hazards، lore objects همگی visible تا وقتی fully off-screen هستند)
- ✅ **هیچ frame hitch > 50ms** هنگام scroll نرم
- ✅ **Quality Low** → FPS ≥ 30 روی دستگاه‌های ضعیف
- ✅ **0 TypeScript errors** در `src/game/`
- ✅ **0 console errors** در browser
- ✅ **تمام تست‌های T1-T7** pass شوند

---

## ۶) ترتیب اجرای پیشنهادی

```
Day 1 (امروز):
  ├── [30 min] Stage 1.1-1.6 (correctness fixes)
  ├── [20 min] D1+D2 (مستندسازی)
  ├── [30 min] تست دستی + VLM verification
  └── [ ] Gate: تأیید FPS ≥ 47 (باید ~1 FPS بیشتر از فعلی باشد)

Day 2:
  ├── [2 hours] Stage 2.1 (TweenRegistry)
  ├── [1 hour] Stage 2.2 (Wastes cleanup re-apply)
  ├── [30 min] Stage 2.3 (QualityManager wiring)
  ├── [30 min] Stage 2.4-2.5
  ├── [20 min] D3+D4
  └── [ ] Gate: تأیید FPS ≥ 55

Day 3 (اختیاری):
  ├── [4 hours] T1-T7 (تست‌ها)
  └── [ ] Gate: تمام تست‌ها pass
```

---

## ۷) سؤالات برای مشاور

1. **آیا Stage 2.2 (Wastes cleanup re-apply) مورد تأیید است؟** این کار Generic Far/Mid/Near + depth haze + sky tint + 5 fog bands را برای Wastes غیرفعال می‌کند. کاربر قبلاً خواستار فعال‌سازی مجدد fog بود، اما تحلیل نشان می‌دهد این لایه‌ها 3-5 FPS هزینه دارند و با بک‌گراند نقاشی‌شده پوشانده می‌شوند.

2. **آیا Stage 2.1 (TweenRegistry) با معماری فعلی PlayController (static update) سازگار است؟** نیاز به wrapper دارد که روی `scene.tweens.add` hook شود.

3. **آیا Stage 3 (spatial grid) برای این فاز ضروری است، یا به Acts آینده موکول شود؟** فعلاً Stage 1+2 کافی به نظر می‌رسد.

4. **اولویت تست‌ها (T1-T7) چگونه است؟** آیا باید قبل از Stage 2 نوشته شوند (TDD) یا بعد از آن (regression)?

5. **آیا برنامه‌ی مستندسازی (D1-D4) کافی است یا نیاز به architecture diagram رسمی هست؟**

---

## ۸) خلاصه‌ی تصمیم‌گیری

| تصمیم | توضیح |
|------|------|
| **توقف آزمون‌وخطا** | ۵ commit آخر از نوع test/revert/fix بود — الگوی ناسالم |
| **اول correctness، بعد optimization** | Stage 1 قبل از Stage 2 — تا اندازه‌گیری تمیز باشد |
| **حفاظت از کد موجود** | Preservation list برای هر stage — دست‌نزدن به کارهای درست |
| **اندازه‌گیری قبل و بعد** | F3 PerformanceOverlay + VLM screenshot قبل و بعد از هر stage |
| **مستندسازی همزمان** | هر stage با مستنداتش commit شود — نه بعداً |
