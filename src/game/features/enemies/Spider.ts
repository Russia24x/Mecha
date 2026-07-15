/**
 * MECHA: LAST PROTOCOL - Spider enemy (FSM version)
 * Ground melee unit with telegraphed lunge attack.
 *
 * States: patrol → aggro → attack (telegraph→window→recovery) → cover
 * Telegraph: crouches down (scale squish) for 0.4s
 * Window: lunges forward at high speed
 * Recovery: skids to a stop, vulnerable
 */
import Phaser from 'phaser';
import { COLORS, ENEMIES } from '../../shared/Constants';
import { Enemy, type AttackTimings } from './Enemy';

let spiderCounter = 0;

export class Spider extends Enemy {
  private patrolDir = 1;
  private lungeDir = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, {
      x, y,
      width: 36, height: 22,
      color: COLORS.ENEMY_SPIDER,
      health: ENEMIES.SPIDER.health,
      id: `spider-${++spiderCounter}`,
      detectionRange: ENEMIES.SPIDER.detectionRange,
    });
  }

  protected getBaseTint(): number { return COLORS.ENEMY_SPIDER; }
  protected getScore(): number { return ENEMIES.SPIDER.score; }

  protected getAttackTimings(): AttackTimings {
    return {
      telegraphMs: 400,   // 0.4s crouch (telegraph)
      windowMs: 320,      // 0.32s lunge
      recoveryMs: 500,    // 0.5s skid/recover
    };
  }

  protected onPatrol(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    this.sprite.setVelocityX(this.patrolDir * ENEMIES.SPIDER.speed * 0.5);
    const vx = this.sprite.body!.velocity.x;
    if (Math.abs(vx) < 0.05) this.patrolDir *= -1; // hit wall
  }

  protected onAggro(_delta: number, playerPos: Phaser.Math.Vector2): void {
    const dir = playerPos.x < this.sprite.x ? -1 : 1;
    this.patrolDir = dir;
    this.sprite.setVelocityX(dir * ENEMIES.SPIDER.speed);
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y);
    if (dist < ENEMIES.SPIDER.lungeRange) {
      this.lungeDir = dir;
      this.changeState('attack');
    }
  }

  protected onAttackTelegraph(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    // Crouch: squish the sprite vertically (telegraph cue)
    const t = Math.min(1, this.stateTime / this.getAttackTimings().telegraphMs);
    const scaleY = Phaser.Math.Linear(1, 0.6, t);
    const scaleX = Phaser.Math.Linear(1, 1.2, t);
    this.sprite.setScale(scaleX, scaleY);
    this.sprite.setVelocityX(0);
  }

  protected onAttackWindow(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    // Lunge forward at high speed
    this.sprite.setVelocityX(this.lungeDir * ENEMIES.SPIDER.lungeSpeed);
    // Restore scale
    this.sprite.setScale(1, 1);
  }

  protected onAttackRecovery(_delta: number, _playerPos: Phaser.Math.Vector2): void {
    // Skid to a stop
    const vx = this.sprite.body!.velocity.x;
    this.sprite.setVelocityX(vx * 0.85);
    this.sprite.setScale(1, 1);
  }
}

export default Spider;
