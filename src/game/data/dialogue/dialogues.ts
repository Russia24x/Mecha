/**
 * MECHA: LAST PROTOCOL — Dialogue Database
 * Branching dialogue with conditions and flag-setting.
 * All text is localization keys — no hardcoded strings.
 * Dialogue nodes reference NPC IDs and condition/set flags.
 */
import type { DialogueData } from '../types';

export const DIALOGUES: Record<string, DialogueData> = {
  // ─── Engineer Kara ───
  kara_intro: {
    id: 'kara_intro',
    type: 'normal',
    npcId: 'engineer_kara',
    lines: ['dialogue.kara_intro.1', 'dialogue.kara_intro.2', 'dialogue.kara_intro.3'],
    setFlag: 'met',
  },
  kara_quest_start: {
    id: 'kara_quest_start',
    type: 'quest',
    npcId: 'engineer_kara',
    lines: ['dialogue.kara_quest_start.1'],
    conditionFlag: 'met',        // must have met Kara first
    setFlag: 'quest_given',
  },
  kara_quest_complete: {
    id: 'kara_quest_complete',
    type: 'quest',
    npcId: 'engineer_kara',
    lines: ['dialogue.kara_quest_complete.1'],
    conditionFlag: 'quest_given', // only after quest given
    setFlag: 'quest_done',
  },
  kara_lore: {
    id: 'kara_lore',
    type: 'normal',
    npcId: 'engineer_kara',
    lines: ['dialogue.kara_lore.1', 'dialogue.kara_lore.2'],
    conditionFlag: 'met',
  },
  kara_shop: {
    id: 'kara_shop',
    type: 'normal',
    npcId: 'engineer_kara',
    lines: ['dialogue.kara_shop.1'],
    conditionFlag: 'met',
  },

  // ─── Ghost Operator ───
  ghost_intro: {
    id: 'ghost_intro',
    type: 'normal',
    npcId: 'ghost_operator',
    lines: ['dialogue.ghost_intro.1', 'dialogue.ghost_intro.2'],
    setFlag: 'met',
  },
  ghost_lore: {
    id: 'ghost_lore',
    type: 'normal',
    npcId: 'ghost_operator',
    lines: ['dialogue.ghost_lore.1', 'dialogue.ghost_lore.2'],
    conditionFlag: 'met',
  },
  ghost_warning: {
    id: 'ghost_warning',
    type: 'normal',
    npcId: 'ghost_operator',
    lines: ['dialogue.ghost_warning.1'],
    conditionFlag: 'met',
  },
};

export function getDialogue(id: string): DialogueData | undefined {
  return DIALOGUES[id];
}

export function getDialoguesForNPC(npcId: string): DialogueData[] {
  return Object.values(DIALOGUES).filter(d => d.npcId === npcId);
}
