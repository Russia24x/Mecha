/**
 * MECHA: LAST PROTOCOL — Companion Database
 *
 * Companions are AI assistants that follow the player.
 * Architecture is built for future expansion — currently only Protocol Echo
 * is defined (but locked). Future companions: Scout/Repair/Scanner/Shield/Medic/Cargo.
 *
 * Per user's vision:
 *   "Protocol Echo" is not just a drone — it's a story entity.
 *   Starts as a small dark orb → grows with the story → eventually revealed as
 *   the last fragment of the Last Protocol.
 *
 * The CompanionSystem (separate file) handles the follow/hover/assist AI.
 * This file only defines the data.
 */
import type { CompanionId, CompanionData } from '../types';

export const COMPANIONS: Record<CompanionId, CompanionData> = {
  protocol_echo: {
    id: 'protocol_echo',
    nameKey: 'companion.protocol_echo.name',
    descKey: 'companion.protocol_echo.desc',
    category: 'story',
    color: 0x66f0ff,
    unlockedByDefault: false,  // locked — unlocked by story progress (future)
  },
  scout_drone: {
    id: 'scout_drone',
    nameKey: 'companion.scout_drone.name',
    descKey: 'companion.scout_drone.desc',
    category: 'utility',
    color: 0x39d0d8,
    unlockedByDefault: false,
  },
  repair_drone: {
    id: 'repair_drone',
    nameKey: 'companion.repair_drone.name',
    descKey: 'companion.repair_drone.desc',
    category: 'support',
    color: 0x40ff80,
    unlockedByDefault: false,
  },
  scanner_drone: {
    id: 'scanner_drone',
    nameKey: 'companion.scanner_drone.name',
    descKey: 'companion.scanner_drone.desc',
    category: 'utility',
    color: 0xffc040,
    unlockedByDefault: false,
  },
  shield_drone: {
    id: 'shield_drone',
    nameKey: 'companion.shield_drone.name',
    descKey: 'companion.shield_drone.desc',
    category: 'support',
    color: 0x4090ff,
    unlockedByDefault: false,
  },
  medic_drone: {
    id: 'medic_drone',
    nameKey: 'companion.medic_drone.name',
    descKey: 'companion.medic_drone.desc',
    category: 'support',
    color: 0xff6080,
    unlockedByDefault: false,
  },
  cargo_drone: {
    id: 'cargo_drone',
    nameKey: 'companion.cargo_drone.name',
    descKey: 'companion.cargo_drone.desc',
    category: 'utility',
    color: 0xc060ff,
    unlockedByDefault: false,
  },
};

export function getCompanion(id: CompanionId): CompanionData {
  return COMPANIONS[id];
}

export function getAllCompanions(): CompanionData[] {
  return Object.values(COMPANIONS);
}
