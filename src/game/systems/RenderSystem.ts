/**
 * MECHA: LAST PROTOCOL — Rendering System
 * Darkness overlay + brightness + lights.
 * No ColorMatrix filters (removed due to rendering issues).
 * Independent — entities register lights via addLight().
 */
import Phaser from 'phaser';
import { COLORS, GAME } from '../shared/Constants';

interface Light {
  go: Phaser.GameObjects.Arc;
  baseRadius: number;
  intensity: number;
  flicker: number;
  follow?: () => Phaser.Math.Vector2;
}

export class RenderSystem {
  private darkness: Phaser.GameObjects.Rectangle;
  private lights: Light[] = [];

  private static brightness = 0.85;  // was 0.7 — too dark per user feedback
  private static readonly MAX_DARKNESS = 0.08;  // was 0.2 — was over-darkening the world
  private static _instances: RenderSystem[] = [];

  constructor(scene: Phaser.Scene) {
    const alpha = (1 - RenderSystem.brightness) * RenderSystem.MAX_DARKNESS;
    this.darkness = scene.add.rectangle(
      GAME.WIDTH / 2, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x000010, alpha
    );
    this.darkness.setScrollFactor(0);
    this.darkness.setDepth(90);
    this.darkness.setBlendMode(Phaser.BlendModes.MULTIPLY);
    RenderSystem._instances.push(this);
  }

  static setBrightness(b: number): void {
    RenderSystem.brightness = Phaser.Math.Clamp(b, 0, 1);
    for (const inst of RenderSystem._instances) {
      if (inst.darkness && inst.darkness.active) {
        inst.darkness.setAlpha((1 - RenderSystem.brightness) * RenderSystem.MAX_DARKNESS);
      }
    }
  }

  static getBrightness(): number { return RenderSystem.brightness; }

  addLight(opts: {
    follow?: () => Phaser.Math.Vector2;
    radius?: number;
    color?: number;
    intensity?: number;
    flicker?: number;
  }): Light {
    const scene = this.darkness.scene;
    const radius = opts.radius ?? 120;
    const color = opts.color ?? COLORS.LIGHT;
    const intensity = opts.intensity ?? 0.6;
    const flicker = opts.flicker ?? 0.1;
    const go = scene.add.circle(0, 0, radius, color, intensity);
    go.setBlendMode(Phaser.BlendModes.ADD);
    go.setDepth(91);
    const light: Light = { go, baseRadius: radius, intensity, flicker, follow: opts.follow };
    this.lights.push(light);
    return light;
  }

  removeLight(l: Light): void {
    const idx = this.lights.indexOf(l);
    if (idx >= 0) { this.lights.splice(idx, 1); l.go.destroy(); }
  }

  update(timeMs: number): void {
    const ambientFlicker = 0.92 + Math.sin(timeMs / 100) * 0.04 + Math.sin(timeMs / 33) * 0.04;
    // *** FIX: iterate backward by index — removeLight() splices mid-iteration
    // which causes for..of to skip the element after a removed one.
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      if (l.follow) {
        try {
          const p = l.follow();
          if (!p || typeof p.x !== 'number') { this.removeLight(l); continue; }
          l.go.x = p.x; l.go.y = p.y;
        } catch { this.removeLight(l); continue; }
      }
      const flicker = 1 + (Math.random() - 0.5) * l.flicker;
      l.go.setRadius(l.baseRadius * flicker * ambientFlicker);
    }
  }

  destroy(): void {
    const idx = RenderSystem._instances.indexOf(this);
    if (idx >= 0) RenderSystem._instances.splice(idx, 1);
    this.lights.forEach(l => l.go.destroy());
    this.lights = [];
    this.darkness.destroy();
  }
}

export default RenderSystem;
