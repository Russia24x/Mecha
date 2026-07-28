/**
 * MECHA: LAST PROTOCOL — AtmosphereSystem v1.1
 *
 * PHASE 2: Atmospheric effects that transform the world from a flat corridor
 * into a lived-in, breathing place.
 *
 * Layers (per region theme):
 *   1. FOG — slow-drifting horizontal fog bands (depth 80, below HUD)
 *   2. GOD RAYS — volumetric light shafts from above (depth 1, blend ADD)
 *   3. AMBIENT PARTICLES — region-specific (embers for factory, spores for forest)
 *   4. DEPTH HAZE — gradual fade with distance (depth 95, multiply blend)
 *
 * Act II (wastes) additions — v1.1:
 *   5. WASTES FOG — 4 dark-green horizontal fog bands drifting at different
 *      speeds (parallax). Graphics objects with fillStyle alpha 0.05-0.1.
 *      Wrap seamlessly using periodic patterns.
 *   6. WATER REFLECTION — 18 small 2×1 rectangles near the bottom of the
 *      screen (y > 620) that flicker randomly each frame to simulate the
 *      shimmering surface of standing water.
 *
 * Act III (city) additions — v1.1:
 *   7. RAIN — 40-50 diagonal raindrop lines drawn on a single Graphics object
 *      (lineStyle(1, 0x4060a0, 0.3)). 8-15px long, 300-500px/s. Recycle to top
 *      when off-screen bottom.
 *   8. LIGHTNING — Random screen-wide flash every 8-15s. Uses
 *      scene.cameras.main.flash(150, 200, 220, 255) + brief white overlay rect.
 *      Plays 'thunder' SFX if registered (silently no-ops otherwise).
 *   9. NEON PULSE — 4 colored rectangles (cyan, magenta, amber, green) at
 *      fixed background positions that breathe their alpha on different
 *      timings (simulate distant neon signs).
 *  10. ASH PARTICLES — 22 small brown-gray circles drifting upward slowly
 *      with horizontal sway. radius 1-2px, color 0x4a4030, alpha 0.1-0.3.
 *
 * Per Phaser 4 skill (filters-and-postfx, particles, cameras):
 *   - Fog = multiple translucent Graphics stripes with slow x-drift tween
 *   - God rays = gradient triangles (ADD blend) with subtle sway
 *   - Particles = Phaser.GameObjects.Arc pool, recycled, ADD blend
 *   - Rain / Ash / Water-shimmer = single Graphics object cleared+redrawn per
 *     frame with an array of plain data records ({x, y, speed, ...}).
 *   - All effects scrollFactor locked so they move with camera at depth
 *
 * Lifecycle:
 *   - Tied to PLAY state only — destroyed in cleanupPlay (effect separation)
 *   - Per region: factory = amber dust + ember sparks + dim god rays
 *                  forest = green spores + thick fog + bright god rays
 *                  wastes = dark-green drifting fog + water shimmer
 *                  city   = rain + lightning + neon pulse + ash
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { QualityManager } from '../../systems/QualityManager';
import { AudioSystem } from '../../systems/AudioSystem';
import type { SfxName } from '../../systems/AudioSystem';
import type { RegionTheme } from './ParallaxBackground';

interface Particle {
  go: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  alive: boolean;
}

// ─── Act II data records ──────────────────────────────────────────────
interface WastesFogBand {
  gfx: Phaser.GameObjects.Graphics;
  x: number;            // current drift offset (0..segmentWidth)
  speed: number;        // px/s
  segmentWidth: number; // wrap period (pattern is periodic)
}

interface WaterShimmer {
  x: number;
  y: number;
  baseAlpha: number;
  flickerSpeed: number;
  phase: number;
}

// ─── Act III data records ─────────────────────────────────────────────
interface RainDrop {
  x: number;
  y: number;
  speed: number;   // px/s (250-600)
  length: number;  // px (2-18)
  alpha: number;   // 0.08-0.5 (depth variation)
  width: number;   // 1 or 2 (closer drops thicker)
  isFine: boolean;  // true = tiny mist-like dot, false = visible streak
}

interface Splash {
  x: number;
  y: number;
  life: number;    // ms remaining
  maxLife: number; // ms total
  size: number;    // radius px
}

interface AshParticle {
  x: number;
  y: number;
  baseX: number;        // anchor for sway
  vy: number;           // upward velocity (negative)
  baseAlpha: number;
  radius: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  life: number;
  maxLife: number;
}

export class AtmosphereSystem {
  private scene: Phaser.Scene;
  private theme: RegionTheme;
  private worldWidth: number;

  // ─── Existing effect fields ──────────────────────────────────────────
  private fogLayers: Phaser.GameObjects.Graphics[] = [];
  private godRays: Phaser.GameObjects.GameObject[] = [];
  private haze: Phaser.GameObjects.Rectangle | null = null;
  private particles: Particle[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];
  private particleTimer: Phaser.Time.TimerEvent | null = null;

  // ─── Act II (wastes) fields ──────────────────────────────────────────
  private wastesFogBands: WastesFogBand[] = [];
  private waterShimmerGfx: Phaser.GameObjects.Graphics | null = null;
  private waterShimmers: WaterShimmer[] = [];

  // ─── Act III (city) fields ───────────────────────────────────────────
  private rainGfx: Phaser.GameObjects.Graphics | null = null;
  private rainDrops: RainDrop[] = [];
  private splashGfx: Phaser.GameObjects.Graphics | null = null;
  private splashes: Splash[] = [];
  private lightningOverlay: Phaser.GameObjects.Rectangle | null = null;
  private nextLightningTime = 0;
  private neonRects: Phaser.GameObjects.Rectangle[] = [];
  private ashGfx: Phaser.GameObjects.Graphics | null = null;
  private ashParticles: AshParticle[] = [];

  constructor(scene: Phaser.Scene, theme: RegionTheme, worldWidth: number) {
    this.scene = scene;
    this.theme = theme;
    this.worldWidth = worldWidth;
  }

  build(): void {
    // ⚠️ Stage 2.2: Wastes + City skip the legacy fog bands + depth haze.
    // The painted backdrop art already provides atmospheric color and depth.
    // Procedural fog bands (Graphics with tweens) and depth haze (MULTIPLY
    // overlay) were double-darkening the painted art.
    // God rays + ambient particles are KEPT — they're cheap and add life.
    if (this.theme !== 'wastes' && this.theme !== 'city') {
      this.buildFog();
      this.buildDepthHaze();
    }

    this.buildGodRays();
    this.buildAmbientParticles();

    // ─── Act II (wastes): moving fog + water reflection ─────────────────
    if (this.theme === 'wastes') {
      this.buildWastesFog();
      this.buildWaterReflection();
    }

    // ─── Act III (city): rain + lightning + neon pulse + ash ────────────
    if (this.theme === 'city') {
      this.buildRain();
      this.buildLightning();
      this.buildNeonPulse();
      this.buildAshParticles();
    }
  }

  // ─── FOG (forest/factory) ─────────────────────────────────────────────
  private buildFog(): void {
    const fogColor = this.theme === 'forest' ? 0x40a060 : 0x6a5a4a;
    const fogCount = 4;
    for (let i = 0; i < fogCount; i++) {
      const g = this.scene.add.graphics();
      g.setDepth(80 - i * 2);
      g.setScrollFactor(0.15 + i * 0.1, 0.05);
      g.setAlpha(0.06 + i * 0.025);

      // Draw wide soft horizontal fog band
      const yBase = GAME.HEIGHT - 80 - i * 40;
      const bandH = 120;
      const segments = 16;
      const segW = (this.worldWidth * 1.5) / segments;
      for (let s = 0; s < segments; s++) {
        const x = s * segW;
        const yOffset = Math.sin(s + i * 1.7) * 20;
        g.fillStyle(fogColor, 0.5);
        g.fillEllipse(x + segW / 2, yBase + yOffset, segW * 1.2, bandH);
      }
      this.fogLayers.push(g);

      // Slow horizontal drift tween
      this.tweens.push(this.scene.tweens.add({
        targets: g, x: -200, duration: 30000 + i * 8000, repeat: -1, ease: 'Sine.inOut',
        onRepeat: (_t) => { /* wraps naturally due to width overflow */ },
      }));
    }
  }

  // ─── GOD RAYS (volumetric light shafts from above) ────────────────────
  private buildGodRays(): void {
    const rayColor = this.theme === 'forest' ? 0xa0ffd0 : 0xffd080;
    const rayCount = this.theme === 'forest' ? 5 : 3;
    const rayIntensity = this.theme === 'forest' ? 0.12 : 0.06;

    for (let i = 0; i < rayCount; i++) {
      const x = (i + 0.5) * (this.worldWidth / rayCount) + (Math.random() - 0.5) * 200;
      const rayWidth = 60 + Math.random() * 80;
      const ray = this.scene.add.triangle(
        x, GAME.HEIGHT / 2,
        -rayWidth / 2, -GAME.HEIGHT,
        rayWidth / 2, -GAME.HEIGHT,
        rayWidth * 2, GAME.HEIGHT,
        rayColor, rayIntensity,
      );
      ray.setBlendMode(Phaser.BlendModes.ADD);
      ray.setDepth(1);
      ray.setScrollFactor(0.3, 0.0);  // subtle parallax
      ray.setAlpha(rayIntensity);
      this.godRays.push(ray);

      // Gentle sway (rotation)
      this.tweens.push(this.scene.tweens.add({
        targets: ray,
        rotation: { from: -0.04, to: 0.04 },
        duration: 8000 + i * 2000,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      }));
      // Subtle alpha flicker
      this.tweens.push(this.scene.tweens.add({
        targets: ray,
        alpha: { from: rayIntensity * 0.6, to: rayIntensity * 1.4 },
        duration: 4000 + i * 1000,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      }));
    }
  }

  // ─── AMBIENT PARTICLES (embers / spores / dust motes) ─────────────────
  private buildAmbientParticles(): void {
    // Pool of reusable particles
    const poolSize = this.theme === 'forest' ? 60 : 40;
    for (let i = 0; i < poolSize; i++) {
      const p = this.createParticle();
      this.particles.push(p);
      // Stagger initial spawn
      this.respawnParticle(p, Math.random() * 8000);
    }

    // Continuous emitter — periodically respawn dead particles
    this.particleTimer = this.scene.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        for (const p of this.particles) {
          if (!p.alive) this.respawnParticle(p);
        }
      },
    });
  }

  private createParticle(): Particle {
    const color = this.theme === 'forest'
      ? [0x80ff80, 0xa0ffc0, 0x40ff80][Math.floor(Math.random() * 3)]
      : this.theme === 'wastes'
        ? [0x6a8a50, 0x5a7a40, 0x8a9a60][Math.floor(Math.random() * 3)]  // sickly green-gray
        : this.theme === 'factory'
          ? [0xffc040, 0xff8040, 0xffaa30][Math.floor(Math.random() * 3)]
          : 0xa0a0a0;
    const size = 0.8 + Math.random() * 1.6;
    const go = this.scene.add.circle(-100, -100, size, color, 0);
    go.setBlendMode(Phaser.BlendModes.ADD);
    go.setDepth(85);
    return { go, vx: 0, vy: 0, life: 0, maxLife: 0, alive: false };
  }

  private respawnParticle(p: Particle, delay: number = 0): void {
    if (delay > 0) {
      this.scene.time.delayedCall(delay, () => { if (p.go.active) this.doRespawn(p); });
    } else {
      this.doRespawn(p);
    }
  }

  private doRespawn(p: Particle): void {
    // Spawn near camera viewport (so particles always visible)
    const cam = this.scene.cameras.main;
    const viewX = cam.scrollX;
    const viewW = cam.width;
    p.go.x = viewX + Math.random() * viewW;
    p.go.y = this.theme === 'forest'
      ? Math.random() * GAME.HEIGHT
      : GAME.HEIGHT - 50 - Math.random() * 200;

    const baseAlpha = this.theme === 'forest' ? 0.5 : 0.7;
    p.go.setAlpha(baseAlpha * (0.5 + Math.random() * 0.5));
    p.vx = (Math.random() - 0.5) * 0.4;
    p.vy = this.theme === 'forest' ? -(0.2 + Math.random() * 0.4) : -(0.1 + Math.random() * 0.3);  // drift up
    p.life = 0;
    p.maxLife = 4000 + Math.random() * 4000;
    p.alive = true;
  }

  // ─── DEPTH HAZE (subtle distance fade) ────────────────────────────────
  private buildDepthHaze(): void {
    // ⚠️ Stage 2.2: wastes branch removed (buildDepthHaze not called for wastes).
    const hazeColor = this.theme === 'forest' ? 0x0a1a10 : 0x0a0805;
    this.haze = this.scene.add.rectangle(
      GAME.WIDTH / 2, GAME.HEIGHT / 2,
      GAME.WIDTH, GAME.HEIGHT,
      hazeColor, 0.15,
    );
    this.haze.setDepth(95);
    this.haze.setScrollFactor(0);
    this.haze.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  // ══════════════════════════════════════════════════════════════════════
  // ─── ACT II (wastes) — MOVING FOG + WATER REFLECTION ──────────────────
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Moving fog — 4 semi-transparent dark-green horizontal fog bands that
   * drift across the screen at different speeds and Y positions (parallax).
   *
   * Each band is drawn once as a periodic pattern (period = segmentWidth),
   * then the Graphics object's x is updated each frame and wrapped by exactly
   * one segmentWidth — making the wrap visually seamless.
   */
  private buildWastesFog(): void {
    const bandCount = 4;
    const fogColor = 0x2a4030;     // dark green
    const segmentWidth = 250;      // pattern repeat period

    for (let i = 0; i < bandCount; i++) {
      const bandHeight = 80 + i * 15;
      const y = 180 + i * 110;            // different Y positions
      const alpha = 0.05 + i * 0.015;     // 0.05–0.095 (within 0.05–0.1 spec)
      const speed = 8 + i * 4;            // 8, 12, 16, 20 px/s (parallax)

      const g = this.scene.add.graphics();
      g.setDepth(80 - i * 2);
      g.setScrollFactor(0.2 + i * 0.1, 0.05);  // parallax per band
      g.setAlpha(alpha);
      g.x = 0;
      g.y = y;

      // Draw a periodic pattern spanning worldWidth + 2 segments of margin.
      // Pattern repeats every segmentWidth → wrap by segmentWidth is invisible.
      g.fillStyle(fogColor, 1);
      const totalWidth = this.worldWidth + segmentWidth * 2;
      const segments = Math.ceil(totalWidth / segmentWidth) + 1;
      for (let s = 0; s <= segments; s++) {
        const x = s * segmentWidth;
        // Subtle vertical variation per ellipse — same on every period because
        // we use a small fixed yOffsets table indexed by (s % table.length).
        const yOffsets = [0, 8, -6, 12, -10, 4];
        const yOff = yOffsets[s % yOffsets.length];
        g.fillEllipse(x, yOff, segmentWidth * 1.4, bandHeight);
      }

      this.wastesFogBands.push({ gfx: g, x: 0, speed, segmentWidth });
    }
  }

  /**
   * Water reflection — 18 small 2×1 rectangles near the bottom of the screen
   * (y in 625..715) that flicker randomly each frame, simulating the
   * shimmering surface of standing water.
   *
   * One Graphics object is cleared+redrawn per frame (cheap for 18 rects).
   * Spread across the full worldWidth (world-space X, screen-space Y).
   */
  private buildWaterReflection(): void {
    this.waterShimmerGfx = this.scene.add.graphics();
    this.waterShimmerGfx.setDepth(82);
    // World-space X (spreads across worldWidth), screen-space Y (always bottom).
    this.waterShimmerGfx.setScrollFactor(1, 0);

    const count = 18;
    for (let i = 0; i < count; i++) {
      this.waterShimmers.push({
        x: Math.random() * this.worldWidth,
        y: 625 + Math.random() * (GAME.HEIGHT - 630),
        baseAlpha: 0.2 + Math.random() * 0.3,
        flickerSpeed: 0.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // ─── ACT III (city) — RAIN + LIGHTNING + NEON PULSE + ASH ─────────────
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Rain — 40-50 diagonal raindrop lines drawn on a single Graphics object.
   * lineStyle(1, 0x4060a0, 0.3). 8-15px long, 300-500px/s. Slight diagonal
   * angle (~14°). When a drop goes off-screen bottom, reset to top with new
   * random X across worldWidth.
   *
   * Replaces the prior Line-per-drop implementation (v1.0) with a single
   * Graphics redraw per frame — fewer draw calls, same visual result.
   */
  private buildRain(): void {
    if (!QualityManager.isRainEnabled()) return;

    this.rainGfx = this.scene.add.graphics();
    this.rainGfx.setDepth(90);
    this.rainGfx.setScrollFactor(1, 0);

    // Splash graphics (for ground impact)
    this.splashGfx = this.scene.add.graphics();
    this.splashGfx.setDepth(91);
    this.splashGfx.setScrollFactor(1, 0);

    // Enhanced rain: 80-100 drops with depth variation + mixed fine/coarse (per user round-23)
    const qCount = QualityManager.getRainCount();
    const targetCount = Math.min(120, Math.max(90, qCount * 2));
    for (let i = 0; i < targetCount; i++) {
      const depth = Math.random();
      const isFine = Math.random() < 0.35;  // 35% are fine mist drops
      if (isFine) {
        // Fine mist: tiny, fast, faint — reads as atmospheric haze
        this.rainDrops.push({
          x: Math.random() * this.worldWidth,
          y: Math.random() * GAME.HEIGHT,
          speed: 200 + Math.random() * 150,   // 200-350 px/s
          length: 2 + Math.random() * 3,       // 2-5 px (barely visible dots)
          alpha: 0.06 + Math.random() * 0.08,  // 0.06-0.14 (very faint)
          width: 1,
          isFine: true,
        });
      } else {
        // Coarse streaks: visible diagonal lines (existing behavior)
        this.rainDrops.push({
          x: Math.random() * this.worldWidth,
          y: Math.random() * GAME.HEIGHT,
          speed: 250 + depth * 350,
          length: 6 + depth * 12,
          alpha: 0.12 + depth * 0.38,
          width: depth > 0.6 ? 2 : 1,
          isFine: false,
        });
      }
    }
  }

  /**
   * Lightning — random screen-wide flash every 8-15 seconds.
   * Uses scene.cameras.main.flash(150, 200, 220, 255) (bluish-white) plus a
   * brief white overlay rectangle for an extra "pop". Also plays a 'thunder'
   * SFX if registered in AudioSystem (silently no-ops otherwise).
   *
   * Timing is checked per-frame in updateLightning() using scene.time.now,
   * per task spec — no recursive delayedCall.
   */
  private buildLightning(): void {
    this.lightningOverlay = this.scene.add.rectangle(
      GAME.WIDTH / 2, GAME.HEIGHT / 2,
      GAME.WIDTH, GAME.HEIGHT,
      0xffffff, 0,
    );
    this.lightningOverlay.setDepth(96);
    this.lightningOverlay.setScrollFactor(0);                 // fixed to screen
    this.lightningOverlay.setBlendMode(Phaser.BlendModes.ADD);

    // Schedule first strike — 8-15s
    this.nextLightningTime = this.scene.time.now + 8000 + Math.random() * 7000;
  }

  private triggerLightning(): void {
    // ── Camera flash (bluish-white, 150ms) ──
    this.scene.cameras.main.flash(150, 200, 220, 255);

    // ── White overlay rectangle (brief bright pop, then fade) ──
    if (this.lightningOverlay) {
      this.lightningOverlay.setAlpha(0.5);
      this.scene.time.delayedCall(80, () => {
        if (this.lightningOverlay?.active) this.lightningOverlay.setAlpha(0.15);
      });
      this.scene.time.delayedCall(180, () => {
        if (this.lightningOverlay?.active) this.lightningOverlay.setAlpha(0);
      });
    }

    // ── Thunder sound (silently no-ops if 'thunder' isn't registered) ──
    AudioSystem.play('thunder' as unknown as SfxName);
  }

  /**
   * Neon pulse — 4 colored rectangles (cyan, magenta, amber, green) at fixed
   * positions on the background layer (depth 3, ADD blend). Each rectangle
   * has its own breathing tween with different duration & delay, simulating
   * distant neon signs flickering on and off.
   */
  private buildNeonPulse(): void {
    const colors = [0x00ffff, 0xff00ff, 0xffaa00, 0x00ff80];  // cyan, magenta, amber, green
    const positions = [
      { x: this.worldWidth * 0.15, y: 150, w: 60, h: 200 },
      { x: this.worldWidth * 0.35, y: 100, w: 80, h: 250 },
      { x: this.worldWidth * 0.65, y: 120, w: 50, h: 180 },
      { x: this.worldWidth * 0.85, y: 80,  w: 70, h: 220 },
    ];
    const count = Math.min(colors.length, positions.length);

    for (let i = 0; i < count; i++) {
      const pos = positions[i];
      const rect = this.scene.add.rectangle(pos.x, pos.y, pos.w, pos.h, colors[i], 0);
      rect.setOrigin(0.5, 0);
      rect.setDepth(3);                                       // background layer
      rect.setBlendMode(Phaser.BlendModes.ADD);
      rect.setAlpha(0);
      this.neonRects.push(rect);

      // Breathing tween — different duration & delay per rectangle
      this.tweens.push(this.scene.tweens.add({
        targets: rect,
        alpha: { from: 0.05, to: 0.22 },
        duration: 2500 + i * 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
        delay: i * 600,
      }));
    }
  }

  /**
   * Ash particles — 22 small brown-gray circles drifting upward slowly with
   * horizontal sway. radius 1-2px, color 0x4a4030, alpha 0.1-0.3. Each
   * particle has a random lifespan and resets when it goes off-screen top
   * (or its lifespan expires).
   *
   * Drawn on a single Graphics object (cleared+redrawn per frame).
   */
  private buildAshParticles(): void {
    this.ashGfx = this.scene.add.graphics();
    this.ashGfx.setDepth(85);
    this.ashGfx.setScrollFactor(1, 0);   // world-space X, screen-space Y

    const count = 22;
    for (let i = 0; i < count; i++) {
      this.ashParticles.push(this.createAshParticle(true));
    }
  }

  private createAshParticle(initial: boolean): AshParticle {
    const baseX = Math.random() * this.worldWidth;
    return {
      x: baseX,
      y: initial ? Math.random() * GAME.HEIGHT : GAME.HEIGHT + Math.random() * 60,
      baseX,
      vy: -(0.15 + Math.random() * 0.25),     // slow upward drift
      baseAlpha: 0.1 + Math.random() * 0.2,   // 0.1-0.3
      radius: 1 + Math.random(),              // 1-2 px
      swayAmp: 5 + Math.random() * 15,
      swayFreq: 0.5 + Math.random(),
      phase: Math.random() * Math.PI * 2,
      life: 0,
      maxLife: 4000 + Math.random() * 4000,
    };
  }

  private respawnAshParticle(p: AshParticle): void {
    const fresh = this.createAshParticle(false);
    // In-place copy so the array reference stays valid
    p.x = fresh.x;
    p.y = fresh.y;
    p.baseX = fresh.baseX;
    p.vy = fresh.vy;
    p.baseAlpha = fresh.baseAlpha;
    p.radius = fresh.radius;
    p.swayAmp = fresh.swayAmp;
    p.swayFreq = fresh.swayFreq;
    p.phase = fresh.phase;
    p.life = 0;
    p.maxLife = fresh.maxLife;
  }

  // ══════════════════════════════════════════════════════════════════════
  // ─── UPDATE ───────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  /** Per-frame update — moves particles, fog, rain, lightning timer, ash. */
  update(deltaMs: number): void {
    // Existing: ambient particles (embers / spores / dust motes)
    this.updateParticles(deltaMs);

    // ── Act II (wastes) ──
    if (this.theme === 'wastes') {
      this.updateWastesFog(deltaMs);
      this.updateWaterShimmer();
    }

    // ── Act III (city) ──
    if (this.theme === 'city') {
      this.updateRain(deltaMs);
      this.updateLightning();
      this.updateAsh(deltaMs);
    }
  }

  private updateParticles(deltaMs: number): void {
    for (const p of this.particles) {
      if (!p.alive || !p.go.active) continue;
      p.life += deltaMs;
      if (p.life >= p.maxLife) {
        p.alive = false;
        p.go.setAlpha(0);
        continue;
      }
      p.go.x += p.vx * deltaMs * 0.06;
      p.go.y += p.vy * deltaMs * 0.06;
      // Fade out near end of life
      const fadeT = p.life / p.maxLife;
      const baseAlpha = this.theme === 'forest' ? 0.5 : 0.7;
      if (fadeT > 0.7) {
        p.go.setAlpha(baseAlpha * (1 - (fadeT - 0.7) / 0.3));
      }
    }
    // God ray breathing is handled by tweens (rotation + alpha flicker set
    // in buildGodRays). No per-frame update needed here.
  }

  private updateWastesFog(deltaMs: number): void {
    const dt = deltaMs * 0.001;  // seconds
    for (const band of this.wastesFogBands) {
      band.x += band.speed * dt;
      // Wrap when band has drifted a full segmentWidth — seamless because
      // the drawn pattern is periodic with that exact period.
      if (band.x >= band.segmentWidth) {
        band.x -= band.segmentWidth;
      }
      // Drift left (gfx.x decreases as band.x increases)
      band.gfx.x = -band.x;
    }
  }

  private updateWaterShimmer(): void {
    if (!this.waterShimmerGfx) return;
    const gfx = this.waterShimmerGfx;
    gfx.clear();

    const t = this.scene.time.now * 0.001;
    for (const s of this.waterShimmers) {
      // Combine a slow sin wave with per-frame random noise → flicker
      const wave = (Math.sin(t * s.flickerSpeed + s.phase) + 1) * 0.5;
      const noise = Math.random() * 0.4;
      const alpha = Math.max(0, Math.min(0.6, s.baseAlpha * wave * 0.5 + noise * 0.3));
      // 2px wide × 1px tall horizontal line (spec)
      gfx.fillStyle(0x6090a0, alpha);
      gfx.fillRect(s.x, s.y, 2, 1);
    }
  }

  private updateRain(deltaMs: number): void {
    if (!this.rainGfx) return;
    const gfx = this.rainGfx;
    gfx.clear();

    const splashGfx = this.splashGfx;
    if (splashGfx) splashGfx.clear();

    // Slight diagonal angle (~14°) — wind effect
    const angle = 0.25;
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);
    const dt = deltaMs * 0.001;
    const groundY = GAME.HEIGHT - 60;  // where rain hits ground

    for (const drop of this.rainDrops) {
      // Move drop
      drop.x += sinA * drop.speed * dt;
      drop.y += cosA * drop.speed * dt;

      // Check ground impact → create splash (only for coarse drops, not fine mist)
      if (drop.y > groundY) {
        if (!drop.isFine && drop.alpha > 0.2 && splashGfx && this.splashes.length < 30) {
          this.splashes.push({
            x: drop.x,
            y: groundY,
            life: 200,   // 200ms splash life
            maxLife: 200,
            size: 2 + drop.width,
          });
        }
        // Reset drop to top
        drop.y = -20;
        drop.x = Math.random() * this.worldWidth;
      }
      // Wrap horizontally
      if (drop.x > this.worldWidth + 20) drop.x = -20;
      if (drop.x < -20) drop.x = this.worldWidth + 20;

      // Draw with per-drop alpha and width (depth variation)
      if (drop.isFine) {
        // Fine mist: draw as tiny point (not a line) — reads as atmospheric haze
        gfx.fillStyle(0x6080a0, drop.alpha);
        gfx.fillCircle(drop.x, drop.y, 1);
      } else {
        // Coarse streak: visible diagonal line
        gfx.lineStyle(drop.width, 0x5070a0, drop.alpha);
        gfx.lineBetween(
          drop.x, drop.y,
          drop.x + sinA * drop.length,
          drop.y + cosA * drop.length,
        );
      }
    }

    // Draw + update splashes
    if (splashGfx) {
      for (let i = this.splashes.length - 1; i >= 0; i--) {
        const s = this.splashes[i];
        s.life -= deltaMs;
        if (s.life <= 0) {
          this.splashes.splice(i, 1);
          continue;
        }
        const pct = s.life / s.maxLife;
        const alpha = pct * 0.4;
        const radius = s.size * (1 + (1 - pct) * 2);  // expand as it fades
        splashGfx.lineStyle(1, 0x6080a0, alpha);
        splashGfx.strokeCircle(s.x, s.y, radius);
      }
    }
  }

  private updateLightning(): void {
    if (this.scene.time.now < this.nextLightningTime) return;
    this.triggerLightning();
    // Schedule next strike — 8-15s
    this.nextLightningTime = this.scene.time.now + 8000 + Math.random() * 7000;
  }

  private updateAsh(deltaMs: number): void {
    if (!this.ashGfx) return;
    const gfx = this.ashGfx;
    gfx.clear();

    const t = this.scene.time.now * 0.001;
    const dt = deltaMs * 0.001;

    for (const p of this.ashParticles) {
      p.life += deltaMs;
      // Drift upward (slow)
      p.y += p.vy * dt * 60;
      // Horizontal sway — oscillate around baseX
      p.x = p.baseX + Math.sin(t * p.swayFreq + p.phase) * p.swayAmp;

      // Reset when off-screen top OR lifespan expired
      if (p.y < -10 || p.life >= p.maxLife) {
        this.respawnAshParticle(p);
        continue;
      }

      // Alpha fade near end of life
      let alpha = p.baseAlpha;
      if (p.life > p.maxLife * 0.8) {
        alpha = p.baseAlpha * (1 - (p.life - p.maxLife * 0.8) / (p.maxLife * 0.2));
      }

      // Color 0x4a4030 per spec — small brown-gray ash
      gfx.fillStyle(0x4a4030, alpha);
      gfx.fillCircle(p.x, p.y, p.radius);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // ─── DESTROY ──────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  /** Destroy all atmosphere layers. Call on cleanupPlay. */
  destroy(): void {
    this.tweens.forEach(tw => { if (tw && tw.isPlaying()) tw.stop(); });
    this.tweens = [];
    this.particleTimer?.remove();
    this.particleTimer = null;

    // Existing effects
    this.fogLayers.forEach(f => { if (f && f.active) f.destroy(); });
    this.fogLayers = [];
    this.godRays.forEach(r => { if (r && r.active) r.destroy(); });
    this.godRays = [];
    this.particles.forEach(p => { if (p.go && p.go.active) p.go.destroy(); });
    this.particles = [];
    if (this.haze && this.haze.active) { this.haze.destroy(); this.haze = null; }

    // Act II (wastes)
    this.wastesFogBands.forEach(b => { if (b.gfx && b.gfx.active) b.gfx.destroy(); });
    this.wastesFogBands = [];
    if (this.waterShimmerGfx && this.waterShimmerGfx.active) {
      this.waterShimmerGfx.destroy();
      this.waterShimmerGfx = null;
    }
    this.waterShimmers = [];

    // Act III (city)
    if (this.rainGfx && this.rainGfx.active) { this.rainGfx.destroy(); this.rainGfx = null; }
    this.rainDrops = [];
    if (this.splashGfx && this.splashGfx.active) { this.splashGfx.destroy(); this.splashGfx = null; }
    this.splashes = [];
    if (this.lightningOverlay && this.lightningOverlay.active) {
      this.lightningOverlay.destroy();
      this.lightningOverlay = null;
    }
    this.nextLightningTime = 0;
    this.neonRects.forEach(r => { if (r && r.active) r.destroy(); });
    this.neonRects = [];
    if (this.ashGfx && this.ashGfx.active) { this.ashGfx.destroy(); this.ashGfx = null; }
    this.ashParticles = [];
  }
}

export default AtmosphereSystem;
