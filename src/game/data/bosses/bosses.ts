/**
 * MECHA: LAST PROTOCOL — Boss Database
 */
import type { BossData } from '../types';

export const BOSSES: Record<string, BossData> = {
  guardian_ax09: {
    id: 'guardian_ax09',
    nameKey: 'boss.guardian_ax09.name',
    maxHealth: 1200,
    contactDamage: 28,
    phases: [
      { healthPct: 1.0, speed: 1.0, fireRateMs: 1800, attacks: ['shoot', 'lunge'] },
      { healthPct: 0.5, speed: 1.5, fireRateMs: 1100, attacks: ['shoot', 'lunge', 'teleport'] },
    ],
    lore: [
      'boss.guardian_ax09.lore.1',
      'boss.guardian_ax09.lore.2',
      'boss.guardian_ax09.lore.3',
    ],
    arenaWidth: 1280,
    arenaHeight: 720,
    musicTrack: 'boss_fight',
    drops: [
      { itemId: 'guardian_core', chance: 1.0, minAmount: 1, maxAmount: 1 },
      { itemId: 'scrap_metal', chance: 1.0, minAmount: 5, maxAmount: 10 },
    ],
  },
  neural_overseer: {
    id: 'neural_overseer',
    nameKey: 'boss.neural_overseer.name',
    maxHealth: 1800,
    contactDamage: 36,
    phases: [
      { healthPct: 1.0, speed: 1.5, fireRateMs: 1100, attacks: ['shoot', 'teleport'] },
      { healthPct: 0.5, speed: 2.0, fireRateMs: 750, attacks: ['shoot', 'lunge', 'teleport', 'beam'] },
    ],
    lore: [
      'boss.neural_overseer.lore.1',
      'boss.neural_overseer.lore.2',
      'boss.neural_overseer.lore.3',
    ],
    arenaWidth: 1280,
    arenaHeight: 720,
    musicTrack: 'boss_fight',
    drops: [
      { itemId: 'overseer_eye', chance: 1.0, minAmount: 1, maxAmount: 1 },
      { itemId: 'ai_chip', chance: 1.0, minAmount: 3, maxAmount: 5 },
    ],
  },
  leviathan_hulk: {
    id: 'leviathan_hulk',
    nameKey: 'boss.leviathan_hulk.name',
    maxHealth: 2400,
    contactDamage: 32,
    phases: [
      // Phase 1: Defensive — slow, protective. She's still "guarding."
      { healthPct: 1.0, speed: 0.7, fireRateMs: 2200, attacks: ['shoot', 'lunge'] },
      // Phase 2: Aggressive — the city is gone, she has nothing left to protect.
      { healthPct: 0.45, speed: 1.4, fireRateMs: 900, attacks: ['shoot', 'lunge', 'beam'] },
    ],
    lore: [
      'boss.leviathan_hulk.lore.1',
      'boss.leviathan_hulk.lore.2',
      'boss.leviathan_hulk.lore.3',
    ],
    arenaWidth: 1280,
    arenaHeight: 720,
    musicTrack: 'boss_fight',
    drops: [
      { itemId: 'leviathan_core', chance: 1.0, minAmount: 1, maxAmount: 1 },
      { itemId: 'armor_plate', chance: 1.0, minAmount: 3, maxAmount: 6 },
      { itemId: 'scrap_metal', chance: 1.0, minAmount: 5, maxAmount: 10 },
    ],
  },
  iron_magistrate: {
    id: 'iron_magistrate',
    nameKey: 'boss.iron_magistrate.name',
    maxHealth: 1600,
    contactDamage: 30,
    maxPosture: 130,  // Harder to stagger — "justice is rigid"
    phases: [
      // Phase 1: "The Verdict" — fixed sequential pattern, not random
      // Cycle: verdict_strike → scale_slam → verdict_strike → recover
      // Player learns the pattern after 1-2 cycles — that IS "justice": predictable, impartial
      {
        healthPct: 1.0, speed: 0.8, fireRateMs: 1200,
        attacks: ['lunge', 'shoot', 'lunge'],  // verdict=high-damage lunge, scale=shoot(AoE), verdict=lunge
        attackPattern: 'sequential',
      },
      // Phase 2: "No Exceptions" — faster cycle + judgment_beam added
      // Recovery 25% shorter, beam adds a gap-finding challenge
      {
        healthPct: 0.5, speed: 1.0, fireRateMs: 900,
        attacks: ['lunge', 'shoot', 'lunge', 'beam'],
        attackPattern: 'sequential',
      },
    ],
    lore: [
      'boss.iron_magistrate.lore.1',
      'boss.iron_magistrate.lore.2',
      'boss.iron_magistrate.lore.3',
    ],
    arenaWidth: 1280,
    arenaHeight: 720,
    musicTrack: 'boss_fight',
    drops: [
      // Iron Magistrate drops military_green paint (unlock path per advisor spec)
      { itemId: 'scrap_metal', chance: 1.0, minAmount: 5, maxAmount: 10 },
      { itemId: 'circuit_board', chance: 1.0, minAmount: 3, maxAmount: 5 },
      { itemId: 'armor_plate', chance: 1.0, minAmount: 2, maxAmount: 4 },
    ],
  },
};

export function getBoss(id: string): BossData {
  return BOSSES[id];
}
