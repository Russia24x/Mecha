/**
 * MECHA: LAST PROTOCOL - DamageSystem
 * Centralized damage dispatch + VFX for hits.
 * The Boss, Enemies, and Player all expose a `takeDamage()` method —
 * this system routes the DamageEvent, applies knockback, and spawns FX.
 *
 * Combat juice (per ragdoll-destruction-combat skill):
 *   - Hit-stop: drop timeScale briefly on heavy hits (2-4 frames)
 *   - Screen shake: scale intensity with damage
 *   - Knockback: applyForce along hit normal
 */
import Phaser from 'phaser';
import type { DamageEvent } from '../../shared/Types';

export class DamageSystem {
  private sparks: Phaser.GameObjects.Arc[] = [];
  // Hit-stop state
  private hitStopUntil = 0;
  private originalTimeScale = 1;

  constructor(private scene: Phaser.Scene) {}

  /** Resolve a DamageEvent: look up target entity, apply damage, spawn FX. */
  dealDamage(event: DamageEvent): void {
    // Find target body by label.
    // M2 fix: use getAllBodies() (recursive) instead of localWorld.bodies (top-level only).
    const bodies = this.scene.matter.world.getAllBodies();
    const target = bodies.find(b => b.label === event.target || (b as unknown as { gameObject?: { getData: (k: string) => string } }).gameObject?.getData('id') === event.target);
    if (!target) return;
    const go = (target as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
    if (!go) return;
    const entity = go.getData('entity') as { takeDamage?: (n: number) => void } | undefined;
    if (!entity?.takeDamage) return;

    const actuallyDamaged = (() => {
      const result = entity.takeDamage(event.amount) as unknown;
      return result !== false;
    })();

    if (actuallyDamaged && event.point) {
      this.spawnHitFx(event.point.x, event.point.y, event.type);
      // Hit-stop: scale duration with damage (40ms base + 2ms per damage point, capped at 120ms)
      const stopMs = Math.min(120, 40 + event.amount * 2);
      this.triggerHitStop(stopMs);
      // Screen shake: scale with damage
      const shakeIntensity = Math.min(0.02, 0.004 + event.amount * 0.0008);
      this.scene.cameras.main.shake(150, shakeIntensity);
    }
    if (actuallyDamaged && event.knockback && !target.isStatic) {
      // Knockback along hit normal
      Phaser.Physics.Matter.Matter.Body.applyForce(target, target.position, {
        x: event.knockback.x,
        y: event.knockback.y,
      });
    }
  }

  /**
   * Hit-stop: briefly slow down the Matter engine timeScale for a "weighty" hit feel.
   * Drops to 0.05 for the specified duration, then ramps back to 1.
   */
  private triggerHitStop(durationMs: number): void {
    const engine = this.scene.matter.world.engine;
    if (!engine) return;
    this.hitStopUntil = this.scene.time.now + durationMs;
    engine.timing.timeScale = 0.05;
    // Ramp back up after the stop window
    this.scene.time.delayedCall(durationMs, () => {
      if (this.scene.time.now >= this.hitStopUntil - 10) {
        engine.timing.timeScale = this.originalTimeScale;
      }
    });
  }

  /** Quick melee-range damage using direct entity reference. */
  damageEntity(entity: { takeDamage?: (n: number) => void }, amount: number, x?: number, y?: number): void {
    if (!entity?.takeDamage) return;
    entity.takeDamage(amount);
    if (x !== undefined && y !== undefined) this.spawnHitFx(x, y, 'melee');
  }

  spawnHitFx(x: number, y: number, type: string): void {
    const color = type === 'melee' ? 0xffffff : type === 'energy' ? 0x66f0ff : 0xffd040;
    // ring
    const ring = this.scene.add.circle(x, y, 4, color, 0.7);
    ring.setDepth(40);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 1, to: 5 },
      alpha: { from: 0.7, to: 0 },
      duration: 260,
      onComplete: () => ring.destroy(),
    });
    // sparks
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      const s = this.scene.add.circle(x, y, 2, color, 0.9);
      s.setDepth(41);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * speed,
        y: y + Math.sin(a) * speed,
        alpha: 0,
        duration: 240 + Math.random() * 200,
        onComplete: () => s.destroy(),
      });
    }
  }

  spawnSpark(x: number, y: number, color: number, count = 4): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      const s = this.scene.add.circle(x, y, 2, color, 0.9);
      s.setDepth(41);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * speed,
        y: y + Math.sin(a) * speed,
        alpha: 0,
        duration: 200,
        onComplete: () => s.destroy(),
      });
    }
  }

  spawnSlash(x: number, y: number, dir: number): void {
    const slash = this.scene.add.triangle(
      x, y,
      -20, -24,
      24, 0,
      -20, 24,
      0xffffff, 0.55
    );
    slash.setScale(dir, 1);
    slash.setDepth(35);
    this.scene.tweens.add({
      targets: slash,
      alpha: { from: 0.55, to: 0 },
      scale: { from: dir, to: dir * 1.4 },
      duration: 180,
      onComplete: () => slash.destroy(),
    });
  }
}

export default DamageSystem;
