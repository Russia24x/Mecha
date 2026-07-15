/**
 * MECHA: LAST PROTOCOL - PlayerCombat
 * Owns fire + melee attempts. Delegates to Projectile system for bullets,
 * and DamageSystem for melee hits. Pure combat logic — no movement.
 *
 * AIM MODEL (keyboard/gamepad only — NO mouse during gameplay):
 *   - Keyboard: aim with arrow keys / W+S to set a vertical bias.
 *     Up = 8-directional up, Down = diagonal down, neutral = straight ahead.
 *   - Gamepad: right stick for analog aim (full 360°).
 *   - Gun arm visual rotates to match aim.
 *
 * Supports multiple weapons via the Weapons module.
 * Reads modifiers from SkillTree for damage/cooldown/etc.
 */
import Phaser from 'phaser';
import { PLAYER } from '../../shared/Constants';
import { SkillTree } from '../../shared/SkillTree';
import { AudioManager } from '../../shared/AudioManager';
import { EventBus } from '../../shared/EventBus';
import { GamepadManager } from '../../shared/GamepadManager';
import type { Player } from './Player';
import { Projectile } from '../combat/Projectile';
import { DamageSystem } from '../combat/DamageSystem';
import { getWeapon, cycleWeapon, type WeaponId } from '../combat/Weapons';
import { Hitscan } from '../combat/Hitscan';

export class PlayerCombat {
  private lastFireAt = 0;
  private lastMeleeAt = 0;
  private currentWeapon: WeaponId = 'plasma';
  private unlockedWeapons: Set<WeaponId> = new Set(['plasma']);
  // Gun arm visual (rotates toward aim direction)
  private gunArm: Phaser.GameObjects.Rectangle | null = null;
  // Smoothed aim angle (radians)
  private aimAngle = 0;
  // Keyboard aim state: -1 (up), 0 (neutral), +1 (down) — combined with facing
  private keyAimY = 0;
  // Mecha body parts (visual)
  private mechaTorso: Phaser.GameObjects.Rectangle | null = null;
  private mechaHead: Phaser.GameObjects.Rectangle | null = null;
  private mechaLegL: Phaser.GameObjects.Rectangle | null = null;
  private mechaLegR: Phaser.GameObjects.Rectangle | null = null;

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private projectiles: Projectile[],
    private damageSystem: DamageSystem
  ) {
    // Build a visual Mecha body out of rectangles
    this.buildMechaVisual();
    // Gun arm
    this.gunArm = scene.add.rectangle(0, 0, 28, 6, 0x1a2030, 1);
    this.gunArm.setOrigin(0, 0.5);
    this.gunArm.setDepth(15);
    this.gunArm.setStrokeStyle(1, 0xfff04a, 0.7);
  }

  /** Build a multi-part Mecha visual (torso, head, legs) that follows the player. */
  private buildMechaVisual(): void {
    const scene = this.scene;
    // Torso (main body)
    this.mechaTorso = scene.add.rectangle(0, 0, 32, 28, 0x1a2840, 1);
    this.mechaTorso.setStrokeStyle(2, 0x39d0d8, 0.8);
    this.mechaTorso.setDepth(14);
    // Head (cockpit)
    this.mechaHead = scene.add.rectangle(0, 0, 14, 12, 0x2a3850, 1);
    this.mechaHead.setStrokeStyle(1, 0x66f0ff, 0.9);
    this.mechaHead.setDepth(15);
    // Legs
    this.mechaLegL = scene.add.rectangle(0, 0, 8, 16, 0x2a3850, 1);
    this.mechaLegL.setStrokeStyle(1, 0x39d0d8, 0.6);
    this.mechaLegL.setDepth(13);
    this.mechaLegR = scene.add.rectangle(0, 0, 8, 16, 0x2a3850, 1);
    this.mechaLegR.setStrokeStyle(1, 0x39d0d8, 0.6);
    this.mechaLegR.setDepth(13);
  }

  get weapon(): WeaponId { return this.currentWeapon; }

  unlockWeapon(id: WeaponId): void {
    this.unlockedWeapons.add(id);
  }

  hasWeapon(id: WeaponId): boolean {
    return this.unlockedWeapons.has(id);
  }

  switchWeapon(dir: 1 | -1): void {
    let next = this.currentWeapon;
    for (let i = 0; i < 4; i++) {
      next = cycleWeapon(next, dir);
      if (this.unlockedWeapons.has(next)) {
        this.currentWeapon = next;
        AudioManager.play('weaponSwitch');
        EventBus.emit('player:weapon-changed', { id: next, name: getWeapon(next).name });
        return;
      }
    }
  }

  setWeapon(id: WeaponId): void {
    if (this.unlockedWeapons.has(id)) {
      this.currentWeapon = id;
      AudioManager.play('weaponSwitch');
      EventBus.emit('player:weapon-changed', { id, name: getWeapon(id).name });
    }
  }

  /** Set the keyboard aim bias: -1 = up, 0 = neutral, +1 = down. */
  setKeyAimY(v: number): void {
    this.keyAimY = Phaser.Math.Clamp(v, -1, 1);
  }

  /**
   * Compute the current aim direction from keyboard + gamepad.
   * - Gamepad right stick has priority (full 360° analog aim).
   * - Keyboard: facing direction + up/down bias (8-directional).
   */
  private getAimDirection(): Phaser.Math.Vector2 {
    const gp = GamepadManager.getState();
    // Gamepad right stick — full 360°
    if (Math.abs(gp.rightStickX) > 0.15 || Math.abs(gp.rightStickY) > 0.15) {
      const len = Math.sqrt(gp.rightStickX ** 2 + gp.rightStickY ** 2);
      return new Phaser.Math.Vector2(gp.rightStickX / len, gp.rightStickY / len);
    }
    // Keyboard: 8-directional based on facing + vertical bias
    const dirX = this.player.facing === 'right' ? 1 : -1;
    const dirY = this.keyAimY;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    return new Phaser.Math.Vector2(dirX / len, dirY / len);
  }

  /** Called every frame from the controller to update the gun arm + mecha visuals. */
  updateAimVisual(): void {
    if (!this.gunArm || !this.player.sprite || !this.player.sprite.active) return;
    const pos = this.player.position;
    // Update mecha parts
    const facing = this.player.facing === 'right' ? 1 : -1;
    if (this.mechaTorso) {
      this.mechaTorso.setPosition(pos.x, pos.y - 6);
      this.mechaTorso.setScale(facing, 1);
    }
    if (this.mechaHead) {
      this.mechaHead.setPosition(pos.x + facing * 6, pos.y - 18);
    }
    if (this.mechaLegL) {
      this.mechaLegL.setPosition(pos.x - 8, pos.y + 14);
    }
    if (this.mechaLegR) {
      this.mechaLegR.setPosition(pos.x + 8, pos.y + 14);
    }
    // Gun arm
    this.gunArm.setPosition(pos.x, pos.y - 6);
    const dir = this.getAimDirection();
    const targetAngle = Math.atan2(dir.y, dir.x);
    this.aimAngle = Phaser.Math.Angle.RotateTo(this.aimAngle, targetAngle, 0.3);
    this.gunArm.setRotation(this.aimAngle);
    // Tint gun arm based on current weapon
    const weapon = getWeapon(this.currentWeapon);
    this.gunArm.setStrokeStyle(1, weapon.color, 0.8);
  }

  tryFire(): void {
    const now = this.scene.time.now;
    const mods = SkillTree.getPlayerModifiers();
    const weapon = getWeapon(this.currentWeapon);
    const cooldown = this.currentWeapon === 'plasma'
      ? mods.fireCooldown
      : weapon.cooldownMs;

    if (now - this.lastFireAt < cooldown) return;
    const energyCost = this.currentWeapon === 'plasma' ? PLAYER.FIRE_COST : weapon.energyCost;
    if (!this.player.consumeEnergy(energyCost)) return;
    this.lastFireAt = now;

    const from = this.player.position;
    const aimDir = this.getAimDirection();
    const muzzle = new Phaser.Math.Vector2(
      from.x + aimDir.x * 30,
      from.y - 6 + aimDir.y * 30
    );

    const damage = this.currentWeapon === 'plasma'
      ? mods.bulletDamage
      : weapon.damage;

    // Tier 1 — Hitscan (Laser): instant ray, no traveling projectile
    if (weapon.tier === 'hitscan') {
      const baseAngle = Math.atan2(aimDir.y, aimDir.x);
      Hitscan.fire(this.scene, muzzle, baseAngle, 800, damage);
      // Recoil
      if (this.gunArm) {
        this.scene.tweens.add({
          targets: this.gunArm,
          x: this.gunArm.x - aimDir.x * 2,
          y: this.gunArm.y - aimDir.y * 2,
          duration: 50,
          yoyo: true,
          ease: 'Quad.easeOut',
        });
      }
      return;
    }

    // Tier 2 (kinematic) + Tier 3 (matter) — spawn traveling projectiles
    AudioManager.play('fire');

    const baseAngle = Math.atan2(aimDir.y, aimDir.x);
    for (let i = 0; i < weapon.bulletsPerShot; i++) {
      let angleOffset = 0;
      if (weapon.bulletsPerShot > 1) {
        const t = weapon.bulletsPerShot === 1 ? 0 : i / (weapon.bulletsPerShot - 1) - 0.5;
        angleOffset = t * weapon.spread;
      }
      const angle = baseAngle + angleOffset;
      const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
      const proj = new Projectile(this.scene, muzzle, dir, {
        speed: weapon.speed,
        damage,
        ttl: weapon.ttl,
        owner: 'player',
        color: weapon.color,
        size: weapon.size,
        explosive: weapon.explosive,
        explosionRadius: weapon.explosionRadius,
        isLaser: weapon.isLaser,
      });
      this.projectiles.push(proj);
    }

    // Muzzle flash
    this.damageSystem.spawnSpark(muzzle.x, muzzle.y, weapon.color, weapon.bulletsPerShot + 2);

    // Recoil tween
    if (this.gunArm) {
      const kickOffset = weapon.isLaser ? 2 : 5;
      this.scene.tweens.add({
        targets: this.gunArm,
        x: this.gunArm.x - aimDir.x * kickOffset,
        y: this.gunArm.y - aimDir.y * kickOffset,
        duration: 60,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  tryMelee(): void {
    const now = this.scene.time.now;
    if (now - this.lastMeleeAt < PLAYER.MELEE_COOLDOWN_MS) return;
    if (!this.player.consumeEnergy(PLAYER.MELEE_COST)) return;
    this.lastMeleeAt = now;

    const mods = SkillTree.getPlayerModifiers();
    const aimDir = this.getAimDirection();
    const origin = this.player.position;
    const damage = mods.meleeDamage;
    const range = mods.meleeRange;

    AudioManager.play('melee');

    // Visual slash arc in the aim direction
    const slashX = origin.x + aimDir.x * 24;
    const slashY = origin.y - 6 + aimDir.y * 24;
    this.damageSystem.spawnSlash(slashX, slashY, aimDir.x > 0 ? 1 : -1);

    // Find bodies in melee arc and damage them
    const cx = origin.x + aimDir.x * (range / 2);
    const cy = origin.y - 6 + aimDir.y * (range / 2);
    const radius = range / 2;
    const bodies = this.scene.matter.query.region(
      new Phaser.Geom.Circle(cx, cy, radius)
    ) as MatterJS.BodyType[];

    for (const body of bodies) {
      const sprite = (body as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      if (!sprite) continue;
      const entityType = sprite.getData('entityType') as string | undefined;
      const entity = sprite.getData('entity') as { id?: string; takeDamage?: (n: number) => void } | undefined;
      if (!entity || !entityType) continue;
      if (entityType === 'enemy' || entityType === 'boss') {
        this.damageSystem.dealDamage({
          amount: damage,
          type: 'melee',
          source: this.player.id,
          target: entity.id ?? 'unknown',
          knockback: { x: aimDir.x * 0.18, y: aimDir.y * 0.05 },
          point: { x: sprite.x, y: sprite.y },
        });
      }
    }
  }

  /** Destroy all visual parts (on scene shutdown). */
  destroyVisuals(): void {
    this.gunArm?.destroy();
    this.mechaTorso?.destroy();
    this.mechaHead?.destroy();
    this.mechaLegL?.destroy();
    this.mechaLegR?.destroy();
    this.gunArm = null;
    this.mechaTorso = null;
    this.mechaHead = null;
    this.mechaLegL = null;
    this.mechaLegR = null;
  }
}

export default PlayerCombat;
