/**
 * MECHA: LAST PROTOCOL - Player (Mecha)
 * Single class: entity + controller + combat + visual.
 *
 * Input: window listeners only (single source of truth, no duplicate Phaser keyboard).
 * Physics: Matter.js variable delta.
 * Combat: 4 weapons, melee, dash with afterimage + i-frames.
 */

import Phaser from 'phaser';
import { COLORS, PLAYER } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';
import { Effects } from '../../shared/Effects';
import { GamepadManager } from '../../shared/GamepadManager';
import type { Direction } from '../../shared/Types';
import { bodyConfig } from '../physics/CollisionLayers';
import { Projectile } from '../combat/Projectile';
import { DamageSystem } from '../combat/DamageSystem';
import type { MatterBodyConfig } from '../../shared/Types';

export class Player {
  public sprite: Phaser.Physics.Matter.Image;
  public health: { current: number; max: number };
  public energy: { current: number; max: number; regenPerSec: number };
  public facing: Direction = 'right';
  public id = 'player';
  public alive = true;

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
  private lastAfterimageAt = 0;

  // Input state
  private heldLeft = false;
  private heldRight = false;
  private heldUp = false;
  private heldDown = false;
  private heldFire = false;

  // Visual parts
  private mechaTorso: Phaser.GameObjects.Rectangle | null = null;
  private mechaHead: Phaser.GameObjects.Rectangle | null = null;
  private mechaLegL: Phaser.GameObjects.Rectangle | null = null;
  private mechaLegR: Phaser.GameObjects.Rectangle | null = null;
  private core: Phaser.GameObjects.Arc | null = null;
  private visor: Phaser.GameObjects.Rectangle | null = null;
  private gunArm: Phaser.GameObjects.Rectangle | null = null;

  private invulnUntil = 0;
  private flashTimer = 0;
  private animTime = 0;
  private wasGrounded = true;

  // H2 fix: store bound handlers so they can be removed in destroy().
  private onKeyDown!: (e: KeyboardEvent) => void;
  private onKeyUp!: (e: KeyboardEvent) => void;

  constructor(
    private scene: Phaser.Scene,
    x: number, y: number,
    private projectiles: Projectile[],
    private damageSystem: DamageSystem
  ) {
    this.health = { current: PLAYER.MAX_HEALTH, max: PLAYER.MAX_HEALTH };
    this.energy = { current: PLAYER.MAX_ENERGY, max: PLAYER.MAX_ENERGY, regenPerSec: PLAYER.ENERGY_REGEN };

    this.sprite = scene.matter.add.image(x, y, '__white', undefined, {
      ...bodyConfig('player', { friction: 0.01, frictionAir: 0.02, density: 0.004 }),
    } as MatterBodyConfig);
    this.sprite.setDisplaySize(PLAYER.BODY_RADIUS * 2.2, PLAYER.BODY_RADIUS * 2.6);
    this.sprite.setFixedRotation();
    this.sprite.setAlpha(0);
    this.sprite.setData('entity', this);
    this.sprite.setData('entityType', 'player');

    this.buildMechaVisual();
    this.setupInput();
    GamepadManager.init();
  }

  private buildMechaVisual(): void {
    const scene = this.scene;
    this.mechaTorso = scene.add.rectangle(0, 0, 36, 30, 0x1a2840, 1);
    this.mechaTorso.setStrokeStyle(2, 0x39d0d8, 0.8);
    this.mechaTorso.setDepth(14);
    this.core = scene.add.circle(0, 0, 4, 0x66f0ff, 0.9);
    this.core.setDepth(15);
    this.mechaHead = scene.add.rectangle(0, 0, 16, 14, 0x2a3850, 1);
    this.mechaHead.setStrokeStyle(1, 0x66f0ff, 0.9);
    this.mechaHead.setDepth(15);
    this.visor = scene.add.rectangle(0, 0, 10, 3, 0x66f0ff, 0.8);
    this.visor.setDepth(16);
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

  private setupInput(): void {
    const scene = this.scene;
    if (typeof window !== 'undefined') {
      this.onKeyDown = (e: KeyboardEvent) => {
        switch (e.code) {
          case 'Space': this.tryJump(); break;
          case 'KeyJ': this.tryFire(); this.heldFire = true; break;
          case 'KeyK': this.tryMelee(); break;
          case 'Escape':
            if (scene.scene.isActive() && !scene.scene.isPaused()) {
              Effects.play('uiClick');
              scene.scene.pause();
              scene.scene.launch('UIScene');
            }
            break;
          case 'ShiftLeft': case 'ShiftRight':
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

  get isInvulnerable(): boolean { return this.scene.time.now < this.invulnUntil; }

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

  consumeEnergy(amount: number): boolean {
    if (this.energy.current < amount) return false;
    this.energy.current -= amount;
    return true;
  }

  update(deltaMs: number): void {
    if (!this.alive) return;
    this.updateMovement(deltaMs);
    this.updateAnimation(deltaMs);
    const gain = this.energy.regenPerSec * (deltaMs / 1000);
    if (gain > 0 && this.energy.current < this.energy.max) {
      this.energy.current = Math.min(this.energy.max, this.energy.current + gain);
    }
  }

  private updateMovement(deltaMs: number): void {
    void deltaMs;
    const now = this.scene.time.now;
    const maxJumps = 1; // Single jump for MVP

    GamepadManager.update();
    const gp = GamepadManager.getState();
    if (gp.firePressed) this.tryFire();
    if (gp.meleePressed) this.tryMelee();
    if (gp.jumpPressed) this.tryJump();
    if (gp.dashPressed) {
      const dir: Direction = gp.leftStickX < -0.2 ? 'left' : gp.leftStickX > 0.2 ? 'right' : this.facing;
      this.tryDash(dir);
    }
    if (gp.fireHeld) this.tryFire();
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
      this.coyoteUntil = now + PLAYER.COYOTE_TIME_MS;
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
      const body = this.sprite.body;
      if (body) this.sprite.setVelocityY(body.velocity.y * 0.4);
      if (now - this.lastAfterimageAt >= 35) {
        this.spawnDashAfterimage();
        this.lastAfterimageAt = now;
      }
      if (now >= this.dashUntil) this.isDashing = false;
    } else {
      if (moveX !== 0) {
        const targetVx = moveX * PLAYER.MOVE_SPEED;
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
    if (this.heldUp) aimY -= 1;
    if (this.heldDown) aimY += 1;
    this.keyAimY = Phaser.Math.Clamp(aimY, -1, 1);

    // Continuous fire
    if (this.heldFire) this.tryFire();
  }

  private tryJump(): void {
    this.jumpBufferUntil = this.scene.time.now + PLAYER.JUMP_BUFFER_MS;
    const now = this.scene.time.now;
    if (this.jumpsRemaining > 0 && (this.grounded || now < this.coyoteUntil)) {
      this.sprite.setVelocityY(PLAYER.JUMP_VELOCITY);
      this.jumpBufferUntil = 0;
      this.grounded = false;
      this.coyoteUntil = 0;
      this.jumpsRemaining--;
      Effects.play('jump');
    }
  }

  private cutJump(): void {
    const body = this.sprite.body;
    const vy = body?.velocity.y ?? 0;
    if (vy < 0) this.sprite.setVelocityY(vy * 0.45);
  }

  private tryDash(dir: Direction): void {
    const now = this.scene.time.now;
    if (this.isDashing || now < this.dashAvailableAt) return;
    if (!this.consumeEnergy(PLAYER.DASH_COST)) return;
    this.isDashing = true;
    this.dashDir = dir;
    this.dashUntil = now + PLAYER.DASH_DURATION_MS;
    this.dashAvailableAt = now + PLAYER.DASH_DURATION_MS + PLAYER.DASH_COOLDOWN_MS;
    this.invulnUntil = Math.max(this.invulnUntil, this.dashUntil);
    this.lastAfterimageAt = 0;
    Effects.play('dash');
  }

  private spawnDashAfterimage(): void {
    const pos = this.position;
    const facing = this.dashDir === 'right' ? 1 : -1;
    const ghost = this.scene.add.rectangle(pos.x, pos.y - 6, 36, 30, COLORS.PLAYER_GLOW, 0.5);
    ghost.setDepth(13);
    ghost.setScale(facing, 1);
    ghost.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ghost, alpha: 0, scale: 0.6,
      duration: 260, ease: 'Quad.easeOut',
      onComplete: () => ghost.destroy(),
    });
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
    if (now - this.lastFireAt < PLAYER.FIRE_COOLDOWN_MS) return;
    if (!this.consumeEnergy(PLAYER.FIRE_COST)) return;
    this.lastFireAt = now;
    const from = this.position;
    const aimDir = this.getAimDirection();
    const muzzle = new Phaser.Math.Vector2(from.x + aimDir.x * 30, from.y - 6 + aimDir.y * 30);
    Effects.play('fire');
    const proj = new Projectile(this.scene, muzzle, aimDir, {
      speed: PLAYER.BULLET_SPEED, damage: PLAYER.BULLET_DAMAGE, ttl: 1500,
      owner: 'player', color: COLORS.PROJECTILE, size: 6,
    });
    this.projectiles.push(proj);
    Effects.sparks(this.scene, muzzle.x, muzzle.y, COLORS.PROJECTILE, 4);
  }

  private tryMelee(): void {
    const now = this.scene.time.now;
    if (now - this.lastMeleeAt < PLAYER.MELEE_COOLDOWN_MS) return;
    if (!this.consumeEnergy(PLAYER.MELEE_COST)) return;
    this.lastMeleeAt = now;
    const aimDir = this.getAimDirection();
    const origin = this.position;
    const range = PLAYER.MELEE_RANGE;
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
          amount: PLAYER.MELEE_DAMAGE, type: 'melee', source: this.id,
          target: entity.id ?? 'unknown',
          knockback: { x: aimDir.x * 0.18, y: aimDir.y * 0.05 },
          point: { x: sprite.x, y: sprite.y },
        });
      }
    }
  }

  private updateAnimation(deltaMs: number): void {
    this.animTime += deltaMs;
    const pos = this.position;
    const facing = this.facing === 'right' ? 1 : -1;
    const body = this.sprite.body;
    const vx = body?.velocity.x ?? 0;
    const vy = body?.velocity.y ?? 0;
    const isMoving = Math.abs(vx) > 0.5 && this.grounded;
    const isJumping = !this.grounded;

    const bob = isMoving ? Math.sin(this.animTime / 80) * 2 : 0;
    if (this.mechaTorso) { this.mechaTorso.setPosition(pos.x, pos.y - 6 + bob); this.mechaTorso.setScale(facing, 1); }
    if (this.core) {
      this.core.setPosition(pos.x, pos.y - 6 + bob);
      const pulse = 0.7 + Math.sin(this.animTime / 200) * 0.2;
      this.core.setAlpha(pulse);
      this.core.setRadius(3 + pulse * 2);
    }
    if (this.mechaHead) this.mechaHead.setPosition(pos.x + facing * 6, pos.y - 18 + bob);
    if (this.visor) {
      this.visor.setPosition(pos.x + facing * 6, pos.y - 19 + bob);
      this.visor.setAlpha(0.5 + Math.sin(this.animTime / 150) * 0.3);
    }
    if (this.mechaLegL && this.mechaLegR) {
      if (isJumping) {
        this.mechaLegL.setPosition(pos.x - 6, pos.y + 10); this.mechaLegL.setAngle(-20);
        this.mechaLegR.setPosition(pos.x + 6, pos.y + 10); this.mechaLegR.setAngle(20);
      } else if (isMoving) {
        const phase = this.animTime / 100;
        this.mechaLegL.setPosition(pos.x - 8, pos.y + 14); this.mechaLegL.setAngle(Math.sin(phase) * 6 * 2);
        this.mechaLegR.setPosition(pos.x + 8, pos.y + 14); this.mechaLegR.setAngle(Math.sin(phase + Math.PI) * 6 * 2);
      } else {
        this.mechaLegL.setPosition(pos.x - 8, pos.y + 14); this.mechaLegL.setAngle(0);
        this.mechaLegR.setPosition(pos.x + 8, pos.y + 14); this.mechaLegR.setAngle(0);
      }
    }
    if (this.gunArm) {
      this.gunArm.setPosition(pos.x, pos.y - 6 + bob);
      const dir = this.getAimDirection();
      const targetAngle = Math.atan2(dir.y, dir.x);
      this.aimAngle = Phaser.Math.Angle.RotateTo(this.aimAngle, targetAngle, 0.3);
      this.gunArm.setRotation(this.aimAngle);
    }

    // Landing impact
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
  }

  private spawnLandingDust(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (Math.random() - 0.5) * Math.PI;
      const speed = 30 + Math.random() * 50;
      const d = this.scene.add.circle(x, y, 3 + Math.random() * 3, 0x6a6a7a, 0.5);
      d.setDepth(8);
      this.scene.tweens.add({
        targets: d,
        x: x + Math.cos(a) * speed, y: y - 10 - Math.random() * 15,
        alpha: 0, scale: 1.5,
        duration: 400 + Math.random() * 200,
        onComplete: () => d.destroy(),
      });
    }
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
      if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    }
    this.gunArm?.destroy();
    this.mechaTorso?.destroy();
    this.mechaHead?.destroy();
    this.mechaLegL?.destroy();
    this.mechaLegR?.destroy();
    this.core?.destroy();
    this.visor?.destroy();
    if (this.sprite && this.sprite.active) this.sprite.destroy();
  }
}

export default Player;
