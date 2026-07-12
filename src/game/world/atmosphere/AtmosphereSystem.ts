/**
 * MECHA: LAST PROTOCOL — AtmosphereSystem v1.0
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
 * Per Phaser 4 skill (filters-and-postfx, particles, cameras):
 *   - Fog = multiple translucent Graphics stripes with slow x-drift tween
 *   - God rays = gradient triangles (ADD blend) with subtle sway
 *   - Particles = Phaser.GameObjects.Arc pool, recycled, ADD blend
 *   - All effects scrollFactor locked so they move with camera at depth
 *
 * Lifecycle:
 *   - Tied to PLAY state only — destroyed in cleanupPlay (effect separation)
 *   - Per region: factory = amber dust + ember sparks + dim god rays
 *                  forest = green spores + thick fog + bright god rays
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import type { RegionTheme } from './ParallaxBackground';

interface Particle {
  go: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  alive: boolean;
}

export class AtmosphereSystem {
  private scene: Phaser.Scene;
  private theme: RegionTheme;
  private worldWidth: number;
  private fogLayers: Phaser.GameObjects.Graphics[] = [];
  private godRays: Phaser.GameObjects.GameObject[] = [];
  private haze: Phaser.GameObjects.Rectangle | null = null;
  private particles: Particle[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];
  private particleTimer: Phaser.Time.TimerEvent | null = null;
  private rayTime = 0;

  constructor(scene: Phaser.Scene, theme: RegionTheme, worldWidth: number) {
    this.scene = scene;
    this.theme = theme;
    this.worldWidth = worldWidth;
  }

  build(): void {
    this.buildFog();
    this.buildGodRays();
    this.buildAmbientParticles();
    this.buildDepthHaze();
  }

  // ─── FOG ────────────────────────────────────────────────────────────────
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

  // ─── GOD RAYS (volumetric light shafts from above) ──────────────────────
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

  // ─── AMBIENT PARTICLES (embers / spores / dust motes) ───────────────────
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

  // ─── DEPTH HAZE (subtle distance fade) ──────────────────────────────────
  private buildDepthHaze(): void {
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

  /** Per-frame update — moves particles, sweeps god rays. */
  update(deltaMs: number): void {
    // Update particles
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

    // Subtle god ray breathing (already handled by tweens, but we can add global sway)
    this.rayTime += deltaMs;
  }

  /** Destroy all atmosphere layers. Call on cleanupPlay. */
  destroy(): void {
    this.tweens.forEach(tw => { if (tw && tw.isPlaying()) tw.stop(); });
    this.tweens = [];
    this.particleTimer?.remove();
    this.particleTimer = null;
    this.fogLayers.forEach(f => { if (f && f.active) f.destroy(); });
    this.fogLayers = [];
    this.godRays.forEach(r => { if (r && r.active) r.destroy(); });
    this.godRays = [];
    this.particles.forEach(p => { if (p.go && p.go.active) p.go.destroy(); });
    this.particles = [];
    if (this.haze && this.haze.active) { this.haze.destroy(); this.haze = null; }
  }
}

export default AtmosphereSystem;
