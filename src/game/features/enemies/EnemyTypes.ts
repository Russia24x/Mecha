/**
 * MECHA: LAST PROTOCOL - EnemyTypes
 * Data-only definitions for each enemy type.
 * Enemy.ts reads from this to configure behavior.
 */

export type EnemyTypeId = 'drone' | 'spider' | 'heavy';
export type EnemyAttackType = 'shoot' | 'lunge' | 'charge';

export interface EnemyTypeData {
  hp: number;
  speed: number;
  detectionRange: number;
  attack: EnemyAttackType;
  attackRange: number;
  // Ranged (drone)
  fireRateMs?: number;
  bulletSpeed?: number;
  bulletDamage?: number;
  // Melee (spider)
  lungeSpeed?: number;
  // Heavy
  chargeSpeed?: number;
  score: number;
  color: number;
  size: { w: number; h: number };
  flying: boolean;
  timings: { telegraphMs: number; windowMs: number; recoveryMs: number };
}

export const ENEMY_TYPES: Record<EnemyTypeId, EnemyTypeData> = {
  drone: {
    hp: 24, speed: 1.4, detectionRange: 320,
    attack: 'shoot', attackRange: 220,
    fireRateMs: 2200, bulletSpeed: 5.5, bulletDamage: 6,
    score: 50, color: 0xff5a5a, size: { w: 26, h: 22 },
    flying: true,
    timings: { telegraphMs: 500, windowMs: 200, recoveryMs: 600 },
  },
  spider: {
    hp: 55, speed: 2.2, detectionRange: 280,
    attack: 'lunge', attackRange: 140, lungeSpeed: 7,
    score: 80, color: 0xff8a3d, size: { w: 36, h: 22 },
    flying: false,
    timings: { telegraphMs: 400, windowMs: 320, recoveryMs: 500 },
  },
  heavy: {
    hp: 140, speed: 0.9, detectionRange: 320,
    attack: 'charge', attackRange: 256, chargeSpeed: 5,
    score: 150, color: 0xb040ff, size: { w: 52, h: 44 },
    flying: false,
    timings: { telegraphMs: 600, windowMs: 700, recoveryMs: 900 },
  },
};

let enemyCounter = 0;
export function nextEnemyId(type: EnemyTypeId): string {
  return `${type}-${++enemyCounter}`;
}

/** L9 fix: reset enemy ID counter (call on scene cleanup to keep IDs small). */
export function resetEnemyIds(): void {
  enemyCounter = 0;
}
