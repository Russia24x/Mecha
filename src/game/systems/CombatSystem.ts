/**
 * MECHA: LAST PROTOCOL — Combat System
 * Handles damage dealing, hit-stop, screen shake.
 * Independent of Player/Enemy — works with any entity that has takeDamage().
 */
import Phaser from 'phaser';
import { AudioSystem } from './AudioSystem';

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
      // ⚠️ TEMPORARY: visual effects + camera shake + hit-stop disabled for FPS testing.
      // if (event.point) this.spawnHitFx(event.point.x, event.point.y);
      if (event.knockback && !target.isStatic) {
        // *** FIX: use Phaser's matter.add.applyForce which wraps Matter.Body.applyForce
        // This avoids the typing issue with Phaser.Physics.Matter.Matter namespace.
        // Force values are tiny (0.01-0.1) per audit §1.3; multiply by 50 for visible knockback.
        this.scene.matter.applyForce(
          go as Phaser.Types.Physics.Matter.MatterBody,
          { x: event.knockback.x * 50, y: event.knockback.y * 50 }
        );
      }
      // this.triggerHitStop(event.amount);
      // this.scene.cameras.main.shake(80, 0.003 + Math.min(event.amount * 0.0008, 0.01));
    }
  }

  spawnSlash(x: number, y: number, dir: number): void {
    // ⚠️ TEMPORARY: disabled for FPS testing.
    void x; void y; void dir; return;
  }

  private spawnHitFx(x: number, y: number): void {
    // ⚠️ TEMPORARY: disabled for FPS testing.
    void x; void y; return;
  }

  private triggerHitStop(damage: number): void {
    // ⚠️ TEMPORARY: hit-stop disabled for FPS testing.
    void damage; return;
  }
}

export default CombatSystem;
