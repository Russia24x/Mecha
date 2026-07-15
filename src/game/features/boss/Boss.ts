/**
 * MECHA: LAST PROTOCOL - Boss (Guardian AX-09)
 * Two-stage final boss. State machine is inline (no separate class).
 *
 * Stage 1: 1200 HP, 3 phases (Recon → Assault → Frenzy)
 * Stage 2 (Enraged): 1800 HP, 2 phases (Awakened → Berserk), + teleport
 */
import Phaser from 'phaser';
import { BOSS, COLORS } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';
import { Effects } from '../../shared/Effects';
import { bodyConfig } from '../physics/CollisionLayers';
import { Projectile } from '../combat/Projectile';

export type BossStage = 1 | 2;
export type BossPhase = 0 | 1 | 2;

export class Boss {
  public sprite: Phaser.Physics.Matter.Image;
  public id: string;
  public health: number;
  public maxHealth: number;
  private alive = true;
  public phase: BossPhase = 0;
  public stage: BossStage;
  private phases: ReadonlyArray<{ healthPct: number; speed: number; fireRateMs: number; name: string }>;
  private lastFireAt = 0;
  private lastBigAttackAt = 0;
  private lastLungeAt = 0;
  private lastTeleportAt = 0;
  private homeX: number;
  private homeY: number;
  private lungeVel = new Phaser.Math.Vector2(0, 0);

  constructor(
    private scene: Phaser.Scene,
    x: number, y: number,
    private projectiles: Projectile[],
    private getPlayerPos: () => Phaser.Math.Vector2,
    stage: BossStage = 1
  ) {
    this.homeX = x;
    this.homeY = y;
    this.stage = stage;
    const def = stage === 1 ? BOSS.GUARDIAN_AX09 : BOSS.GUARDIAN_AX09_ENRAGED;
    this.maxHealth = def.maxHealth;
    this.health = this.maxHealth;
    this.id = stage === 1 ? 'boss-guardian-ax09' : 'boss-guardian-ax09-enraged';
    this.phases = def.phases;

    this.sprite = scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig('boss', { label: this.id, frictionAir: 0.06, density: 0.01 }),
    });
    const size = stage === 1 ? 120 : 140;
    this.sprite.setDisplaySize(size, size * 0.92);
    this.sprite.setAlpha(0); // physics only — visual drawn separately
    this.sprite.setFixedRotation();
    this.sprite.setIgnoreGravity(true);
    this.sprite.setData('entity', this);
    this.sprite.setData('entityType', 'boss');
    this.sprite.setData('id', this.id);
    this.buildBossVisual(size);

    EventBus.emit('BOSS_PHASE', this.getPhaseContext());
    Effects.playMusic('bossFight');
  }

  /** Detailed boss visual — large mechanical body with core, weapons, armor. */
  private bossGfx: Phaser.GameObjects.Graphics | null = null;
  private bossCore: Phaser.GameObjects.Arc | null = null;

  private buildBossVisual(size: number): void {
    const c = this.stage === 1 ? COLORS.BOSS : 0x40ff60;
    const glow = this.stage === 1 ? COLORS.BOSS_GLOW : 0x80ff80;
    const g = this.scene.add.graphics();
    g.setDepth(14);
    const half = size / 2;
    // Main body — hexagonal shape
    g.fillStyle(0x1a0808, 1);
    g.beginPath();
    g.moveTo(-half * 0.8, -half * 0.5);
    g.lineTo(0, -half * 0.7);
    g.lineTo(half * 0.8, -half * 0.5);
    g.lineTo(half * 0.8, half * 0.5);
    g.lineTo(0, half * 0.7);
    g.lineTo(-half * 0.8, half * 0.5);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, c, 0.8);
    g.strokePath();
    // Armor plates
    g.fillStyle(c, 0.2);
    g.fillRect(-half * 0.5, -half * 0.3, half, 8);
    g.fillRect(-half * 0.5, half * 0.2, half, 8);
    // Weapon pods (left + right)
    g.fillStyle(0x0a0404, 1);
    g.fillRect(-half * 0.9, -half * 0.2, 10, 20);
    g.fillRect(half * 0.7, -half * 0.2, 10, 20);
    g.fillStyle(c, 0.6);
    g.fillRect(-half * 0.9 + 2, -half * 0.18, 6, 4);
    g.fillRect(half * 0.7 + 2, -half * 0.18, 6, 4);
    // "Eye" sensor strip
    g.fillStyle(0x000000, 1);
    g.fillRect(-half * 0.3, -half * 0.1, half * 0.6, 6);
    g.fillStyle(glow, 0.8);
    g.fillRect(-half * 0.28, -half * 0.08, half * 0.56, 3);
    this.bossGfx = g;
    // Pulsing core (separate object for animation)
    this.bossCore = this.scene.add.circle(0, 0, 8, glow, 0.9);
    this.bossCore.setDepth(15);
    this.bossCore.setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Update visual position + pulse animation. */
  private updateVisual(): void {
    if (this.bossGfx && this.sprite?.active) {
      this.bossGfx.setPosition(this.sprite.x, this.sprite.y);
    }
    if (this.bossCore && this.sprite?.active) {
      this.bossCore.setPosition(this.sprite.x, this.sprite.y);
      const pulse = 0.6 + Math.sin(this.scene.time.now / 200) * 0.3;
      this.bossCore.setAlpha(pulse);
      this.bossCore.setRadius(6 + pulse * 4);
    }
  }

  get isAlive(): boolean { return this.alive; }
  get currentStage(): BossStage { return this.stage; }

  get position(): Phaser.Math.Vector2 {
    if (!this.sprite || !this.sprite.active) return new Phaser.Math.Vector2(0, 0);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  private get currentPhaseData() {
    return this.phases[this.phase];
  }

  private getPhaseContext() {
    const p = this.currentPhaseData;
    return {
      healthPct: this.health / this.maxHealth,
      phase: this.phase,
      speed: p.speed,
      fireRateMs: p.fireRateMs,
      phaseName: p.name,
    };
  }

  /** Update phase based on health. Returns true if phase changed. */
  private updatePhase(): boolean {
    const pct = this.health / this.maxHealth;
    let next: BossPhase = 0;
    if (this.phases.length >= 3 && pct <= this.phases[2].healthPct) next = 2;
    else if (this.phases.length >= 2 && pct <= this.phases[1].healthPct) next = 1;
    if (next !== this.phase) {
      this.phase = next;
      EventBus.emit('BOSS_PHASE', this.getPhaseContext());
      return true;
    }
    return false;
  }

  takeDamage(amount: number): boolean {
    if (!this.alive || amount <= 0) return false;
    // M6 fix: clamp health to 0 so phase ratio never goes negative.
    this.health = Math.max(0, this.health - amount);
    const phaseChanged = this.updatePhase();
    if (phaseChanged) {
      Effects.play('phaseChange');
      // H3 fix: apply flash to bossGfx (visible), not sprite (alpha 0, invisible).
      // Graphics doesn't support tint — use alpha pulse as a flash proxy.
      this.bossGfx?.setAlpha(0.3);
      this.scene.time.delayedCall(200, () => { if (this.alive) this.bossGfx?.setAlpha(1); });
      this.scene.cameras.main.flash(150, 255, 80, 80);
    } else {
      Effects.play('bossHit');
    }
    if (this.health <= 0) this.die();
    return true;
  }

  getContactDamage(): number {
    return this.stage === 1 ? BOSS.GUARDIAN_AX09.contactDamage : BOSS.GUARDIAN_AX09_ENRAGED.contactDamage;
  }

  update(_deltaMs: number): void {
    if (!this.alive) return;
    const now = this.scene.time.now;
    const player = this.getPlayerPos();
    const ctx = this.currentPhaseData;
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);

    // Movement: hover + slow chase
    const hoverY = this.homeY + Math.sin(now / 600) * 18;
    const targetX = player.x + (this.sprite.x < player.x ? -260 : 260);
    const moveX = (targetX - this.sprite.x) * 0.002 * ctx.speed;
    const moveY = (hoverY - this.sprite.y) * 0.04;
    this.sprite.setVelocity(moveX + this.lungeVel.x, moveY + this.lungeVel.y);
    this.lungeVel.scale(0.92);

    // Attacks
    if (now - this.lastFireAt > ctx.fireRateMs) {
      this.lastFireAt = now;
      const count = this.stage === 2 ? 7 : 5;
      this.fireSpread(player, count, this.stage === 2 ? 0.8 : 0.6);
    }

    const lungeCd = this.stage === 2 ? 3000 : 4000;
    if ((this.phase >= 1 || this.stage === 2) && now - this.lastLungeAt > lungeCd) {
      this.lastLungeAt = now;
      const dir = new Phaser.Math.Vector2(player.x - this.sprite.x, player.y - this.sprite.y).normalize();
      this.lungeVel.set(dir.x * (this.stage === 2 ? 11 : 9), dir.y * (this.stage === 2 ? 5 : 4));
    }

    const ringCd = this.stage === 2 ? 4000 : 5000;
    if ((this.phase >= 2 || this.stage === 2) && now - this.lastBigAttackAt > ringCd) {
      this.lastBigAttackAt = now;
      this.fireRing(this.stage === 2 ? 24 : 16);
    }

    if (this.stage === 2 && now - this.lastTeleportAt > 8000) {
      this.lastTeleportAt = now;
      this.teleport(player);
    }
    // Update visual
    this.updateVisual();
  }

  private fireSpread(player: Phaser.Math.Vector2, count: number, spreadRad: number): void {
    const from = this.position;
    const base = Math.atan2(player.y - from.y, player.x - from.x);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const a = base + t * spreadRad;
      const dir = new Phaser.Math.Vector2(Math.cos(a), Math.sin(a));
      const proj = new Projectile(this.scene, from, dir, {
        speed: 5, damage: 10, ttl: 2500, owner: 'enemy',
        color: this.stage === 1 ? COLORS.BOSS_GLOW : 0xff60c0, size: 8,
      });
      this.projectiles.push(proj);
    }
  }

  private fireRing(count: number): void {
    const from = this.position;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const dir = new Phaser.Math.Vector2(Math.cos(a), Math.sin(a));
      const proj = new Projectile(this.scene, from, dir, {
        speed: 4, damage: 8, ttl: 3000, owner: 'enemy',
        color: this.stage === 1 ? COLORS.BOSS_GLOW : 0xff60c0, size: 8,
      });
      this.projectiles.push(proj);
    }
  }

  private teleport(player: Phaser.Math.Vector2): void {
    const cam = this.scene.cameras.main;
    cam.flash(120, 200, 80, 200);
    Effects.play('phaseChange');
    // C10 fix: apply alpha to bossGfx (the visible visual), NOT the physics sprite
    // (which is set to alpha 0 at construction and should stay invisible).
    this.bossGfx?.setAlpha(0.3);
    const dx = this.sprite.x < player.x ? -1 : 1;
    this.sprite.setPosition(player.x - dx * 350, this.homeY);
    this.lungeVel.set(dx * 6, 0);
    this.scene.time.delayedCall(200, () => this.bossGfx?.setAlpha(1));
  }

  private die(): void {
    if (!this.alive) return;
    this.alive = false;
    Effects.play('bossDeath');
    this.bossGfx?.destroy(); this.bossGfx = null;
    this.bossCore?.destroy(); this.bossCore = null;
    if (this.stage === 1) {
      EventBus.emit('BOSS_PHASE', { type: 'stage-defeated', stage: 1 });
    } else {
      EventBus.emit('BOSS_PHASE', { type: 'dead' });
      Effects.stopMusic();
      Effects.play('victory');
    }
    this.sprite.destroy();
  }

  destroy(): void {
    this.bossGfx?.destroy();
    this.bossCore?.destroy();
    this.sprite.destroy();
  }
}

export default Boss;
