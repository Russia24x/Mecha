/**
 * MECHA: LAST PROTOCOL - Projectile
 * Lightweight pooled projectile used by both player + enemies.
 * Uses overlap detection in update() for reliable hit detection
 * (Matter.js collision events can be unreliable for fast bodies).
 */
import Phaser from 'phaser';
import { Effects } from '../../shared/Effects';
import { FloatingText } from '../ui/FloatingText';

export interface ProjectileOptions {
  speed: number;
  damage: number;
  ttl: number;            // ms
  owner: 'player' | 'enemy';
  color: number;
  size: number;
  explosive?: boolean;
  explosionRadius?: number;
  isLaser?: boolean;
}

export class Projectile {
  public sprite: Phaser.Physics.Matter.Image;
  public damage: number;
  public owner: 'player' | 'enemy';
  public id: string;
  private bornAt: number;
  private alive = true;
  private trail: Phaser.GameObjects.Arc[] = [];
  private dir: Phaser.Math.Vector2;
  private speed: number;
  private scene: Phaser.Scene;
  private explosive: boolean;
  private explosionRadius: number;
  private isLaser: boolean;
  private ttl: number;  // C7 fix: store ttl from opts (was hardcoded 1500)

  constructor(scene: Phaser.Scene, pos: Phaser.Math.Vector2, dir: Phaser.Math.Vector2, opts: ProjectileOptions) {
    this.scene = scene;
    this.dir = dir.clone();
    this.speed = opts.speed;
    this.explosive = !!opts.explosive;
    this.explosionRadius = opts.explosionRadius ?? 0;
    this.isLaser = !!opts.isLaser;
    this.ttl = opts.ttl ?? 1500;  // C7 fix: respect caller's ttl

    const category = opts.owner === 'player' ? 0x0010 : 0x0020;
    const mask = opts.owner === 'player'
      ? 0x0001 | 0x0004 | 0x0008 // solid | enemy | boss
      : 0x0001 | 0x0002;          // solid | player

    this.sprite = scene.matter.add.image(pos.x, pos.y, '__white', undefined, {
      label: `proj-${opts.owner}`,
      isSensor: true,             // sensor: no physical pushback, but we detect overlap
      frictionAir: 0,
      density: 0.0001,
      collisionFilter: { category, mask, group: 0 },
    });
    this.sprite.setDisplaySize(opts.size, opts.size);
    this.sprite.setTint(opts.color);
    this.sprite.setVelocity(dir.x * opts.speed, dir.y * opts.speed);
    this.sprite.setIgnoreGravity(true);
    this.sprite.setFixedRotation();
    this.sprite.setData('entityType', `projectile-${opts.owner}`);
    this.sprite.setData('damage', opts.damage);
    this.sprite.setData('owner', opts.owner);
    this.sprite.setData('projectile', this);
    this.damage = opts.damage;
    this.owner = opts.owner;
    this.id = `proj-${scene.time.now}-${Math.random().toString(36).slice(2, 7)}`;
    this.bornAt = scene.time.now;

    // Trail (more for laser)
    const trailCount = this.isLaser ? 8 : 4;
    for (let i = 0; i < trailCount; i++) {
      const t = scene.add.circle(pos.x, pos.y, opts.size * 0.7, opts.color, 0.4 - i * 0.08);
      t.setDepth(20);
      this.trail.push(t);
    }
  }

  get isAlive(): boolean {
    return this.alive;
  }

  /** Called every frame by the scene. Detects overlaps with potential targets. */
  update(scene: Phaser.Scene): void {
    if (!this.alive) return;
    // M3 fix: null-check body before accessing velocity (sprite may be destroyed mid-frame).
    const body = this.sprite.body;
    if (!body) { this.kill(); return; }
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    // Trail
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      t.x = this.sprite.x - vx * (i + 1) * 0.6;
      t.y = this.sprite.y - vy * (i + 1) * 0.6;
    }
    // TTL — C7 fix: use stored ttl instead of hardcoded 1500.
    if (scene.time.now - this.bornAt > this.ttl) {
      this.kill();
      return;
    }
    // Out of bounds — use stageData total width as upper bound.
    // Fallback to a large number if bounds unavailable (never kill by position in that case).
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    // Allow projectiles to travel the full stage width. We can't read world.bounds
    // directly in Phaser 4.2 (the property is undefined after setBounds).
    // Use a generous 20000px limit — larger than any stage (7680px).
    if (this.sprite.x < -100 || this.sprite.x > 20000 || this.sprite.y < -200 || this.sprite.y > sh + 200) {
      this.kill();
      return;
    }
    // Overlap check vs solids + enemies/boss/player
    this.checkOverlaps();
  }

  private checkOverlaps(): void {
    const px = this.sprite.x;
    const py = this.sprite.y;
    // Manual overlap check vs all relevant entities.
    // We can't rely on matter.query.region because Matter bodies are 1x1
    // (texture is 1x1, setDisplaySize doesn't update the physics body).
    // Instead, we iterate the scene's display list and check distance
    // against each entity's sprite position + display size.
    const scene = this.scene;
    const candidates: Phaser.GameObjects.GameObject[] = [];

    // Collect from the scene's children (cheap enough for MVP entity counts)
    scene.children.list.forEach((go: Phaser.GameObjects.GameObject) => {
      const type = go.getData('entityType') as string | undefined;
      if (!type) return;
      if (type === `projectile-${this.owner}`) return;
      if (this.owner === 'player' && type === 'player') return;
      if (this.owner === 'enemy' && (type === 'enemy' || type === 'boss')) return;
      candidates.push(go);
    });

    for (const go of candidates) {
      const type = go.getData('entityType') as string;
      const sprite = go as unknown as Phaser.Physics.Matter.Image;
      if (!sprite.x && !sprite.y) continue;
      const dx = sprite.x - px;
      const dy = sprite.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Hit radius = half of display width + bullet radius (generous for MVP)
      const displayW = (sprite as unknown as { displayWidth?: number }).displayWidth || 20;
      const displayH = (sprite as unknown as { displayHeight?: number }).displayHeight || 20;
      const hitRadius = Math.max(displayW, displayH) / 2 + 18;

      if (dist > hitRadius) continue;

      // Hit destructible crate → damage it
      if (type === 'destructible') {
        const hp = (go.getData('crateHp') as number) ?? 20;
        const newHp = hp - this.damage;
        go.setData('crateHp', newHp);
        FloatingText.damage(px, py, this.damage, 0xff8040);
        if (newHp <= 0) {
          // Destroy crate: remove visual + spawn debris
          const vis = go.getData('visual') as Phaser.GameObjects.GameObject | undefined;
          const visX = (vis as unknown as { x?: number })?.x ?? px;
          const visY = (vis as unknown as { y?: number })?.y ?? py;
          if (vis) {
            // Debris particles
            for (let j = 0; j < 8; j++) {
              const a = Math.random() * Math.PI * 2;
              const speed = 40 + Math.random() * 80;
              const d = this.scene.add.rectangle(visX, visY, 4 + Math.random() * 4, 4 + Math.random() * 4, 0x8a4a2a, 0.9);
              d.setDepth(6);
              this.scene.tweens.add({
                targets: d,
                x: visX + Math.cos(a) * speed,
                y: visY + Math.sin(a) * speed + 30,
                rotation: Math.random() * Math.PI * 4,
                alpha: 0,
                duration: 500,
                onComplete: () => d.destroy(),
              });
            }
            vis.destroy();
          }
          // Remove the physics body
          (go as Phaser.Physics.Matter.Image).destroy();
          Effects.play('explosion');
        } else {
          // Flash the crate (works for both Rectangle and Graphics visuals)
          const vis = go.getData('visual') as Phaser.GameObjects.GameObject | undefined;
          if (vis) {
            vis.setAlpha(0.4);
            this.scene.time.delayedCall(80, () => vis?.setAlpha(1));
          }
        }
        if (this.explosive) this.explode();
        else this.kill();
        return;
      }

      // Hit solid → just die (or explode)
      if (type === 'solid' || (sprite.body && (sprite.body as MatterJS.BodyType).label.startsWith('solid'))) {
        if (this.explosive) this.explode();
        else this.kill();
        return;
      }
      // Hit enemy/boss (player bullet)
      if (this.owner === 'player' && (type === 'enemy' || type === 'boss')) {
        const entity = go.getData('entity') as { takeDamage?: (n: number) => void } | undefined;
        if (this.explosive) {
          this.explode();
        } else {
          entity?.takeDamage?.(this.damage);
          FloatingText.damage(px, py, this.damage, this.isLaser ? 0xff40ff : 0xffe060, this.damage >= 30);
          FloatingText.hitMarker(px, py);
          this.kill();
        }
        return;
      }
      // Hit player (enemy bullet)
      if (this.owner === 'enemy' && type === 'player') {
        const entity = go.getData('entity') as { takeDamage?: (n: number) => void } | undefined;
        entity?.takeDamage?.(this.damage);
        FloatingText.damage(px, py, this.damage, 0xff5050);
        this.kill();
        return;
      }
    }
  }

  kill(): void {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
    this.trail.forEach(t => t.destroy());
    this.trail = [];
  }

  /** Explode: damage all enemies/boss within explosionRadius, then die. */
  private explode(): void {
    if (!this.alive) return;
    const px = this.sprite.x;
    const py = this.sprite.y;
    const r = this.explosionRadius;

    // Visual explosion
    const scene = this.scene;
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      const s = scene.add.circle(px, py, 4, 0xff8040, 0.9);
      s.setDepth(45);
      scene.tweens.add({
        targets: s,
        x: px + Math.cos(a) * speed,
        y: py + Math.sin(a) * speed,
        alpha: 0,
        scale: 0.3,
        duration: 500 + Math.random() * 300,
        onComplete: () => s.destroy(),
      });
    }
    const ring = scene.add.circle(px, py, 8, 0xffffff, 0.4);
    ring.setStrokeStyle(3, 0xff6030, 0.9);
    ring.setDepth(44);
    scene.tweens.add({
      targets: ring,
      scale: { from: 1, to: r / 8 },
      alpha: 0,
      duration: 450,
      onComplete: () => ring.destroy(),
    });
    scene.cameras.main.shake(150, 0.006);

    // Damage all enemies + boss in radius
    scene.children.list.forEach((go: Phaser.GameObjects.GameObject) => {
      const type = go.getData('entityType') as string | undefined;
      if (type !== 'enemy' && type !== 'boss') return;
      const sp = go as unknown as Phaser.GameObjects.Components.Transform & { x?: number; y?: number; getData: (k: string) => unknown };
      if (typeof sp.x !== 'number' || typeof sp.y !== 'number') return;
      const dx = sp.x - px;
      const dy = sp.y - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) return;
      // Falloff: full damage at center, 50% at edge
      const dmg = Math.round(this.damage * (1 - 0.5 * (d / r)));
      const entity = go.getData('entity') as { takeDamage?: (n: number) => void } | undefined;
      entity?.takeDamage?.(dmg);
    });

    Effects.play('explosion');
    this.kill();
  }
}

export default Projectile;
