/**
 * MECHA: LAST PROTOCOL — Quest Database
 * Main story, side quests, hidden quests, NPC quests.
 * Objectives are data-driven: kill, collect, reach, talk, boss.
 */
import type { QuestData } from '../types';

export const QUESTS: Record<string, QuestData> = {
  quest_kill_drones: {
    id: 'quest_kill_drones',
    nameKey: 'quest.kill_drones.name',
    descriptionKey: 'quest.kill_drones.desc',
    type: 'npc',
    objectives: [
      { type: 'kill', target: 'drone', amount: 5 },
    ],
    rewardXp: 50,
    rewardItems: [{ itemId: 'circuit_board', amount: 2 }],
    prerequisiteQuestId: undefined,
  },
};

export function getQuest(id: string): QuestData | undefined {
  return QUESTS[id];
}

export function getAllQuests(): QuestData[] {
  return Object.values(QUESTS);
}
