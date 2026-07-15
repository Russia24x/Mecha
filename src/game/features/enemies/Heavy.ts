/**
 * MECHA: LAST PROTOCOL - Heavy enemy (FSM version)
 * Slow, high-HP ground unit with telegraphed charge attack.
 *
 * States: patrol → aggro → attack (telegraph→window→recovery) → cover
 * Telegraph: glows white + shakes for 0.6s (big windup)
 * Window: charges forward at high speed
 * Recovery: long vulnerable stun (1s)
 */
import Phaser from 'phaser';
import { COLORS, ENEMIES } from '../../shared/Constants';
import { Enemy, type AttackTimings } from './Enemy';

let heavyCounter = 0;

export class Heavy extends Enemy {
  private chargeDir = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, {
      x, y,
      width: 52, height: 44,
      color: COLORS.ENEMY_HEAVY,
      health: ENEMIES.HEAVY.health,
      id: `heavy-${++heavyCounter}`,
      detectionRange: ENEMIES.HEAVY.detectionRange,
    });
  }

  protected getBaseTint(): number { return COLORS.ENEMY_HEAVY; }
  protected getScore(): number { return ENEMIES.HEAVY.score; }

  protected getAttackTimings(): AttackTimings {
    return {
      telegraphMs: 600,   // 0.6s big windup (glow + shake)
      windowMs: 700,      // 0.7s charge
      recoveryMs: 900,    // 0.9s long stun (very vulnerable)
    };
  }

  protected onPatrol(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    this.sprite.setVelocityX(0);
  }

  protected onAggro(_delta: number, playerPos: Phaser.Math.Vector2): void {
    const dir = playerPos.x < this.sprite.x ? -1 : 1;
    this.chargeDir = dir;
    this.sprite.setVelocityX(dir * ENEMIES.HEAVY.speed);
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y);
    if (dist < ENEMIES.HEAVY.detectionRange * 0.8) {
      this.changeState('attack');
    }
  }

  protected onAttackTelegraph(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    // Glow white + shake (big windup)
    const flash = Math.floor(this.stateTime / 80) % 2 === 0;
    this.sprite.setTint(flash ? 0xffffff : this.getBaseTint());
    // Small jitter
    const jitterX = (Math.random() - 0.5) * 2;
    this.sprite.setVelocityX(jitterX);
  }

  protected onAttackWindow(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    // Charge forward at high speed
    this.sprite.setVelocityX(this.chargeDir * ENEMIES.HEAVY.chargeSpeed);
    this.sprite.setTint(this.getBaseTint());
  }

  protected onAttackRecovery(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    // Long stun — skid to stop
    const vx = this.sprite.body!.velocity.x;
    this.sprite.setVelocityX(vx * 0.9);
  }
}

export default Heavy;
