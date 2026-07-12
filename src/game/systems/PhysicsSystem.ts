/**
 * MECHA: LAST PROTOCOL — Physics System
 * Matter.js wrapper. Creates static bodies, sensors, raycasts.
 * Independent of entities — just provides physics primitives.
 */
import Phaser from 'phaser';
import { PHYSICS } from '../shared/Constants';

export type MatterBody = MatterJS.BodyType;

export interface BodyConfig {
  label?: string;
  isStatic?: boolean;
  isSensor?: boolean;
  friction?: number;
  frictionAir?: number;
  density?: number;
  restitution?: number;
  fixedRotation?: boolean;
  ignoreGravity?: boolean;
  collisionFilter?: { category?: number; mask?: number; group?: number };
}

export class PhysicsSystem {
  constructor(private scene: Phaser.Scene) {}

  addStaticRect(x: number, y: number, w: number, h: number, label = 'solid'): Phaser.Physics.Matter.Image {
    // *** FIX: setDisplaySize BEFORE setRectangle (MatterImage scales body with display size)
    const obj = this.scene.matter.add.image(x, y, '__white', undefined, {
      label, isStatic: true,
    } as BodyConfig);
    obj.setDisplaySize(w, h);
    obj.setRectangle(w, h, { label, isStatic: true } as BodyConfig);
    obj.setVisible(false);
    return obj;
  }

  addSensor(x: number, y: number, w: number, h: number, label: string): Phaser.Physics.Matter.Image {
    const obj = this.scene.matter.add.image(x, y, '__white', undefined, {
      label, isStatic: true, isSensor: true,
    } as BodyConfig);
    obj.setDisplaySize(w, h);
    obj.setRectangle(w, h, { label, isStatic: true, isSensor: true } as BodyConfig);
    obj.setVisible(false);
    return obj;
  }

  addDynamicBody(x: number, y: number, w: number, h: number, config: BodyConfig): Phaser.Physics.Matter.Image {
    const obj = this.scene.matter.add.image(x, y, '__white', undefined, config);
    obj.setDisplaySize(w, h);
    obj.setRectangle(w, h, config);
    obj.setVisible(false);
    return obj;
  }

  raycastClosest(fromX: number, fromY: number, toX: number, toY: number, filterSolid = false): MatterBody | null {
    const hits = this.scene.matter.intersectRay(fromX, fromY, toX, toY, 1) as MatterBody[];
    if (hits.length === 0) return null;
    if (filterSolid) {
      const solids = hits.filter(b => b.label.startsWith('solid'));
      if (solids.length === 0) return null;
      solids.sort((a, b) =>
        Phaser.Math.Distance.Between(fromX, fromY, a.position.x, a.position.y) -
        Phaser.Math.Distance.Between(fromX, fromY, b.position.x, b.position.y)
      );
      return solids[0];
    }
    hits.sort((a, b) =>
      Phaser.Math.Distance.Between(fromX, fromY, a.position.x, a.position.y) -
      Phaser.Math.Distance.Between(fromX, fromY, b.position.x, b.position.y)
    );
    return hits[0];
  }

  hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number, selfBody?: MatterBody): boolean {
    const hits = this.scene.matter.intersectRay(fromX, fromY, toX, toY, 1) as MatterBody[];
    for (const b of hits) {
      if (selfBody && b === selfBody) continue;
      const go = (b as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      const type = go?.getData('entityType') as string | undefined;
      if (type === 'solid' || b.label.startsWith('solid')) return false;
    }
    return true;
  }

  bodiesInCircle(x: number, y: number, radius: number): MatterBody[] {
    // Approximate circle with bounding box (Phaser 4 Matter has no intersectCircle)
    return this.scene.matter.intersectRect(x - radius, y - radius, radius * 2, radius * 2) as MatterBody[];
  }

  bodiesAtPoint(x: number, y: number): MatterBody[] {
    return this.scene.matter.intersectPoint(x, y) as MatterBody[];
  }

  isGrounded(sprite: Phaser.Physics.Matter.Image, bodyRadius: number): boolean {
    const feetY = sprite.y + bodyRadius * 1.3;
    const hits = this.scene.matter.intersectPoint(sprite.x, feetY + 4) as MatterBody[];
    return hits.some(b => !b.isSensor && b.label.startsWith('solid'));
  }

  setWorldBounds(w: number, h: number): void {
    this.scene.matter.world.setBounds(0, 0, w, h, 32, true, true, true, true);
  }

  setGravity(x: number, y: number): void {
    this.scene.matter.world.setGravity(x, y);
  }

  static getGravity(): { x: number; y: number } {
    return { x: 0, y: PHYSICS.GRAVITY_Y };
  }
}

export default PhysicsSystem;
