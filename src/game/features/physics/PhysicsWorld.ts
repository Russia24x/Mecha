/**
 * MECHA: LAST PROTOCOL - PhysicsWorld
 * Wrapper around Matter.js for static bodies, sensors, and queries.
 */

import Phaser from 'phaser';
import { PHYSICS } from '../../shared/Constants';
import { bodyConfig } from './CollisionLayers';
import type { MatterBodyConfig } from '../../shared/Types';

export type MatterBody = MatterJS.BodyType;

export class PhysicsWorld {
  constructor(private scene: Phaser.Scene) {}

  /** Add a static rectangular solid body. Returns the Matter image. */
  addStaticRect(x: number, y: number, w: number, h: number): Phaser.Physics.Matter.Image {
    const obj = this.scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig('solid', { isStatic: true }),
    } as MatterBodyConfig);
    obj.setDisplaySize(w, h);
    obj.setVisible(false);
    return obj;
  }

  /** Add a rectangular sensor (trigger zone). */
  addSensor(x: number, y: number, w: number, h: number, label: string): Phaser.Physics.Matter.Image {
    const obj = this.scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig(label, { isStatic: true, isSensor: true }),
    } as MatterBodyConfig);
    obj.setDisplaySize(w, h);
    obj.setVisible(false);
    return obj;
  }

  /** Raycast: return the closest hit body (sorted by distance). */
  raycast(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2): MatterBody | null {
    const hits = this.scene.matter.intersectRay(from.x, from.y, to.x, to.y, 1) as MatterBody[];
    if (hits.length === 0) return null;
    hits.sort((a, b) =>
      Phaser.Math.Distance.Between(from.x, from.y, a.position.x, a.position.y) -
      Phaser.Math.Distance.Between(from.x, from.y, b.position.x, b.position.y)
    );
    return hits[0];
  }

  static gravity(): { x: number; y: number } {
    return { x: 0, y: PHYSICS.GRAVITY_Y };
  }
}

export default PhysicsWorld;
