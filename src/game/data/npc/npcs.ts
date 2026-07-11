/**
 * MECHA: LAST PROTOCOL — NPC Database
 * Each NPC has identity, dialogue refs, shop, quest refs, flags, lore.
 * Data-driven — adding a new NPC is just adding an entry here.
 */
import type { NPCData } from '../types';

export const NPCS: Record<string, NPCData> = {
  engineer_kara: {
    id: 'engineer_kara',
    nameKey: 'npc.engineer_kara.name',
    areaId: 'abandoned_factory',
    x: 5200,
    y: 600,
    dialogues: ['kara_intro', 'kara_quest_start', 'kara_quest_complete', 'kara_lore', 'kara_shop'],
    shopId: 'kara_shop',
    questIds: ['quest_kill_drones'],
    flags: { met: false, quest_given: false, quest_done: false },
  },
  ghost_operator: {
    id: 'ghost_operator',
    nameKey: 'npc.ghost_operator.name',
    areaId: 'abandoned_factory',
    x: 6200,
    y: 600,
    dialogues: ['ghost_intro', 'ghost_lore', 'ghost_warning'],
    flags: { met: false },
  },
};

export function getNPC(id: string): NPCData | undefined {
  return NPCS[id];
}

export function getNPCsInArea(areaId: string): NPCData[] {
  return Object.values(NPCS).filter(n => n.areaId === areaId);
}
