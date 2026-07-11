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
};

export function getBoss(id: string): BossData {
  return BOSSES[id];
}
