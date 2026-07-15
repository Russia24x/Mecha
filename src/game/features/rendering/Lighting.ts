/**
 * MECHA: LAST PROTOCOL - Lighting
 * Dynamic light system using radial gradients drawn on a RenderTexture
 * or, for performance, a small pool of light-sprite containers.
 * Lights: player glow, boss glow, projectile lights, ambient flicker.
 */
import Phaser from 'phaser';
import { COLORS, GAME } from '../../shared/Constants';

interface Light {
  go: Phaser.GameObjects.Arc;
  baseRadius: number;
  intensity: number;
  follow?: () => Phaser.Math.Vector2;
  flicker: number;
}

export class Lighting {
  private darkness: Phaser.GameObjects.Rectangle;
  private lights: Light[] = [];
  private ambientFlicker = 1;

  constructor(scene: Phaser.Scene) {
    // A semi-transparent dark overlay that lights will be "punched through"
    // using blendMode ADD on bright circles.
    this.darkness = scene.add.rectangle(
      GAME.WIDTH / 2,
      GAME.HEIGHT / 2,
      GAME.WIDTH,
      GAME.HEIGHT,
      0x000010,
      0.55
    );
    this.darkness.setScrollFactor(0);
    this.darkness.setDepth(90);
    this.darkness.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

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
    if (idx >= 0) {
      this.lights.splice(idx, 1);
      l.go.destroy();
    }
  }

  update(timeMs: number): void {
    // global ambient flicker
    this.ambientFlicker = 0.92 + Math.sin(timeMs / 100) * 0.04 + Math.sin(timeMs / 33) * 0.04;
    // Iterate backwards so we can safely remove dead lights
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      if (l.follow) {
        try {
          const p = l.follow();
          if (!p || typeof p.x !== 'number') {
            // follow target is gone — remove this light
            this.removeLight(l);
            continue;
          }
          l.go.x = p.x;
          l.go.y = p.y;
        } catch {
          // follow callback threw (entity destroyed) — remove this light
          this.removeLight(l);
          continue;
        }
      }
      const flicker = 1 + (Math.random() - 0.5) * l.flicker;
      const r = l.baseRadius * flicker * this.ambientFlicker;
      l.go.setRadius(r);
    }
  }

  destroy(): void {
    this.lights.forEach(l => l.go.destroy());
    this.lights = [];
    this.darkness.destroy();
  }
}

export default Lighting;
