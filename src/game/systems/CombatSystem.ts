/**
 * MECHA: LAST PROTOCOL — Combat System
 * Handles damage dealing, hit-stop, screen shake.
 * Independent of Player/Enemy — works with any entity that has takeDamage().
 */
import Phaser from 'phaser';
import { AudioSystem } from './AudioSystem';

// Matter.js is exposed via Phaser.Physics.Matter.Matter (not a global in Phaser 4.2.1)
const MatterBody = Phaser.Physics.Matter.Matter.Body;

export interface DamageEvent {
  amount: number;
  type: 'bullet' | 'melee' | 'explosion' | 'contact';
  source: string;
  target: string;
  knockback?: { x: number; y: number };
  point?: { x: number; y: number };
}

interface Damageable {
  takeDamage(amount: number): boolean;
}

export class CombatSystem {
  private hitStopUntil = 0;
  private originalTimeScale = 1;

  constructor(private scene: Phaser.Scene) {}

  dealDamage(event: DamageEvent): void {
    const bodies = this.scene.matter.world.getAllBodies();
    const target = bodies.find(b =>
      b.label === event.target ||
      (b as unknown as { gameObject?: { getData: (k: string) => string } }).gameObject?.getData('id') === event.target
    );
    if (!target) return;
    const go = (target as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
    if (!go) return;
    const entity = go.getData('entity') as Damageable | undefined;
    if (!entity?.takeDamage) return;
    const damaged = entity.takeDamage(event.amount);
    if (damaged) {
      if (event.point) this.spawnHitFx(event.point.x, event.point.y);
      if (event.knockback && !target.isStatic) {
        MatterBody.applyForce(target, target.position, {
          x: event.knockback.x, y: event.knockback.y,
        });
      }
      this.triggerHitStop(event.amount);
      this.scene.cameras.main.shake(80, 0.003 + Math.min(event.amount * 0.0008, 0.01));
    }
  }

  spawnSlash(x: number, y: number, dir: number): void {
    const slash = this.scene.add.arc(x, y, 20, 0, Math.PI, false, 0xffffff, 0.6);
    slash.setDepth(18);
    slash.setScale(dir, 1);
    this.scene.tweens.add({
      targets: slash, alpha: 0, scale: dir * 1.5,
      duration: 150, onComplete: () => slash.destroy(),
    });
  }

  private spawnHitFx(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      const p = this.scene.add.circle(x, y, 1 + Math.random() * 2, 0xffd040, 0.9);
      p.setDepth(20);
      this.scene.tweens.add({
        targets: p, x: x + Math.cos(a) * speed, y: y + Math.sin(a) * speed,
        alpha: 0, scale: 0.3, duration: 200 + Math.random() * 150,
        onComplete: () => p.destroy(),
      });
    }
  }

  private triggerHitStop(damage: number): void {
    const now = this.scene.time.now;
    if (now < this.hitStopUntil) return;
    const duration = Math.min(40 + damage * 2, 120);
    this.hitStopUntil = now + duration;
    const engine = this.scene.matter.world.engine;
    this.originalTimeScale = engine.timing.timeScale;
    engine.timing.timeScale = 0.05;
    this.scene.time.delayedCall(duration, () => {
      engine.timing.timeScale = this.originalTimeScale;
    });
  }
}

export default CombatSystem;
