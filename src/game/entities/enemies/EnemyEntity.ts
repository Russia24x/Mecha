/**
 * MECHA: LAST PROTOCOL — Enemy Entity
 * Data-driven: all stats from EnemyData database.
 * FSM: patrol → aggro → attack (telegraph→window→recovery) → stagger
 * Uses PhysicsSystem for LOS, CombatSystem via takeDamage.
 */
import Phaser from 'phaser';
import { EventBus } from '../../systems/EventBus';
import { AudioSystem } from '../../systems/AudioSystem';
import { PhysicsSystem } from '../../systems/PhysicsSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { getEnemy } from '../../data/enemies/enemies';
import { getItem } from '../../data/items/items';
import type { EnemyTypeId, EnemyData, EnemyState } from '../../data/types';
import { Projectile } from '../combat/Projectile';
import { MechaSpriteFactory, type MechVisualHandle } from '../sprites/MechaSpriteFactory';

let enemyCounter = 0;

export class EnemyEntity {
  public sprite: Phaser.Physics.Matter.Image;
  public id: string;
  public type: EnemyTypeId;
  public data: EnemyData;
  private health: number;
  private alive = true;
  private scene: Phaser.Scene;
  private physics: PhysicsSystem;
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
  private visual: MechVisualHandle | null = null;
  private facing: 1 | -1 = 1;
  private animTime = 0;
  // ── Phase 3: Posture / Stagger system (Souls-like) ──
  // Enemies have a posture bar that fills when hit. When full, they stagger
  // (stunned for 1.5s, take 50% more damage = crit window).
  // Per Design Pillars: "Combat: Heavy·Precise·Punishing"
  private posture = 0;            // 0..maxPosture
  private maxPosture = 100;       // fills to this = stagger
  private staggeredUntil = 0;     // timestamp when stagger ends
  private postureBar: Phaser.GameObjects.Rectangle | null = null;
  private postureBarBg: Phaser.GameObjects.Rectangle | null = null;
  private static readonly STAGGER_DURATION_MS = 1500;
  private static readonly POSTURE_DECAY_PER_SEC = 15;  // posture decays when not hit
  public hacked = false;  // When true, enemy is friendly (hacked by player)

  private particles: import('../../systems/ParticleSystem').ParticleSystem;

  constructor(scene: Phaser.Scene, physics: PhysicsSystem, particles: import('../../systems/ParticleSystem').ParticleSystem, x: number, y: number, type: EnemyTypeId, projectiles: Projectile[]) {
    this.scene = scene;
    this.physics = physics;
    this.particles = particles;
    this.type = type;
    this.data = getEnemy(type);
    this.id = `${type}-${++enemyCounter}`;
    this.health = this.data.hp;
    this.projectiles = projectiles;
    this.hoverBase = y;

    // *** FIX: setDisplaySize BEFORE setRectangle (MatterImage scales body with display size)
    this.sprite = scene.matter.add.image(x, y, '__white', undefined, {
      label: this.id, frictionAir: 0.04, density: 0.003,
    });
    this.sprite.setDisplaySize(this.data.size.w, this.data.size.h);
    this.sprite.setRectangle(this.data.size.w, this.data.size.h, {
      label: this.id, frictionAir: 0.04, density: 0.003,
    });
    this.sprite.setAlpha(0);
    this.sprite.setFixedRotation();
    if (this.data.flying) this.sprite.setIgnoreGravity(true);
    this.sprite.setData('entity', this);
    this.sprite.setData('entityType', 'enemy');
    this.sprite.setData('id', this.id);
    this.buildVisual();
  }

  private buildVisual(): void {
    // Use the factory for all enemy types — real mech designs, not geometric shapes
    const c = this.data.color;
    switch (this.type) {
      case 'drone':       this.visual = MechaSpriteFactory.buildDrone(this.scene, c); break;
      case 'spider':      this.visual = MechaSpriteFactory.buildSpider(this.scene, c); break;
      case 'sniper':      this.visual = MechaSpriteFactory.buildSniper(this.scene, c); break;
      case 'heavy':       this.visual = MechaSpriteFactory.buildHeavy(this.scene, c); break;
      case 'flying_ai':   this.visual = MechaSpriteFactory.buildFlyingAi(this.scene, c); break;
      case 'elite':       this.visual = MechaSpriteFactory.buildElite(this.scene, c); break;
      case 'drowned_walker': this.visual = MechaSpriteFactory.buildDrownedWalker(this.scene, c); break;
      case 'mosquito_drone': this.visual = MechaSpriteFactory.buildMosquitoDrone(this.scene, c); break;
      default:            this.visual = MechaSpriteFactory.buildDrone(this.scene, c); break;
    }
  }

  get isAlive(): boolean { return this.alive; }
  get position(): Phaser.Math.Vector2 {
    if (!this.sprite || !this.sprite.active) return new Phaser.Math.Vector2(0, 0);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  takeDamage(amount: number): boolean {
    if (!this.alive || amount <= 0) return false;
    // ── Phase 3: Crit window during stagger — 50% bonus damage ──
    let effectiveDamage = amount;
    const isStaggered = this.scene.time.now < this.staggeredUntil;
    if (isStaggered) {
      effectiveDamage = amount * 1.5;
    }
    this.health -= effectiveDamage;
    this.flashUntil = this.scene.time.now + 80;

    // ── Phase 3: Fill posture bar on hit ──
    // Posture fills based on damage dealt. Melee fills faster (heavier hits).
    this.posture = Math.min(this.maxPosture, this.posture + amount * 0.8);
    this.updatePostureBar();

    // If posture full → stagger (stun + crit window)
    if (this.posture >= this.maxPosture && !isStaggered) {
      this.startStagger();
    } else if (this.state === 'attack' && this.attackPhase === 'telegraph') {
      // Light hit during telegraph = interrupt (existing behavior)
      this.changeState('stagger');
    }

    if (this.health <= 0) { this.die(); return true; }
    return true;
  }

  /** Phase 3: Start stagger — enemy is stunned, takes 50% more damage. */
  private startStagger(): void {
    this.staggeredUntil = this.scene.time.now + EnemyEntity.STAGGER_DURATION_MS;
    this.changeState('stagger');
    // Visual: screen flash + spark burst to telegraph the crit window
    this.particles.sparks(this.sprite.x, this.sprite.y, 0xffcc00, 8);
    // Reset posture so bar must fill again
    this.posture = 0;
    this.updatePostureBar();
  }

  /** ── FIX Bug 3: Public method for EMP to force-stagger an enemy ── */
  public forceStagger(): void {
    if (!this.alive || !this.sprite || !this.sprite.active) return;
    this.startStagger();
  }

  /** Phase 3: Create/Update the posture bar above the enemy. */
  private updatePostureBar(): void {
    if (!this.sprite || !this.sprite.active) return;
    const x = this.sprite.x;
    const y = this.sprite.y - this.data.size.h / 2 - 12;
    const barW = 40;
    const pct = this.posture / this.maxPosture;

    // Create bar if it doesn't exist
    if (!this.postureBarBg) {
      this.postureBarBg = this.scene.add.rectangle(x, y, barW + 2, 5, 0x05080c, 0.8);
      this.postureBarBg.setStrokeStyle(1, 0x2a3040, 0.6);
      this.postureBarBg.setDepth(13);
    }
    if (!this.postureBar) {
      this.postureBar = this.scene.add.rectangle(x - barW / 2, y, barW, 3, 0xffcc00, 0.9);
      this.postureBar.setOrigin(0, 0.5);
      this.postureBar.setDepth(14);
    }

    // Update position + width
    this.postureBarBg.setPosition(x, y);
    this.postureBar.setPosition(x - barW / 2, y);
    this.postureBar.setDisplaySize(barW * pct, 3);

    // Color: amber → red as posture fills
    if (pct > 0.7) this.postureBar.setFillStyle(0xff4040, 0.9);
    else if (pct > 0.4) this.postureBar.setFillStyle(0xff8030, 0.9);
    else this.postureBar.setFillStyle(0xffcc00, 0.7);

    // Hide bar when posture is 0 (no visual clutter)
    const showBar = pct > 0.01;
    this.postureBarBg.setVisible(showBar);
    this.postureBar.setVisible(showBar);
  }

  private die(): void {
    if (!this.alive) return;
    this.alive = false;
    const posX = this.sprite.x;
    const posY = this.sprite.y;
    // Award XP + record kill
    SaveSystem.recordKill();
    const xpResult = SaveSystem.awardXp(this.data.xpReward);
    if (xpResult.leveledUp) {
      EventBus.emit('LEVEL_UP', { level: xpResult.newLevel });
      AudioSystem.play('levelUp');
    }
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
    EventBus.emit('ENEMY_DEAD', { id: this.id, score: this.data.score, x: posX, y: posY });
    if (this.telegraphGfx) { this.telegraphGfx.destroy(); this.telegraphGfx = null; }
    this.postureBar?.destroy(); this.postureBar = null;
    this.postureBarBg?.destroy(); this.postureBarBg = null;
    this.visual?.destroy();
    this.visual = null;
    this.visualGfx?.destroy();
    this.visualGfx = null;
    this.sprite.destroy();
  }

  destroy(): void {
    if (this.telegraphGfx) { this.telegraphGfx.destroy(); this.telegraphGfx = null; }
    this.postureBar?.destroy(); this.postureBar = null;
    this.postureBarBg?.destroy(); this.postureBarBg = null;
    this.visual?.destroy();
    this.visual = null;
    this.visualGfx?.destroy();
    this.visualGfx = null;
    if (this.sprite && this.sprite.active) this.sprite.destroy();
    this.alive = false;
  }

  private hasLineOfSight(playerPos: Phaser.Math.Vector2): boolean {
    if (!this.sprite || !this.sprite.active || !this.sprite.body) return false;
    return this.physics.hasLineOfSight(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y, this.sprite.body as MatterJS.BodyType);
  }

  private changeState(next: EnemyState): void {
    if (this.state === next) return;
    this.state = next;
    this.stateTime = 0;
    this.attackPhase = 'telegraph';
    if (this.telegraphGfx) { this.telegraphGfx.destroy(); this.telegraphGfx = null; }
  }

  update(deltaMs: number, playerPos: Phaser.Math.Vector2): void {
    if (!this.alive || !this.sprite || !this.sprite.active) return;
    this.stateTime += deltaMs;

    // ── Phase 3: Posture decay (posture slowly drains when not being hit) ──
    if (this.posture > 0 && this.scene.time.now > this.flashUntil) {
      this.posture = Math.max(0, this.posture - EnemyEntity.POSTURE_DECAY_PER_SEC * (deltaMs / 1000));
      this.updatePostureBar();
    }

    // ── Phase 3: Stagger state — can't act, takes crit damage ──
    const isStaggered = this.scene.time.now < this.staggeredUntil;
    if (isStaggered && this.state !== 'stagger') {
      this.changeState('stagger');
    }

    switch (this.state) {
      case 'patrol':
        this.onPatrol();
        // Hacked enemies never aggro the player
        if (!this.hacked && !isStaggered && this.inRange(playerPos) && this.hasLineOfSight(playerPos)) this.changeState('aggro');
        break;
      case 'aggro':
        this.onAggro(playerPos);
        if (!this.hacked && !isStaggered && (!this.inRange(playerPos) || !this.hasLineOfSight(playerPos))) this.changeState('patrol');
        break;
      case 'attack':
        if (!isStaggered && !this.hacked) this.runAttackFSM(playerPos);
        break;
      case 'stagger':
        // Phase 3: stagger lasts until staggeredUntil expires, then return to aggro
        if (!isStaggered) this.changeState('aggro');
        break;
    }
    this.updateFlash(deltaMs);
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
    // Different telegraph styles per enemy type — teaches player to read danger
    if (this.type === 'sniper') {
      // SNIPER: laser sight line toward player — "learn to read the environment"
      // Red beam from sniper toward player direction
      const targetAngle = this.scene.time.now; // will be updated in onAttackTelegraph
      this.telegraphGfx = this.scene.add.circle(this.sprite.x, this.sprite.y, 8, 0xff0000, 0.3);
      this.telegraphGfx.setStrokeStyle(2, 0xff0000, 0.8);
      this.telegraphGfx.setDepth(12);
      // Pulsing red dot on sniper
      this.scene.tweens.add({
        targets: this.telegraphGfx,
        scale: { from: 0.8, to: 1.5 }, alpha: { from: 0.3, to: 0.8 },
        duration: 200, yoyo: true, repeat: -1,
      });
    } else if (this.type === 'flying_ai') {
      // FLYING AI: warning indicator above — "learn to look up"
      this.telegraphGfx = this.scene.add.circle(this.sprite.x, this.sprite.y, 20, 0xffaa00, 0);
      this.telegraphGfx.setStrokeStyle(3, 0xffaa00, 0.9);
      this.telegraphGfx.setDepth(12);
      this.scene.tweens.add({
        targets: this.telegraphGfx,
        scale: { from: 0.3, to: 1.2 }, alpha: { from: 0.8, to: 0.2 },
        duration: this.data.timings.telegraphMs, ease: 'Quad.easeOut',
      });
    } else if (this.type === 'heavy' || this.type === 'elite') {
      // HEAVY/ELITE: ground shake warning — "learn to not be greedy"
      this.telegraphGfx = this.scene.add.circle(this.sprite.x, this.sprite.y, 40, 0xff00ff, 0);
      this.telegraphGfx.setStrokeStyle(3, 0xff00ff, 0.9);
      this.telegraphGfx.setDepth(12);
      this.scene.tweens.add({
        targets: this.telegraphGfx,
        scale: { from: 0.5, to: 1.3 }, alpha: { from: 0.6, to: 0.1 },
        duration: this.data.timings.telegraphMs, ease: 'Quad.easeOut',
      });
    } else {
      // DRONE/DEFAULT: standard charge circle
      this.telegraphGfx = this.scene.add.circle(this.sprite.x, this.sprite.y, 30, 0xff3030, 0);
      this.telegraphGfx.setStrokeStyle(2, 0xff3030, 0.7);
      this.telegraphGfx.setDepth(12);
      this.scene.tweens.add({
        targets: this.telegraphGfx,
        scale: { from: 0.5, to: 1.5 }, alpha: { from: 0.7, to: 0.2 },
        duration: this.data.timings.telegraphMs, ease: 'Quad.easeOut',
      });
    }
  }

  private inRange(playerPos: Phaser.Math.Vector2): boolean {
    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y);
    return d < this.data.detectionRange;
  }

  private onPatrol(): void {
    if (this.data.flying) {
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
    if (this.type === 'flying_ai') {
      // FLYING AI: hovers ABOVE player, then dive-bombs — "learn to look up"
      const targetY = playerPos.y - 120; // stay 120px above player
      const yDiff = targetY - this.sprite.y;
      this.sprite.setVelocityY(yDiff * 0.05);
      if (absDx > this.data.attackRange + 40) this.sprite.setVelocityX(dir * this.data.speed);
      else if (absDx < this.data.attackRange - 60) this.sprite.setVelocityX(-dir * this.data.speed * 0.5);
      else this.changeState('attack');
    } else if (this.data.flying) {
      // DRONE: standard hover + strafe
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
      // Spider telegraph: body compresses (squash) before lunge
      const t = Math.min(1, this.stateTime / this.data.timings.telegraphMs);
      if (this.visual) this.visual.container.setScale(this.facing * Phaser.Math.Linear(1, 1.2, t), Phaser.Math.Linear(1, 0.7, t));
      this.sprite.setVelocityX(0);
    } else if (this.type === 'heavy' || this.type === 'elite') {
      // Heavy/Elite telegraph: flicker alpha + slight jitter (winding up)
      if (this.visual) {
        const flash = Math.floor(this.stateTime / 80) % 2 === 0;
        this.visual.container.setAlpha(flash ? 0.5 : 1.0);
        this.visual.setCorePulse(1);  // max eye brightness — danger
      }
      this.sprite.setVelocityX((Math.random() - 0.5) * 2);
    } else {
      const hover = this.hoverBase + Math.sin(this.scene.time.now / 360) * 12;
      this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
      this.sprite.setVelocityX(0);
    }
  }

  private onAttackWindow(playerPos: Phaser.Math.Vector2): void {
    if (this.type === 'flying_ai') {
      // FLYING AI: dive-bomb attack — swoops down at player, "learn to look up"
      const dx = playerPos.x - this.sprite.x;
      const dy = playerPos.y - this.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        this.sprite.setVelocityX((dx / dist) * (this.data.speed * 3));
        this.sprite.setVelocityY((dy / dist) * (this.data.speed * 3));
      }
      // Dive-bomb: thruster at max + tilt forward
      if (this.visual) {
        this.visual.setThrusterIntensity(1);
        this.visual.container.setScale(this.facing * 1.1, 0.9);  // stretched in dive
      }
    } else if (this.data.attackType === 'shoot' || this.data.attackType === 'snipe') {
      this.fire(playerPos);
    } else if (this.data.attackType === 'lunge') {
      this.sprite.setVelocityX(this.lungeDir * (this.data.lungeSpeed ?? 7));
      if (this.visual) this.visual.container.setScale(this.facing, 1);
    } else if (this.data.attackType === 'charge') {
      this.sprite.setVelocityX(this.lungeDir * (this.data.chargeSpeed ?? 5));
      // Heavy charge: lean forward
      if (this.visual) this.visual.container.setScale(this.facing * 1.1, 0.95);
    }
  }

  private onAttackRecovery(): void {
    const now = this.scene.time.now;
    if (this.data.flying) {
      if (now - this.lastStrafeChange > 300) { this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.lastStrafeChange = now; }
      this.sprite.setVelocityX(this.strafeDir * this.data.speed * 0.6);
      const hover = this.hoverBase + Math.sin(now / 360) * 12;
      this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
      // Reset thruster / scale after dive-bomb
      if (this.visual && this.type === 'flying_ai') {
        this.visual.setThrusterIntensity(0.3);
        this.visual.container.setScale(this.facing, 1);
      }
    } else {
      const body = this.sprite.body;
      this.sprite.setVelocityX((body ? body.velocity.x : 0) * 0.85);
      if (this.visual) this.visual.container.setScale(this.facing, 1);
    }
  }

  private fire(playerPos: Phaser.Math.Vector2): void {
    if (this.lastFireAt > 0 && this.scene.time.now - this.lastFireAt < 100) return;
    this.lastFireAt = this.scene.time.now;
    const from = this.position;
    const dir = new Phaser.Math.Vector2(playerPos.x - from.x, playerPos.y - from.y).normalize();
    const proj = new Projectile(this.scene, this.physics, this.particles, from, dir, {
      speed: this.data.bulletSpeed ?? 5, damage: this.data.bulletDamage ?? 6,
      ttl: 2000, owner: 'enemy', color: 0xff4a4a, size: 5,
    });
    this.projectiles.push(proj);
  }

  private updateFlash(deltaMs: number): void {
    if (!this.sprite || !this.sprite.active) return;
    if (!this.visual) return;
    // Update visual position + facing
    this.visual.container.setPosition(this.sprite.x, this.sprite.y);
    this.animTime += deltaMs;  // N9 fix: use deltaMs instead of hardcoded 16
    const body = this.sprite.body;
    const vx = body?.velocity.x ?? 0;
    if (Math.abs(vx) > 0.5) {
      this.facing = vx > 0 ? 1 : -1;
    }
    this.visual.setFacing(this.facing);

    // Hacked enemies get a green tint to show they're friendly
    if (this.hacked) {
      this.visual.container.setAlpha(0.9);
      this.visual.setCorePulse(0.7);
      // Green tint via scale pulse
      const pulse = 1 + Math.sin(this.animTime / 200) * 0.05;
      this.visual.container.setScale(this.facing * pulse, pulse);
      // Periodic green spark
      if (this.animTime % 60 < 16) {
        this.particles.sparks(this.sprite.x, this.sprite.y, 0x40ff80, 1);
      }
      return;
    }

    // Damage flash — brighten + scale punch when recently hit
    const inTelegraph = this.state === 'attack' && this.attackPhase === 'telegraph';
    if (!inTelegraph) {
      if (this.scene.time.now < this.flashUntil) {
        this.visual.container.setAlpha(0.7);
        this.visual.setCorePulse(1);  // brighten eye on hit
        // Tiny scale punch
        this.visual.container.setScale(this.facing * 1.15, 1.15);
      } else {
        this.visual.container.setAlpha(1);
        this.visual.setCorePulse(0.5);
        this.visual.container.setScale(this.facing, 1);
      }
    } else {
      // Telegraph: brighten eye to max + slight pulse
      this.visual.setCorePulse(1);
      const pulse = 1 + Math.sin(this.animTime / 60) * 0.08;
      this.visual.container.setScale(this.facing * pulse, pulse);
    }
  }
}

export function resetEnemyIds(): void { enemyCounter = 0; }

export default EnemyEntity;
