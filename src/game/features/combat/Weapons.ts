/**
 * MECHA: LAST PROTOCOL - Weapon system
 * Pluggable weapon definitions. Each weapon has different stats
 * and a unique fire pattern. New weapons can be added here without
 * touching PlayerCombat.
 */
import { COLORS } from '../../shared/Constants';

export type WeaponId = 'plasma' | 'shotgun' | 'laser' | 'rocket';

/** Projectile tier — see weapon-systems-projectiles skill. */
export type ProjectileTier = 'hitscan' | 'kinematic' | 'matter';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  description: string;
  // Stats
  damage: number;
  speed: number;
  cooldownMs: number;
  energyCost: number;
  ttl: number;
  size: number;
  color: number;
  // Pattern: how many bullets, spread angle (radians), knockback
  bulletsPerShot: number;
  spread: number;
  // Rocket explodes on impact
  explosive?: boolean;
  explosionRadius?: number;
  // Laser is a fast thin tracer
  isLaser?: boolean;
  /** Projectile tier: hitscan (instant ray) | kinematic (manual move) | matter (real body). */
  tier: ProjectileTier;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  plasma: {
    id: 'plasma',
    name: 'Plasma Rifle',
    description: 'Standard balanced energy weapon',
    damage: 18,
    speed: 13,
    cooldownMs: 140,
    energyCost: 3,
    ttl: 1400,
    size: 8,
    color: 0xfff04a,
    bulletsPerShot: 1,
    spread: 0,
    tier: 'kinematic',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Scatter Cannon',
    description: '5 pellets, wide spread, short range',
    damage: 10,
    speed: 11,
    cooldownMs: 480,
    energyCost: 8,
    ttl: 600,
    size: 6,
    color: 0xff8040,
    bulletsPerShot: 5,
    spread: 0.5,
    tier: 'kinematic',
  },
  laser: {
    id: 'laser',
    name: 'Laser Lance',
    description: 'Instant thin beam, high fire rate',
    damage: 14,
    speed: 30,
    cooldownMs: 90,
    energyCost: 4,
    ttl: 400,
    size: 4,
    color: 0xff40ff,
    bulletsPerShot: 1,
    spread: 0,
    isLaser: true,
    tier: 'hitscan',
  },
  rocket: {
    id: 'rocket',
    name: 'Rocket Launcher',
    description: 'Slow explosive missile, AoE damage',
    damage: 60,
    speed: 8,
    cooldownMs: 900,
    energyCost: 18,
    ttl: 2500,
    size: 14,
    color: 0xff5030,
    bulletsPerShot: 1,
    spread: 0,
    explosive: true,
    explosionRadius: 90,
    tier: 'matter',
  },
};

export const WEAPON_ORDER: WeaponId[] = ['plasma', 'shotgun', 'laser', 'rocket'];

/** Get weapon by id with safety fallback. */
export function getWeapon(id: WeaponId): WeaponDef {
  return WEAPONS[id] ?? WEAPONS.plasma;
}

/** Get next/prev weapon id in cycle. */
export function cycleWeapon(current: WeaponId, dir: 1 | -1): WeaponId {
  const idx = WEAPON_ORDER.indexOf(current);
  const next = (idx + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length;
  return WEAPON_ORDER[next];
}

export const WEAPON_COLORS: Record<WeaponId, number> = {
  plasma: COLORS.PROJECTILE,
  shotgun: 0xff8040,
  laser: 0xff40ff,
  rocket: 0xff5030,
};
