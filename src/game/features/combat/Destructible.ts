/**
 * MECHA: LAST PROTOCOL - Destructible structures
 *
 * Per the ragdoll-destruction-combat skill:
 *   Destructible structures = bodies pinned together, pins removed under damage.
 *   Matter constraints don't self-break on load by default — you decide when to cut.
 *
 * A destructible is a Matter body with HP. When HP reaches 0, the support
 * constraint is removed and the body becomes dynamic (falls/collapses).
 */
import Phaser from 'phaser';
import { COLORS } from '../../shared/Constants';
import { bodyConfig } from '../physics/CollisionLayers';
import { Effects } from '../../shared/Effects';

export interface Destructible {
  base: Phaser.Physics.Matter.Image;       // static support
  platform: Phaser.Physics.Matter.Image;   // the part that falls when destroyed
  support: MatterJS.ConstraintType;         // the pin that gets cut
  visual: Phaser.GameObjects.Rectangle;     // visible rectangle
  hp: number;
  maxHp: number;
  id: string;
  destroyed: boolean;
}

export class DestructibleManager {
  private destructibles: Destructible[] = [];

  constructor(private scene: Phaser.Scene) {}

  /**
   * Build a destructible tower: a static base + a platform pinned on top.
   * The platform stays rigid until the support constraint is removed.
   */
  buildTower(x: number, y: number, w: number, h: number, hp = 3): Destructible {
    // Base (static, invisible — just for collision)
    const base = this.scene.matter.add.image(x, y + h / 2 + 10, '__white', undefined, {
      ...bodyConfig('solid', { label: `destructible-base-${x}`, isStatic: true }),
    });
    base.setDisplaySize(w, 20);
    base.setAlpha(0);

    // Platform (the visible part that will fall when destroyed)
    const platform = this.scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig('solid', { label: `destructible-platform-${x}`, isStatic: true }),
    });
    platform.setDisplaySize(w, h);
    platform.setTint(COLORS.METAL);
    platform.setData('entityType', 'destructible');
    platform.setData('destructibleId', `dest-${x}-${Date.now()}`);

    // Visible rectangle (stays in sync with platform position)
    const visual = this.scene.add.rectangle(x, y, w, h, COLORS.METAL, 1);
    visual.setStrokeStyle(2, COLORS.RUST, 0.5);
    visual.setDepth(5);

    // Support constraint (rigid until cut)
    const support = this.scene.matter.add.constraint(base, platform, 0, 0.95, {
      pointA: { x: 0, y: 0 },
      pointB: { x: 0, y: -h / 2 },
    });

    const dest: Destructible = {
      base,
      platform,
      support,
      visual,
      hp,
      maxHp: hp,
      id: platform.getData('destructibleId') as string,
      destroyed: false,
    };
    this.destructibles.push(dest);
    return dest;
  }

  /** Apply damage to a destructible. Returns true if destroyed this call. */
  damage(dest: Destructible, amount: number, hitX?: number, hitY?: number): boolean {
    if (dest.destroyed) return false;
    dest.hp -= amount;
    // Visual feedback: flash + crack
    dest.visual.setFillStyle(COLORS.METAL_DARK);
    this.scene.time.delayedCall(100, () => {
      if (!dest.destroyed) dest.visual.setFillStyle(COLORS.METAL);
    });
    // Screen shake scaled with damage
    this.scene.cameras.main.shake(80, 0.003 * amount);

    if (dest.hp <= 0) {
      this.destroy(dest, hitX, hitY);
      return true;
    }
    return false;
  }

  /** Destroy a destructible: remove support constraint, make platform dynamic. */
  private destroy(dest: Destructible, hitX?: number, hitY?: number): void {
    dest.destroyed = true;
    // Cut the support constraint
    try {
      this.scene.matter.world.removeConstraint(dest.support);
    } catch { /* already removed */ }
    // Make the platform dynamic so it falls
    Phaser.Physics.Matter.Matter.Body.setStatic(dest.platform.body as MatterJS.BodyType, false);
    // Apply force from the hit point (or center) for a satisfying collapse
    const body = dest.platform.body as MatterJS.BodyType;
    if (body) {
      const fx = hitX ?? dest.platform.x;
      const fy = hitY ?? dest.platform.y;
      Phaser.Physics.Matter.Matter.Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * 0.02,
        y: 0.01,  // slight downward push
      });
      // Random spin
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.15);
    }
    // Visual: tint darker + spawn debris particles
    dest.visual.setFillStyle(COLORS.METAL_DARK);
    this.spawnDebris(dest.platform.x, dest.platform.y);
    Effects.play('explosion');
    // Bigger screen shake on collapse
    this.scene.cameras.main.shake(200, 0.01);
  }

  /** Spawn small debris particles (visual only, not physics bodies). */
  private spawnDebris(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      const s = this.scene.add.rectangle(
        x + (Math.random() - 0.5) * 20,
        y + (Math.random() - 0.5) * 20,
        3 + Math.random() * 4,
        3 + Math.random() * 4,
        COLORS.RUST,
        0.9
      );
      s.setDepth(6);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * speed,
        y: y + Math.sin(a) * speed + 40,
        rotation: Math.random() * Math.PI * 4,
        alpha: 0,
        duration: 600 + Math.random() * 400,
        onComplete: () => s.destroy(),
      });
    }
  }

  /** Check if a position overlaps any destructible — used for projectile hits. */
  getDestructibleAt(x: number, y: number, radius = 20): Destructible | null {
    for (const d of this.destructibles) {
      if (d.destroyed) continue;
      const dx = d.platform.x - x;
      const dy = d.platform.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < radius + 20) {
        return d;
      }
    }
    return null;
  }

  /** Update: sync visual positions with physics bodies. */
  update(): void {
    for (const d of this.destructibles) {
      if (d.platform && d.platform.active && d.visual) {
        d.visual.setPosition(d.platform.x, d.platform.y);
        d.visual.setRotation(d.platform.rotation);
      }
    }
  }

  /** Clear all destructibles (on scene shutdown). */
  clear(): void {
    this.destructibles.forEach(d => {
      try { this.scene.matter.world.removeConstraint(d.support); } catch { /* */ }
      try { d.base.destroy(); } catch { /* */ }
      try { d.platform.destroy(); } catch { /* */ }
      try { d.visual.destroy(); } catch { /* */ }
    });
    this.destructibles = [];
  }

  get count(): number { return this.destructibles.length; }
}

export default DestructibleManager;
