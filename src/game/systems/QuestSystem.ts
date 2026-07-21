/**
 * MECHA: LAST PROTOCOL — Quest System
 * Manages quest state: not_started → active → completed → turned_in.
 */
import { getQuest, getAllQuests } from '../data/quests/quests';
import type { QuestData } from '../data/types';
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
  private static enemyHandler: ((payload: unknown) => void) | null = null;
  private static itemHandler: ((payload: unknown) => void) | null = null;
  private static bossHandler: ((payload: unknown) => void) | null = null;

  /** Reset quest system — called on New Game to clear all quest state. */
  static reset(): void {
    // Unsubscribe old listeners to prevent double-firing
    if (this.enemyHandler) { EventBus.off('ENEMY_DEAD', this.enemyHandler); this.enemyHandler = null; }
    if (this.itemHandler) { EventBus.off('ITEM_COLLECTED', this.itemHandler); this.itemHandler = null; }
    if (this.bossHandler) { EventBus.off('BOSS_DEAD', this.bossHandler); this.bossHandler = null; }
    this.quests.clear();
    this.initialized = false;
  }

  /** Initialize quest system — load state from save + subscribe to events. */
  static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Load quest flags + progress from save
    for (const quest of getAllQuests()) {
      const turnedIn = SaveSystem.getQuestFlag(quest.id);
      const savedProgress = SaveSystem.getQuestProgress(quest.id);
      this.quests.set(quest.id, {
        questId: quest.id,
        status: turnedIn ? 'turned_in' : 'not_started',
        progress: savedProgress ?? quest.objectives.map(() => 0),
      });
    }

    // Subscribe to events for objective tracking (store handlers for cleanup)
    this.enemyHandler = (payload) => {
      this.onEnemyKilled((payload as { id: string }).id);
    };
    this.itemHandler = (payload) => {
      this.onItemCollected((payload as { itemId: string; amount: number }).itemId,
                           (payload as { amount: number }).amount);
    };
    this.bossHandler = (payload) => {
      this.onBossKilled((payload as { id: string }).id);
    };
    EventBus.on('ENEMY_DEAD', this.enemyHandler);
    EventBus.on('ITEM_COLLECTED', this.itemHandler);
    EventBus.on('BOSS_DEAD', this.bossHandler);
  }

  /** Start a quest (returns true if successful). */
  static startQuest(questId: string): boolean {
    const quest = getQuest(questId);
    if (!quest) return false;
    const state = this.quests.get(questId);
    if (!state || state.status !== 'not_started') return false;
    state.status = 'active';
    EventBus.emit('QUEST_UPDATED', { questId, status: 'active' });
    return true;
  }

  /** Turn in a completed quest (returns true if successful). */
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
      }
    }

    EventBus.emit('QUEST_UPDATED', { questId, status: 'turned_in' });
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

  /** Get progress array for a quest. */
  static getProgress(questId: string): number[] {
    return this.quests.get(questId)?.progress ?? [];
  }

  // ─── Event Handlers ──────────────────────────────────────────────

  private static onEnemyKilled(enemyId: string): void {
    // Extract enemy type from ID (e.g., 'drone-3' → 'drone')
    const enemyType = enemyId.split('-')[0];
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
      SaveSystem.setQuestProgress(questId, state.progress);
      if (allComplete && state.status === 'active') {
        state.status = 'completed';
        EventBus.emit('QUEST_UPDATED', { questId, status: 'completed' });
      }
    }
  }
}

export default QuestSystem;
