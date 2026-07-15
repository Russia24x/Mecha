/**
 * MECHA: LAST PROTOCOL - Player (Mecha)
 * Single class combining entity + controller + combat + visual.
 *
 * update(deltaMs) calls:
 *   updateMovement()  — keyboard/gamepad input, move/jump/dash
 *   updateCombat()    — aim, fire, melee, weapon switch
 *   updateAnimation() — mecha visual parts, thruster particles
 */
import Phaser from 'phaser';
import { COLORS, PLAYER } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';
import { SkillTree } from '../../shared/SkillTree';
import { Effects } from '../../shared/Effects';
import { GamepadManager } from '../../shared/GamepadManager';
import type { Direction } from '../../shared/Types';
import { bodyConfig } from '../physics/CollisionLayers';
import { Projectile } from '../combat/Projectile';
import { DamageSystem } from '../combat/DamageSystem';
import { Hitscan } from '../combat/Hitscan';
import { getWeapon, cycleWeapon, type WeaponId } from '../combat/Weapons';

export class Player {
  public sprite: Phaser.Physics.Matter.Image;
  public health: { current: number; max: number };
  public energy: { current: number; max: number; regenPerSec: number };
  public facing: Direction = 'right';
  public id = 'player';
  public alive = true;

  // Combat state
  private lastFireAt = 0;
  private lastMeleeAt = 0;
  private currentWeapon: WeaponId = 'plasma';
  private unlockedWeapons: Set<WeaponId> = new Set(['plasma']);
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
  // Dash afterimage — spawn a fading silhouette every N ms during dash
  private lastAfterimageAt = 0;
  private static readonly AFTERIMAGE_INTERVAL_MS = 35;

  // Input state
  private heldLeft = false;
  private heldRight = false;
  private heldUp = false;
  private heldDown = false;
  private heldFire = false;

  // Visual parts
  private gunArm: Phaser.GameObjects.Rectangle | null = null;
  private mechaTorso: Phaser.GameObjects.Rectangle | null = null;
  private mechaHead: Phaser.GameObjects.Rectangle | null = null;
  private mechaLegL: Phaser.GameObjects.Rectangle | null = null;
  private mechaLegR: Phaser.GameObjects.Rectangle | null = null;
  private core: Phaser.GameObjects.Arc | null = null;
  private visor: Phaser.GameObjects.Rectangle | null = null;
  private shoulderL: Phaser.GameObjects.Rectangle | null = null;
  private shoulderR: Phaser.GameObjects.Rectangle | null = null;

  // Cached skill modifiers
  private mods = SkillTree.getPlayerModifiers();
  private invulnUntil = 0;
  private flashTimer = 0;

  constructor(
    private scene: Phaser.Scene,
    x: number, y: number,
    private projectiles: Projectile[],
    private damageSystem: DamageSystem
  ) {
    this.health = { current: this.mods.maxHealth, max: this.mods.maxHealth };
    this.energy = { current: this.mods.maxEnergy, max: this.mods.maxEnergy, regenPerSec: this.mods.energyRegen };

    this.sprite = scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig('player', { label: 'player', friction: 0.01, frictionAir: 0.02, density: 0.004 }),
    });
    this.sprite.setDisplaySize(PLAYER.BODY_RADIUS * 2.2, PLAYER.BODY_RADIUS * 2.6);
    this.sprite.setFixedRotation();
    this.sprite.setAlpha(0); // physics only — visual is separate
    this.sprite.setData('entity', this);
    this.sprite.setData('entityType', 'player');

    this.buildMechaVisual();
    this.setupInput();
    GamepadManager.init();

  }

  private buildMechaVisual(): void {
    const scene = this.scene;
    // Torso — detailed Mecha chest with armor plates + core
    this.mechaTorso = scene.add.rectangle(0, 0, 36, 30, 0x1a2840, 1);
    this.mechaTorso.setStrokeStyle(2, 0x39d0d8, 0.8);
    this.mechaTorso.setDepth(14);
    // Chest core (glowing)
    const core = scene.add.circle(0, 0, 4, 0x66f0ff, 0.9);
    core.setDepth(15);
    this.core = core;
    // Shoulder pads
    const shoulderL = scene.add.rectangle(-16, -8, 10, 12, 0x2a3850, 1);
    shoulderL.setStrokeStyle(1, 0x39d0d8, 0.5); shoulderL.setDepth(14);
    const shoulderR = scene.add.rectangle(16, -8, 10, 12, 0x2a3850, 1);
    shoulderR.setStrokeStyle(1, 0x39d0d8, 0.5); shoulderR.setDepth(14);
    this.shoulderL = shoulderL; this.shoulderR = shoulderR;
    // Head/Cockpit — angular with visor
    this.mechaHead = scene.add.rectangle(0, 0, 16, 14, 0x2a3850, 1);
    this.mechaHead.setStrokeStyle(1, 0x66f0ff, 0.9);
    this.mechaHead.setDepth(15);
    // Visor (glowing strip)
    const visor = scene.add.rectangle(0, 0, 10, 3, 0x66f0ff, 0.8);
    visor.setDepth(16);
    this.visor = visor;
    // Legs — with knee joints
    this.mechaLegL = scene.add.rectangle(0, 0, 9, 18, 0x2a3850, 1);
    this.mechaLegL.setStrokeStyle(1, 0x39d0d8, 0.6);
    this.mechaLegL.setDepth(13);
    this.mechaLegR = scene.add.rectangle(0, 0, 9, 18, 0x2a3850, 1);
    this.mechaLegR.setStrokeStyle(1, 0x39d0d8, 0.6);
    this.mechaLegR.setDepth(13);
    this.gunArm = scene.add.rectangle(0, 0, 28, 6, 0x1a2030, 1);
    this.gunArm.setOrigin(0, 0.5);
    this.gunArm.setDepth(15);
  }

  // H2 fix: store bound handlers so we can remove them in destroy().
  private onKeyDown!: (e: KeyboardEvent) => void;
  private onKeyUp!: (e: KeyboardEvent) => void;

  private setupInput(): void {
    const scene = this.scene;
    const kb = scene.input.keyboard;
    // H1 fix: use window listeners as the single source of truth for input.
    // (Previously both Phaser keyboard + window fired on each key → double input.)
    // Phaser keyboard plugin is only used for held-state edge detection via Key objects if needed.
    if (kb) {
      // No Phaser keyboard handlers — all input goes through window listeners below.
    }

    // Window listeners — handle ALL input (held state + edge-triggered actions).
    if (typeof window !== 'undefined') {
      this.onKeyDown = (e: KeyboardEvent) => {
        switch (e.code) {
          case 'Space': this.tryJump(); break;
          case 'KeyJ': this.tryFire(); this.heldFire = true; break;
          case 'KeyK': this.tryMelee(); break;
          case 'Escape':
            // Only pause if scene is actually running (not already paused or transitioning)
            if (scene.scene.isActive() && !scene.scene.isPaused()) {
              Effects.play('uiClick');
              scene.scene.pause();
              scene.scene.launch('UIScene');
            }
            break;
          case 'Digit1': this.setWeapon('plasma'); break;
          case 'Digit2': this.setWeapon('shotgun'); break;
          case 'Digit3': this.setWeapon('laser'); break;
          case 'Digit4': this.setWeapon('rocket'); break;
          case 'KeyE': this.switchWeapon(1); break;
          case 'KeyQ': this.switchWeapon(-1); break;
          case 'ShiftLeft': case 'ShiftRight':
            // Dash in the direction the player is currently holding (or facing)
            this.tryDash(this.heldLeft ? 'left' : this.heldRight ? 'right' : this.facing);
            break;
          case 'KeyA': case 'ArrowLeft': this.heldLeft = true; break;
          case 'KeyD': case 'ArrowRight': this.heldRight = true; break;
          case 'KeyW': case 'ArrowUp': this.heldUp = true; break;
          case 'KeyS': case 'ArrowDown': this.heldDown = true; break;
        }
      };
      this.onKeyUp = (e: KeyboardEvent) => {
        switch (e.code) {
          case 'Space': this.cutJump(); break;
          case 'KeyA': case 'ArrowLeft': this.heldLeft = false; break;
          case 'KeyD': case 'ArrowRight': this.heldRight = false; break;
          case 'KeyW': case 'ArrowUp': this.heldUp = false; break;
          case 'KeyS': case 'ArrowDown': this.heldDown = false; break;
          case 'KeyJ': this.heldFire = false; break;
        }
      };
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
    }
  }

  // ---- Public API ----
  get position(): Phaser.Math.Vector2 {
    if (!this.sprite || !this.sprite.active) return new Phaser.Math.Vector2(0, 0);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }
  get weapon(): WeaponId { return this.currentWeapon; }
  get isInvulnerable(): boolean { return this.scene.time.now < this.invulnUntil; }

  unlockWeapon(id: WeaponId): void { this.unlockedWeapons.add(id); }
  hasWeapon(id: WeaponId): boolean { return this.unlockedWeapons.has(id); }

  takeDamage(amount: number): boolean {
    if (!this.alive || this.isInvulnerable || amount <= 0) return false;
    this.health.current = Math.max(0, this.health.current - amount);
    this.invulnUntil = this.scene.time.now + PLAYER.INVULN_MS;
    this.flashTimer = PLAYER.INVULN_MS;
    Effects.play('hit');
    EventBus.emit('PLAYER_DAMAGED', { amount, x: this.sprite.x, y: this.sprite.y });
    if (this.health.current <= 0) {
      this.alive = false;
      Effects.play('playerDeath');
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

  // ---- Main update ----
  update(deltaMs: number): void {
    if (!this.alive) return;
    this.mods = SkillTree.getPlayerModifiers();
    this.updateMovement(deltaMs);
    this.updateCombat();
    this.updateAnimation(deltaMs);
    // Energy regen
    const gain = this.energy.regenPerSec * (deltaMs / 1000);
    if (gain > 0 && this.energy.current < this.energy.max) {
      this.energy.current = Math.min(this.energy.max, this.energy.current + gain);
    }
  }

  // ---- Movement ----
  private updateMovement(deltaMs: number): void {
    const now = this.scene.time.now;
    const maxJumps = this.mods.canDoubleJump ? 2 : 1;

    // Gamepad
    GamepadManager.update();
    const gp = GamepadManager.getState();
    if (gp.firePressed) this.tryFire();
    if (gp.meleePressed) this.tryMelee();
    if (gp.jumpPressed) this.tryJump();
    if (gp.dashPressed) {
      // Dash in held-stick direction, or facing if stick centered
      const dir: Direction = gp.leftStickX < -0.2 ? 'left' : gp.leftStickX > 0.2 ? 'right' : this.facing;
      this.tryDash(dir);
    }
    if (gp.fireHeld) this.tryFire();
    if (gp.weaponNextPressed) this.switchWeapon(1);
    if (gp.weaponPrevPressed) this.switchWeapon(-1);
    if (gp.pausePressed && this.scene.scene.isActive() && !this.scene.scene.isPaused()) {
      Effects.play('uiClick');
      this.scene.scene.pause();
      this.scene.scene.launch('UIScene');
    }

    // Ground check
    const feetX = this.sprite.x;
    const feetY = this.sprite.y + (PLAYER.BODY_RADIUS * 1.3);
    const hits = this.scene.matter.intersectPoint(feetX, feetY + 4) as MatterJS.BodyType[];
    this.grounded = hits.some(b => !b.isSensor && b.label.startsWith('solid'));
    if (this.grounded) {
      // Coyote time: 120 ms grace period after walking off a ledge.
      this.coyoteUntil = now + 120;
      this.jumpsRemaining = maxJumps;
      if (now < this.jumpBufferUntil) {
        this.sprite.setVelocityY(PLAYER.JUMP_VELOCITY);
        this.jumpBufferUntil = 0;
        this.grounded = false;
        this.jumpsRemaining--;
        Effects.play('jump');
      }
    }

    // Horizontal movement
    let moveX = 0;
    if (this.heldLeft) moveX -= 1;
    if (this.heldRight) moveX += 1;
    if (moveX === 0 && Math.abs(gp.leftStickX) > 0.1) moveX = gp.leftStickX;

    if (this.isDashing) {
      const dirSign = this.dashDir === 'right' ? 1 : -1;
      this.sprite.setVelocityX(dirSign * PLAYER.DASH_SPEED);
      this.sprite.setVelocityY(this.sprite.body!.velocity.y * 0.4);
      // Spawn afterimage trail every ~35 ms for a motion-blur silhouette.
      if (now - this.lastAfterimageAt >= Player.AFTERIMAGE_INTERVAL_MS) {
        this.spawnDashAfterimage();
        this.lastAfterimageAt = now;
      }
      if (now >= this.dashUntil) this.isDashing = false;
    } else {
      if (moveX !== 0) {
        const targetVx = moveX * this.mods.moveSpeed;
        const currentVx = this.sprite.body!.velocity.x;
        this.sprite.setVelocityX(Phaser.Math.Linear(currentVx, targetVx, 0.35));
        this.facing = moveX > 0 ? 'right' : 'left';
      } else {
        this.sprite.setVelocityX(this.sprite.body!.velocity.x * 0.78);
      }
    }

    // Keyboard aim
    let aimY = 0;
    if (this.heldUp) aimY -= 1;
    if (this.heldDown) aimY += 1;
    this.keyAimY = Phaser.Math.Clamp(aimY, -1, 1);

    // Continuous fire
    if (this.heldFire) this.tryFire();
  }

  private tryJump(): void {
    this.jumpBufferUntil = this.scene.time.now + 120;
    if (this.jumpsRemaining > 0 && (this.grounded || this.scene.time.now < this.coyoteUntil || this.jumpsRemaining > 1)) {
      const isDouble = !this.grounded && this.jumpsRemaining === 1;
      this.sprite.setVelocityY(PLAYER.JUMP_VELOCITY);
      this.jumpBufferUntil = 0;
      this.grounded = false;
      this.coyoteUntil = 0;
      this.jumpsRemaining--;
      Effects.play(isDouble ? 'doubleJump' : 'jump');
    }
  }

  /** Variable jump height — releasing Space cuts the jump short. */
  private cutJump(): void {
    const vy = this.sprite.body?.velocity.y ?? 0;
    if (vy < 0) {
      this.sprite.setVelocityY(vy * 0.45);
    }
  }

  private tryDash(dir: Direction): void {
    const now = this.scene.time.now;
    if (this.isDashing || now < this.dashAvailableAt) return;
    if (!this.consumeEnergy(PLAYER.DASH_COST)) return;
    this.isDashing = true;
    this.dashDir = dir;
    this.dashUntil = now + PLAYER.DASH_DURATION_MS;
    this.dashAvailableAt = now + PLAYER.DASH_DURATION_MS + this.mods.dashCd;
    // i-frames during dash — dodge through enemies / projectiles.
    this.invulnUntil = Math.max(this.invulnUntil, this.dashUntil);
    this.lastAfterimageAt = 0; // reset so first afterimage spawns immediately
    Effects.play('dash');
  }

  /** Spawn a fading cyan silhouette behind the player during dash. */
  private spawnDashAfterimage(): void {
    const pos = this.position;
    const facing = this.dashDir === 'right' ? 1 : -1;
    // Torso ghost
    const ghost = this.scene.add.rectangle(pos.x, pos.y - 6, 36, 30, COLORS.PLAYER_GLOW, 0.5);
    ghost.setDepth(13);
    ghost.setScale(facing, 1);
    ghost.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0, scale: 0.6,
      duration: 260, ease: 'Quad.easeOut',
      onComplete: () => ghost.destroy(),
    });
    // Core dot ghost
    const coreGhost = this.scene.add.circle(pos.x, pos.y - 6, 4, COLORS.PLAYER_GLOW, 0.7);
    coreGhost.setDepth(13);
    coreGhost.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: coreGhost,
      alpha: 0, scale: 0.2,
      duration: 300, ease: 'Quad.easeOut',
      onComplete: () => coreGhost.destroy(),
    });
  }

  // ---- Combat ----
  private updateCombat(): void {
    // (input handled in tryFire/tryMelee via events)
  }

  private getAimDirection(): Phaser.Math.Vector2 {
    const gp = GamepadManager.getState();
    if (Math.abs(gp.rightStickX) > 0.15 || Math.abs(gp.rightStickY) > 0.15) {
      const len = Math.sqrt(gp.rightStickX ** 2 + gp.rightStickY ** 2);
      return new Phaser.Math.Vector2(gp.rightStickX / len, gp.rightStickY / len);
    }
    const dirX = this.facing === 'right' ? 1 : -1;
    const dirY = this.keyAimY;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    return new Phaser.Math.Vector2(dirX / len, dirY / len);
  }

  private tryFire(): void {
    const now = this.scene.time.now;
    const weapon = getWeapon(this.currentWeapon);
    const cooldown = this.currentWeapon === 'plasma' ? this.mods.fireCooldown : weapon.cooldownMs;
    if (now - this.lastFireAt < cooldown) return;
    const energyCost = this.currentWeapon === 'plasma' ? PLAYER.FIRE_COST : weapon.energyCost;
    if (!this.consumeEnergy(energyCost)) return;
    this.lastFireAt = now;

    const from = this.position;
    const aimDir = this.getAimDirection();
    const muzzle = new Phaser.Math.Vector2(from.x + aimDir.x * 30, from.y - 6 + aimDir.y * 30);
    const damage = this.currentWeapon === 'plasma' ? this.mods.bulletDamage : weapon.damage;

    // Tier 1 — Hitscan (Laser)
    if (weapon.tier === 'hitscan') {
      const baseAngle = Math.atan2(aimDir.y, aimDir.x);
      Hitscan.fire(this.scene, muzzle, baseAngle, 800, damage);
      return;
    }

    // Tier 2/3 — Traveling projectiles
    Effects.play('fire');
    const baseAngle = Math.atan2(aimDir.y, aimDir.x);
    for (let i = 0; i < weapon.bulletsPerShot; i++) {
      let angleOffset = 0;
      if (weapon.bulletsPerShot > 1) {
        const t = i / (weapon.bulletsPerShot - 1) - 0.5;
        angleOffset = t * weapon.spread;
      }
      const angle = baseAngle + angleOffset;
      const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
      const proj = new Projectile(this.scene, muzzle, dir, {
        speed: weapon.speed, damage, ttl: weapon.ttl, owner: 'player',
        color: weapon.color, size: weapon.size,
        explosive: weapon.explosive, explosionRadius: weapon.explosionRadius,
        isLaser: weapon.isLaser,
      });
      this.projectiles.push(proj);
    }
    Effects.sparks(this.scene, muzzle.x, muzzle.y, weapon.color, weapon.bulletsPerShot + 2);
    // Recoil
    if (this.gunArm) {
      const kick = weapon.isLaser ? 2 : 5;
      this.scene.tweens.add({
        targets: this.gunArm,
        x: this.gunArm.x - aimDir.x * kick, y: this.gunArm.y - aimDir.y * kick,
        duration: 60, yoyo: true, ease: 'Quad.easeOut',
      });
    }
  }

  private tryMelee(): void {
    const now = this.scene.time.now;
    if (now - this.lastMeleeAt < PLAYER.MELEE_COOLDOWN_MS) return;
    if (!this.consumeEnergy(PLAYER.MELEE_COST)) return;
    this.lastMeleeAt = now;
    const aimDir = this.getAimDirection();
    const origin = this.position;
    const damage = this.mods.meleeDamage;
    const range = this.mods.meleeRange;
    Effects.play('melee');
    this.damageSystem.spawnSlash(origin.x + aimDir.x * 24, origin.y - 6 + aimDir.y * 24, aimDir.x > 0 ? 1 : -1);
    const cx = origin.x + aimDir.x * (range / 2);
    const cy = origin.y - 6 + aimDir.y * (range / 2);
    const bodies = this.scene.matter.query.region(new Phaser.Geom.Circle(cx, cy, range / 2)) as MatterJS.BodyType[];
    for (const body of bodies) {
      const sprite = (body as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      if (!sprite) continue;
      const entityType = sprite.getData('entityType') as string | undefined;
      const entity = sprite.getData('entity') as { id?: string; takeDamage?: (n: number) => void } | undefined;
      if (!entity || !entityType) continue;
      if (entityType === 'enemy' || entityType === 'boss') {
        this.damageSystem.dealDamage({
          amount: damage, type: 'melee', source: this.id,
          target: entity.id ?? 'unknown',
          knockback: { x: aimDir.x * 0.18, y: aimDir.y * 0.05 },
          point: { x: sprite.x, y: sprite.y },
        });
      }
    }
  }

  private switchWeapon(dir: 1 | -1): void {
    let next = this.currentWeapon;
    for (let i = 0; i < 4; i++) {
      next = cycleWeapon(next, dir);
      if (this.unlockedWeapons.has(next)) {
        this.currentWeapon = next;
        Effects.play('weaponSwitch');
        return;
      }
    }
  }

  private setWeapon(id: WeaponId): void {
    // L5 fix: skip if already equipped (prevents double sound on duplicate key fire).
    if (this.currentWeapon === id) return;
    if (this.unlockedWeapons.has(id)) {
      this.currentWeapon = id;
      Effects.play('weaponSwitch');
    }
  }

  // ---- Animation ----
  private animTime = 0;
  private wasGrounded = true;

  private updateAnimation(deltaMs: number): void {
    this.animTime += deltaMs;
    const pos = this.position;
    const facing = this.facing === 'right' ? 1 : -1;
    const vx = this.sprite.body?.velocity.x ?? 0;
    const vy = this.sprite.body?.velocity.y ?? 0;
    const isMoving = Math.abs(vx) > 0.5 && this.grounded;
    const isJumping = !this.grounded;

    // Torso — slight bob when walking
    const bob = isMoving ? Math.sin(this.animTime / 80) * 2 : 0;
    if (this.mechaTorso) { this.mechaTorso.setPosition(pos.x, pos.y - 6 + bob); this.mechaTorso.setScale(facing, 1); }
    // Core — pulsing glow
    if (this.core) {
      this.core.setPosition(pos.x, pos.y - 6 + bob);
      const pulse = 0.7 + Math.sin(this.animTime / 200) * 0.2;
      this.core.setAlpha(pulse);
      this.core.setRadius(3 + pulse * 2);
    }
    // Shoulders — follow torso
    if (this.shoulderL) this.shoulderL.setPosition(pos.x - facing * 16, pos.y - 12 + bob);
    if (this.shoulderR) this.shoulderR.setPosition(pos.x + facing * 16, pos.y - 12 + bob);
    // Head — follows torso bob
    if (this.mechaHead) this.mechaHead.setPosition(pos.x + facing * 6, pos.y - 18 + bob);
    // Visor — glowing strip on head
    if (this.visor) {
      this.visor.setPosition(pos.x + facing * 6, pos.y - 19 + bob);
      const vp = 0.5 + Math.sin(this.animTime / 150) * 0.3;
      this.visor.setAlpha(vp);
    }

    // Legs — walk cycle when moving, tuck when jumping
    if (this.mechaLegL && this.mechaLegR) {
      if (isJumping) {
        // Tuck legs up when in air
        this.mechaLegL.setPosition(pos.x - 6, pos.y + 10);
        this.mechaLegL.setAngle(-20);
        this.mechaLegR.setPosition(pos.x + 6, pos.y + 10);
        this.mechaLegR.setAngle(20);
      } else if (isMoving) {
        // Walk cycle — legs alternate forward/back
        const phase = this.animTime / 100;
        const legLOffset = Math.sin(phase) * 6;
        const legROffset = Math.sin(phase + Math.PI) * 6;
        this.mechaLegL.setPosition(pos.x - 8, pos.y + 14);
        this.mechaLegL.setAngle(legLOffset * 2);
        this.mechaLegR.setPosition(pos.x + 8, pos.y + 14);
        this.mechaLegR.setAngle(legROffset * 2);
      } else {
        // Idle
        this.mechaLegL.setPosition(pos.x - 8, pos.y + 14);
        this.mechaLegL.setAngle(0);
        this.mechaLegR.setPosition(pos.x + 8, pos.y + 14);
        this.mechaLegR.setAngle(0);
      }
    }

    // Gun arm — aim toward direction
    if (this.gunArm) {
      this.gunArm.setPosition(pos.x, pos.y - 6 + bob);
      const dir = this.getAimDirection();
      const targetAngle = Math.atan2(dir.y, dir.x);
      this.aimAngle = Phaser.Math.Angle.RotateTo(this.aimAngle, targetAngle, 0.3);
      this.gunArm.setRotation(this.aimAngle);
      const weapon = getWeapon(this.currentWeapon);
      this.gunArm.setStrokeStyle(1, weapon.color, 0.8);
    }

    // Landing impact — dust + slight squash
    if (this.grounded && !this.wasGrounded && vy > 3) {
      this.spawnLandingDust(pos.x, pos.y + 20);
      this.scene.cameras.main.shake(60, 0.003 * Math.min(vy / 5, 1));
    }
    this.wasGrounded = this.grounded;
    // Flash while invulnerable
    if (this.flashTimer > 0) {
      this.flashTimer -= deltaMs;
      const on = Math.floor(this.flashTimer / 80) % 2 === 0;
      this.sprite.setAlpha(on ? 0.45 : 0);
    } else {
      this.sprite.setAlpha(0);
    }
    // Thruster trail
    const tvx = this.sprite.body?.velocity.x ?? 0;
    const tvy = this.sprite.body?.velocity.y ?? 0;
    const speed = Math.sqrt(tvx * tvx + tvy * tvy);
    if (speed > 4 && this.alive) {
      const p = this.scene.add.circle(
        this.sprite.x - (this.facing === 'right' ? 12 : -12),
        this.sprite.y + 18, 2 + Math.random() * 2,
        COLORS.PLAYER_GLOW, 0.7
      );
      p.setDepth(8);
      this.scene.tweens.add({
        targets: p, alpha: 0, scale: 0.3, y: p.y + 10 + Math.random() * 10,
        duration: 300, onComplete: () => p.destroy(),
      });
    }
  }

  /** Spawn dust particles on landing. */
  private spawnLandingDust(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (Math.random() - 0.5) * Math.PI;
      const speed = 30 + Math.random() * 50;
      const d = this.scene.add.circle(x, y, 3 + Math.random() * 3, 0x6a6a7a, 0.5);
      d.setDepth(8);
      this.scene.tweens.add({
        targets: d,
        x: x + Math.cos(a) * speed,
        y: y - 10 - Math.random() * 15,
        alpha: 0, scale: 1.5,
        duration: 400 + Math.random() * 200,
        onComplete: () => d.destroy(),
      });
    }
  }

  destroy(): void {
    // H2 fix: remove window listeners to prevent leaks across Player reconstruction.
    if (typeof window !== 'undefined') {
      if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
      if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    }
    this.gunArm?.destroy(); this.mechaTorso?.destroy(); this.mechaHead?.destroy();
    this.mechaLegL?.destroy(); this.mechaLegR?.destroy();
    this.core?.destroy(); this.visor?.destroy();
    this.shoulderL?.destroy(); this.shoulderR?.destroy();
    if (this.sprite && this.sprite.active) this.sprite.destroy();
  }
}

export default Player;
