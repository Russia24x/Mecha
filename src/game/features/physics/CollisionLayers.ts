/**
 * MECHA: LAST PROTOCOL - CollisionLayers
 * Centralized collision filtering configuration for Matter.js.
 * Each entity requests a "profile" — never touches bitmasks directly.
 */
import { PHYSICS } from '../../shared/Constants';
import type { EntityCategory } from '../../shared/Types';

export interface CollisionProfile {
  category: number;
  mask: number;
  group: number;
}

/**
 * Pre-computed collision profiles. Returns the right bitmask
 * combination so e.g. player bullets hit enemies + solids but
 * NOT other player bullets or the player itself.
 */
export function getCollisionProfile(cat: EntityCategory): CollisionProfile {
  const C = PHYSICS.CATEGORY;
  switch (cat) {
    case 'solid':
      // solids collide with everything except sensors/pickups
      return { category: C.SOLID, mask: C.PLAYER | C.ENEMY | C.BOSS | C.PROJ_PLAYER | C.PROJ_ENEMY, group: 0 };
    case 'player':
      // player hits solids, enemies, boss, enemy bullets, pickups
      return { category: C.PLAYER, mask: C.SOLID | C.ENEMY | C.BOSS | C.PROJ_ENEMY | C.SENSOR | C.PICKUP, group: 0 };
    case 'enemy':
      return { category: C.ENEMY, mask: C.SOLID | C.PLAYER | C.PROJ_PLAYER | C.SENSOR, group: 0 };
    case 'boss':
      return { category: C.BOSS, mask: C.SOLID | C.PLAYER | C.PROJ_PLAYER | C.SENSOR, group: 0 };
    case 'projectile-player':
      // player bullets hit solids, enemies, boss — nothing else
      return { category: C.PROJ_PLAYER, mask: C.SOLID | C.ENEMY | C.BOSS, group: 0 };
    case 'projectile-enemy':
      return { category: C.PROJ_ENEMY, mask: C.SOLID | C.PLAYER, group: 0 };
    case 'sensor':
      // sensors detect but do not physically push anything
      return { category: C.SENSOR, mask: C.PLAYER | C.ENEMY, group: 0 };
    case 'pickup':
      return { category: C.PICKUP, mask: C.PLAYER, group: 0 };
    default:
      return { category: 0x0001, mask: 0xFFFF, group: 0 };
  }
}

/** Helper: build a Matter.js body config from a profile. */
export function bodyConfig(
  cat: EntityCategory,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const p = getCollisionProfile(cat);
  return {
    collisionFilter: {
      category: p.category,
      mask: p.mask,
      group: p.group,
    },
    ...extra,
  };
}
