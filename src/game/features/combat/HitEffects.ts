/**
 * MECHA: LAST PROTOCOL - HitEffects
 * Reusable particle / shader-driven effects for combat feedback.
 * Currently uses lightweight tweened primitives; can be upgraded to
 * Phaser 4 particle emitters later without touching callers.
 */
import Phaser from 'phaser';
import { COLORS } from '../../shared/Constants';

export class HitEffects {
  constructor(private scene: Phaser.Scene) {}

  /** Big explosion — used for boss death / heavy enemy death. */
  explosion(x: number, y: number, color = COLORS.SPARK, scale = 1): void {
    for (let i = 0; i < 24 * scale; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 240;
      const s = this.scene.add.circle(x, y, 3 * scale, color, 0.9);
      s.setDepth(45);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * speed,
        y: y + Math.sin(a) * speed,
        alpha: 0,
        scale: 0,
        duration: 600 + Math.random() * 400,
        ease: 'Cubic.easeOut',
        onComplete: () => s.destroy(),
      });
    }
    // shockwave
    const ring = this.scene.add.circle(x, y, 8 * scale, 0xffffff, 0.4);
    ring.setStrokeStyle(2, color, 0.9);
    ring.setDepth(44);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 1, to: 14 * scale },
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    // camera shake
    this.scene.cameras.main.shake(180, 0.008 * scale);
  }

  /** Quick smoke puff for landing on heavy ground. */
  smokePuff(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const s = this.scene.add.circle(x + (Math.random() - 0.5) * 16, y, 5 + Math.random() * 4, 0x404a5a, 0.4);
      s.setDepth(8);
      this.scene.tweens.add({
        targets: s,
        y: y - 40 - Math.random() * 20,
        x: x + (Math.random() - 0.5) * 40,
        alpha: 0,
        scale: 1.5,
        duration: 700 + Math.random() * 300,
        onComplete: () => s.destroy(),
      });
    }
  }

  /** Heat distortion style trail for projectiles. */
  energyTrail(x: number, y: number, color = COLORS.PROJECTILE): void {
    const t = this.scene.add.circle(x, y, 3, color, 0.6);
    t.setDepth(22);
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      scale: 0.3,
      duration: 240,
      onComplete: () => t.destroy(),
    });
  }

  /** Screen flash for major events (boss phase change, player hit). */
  screenFlash(color = 0xffffff, alpha = 0.4, durationMs = 200): void {
    const flash = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      color,
      alpha
    );
    flash.setScrollFactor(0);
    flash.setDepth(200);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: durationMs,
      onComplete: () => flash.destroy(),
    });
  }
}

export default HitEffects;
