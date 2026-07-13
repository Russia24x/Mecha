/**
 * MECHA: LAST PROTOCOL — Projectile Entity
 * Data-driven: uses WeaponData for all stats.
 * Hit detection uses TargetRegistry (O(m)) when available, falls back to
 * scene.children.list scan (O(n²)) otherwise.
 */
import Phaser from 'phaser';
import type { WeaponData } from '../../data/types';
import type { PhysicsSystem } from '../../systems/PhysicsSystem';
import { ParticleSystem } from '../../systems/ParticleSystem';
import { COLORS } from '../../shared/Constants';
import type { TargetRegistry } from './TargetRegistry';

export interface ProjectileOptions {
  speed: number;
  damage: number;
  ttl: number;
  owner: 'player' | 'enemy';
  color: number;
  size: number;
  weapon?: WeaponData;
  explosive?: boolean;
  explosionRadius?: number;
}

interface Damageable {
  takeDamage(amount: number): boolean;
}

interface HasTargetRegistry {
  targetRegistry?: TargetRegistry;
}

export class Projectile {
  public sprite: Phaser.Physics.Matter.Image;
  public damage: number;
  public owner: 'player' | 'enemy';
  public id: string;
  private bornAt: number;
  private alive = true;
  private trail: Phaser.GameObjects.Arc[] = [];
  private scene: Phaser.Scene;
  private physics: PhysicsSystem;
  private particles: ParticleSystem;
  private ttl: number;
  private weapon: WeaponData | undefined;
  private explosive: boolean;
  private explosionRadius: number;
  private registry: TargetRegistry | null;

  constructor(scene: Phaser.Scene, physics: PhysicsSystem, particles: ParticleSystem, pos: Phaser.Math.Vector2, dir: Phaser.Math.Vector2, opts: ProjectileOptions) {
    this.scene = scene;
    this.physics = physics;
    this.particles = particles;
    this.damage = opts.damage;
    this.owner = opts.owner;
    this.ttl = opts.ttl;
    this.weapon = opts.weapon;
    this.explosive = !!opts.explosive;
    this.explosionRadius = opts.explosionRadius ?? 0;
    // Resolve TargetRegistry from scene if attached (GameScene owns one).
    // Falls back to null → legacy scene.children scan path.
    this.registry = (scene as unknown as HasTargetRegistry).targetRegistry ?? null;

    const category = opts.owner === 'player' ? 0x0010 : 0x0020;
    const mask = opts.owner === 'player' ? 0x0001 | 0x0004 | 0x0008 : 0x0001 | 0x0002;

    // *** FIX: setDisplaySize BEFORE setRectangle (MatterImage scales body with display size)
    this.sprite = scene.matter.add.image(pos.x, pos.y, '__white', undefined, {
      label: `proj-${opts.owner}`,
      isSensor: true, frictionAir: 0, density: 0.0001,
      collisionFilter: { category, mask, group: 0 },
    });
    this.sprite.setDisplaySize(opts.size, opts.size);
    this.sprite.setRectangle(opts.size, opts.size, {
      label: `proj-${opts.owner}`,
      isSensor: true, frictionAir: 0, density: 0.0001,
      collisionFilter: { category, mask, group: 0 },
    });
    this.sprite.setTint(opts.color);
    this.sprite.setVelocity(dir.x * opts.speed, dir.y * opts.speed);
    this.sprite.setIgnoreGravity(true);
    this.sprite.setFixedRotation();
    this.sprite.setData('entityType', `projectile-${opts.owner}`);
    this.sprite.setData('damage', opts.damage);
    this.sprite.setData('owner', opts.owner);
    this.sprite.setData('projectile', this);
    this.id = `proj-${scene.time.now}-${Math.random().toString(36).slice(2, 7)}`;
    this.bornAt = scene.time.now;

    // Trail
    for (let i = 0; i < 4; i++) {
      const t = scene.add.circle(pos.x, pos.y, opts.size * 0.6, opts.color, 0.4 - i * 0.08);
      t.setDepth(12);
      this.trail.push(t);
    }
  }

  get isAlive(): boolean { return this.alive; }

  update(): void {
    if (!this.alive) return;
    const body = this.sprite.body;
    if (!body) { this.kill(); return; }
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      t.x = this.sprite.x - vx * (i + 1) * 0.6;
      t.y = this.sprite.y - vy * (i + 1) * 0.6;
    }
    if (this.scene.time.now - this.bornAt > this.ttl) { this.kill(); return; }
    if (this.sprite.x < -100 || this.sprite.x > 20000 || this.sprite.y < -200 || this.sprite.y > 1000) {
      this.kill(); return;
    }
    this.checkOverlaps();
  }

  private checkOverlaps(): void {
    const px = this.sprite.x;
    const py = this.sprite.y;

    // ── Solid collision via Matter spatial query (O(log n)) ──
    // Projectiles are sensors, so Matter won't fire collisionstart for them.
    // We query bodies overlapping the projectile's position directly.
    // This also fixes a latent bug: the legacy scene-children scan had
    // `if (!type) return;` which filtered out solids (they have no entityType),
    // so projectiles used to fly through walls.
    const bodies = this.physics.bodiesAtPoint(px, py);
    for (const body of bodies) {
      if (body === this.sprite.body) continue;
      if (body.label.startsWith('solid')) {
        if (this.explosive) { this.explode(); return; }
        this.kill();
        return;
      }
    }

    // ── Damageable targets via registry (O(m), m = enemies count) ──
    if (this.registry) {
      this.checkOverlapsRegistry(px, py);
    } else {
      this.checkOverlapsLegacy(px, py);
    }
  }

  /** Registry-based hit detection — O(m) where m is the number of relevant targets. */
  private checkOverlapsRegistry(px: number, py: number): void {
    if (!this.registry) return;
    if (this.owner === 'player') {
      // Player projectiles hit boss + enemies
      if (this.registry.boss) {
        this.tryHitEntity(px, py, this.registry.boss.sprite, this.registry.boss, 0xff8040);
        if (!this.alive) return;
      }
      for (const enemy of this.registry.enemies) {
        if (!this.alive) break;
        this.tryHitEntity(px, py, enemy.sprite, enemy, 0xff8040);
      }
    } else {
      // Enemy projectiles hit player
      if (this.registry.player) {
        this.tryHitEntity(px, py, this.registry.player.sprite, this.registry.player, 0xff4040);
      }
    }
  }

  /** Attempt to hit a single damageable target. */
  private tryHitEntity(
    px: number, py: number,
    sprite: Phaser.Physics.Matter.Image | null,
    entity: Damageable,
    sparkColor: number,
  ): void {
    if (!this.alive) return;
    if (!sprite || !sprite.active) return;
    const dx = sprite.x - px;
    const dy = sprite.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const displayW = (sprite as unknown as { displayWidth?: number }).displayWidth || 20;
    const displayH = (sprite as unknown as { displayHeight?: number }).displayHeight || 20;
    const hitRadius = Math.max(displayW, displayH) / 2 + 18;
    if (dist > hitRadius) return;

    if (entity.takeDamage) {
      entity.takeDamage(this.damage);
      this.particles.sparks(px, py, sparkColor, 4);
    }
    if (this.explosive) this.explode();
    else this.kill();
  }

  /** Legacy scan path — used when no TargetRegistry is attached to the scene. */
  private checkOverlapsLegacy(px: number, py: number): void {
    this.scene.children.list.forEach((go: Phaser.GameObjects.GameObject) => {
      if (!this.alive) return;
      const type = go.getData('entityType') as string | undefined;
      if (!type) return;
      if (type === `projectile-${this.owner}`) return;
      if (this.owner === 'player' && type === 'player') return;
      if (this.owner === 'enemy' && (type === 'enemy' || type === 'boss')) return;
      const sprite = go as unknown as Phaser.Physics.Matter.Image;
      if (!sprite.x && !sprite.y) return;
      const dx = sprite.x - px;
      const dy = sprite.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const displayW = (sprite as unknown as { displayWidth?: number }).displayWidth || 20;
      const displayH = (sprite as unknown as { displayHeight?: number }).displayHeight || 20;
      const hitRadius = Math.max(displayW, displayH) / 2 + 18;
      if (dist > hitRadius) return;

      if (this.owner === 'player' && (type === 'enemy' || type === 'boss')) {
        const entity = go.getData('entity') as Damageable | undefined;
        if (entity?.takeDamage) {
          entity.takeDamage(this.damage);
          this.particles.sparks(px, py, 0xff8040, 4);
        }
        if (this.explosive) this.explode();
        else this.kill();
        return;
      }
      if (this.owner === 'enemy' && type === 'player') {
        const entity = go.getData('entity') as Damageable | undefined;
        if (entity?.takeDamage) {
          entity.takeDamage(this.damage);
          this.particles.sparks(px, py, 0xff4040, 4);
        }
        this.kill();
        return;
      }
    });
  }

  private explode(): void {
    if (!this.alive) return;
    this.particles.explosion(this.sprite.x, this.sprite.y, COLORS.PROJECTILE, this.explosionRadius / 60);
    const bodies = this.physics.bodiesInCircle(this.sprite.x, this.sprite.y, this.explosionRadius);
    for (const body of bodies) {
      const go = (body as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      if (!go) continue;
      const type = go.getData('entityType') as string | undefined;
      const entity = go.getData('entity') as Damageable | undefined;
      if (entity?.takeDamage && (type === 'enemy' || type === 'boss')) {
        entity.takeDamage(this.damage);
      }
    }
    this.kill();
  }

  kill(): void {
    if (!this.alive) return;
    this.alive = false;
    this.trail.forEach(t => t.destroy());
    this.trail = [];
    if (this.sprite && this.sprite.active) this.sprite.destroy();
  }
}

export default Projectile;
