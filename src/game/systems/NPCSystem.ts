/**
 * MECHA: LAST PROTOCOL — NPC System
 * Manages NPC interactions, flag tracking, and dialogue triggering.
 * Reads NPCData from database. Flags persisted via SaveSystem.
 */
import { getNPC, getNPCsInArea } from '../data/npc/npcs';
import type { NPCData } from '../data/types';
import { SaveSystem } from '../systems/SaveSystem';
import { EventBus } from '../systems/EventBus';
import { QuestSystem } from '../systems/QuestSystem';

export class NPCSystem {
  /**
   * Get all NPCs in the current area.
   * Used by GameScene to spawn NPC sprites + interaction triggers.
   */
  static getNPCsInArea(areaId: string): NPCData[] {
    return getNPCsInArea(areaId);
  }

  /** Get a single NPC by ID. */
  static getNPC(id: string): NPCData | undefined {
    return getNPC(id);
  }

  /**
   * Check if an NPC flag is set (persisted in SaveSystem).
   * Examples: 'met', 'quest_given', 'quest_done'
   */
  static getFlag(npcId: string, flag: string): boolean {
    return SaveSystem.getNpcFlag(npcId, flag);
  }

  /** Set an NPC flag (persisted). */
  static setFlag(npcId: string, flag: string, value: boolean = true): void {
    SaveSystem.setNpcFlag(npcId, flag, value);
    EventBus.emit('DIALOGUE_END', { npcId, flag, value });
  }

  /**
   * Get the first available dialogue for an NPC.
   * Checks conditions in order — first matching dialogue wins.
   * Priority: quest_complete > quest_start > lore > intro > shop
   */
  static getActiveDialogue(npcId: string): string | null {
    const npc = getNPC(npcId);
    if (!npc) return null;

    // Priority order: quest completion > quest start > lore > intro > shop
    const priority = ['quest_complete', 'quest_start', 'lore', 'intro', 'shop'];

    // Fix: iterate PRIORITY first, then find matching dialogue
    for (const p of priority) {
      for (const dialogueId of npc.dialogues) {
        if (!dialogueId.includes(p)) continue;
        // Condition checks per priority type
        if (p === 'quest_complete' && !this.getFlag(npcId, 'quest_given')) continue;
        if (p === 'quest_start' && this.getFlag(npcId, 'quest_done')) continue;
        if (p === 'quest_start' && !this.getFlag(npcId, 'met')) continue;
        return dialogueId;
      }
    }

    // Fallback: first dialogue
    return npc.dialogues[0] ?? null;
  }

  /**
   * Interact with an NPC — triggers the active dialogue.
   * Called when player presses interact near an NPC.
   * Returns the dialogue ID to display, or null if no dialogue available.
   *
   * Quest wiring: when dialogue is quest_start, starts the quest.
   * When dialogue is quest_complete, turns in the quest.
   */
  static interact(npcId: string): string | null {
    const dialogueId = this.getActiveDialogue(npcId);
    if (!dialogueId) return null;

    // Mark as met
    if (!this.getFlag(npcId, 'met')) {
      this.setFlag(npcId, 'met', true);
    }

    // Quest wiring: start or complete quest based on dialogue type
    const npc = getNPC(npcId);
    if (npc?.questIds && npc.questIds.length > 0) {
      const questId = npc.questIds[0];
      if (dialogueId.includes('quest_start') && !this.getFlag(npcId, 'quest_given')) {
        QuestSystem.startQuest(questId);
        this.setFlag(npcId, 'quest_given', true);
      } else if (dialogueId.includes('quest_complete')) {
        const state = QuestSystem.getQuestState(questId);
        if (state?.status === 'completed') {
          QuestSystem.turnInQuest(questId);
          this.setFlag(npcId, 'quest_done', true);
        }
      }
    }

    EventBus.emit('DIALOGUE_START', { npcId, dialogueId });
    return dialogueId;
  }
}

export default NPCSystem;
