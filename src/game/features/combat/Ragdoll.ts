/**
 * MECHA: LAST PROTOCOL - Ragdoll system
 *
 * Per the ragdoll-destruction-combat skill:
 *   Ragdoll = state swap, not physics-only character.
 *   On death: destroy sprite + spawn compound of loosely-pinned parts.
 *   Loose pin joints (low stiffness ~0.4, damping ~0.1) for floppy motion.
 *   Random torque/off-center impulse at spawn for "no two deaths look the same".
 *   Inherited velocity so death reads as continuation of hit.
 *
 * Pool cap: ~30-40 ragdoll groups. Destroy oldest when cap hit.
 */
import Phaser from 'phaser';
import { bodyConfig } from '../physics/CollisionLayers';

interface RagdollParts {
  head: Phaser.Physics.Matter.Image;
  torso: Phaser.Physics.Matter.Image;
  armL: Phaser.Physics.Matter.Image;
  armR: Phaser.Physics.Matter.Image;
  legL: Phaser.Physics.Matter.Image;
  legR: Phaser.Physics.Matter.Image;
  constraints: MatterJS.ConstraintType[];
  spawnedAt: number;
}

export class Ragdoll {
  private static pool: RagdollParts[] = [];
  private static readonly POOL_CAP = 30;
  private static readonly LIFETIME_MS = 6000;  // despawn after 6s

  /**
   * Spawn a ragdoll at (x, y) with the given color + inherited velocity.
   * The ragdoll is a compound of 6 Matter bodies pinned together loosely.
   */
  static spawn(
    scene: Phaser.Scene,
    x: number,
    y: number,
    color: number,
    inheritedVx: number,
    inheritedVy: number
  ): void {
    // Cap the pool — destroy oldest if at limit
    if (this.pool.length >= this.POOL_CAP) {
      const oldest = this.pool.shift();
      if (oldest) this.destroyParts(scene, oldest);
    }

    // Create parts as small Matter images
    const parts: Partial<RagdollParts> = {};
    // Torso
    parts.torso = scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig('enemy', { label: 'ragdoll-torso', frictionAir: 0.02, density: 0.002 }),
    });
    parts.torso.setDisplaySize(20, 24);
    parts.torso.setTint(color);
    parts.torso.setFriction(0.4, 0.02, 0.6);
    parts.torso.setBounce(0.15);
    // Head
    parts.head = scene.matter.add.image(x, y - 18, '__white', undefined, {
      ...bodyConfig('enemy', { label: 'ragdoll-head', frictionAir: 0.02, density: 0.001 }),
    });
    parts.head.setDisplaySize(12, 12);
    parts.head.setTint(color);
    parts.head.setFriction(0.4, 0.02, 0.6);
    parts.head.setBounce(0.2);
    // Arms
    parts.armL = scene.matter.add.image(x - 12, y - 4, '__white', undefined, {
      ...bodyConfig('enemy', { label: 'ragdoll-armL', frictionAir: 0.03, density: 0.001 }),
    });
    parts.armL.setDisplaySize(6, 14);
    parts.armL.setTint(color);
    parts.armL.setFriction(0.4, 0.02, 0.6);
    parts.armR = scene.matter.add.image(x + 12, y - 4, '__white', undefined, {
      ...bodyConfig('enemy', { label: 'ragdoll-armR', frictionAir: 0.03, density: 0.001 }),
    });
    parts.armR.setDisplaySize(6, 14);
    parts.armR.setTint(color);
    parts.armR.setFriction(0.4, 0.02, 0.6);
    // Legs
    parts.legL = scene.matter.add.image(x - 6, y + 16, '__white', undefined, {
      ...bodyConfig('enemy', { label: 'ragdoll-legL', frictionAir: 0.03, density: 0.0015 }),
    });
    parts.legL.setDisplaySize(7, 16);
    parts.legL.setTint(color);
    parts.legL.setFriction(0.4, 0.02, 0.6);
    parts.legR = scene.matter.add.image(x + 6, y + 16, '__white', undefined, {
      ...bodyConfig('enemy', { label: 'ragdoll-legR', frictionAir: 0.03, density: 0.0015 }),
    });
    parts.legR.setDisplaySize(7, 16);
    parts.legR.setTint(color);
    parts.legR.setFriction(0.4, 0.02, 0.6);

    // Pin parts together with loose constraints
    const constraints: MatterJS.ConstraintType[] = [];
    const pin = (a: Phaser.Physics.Matter.Image, b: Phaser.Physics.Matter.Image, ax: number, ay: number, bx: number, by: number) => {
      const c = scene.matter.add.constraint(a, b, 4, 0.4, {
        pointA: { x: ax, y: ay },
        pointB: { x: bx, y: by },
        damping: 0.1,
      });
      constraints.push(c);
    };
    // Torso ↔ Head
    pin(parts.torso!, parts.head!, 0, -12, 0, 6);
    // Torso ↔ Arms
    pin(parts.torso!, parts.armL!, -8, -8, 0, -6);
    pin(parts.torso!, parts.armR!, 8, -8, 0, -6);
    // Torso ↔ Legs
    pin(parts.torso!, parts.legL!, -5, 12, 0, -8);
    pin(parts.torso!, parts.legR!, 5, 12, 0, -8);

    // Apply inherited velocity to all parts
    Object.values(parts).forEach(p => {
      if (p && p.setVelocity) {
        p.setVelocity(inheritedVx, inheritedVy);
      }
    });

    // Random torque + off-center impulse for "no two deaths look the same"
    const randomTorque = (Math.random() - 0.5) * 0.3;
    const impulseAngle = Math.random() * Math.PI * 2;
    const impulsePower = 0.005 + Math.random() * 0.01;
    if (parts.torso?.body) {
      Phaser.Physics.Matter.Matter.Body.applyForce(
        parts.torso.body as MatterJS.BodyType,
        parts.torso.body.position,
        { x: Math.cos(impulseAngle) * impulsePower, y: Math.sin(impulseAngle) * impulsePower - 0.003 }
      );
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(
        parts.torso.body as MatterJS.BodyType,
        randomTorque
      );
    }

    const ragdoll: RagdollParts = {
      head: parts.head!,
      torso: parts.torso!,
      armL: parts.armL!,
      armR: parts.armR!,
      legL: parts.legL!,
      legR: parts.legR!,
      constraints,
      spawnedAt: scene.time.now,
    };
    this.pool.push(ragdoll);
  }

  /** Update: despawn ragdolls that have lived past their lifetime. */
  static update(scene: Phaser.Scene): void {
    const now = scene.time.now;
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const r = this.pool[i];
      if (now - r.spawnedAt > this.LIFETIME_MS) {
        this.destroyParts(scene, r);
        this.pool.splice(i, 1);
      }
    }
  }

  /** Destroy all parts + constraints of a ragdoll. */
  private static destroyParts(scene: Phaser.Scene, r: RagdollParts): void {
    r.constraints.forEach(c => {
      try { scene.matter.world.removeConstraint(c); } catch { /* already removed */ }
    });
    [r.head, r.torso, r.armL, r.armR, r.legL, r.legR].forEach(p => {
      try { p.destroy(); } catch { /* already destroyed */ }
    });
  }

  /** Clear the entire pool (on scene shutdown). */
  static clear(scene: Phaser.Scene): void {
    this.pool.forEach(r => this.destroyParts(scene, r));
    this.pool = [];
  }

  static get count(): number { return this.pool.length; }
}

export default Ragdoll;
