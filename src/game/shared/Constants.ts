/**
 * MECHA: LAST PROTOCOL - Global Constants
 * Single source of truth for tuning values.
 */

export const GAME = {
  WIDTH: 1280,
  HEIGHT: 720,
  BG_COLOR: '#0a0d14',
  TARGET_FPS: 60,
  TITLE: 'MECHA: LAST PROTOCOL',
  VERSION: 'MVP 3.0',
} as const;

export const PHYSICS = {
  GRAVITY_Y: 0.9,
  TILE_SIZE: 32,
  CATEGORY: {
    SOLID:        0x0001,
    PLAYER:       0x0002,
    ENEMY:        0x0004,
    BOSS:         0x0008,
    PROJ_PLAYER:  0x0010,
    PROJ_ENEMY:   0x0020,
    SENSOR:       0x0040,
    PICKUP:       0x0080,
  } as const,
} as const;

export const PLAYER = {
  MAX_HEALTH: 150,
  MAX_ENERGY: 100,
  ENERGY_REGEN: 14,
  MOVE_SPEED: 5.5,
  JUMP_VELOCITY: -11.5,
  DASH_SPEED: 10,
  DASH_DURATION_MS: 220,
  DASH_COST: 22,
  DASH_COOLDOWN_MS: 600,
  MELEE_DAMAGE: 35,
  MELEE_RANGE: 60,
  MELEE_COOLDOWN_MS: 360,
  MELEE_COST: 6,
  BULLET_DAMAGE: 18,
  BULLET_SPEED: 13,
  FIRE_COOLDOWN_MS: 140,
  FIRE_COST: 3,
  INVULN_MS: 850,
  BODY_RADIUS: 18,
  COYOTE_TIME_MS: 120,
  JUMP_BUFFER_MS: 120,
} as const;

export const STAGE_1 = {
  id: 1,
  name: 'ABANDONED FACTORY',
  bgColor: 0x05070d,
  SECTIONS: [
    { id: 1, name: 'Tutorial Zone',    x: 0,     enemies: [] as string[] },
    { id: 2, name: 'Combat Room A',   x: 1280,  enemies: ['drone', 'drone'] },
    { id: 3, name: 'Platform Section', x: 2560, enemies: ['drone'] },
    { id: 4, name: 'Combat Room B',   x: 3840,  enemies: ['spider', 'spider', 'heavy'] },
    { id: 5, name: 'Checkpoint',      x: 5120,  enemies: [] },
    { id: 6, name: 'Boss Arena',      x: 6400,  enemies: ['boss'] },
  ],
  TOTAL_WIDTH: 7680,
  SECTION_WIDTH: 1280,
  CHECKPOINT_SECTIONS: [2, 5],
  BOSS_NAME: 'GUARDIAN AX-09',
  BOSS_MAX_PHASES: 2,
  BOSS_LORE: [
    'The last sentinel of the Abandoned Factory.',
    'Forged to guard the secrets of the Old Protocol,',
    'it knew only duty — until the Protocol fell silent.',
  ],
} as const;

export const COLORS = {
  PLAYER:       0x39d0d8,
  PLAYER_GLOW:  0x66f0ff,
  ENEMY_DRONE:  0xff5a5a,
  ENEMY_SPIDER: 0xff8a3d,
  ENEMY_HEAVY:  0xb040ff,
  BOSS:         0xff3030,
  BOSS_GLOW:    0xff6060,
  PROJECTILE:   0xfff04a,
  ENEMY_PROJ:   0xff4a4a,
  HEALTH:       0x40d070,
  ENERGY:       0x4090ff,
  LIGHT:        0xffe6b0,
  METAL:        0x4a5260,
  METAL_DARK:   0x2a3038,
  RUST:         0x8a4a2a,
} as const;

export const KEYS = {
  SAVE_KEY: 'mecha_last_protocol_save_v2',
} as const;
