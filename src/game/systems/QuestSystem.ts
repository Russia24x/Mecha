/**
 * MECHA: LAST PROTOCOL — Quest System
 * Manages quest state: not_started → active → completed → turned_in.
 * Objectives tracked via EventBus events (ENEMY_DEAD, ITEM_COLLECTED, etc).
 * Rewards dispensed on turn-in: XP + items.
 */
import { getQuest, getAllQuests } from '../data/quests/quests';
import type { QuestData, QuestObjective } from '../data/types';
import { SaveSystem } from './SaveSystem';
import { EventBus } from './EventBus';
import { AudioSystem } from './AudioSystem';

export type QuestStatus = 'not_started' | 'active' | 'completed' | 'turned_in';

export interface QuestState {
  questId: string;
  status: QuestStatus;
  progress: number[];   // progress per objective
}

export class QuestSystem {
  private static quests: Map<string, QuestState> = new Map();
  private static initialized = false;

  /** Reset quest system — called on New Game to clear all quest state. */
  static reset(): void {
    this.quests.clear();
    this.initialized = false;
  }

  /** Initialize quest system — load state from save + subscribe to events. */
  static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Load quest flags + progress from save (N2 fix: persist progress)
    for (const quest of getAllQuests()) {
      const turnedIn = SaveSystem.getQuestFlag(quest.id);
      const savedProgress = SaveSystem.getQuestProgress(quest.id);
      this.quests.set(quest.id, {
        questId: quest.id,
        status: turnedIn ? 'turned_in' : 'not_started',
        progress: savedProgress ?? quest.objectives.map(() => 0),
      });
    }

    // Subscribe to events for objective tracking
    EventBus.on('ENEMY_DEAD', (payload) => {
      this.onEnemyKilled((payload as { id: string }).id);
    });
    EventBus.on('ITEM_COLLECTED', (payload) => {
      this.onItemCollected((payload as { itemId: string; amount: number }).itemId,
                           (payload as { itemId: string; amount: number }).amount);
    });
    EventBus.on('BOSS_DEAD', (payload) => {
      this.onBossKilled((payload as { id: string }).id);
    });
  }

  /** Start a quest (NPC gives quest). */
  static startQuest(questId: string): boolean {
    const quest = getQuest(questId);
    if (!quest) return false;
    const state = this.quests.get(questId);
    if (!state || state.status !== 'not_started') return false;
    state.status = 'active';
    EventBus.emit('QUEST_UPDATED', { questId, status: 'active' });
    return true;
  }

  /** Check if quest prerequisites are met. */
  static canStart(questId: string): boolean {
    const quest = getQuest(questId);
    if (!quest) return false;
    if (quest.prerequisiteQuestId) {
      const prereq = this.quests.get(quest.prerequisiteQuestId);
      if (!prereq || prereq.status !== 'turned_in') return false;
    }
    const state = this.quests.get(questId);
    return state?.status === 'not_started';
  }

  /** Turn in a quest (NPC completes quest) — dispenses rewards. */
  static turnInQuest(questId: string): boolean {
    const quest = getQuest(questId);
    if (!quest) return false;
    const state = this.quests.get(questId);
    if (!state || state.status !== 'completed') return false;

    state.status = 'turned_in';
    SaveSystem.setQuestFlag(questId, true);

    // Dispense rewards
    if (quest.rewardXp > 0) {
      const result = SaveSystem.awardXp(quest.rewardXp);
      if (result.leveledUp) {
        EventBus.emit('LEVEL_UP', { level: result.newLevel });
        AudioSystem.play('levelUp');
      }
    }
    if (quest.rewardItems) {
      for (const item of quest.rewardItems) {
        SaveSystem.addItem(item.itemId, item.amount);
        EventBus.emit('ITEM_COLLECTED', { itemId: item.itemId, amount: item.amount });
      }
    }

    EventBus.emit('QUEST_COMPLETE', { questId });
    return true;
  }

  /** Get quest status. */
  static getStatus(questId: string): QuestStatus {
    return this.quests.get(questId)?.status ?? 'not_started';
  }

  /** Get full quest state (for NPCSystem to check completion before turn-in). */
  static getQuestState(questId: string): QuestState | undefined {
    return this.quests.get(questId);
  }

  /** Get all active quests. */
  static getActiveQuests(): QuestData[] {
    return getAllQuests().filter(q => this.quests.get(q.id)?.status === 'active');
  }

  /** Get all completed (ready to turn in) quests. */
  static getCompletedQuests(): QuestData[] {
    return getAllQuests().filter(q => this.quests.get(q.id)?.status === 'completed');
  }

  /** Get all turned-in quests. */
  static getTurnedInQuests(): QuestData[] {
    return getAllQuests().filter(q => this.quests.get(q.id)?.status === 'turned_in');
  }

  /** Get progress for a quest (array of numbers, one per objective). */
  static getProgress(questId: string): number[] {
    return this.quests.get(questId)?.progress ?? [];
  }

  // ─── Event Handlers ───

  private static onEnemyKilled(enemyId: string): void {
    const enemyType = enemyId.split('-')[0]; // e.g., 'drone-1' → 'drone'
    this.updateObjectives('kill', enemyType, 1);
  }

  private static onItemCollected(itemId: string, amount: number): void {
    this.updateObjectives('collect', itemId, amount);
  }

  private static onBossKilled(bossId: string): void {
    this.updateObjectives('boss', bossId, 1);
  }

  private static updateObjectives(type: string, target: string, amount: number): void {
    for (const [questId, state] of this.quests) {
      if (state.status !== 'active') continue;
      const quest = getQuest(questId);
      if (!quest) continue;
      let allComplete = true;
      for (let i = 0; i < quest.objectives.length; i++) {
        const obj = quest.objectives[i];
        if (obj.type === type && obj.target === target) {
          state.progress[i] = Math.min(state.progress[i] + amount, obj.amount);
        }
        if (state.progress[i] < obj.amount) allComplete = false;
      }
      // N2 fix: persist quest progress to save
      SaveSystem.setQuestProgress(questId, state.progress);
      if (allComplete && state.status === 'active') {
        state.status = 'completed';
        EventBus.emit('QUEST_UPDATED', { questId, status: 'completed' });
      }
    }
  }
}

export default QuestSystem;
