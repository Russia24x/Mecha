/**
 * MECHA: LAST PROTOCOL - Boss
 * Multi-phase boss with telegraphed attacks.
 * Stage 1: 2 phases only (Awakened → Frenzy). No 3rd phase.
 */

import Phaser from 'phaser';
import { EventBus } from '../../shared/EventBus';
import { Effects } from '../../shared/Effects';
import { COLORS } from '../../shared/Constants';
import { bodyConfig } from '../physics/CollisionLayers';
import { Projectile } from '../combat/Projectile';
import type { MatterBodyConfig } from '../../shared/Types';

const BOSS_MAX_HP = 1200;
const MAX_PHASES = 2;

export class Boss {
  public sprite: Phaser.Physics.Matter.Image;
  public id = 'boss';
  public isAlive = true;
  private health = BOSS_MAX_HP;
  private maxHealth = BOSS_MAX_HP;
  private phase = 1;
  private scene: Phaser.Scene;
  private projectiles: Projectile[];
  private playerPos: () => Phaser.Math.Vector2;
  private bossGfx: Phaser.GameObjects.Graphics | null = null;
  private bossCore: Phaser.GameObjects.Arc | null = null;
  private lungeVel = new Phaser.Math.Vector2(0, 0);
  private homeY: number;
  private lastFireAt = 0;
  private state: 'idle' | 'lunge' | 'shoot' | 'teleport' = 'idle';
  private stateUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, projectiles: Projectile[], playerPos: () => Phaser.Math.Vector2) {
    this.scene = scene;
    this.projectiles = projectiles;
    this.playerPos = playerPos;
    this.homeY = y;

    this.sprite = scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig('boss', { frictionAir: 0.05, density: 0.005 }),
    } as MatterBodyConfig);
    this.sprite.setDisplaySize(120, 110);
    this.sprite.setAlpha(0);
    this.sprite.setFixedRotation();
    this.sprite.setIgnoreGravity(true);
    this.sprite.setData('entity', this);
    this.sprite.setData('entityType', 'boss');
    this.sprite.setData('id', 'boss');
    this.buildVisual();
    EventBus.emit('BOSS_PHASE', { phase: this.phase, healthPct: 1.0 });
  }

  private buildVisual(): void {
    const g = this.scene.add.graphics();
    g.setDepth(14);
    g.fillStyle(0x2a0a0a, 1);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * 50;
      const py = Math.sin(a) * 45;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
    g.lineStyle(3, COLORS.BOSS, 0.9);
    g.strokePath();
    this.bossGfx = g;
    this.bossCore = this.scene.add.circle(this.sprite.x, this.sprite.y, 12, COLORS.BOSS_GLOW, 0.9);
    this.bossCore.setDepth(15);
    this.bossCore.setBlendMode(Phaser.BlendModes.ADD);
  }

  get position(): Phaser.Math.Vector2 {
    if (!this.sprite || !this.sprite.active) return new Phaser.Math.Vector2(0, 0);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  getContactDamage(): number { return 28; }

  takeDamage(amount: number): boolean {
    if (!this.isAlive || amount <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    const phaseChanged = this.updatePhase();
    if (phaseChanged) {
      Effects.play('phaseChange');
      this.bossGfx?.setAlpha(0.3);
      this.scene.time.delayedCall(200, () => { if (this.isAlive) this.bossGfx?.setAlpha(1); });
      this.scene.cameras.main.flash(150, 255, 80, 80);
    } else {
      Effects.play('bossHit');
    }
    if (this.health <= 0) this.die();
    return true;
  }

  private updatePhase(): boolean {
    const pct = this.health / this.maxHealth;
    const newPhase = pct > 0.5 ? 1 : 2;
    if (newPhase !== this.phase && newPhase <= MAX_PHASES) {
      this.phase = newPhase;
      EventBus.emit('BOSS_PHASE', { phase: this.phase, healthPct: pct });
      return true;
    }
    return false;
  }

  update(deltaMs: number): void {
    void deltaMs;
    if (!this.isAlive) return;
    const now = this.scene.time.now;
    const pp = this.playerPos();
    if (now >= this.stateUntil) {
      const r = Math.random();
      if (r < 0.4) { this.state = 'shoot'; this.stateUntil = now + 1500; this.fire(pp); }
      else if (r < 0.7) { this.state = 'lunge'; this.stateUntil = now + 1000; this.lunge(pp); }
      else { this.state = 'idle'; this.stateUntil = now + 800; }
    }
    this.sprite.setVelocity(this.lungeVel.x, this.lungeVel.y);
    this.lungeVel.scale(0.92);
    if (this.bossGfx) this.bossGfx.setPosition(this.sprite.x, this.sprite.y);
    if (this.bossCore) {
      this.bossCore.setPosition(this.sprite.x, this.sprite.y);
      const pulse = 0.7 + Math.sin(now / 200) * 0.3;
      this.bossCore.setAlpha(pulse);
      this.bossCore.setRadius(8 + pulse * 6);
    }
  }

  private fire(playerPos: Phaser.Math.Vector2): void {
    if (this.scene.time.now - this.lastFireAt < 200) return;
    this.lastFireAt = this.scene.time.now;
    const from = this.position;
    const baseAngle = Math.atan2(playerPos.y - from.y, playerPos.x - from.x);
    for (let i = -1; i <= 1; i++) {
      const angle = baseAngle + i * 0.2;
      const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
      const proj = new Projectile(this.scene, from, dir, {
        speed: 5, damage: 10, ttl: 3000, owner: 'enemy', color: COLORS.ENEMY_PROJ, size: 7,
      });
      this.projectiles.push(proj);
    }
  }

  private lunge(playerPos: Phaser.Math.Vector2): void {
    const dx = playerPos.x - this.sprite.x;
    const dir = dx > 0 ? 1 : -1;
    this.lungeVel.set(dir * 6, 0);
  }

  private die(): void {
    if (!this.isAlive) return;
    this.isAlive = false;
    EventBus.emit('BOSS_PHASE', { phase: 0, healthPct: 0, dead: true });
    this.bossGfx?.destroy(); this.bossGfx = null;
    this.bossCore?.destroy(); this.bossCore = null;
    if (this.sprite && this.sprite.active) this.sprite.destroy();
  }

  destroy(): void {
    this.bossGfx?.destroy();
    this.bossCore?.destroy();
    if (this.sprite && this.sprite.active) this.sprite.destroy();
    this.isAlive = false;
  }
}

export default Boss;
