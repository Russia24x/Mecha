/**
 * MECHA: LAST PROTOCOL — Player Entity
 * Data-driven: stats derived from skills, weapons from WeaponData.
 * Uses InputSystem (no direct window listeners).
 * Uses CombatSystem for melee, ParticleSystem for effects.
 * Communicates via EventBus.
 */
import Phaser from 'phaser';
import { COLORS, PLAYER } from '../../shared/Constants';
import { EventBus } from '../../systems/EventBus';
import { AudioSystem } from '../../systems/AudioSystem';
import { InputSystem } from '../../systems/InputSystem';
import { CombatSystem } from '../../systems/CombatSystem';
import { PhysicsSystem } from '../../systems/PhysicsSystem';
import { ParticleSystem } from '../../systems/ParticleSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { getWeapon } from '../../data/weapons/weapons';
import { getSkill } from '../../data/skills/skills';
import { SKILLS } from '../../data/skills/skills';
import type { WeaponId, WeaponData, PlayerStats, Direction } from '../../data/types';
import { Projectile } from '../combat/Projectile';
import { MechaSpriteFactory, type MechVisualHandle } from '../sprites/MechaSpriteFactory';

export class PlayerEntity {
  public sprite: Phaser.Physics.Matter.Image;
  public health: { current: number; max: number };
  public energy: { current: number; max: number; regenPerSec: number };
  public facing: Direction = 'right';
  public id = 'player';
  public alive = true;

  private scene: Phaser.Scene;
  private physics: PhysicsSystem;
  private particles: ParticleSystem;
  private combat: CombatSystem;
  private projectiles: Projectile[];

  // Computed stats (from base + skills)
  private stats: PlayerStats;
  private currentWeapon: WeaponId;
  private unlockedWeapons: Set<WeaponId>;
  private abilities: Set<string>;

  // Combat state
  private lastFireAt = 0;
  private lastMeleeAt = 0;
  private aimAngle = 0;
  private keyAimY = 0;

  // Movement state
  private isDashing = false;
  private dashUntil = 0;
  private dashAvailableAt = 0;
  private dashDir: Direction = 'right';
  private grounded = false;
  private jumpBufferUntil = 0;
  private coyoteUntil = 0;
  private jumpsRemaining = 1;
  private maxJumps = 1;
  private lastAfterimageAt = 0;
  private touchingWall: 'left' | 'right' | null = null;
  private wallJumpUntil = 0;
  private wallSlideActive = false;
  private lastWallSlideFx = 0;

  private invulnUntil = 0;
  private flashTimer = 0;
  private animTime = 0;
  private wasGrounded = true;

  // Visual handle — MechVisualHandle from factory (multi-layered mech)
  private visual: MechVisualHandle | null = null;
  // Physics polish state
  private squashY = 1;   // vertical scale (squash/stretch)
  private squashX = 1;   // horizontal scale
  private tilt = 0;      // momentum tilt (radians)
  private lastVy = 0;
  private lastVx = 0;
  private groundedLastFrame = true;
  private jumpAnticipationUntil = 0;
  private lastThrusterEmit = 0;

  constructor(
    scene: Phaser.Scene,
    physics: PhysicsSystem,
    particles: ParticleSystem,
    combat: CombatSystem,
    x: number, y: number,
    projectiles: Projectile[]
  ) {
    this.scene = scene;
    this.physics = physics;
    this.particles = particles;
    this.combat = combat;
    this.projectiles = projectiles;

    // Load save state
    const save = SaveSystem.getPlayer();
    this.stats = this.computeStats(save.unlockedSkills);
    this.currentWeapon = save.currentWeapon as WeaponId;
    this.unlockedWeapons = new Set(save.unlockedWeapons as WeaponId[]);
    this.abilities = new Set(save.abilities);
    this.maxJumps = this.abilities.has('doubleJump') ? 2 : 1;

    this.health = { current: this.stats.maxHealth, max: this.stats.maxHealth };
    this.energy = { current: this.stats.maxEnergy, max: this.stats.maxEnergy, regenPerSec: this.stats.energyRegen };

    // Physics body — *** FIX: setDisplaySize BEFORE setRectangle.
    // setDisplaySize on a MatterImage also scales the body (because MatterImage
    // binds body to texture size). So we must call setDisplaySize first, then
    // setRectangle to create the body at the correct size.
    const bw = PLAYER.BODY_RADIUS * 2.2;
    const bh = PLAYER.BODY_RADIUS * 2.6;
    this.sprite = scene.matter.add.image(x, y, '__white', undefined, {
      label: 'player',
      friction: 0.01, frictionAir: 0.02, density: 0.004,
    });
    this.sprite.setDisplaySize(bw, bh);
    this.sprite.setRectangle(bw, bh, {
      label: 'player',
      friction: 0.01, frictionAir: 0.02, density: 0.004,
    });
    this.sprite.setFixedRotation();
    this.sprite.setAlpha(0);
    this.sprite.setData('entity', this);
    this.sprite.setData('entityType', 'player');

    this.buildVisual();

    // Register gameplay callbacks with InputSystem.
    // InputSystem.init() is already called in GameScene.create() — listeners are attached.
    // We only set callbacks here (player owns jump/fire/melee/dash/weapon-switch).
    // pause/interact are no-ops here — GameScene polls pausePressed/interactPressed.
    InputSystem.setCallbacks({
      jump: () => this.tryJump(),
      fire: () => this.tryFire(),
      melee: () => this.tryMelee(),
      dash: (dir) => this.tryDash(dir),
      pause: () => {},
      interact: () => {},
      weaponNext: () => this.switchWeapon(1),
      weaponPrev: () => this.switchWeapon(-1),
    });
  }

  /**
   * Compute effective stats from base + unlocked skills.
   * This is the core of the data-driven skill system.
   */
  private computeStats(unlockedSkills: string[]): PlayerStats {
    const base: PlayerStats = {
      maxHealth: PLAYER.MAX_HEALTH,
      maxEnergy: PLAYER.MAX_ENERGY,
      energyRegen: PLAYER.ENERGY_REGEN,
      moveSpeed: PLAYER.MOVE_SPEED,
      jumpVelocity: PLAYER.JUMP_VELOCITY,
      dashSpeed: PLAYER.DASH_SPEED,
      dashDurationMs: PLAYER.DASH_DURATION_MS,
      dashCooldownMs: PLAYER.DASH_COOLDOWN_MS,
      meleeDamage: PLAYER.MELEE_DAMAGE,
      meleeRange: PLAYER.MELEE_RANGE,
      fireCooldownMs: PLAYER.FIRE_COOLDOWN_MS,
      invulnMs: PLAYER.INVULN_MS,
    };

    // Apply each unlocked skill's effect
    for (const skillId of unlockedSkills) {
      const skill = getSkill(skillId);
      if (!skill) continue;
      const eff = skill.effect;
      const statKey = eff.stat as keyof PlayerStats;
      if (eff.multiplier && typeof base[statKey] === 'number') {
        (base[statKey] as number) *= eff.multiplier;
      }
      if (eff.additive && typeof base[statKey] === 'number') {
        (base[statKey] as number) += eff.additive;
      }
    }

    return base;
  }

  /** Rebuild stats when a skill is unlocked. */
  public refreshStats(): void {
    const save = SaveSystem.getPlayer();
    const oldMaxHp = this.stats.maxHealth;
    const oldMaxEn = this.stats.maxEnergy;
    this.stats = this.computeStats(save.unlockedSkills);
    this.abilities = new Set(save.abilities);
    this.maxJumps = this.abilities.has('doubleJump') ? 2 : 1;
    // Adjust current health/energy to new max
    const hpDiff = this.stats.maxHealth - oldMaxHp;
    const enDiff = this.stats.maxEnergy - oldMaxEn;
    this.health.max = this.stats.maxHealth;
    this.energy.max = this.stats.maxEnergy;
    this.energy.regenPerSec = this.stats.energyRegen;
    if (hpDiff > 0) this.health.current += hpDiff;
    if (enDiff > 0) this.energy.current += enDiff;
    this.health.current = Math.min(this.health.current, this.health.max);
    this.energy.current = Math.min(this.energy.current, this.energy.max);
  }

  private buildVisual(): void {
    // Use the MechaSpriteFactory — multi-layered detailed mech (no more flat rectangles)
    this.visual = MechaSpriteFactory.buildPlayerAtlas(this.scene);
  }

  // ---- Public API ----
  get position(): Phaser.Math.Vector2 {
    if (!this.sprite || !this.sprite.active) return new Phaser.Math.Vector2(0, 0);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  get isInvulnerable(): boolean { return this.scene.time.now < this.invulnUntil; }

  get weapon(): WeaponId { return this.currentWeapon; }
  get weaponData(): WeaponData { return getWeapon(this.currentWeapon); }
  get hasAbility(): (ability: string) => boolean { return (a: string) => this.abilities.has(a); }

  takeDamage(amount: number): boolean {
    if (!this.alive || this.isInvulnerable || amount <= 0) return false;
    this.health.current = Math.max(0, this.health.current - amount);
    this.invulnUntil = this.scene.time.now + this.stats.invulnMs;
    this.flashTimer = this.stats.invulnMs;
    AudioSystem.play('hit');
    EventBus.emit('PLAYER_DAMAGED', { amount, x: this.sprite.x, y: this.sprite.y });
    if (this.health.current <= 0) {
      this.alive = false;
      AudioSystem.play('playerDeath');
      EventBus.emit('PLAYER_DEAD', { id: this.id });
    }
    return true;
  }

  heal(amount: number): void {
    this.health.current = Math.min(this.health.max, this.health.current + amount);
    EventBus.emit('PLAYER_DAMAGED', { amount: -amount, x: this.sprite.x, y: this.sprite.y, heal: true });
  }

  consumeEnergy(amount: number): boolean {
    if (this.energy.current < amount) return false;
    this.energy.current -= amount;
    return true;
  }

  unlockWeapon(id: WeaponId): void {
    this.unlockedWeapons.add(id);
    SaveSystem.unlockWeapon(id);
    EventBus.emit('WEAPON_UNLOCKED', { weaponId: id });
  }

  hasWeapon(id: WeaponId): boolean { return this.unlockedWeapons.has(id); }

  setWeapon(id: WeaponId): void {
    if (this.currentWeapon === id) return;
    if (!this.unlockedWeapons.has(id)) return;
    this.currentWeapon = id;
    SaveSystem.setWeapon(id);
    AudioSystem.play('weaponSwitch');
  }

  private switchWeapon(dir: 1 | -1): void {
    const list = Object.keys(getWeapon(this.currentWeapon) ? [this.currentWeapon] : []) as WeaponId[];
    const allWeapons = Array.from(this.unlockedWeapons);
    const idx = allWeapons.indexOf(this.currentWeapon);
    const next = allWeapons[(idx + dir + allWeapons.length) % allWeapons.length];
    this.setWeapon(next);
  }

  update(deltaMs: number): void {
    if (!this.alive) return;
    this.updateMovement();
    this.updateAnimation(deltaMs);
    const gain = this.energy.regenPerSec * (deltaMs / 1000);
    if (gain > 0 && this.energy.current < this.energy.max) {
      this.energy.current = Math.min(this.energy.max, this.energy.current + gain);
    }
  }

  private updateMovement(): void {
    const now = this.scene.time.now;
    const input = InputSystem.getState();

    // Ground check
    this.grounded = this.physics.isGrounded(this.sprite, PLAYER.BODY_RADIUS);
    if (this.grounded) {
      this.coyoteUntil = now + PLAYER.COYOTE_TIME_MS;
      this.jumpsRemaining = this.maxJumps;
      this.wallJumpUntil = 0;
      if (now < this.jumpBufferUntil) {
        this.sprite.setVelocityY(this.stats.jumpVelocity);
        this.jumpBufferUntil = 0;
        this.grounded = false;
        this.jumpsRemaining--;
        AudioSystem.play('jump');
      }
    }

    // Wall detection (for wall jump + wall slide) — Mag-Clamp Thrusters
    this.touchingWall = null;
    this.wallSlideActive = false;
    if (!this.grounded && this.abilities.has('wallJump')) {
      const r = PLAYER.BODY_RADIUS;
      const px = this.sprite.x;
      const py = this.sprite.y;
      // Check left wall
      const leftHits = this.physics.bodiesAtPoint(px - r - 4, py);
      if (leftHits.some(b => b.label.startsWith('solid'))) this.touchingWall = 'left';
      // Check right wall
      if (!this.touchingWall) {
        const rightHits = this.physics.bodiesAtPoint(px + r + 4, py);
        if (rightHits.some(b => b.label.startsWith('solid'))) this.touchingWall = 'right';
      }
      // Wall Slide — Mag-Clamp Thrusters: slow descent with sparks + metal sound
      if (this.touchingWall) {
        const pressingToward = (this.touchingWall === 'left' && input.heldLeft) || (this.touchingWall === 'right' && input.heldRight);
        if (pressingToward) {
          const body = this.sprite.body as MatterJS.BodyType;
          if (body && body.velocity.y > 1) {
            this.sprite.setVelocityY(body.velocity.y * 0.45);  // 55% reduction
            this.wallSlideActive = true;
            // Spark + sound effects every 80ms
            if (now - this.lastWallSlideFx >= 80) {
              this.lastWallSlideFx = now;
              const sparkX = px + (this.touchingWall === 'left' ? -r - 2 : r + 2);
              const sparkY = py + (Math.random() - 0.5) * 20;
              this.particles.sparks(sparkX, sparkY, 0xffaa30, 2);
              // Thruster glow
              const glow = this.scene.add.circle(sparkX, sparkY + 10, 4, 0xffc040, 0.4);
              glow.setBlendMode(Phaser.BlendModes.ADD).setDepth(13);
              this.scene.tweens.add({
                targets: glow, alpha: 0, scale: 0.3, duration: 200,
                onComplete: () => glow.destroy(),
              });
            }
          }
        }
      }
    }

    // Horizontal movement
    let moveX = 0;
    if (input.heldLeft) moveX -= 1;
    if (input.heldRight) moveX += 1;
    if (moveX === 0 && Math.abs(input.leftStickX) > 0.1) moveX = input.leftStickX;

    // Wall jump lockout — brief horizontal control lock after wall jump
    if (now < this.wallJumpUntil) {
      moveX = 0;
    }

    if (this.isDashing) {
      const dirSign = this.dashDir === 'right' ? 1 : -1;
      this.sprite.setVelocityX(dirSign * this.stats.dashSpeed);
      const body = this.sprite.body;
      if (body) this.sprite.setVelocityY(body.velocity.y * 0.4);
      if (now - this.lastAfterimageAt >= 35) {
        const pos = this.position;
        const facing = this.dashDir === 'right' ? 1 : -1;
        this.particles.afterimage(pos.x, pos.y - 6, 36, 30, COLORS.PLAYER_GLOW, facing);
        this.lastAfterimageAt = now;
      }
      if (now >= this.dashUntil) this.isDashing = false;
    } else {
      if (moveX !== 0) {
        const targetVx = moveX * this.stats.moveSpeed;
        const body = this.sprite.body;
        const currentVx = body ? body.velocity.x : 0;
        this.sprite.setVelocityX(Phaser.Math.Linear(currentVx, targetVx, 0.35));
        this.facing = moveX > 0 ? 'right' : 'left';
      } else {
        const body = this.sprite.body;
        this.sprite.setVelocityX((body ? body.velocity.x : 0) * 0.78);
      }
    }

    // Keyboard aim
    let aimY = 0;
    if (input.heldUp) aimY -= 1;
    if (input.heldDown) aimY += 1;
    this.keyAimY = Phaser.Math.Clamp(aimY, -1, 1);

    // Continuous fire
    if (input.heldFire) this.tryFire();
  }

  private tryJump(): void {
    if (!this.alive || !this.sprite || !this.sprite.active) return;
    this.jumpBufferUntil = this.scene.time.now + PLAYER.JUMP_BUFFER_MS;
    const now = this.scene.time.now;
    // Jump anticipation — squash for 80ms before launch
    this.jumpAnticipationUntil = now + 80;
    this.squashY = 0.85; this.squashX = 1.15;

    // Wall Jump — Mag-Clamp Thruster burst: powerful push from wall
    if (!this.grounded && this.touchingWall && this.abilities.has('wallJump')) {
      const jumpDir = this.touchingWall === 'left' ? 1 : -1;
      // Thruster burst — powerful launch
      this.sprite.setVelocityY(this.stats.jumpVelocity * 0.95);
      this.sprite.setVelocityX(jumpDir * this.stats.moveSpeed * 1.8);
      this.wallJumpUntil = now + 200;
      this.facing = jumpDir > 0 ? 'right' : 'left';
      this.jumpBufferUntil = 0;
      this.jumpsRemaining = this.maxJumps - 1;
      AudioSystem.play('dash');  // thruster sound
      // Thruster explosion VFX — burst at wall contact point
      const pos = this.position;
      const burstX = pos.x + (this.touchingWall === 'left' ? -PLAYER.BODY_RADIUS : PLAYER.BODY_RADIUS);
      const burstY = pos.y;
      // Ring explosion
      const ring = this.scene.add.circle(burstX, burstY, 6, 0xffc040, 0.8);
      ring.setBlendMode(Phaser.BlendModes.ADD).setDepth(14);
      this.scene.tweens.add({
        targets: ring, scale: { from: 1, to: 3 }, alpha: 0,
        duration: 250, ease: 'Cubic.out', onComplete: () => ring.destroy(),
      });
      // Directional sparks
      this.particles.sparks(burstX, burstY, 0xffaa30, 6);
      // Afterimage for momentum feel
      this.particles.afterimage(pos.x, pos.y - 6, 36, 30, 0x39d0d8, jumpDir);
      return;
    }

    // Normal jump / double jump
    if (this.jumpsRemaining > 0 && (this.grounded || now < this.coyoteUntil || this.jumpsRemaining > 1)) {
      const isDouble = !this.grounded && this.jumpsRemaining === 1;
      this.sprite.setVelocityY(this.stats.jumpVelocity);
      this.jumpBufferUntil = 0;
      this.grounded = false;
      this.coyoteUntil = 0;
      this.jumpsRemaining--;
      AudioSystem.play(isDouble ? 'doubleJump' : 'jump');
    }
  }

  private tryDash(dir: Direction): void {
    if (!this.alive || !this.sprite || !this.sprite.active) return;
    const now = this.scene.time.now;
    if (this.isDashing || now < this.dashAvailableAt) return;
    if (!this.consumeEnergy(PLAYER.DASH_COST)) return;
    this.isDashing = true;
    this.dashDir = dir;
    this.dashUntil = now + this.stats.dashDurationMs;
    this.dashAvailableAt = now + this.stats.dashDurationMs + this.stats.dashCooldownMs;
    this.invulnUntil = Math.max(this.invulnUntil, this.dashUntil);
    this.lastAfterimageAt = 0;
    AudioSystem.play('dash');
  }

  private getAimDirection(): Phaser.Math.Vector2 {
    const input = InputSystem.getState();
    if (Math.abs(input.rightStickX) > 0.15 || Math.abs(input.rightStickY) > 0.15) {
      const len = Math.sqrt(input.rightStickX ** 2 + input.rightStickY ** 2);
      return new Phaser.Math.Vector2(input.rightStickX / len, input.rightStickY / len);
    }
    const dirX = this.facing === 'right' ? 1 : -1;
    const dirY = this.keyAimY;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    return new Phaser.Math.Vector2(dirX / len, dirY / len);
  }

  private tryFire(): void {
    if (!this.alive || !this.sprite || !this.sprite.active) return;
    const now = this.scene.time.now;
    const weapon = getWeapon(this.currentWeapon);
    const cooldown = this.currentWeapon === 'assault_rifle' ? this.stats.fireCooldownMs : weapon.fireRateMs;
    if (now - this.lastFireAt < cooldown) return;
    const energyCost = this.currentWeapon === 'assault_rifle' ? PLAYER.FIRE_COST : weapon.energyCost;
    if (!this.consumeEnergy(energyCost)) return;
    this.lastFireAt = now;
    const from = this.position;
    const aimDir = this.getAimDirection();
    const muzzle = new Phaser.Math.Vector2(from.x + aimDir.x * 30, from.y - 6 + aimDir.y * 30);
    AudioSystem.play('fire');

    // Hitscan weapons (railgun, laser)
    if (weapon.tier === 'hitscan') {
      this.fireHitscan(weapon, muzzle, aimDir);
      return;
    }

    // Projectile weapons
    const bulletCount = weapon.bulletsPerShot ?? 1;
    for (let i = 0; i < bulletCount; i++) {
      let angleOffset = 0;
      if (bulletCount > 1 && weapon.spread) {
        const t = i / (bulletCount - 1) - 0.5;
        angleOffset = t * weapon.spread;
      }
      const angle = Math.atan2(aimDir.y, aimDir.x) + angleOffset;
      const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
      const proj = new Projectile(this.scene, this.physics, this.particles, muzzle, dir, {
        speed: weapon.bulletSpeed ?? PLAYER.BULLET_SPEED,
        damage: this.currentWeapon === 'assault_rifle' ? PLAYER.BULLET_DAMAGE : weapon.damage,
        ttl: 1500, owner: 'player', color: weapon.color, size: weapon.size,
        weapon, explosive: weapon.tier === 'explosive', explosionRadius: weapon.explosionRadius,
      });
      this.projectiles.push(proj);
    }
    this.particles.sparks(muzzle.x, muzzle.y, weapon.color, (weapon.bulletsPerShot ?? 1) + 2);
  }

  private fireHitscan(weapon: WeaponData, muzzle: Phaser.Math.Vector2, aimDir: Phaser.Math.Vector2): void {
    const angle = Math.atan2(aimDir.y, aimDir.x);
    const endX = muzzle.x + Math.cos(angle) * weapon.range;
    const endY = muzzle.y + Math.sin(angle) * weapon.range;
    const hit = this.physics.raycastClosest(muzzle.x, muzzle.y, endX, endY, true);
    const endPoint = hit ? new Phaser.Math.Vector2(hit.position.x, hit.position.y) : new Phaser.Math.Vector2(endX, endY);
    // Draw tracer
    const line = this.scene.add.line(0, 0, muzzle.x, muzzle.y, endPoint.x, endPoint.y, weapon.color, 0.9);
    line.setOrigin(0, 0); line.setLineWidth(3); line.setDepth(30);
    this.scene.tweens.add({ targets: line, alpha: 0, lineWidth: 0.5, duration: 120, onComplete: () => line.destroy() });
    // Damage first hit
    if (hit) {
      const go = (hit as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      const entity = go?.getData('entity') as { takeDamage?: (n: number) => void } | undefined;
      if (entity?.takeDamage) {
        entity.takeDamage(weapon.damage);
        this.particles.sparks(endPoint.x, endPoint.y, weapon.color, 4);
      }
    }
  }

  private tryMelee(): void {
    if (!this.alive || !this.sprite || !this.sprite.active) return;
    const now = this.scene.time.now;
    if (now - this.lastMeleeAt < PLAYER.MELEE_COOLDOWN_MS) return;
    if (!this.consumeEnergy(PLAYER.MELEE_COST)) return;
    this.lastMeleeAt = now;
    const aimDir = this.getAimDirection();
    const origin = this.position;
    const range = this.stats.meleeRange;
    AudioSystem.play('melee');
    this.combat.spawnSlash(origin.x + aimDir.x * 24, origin.y - 6 + aimDir.y * 24, aimDir.x > 0 ? 1 : -1);
    const cx = origin.x + aimDir.x * (range / 2);
    const cy = origin.y - 6 + aimDir.y * (range / 2);
    const bodies = this.physics.bodiesInCircle(cx, cy, range / 2);
    for (const body of bodies) {
      const go = (body as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      if (!go) continue;
      const entityType = go.getData('entityType') as string | undefined;
      const entity = go.getData('entity') as { id?: string; takeDamage?: (n: number) => void } | undefined;
      if (!entity || !entityType) continue;
      if (entityType === 'enemy' || entityType === 'boss') {
        this.combat.dealDamage({
          amount: this.stats.meleeDamage, type: 'melee', source: this.id,
          target: entity.id ?? 'unknown',
          knockback: { x: aimDir.x * 0.18, y: aimDir.y * 0.05 },
          point: { x: (go as unknown as Phaser.GameObjects.Components.Transform).x, y: (go as unknown as Phaser.GameObjects.Components.Transform).y },
        });
      }
    }
  }

  private updateAnimation(deltaMs: number): void {
    if (!this.visual) return;
    this.animTime += deltaMs;
    const pos = this.position;
    const facing = this.facing === 'right' ? 1 : -1;
    const body = this.sprite.body;
    const vx = body?.velocity.x ?? 0;
    const vy = body?.velocity.y ?? 0;
    const isMoving = Math.abs(vx) > 0.5 && this.grounded;
    const isJumping = !this.grounded;
    const isDashing = this.isDashing;

    // ── Physics polish: squash & stretch ──
    // Recover from anticipation
    if (this.scene.time.now > this.jumpAnticipationUntil) {
      // Landing squash — if we just landed with downward velocity
      if (this.grounded && !this.groundedLastFrame && this.lastVy > 4) {
        this.squashY = 0.7; this.squashX = 1.25;
      }
      // Stretch on fast upward movement (jump apex)
      if (isJumping && vy < -6) {
        this.squashY = Phaser.Math.Linear(this.squashY, 1.2, 0.15);
        this.squashX = Phaser.Math.Linear(this.squashX, 0.88, 0.15);
      } else {
        // Ease back to neutral
        this.squashY = Phaser.Math.Linear(this.squashY, 1, 0.18);
        this.squashX = Phaser.Math.Linear(this.squashX, 1, 0.18);
      }
    }

    // ── Momentum tilt — lean into the direction of motion ──
    const targetTilt = isDashing
      ? facing * 0.25
      : isMoving
        ? facing * (vx / 30)  // subtle lean
        : isJumping
          ? (vy < 0 ? facing * 0.08 : facing * 0.04)  // tilt up when rising, less when falling
          : 0;
    this.tilt = Phaser.Math.Linear(this.tilt, targetTilt, 0.12);

    // ── Apply transform to visual container ──
    // Restore old body bob: subtle vertical sine when moving (old "mazze" feel)
    const bob = isMoving ? Math.sin(this.animTime / 80) * 2 : 0;
    this.visual.container.setPosition(pos.x, pos.y - 4 + bob);
    this.visual.container.setRotation(this.tilt);
    this.visual.container.setScale(facing * this.squashX, this.squashY);
    this.visual.setFacing(facing as 1 | -1);

    // ── Restore old leg swing animation (combined with new factory visual) ──
    if (this.visual.setWalkPhase) {
      this.visual.setWalkPhase(this.animTime / 100, isMoving, isJumping);
    }

    // ── Restore old gun barrel rotation toward aim direction (all-direction aim) ──
    if (this.visual.setGunAngle) {
      const aimDir = this.getAimDirection();
      const targetAngle = Math.atan2(aimDir.y, aimDir.x);
      // Smoothly rotate toward target (old interpolation)
      this.aimAngle = Phaser.Math.Angle.RotateTo(this.aimAngle, targetAngle, 0.3);
      this.visual.setGunAngle(this.aimAngle);
    }

    // ── Core pulse — brighten on dash, dim on low energy ──
    const energyPct = this.energy.current / this.energy.max;
    const dashBoost = isDashing ? 0.4 : 0;
    const pulseBrightness = 0.4 + Math.sin(this.animTime / 200) * 0.15 + dashBoost;
    this.visual.setCorePulse(Math.min(1, pulseBrightness * (0.5 + energyPct * 0.5)));

    // ── Thruster VFX ──
    // Intensity 0..1 based on: jumping (full), dashing (full), falling fast (medium), grounded (0)
    let thrusterIntensity = 0;
    if (isDashing) thrusterIntensity = 0.9;
    else if (isJumping && vy < 0) thrusterIntensity = 0.7;  // rising
    else if (isJumping && vy > 2) thrusterIntensity = 0.3;  // falling gently
    else if (this.wallSlideActive) thrusterIntensity = 0.5;
    this.visual.setThrusterIntensity(thrusterIntensity);

    // Emit thruster particles when intensity is high
    const now = this.scene.time.now;
    if (thrusterIntensity > 0.4 && now - this.lastThrusterEmit > 30) {
      this.lastThrusterEmit = now;
      // Emit downward thruster flame particles
      for (const dx of [-9, 9]) {
        const flame = this.scene.add.circle(pos.x + dx * facing, pos.y + 12, 2 + Math.random() * 2, 0xffc040, 0.8);
        flame.setBlendMode(Phaser.BlendModes.ADD).setDepth(13);
        this.scene.tweens.add({
          targets: flame,
          y: pos.y + 24, alpha: 0, scale: 0.4,
          duration: 150, onComplete: () => flame.destroy(),
        });
      }
    }

    // ── Landing impact — dust + camera shake ──
    if (this.grounded && !this.wasGrounded && this.lastVy > 3) {
      this.particles.dust(pos.x, pos.y + 20);
      this.scene.cameras.main.shake(60, 0.003 * Math.min(this.lastVy / 5, 1));
      // Extra dust puff for hard landings
      if (this.lastVy > 7) {
        for (let i = 0; i < 6; i++) {
          const dustX = pos.x + (Math.random() - 0.5) * 30;
          const dust = this.scene.add.circle(dustX, pos.y + 20, 3, 0x6a5a4a, 0.5);
          dust.setDepth(12);
          this.scene.tweens.add({
            targets: dust,
            y: pos.y + 28, x: dustX + (Math.random() - 0.5) * 30,
            alpha: 0, scale: 2, duration: 400, ease: 'Sine.out',
            onComplete: () => dust.destroy(),
          });
        }
      }
    }

    // ── Per-step dust when running ──
    if (isMoving && now - this.lastThrusterEmit > 100) {
      const stepDust = this.scene.add.circle(pos.x + (Math.random() - 0.5) * 8, pos.y + 18, 1.5, 0x4a3a2a, 0.4);
      stepDust.setDepth(11);
      this.scene.tweens.add({
        targets: stepDust, y: pos.y + 22, alpha: 0, duration: 250,
        onComplete: () => stepDust.destroy(),
      });
    }

    this.wasGrounded = this.grounded;
    this.groundedLastFrame = this.grounded;
    this.lastVy = vy;
    this.lastVx = vx;

    // ── Flash while invulnerable ──
    if (this.flashTimer > 0) {
      this.flashTimer -= deltaMs;
      const on = Math.floor(this.flashTimer / 80) % 2 === 0;
      this.visual.container.setAlpha(on ? 0.4 : 1);
    } else {
      this.visual.container.setAlpha(1);
    }
  }

  destroy(): void {
    // Clear input callbacks so destroyed player doesn't receive input
    InputSystem.clearCallbacks();
    this.visual?.destroy();
    this.visual = null;
    if (this.sprite && this.sprite.active) this.sprite.destroy();
  }
}

export default PlayerEntity;
