/**
 * MECHA: LAST PROTOCOL - Enemy
 * Single class for all enemy types (drone, spider, heavy).
 * FSM: patrol | aggro | attack (telegraph→window→recovery) | stagger
 */

import Phaser from 'phaser';
import { EventBus } from '../../shared/EventBus';
import { Effects } from '../../shared/Effects';
import { bodyConfig } from '../physics/CollisionLayers';
import { Projectile } from '../combat/Projectile';
import { COLORS } from '../../shared/Constants';
import type { MatterBodyConfig } from '../../shared/Types';

export type EnemyTypeId = 'drone' | 'spider' | 'heavy';
export type EnemyState = 'patrol' | 'aggro' | 'attack' | 'stagger';

interface EnemyTypeData {
  hp: number;
  speed: number;
  detectionRange: number;
  attackRange: number;
  bulletSpeed?: number;
  bulletDamage?: number;
  lungeSpeed?: number;
  chargeSpeed?: number;
  score: number;
  color: number;
  size: { w: number; h: number };
  flying: boolean;
  timings: { telegraphMs: number; windowMs: number; recoveryMs: number };
}

const ENEMY_TYPES: Record<EnemyTypeId, EnemyTypeData> = {
  drone: {
    hp: 24, speed: 1.4, detectionRange: 320, attackRange: 220,
    bulletSpeed: 5.5, bulletDamage: 6, score: 50, color: 0xff5a5a,
    size: { w: 26, h: 22 }, flying: true,
    timings: { telegraphMs: 500, windowMs: 200, recoveryMs: 600 },
  },
  spider: {
    hp: 55, speed: 2.2, detectionRange: 280, attackRange: 140,
    lungeSpeed: 7, score: 80, color: 0xff8a3d,
    size: { w: 36, h: 22 }, flying: false,
    timings: { telegraphMs: 400, windowMs: 320, recoveryMs: 500 },
  },
  heavy: {
    hp: 140, speed: 0.9, detectionRange: 320, attackRange: 256,
    chargeSpeed: 5, score: 150, color: 0xb040ff,
    size: { w: 52, h: 44 }, flying: false,
    timings: { telegraphMs: 600, windowMs: 700, recoveryMs: 900 },
  },
};

let enemyCounter = 0;
function nextEnemyId(type: EnemyTypeId): string { return `${type}-${++enemyCounter}`; }

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
  private visualGfx: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyTypeId, projectiles: Projectile[]) {
    this.scene = scene;
    this.type = type;
    this.data = ENEMY_TYPES[type];
    this.id = nextEnemyId(type);
    this.health = this.data.hp;
    this.projectiles = projectiles;
    this.hoverBase = y;

    this.sprite = scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig(this.id, { frictionAir: 0.04, density: 0.003 }),
    } as MatterBodyConfig);
    this.sprite.setDisplaySize(this.data.size.w, this.data.size.h);
    this.sprite.setAlpha(0);
    this.sprite.setFixedRotation();
    if (this.data.flying) this.sprite.setIgnoreGravity(true);
    this.sprite.setData('entity', this);
    this.sprite.setData('entityType', 'enemy');
    this.sprite.setData('id', this.id);
    this.buildVisual();
  }

  private buildVisual(): void {
    const c = this.data.color;
    const w = this.data.size.w;
    const h = this.data.size.h;
    const g = this.scene.add.graphics();
    g.setDepth(14);
    if (this.type === 'drone') {
      g.fillStyle(0x1a1a2a, 1); g.fillCircle(0, 0, w / 2);
      g.lineStyle(2, c, 0.8); g.strokeCircle(0, 0, w / 2);
      g.fillStyle(c, 0.9); g.fillCircle(0, 0, 4);
    } else if (this.type === 'spider') {
      g.fillStyle(0x2a1a0a, 1); g.fillEllipse(0, 0, w * 0.7, h * 0.8);
      g.fillStyle(c, 0.7); g.fillCircle(w * 0.15, 0, w * 0.25);
      g.fillStyle(0xff0000, 0.9); g.fillCircle(w * 0.2, -3, 2); g.fillCircle(w * 0.2, 3, 2);
    } else {
      g.fillStyle(0x1a0a2a, 1); g.fillRect(-w / 2, -h / 2, w, h);
      g.lineStyle(2, c, 0.6); g.strokeRect(-w / 2, -h / 2, w, h);
      g.fillStyle(c, 0.9); g.fillCircle(0, 0, 5);
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
    const myBody = this.sprite.body as MatterJS.BodyType;
    const hits = this.scene.matter.intersectRay(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y, 1) as MatterJS.BodyType[];
    for (const b of hits) {
      if (b === myBody) continue;
      const go = (b as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      const type = go?.getData('entityType') as string | undefined;
      if (type === 'solid' || b.label.startsWith('solid')) return false;
    }
    return true;
  }

  private changeState(next: EnemyState): void {
    if (this.state === next) return;
    this.state = next;
    this.stateTime = 0;
    this.attackPhase = 'telegraph';
    if (this.telegraphGfx) { this.telegraphGfx.destroy(); this.telegraphGfx = null; }
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
    const posX = this.sprite.x;
    const posY = this.sprite.y;
    EventBus.emit('ENEMY_DEAD', { id: this.id, score: this.data.score, x: posX, y: posY });
    if (this.telegraphGfx) { this.telegraphGfx.destroy(); this.telegraphGfx = null; }
    this.visualGfx?.destroy();
    this.visualGfx = null;
    this.sprite.destroy();
  }

  destroy(): void {
    if (this.telegraphGfx) { this.telegraphGfx.destroy(); this.telegraphGfx = null; }
    this.visualGfx?.destroy();
    this.visualGfx = null;
    if (this.sprite && this.sprite.active) this.sprite.destroy();
    this.alive = false;
  }

  update(deltaMs: number, playerPos: Phaser.Math.Vector2): void {
    if (!this.alive || !this.sprite || !this.sprite.active) return;
    this.stateTime += deltaMs;
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
      scale: { from: 0.5, to: 1.5 }, alpha: { from: 0.7, to: 0.2 },
      duration: this.data.timings.telegraphMs, ease: 'Quad.easeOut',
    });
  }

  private inRange(playerPos: Phaser.Math.Vector2): boolean {
    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y);
    return d < this.data.detectionRange;
  }

  private onPatrol(): void {
    if (this.type === 'drone') {
      const hover = this.hoverBase + Math.sin(this.scene.time.now / 360) * 12;
      this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
      this.sprite.setVelocityX(0);
    } else if (this.type === 'spider') {
      this.sprite.setVelocityX(this.patrolDir * this.data.speed * 0.5);
      const body = this.sprite.body;
      if (body && Math.abs(body.velocity.x) < 0.05) this.patrolDir *= -1;
    } else {
      this.sprite.setVelocityX(0);
    }
  }

  private onAggro(playerPos: Phaser.Math.Vector2): void {
    const dx = playerPos.x - this.sprite.x;
    const absDx = Math.abs(dx);
    const dir = dx > 0 ? 1 : -1;
    if (this.type === 'drone') {
      const hover = this.hoverBase + Math.sin(this.scene.time.now / 360) * 12;
      this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
      if (absDx > this.data.attackRange + 40) this.sprite.setVelocityX(dir * this.data.speed);
      else if (absDx < this.data.attackRange - 40) this.sprite.setVelocityX(-dir * this.data.speed);
      else this.changeState('attack');
    } else if (this.type === 'spider') {
      this.patrolDir = dir;
      this.sprite.setVelocityX(dir * this.data.speed);
      const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y);
      if (dist < this.data.attackRange) { this.lungeDir = dir; this.changeState('attack'); }
    } else {
      this.lungeDir = dir;
      this.sprite.setVelocityX(dir * this.data.speed);
      const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y);
      if (dist < this.data.detectionRange * 0.8) this.changeState('attack');
    }
  }

  private onAttackTelegraph(): void {
    if (this.type === 'spider') {
      const t = Math.min(1, this.stateTime / this.data.timings.telegraphMs);
      if (this.visualGfx) this.visualGfx.setScale(Phaser.Math.Linear(1, 1.2, t), Phaser.Math.Linear(1, 0.6, t));
      this.sprite.setVelocityX(0);
    } else if (this.type === 'heavy') {
      if (this.visualGfx) {
        const flash = Math.floor(this.stateTime / 80) % 2 === 0;
        this.visualGfx.setAlpha(flash ? 0.4 : 1.0);
      }
      this.sprite.setVelocityX((Math.random() - 0.5) * 2);
    } else {
      const hover = this.hoverBase + Math.sin(this.scene.time.now / 360) * 12;
      this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
      this.sprite.setVelocityX(0);
    }
  }

  private onAttackWindow(playerPos: Phaser.Math.Vector2): void {
    if (this.type === 'drone') {
      this.fire(playerPos);
    } else if (this.type === 'spider') {
      this.sprite.setVelocityX(this.lungeDir * (this.data.lungeSpeed ?? 7));
      if (this.visualGfx) this.visualGfx.setScale(1, 1);
    } else {
      this.sprite.setVelocityX(this.lungeDir * (this.data.chargeSpeed ?? 5));
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
      const body = this.sprite.body;
      this.sprite.setVelocityX((body ? body.velocity.x : 0) * 0.85);
      if (this.visualGfx) this.visualGfx.setScale(1, 1);
    }
  }

  private fire(playerPos: Phaser.Math.Vector2): void {
    if (this.lastFireAt > 0 && this.scene.time.now - this.lastFireAt < 100) return;
    this.lastFireAt = this.scene.time.now;
    const from = this.position;
    const dir = new Phaser.Math.Vector2(playerPos.x - from.x, playerPos.y - from.y).normalize();
    const proj = new Projectile(this.scene, from, dir, {
      speed: this.data.bulletSpeed ?? 5, damage: this.data.bulletDamage ?? 6,
      ttl: 2000, owner: 'enemy', color: COLORS.ENEMY_PROJ, size: 5,
    });
    this.projectiles.push(proj);
  }

  private updateFlash(): void {
    if (!this.sprite || !this.sprite.active) return;
    if (this.visualGfx) {
      this.visualGfx.setPosition(this.sprite.x, this.sprite.y);
      const inTelegraph = this.state === 'attack' && this.attackPhase === 'telegraph';
      if (!inTelegraph) {
        if (this.scene.time.now < this.flashUntil) {
          this.visualGfx.setScale(1.15); this.visualGfx.setAlpha(0.8);
        } else {
          this.visualGfx.setScale(1); this.visualGfx.setAlpha(1);
        }
      }
    }
  }
}

export default Enemy;
