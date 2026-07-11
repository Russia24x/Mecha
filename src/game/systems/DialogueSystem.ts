/**
 * MECHA: LAST PROTOCOL — Dialogue System
 * Branching dialogue with conditions and flag-setting.
 * All text loaded from localization (EN/FA).
 * Supports: normal, quest, boss, hidden dialogue types.
 */
import { getDialogue, getDialoguesForNPC } from '../data/dialogue/dialogues';
import type { DialogueData } from '../data/types';
import { t, getLocale } from './LocalizationSystem';
import { NPCSystem } from './NPCSystem';
import { EventBus } from './EventBus';
import type { Locale } from '../data/types';

export interface DialogueLine {
  text: string;        // localized text
  speakerName: string; // localized NPC name
  isLast: boolean;
}

export class DialogueSystem {
  private static currentDialogue: DialogueData | null = null;
  private static currentLineIndex = 0;
  private static _isActive = false;

  /**
   * Start a dialogue by ID.
   * Checks conditionFlag — if condition not met, returns false.
   * Sets setFlag on start.
   */
  static start(dialogueId: string): boolean {
    const dialogue = getDialogue(dialogueId);
    if (!dialogue) return false;

    // Check condition flag
    if (dialogue.conditionFlag && !NPCSystem.getFlag(dialogue.npcId, dialogue.conditionFlag)) {
      return false;
    }

    this.currentDialogue = dialogue;
    this.currentLineIndex = 0;
    this._isActive = true;

    // Set flag (e.g., 'met', 'quest_given')
    if (dialogue.setFlag) {
      NPCSystem.setFlag(dialogue.npcId, dialogue.setFlag, true);
    }

    EventBus.emit('DIALOGUE_START', { npcId: dialogue.npcId, dialogueId });
    return true;
  }

  /** Get the current dialogue line (localized). */
  static getCurrentLine(): DialogueLine | null {
    if (!this.currentDialogue || !this.isActive) return null;
    const lineKey = this.currentDialogue.lines[this.currentLineIndex];
    if (!lineKey) return null;
    const npc = NPCSystem.getNPC(this.currentDialogue.npcId);
    return {
      text: t(lineKey),
      speakerName: npc ? t(npc.nameKey) : '???',
      isLast: this.currentLineIndex >= this.currentDialogue.lines.length - 1,
    };
  }

  /** Advance to next line. Returns false if dialogue ended. */
  static advance(): boolean {
    if (!this.currentDialogue || !this.isActive) return false;
    this.currentLineIndex++;
    if (this.currentLineIndex >= this.currentDialogue.lines.length) {
      this.end();
      return false;
    }
    return true;
  }

  /** End the current dialogue. */
  static end(): void {
    if (!this.currentDialogue) return;
    const npcId = this.currentDialogue.npcId;
    const dialogueId = this.currentDialogue.id;
    this.currentDialogue = null;
    this.currentLineIndex = 0;
    this._isActive = false;
    EventBus.emit('DIALOGUE_END', { npcId, dialogueId });
  }

  /** Check if dialogue is currently active. */
  static get isActive(): boolean { return this._isActive; }

  /** Get all dialogues for an NPC (for debugging/UI). */
  static getDialoguesForNPC(npcId: string): DialogueData[] {
    return getDialoguesForNPC(npcId);
  }

  /** Get current locale for UI rendering direction (RTL for FA). */
  static getLocale(): Locale { return getLocale(); }

  /** Check if current locale is RTL (Persian). */
  static isRTL(): boolean { return getLocale() === 'fa'; }
}

export default DialogueSystem;
