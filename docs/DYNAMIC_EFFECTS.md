# Dynamic Effects on Static Backgrounds — Technical Guide

> **Question answered:** Can we add rain, lightning, explosion light, dust,
> birds, or animations **on top of a fixed PNG background**? Yes — the
> background image being static does not constrain any of these. This
> document explains how each effect works technically, what it costs, and
> provides drop-in code recipes.

---

## 1. Core Principle

A background image placed with `this.add.image(...)` is just a
`Phaser.GameObjects.Image` — a textured quad drawn at a depth. **It does not
"lock" the area.** You can layer any number of additional GameObjects on top
of it (or beneath it via `setDepth`), spawn particles in front of it, flash
the camera to white, animate tween-based effects, or run full shader
pipelines. The static image is one layer among many.

**Depth ordering for a stage with a static bg:**

```
depth -3   : far parallax layer (optional)
depth -2.5 : mid parallax layer (optional)
depth -2   : main background image (the static PNG)
depth -1.5 : dark overlay (for contrast)
depth 0-9  : platforms, pickups, particles
depth 10-19: player + enemies + projectiles
depth 20+  : UI, HUD
```

Anything you spawn at depth ≥ -1.5 will render on top of the background.

---

## 2. Rain — Full-Screen Particle Shower

### 2.1 How it works

Rain is a stream of short diagonal lines (or stretched dots) falling from
the top of the screen to the bottom. Because the camera moves horizontally,
rain should be `setScrollFactor(0)` so it stays pinned to the screen —
otherwise rain only falls in the original screen area and disappears when
the player walks.

### 2.2 Drop-in implementation

Add a `Rain.ts` utility class or inline in GameScene `buildPlay()`:

```ts
// Spawn 200 raindrops as a pooled particle emitter (cheap)
const rain = this.add.particles(0, 0, '__white', {
  x: { min: 0, max: GAME.WIDTH + 200 },
  y: -20,
  lifespan: 1200,
  speedY: { min: 600, max: 900 },
  speedX: -120,                    // wind slant
  scale: { start: 0.5, end: 0.5 },
  scaleX: 0.15,                    // thin streaks
  angle: 100,                      // slight diagonal
  alpha: { start: 0.5, end: 0.2 },
  quantity: 4,
  frequency: 30,
  tint: 0x88aacc,
  blendMode: 'ADD',
});
rain.setScrollFactor(0);           // screen-fixed
rain.setDepth(50);                 // in front of gameplay
```

### 2.3 Cost

- 200 active particles, 1 draw call (Phaser batches particles) ≈ **0.2 ms / frame**.
- Cheap enough to run alongside everything else.

### 2.4 Variations

- **Heavy rain:** increase `quantity` to 8, `frequency` to 15.
- **Drizzle:** `quantity: 1`, `frequency: 80`, lower `speedY`.
- **Acid rain (Stage 2 Toxic Canal):** tint `0x66ff66` and add a splash
  particle when a drop hits the ground.
- **Snow:** lower `speedY` to 80–120, remove wind, tint `0xffffff`.

---

## 3. Lightning / Thunder — Camera Flash + Sound

### 3.1 How it works

Lightning is two effects combined:
1. **Visual:** A full-screen white flash that fades out over 200–400 ms,
   optionally with a jagged bolt drawn as a `Graphics` polyline.
2. **Audio:** A thunder rumble played ~500 ms after the flash (speed-of-sound
   delay for dramatic effect).

The flash uses `cameras.main.flash(duration, r, g, b)` — a built-in Phaser
camera effect that overlays a color and fades it out. It works on **any**
background, static or procedural, because it's a post-render camera pass.

### 3.2 Drop-in implementation

```ts
// Random lightning storm — call from update() with a probability check
private triggerLightning(): void {
  // 1. White flash (200 ms full-white, then 400 ms fade)
  this.cameras.main.flash(600, 255, 255, 255, true);

  // 2. Draw a jagged bolt (optional — for visible lightning, not just the flash)
  const bolt = this.add.graphics();
  bolt.setDepth(60);
  bolt.setScrollFactor(0);
  bolt.lineStyle(2, 0xffffff, 0.95);
  bolt.beginPath();
  let x = Phaser.Math.Between(100, GAME.WIDTH - 100);
  let y = 0;
  bolt.moveTo(x, y);
  while (y < GAME.HEIGHT) {
    x += Phaser.Math.Between(-30, 30);
    y += Phaser.Math.Between(20, 50);
    bolt.lineTo(x, y);
  }
  bolt.strokePath();
  bolt.setBlendMode(Phaser.BlendModes.ADD);

  // Fade + destroy the bolt after 180 ms
  this.tweens.add({
    targets: bolt, alpha: 0, duration: 180,
    onComplete: () => bolt.destroy(),
  });

  // 3. Thunder rumble 500 ms later
  this.time.delayedCall(500, () => Effects.play('explosion'));  // reuse explosion sfx
}

// In update(): trigger randomly every ~15-30 seconds
if (this.currentStageId === 2 && Math.random() < 0.0008) {
  this.triggerLightning();
}
```

### 3.3 Cost

- Flash: ~0.1 ms (camera post-process, single frame).
- Bolt graphics: ~0.2 ms to draw + 1-tween fade.
- Thunder: 1 audio buffer playback.

### 3.4 Stage-specific use

- **Stage 2 Neon District:** Lightning illuminates the skyline — perfect
  mood for the "Neon Gateway" and "Toxic Canal" sections.
- **Stage 1 Abandoned Factory:** Use flickering ceiling lights instead
  (already implemented in `Parallax.ts:208`).

---

## 4. Explosion Light — Radial Flash on Static Background

### 4.1 How it works

When an explosion happens (rocket, boss death, destructible), a brief radial
light burst illuminates the surrounding area. The static background image
isn't modified — instead, an `ADD`-blended circle is overlaid on top, scaled
up quickly, and faded out.

### 4.2 Drop-in implementation

```ts
// Spawn an explosion light flash at (x, y)
spawnExplosionLight(x: number, y: number, color = 0xffaa44): void {
  const flash = this.add.circle(x, y, 8, color, 0.9);
  flash.setDepth(9);                    // above platforms, below player
  flash.setBlendMode(Phaser.BlendModes.ADD);
  this.tweens.add({
    targets: flash,
    radius: 180,                        // grows outward
    alpha: 0,                           // fades to transparent
    duration: 350,
    ease: 'Quad.easeOut',
    onComplete: () => flash.destroy(),
  });

  // Optional: also flash the whole screen for big explosions
  if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 300) {
    this.cameras.main.flash(150, 255, 180, 80);
  }
}
```

### 4.3 Where to hook it

- `Effects.explosion()` — call `spawnExplosionLight(x, y)` at the start.
- `boss/Boss.ts` phase-change — big orange flash on phase 2 / 3.
- `combat/Destructible.ts` — small flash when a crate breaks.

### 4.4 Cost

- 1 GameObject + 1 tween = ~0.1 ms.
- Camera flash (if triggered) = ~0.1 ms.

---

## 5. Dust / Mist / Floating Particles

### 5.1 How it works

Dust motes are slow-drifting semi-transparent circles that float across the
screen. They add atmosphere without distracting. Like rain, they should be
`setScrollFactor(0)` so they stay in view as the camera moves.

### 5.2 Drop-in implementation

```ts
// Spawn 30 dust motes drifting slowly across the screen
const dust = this.add.particles(GAME.WIDTH / 2, GAME.HEIGHT / 2, '__white', {
  x: { min: 0, max: GAME.WIDTH },
  y: { min: 0, max: GAME.HEIGHT },
  lifespan: 6000,
  speedX: { min: -10, max: 10 },
  speedY: { min: -5, max: 5 },
  scale: { start: 0.3, end: 0.1 },
  alpha: { start: 0.15, end: 0 },
  quantity: 1,
  frequency: 200,
  tint: 0xa0a0a0,
});
dust.setScrollFactor(0);
dust.setDepth(5);    // behind gameplay
```

### 5.3 Variations

- **Toxic mist (Stage 2):** tint `0x60ff60`, larger scale, slower drift.
- **Embers (boss arena):** tint `0xff6040`, drift upward, ADD blend.
- **Fog (factory floor):** tint `0x404050`, very large scale (1.5+), slow
  drift, low alpha (0.1).

### 5.4 Cost

- 30 particles, 1 draw call ≈ **0.05 ms / frame**. Negligible.

---

## 6. Birds / Ambient Creatures — Animated Sprites

### 6.1 How it works

Birds are small `Phaser.GameObjects.Graphics` shapes (or sprites if we add
texture assets) that fly across the background on a tween. They have no
gameplay effect — pure atmosphere.

Two implementation paths:

### 6.2 Path A — Procedural Graphics (no asset needed)

```ts
spawnBirdFlock(): void {
  const count = Phaser.Math.Between(3, 6);
  const startY = Phaser.Math.Between(80, 200);
  const direction = Math.random() < 0.5 ? 1 : -1;
  const startX = direction > 0 ? -50 : GAME.WIDTH + 50;
  const endX = direction > 0 ? GAME.WIDTH + 50 : -50;

  for (let i = 0; i < count; i++) {
    const bird = this.add.graphics();
    bird.setDepth(-1);             // behind gameplay, in front of bg image
    bird.setScrollFactor(0.2);     // parallax: moves slower than camera
    bird.fillStyle(0x101020, 0.7);
    // Simple bird shape — two triangles for wings
    const drawBird = (flap: number) => {
      bird.clear();
      bird.fillStyle(0x101020, 0.7);
      bird.beginPath();
      bird.moveTo(-6, 0);
      bird.lineTo(0, -4 - flap * 3);
      bird.lineTo(6, 0);
      bird.lineTo(0, 2);
      bird.closePath();
      bird.fillPath();
    };
    drawBird(0);
    bird.x = startX + i * 15;
    bird.y = startY + i * 8;

    // Flap animation
    this.time.addEvent({
      delay: 120, loop: true,
      callback: () => drawBird(Math.sin(this.time.now / 120) > 0 ? 1 : 0),
    });

    // Fly across the screen
    this.tweens.add({
      targets: bird,
      x: endX,
      duration: 8000 + Phaser.Math.Between(-1000, 1000),
      ease: 'Linear',
      onComplete: () => bird.destroy(),
    });
  }
}

// Spawn a flock every 20-40 seconds
this.time.addEvent({
  delay: Phaser.Math.Between(20000, 40000), loop: true,
  callback: () => this.spawnBirdFlock(),
});
```

### 6.3 Path B — Sprite with animation (if we add a bird.png)

```ts
// Requires: this.load.spritesheet('bird', '/sprites/bird.png', { frameWidth: 16, frameHeight: 16 });
// In create():
this.anims.create({
  key: 'fly', frames: this.anims.generateFrameNumbers('bird', { start: 0, end: 2 }),
  frameRate: 8, repeat: -1,
});
// Spawn:
const bird = this.add.sprite(startX, startY, 'bird').play('fly');
bird.setScrollFactor(0.2);
bird.setDepth(-1);
this.tweens.add({ targets: bird, x: endX, duration: 8000, onComplete: () => bird.destroy() });
```

### 6.4 Cost

- Per bird: 1 Graphics redraw + 1 tween ≈ **0.05 ms / frame** for a flock of 5.

### 6.5 Variations

- **Bats (factory):** tint `0x202030`, erratic Y motion via additional sin-wave tween.
- **Drones (neon city):** tint `0xff4060`, ADD blend, faster flight.
- **Insects (toxic canal):** tint `0x60ff40`, very small, swarm around a point.

---

## 7. Screen-Space Distortion (Shockwave / Ripple)

### 7.1 How it works

A shockwave is a ring that expands outward from an explosion point. It uses
`ADD` blend mode + scale tween. Optionally, a custom shader can do true
screen-space ripple distortion, but the visual-only ring is much cheaper.

### 7.2 Drop-in implementation

```ts
spawnShockwave(x: number, y: number, color = 0xffffff): void {
  const ring = this.add.circle(x, y, 4, color, 0);
  ring.setStrokeStyle(3, color, 0.9);
  ring.setDepth(20);
  ring.setBlendMode(Phaser.BlendModes.ADD);
  this.tweens.add({
    targets: ring,
    scale: { from: 1, to: 20 },
    alpha: { from: 0.9, to: 0 },
    duration: 500,
    ease: 'Quad.easeOut',
    onComplete: () => ring.destroy(),
  });
}
```

### 7.3 Use cases

- Boss phase change: shockwave from boss position.
- Heavy enemy charge-impact: shockwave at collision point.
- Player landing after a long fall: small shockwave.

---

## 8. Animated Background Layers (Beyond Static PNG)

Even with a static PNG as the main background, you can add animated layers
**behind** or **in front of** it:

### 8.1 Behind the static image (depth < -2)

- Animated neon sign (tween alpha flicker on a colored rectangle)
- Moving searchlight (rotating cone = triangle with ADD blend)
- Drifting cloud (large semi-transparent ellipse tweened across)

### 8.2 In front of the static image (depth -1.5 to 0)

- Falling leaves (particle emitter with rotation)
- Steam vents (occasional puff from fixed points)
- Sparks from broken wiring (random tiny ADD-blended dots)

### 8.3 Example: Neon sign flicker

```ts
const sign = this.add.rectangle(200, 150, 80, 24, 0xff4060, 0.8);
sign.setDepth(-1.8);
sign.setScrollFactor(0.1);    // slow parallax
sign.setBlendMode(Phaser.BlendModes.ADD);
this.tweens.add({
  targets: sign,
  alpha: { from: 0.8, to: 0.2 },
  duration: 80, yoyo: true, repeat: -1,
  repeatDelay: Phaser.Math.Between(500, 2000),
});
```

---

## 9. Effect Combinations — Section Atmospheres

Each section of a stage can have a different "mood" by combining effects:

| Section | Effects | Mood |
|---|---|---|
| Neon Gateway (Stage 2 §1) | Lightning + neon-sign flicker | Stormy arrival |
| Toxic Canal (Stage 2 §2) | Acid rain + green mist | Hazardous |
| Vertical Climb (Stage 2 §3) | Dust + wind streaks | Ascending |
| Ambush Alley (Stage 2 §4) | Sparks + red tint flashes | Combat intensity |
| Safe House (Stage 2 §5) | Soft dust + warm tint | Calm respite |
| AI Core (Boss arena) | Shockwaves on phase change + ember particles | Climactic |

Each effect is toggleable per-section via a flag check in `update()`:

```ts
const section = this.getCurrentSection();
if (section.id === 1 && this.currentStageId === 2) {
  // Lightning active
  if (Math.random() < 0.0008) this.triggerLightning();
}
```

---

## 10. Performance Budget

| Effect | Cost / frame | Recommended max |
|---|---|---|
| Rain (200 particles) | 0.2 ms | 1 active |
| Lightning flash | 0.1 ms (1 frame) | Every 15+ sec |
| Lightning bolt graphic | 0.2 ms | 1 active |
| Explosion light | 0.1 ms | 5 simultaneous |
| Dust (30 particles) | 0.05 ms | 2 active |
| Bird flock (5 birds) | 0.05 ms | 1 active |
| Shockwave ring | 0.05 ms | 3 simultaneous |
| Neon sign flicker | <0.01 ms | Unlimited |

**Total budget for all effects combined:** ~0.5 ms / frame, well within the
16.6 ms / frame budget at 60 fps.

---

## 11. Summary — What's Possible

| Effect | Possible on static bg? | Cost | Asset needed? |
|---|---|---|---|
| Rain | ✅ Yes | 0.2 ms | No (procedural) |
| Lightning flash | ✅ Yes | 0.1 ms | No (camera fx) |
| Lightning bolt | ✅ Yes | 0.2 ms | No (Graphics) |
| Thunder sound | ✅ Yes | negligible | No (procedural SFX) |
| Explosion light | ✅ Yes | 0.1 ms | No (circle + tween) |
| Dust / mist | ✅ Yes | 0.05 ms | No (particles) |
| Birds | ✅ Yes | 0.05 ms | No (Graphics) or Yes (sprite) |
| Shockwave | ✅ Yes | 0.05 ms | No (circle + tween) |
| Neon sign flicker | ✅ Yes | <0.01 ms | No (rectangle + tween) |
| Animated bg layers | ✅ Yes | varies | Optional |
| True screen distortion | ✅ Yes (shader) | 0.5 ms | No (GLSL) |

**Bottom line:** The static PNG background is never a constraint. Any effect
that works on a procedural background works identically on a static image —
the background is just one depth layer among many. The only thing a static
background can't do is *change itself* (e.g. a building collapsing in the
background would require either swapping the image or overlaying a
destruction animation on top).

---

*Document version 1.0 — Physics + AI polish milestone.*
