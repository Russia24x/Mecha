/**
 * MECHA: LAST PROTOCOL - Enemy
 * Single class for all enemy types. Behavior switches on `this.type`.
 *
 * FSM: patrol | aggro | attack (telegraph→window→recovery) | cover | stagger
 * On death: spawn ragdoll with inherited velocity.
 */
import Phaser from 'phaser';
import { EventBus } from '../../shared/EventBus';
import { Effects } from '../../shared/Effects';
import { bodyConfig } from '../physics/CollisionLayers';
import { Ragdoll } from '../combat/Ragdoll';
import { Projectile } from '../combat/Projectile';
import { ENEMY_TYPES, nextEnemyId, type EnemyTypeId, type EnemyTypeData } from './EnemyTypes';

export type EnemyState = 'patrol' | 'aggro' | 'attack' | 'cover' | 'stagger';

export class Enemy {
  public sprite: Phaser.Physics.Matter.Image;
  public id: string;
  public type: EnemyTypeId;
  private data: EnemyTypeData;
  private health: number;
  private alive = true;
  private scene: Phaser.Scene;
  private projectiles: Projectile[];
  private flashUntil = 0;

  // FSM
  public state: EnemyState = 'patrol';
  private stateTime = 0;
  private attackPhase: 'telegraph' | 'window' | 'recovery' = 'telegraph';
  private telegraphGfx: Phaser.GameObjects.Arc | null = null;
  private hoverBase: number;
  private patrolDir = 1;
  private lungeDir = 1;
  private strafeDir = 1;
  private lastStrafeChange = 0;
  private lastFireAt = 0;
  // Telegraph-extra visuals (per-type telegraph cues)
  private telegraphExtra: Phaser.GameObjects.GameObject | null = null;
  // Cover state — low-HP retreat behavior (drone only)
  private coverUntil = 0;
  private coverDir = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyTypeId, projectiles: Projectile[]) {
    this.scene = scene;
    this.type = type;
    this.data = ENEMY_TYPES[type];
    this.id = nextEnemyId(type);
    this.health = this.data.hp;
    this.projectiles = projectiles;
    this.hoverBase = y;

    this.sprite = scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig('enemy', { label: this.id, frictionAir: 0.04, density: 0.003 }),
    });
    this.sprite.setDisplaySize(this.data.size.w, this.data.size.h);
    this.sprite.setAlpha(0); // physics only — visual drawn separately
    this.sprite.setFixedRotation();
    if (this.data.flying) this.sprite.setIgnoreGravity(true);
    this.sprite.setData('entity', this);
    this.sprite.setData('entityType', 'enemy');
    this.sprite.setData('id', this.id);
    this.buildVisual();
  }

  /** Detailed visual representation per enemy type. */
  private visualGfx: Phaser.GameObjects.Graphics | null = null;

  private buildVisual(): void {
    const c = this.data.color;
    const w = this.data.size.w;
    const h = this.data.size.h;
    const g = this.scene.add.graphics();
    g.setDepth(14);

    if (this.type === 'drone') {
      // Drone: hexagonal body + glowing eye + rotor blades
      g.fillStyle(0x1a1a2a, 1);
      g.fillCircle(0, 0, w / 2);
      g.lineStyle(2, c, 0.8);
      g.strokeCircle(0, 0, w / 2);
      g.fillStyle(c, 0.9);
      g.fillCircle(0, 0, 4);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(-1, -1, 2);
      g.lineStyle(2, 0x4a4a5a, 0.6);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        g.beginPath();
        g.moveTo(Math.cos(a) * w / 2, Math.sin(a) * h / 2);
        g.lineTo(Math.cos(a) * w * 0.8, Math.sin(a) * h * 0.8);
        g.strokePath();
      }
    } else if (this.type === 'spider') {
      // Spider: abdomen + head + red eyes + 6 legs
      g.fillStyle(0x2a1a0a, 1);
      g.fillEllipse(0, 0, w * 0.7, h * 0.8);
      g.fillStyle(c, 0.7);
      g.fillCircle(w * 0.15, 0, w * 0.25);
      g.fillStyle(0xff0000, 0.9);
      g.fillCircle(w * 0.2, -3, 2);
      g.fillCircle(w * 0.2, 3, 2);
      g.lineStyle(2, c, 0.5);
      for (let i = 0; i < 3; i++) {
        const ly = (i - 1) * 6;
        g.beginPath(); g.moveTo(-w * 0.2, ly); g.lineTo(-w * 0.6, ly - 8); g.lineTo(-w * 0.8, ly); g.strokePath();
        g.beginPath(); g.moveTo(w * 0.2, ly); g.lineTo(w * 0.6, ly - 8); g.lineTo(w * 0.8, ly); g.strokePath();
      }
    } else { // heavy
      // Heavy: armored box + turret + barrel + treads
      g.fillStyle(0x1a0a2a, 1);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.lineStyle(2, c, 0.6);
      g.strokeRect(-w / 2, -h / 2, w, h);
      g.fillStyle(c, 0.3);
      g.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, 6);
      g.fillRect(-w / 2 + 4, h / 2 - 10, w - 8, 6);
      g.fillStyle(0x2a1a3a, 1);
      g.fillRect(-8, -h / 2 - 8, 16, 10);
      g.fillStyle(c, 0.8);
      g.fillRect(-2, -h / 2 - 16, 4, 10);
      g.fillStyle(c, 0.9);
      g.fillCircle(0, 0, 5);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(-1, -1, 2);
      g.fillStyle(0x0a0a0a, 1);
      g.fillRect(-w / 2 - 2, h / 2 - 6, w + 4, 6);
    }
    this.visualGfx = g;
  }

  get isAlive(): boolean { return this.alive; }
  get position(): Phaser.Math.Vector2 {
    if (!this.sprite || !this.sprite.active) return new Phaser.Math.Vector2(0, 0);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  private hasLineOfSight(playerPos: Phaser.Math.Vector2): boolean {
    if (!this.sprite || !this.sprite.active || !this.sprite.body) return false;
    // C9 fix: ray from inside enemy's own body always includes the enemy itself.
    // Filter out the source body, then check if a SOLID WALL blocks the path.
    // Other enemies / projectiles / pickups do NOT block line of sight.
    const myBody = this.sprite.body as MatterJS.BodyType;
    const hits = this.scene.matter.intersectRay(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y, 1) as MatterJS.BodyType[];
    // Check if any solid wall is between enemy and player.
    for (const b of hits) {
      if (b === myBody) continue;  // skip self
      const go = (b as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      const type = go?.getData('entityType') as string | undefined;
      // Only solid walls block LOS. Enemies, projectiles, pickups, player do NOT.
      if (type === 'solid' || b.label.startsWith('solid')) return false;
    }
    return true;  // no wall blocking → LOS clear
  }

  private changeState(next: EnemyState): void {
    if (this.state === next) return;
    this.state = next;
    this.stateTime = 0;
    this.attackPhase = 'telegraph';
    if (this.telegraphGfx) { this.telegraphGfx.destroy(); this.telegraphGfx = null; }
    if (this.telegraphExtra) { this.telegraphExtra.destroy(); this.telegraphExtra = null; }
  }

  takeDamage(amount: number): boolean {
    if (!this.alive || amount <= 0) return false;
    this.health -= amount;
    this.flashUntil = this.scene.time.now + 80;
    if (this.state === 'attack' && this.attackPhase === 'telegraph') this.changeState('stagger');
    if (this.health <= 0) { this.die(); return true; }
    return true;
  }

  private die(): void {
    if (!this.alive) return;
    this.alive = false;
    // M16 fix: capture position before destroying sprite (handler reads it after destroy).
    const posX = this.sprite.x;
    const posY = this.sprite.y;
    const vx = this.sprite.body?.velocity.x ?? 0;
    const vy = this.sprite.body?.velocity.y ?? 0;
    EventBus.emit('ENEMY_DEAD', { id: this.id, score: this.data.score, x: posX, y: posY });
    if (this.telegraphGfx) { this.telegraphGfx.destroy(); this.telegraphGfx = null; }
    if (this.telegraphExtra) { this.telegraphExtra.destroy(); this.telegraphExtra = null; }
    this.visualGfx?.destroy();
    this.visualGfx = null;
    Ragdoll.spawn(this.scene, posX, posY, this.data.color, vx, vy);
    this.sprite.destroy();
  }

  /**
   * H12 fix: Explicit cleanup for scene shutdown / state transition.
   * Destroys all visuals + physics body. Safe to call even if already dead.
   */
  destroy(): void {
    if (this.telegraphGfx) { this.telegraphGfx.destroy(); this.telegraphGfx = null; }
    if (this.telegraphExtra) { this.telegraphExtra.destroy(); this.telegraphExtra = null; }
    this.visualGfx?.destroy();
    this.visualGfx = null;
    if (this.sprite && this.sprite.active) this.sprite.destroy();
    this.alive = false;
  }

  update(deltaMs: number, playerPos: Phaser.Math.Vector2): void {
    if (!this.alive || !this.sprite || !this.sprite.active) return;
    this.stateTime += deltaMs;
    // Drone cover-state trigger: at low HP, occasionally retreat.
    if (this.type === 'drone' && this.state === 'aggro' && this.health < this.data.hp * 0.4
        && this.scene.time.now > this.coverUntil && Math.random() < 0.004) {
      this.changeState('cover');
      this.coverUntil = this.scene.time.now + 1200;
      this.coverDir = (playerPos.x < this.sprite.x) ? 1 : -1; // flee away from player
    }
    switch (this.state) {
      case 'patrol':
        this.onPatrol();
        if (this.inRange(playerPos) && this.hasLineOfSight(playerPos)) this.changeState('aggro');
        break;
      case 'aggro':
        this.onAggro(playerPos);
        if (!this.inRange(playerPos) || !this.hasLineOfSight(playerPos)) this.changeState('patrol');
        break;
      case 'attack':
        this.runAttackFSM(playerPos);
        break;
      case 'cover':
        // Strafe away from player at 1.4x speed for the cover duration.
        this.sprite.setVelocityX(this.coverDir * this.data.speed * 1.4);
        const hover = this.hoverBase + Math.sin(this.scene.time.now / 200) * 16;
        this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
        if (this.scene.time.now > this.coverUntil) this.changeState('aggro');
        break;
      case 'stagger':
        if (this.stateTime > 400) this.changeState('aggro');
        break;
    }
    this.updateFlash();
  }

  private runAttackFSM(playerPos: Phaser.Math.Vector2): void {
    const t = this.data.timings;
    if (this.attackPhase === 'telegraph') {
      if (this.stateTime < 50 && !this.telegraphGfx) this.spawnTelegraph();
      this.onAttackTelegraph();
      if (this.stateTime >= t.telegraphMs) {
        this.attackPhase = 'window'; this.stateTime = 0;
        if (this.telegraphGfx) { this.telegraphGfx.destroy(); this.telegraphGfx = null; }
        if (this.telegraphExtra) { this.telegraphExtra.destroy(); this.telegraphExtra = null; }
      }
    } else if (this.attackPhase === 'window') {
      this.onAttackWindow(playerPos);
      if (this.stateTime >= t.windowMs) { this.attackPhase = 'recovery'; this.stateTime = 0; }
    } else {
      this.onAttackRecovery();
      if (this.stateTime >= t.recoveryMs) this.changeState('aggro');
    }
  }

  private spawnTelegraph(): void {
    this.telegraphGfx = this.scene.add.circle(this.sprite.x, this.sprite.y, 30, 0xff3030, 0);
    this.telegraphGfx.setStrokeStyle(2, 0xff3030, 0.7);
    this.telegraphGfx.setDepth(12);
    this.scene.tweens.add({
      targets: this.telegraphGfx,
      scale: { from: 0.5, to: 1.5 },
      alpha: { from: 0.7, to: 0.2 },
      duration: this.data.timings.telegraphMs,
      ease: 'Quad.easeOut',
    });
  }

  private inRange(playerPos: Phaser.Math.Vector2): boolean {
    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y);
    return d < this.data.detectionRange;
  }

  // ---- Per-state behavior (switches on type) ----
  private onPatrol(): void {
    if (this.type === 'drone') {
      const hover = this.hoverBase + Math.sin(this.scene.time.now / 360) * 12;
      this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
      this.sprite.setVelocityX(0);
    } else if (this.type === 'spider') {
      // Wall-aware patrol: raycast ahead; reverse if a wall is within 24 px.
      const aheadX = this.sprite.x + this.patrolDir * 24;
      const hits = this.scene.matter.intersectPoint(aheadX, this.sprite.y) as MatterJS.BodyType[];
      const blocked = hits.some(b => !b.isSensor && b.label.startsWith('solid'));
      if (blocked) {
        this.patrolDir *= -1;
      } else {
        this.sprite.setVelocityX(this.patrolDir * this.data.speed * 0.5);
        // If velocity stalls for any reason (e.g. wedged), also reverse.
        if (Math.abs(this.sprite.body!.velocity.x) < 0.05) this.patrolDir *= -1;
      }
    } else {
      this.sprite.setVelocityX(0);
    }
  }

  private onAggro(playerPos: Phaser.Math.Vector2): void {
    const now = this.scene.time.now;
    const dx = playerPos.x - this.sprite.x;
    const absDx = Math.abs(dx);
    const dir = dx > 0 ? 1 : -1;
    if (this.type === 'drone') {
      const hover = this.hoverBase + Math.sin(now / 360) * 12;
      this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
      if (absDx > this.data.attackRange + 40) this.sprite.setVelocityX(dir * this.data.speed);
      else if (absDx < this.data.attackRange - 40) this.sprite.setVelocityX(-dir * this.data.speed);
      else this.changeState('attack');
    } else if (this.type === 'spider') {
      this.patrolDir = dir;
      this.sprite.setVelocityX(dir * this.data.speed);
      const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y);
      if (dist < this.data.attackRange) { this.lungeDir = dir; this.changeState('attack'); }
    } else { // heavy
      this.lungeDir = dir;
      this.sprite.setVelocityX(dir * this.data.speed);
      const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y);
      if (dist < this.data.detectionRange * 0.8) this.changeState('attack');
    }
  }

  private onAttackTelegraph(): void {
    if (this.type === 'drone') {
      const hover = this.hoverBase + Math.sin(this.scene.time.now / 360) * 12;
      this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
      // Slight recoil backward + barrel-glow that grows as telegraph progresses.
      const t = Math.min(1, this.stateTime / this.data.timings.telegraphMs);
      // Recoil away from the direction the drone will fire (use strafeDir sign as facing proxy).
      this.sprite.setVelocityX(-this.strafeDir * this.data.speed * 0.3 * (1 - t));
      if (!this.telegraphExtra) {
        const glow = this.scene.add.circle(this.sprite.x, this.sprite.y, 3, 0xff8080, 0.6);
        glow.setDepth(15);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        this.telegraphExtra = glow;
      }
      // Grow the glow over the telegraph window.
      const glow = this.telegraphExtra as Phaser.GameObjects.Arc;
      glow.setPosition(this.sprite.x, this.sprite.y);
      glow.setRadius(3 + t * 8);
      glow.setAlpha(0.4 + t * 0.4);
    } else if (this.type === 'spider') {
      const t = Math.min(1, this.stateTime / this.data.timings.telegraphMs);
      // Squash + visual-gfx scale pulse (physics sprite is invisible, so we pulse visualGfx).
      if (this.visualGfx) {
        this.visualGfx.setScale(Phaser.Math.Linear(1, 1.25, t), Phaser.Math.Linear(1, 0.55, t));
      }
      this.sprite.setVelocityX(0);
    } else { // heavy
      // Heavy telegraph: pulse the visualGfx alpha + scale (NOT sprite.setTint, which is invisible).
      const flash = Math.floor(this.stateTime / 80) % 2 === 0;
      if (this.visualGfx) {
        this.visualGfx.setAlpha(flash ? 0.4 : 1.0);
        this.visualGfx.setScale(flash ? 1.05 : 1.0);
      }
      this.sprite.setVelocityX((Math.random() - 0.5) * 2);
    }
  }

  private onAttackWindow(playerPos: Phaser.Math.Vector2): void {
    if (this.type === 'drone') {
      this.fire(playerPos);
      // Reset visualGfx to normal (in case it was pulsed).
      if (this.visualGfx) { this.visualGfx.setScale(1, 1); this.visualGfx.setAlpha(1); }
    } else if (this.type === 'spider') {
      this.sprite.setVelocityX(this.lungeDir * (this.data.lungeSpeed ?? 7));
      if (this.visualGfx) { this.visualGfx.setScale(1, 1); this.visualGfx.setAlpha(1); }
    } else { // heavy
      this.sprite.setVelocityX(this.lungeDir * (this.data.chargeSpeed ?? 5));
      if (this.visualGfx) { this.visualGfx.setAlpha(1); this.visualGfx.setScale(1); }
    }
  }

  private onAttackRecovery(): void {
    const now = this.scene.time.now;
    if (this.type === 'drone') {
      if (now - this.lastStrafeChange > 300) { this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.lastStrafeChange = now; }
      this.sprite.setVelocityX(this.strafeDir * this.data.speed * 0.6);
      const hover = this.hoverBase + Math.sin(now / 360) * 12;
      this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
    } else {
      this.sprite.setVelocityX(this.sprite.body!.velocity.x * 0.85);
      if (this.visualGfx) { this.visualGfx.setScale(1, 1); this.visualGfx.setAlpha(1); }
    }
  }

  private fire(playerPos: Phaser.Math.Vector2): void {
    // H5 fix: use configured fireRateMs (default 2200 for drone) instead of hardcoded 100.
    const fireRate = this.data.fireRateMs ?? 100;
    if (this.lastFireAt > 0 && this.scene.time.now - this.lastFireAt < fireRate) return;
    this.lastFireAt = this.scene.time.now;
    const from = this.position;
    const dir = new Phaser.Math.Vector2(playerPos.x - from.x, playerPos.y - from.y).normalize();
    const proj = new Projectile(this.scene, from, dir, {
      speed: this.data.bulletSpeed ?? 5,
      damage: this.data.bulletDamage ?? 6,
      ttl: 2000, owner: 'enemy',
      color: 0xff4a4a, size: 5,
    });
    this.projectiles.push(proj);
  }

  private updateFlash(): void {
    if (!this.sprite || !this.sprite.active) return;
    // Sync visual position with physics body
    if (this.visualGfx) {
      this.visualGfx.setPosition(this.sprite.x, this.sprite.y);
      // Flash effect: scale up briefly when hit (only when NOT in a telegraph phase —
      // telegraph manages its own visual scale).
      const inTelegraph = this.state === 'attack' && this.attackPhase === 'telegraph';
      if (!inTelegraph) {
        if (this.scene.time.now < this.flashUntil) {
          this.visualGfx.setScale(1.15);
          this.visualGfx.setAlpha(0.8);
        } else {
          this.visualGfx.setScale(1);
          this.visualGfx.setAlpha(1);
        }
      }
    }
  }
}

export default Enemy;
