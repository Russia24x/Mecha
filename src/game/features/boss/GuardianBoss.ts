/**
 * MECHA: LAST PROTOCOL - GuardianBoss (AX-09)
 * Two-stage final boss of the Abandoned Factory stage.
 *
 * Stage 1 (GUARDIAN_AX09): 1200 HP, 3 phases (Recon → Assault → Frenzy)
 *   - spread-shot bullets, lunge, ring bursts
 * Stage 2 (GUARDIAN_AX09_ENRAGED): 1800 HP, 2 phases (Awakened → Berserk)
 *   - faster, more bullets, teleports
 *
 * When Stage 1 dies, the boss emits 'boss:stage-defeated' but stays alive
 * in spirit. The FactoryStage listens and spawns Stage 2 after a delay.
 */
import Phaser from 'phaser';
import { BOSS, COLORS } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';
import { AudioManager } from '../../shared/AudioManager';
import { bodyConfig } from '../physics/CollisionLayers';
import { Projectile } from '../combat/Projectile';
import { BossStateMachine, BossPhase } from './BossStateMachine';

export type BossStage = 1 | 2;

export class GuardianBoss {
  public sprite: Phaser.Physics.Matter.Image;
  public id = 'boss-guardian-ax09';
  private health: number;
  private maxHealth: number;
  private alive = true;
  private sm: BossStateMachine;
  private stage: BossStage = 1;
  private lastFireAt = 0;
  private lastBigAttackAt = 0;
  private lastLungeAt = 0;
  private lastTeleportAt = 0;
  private homeX: number;
  private homeY: number;
  private lungeVel = new Phaser.Math.Vector2(0, 0);

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
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
    this.sm = new BossStateMachine(stage);

    this.sprite = scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig('boss', { label: this.id, frictionAir: 0.06, density: 0.01 }),
    });
    const size = stage === 1 ? 120 : 140;
    this.sprite.setDisplaySize(size, size * 0.92);
    this.sprite.setTint(stage === 1 ? COLORS.BOSS : 0xff2080);
    this.sprite.setFixedRotation();
    this.sprite.setIgnoreGravity(true);
    this.sprite.setData('entity', this);
    this.sprite.setData('entityType', 'boss');
    this.sprite.setData('id', this.id);

    EventBus.emit('boss:health-changed', { current: this.health, max: this.maxHealth });
    EventBus.emit('boss:phase-changed', this.sm.ctx);
    AudioManager.playMusic('bossFight');
  }

  get isAlive(): boolean { return this.alive; }
  get phase(): BossPhase { return this.sm.current; }
  get currentStage(): BossStage { return this.stage; }
  get position(): Phaser.Math.Vector2 {
    if (!this.sprite || !this.sprite.active) return new Phaser.Math.Vector2(0, 0);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  takeDamage(amount: number): boolean {
    if (!this.alive || amount <= 0) return false;
    this.health -= amount;
    const pct = this.health / this.maxHealth;
    const phaseChanged = this.sm.update(pct);
    EventBus.emit('boss:health-changed', { current: Math.max(0, this.health), max: this.maxHealth });

    if (phaseChanged) {
      AudioManager.play('phaseChange');
      this.sprite.setTint(0xffffff);
      this.scene.time.delayedCall(200, () => {
        if (this.alive) this.sprite.setTint(this.stage === 1 ? COLORS.BOSS : 0xff2080);
      });
      // brief invuln + screen flash on phase change
      this.scene.cameras.main.flash(150, 255, 80, 80);
    } else {
      // hit feedback
      AudioManager.play('bossHit');
    }

    if (this.health <= 0) {
      this.die();
    }
    return true;
  }

  getContactDamage(): number {
    return this.stage === 1 ? BOSS.GUARDIAN_AX09.contactDamage : BOSS.GUARDIAN_AX09_ENRAGED.contactDamage;
  }

  update(_deltaMs: number): void {
    if (!this.alive) return;
    const now = this.scene.time.now;
    const player = this.getPlayerPos();
    const ctx = this.sm.ctx;
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);

    // Movement: hover + slow chase
    const hoverY = this.homeY + Math.sin(now / 600) * 18;
    const targetX = player.x + (this.sprite.x < player.x ? -260 : 260);
    const moveX = (targetX - this.sprite.x) * 0.002 * ctx.speed;
    const moveY = (hoverY - this.sprite.y) * 0.04;
    this.sprite.setVelocity(moveX + this.lungeVel.x, moveY + this.lungeVel.y);
    this.lungeVel.scale(0.92);

    // ----- Attacks (shared across stages, scaled by stage) -----
    if (now - this.lastFireAt > ctx.fireRateMs) {
      this.lastFireAt = now;
      const count = this.stage === 2 ? 7 : 5;
      this.fireSpread(player, count, this.stage === 2 ? 0.8 : 0.6);
    }

    // Phase 2+ (stage 1) OR Stage 2 always: lunge every 4s (3s in stage 2)
    const lungeCd = this.stage === 2 ? 3000 : 4000;
    if ((this.sm.current >= 1 || this.stage === 2) && now - this.lastLungeAt > lungeCd) {
      this.lastLungeAt = now;
      const dir = new Phaser.Math.Vector2(player.x - this.sprite.x, player.y - this.sprite.y).normalize();
      this.lungeVel.set(dir.x * (this.stage === 2 ? 11 : 9), dir.y * (this.stage === 2 ? 5 : 4));
    }

    // Stage 1 Phase 3 OR Stage 2: ring burst every 5s (4s stage 2)
    const ringCd = this.stage === 2 ? 4000 : 5000;
    if ((this.sm.current >= 2 || this.stage === 2) && now - this.lastBigAttackAt > ringCd) {
      this.lastBigAttackAt = now;
      this.fireRing(this.stage === 2 ? 24 : 16);
    }

    // Stage 2 only: teleport every 8s
    if (this.stage === 2 && now - this.lastTeleportAt > 8000) {
      this.lastTeleportAt = now;
      this.teleport(player);
    }
  }

  private fireSpread(player: Phaser.Math.Vector2, count: number, spreadRad: number): void {
    const from = this.position;
    const base = Math.atan2(player.y - from.y, player.x - from.x);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const a = base + t * spreadRad;
      const dir = new Phaser.Math.Vector2(Math.cos(a), Math.sin(a));
      const proj = new Projectile(this.scene, from, dir, {
        speed: 5,
        damage: 10,
        ttl: 2500,
        owner: 'enemy',
        color: this.stage === 1 ? COLORS.BOSS_GLOW : 0xff60c0,
        size: 8,
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
        speed: 4,
        damage: 8,
        ttl: 3000,
        owner: 'enemy',
        color: this.stage === 1 ? COLORS.BOSS_GLOW : 0xff60c0,
        size: 8,
      });
      this.projectiles.push(proj);
    }
  }

  private teleport(player: Phaser.Math.Vector2): void {
    // Visual: fade out → reposition → fade in
    const cam = this.scene.cameras.main;
    cam.flash(120, 200, 80, 200);
    AudioManager.play('phaseChange');
    this.sprite.setAlpha(0.3);
    // Reposition to opposite side of player
    const dx = this.sprite.x < player.x ? -1 : 1;
    this.sprite.setPosition(player.x - dx * 350, this.homeY);
    this.lungeVel.set(dx * 6, 0);
    this.scene.time.delayedCall(200, () => this.sprite.setAlpha(1));
  }

  private die(): void {
    if (!this.alive) return;
    this.alive = false;
    AudioManager.play('bossDeath');

    if (this.stage === 1) {
      // Stage 1 defeated — FactoryStage will spawn stage 2
      EventBus.emit('boss:stage-defeated', { stage: 1, id: this.id });
    } else {
      // Stage 2 defeated — true death, victory
      EventBus.emit('boss:dead', { id: this.id });
      AudioManager.stopMusic();
      AudioManager.play('victory');
    }
    this.sprite.destroy();
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

export default GuardianBoss;
