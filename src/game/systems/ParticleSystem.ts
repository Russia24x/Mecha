/**
 * MECHA: LAST PROTOCOL — Particle System
 * Visual effects: sparks, explosions, dust, smoke.
 * Independent — called by any system that needs visual feedback.
 */
import Phaser from 'phaser';
import { AudioSystem } from './AudioSystem';

export class ParticleSystem {
  constructor(private scene: Phaser.Scene) {}

  sparks(x: number, y: number, color: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      const p = this.scene.add.circle(x, y, 1 + Math.random() * 2, color, 0.9);
      p.setDepth(20);
      this.scene.tweens.add({
        targets: p, x: x + Math.cos(a) * speed, y: y + Math.sin(a) * speed,
        alpha: 0, scale: 0.3, duration: 200 + Math.random() * 200,
        onComplete: () => p.destroy(),
      });
    }
  }

  explosion(x: number, y: number, color = 0xff6040, scale = 1.0): void {
    AudioSystem.play('explosion');
    const flash = this.scene.add.circle(x, y, 10 * scale, 0xffffff, 0.9);
    flash.setDepth(25);
    this.scene.tweens.add({
      targets: flash, alpha: 0, scale: 3 * scale,
      duration: 150, onComplete: () => flash.destroy(),
    });
    const ring = this.scene.add.circle(x, y, 8 * scale, color, 0.8);
    ring.setStrokeStyle(3, 0xffffff, 0.9);
    ring.setDepth(24);
    this.scene.tweens.add({
      targets: ring, alpha: 0, scale: 4 * scale,
      duration: 300, onComplete: () => ring.destroy(),
    });
    this.sparks(x, y, color, 10 + Math.floor(scale * 6));
    for (let i = 0; i < 4; i++) {
      const s = this.scene.add.circle(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 6 + Math.random() * 6, 0x333333, 0.4);
      s.setDepth(23);
      this.scene.tweens.add({
        targets: s, y: y - 30 - Math.random() * 20, alpha: 0, scale: 2,
        duration: 600 + Math.random() * 400, onComplete: () => s.destroy(),
      });
    }
  }

  dust(x: number, y: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.random() - 0.5) * Math.PI;
      const speed = 30 + Math.random() * 50;
      const d = this.scene.add.circle(x, y, 3 + Math.random() * 3, 0x6a6a7a, 0.5);
      d.setDepth(8);
      this.scene.tweens.add({
        targets: d, x: x + Math.cos(a) * speed, y: y - 10 - Math.random() * 15,
        alpha: 0, scale: 1.5, duration: 400 + Math.random() * 200,
        onComplete: () => d.destroy(),
      });
    }
  }

  screenFlash(color: number, intensity: number, duration: number): void {
    const flash = this.scene.add.rectangle(0, 0, 2000, 2000, color, intensity);
    flash.setOrigin(0, 0).setScrollFactor(0).setDepth(150);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration, onComplete: () => flash.destroy(),
    });
  }

  afterimage(x: number, y: number, w: number, h: number, color: number, facing: number): void {
    const ghost = this.scene.add.rectangle(x, y, w, h, color, 0.5);
    ghost.setDepth(13);
    ghost.setScale(facing, 1);
    ghost.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ghost, alpha: 0, scale: 0.6,
      duration: 260, ease: 'Quad.easeOut', onComplete: () => ghost.destroy(),
    });
  }
}

export default ParticleSystem;
