/**
 * MECHA: LAST PROTOCOL - Drone enemy (FSM version)
 * Flying ranged unit with telegraphed shots.
 *
 * States: patrol → aggro → attack (telegraph→window→recovery) → cover
 * Telegraph: pulsing red ring + slight hover back
 * Window: fires a burst of bullets at the player
 * Recovery: brief vulnerability, strafes sideways
 */
import Phaser from 'phaser';
import { COLORS, ENEMIES } from '../../shared/Constants';
import { Enemy, type AttackTimings } from './Enemy';
import { Projectile } from '../combat/Projectile';

let droneCounter = 0;

export class Drone extends Enemy {
  private lastFireAt = 0;
  private hoverBase: number;
  private targetStrafeDir = 1;
  private lastStrafeChange = 0;
  private projectiles: Projectile[];

  constructor(scene: Phaser.Scene, x: number, y: number, projectiles: Projectile[]) {
    super(scene, {
      x, y,
      width: 26, height: 22,
      color: COLORS.ENEMY_DRONE,
      health: ENEMIES.DRONE.health,
      id: `drone-${++droneCounter}`,
      detectionRange: ENEMIES.DRONE.detectionRange,
    });
    this.hoverBase = y;
    this.projectiles = projectiles;
    this.sprite.setIgnoreGravity(true);
  }

  protected getBaseTint(): number { return COLORS.ENEMY_DRONE; }
  protected getScore(): number { return ENEMIES.DRONE.score; }

  protected getAttackTimings(): AttackTimings {
    return {
      telegraphMs: 500,   // 0.5s windup (red ring pulses)
      windowMs: 200,      // 0.2s firing window
      recoveryMs: 600,    // 0.6s vulnerable recovery
    };
  }

  protected onPatrol(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    // Hover in place
    const hover = this.hoverBase + Math.sin(this.scene.time.now / 360) * 12;
    this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
    this.sprite.setVelocityX(0);
  }

  protected onAggro(_delta: number, playerPos: Phaser.Math.Vector2): void {
    const now = this.scene.time.now;
    // Hover oscillation
    const hover = this.hoverBase + Math.sin(now / 360) * 12;
    this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);

    // Approach to preferred range, then attack
    const dx = playerPos.x - this.sprite.x;
    const absDx = Math.abs(dx);
    const preferredRange = 220;
    if (absDx > preferredRange + 40) {
      const dir = dx > 0 ? 1 : -1;
      this.sprite.setVelocityX(dir * ENEMIES.DRONE.speed);
    } else if (absDx < preferredRange - 40) {
      const dir = dx > 0 ? -1 : 1;
      this.sprite.setVelocityX(dir * ENEMIES.DRONE.speed);
    } else {
      // In range — attack!
      this.changeState('attack');
    }
  }

  protected onAttackTelegraph(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    // Hover in place during telegraph — give player time to react
    const hover = this.hoverBase + Math.sin(this.scene.time.now / 360) * 12;
    this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
    this.sprite.setVelocityX(0);
  }

  protected onAttackWindow(_delta: number, playerPos: Phaser.Math.Vector2): void {
    // Fire at player during the window
    this.fire(playerPos);
  }

  protected onAttackRecovery(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    // Strafe sideways during recovery (vulnerable window)
    const now = this.scene.time.now;
    if (now - this.lastStrafeChange > 300) {
      this.targetStrafeDir = Math.random() < 0.5 ? -1 : 1;
      this.lastStrafeChange = now;
    }
    this.sprite.setVelocityX(this.targetStrafeDir * ENEMIES.DRONE.speed * 0.6);
    const hover = this.hoverBase + Math.sin(now / 360) * 12;
    this.sprite.setVelocityY((hover - this.sprite.y) * 0.06);
  }

  private fire(playerPos: Phaser.Math.Vector2): void {
    // Only fire once per attack window
    if (this.lastFireAt > 0 && this.scene.time.now - this.lastFireAt < 100) return;
    this.lastFireAt = this.scene.time.now;
    const from = this.position;
    const dir = new Phaser.Math.Vector2(playerPos.x - from.x, playerPos.y - from.y).normalize();
    const proj = new Projectile(this.scene, from, dir, {
      speed: ENEMIES.DRONE.bulletSpeed,
      damage: ENEMIES.DRONE.bulletDamage,
      ttl: 2000,
      owner: 'enemy',
      color: COLORS.ENEMY_PROJ,
      size: 5,
    });
    this.projectiles.push(proj);
  }
}

export default Drone;
