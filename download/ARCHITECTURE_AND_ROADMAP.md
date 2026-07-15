# MECHA: LAST PROTOCOL — معماری و نقشه راه

**نسخه:** v4 (به‌روزرسانی شده)
**تاریخ:** 2026-07-10

## معماری فعلی

### ساختار Feature-Based

```
src/game/
├── PhaserGame.ts              # پیکربندی Phaser (WebGL 2.0, Matter.js)
├── shared/                    # ماژول‌های مشترک بین همه features
│   ├── Constants.ts           # مقادیر tuning (HP, سرعت, damage, colors)
│   ├── EventBus.ts            # pub/sub غیرهمزمان
│   ├── Types.ts               # تایپ‌های مشترک
│   ├── SaveManager.ts         # checkpoint + best time (localStorage)
│   ├── SkillTree.ts           # ۱۲ مهارت در ۳ دسته (combat/mobility/survival)
│   ├── GamepadManager.ts      # HTML5 Gamepad API polling
│   ├── AudioManager.ts        # Web Audio procedural SFX + music
│   └── AssetGenerator.ts      # تولید بک‌گراند procedural با Canvas API
└── features/                  # هر پوشه یک Feature مستقل
    ├── physics/
    │   ├── PhysicsWorld.ts    # wrapper حول Matter.js
    │   ├── CollisionLayers.ts # collision filtering با bitmask
    │   └── Raycast.ts         # line-of-sight + ray intersection
    ├── player/
    │   ├── Player.ts          # entity: health/energy/physics body
    │   ├── PlayerController.ts# input + movement logic
    │   └── PlayerCombat.ts    # fire/melee + Mecha visual parts
    ├── combat/
    │   ├── DamageSystem.ts    # centralized damage dispatch + VFX
    │   ├── Projectile.ts      # pooled projectile با overlap detection
    │   ├── HitEffects.ts      # explosion/smoke/flash
    │   └── Weapons.ts         # ۴ سلاح: plasma/shotgun/laser/rocket
    ├── enemies/
    │   ├── Enemy.ts           # base class
    │   ├── Drone.ts           # پرنده، شلیک‌کننده
    │   ├── Spider.ts          # زمینی، حمله‌ور
    │   └── Heavy.ts           # کند، HP بالا، charge
    ├── boss/
    │   ├── GuardianBoss.ts    # باس دو مرحله‌ای (Stage 1 + Stage 2 Enraged)
    │   └── BossStateMachine.ts# ۳ فاز (Stage 1) / ۲ فاز (Stage 2)
    ├── ui/
    │   ├── HUD.ts             # HP/Energy/Weapon/Section
    │   ├── BossBar.ts         # نوار HP باس
    │   └── PauseMenu.ts       # Resume/Restart/Quit
    ├── rendering/
    │   ├── Lighting.ts        # dynamic lights با flicker + multiply blend
    │   ├── Parallax.ts        # ۵ لایه پس‌زمینه
    │   ├── Shaders.ts         # CinematicPipeline (vignette) + HeatDistortion
    │   └── RenderInfo.ts      # پنل اطلاعات واقعی رندر (F3)
    ├── scenes/
    │   ├── BootScene.ts       # generate textures
    │   ├── MenuScene.ts       # title screen
    │   ├── MapScene.ts        # mission select
    │   ├── FactoryStage.ts    # اصلی‌ترین gameplay scene
    │   ├── VictoryScene.ts    # صفحه پیروزی
    │   ├── ComingSoonScene.ts # teaser مراحل آینده
    │   ├── SkillTreeScene.ts  # درخت مهارت
    │   └── SettingsScene.ts   # تنظیمات audio/graphics/controls
```

### ماژول‌های Combat (v4)

```
features/combat/
├── DamageSystem.ts       # centralized damage + hit-stop + screen shake
├── Projectile.ts         # Tier 2 (kinematic) + Tier 3 (matter) projectiles
├── Hitscan.ts            # Tier 1 — instant ray via intersectRay (NEW)
├── Weapons.ts            # ۴ سلاح با tier tag
├── HitEffects.ts         # explosion/smoke/flash VFX
├── Ragdoll.ts            # compound body deaths (NEW)
└── Destructible.ts       # structures that collapse when damaged (NEW)
```

### ماژول‌های Enemy FSM (v4)

```
features/enemies/
├── Enemy.ts              # base FSM: patrol|aggro|attack|cover|stagger
│                         # attack sub-FSM: telegraph→window→recovery
│                         # LoS via intersectRay, stagger on telegraph hit
├── Drone.ts              # flying ranged — telegraph hover, fire burst, strafe
├── Spider.ts             # ground melee — telegraph squish, lunge, skid
└── Heavy.ts              # slow tanky — telegraph glow+shake, charge, long stun
```

### اصول طراحی

1. **Feature مستقل:** هر ماژول بدون دانستن جزئیات بقیه کار می‌کند. Player فقط API مبارزه را می‌شناسد. Boss فقط رویدادهای Damage را دریافت می‌کند. UI فقط داده‌های Health/Energy را می‌خواند.

2. **Event-driven:** تمام ارتباط بین features از طریق EventBus انجام می‌شود:
   - `player:health-changed`, `player:energy-changed`, `player:died`
   - `enemy:killed`, `boss:health-changed`, `boss:phase-changed`, `boss:dead`, `boss:stage-defeated`
   - `stage:section-changed`, `player:checkpoint`, `player:weapon-changed`

3. **AI-Friendly:** هر فایل کمتر از ۳۰۰ خط، وابستگی کم، قابل تست مستقل.

---

### فیزیک فعلی

- **موتور:** Matter.js (تنها)
- **Player:** Matter image با fixedRotation (نه Arcade kinematic)
- **Collision:** bitmask categories (solid/player/enemy/boss/projectile-player/projectile-enemy/sensor/pickup)
- **مشکل:** گلوله‌های سریع tunnel می‌کنند → راه‌حل: overlap detection دستی در update loop

---

### رندر فعلی

- **موتور:** Phaser 4.2 با WebGL (Phaser.WEBGL)
- **config:** `antialias: true`, `antialiasGL: true` (MSAA), `mipmapFilter: LINEAR_MIPMAP_LINEAR` (NPOT)
- **Lighting:** radial gradient circles با ADD blend mode + darkness overlay با MULTIPLY
- **Parallax:** ۵ لایه با scroll factors مختلف (0.05, 0.15, 0.4, 0.7, 1.1)
- **Shaders:** CinematicPipeline (vignette + warm grade) + HeatDistortion
- **Particles:** tween-based (نه Phaser particle emitter)

---

### ورودی فعلی

- **منوها:** موس (click روی دکمه‌ها)
- **گیم‌پلی:** فقط کیبورد + گیم‌پد (موس غیرفعال)
  - حرکت: A/D یا Arrow یا Left Stick
  - Aim: W/S یا Arrow Up/Down (۸ جهت) یا Right Stick (۳۶۰°)
  - پرش: Space یا A button
  - Dash: Shift یا B button
  - شلیک: J یا X button (hold برای auto-fire)
  - Melee: K یا Y button
  - سلاح: 1-4 یا LB/RB یا Q/E
  - توقف: ESC یا Start

---

## نقشه راه پیشرفت پروژه

### فاز ۱: اصلاحات فوری ✅ تکمیل شد

#### ۱.۱ انتقال به Hybrid Physics (Arcade + Matter) — معلق
**طبق اسکیل `hybrid-physics-architecture`:**
- Player باید Arcade kinematic body باشد (نه Matter rigid body) برای precise platforming
- World (debris, structures, enemies) روی Matter بماند
- Bridge: manual `intersectRect` هر فریم برای player↔Matter collision
- **وضعیت:** به تعویق افتاد — ریسک بالای break کردن کد موجود. فعلاً Matter.js با overlap detection دستی کار می‌کند.
- **فایل‌های مورد تاثیر:** `Player.ts`, `PlayerController.ts`, `FactoryStage.ts`, `PhaserGame.ts`

#### ۱.۲ مدل سه‌سطحی پرتابه ✅
**طبق اسکیل `weapon-systems-projectiles`:**
- **Tier 1 (Hitscan):** Laser → `Hitscan.fire()` با `intersectRay` فوری، tracer visual ✅
- **Tier 2 (Lightweight kinematic):** Plasma, Shotgun → `Projectile` class با overlap detection ✅
- **Tier 3 (Real Matter body):** Rocket → `Projectile` با `explosive: true` ✅
- **فایل‌های جدید:** `Hitscan.ts`, تغییر `Weapons.ts` (اضافه‌شدن `tier` field), `PlayerCombat.ts` (Hitscan branch)

#### ۱.۳ FSM دشمن ✅
**طبق اسکیل `enemy-ai-boss-encounters`:**
- States: `patrol` | `aggro` | `attack` | `cover` | `stagger` ✅
- Telegraph → window → recovery الگو ✅
- Line-of-sight با `intersectRay` ✅
- Stagger روی telegraph hit (baitable attacks) ✅
- **فایل‌های تغییر یافته:** `Enemy.ts` (بازنویسی), `Drone.ts`, `Spider.ts`, `Heavy.ts`

---

### فاز ۳: Combat Feel ✅ تکمیل شد

#### ۳.۱ Ragdoll deaths ✅
**طبق اسکیل `ragdoll-destruction-combat`:**
- State swap: alive sprite → compound Matter body روی مرگ ✅
- ۶ بخش: head, torso, armL, armR, legL, legR ✅
- Loose pin joints (stiffness 0.4, damping 0.1) ✅
- Random torque + off-center impulse ✅
- Inherited velocity ✅
- Pool cap: 30 ragdolls, despawn بعد از 6s ✅
- **فایل جدید:** `Ragdoll.ts`

#### ۳.۲ Hit-stop ✅
- `engine.timing.timeScale = 0.05` برای 40-120ms ✅
- Duration مقیاس‌پذیر با damage ✅
- **فایل:** `DamageSystem.ts`

#### ۳.۳ Knockback + Screen shake ✅
- Knockback: `applyForce` در جهت hit normal ✅
- Screen shake: `intensity = min(0.02, 0.004 + amount * 0.0008)` ✅
- **فایل:** `DamageSystem.ts`

#### ۳.۴ Destructible structures ✅
- `DestructibleManager.buildTower()` ✅
- Support constraint که روی damage حذف می‌شود ✅
- `setStatic(false)` + applyForce + random spin ✅
- Debris particles (visual only) ✅
- **فایل جدید:** `Destructible.ts`

---
- Telegraph → damage window → recovery
- Line-of-sight با `intersectRay` (نه detection radius ساده)
- **فایل‌های مورد تاثیر:** `Enemy.ts`, `Drone.ts`, `Spider.ts`, `Heavy.ts`
- **زمان تخمینی:** ۳ ساعت

---

### فاز ۲: بهبود گرافیک و فیزیک (بعدی)

#### ۲.۱ Phaser 4.2 ParticleEmitter
- جایگزینی tween-based particles با `scene.add.particles(x, y, texture, config)`
- GPU-accelerated، بهتر برای ۲۰۰۰+ ذرات
- **فایل‌های مورد تاثیر:** `HitEffects.ts`, `Projectile.ts`

#### ۲.۲ SpriteGPULayer برای debris
- `scene.add.spriteGPULayer(texture, capacity)` برای decorative debris
- Instanced rendering، کمترین VRAM
- **فایل‌های مورد تاثیر:** جدید `DebrisLite.ts`

#### ۲.۳ PostFXPipeline با WebGL 2.0
- MRT (Multiple Render Targets) برای bloom + DOF
- Hardware instancing برای enemy waves
- VAO برای reduced binding overhead
- **فایل‌های مورد تاثیر:** `Shaders.ts`

#### ۲.۴ Lighting با RenderTexture
- جایگزینی circle-based lights با RenderTexture + GLSL shader
- Soft shadows با ray-marching
- **فایل‌های مورد تاثیر:** `Lighting.ts`

---

### فاز ۴: Level Design

#### ۴.۱ Segment-based pacing
**طبق اسکیل `level-design-pacing-checkpoints`:**
- ۴ pacing role: intro / escalate / breather / climax
- Camera bounds swap per segment
- **فایل‌های مورد تاثیر:** `FactoryStage.ts`, `Constants.ts`

#### ۴.۲ Checkpoint trap
- Log `removedConstraintIds` + `destroyedBodyIds`
- `this.registry` برای survival عبر `scene.restart()`
- Silent replay on respawn
- **فایل‌های مورد تاثیر:** `SaveManager.ts`, `FactoryStage.ts`
- **زمان تخمینی:** ۳ ساعت

#### ۴.۳ Stage 2: Neon District
- New scene `NeonDistrict.ts`
- New enemy types
- New boss
- **زمان تخمینی:** ۸ ساعت

---

### فاز ۵: Polish

#### ۵.۱ Audio
- Procedural SFX کامل (۲۰+ صدا)
- Dynamic music با phase transitions
- **فایل‌های مورد تاثیر:** `AudioManager.ts`
- **زمان تخمینی:** ۴ ساعت

#### ۵.۲ UI/UX
- Damage numbers floating
- Hit markers
- Combo counter
- Minimap
- **زمان تخمینی:** ۴ ساعت

#### ۵.۳ Performance
- `enableSleeping: true` در Matter config
- Pool ragdolls + debris
- Cull off-screen physics
- SpriteGPULayer برای background objects
- **زمان تخمینی:** ۳ ساعت

---

## اولویت‌بندی توصیه‌شده

| اولویت | فاز | دلیل |
|--------|-----|------|
| ۱ | ۱.۱ Hybrid Physics | Foundation برای بقیه؛ player کنترل بهتر |
| ۲ | ۱.۲ Three-tier projectiles | رفع tunneling، بهبود weapon feel |
| ۳ | ۱.۳ Enemy FSM | دشمن‌های هوشمندتر، fair combat |
| ۴ | ۳.۲ Hit-stop + ۳.۳ Knockback | Combat juice فوری |
| ۵ | ۲.۱ ParticleEmitter | گرافیک بهتر با کمترین زحمت |
| ۶ | ۳.۱ Ragdoll | حس مرگ سینمایی |
| ۷ | ۴.۱ Segment pacing | ساختار مرحله بهتر |
| ۸ | ۲.۳ PostFX WebGL 2.0 | گرافیک premium |
| ۹ | ۴.۳ Stage 2 | محتوای جدید |

---

## منابع و مستندات

- **Phaser 4.2 Docs:** https://phaser.io/phaser3/api
- **Matter.js Docs:** https://brm.io/matter-js/docs/
- **WebGL 2.0 Reference:** https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext
- **GLSL ES 3.0 Spec:** https://www.khronos.org/registry/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf
- **HTML5 Gamepad API:** https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API

---

## آمار پروژه (v4)

| متریک | مقدار |
|-------|-------|
| فایل TypeScript | ۴۴ |
| خطوط کد | ~۶۸۰۰ |
| صحنه‌ها | ۹ |
| Feature modules | ۱۰ |
| سلاح‌ها | ۴ (با ۳ tier) |
| دشمنان | ۳ + ۱ باس دو مرحله‌ای |
| مهارت‌ها | ۱۲ |
| FSM states دشمن | ۵ (patrol/aggro/attack/cover/stagger) |
| Combat features | Hit-stop, Ragdoll, Destructible, Knockback |

---

## اولویت‌بندی باقی‌مانده

| اولویت | فاز | وضعیت |
|--------|-----|--------|
| ✅ | ۱.۲ Three-tier projectiles | تکمیل شد |
| ✅ | ۱.۳ Enemy FSM | تکمیل شد |
| ✅ | ۳.۱ Ragdoll | تکمیل شد |
| ✅ | ۳.۲ Hit-stop | تکمیل شد |
| ✅ | ۳.۳ Knockback + Screen shake | تکمیل شد |
| ✅ | ۳.۴ Destructible | تکمیل شد |
| ⏳ | ۲.۱ ParticleEmitter | بعدی |
| ⏳ | ۲.۳ PostFX WebGL 2.0 | بعدی |
| ⏳ | ۴.۱ Segment pacing | بعدی |
| ⏳ | ۴.۳ Stage 2 (Neon District) | آینده |
| ⏸️ | ۱.۱ Hybrid Physics | معلق (ریسک بالا) |
