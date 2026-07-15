/**
 * MECHA: LAST PROTOCOL - PhysicsWorld
 * Thin wrapper around Phaser's Matter.js integration.
 * Exposes high-level helpers used by other features.
 */
import Phaser from 'phaser';
import { PHYSICS } from '../../shared/Constants';
import { bodyConfig } from './CollisionLayers';
import type { EntityCategory } from '../../shared/Types';

export class PhysicsWorld {
  constructor(private scene: Phaser.Scene) {}

  /** Add a static rectangle (e.g. a tile / wall). */
  addStaticRect(x: number, y: number, w: number, h: number, cat: EntityCategory = 'solid'): Phaser.Physics.Matter.Image {
    const obj = this.scene.matter.add.image(x, y, '__white', undefined, {
      isStatic: true,
      ...bodyConfig(cat, { label: `solid-${x}-${y}` }),
    });
    obj.setDisplaySize(w, h);
    obj.setVisible(false);
    obj.setFriction(0);
    return obj;
  }

  /** Add a sensor rectangle — detects overlap but no physical response. */
  addSensor(x: number, y: number, w: number, h: number, label: string): Phaser.Physics.Matter.Image {
    const obj = this.scene.matter.add.image(x, y, '__white', undefined, {
      isStatic: true,
      isSensor: true,
      ...bodyConfig('sensor', { label }),
    });
    obj.setDisplaySize(w, h);
    obj.setVisible(false);
    return obj;
  }

  /**
   * Raycast: cast a segment from A to B, return closest hit body or null.
   * M1 fix: 5th arg of intersectRay is ray WIDTH (pixels), not a body cap.
   * Sort hits by distance so we return the closest body.
   */
  raycast(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2): MatterBody | null {
    const hits = this.scene.matter.intersectRay(
      from.x, from.y, to.x, to.y, 1
    ) as MatterBody[];
    if (hits.length === 0) return null;
    // Sort by distance from origin, return closest.
    hits.sort((a, b) =>
      Phaser.Math.Distance.Between(from.x, from.y, a.position.x, a.position.y) -
      Phaser.Math.Distance.Between(from.x, from.y, b.position.x, b.position.y)
    );
    return hits[0];
  }

  /**
   * Get all bodies currently overlapping a rectangular area.
   * M1 fix: use intersectRect (auto-uses all world bodies) instead of
   * query.region which required a bodies array + Bounds.
   */
  bodiesInArea(x: number, y: number, radius: number): MatterBody[] {
    return this.scene.matter.intersectRect(x - radius, y - radius, radius * 2, radius * 2) as MatterBody[];
  }

  /** Apply a knockback impulse to a body. */
  applyKnockback(body: MatterJS.BodyType, dir: Phaser.Math.Vector2, force: number): void {
    if (!body || body.isStatic) return;
    Phaser.Physics.Matter.Matter.Body.applyForce(body, body.position, {
      x: dir.x * force,
      y: dir.y * force,
    });
  }

  static gravity(): { x: number; y: number } {
    return { x: 0, y: PHYSICS.GRAVITY_Y };
  }
}

export type MatterBody = MatterJS.BodyType;
export default PhysicsWorld;
