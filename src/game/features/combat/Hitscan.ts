/**
 * MECHA: LAST PROTOCOL - Hitscan system (Tier 1 projectiles)
 *
 * Per the weapon-systems-projectiles skill:
 *   Tier 1 — Hitscan: instant hit, no traveling sprite.
 *   Resolved via matter.intersectRay() immediately.
 *   Muzzle flash + tracer line visual only. Cheapest tier.
 *
 * Used by: Laser Lance weapon.
 */
import Phaser from 'phaser';
import { Effects } from '../../shared/Effects';
import { FloatingText } from '../ui/FloatingText';

export interface HitscanResult {
  hit: boolean;
  endPoint: Phaser.Math.Vector2;
  damage: number;
  hitEntity?: { takeDamage?: (n: number) => void };
}

export class Hitscan {
  /** Fire an instant ray and apply damage to the first hit. */
  static fire(
    scene: Phaser.Scene,
    origin: Phaser.Math.Vector2,
    angle: number,
    range: number,
    damage: number
  ): HitscanResult {
    const endX = origin.x + Math.cos(angle) * range;
    const endY = origin.y + Math.sin(angle) * range;

    // Cast a ray through Matter world.
    // C8 fix: intersectRay's 5th arg is ray width (pixels), NOT a body cap.
    // Pass a thin ray width and sort hits by distance so the closest target is hit first.
    const rawHits = scene.matter.intersectRay(origin.x, origin.y, endX, endY, 1) as MatterJS.BodyType[];
    // Sort by distance from origin so the closest hit is processed first.
    const hits = rawHits
      .map(b => ({ body: b, dist: Phaser.Math.Distance.Between(origin.x, origin.y, b.position.x, b.position.y) }))
      .sort((a, b) => a.dist - b.dist)
      .map(h => h.body);

    let endPoint = new Phaser.Math.Vector2(endX, endY);
    let hitEntity: { takeDamage?: (n: number) => void } | undefined;
    let hit = false;

    for (const body of hits) {
      const go = (body as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      if (!go) continue;
      const type = go.getData('entityType') as string | undefined;
      if (!type) continue;
      // Skip player's own projectiles
      if (type.startsWith('projectile-player')) continue;

      // Hit a solid wall → stop the beam here
      if (type === 'solid' || body.label.startsWith('solid')) {
        // Approximate hit point from body position
        endPoint = new Phaser.Math.Vector2(body.position.x, body.position.y);
        hit = true;
        break;
      }
      // Hit an enemy or boss → apply damage, stop beam
      if (type === 'enemy' || type === 'boss') {
        const entity = go.getData('entity') as { takeDamage?: (n: number) => void } | undefined;
        if (entity?.takeDamage) {
          entity.takeDamage(damage);
          hitEntity = entity;
          FloatingText.damage(body.position.x, body.position.y, damage, 0xff40ff);
          FloatingText.hitMarker(body.position.x, body.position.y);
        }
        endPoint = new Phaser.Math.Vector2(body.position.x, body.position.y);
        hit = true;
        break;
      }
    }

    // Draw tracer line (visual only — instant beam)
    Hitscan.drawTracer(scene, origin, endPoint);

    return { hit, endPoint, damage, hitEntity };
  }

  /** Draw a quick fading tracer line. */
  private static drawTracer(
    scene: Phaser.Scene,
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2
  ): void {
    const line = scene.add.line(
      0, 0,
      from.x, from.y,
      to.x, to.y,
      0xff40ff, 0.9
    );
    line.setOrigin(0, 0);
    line.setLineWidth(3);
    line.setDepth(30);
    // Fade out quickly
    scene.tweens.add({
      targets: line,
      alpha: 0,
      lineWidth: 0.5,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => line.destroy(),
    });
    // Muzzle flash at origin
    const flash = scene.add.circle(from.x, from.y, 6, 0xff80ff, 0.9);
    flash.setDepth(31);
    scene.tweens.add({
      targets: flash,
      scale: { from: 1, to: 2.5 },
      alpha: 0,
      duration: 100,
      onComplete: () => flash.destroy(),
    });
    // Hit spark at endpoint
    if (Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y) > 10) {
      const spark = scene.add.circle(to.x, to.y, 4, 0xffffff, 0.8);
      spark.setDepth(31);
      scene.tweens.add({
        targets: spark,
        scale: { from: 1, to: 3 },
        alpha: 0,
        duration: 150,
        onComplete: () => spark.destroy(),
      });
    }
    Effects.play('fire');
  }
}

export default Hitscan;
