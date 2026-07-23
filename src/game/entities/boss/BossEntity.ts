/**
 * MECHA: LAST PROTOCOL — Boss Entity
 * Data-driven: all stats from BossData database.
 * Phased AI with attacks defined in data.
 * Max 2 phases (MAX_PHASES enforced by data).
 */
import Phaser from 'phaser';
import { EventBus } from '../../systems/EventBus';
import { AudioSystem } from '../../systems/AudioSystem';
import { PhysicsSystem } from '../../systems/PhysicsSystem';
import { ParticleSystem } from '../../systems/ParticleSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { getBoss } from '../../data/bosses/bosses';
import { COLORS } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import type { BossData, BossPhase } from '../../data/types';
import { Projectile } from '../combat/Projectile';

export class BossEntity {
  public sprite: Phaser.Physics.Matter.Image;
  public id: string;
  public isAlive = true;
  private health: number;
  private maxHealth: number;
  private phase = 1;
  private shieldActive = false;  // Leviathan only — reduces damage by 50%
  private data: BossData;
  private currentPhaseData: BossPhase;
  private scene: Phaser.Scene;
  private physics: PhysicsSystem;
  private particles: ParticleSystem;
  private projectiles: Projectile[];
  private playerPos: () => Phaser.Math.Vector2;
  private bossGfx: Phaser.GameObjects.Graphics | null = null;
  private bossCore: Phaser.GameObjects.Arc | null = null;
  private lungeVel = new Phaser.Math.Vector2(0, 0);
  private homeY: number;
  private lastFireAt = 0;
  private lastActionAt = 0;
  private actionCooldown = 1500;

  constructor(scene: Phaser.Scene, physics: PhysicsSystem, particles: ParticleSystem, bossId: string, x: number, y: number, projectiles: Projectile[], playerPos: () => Phaser.Math.Vector2) {
    this.scene = scene;
    this.physics = physics;
    this.particles = particles;
    this.data = getBoss(bossId);
    this.id = bossId;
    this.projectiles = projectiles;
    this.playerPos = playerPos;
    this.homeY = y;
    this.maxHealth = this.data.maxHealth;
    this.health = this.maxHealth;
    this.currentPhaseData = this.data.phases[0];

    // *** FIX: setDisplaySize BEFORE setRectangle (MatterImage scales body with display size)
    // Also fix B4: use this.id instead of hardcoded 'boss'
    // Leviathan is much larger than other bosses (80m mech)
    const bossSize = this.id === 'leviathan_hulk' ? 180 : 120;
    const bossHeight = this.id === 'leviathan_hulk' ? 150 : 110;
    this.sprite = scene.matter.add.image(x, y, '__white', undefined, {
      label: this.id, frictionAir: 0.05, density: 0.005,
    });
    this.sprite.setDisplaySize(bossSize, bossHeight);
    this.sprite.setRectangle(bossSize, bossHeight, {
      label: this.id, frictionAir: 0.05, density: 0.005,
    });
    this.sprite.setAlpha(0);
    this.sprite.setFixedRotation();
    this.sprite.setIgnoreGravity(true);
    this.sprite.setData('entity', this);
    this.sprite.setData('entityType', 'boss');
    this.sprite.setData('id', this.id);  // *** FIX B4: was hardcoded 'boss'
    this.buildVisual();
    EventBus.emit('BOSS_PHASE', { phase: this.phase, healthPct: 1.0 });
  }

  private buildVisual(): void {
    if (this.id === 'leviathan_hulk') {
      this.buildLeviathanVisual();
    } else {
      this.buildGenericBossVisual();
    }
  }

  /** Leviathan Hulk — massive, rusted, waterlogged mech with shield mechanic.
   * She is a guardian, not a hunter. In Phase 1 she shields herself and
   * fights defensively. In Phase 2 (45% HP) the shield breaks and she
   * becomes aggressive with her city-defense cannon. */
  private buildLeviathanVisual(): void {
    const g = this.scene.add.graphics();
    g.setDepth(14);

    // ── Main body — massive, 80m mech scaled down ──
    // Torso (dark, waterlogged)
    g.fillStyle(0x1a2a18, 1);
    g.fillRoundedRect(-60, -50, 120, 100, 10);

    // Rusted metal patches (orange-brown)
    g.fillStyle(0x5a3a1a, 0.6);
    g.fillCircle(-25, -20, 14);
    g.fillCircle(28, 5, 12);
    g.fillCircle(-5, 30, 10);
    g.fillCircle(35, -25, 9);
    g.fillCircle(-35, 15, 8);

    // Moss/algae layer on top (she's been in water for 1000 years)
    g.fillStyle(0x3a5a28, 0.7);
    g.fillRoundedRect(-60, -50, 120, 14, 7);
    g.fillStyle(0x4a6a30, 0.5);
    g.fillCircle(-35, -45, 5);
    g.fillCircle(-10, -48, 4);
    g.fillCircle(15, -46, 5);
    g.fillCircle(38, -44, 4);

    // Water drip streaks (vertical, from body)
    g.fillStyle(0x2a4a18, 0.3);
    g.fillRect(-40, -35, 2, 50);
    g.fillRect(-15, -30, 2, 45);
    g.fillRect(15, -25, 2, 40);
    g.fillRect(35, -20, 2, 35);

    // Corroded outline
    g.lineStyle(2, 0x0a1a08, 0.9);
    g.strokeRoundedRect(-60, -50, 120, 100, 10);

    // ── Left arm — shield arm (defensive) ──
    g.fillStyle(0x2a3a20, 0.85);
    g.fillRoundedRect(-80, -35, 25, 50, 4);
    // Shield plate (large, rusted)
    g.fillStyle(0x3a4a28, 0.8);
    g.fillRoundedRect(-90, -45, 30, 70, 5);
    g.fillStyle(0x5a3a1a, 0.4);
    g.fillCircle(-75, -20, 8);
    g.fillCircle(-78, 10, 6);
    g.lineStyle(1, 0x0a1a08, 0.7);
    g.strokeRoundedRect(-90, -45, 30, 70, 5);
    // Shield glow (amber — still active, fading)
    g.fillStyle(0xff8030, 0.08);
    g.fillRoundedRect(-88, -43, 26, 66, 4);

    // ── Right arm — cannon arm (city-defense weapon) ──
    g.fillStyle(0x2a3a20, 0.85);
    g.fillRoundedRect(55, -35, 25, 50, 4);
    // Cannon barrel (thick, rusted)
    g.fillStyle(0x3a4a28, 0.8);
    g.fillRoundedRect(75, -15, 35, 25, 3);
    g.fillStyle(0x1a1e24, 0.9);
    g.fillCircle(105, -2, 6);  // muzzle
    g.lineStyle(1, 0x0a1a08, 0.6);
    g.strokeRoundedRect(75, -15, 35, 25, 3);

    // ── Head — small, hunched, with command light ──
    g.fillStyle(0x1a2a18, 1);
    g.fillRoundedRect(-15, -65, 30, 18, 3);
    g.fillStyle(0x3a5a28, 0.6);
    g.fillRoundedRect(-15, -65, 30, 5, 2);
    g.lineStyle(1, 0x0a1a08, 0.8);
    g.strokeRoundedRect(-15, -65, 30, 18, 3);

    // ── Command eye — sickly amber (old order light, still on) ──
    // This is the "AWAITING ORDER" indicator — still blinking after 1000 years
    g.fillStyle(0xff8030, 0.12);
    g.fillCircle(0, -56, 12);
    this.bossCore = this.scene.add.circle(this.sprite.x, this.sprite.y, 6, 0xff8030, 0.7);
    this.bossCore.setDepth(15);
    this.bossCore.setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0xffa040, 0.9);
    g.fillCircle(0, -56, 4);
    g.fillStyle(0xffd060, 1);
    g.fillCircle(0, -56, 2);

    // ── Chest detail — "AWAITING ORDER" text panel ──
    g.fillStyle(0x0a1a08, 0.8);
    g.fillRoundedRect(-25, 10, 50, 12, 2);
    g.fillStyle(0xff6020, 0.25);
    g.fillRoundedRect(-23, 12, 46, 8, 1);
    // Blinking indicator dots
    g.fillStyle(0xff8030, 0.6);
    g.fillCircle(-18, 16, 1.5);
    g.fillCircle(18, 16, 1.5);

    // ── Legs — massive, planted (she doesn't move much) ──
    for (const side of [-1, 1]) {
      g.fillStyle(0x1a2a18, 1);
      g.fillRoundedRect(side * 25 - 12, 45, 24, 30, 3);
      g.fillStyle(0x3a5a28, 0.4);
      g.fillRoundedRect(side * 25 - 12, 45, 24, 5, 2);
      g.fillStyle(0x5a3a1a, 0.3);
      g.fillCircle(side * 25, 60, 4);
      g.lineStyle(1, 0x0a1a08, 0.6);
      g.strokeRoundedRect(side * 25 - 12, 45, 24, 30, 3);
    }

    this.bossGfx = g;

    // Shield active flag — when true, boss takes 50% reduced damage
    this.shieldActive = true;
  }

  /** Generic boss visual (Guardian, Neural Overseer). */
  private buildGenericBossVisual(): void {
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

  getContactDamage(): number { return this.data.contactDamage; }

  takeDamage(amount: number): boolean {
    if (!this.isAlive || amount <= 0) return false;
    // Shield mechanic: Leviathan takes 50% reduced damage when shield is active
    let actualDamage = amount;
    if (this.shieldActive) {
      actualDamage = Math.floor(amount * 0.5);
    }
    this.health = Math.max(0, this.health - actualDamage);
    const phaseChanged = this.updatePhase();
    if (phaseChanged) {
      AudioSystem.play('phaseChange');
      this.bossGfx?.setAlpha(0.3);
      this.scene.time.delayedCall(200, () => { if (this.isAlive) this.bossGfx?.setAlpha(1); });
      this.scene.cameras.main.flash(150, 255, 80, 80);
      // Leviathan: shield breaks on phase 2 (she has nothing left to protect)
      if (this.id === 'leviathan_hulk' && this.phase === 2) {
        this.shieldActive = false;
        this.scene.cameras.main.flash(300, 255, 128, 0);
        this.scene.cameras.main.shake(200, 0.01);
      }
    } else {
      AudioSystem.play('bossHit');
    }
    if (this.health <= 0) this.die();
    return true;
  }

  private updatePhase(): boolean {
    const pct = this.health / this.maxHealth;
    let newPhase = 1;
    for (let i = 0; i < this.data.phases.length; i++) {
      if (pct <= this.data.phases[i].healthPct) newPhase = i + 1;
    }
    if (newPhase !== this.phase) {
      this.phase = newPhase;
      this.currentPhaseData = this.data.phases[this.phase - 1];
      this.actionCooldown = Math.max(500, 1500 - (this.phase - 1) * 400);
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

    if (now >= this.lastActionAt + this.actionCooldown) {
      this.lastActionAt = now;
      const attacks = this.currentPhaseData.attacks;
      const action = attacks[Math.floor(Math.random() * attacks.length)];
      switch (action) {
        case 'shoot': this.fire(pp); break;
        case 'lunge': this.lunge(pp); break;
        case 'teleport': this.teleport(pp); break;
        case 'beam': this.fireBeam(pp); break;
      }
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
      const proj = new Projectile(this.scene, this.physics, this.particles, from, dir, {
        speed: 5, damage: 10, ttl: 3000, owner: 'enemy', color: COLORS.ENEMY_PROJ, size: 7,
      });
      this.projectiles.push(proj);
    }
  }

  /** Beam attack — fires a wide spread of 5 projectiles in a fan. */
  private fireBeam(playerPos: Phaser.Math.Vector2): void {
    // Reset cooldown so beam fires all projectiles
    this.lastFireAt = 0;
    const from = this.position;
    const baseAngle = Math.atan2(playerPos.y - from.y, playerPos.x - from.x);
    // 5 projectiles in a wider fan (0.4 rad spread)
    for (let i = -2; i <= 2; i++) {
      const angle = baseAngle + i * 0.2;
      const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
      const proj = new Projectile(this.scene, this.physics, this.particles, from, dir, {
        speed: 7, damage: 12, ttl: 2500, owner: 'enemy', color: 0xff60ff, size: 9,
      });
      this.projectiles.push(proj);
    }
    // Beam telegraph flash
    if (this.bossGfx) {
      this.bossGfx.setAlpha(0.3);
      this.scene.tweens.add({
        targets: this.bossGfx, alpha: 1, duration: 200,
      });
    }
  }

  private lunge(playerPos: Phaser.Math.Vector2): void {
    const dx = playerPos.x - this.sprite.x;
    const dir = dx > 0 ? 1 : -1;
    this.lungeVel.set(dir * 6, 0);
  }

  private teleport(playerPos: Phaser.Math.Vector2): void {
    this.scene.cameras.main.flash(120, 200, 80, 200);
    AudioSystem.play('phaseChange');
    this.bossGfx?.setAlpha(0.3);
    const dx = this.sprite.x < playerPos.x ? -1 : 1;
    this.sprite.setPosition(playerPos.x - dx * 350, this.homeY);
    this.lungeVel.set(-dx * 6, 0);
    this.scene.time.delayedCall(200, () => this.bossGfx?.setAlpha(1));
  }

  private die(): void {
    if (!this.isAlive) return;
    this.isAlive = false;
    // Moment 9: Atlas kneels — slow, quiet death. Not an explosion.
    this.sprite.setVelocity(0, 0);
    this.lungeVel.set(0, 0);
    // Slow kneel — graphics squish down and fade
    if (this.bossGfx) {
      this.bossGfx.setAlpha(0.8);
      this.scene.tweens.add({
        targets: this.bossGfx,
        alpha: { from: 0.8, to: 0.3 },
        scaleY: { from: 1, to: 0.6 },
        duration: 2000, ease: 'Sine.out',
      });
    }
    if (this.bossCore) {
      this.scene.tweens.add({
        targets: this.bossCore,
        alpha: { from: 1, to: 0.05 },
        duration: 2000, ease: 'Sine.out',
      });
    }
    // Record boss kill + time
    const stageStart = (this.scene as unknown as { stageStartTime?: number }).stageStartTime ?? this.scene.time.now;
    const elapsed = this.scene.time.now - stageStart;
    SaveSystem.recordBossKill(this.id, elapsed);
    // Drop items
    if (this.data.drops) {
      for (const drop of this.data.drops) {
        if (Math.random() < drop.chance) {
          const amount = drop.minAmount + Math.floor(Math.random() * (drop.maxAmount - drop.minAmount + 1));
          SaveSystem.addItem(drop.itemId, amount);
          EventBus.emit('ITEM_COLLECTED', { itemId: drop.itemId, amount });
        }
      }
    }
    // Award XP
    const xpResult = SaveSystem.awardXp(200);
    if (xpResult.leveledUp) {
      EventBus.emit('LEVEL_UP', { level: xpResult.newLevel });
      AudioSystem.play('levelUp');
    }
    // Emit death events after kneeling animation (1.5s delay)
    this.scene.time.delayedCall(1500, () => {
      EventBus.emit('BOSS_PHASE', { phase: 0, healthPct: 0, dead: true });
      EventBus.emit('BOSS_DEAD', { id: this.id, lore: this.data.lore });
    });
    // Destroy sprite after full kneeling (2.2s)
    this.scene.time.delayedCall(2200, () => {
      this.bossGfx?.destroy(); this.bossGfx = null;
      this.bossCore?.destroy(); this.bossCore = null;
      if (this.sprite && this.sprite.active) this.sprite.destroy();
    });
  }

  destroy(): void {
    this.bossGfx?.destroy();
    this.bossCore?.destroy();
    if (this.sprite && this.sprite.active) this.sprite.destroy();
    this.isAlive = false;
  }

  /** Get lore lines (localized) for death screen. */
  getLoreLines(): string[] {
    return this.data.lore.map(key => t(key));
  }

  /** Get boss name (localized). */
  get name(): string { return t(this.data.nameKey); }

  /** Get health percentage (0-1) for boss health bar. */
  getHealthPct(): number {
    return Math.max(0, this.health / this.maxHealth);
  }

  /** Static accessor for boss data (used by BossHealthBarUI for boss name). */
  static getBossData(bossId: string): import('../../data/types').BossData | null {
    return getBoss(bossId) ?? null;
  }
}

export default BossEntity;
