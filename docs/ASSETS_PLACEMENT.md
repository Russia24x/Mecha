# Asset Placement Guide — Map Preview & Gameplay Background

> **Scope:** How to add new images to the game — both map-screen preview
> thumbnails and in-gameplay background art. Covers the existing Stage 2
> implementation, the orphaned `bg-2.png` / `bg-3.png` assets, and the
> step-by-step recipe for adding a new stage's artwork.

---

## 1. Where Assets Live

```
/home/z/my-project/
├── public/
│   └── stage2/
│       ├── bg-1.png   ← Stage 2 main background (LOADED + USED)
│       ├── bg-2.png   ← Stage 2 mid-ground (ORPHANED — not loaded)
│       └── bg-3.png   ← Stage 2 foreground (ORPHANED — not loaded)
└── src/game/
    ├── features/scenes/
    │   ├── BootScene.ts   ← Preloads textures globally
    │   └── GameScene.ts   ← Builds map screen + gameplay
    └── shared/
        └── Constants.ts   ← Stage definitions (bg path, sections, lore)
```

**Rule:** Place new image files under `public/<stage-name>/`. Anything in
`public/` is served at the root URL by Vite, so `public/stage2/bg-1.png`
becomes fetchable at `/stage2/bg-1.png`.

---

## 2. Texture Loading — Two Layers

Phaser has two distinct "loading" concepts:

### 2.1 Global preload (BootScene.ts)

Textures loaded here are available in **every scene** for the rest of the
session. This is where gameplay backgrounds belong — they're used by
GameScene but also referenced by the map preview.

**File:** `src/game/features/scenes/BootScene.ts`

```ts
preload(): void {
  // ... loading bar setup ...

  // Stage 2 main background
  this.load.image('stage2-bg', '/stage2/bg-1.png');

  // TO ADD: mid-ground + foreground for parallax (currently orphaned)
  // this.load.image('stage2-mid',  '/stage2/bg-2.png');
  // this.load.image('stage2-far',  '/stage2/bg-3.png');

  // TO ADD: Stage 3 backgrounds when ready
  // this.load.image('stage3-bg',  '/stage3/bg-1.png');
}
```

**Texture key convention:** `stageN-bg` for the main background,
`stageN-mid` / `stageN-far` for parallax layers, `stageN-preview` for map
thumbnails (though the preview usually reuses the main bg).

### 2.2 On-demand load (GameScene map screen)

Map thumbnails are loaded on-demand when the map screen is built, because
the player may not have unlocked every stage. This avoids loading all stage
art up front.

**File:** `src/game/features/scenes/GameScene.ts` (inside `buildMap()`):

```ts
const stages = [
  { name: 'ABANDONED FACTORY', sub: 'Stage 1 — Industrial Complex',
    unlocked: true, img: null },
  { name: 'NEON DISTRICT', sub: stage2Unlocked ? 'Stage 2 — Neon City' : 'Stage 2 — Locked',
    unlocked: stage2Unlocked,
    img: stage2Unlocked ? '/stage2/bg-1.png' : null },
  { name: 'ORBITAL STATION', sub: 'Stage 3 — Locked',
    unlocked: false, img: null },
];

stages.forEach((s, i) => {
  // ... draw stage card ...
  if (s.unlocked && s.img) {
    this.load.image(`stage2-preview-${i}`, s.img);
    this.load.once('complete', () => {
      const preview = this.add.image(x, y - 20, `stage2-preview-${i}`);
      preview.setDisplaySize(190, 80);  // thumbnail size
      preview.setAlpha(0.7);
      preview.setDepth(51);
      this.stateContainer.add(preview);
    });
    this.load.start();
  }
});
```

**Gotcha:** The `load.once('complete', ...)` fires asynchronously, so the
thumbnail pops in 50–200 ms after the rest of the map UI. To make this
instant, prefer preloading all unlocked-stage previews in BootScene.

---

## 3. Adding a New Stage Background — Step by Step

### Step 1: Drop the image into `public/`

```
public/stage3/bg-1.png    ← 1280×720 or larger, PNG or JPG
```

Recommended dimensions: **1280×720** (matches `GAME.WIDTH × GAME.HEIGHT`).
Larger images will be scaled down with `setDisplaySize()`. Keep file size
under 500 KB for fast load (use PNG with pngcrush, or WebP if supported).

### Step 2: Register the texture in BootScene.ts

```ts
// src/game/features/scenes/BootScene.ts
preload(): void {
  // ... existing loads ...
  this.load.image('stage3-bg', '/stage3/bg-1.png');
}
```

### Step 3: Add the stage to Constants.ts

```ts
// src/game/shared/Constants.ts
export const STAGE_3 = {
  id: 3,
  name: 'ORBITAL STATION',
  bgColor: 0x0a0a1a,           // dark blue
  bgImage: '/stage3/bg-1.png',
  SECTIONS: [
    { id: 1, name: 'Airlock',      x: 0,    enemies: ['drone'] },
    // ... 5 more sections ...
    { id: 6, name: 'Bridge',       x: 6400, enemies: ['boss3'] },
  ],
  TOTAL_WIDTH: 7680,
  SECTION_WIDTH: 1280,
  CHECKPOINT_SECTIONS: [2, 5],
  BOSS_NAME: 'ORBITAL WARDEN',
  BOSS_LORE: [ '...' ],
} as const;
```

### Step 4: Display the background in GameScene.ts `buildPlay()`

```ts
// src/game/features/scenes/GameScene.ts (inside buildPlay, ~line 261)
if (this.currentStageId === 3 && this.textures.exists('stage3-bg')) {
  const bg = this.add.image(GAME.WIDTH / 2, GAME.HEIGHT / 2, 'stage3-bg')
    .setDepth(-2)
    .setDisplaySize(GAME.WIDTH, GAME.HEIGHT)
    .setAlpha(0.5)                    // dim so gameplay reads on top
    .setScrollFactor(0);              // screen-fixed (no parallax)
  this.stageBgImage = bg;

  // Dark overlay for contrast (tunable per stage)
  const dark = this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, 0x0a0a1a, 0.3)
    .setOrigin(0, 0).setDepth(-1.5).setScrollFactor(0);
}
```

### Step 5: Add the stage card to the map screen

In `buildMap()`, update the `stages` array (see §2.2) to include Stage 3
with its unlock condition (e.g. `stage3Unlocked = Save.getStageProgress() >= 3`).

### Step 6: Wire the stage transition

In `GameScene.startStage(id)`, handle `id === 3` to build the Stage 3 layout
from `STAGE_3.SECTIONS` instead of `STAGE_1` / `STAGE_2`.

---

## 4. Parallax Backgrounds (Recommended Upgrade for Stage 2)

Currently Stage 2 uses a single static image. The orphaned `bg-2.png` and
`bg-3.png` are meant to be parallax layers. Here's the drop-in upgrade:

### 4.1 Load all three textures (BootScene.ts)

```ts
this.load.image('stage2-bg',  '/stage2/bg-1.png');  // main (already loaded)
this.load.image('stage2-mid', '/stage2/bg-2.png');  // mid-ground
this.load.image('stage2-far', '/stage2/bg-3.png');  // far background
```

### 4.2 Display with parallax scroll factors (GameScene.ts buildPlay)

```ts
if (this.currentStageId === 2) {
  // Far layer — barely moves with camera
  if (this.textures.exists('stage2-far')) {
    this.add.image(GAME.WIDTH / 2, GAME.HEIGHT / 2, 'stage2-far')
      .setDepth(-3).setDisplaySize(GAME.WIDTH, GAME.HEIGHT)
      .setAlpha(0.4).setScrollFactor(0.1);   // 10% camera speed
  }
  // Mid layer — moves slower than world
  if (this.textures.exists('stage2-mid')) {
    this.add.image(GAME.WIDTH / 2, GAME.HEIGHT / 2, 'stage2-mid')
      .setDepth(-2.5).setDisplaySize(GAME.WIDTH, GAME.HEIGHT)
      .setAlpha(0.6).setScrollFactor(0.3);   // 30% camera speed
  }
  // Main layer — screen-fixed (existing behavior)
  if (this.textures.exists('stage2-bg')) {
    this.add.image(GAME.WIDTH / 2, GAME.HEIGHT / 2, 'stage2-bg')
      .setDepth(-2).setDisplaySize(GAME.WIDTH, GAME.HEIGHT)
      .setAlpha(0.5).setScrollFactor(0);
  }
  // Contrast overlay
  this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, 0x0a1a0a, 0.3)
    .setOrigin(0, 0).setDepth(-1.5).setScrollFactor(0);
}
```

**Visual result:** As the player walks right, the far layer drifts slowly,
the mid layer drifts faster, and the main layer stays fixed. This creates
a 3-layer parallax depth illusion that Stage 1 has procedurally but Stage 2
currently lacks.

---

## 5. Map Preview Image — Best Practices

- **Size:** 190×80 px display (per `setDisplaySize(190, 80)`). Source image
  can be larger; Phaser downscales smoothly.
- **Alpha:** `0.7` is used so the preview sits softly against the card
  background. Bump to `0.85` for more vivid previews.
- **Locked stages:** Set `img: null` and draw a lock icon instead. The code
  path `if (s.unlocked && s.img)` handles this automatically.
- **Aspect ratio:** The 190×80 box is roughly 2.4:1. Source images wider
  than 2.4:1 will be letterboxed; narrower will be pillarboxed. Crop to
  2.4:1 for best fit.

---

## 6. Troubleshooting

### "Texture not found" error at runtime
- Confirm the file is at `public/<path>` (not `src/`).
- Confirm `this.load.image('key', '/path')` is called **before** the scene
  tries to use it. BootScene preload is safest.
- Check browser DevTools Network tab — 404 means wrong path.

### Background appears but gameplay is unreadable
- Lower `setAlpha()` on the bg image (0.3–0.5 is the sweet spot).
- Increase the dark overlay alpha from 0.3 to 0.4–0.5.
- Or switch the overlay to `BlendModes.MULTIPLY` for richer shadow (see
  `VISUAL_EFFECTS.md` §3.5).

### Background doesn't scroll with camera
- That's intentional — `setScrollFactor(0)` pins it to the screen. To make
  it scroll, use `setScrollFactor(1)` (full world-attached) or a fractional
  value for parallax (see §4.2).

### Map preview pops in late
- The `load.once('complete')` is async. To fix, preload all unlocked-stage
  previews in BootScene instead of loading on-demand in `buildMap()`.

---

## 7. Asset Inventory (Current)

| Path | Used? | Texture Key | Purpose |
|---|---|---|---|
| `public/stage2/bg-1.png` | ✅ | `stage2-bg` | Stage 2 main bg + map preview |
| `public/stage2/bg-2.png` | ❌ orphaned | — | Intended for mid parallax layer |
| `public/stage2/bg-3.png` | ❌ orphaned | — | Intended for far parallax layer |
| (procedural `__white`) | ✅ | `__white` | 1×1 white texture for tinted rects |

Everything else in the game (player, enemies, boss, particles, parallax
layers for Stage 1, UI) is drawn procedurally with `Phaser.GameObjects.Graphics`
and primitive shapes — no image assets required.

---

*Document version 1.0 — Physics + AI polish milestone.*
