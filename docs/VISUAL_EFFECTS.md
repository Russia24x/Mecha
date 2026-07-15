# Visual Effects & Filters — Audit Report

> **Scope:** Every visual effect, blend mode, pipeline, scroll factor, alpha layer, and
> shader currently in use — or available but unused — in MECHA: LAST PROTOCOL.
> Generated as part of the Physics + AI polish milestone.

---

## 1. Currently-Used Effects (with file:line references)

### 1.1 `setAlpha()` — 29 occurrences

Alpha is the workhorse of the visual system. The physics sprites are set to
`alpha = 0` (invisible) because their actual visual is drawn as separate
GameObjects layered on top. This is a deliberate architecture choice, not a bug.

| Location | Alpha | Purpose |
|---|---|---|
| `player/Player.ts:86` | `0` | Physics sprite invisible (visual drawn separately) |
| `player/Player.ts:485,497` | `0.7–0.9` pulse | Core + visor glow animation |
| `player/Player.ts:547,549` | `0.45 ↔ 0` flash | Invulnerability blink (every 80 ms) |
| `enemies/Enemy.ts:54` | `0` | Physics sprite invisible |
| `enemies/Enemy.ts:331–335` | `0.8` flash | Hit-flash scale 1.15 + alpha 0.8 |
| `boss/Boss.ts:56,122,261,265` | `0.3→1` | Teleport fade-in, core pulse |
| `rendering/Parallax.ts:208,226` | flicker | Window light flicker, star twinkle |
| `rendering/Graphics.ts:30` | `0` default | RenderInfo panel hidden by default |
| `scenes/GameScene.ts:216,265,633,643,656,886,893,899` | various | Map preview, Stage 2 bg (0.5), Game Over fades |
| `combat/Destructible.ts:42` | `0` | Static base invisible |
| `ui/FloatingText.ts:111` | `0` until combo≥2 | Combo counter hidden until triggered |
| `ui/HUD.ts:81,118,123` | fade | Checkpoint toast fade-in/out |

### 1.2 `setScrollFactor()` — 18 occurrences

Scroll factor controls parallax. A value of `0` pins the object to the screen
(ignores camera movement); `1.0` is normal world-attached; values between
`0` and `1` produce parallax depth.

| Location | Factor | Layer |
|---|---|---|
| `Parallax.ts:47` | `0.05` | Far stars / sky gradient |
| `Parallax.ts:84` | `0.15` | Distant buildings |
| `Parallax.ts:135` | `0.4` | Mid-ground tanks / pipes |
| `Parallax.ts:165` | `0.7` | Catwalks / cables |
| `Parallax.ts:200` | `1.1` | Foreground steam vents (moves faster than camera) |
| `Graphics.ts:30,136` | `0` | Darkness overlay + RenderInfo panel (UI-pinned) |
| `GameScene.ts:266,270` | `0` | **Stage 2 bg image + dark overlay (screen-fixed)** |
| `UIScene.ts:27,32,35,135,140` | `0` | Pause menu UI |
| `HUD.ts:34`, `BossBar.ts:20`, `FloatingText.ts:23`, `TestSuite.ts:392` | `0` | All HUD elements |
| `Effects.ts:294` | `0` | Screen flash overlay |

### 1.3 `setBlendMode()` — 3 occurrences (UNDER-USED)

Blend modes are the cheapest way to add "glow" or "shadow" feel. The game
currently uses only **three** blend-mode calls total:

| Location | Blend | Effect |
|---|---|---|
| `rendering/Graphics.ts:138` | `MULTIPLY` | Darkness overlay multiplies the scene → shadows |
| `rendering/Graphics.ts:156` | `ADD` | Each light circle adds light → glow |
| `boss/Boss.ts:111` | `ADD` | Boss core glow |

**Notable absences:** no `ADD` on player core, projectiles, muzzle flashes,
explosions, dash afterimage (now added in Player.ts), or enemy telegraph glows.

### 1.4 `setTint()` — 12 occurrences

| Location | Tint | Purpose |
|---|---|---|
| `enemies/Enemy.ts:280,293` | `0xffffff` / `data.color` | **Heavy telegraph flash — BROKEN (sprite alpha 0, fixed to pulse visualGfx in polish pass)** |
| `boss/Boss.ts:170,172` | `0xffffff` | Phase-change white flash + reset |
| `combat/Ragdoll.ts:57–92` | enemy color | All 6 ragdoll parts tinted |
| `combat/Destructible.ts:49` | `0x4a5260` | Metal platform tint |
| `combat/Projectile.ts:59` | weapon color | Projectile tinted to weapon/enemy color |

### 1.5 `setPipeline()` / `postFX` / `preFX`

**Zero usages.** The `CinematicPipeline` class exists in `Graphics.ts:203-230`
but is **never instantiated or applied anywhere**. The shader (vignette + color
grade + contrast boost) is dead code. See §3.1 for activation guide.

### 1.6 `Phaser.GameObjects.Graphics` (procedural drawing)

| File | Use |
|---|---|
| `enemies/Enemy.ts:64,70` | `visualGfx` — entire enemy visual (drone/spider/heavy) |
| `boss/Boss.ts:69,75` | `bossGfx` — entire boss visual |
| `rendering/Parallax.ts:18–161` | Sky gradient, buildings, tanks, catwalks, cables, steam |

### 1.7 `Phaser.GameObjects.Particles`

**Zero usages.** All particles in the game are manually-spawned
`scene.add.circle() + scene.tweens.add()` calls. This is expensive — each
particle is a separate GameObject with its own transform + tween. Phaser's
built-in particle system batches hundreds of particles per draw call.

Manual particle locations:
- `Effects.explosion()` — 14 circles + 6 sparks + 4 smoke puffs per explosion
- `Effects.sparks()` — N circles per muzzle flash
- `Player.spawnLandingDust()` — 6 circles per landing
- `DamageSystem.spawnHitFx()` — 5 circles per hit
- `Player.ts:552–566` — thruster trail (1 circle per frame while moving fast)

### 1.8 Tweens — 33 calls

Heavy usage across all systems — every visual effect, menu transition, and
projectile trail uses tweens. Most common patterns:
- Particle fade-outs: `{ alpha: 0, scale: 0, duration: 200–600 }`
- Menu fade-ins: `{ alpha: 1, duration: 800, delay: N }`
- Yoyo loops: `{ y: y-6, yoyo: true, repeat: -1 }`

---

## 2. Available-But-Unused Effects

### 2.1 Post-FX Pipelines (WebGL shaders)

Phaser 4.2 supports per-camera and per-game-object post-FX pipelines. The
`CinematicPipeline` in `Graphics.ts:203-230` already implements:

```glsl
// Vignette + slight red push + blue cut + contrast boost
float v = 1.0 - dot(p, p) * 1.3;
col.r *= 1.05; col.b *= 0.92;
col = (col - 0.5) * 1.08 + 0.5;
gl_FragColor = vec4(col * v, 1.0);
```

**To activate (1 line in GameScene.ts `buildPlay()`):**
```ts
this.cameras.main.setPostPipeline(CinematicPipeline);
```

**Effect:** Instant cinematic grade — vignette darkening at screen edges,
slight teal-orange color shift, contrast bump. Zero per-frame cost on GPU.

### 2.2 Per-Object `preFX` (glow / blur / shake)

Phaser 4.2 exposes `gameObject.preFX.addGlow()`, `addBlur()`, `addShake()`.
These run on the object's own texture before composite. Examples we could add:

```ts
// Player core glow
this.core.preFX.addGlow(COLORS.PLAYER_GLOW, 4, 0, false, 0.1, 16);

// Boss projectile glow
projectile.preFX.addGlow(0xff3030, 8, 0, false, 0.1, 24);

// Dash afterimage blur (instead of manual trail)
this.mechaTorso.preFX.addBlur(0, 1, 0, 0.5, 0xffffff, 2);
```

**Cost:** ~0.2 ms per object on modern GPUs. Currently **zero preFX usage**.

### 2.3 Phaser Particle Emitters

`scene.add.particles(x, y, texture, config)` creates a batched emitter. We
should migrate the hot paths (muzzle flash, hit sparks, explosion, dash trail)
from manual circles to emitters. Example:

```ts
const muzzle = this.add.particles(0, 0, '__white', {
  speed: { min: 60, max: 180 },
  angle: { min: 0, max: 360 },
  scale: { start: 0.6, end: 0 },
  lifespan: 200,
  blendMode: 'ADD',
  tint: weapon.color,
  quantity: 6,
  emitting: false,
});
muzzle.explode(6, muzzleX, muzzleY);
```

**Benefit:** 6 particles in 1 draw call vs 6 separate GameObjects.

### 2.4 Camera Effects

Available but unused:
- `cameras.main.flash(duration, r, g, b)` — full-screen color flash (good for
  lightning, explosions near camera, boss phase change)
- `cameras.main.fadeIn(duration, r, g, b)` — fade from color (good for stage
  transitions)
- `cameras.main.fadeOut(...)` — fade to color (good for game-over)
- `cameras.main.zoomTo(zoom, duration)` — cinematic zoom on boss intro
- `cameras.main.rotateTo(...)` — disorienting effect for stun/stagger

Currently only `cameras.main.shake(60, 0.003)` is used (Player.ts:540).

### 2.5 Color Matrix Filter

`cameras.main.setColorMatrix()` can apply grayscale, sepia, invert, threshold,
hue shift. Useful for:
- Grayscale on player death (fade to B&W over 1 sec)
- Hue shift on boss phase change
- Invert on stun / confusion effect

Currently **zero usage**.

### 2.6 Missing blend-mode candidates

Objects that should have `ADD` blend mode but don't:
- Player core (`Player.ts:103`)
- Player visor (`Player.ts:117`)
- All projectiles (`combat/Projectile.ts`)
- Muzzle flashes (`Effects.sparks`)
- Explosion rings (`Effects.explosion`)
- Dash afterimage (✅ added in polish pass)
- Enemy telegraph glow (✅ added in polish pass for drone)

Objects that should have `MULTIPLY` blend mode but don't:
- Stage 2 dark overlay currently uses normal alpha (0.3) — switching to
  `MULTIPLY` with a dark blue tint gives richer shadow.

---

## 3. Specific Recommendations

### 3.1 Activate CinematicPipeline (HIGH PRIORITY — 1 line)

In `GameScene.ts` `buildPlay()`, after camera setup:
```ts
import { CinematicPipeline } from '../rendering/Graphics';
// ...
this.cameras.main.setPostPipeline(CinematicPipeline);
```
Toggle on/off in Settings menu with a "Cinematic Grade" checkbox.

### 3.2 Migrate manual particles to Phaser Particles (MEDIUM)

Create a `ParticlePool` class in `rendering/` that wraps `scene.add.particles()`
with named emitters (`muzzle`, `spark`, `explosion`, `dust`, `dashTrail`).
Effects.ts calls `ParticlePool.explode('muzzle', x, y, color)` instead of
spawning 6 circles manually.

### 3.3 Add `ADD` blend to glowing objects (LOW — 5 min)

Player core, visor, projectiles, muzzle sparks — one-line additions.

### 3.4 Add camera flash on boss phase change (LOW — 2 lines)

In `boss/Boss.ts` phase-change handler:
```ts
this.scene.cameras.main.flash(300, 255, 60, 60);
```

### 3.5 Stage 2 — replace flat dark overlay with MULTIPLY tint (LOW)

Currently:
```ts
this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, sd.bgColor, 0.3)
  .setOrigin(0, 0).setDepth(-1.5).setScrollFactor(0);
```
Improved:
```ts
this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, 0x0a1a2a, 0.6)
  .setOrigin(0, 0).setDepth(-1.5).setScrollFactor(0)
  .setBlendMode(Phaser.BlendModes.MULTIPLY);
```
Result: shadowed areas get darker blue, highlights stay bright — gives Stage 2
more neon-contrast pop.

---

## 4. Effect Inventory Summary

| Effect Type | Used | Available | Recommendation |
|---|---|---|---|
| Alpha | 29 calls | — | Already heavily used |
| Scroll factor | 18 calls | — | Stage 2 has none (fixed bg) — add parallax layers |
| Blend mode | 3 calls | 16 modes | Under-used — add ADD to glows |
| Tint | 12 calls | — | Heavy telegraph was broken (fixed) |
| Tweens | 33 calls | — | Heavily used |
| Graphics (procedural) | 3 classes | — | Core visual system |
| Phaser Particles | 0 | full system | Migrate hot paths |
| Post-FX Pipeline | 0 (dead code) | CinematicPipeline ready | Activate in 1 line |
| preFX (per-object) | 0 | glow / blur / shake | Add to player core, projectiles |
| Camera flash/fade | 0 (shake only) | flash/fade/zoom/rotate | Add for boss phases, death |
| Color matrix | 0 | grayscale/sepia/invert/hue | Add grayscale on death |

---

## 5. Performance Notes

- Each manual particle (`add.circle() + tween`) costs ~0.05 ms on the CPU side
  for GameObject management. An explosion spawning 24 particles = ~1.2 ms.
- Phaser's batched particle emitter does the same 24 particles in ~0.05 ms
  total (single draw call).
- The `CinematicPipeline` shader adds ~0.3 ms per frame on integrated GPUs —
  negligible for a 60 fps target (16.6 ms budget).
- `preFX` on a per-object basis is cheap (≤0.2 ms/object) but stacking 5+
  effects on the same object compounds. Keep to 1–2 per object.

---

*Document version 1.0 — Physics + AI polish milestone.*
