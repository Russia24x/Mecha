/**
 * MECHA: LAST PROTOCOL — Save Migration Script
 *
 * Migrates old localStorage saves (v2, v2_skills_v2, v3) to IndexedDB slot 0
 * with SaveData v4 schema.
 *
 * Migration rules (per Phase 0 audit):
 *   - If migration already done (ProfileManager.isMigrationDone()), skip.
 *   - If no old saves exist, skip (fresh user).
 *   - Read all 3 old keys, merge per conflict resolution table:
 *     * version: 3 → 4
 *     * totalKills: MAX(v2, v3, v2_skills_v2) — display only, no unlock gates
 *     * bossesKilled: MAX(v3, v2_skills_v2)
 *     * level, xp, skillPoints: v2_skills_v2 wins (HUD/gameplay uses these)
 *     * unlockedSkills: MERGE v3 + v2_skills_v2 (with ID remapping for old→new)
 *     * checkpoint: v3 wins, fall back to v2 if v3 missing
 *     * stages: v2 wins (unique data, ported to v4)
 *     * settings: v3 wins
 *     * bestBossTimes: v3 map wins, fall back to v2 single number
 *   - Write merged result to IndexedDB slot 0
 *   - Delete old localStorage keys
 *   - Mark migration done
 *
 * Idempotent: safe to call multiple times.
 */

import { ProfileManager, DEFAULT_SAVE, DEFAULT_PLAYER, DEFAULT_SETTINGS } from './ProfileManager';
import { ProfileDB, type SlotId } from './ProfileDB';
import type { SaveData, GameSettings, PlayerState, CheckpointData, InventoryItem } from '../data/types';
import type { StageProgress } from './ProfileManager';

// Old localStorage keys (from Phase 0 audit)
const OLD_KEY_V2 = 'mecha_last_protocol_save_v2';
const OLD_KEY_V2_SKILLS = 'mecha_last_protocol_save_v2_skills_v2';
const OLD_KEY_V3 = 'mecha_last_protocol_save_v3';

// Skill ID migration table (old SKILL_DEFS → new data/skills/skills.ts)
const SKILL_ID_MIGRATIONS: Record<string, string> = {
  'mobility.speed1': 'movement.speed1',
  'mobility.speed2': 'movement.speed2',
  'mobility.dashCd1': 'movement.dashCd1',
  'mobility.doubleJump': 'movement.doubleJump',
  'survival.energy1': 'energy.max1',
  'survival.regen1': 'energy.regen1',
  // 'combat.melee1' has no equivalent in new tree — dropped (had no gameplay effect anyway)
};

/** Migrate a single old skill ID to the new schema. Returns null if dropped. */
function migrateSkillId(oldId: string): string | null {
  // Check explicit migration table first (handles mobility→movement, survival→energy)
  if (SKILL_ID_MIGRATIONS[oldId]) {
    return SKILL_ID_MIGRATIONS[oldId];
  }
  // IDs that start with old prefixes but aren't in the table are dropped
  if (oldId.startsWith('mobility.') || oldId.startsWith('survival.')) {
    return null;
  }
  // 'combat.melee1' has no equivalent in the new tree — explicitly drop
  if (oldId === 'combat.melee1') {
    return null;
  }
  // Otherwise assume it's already a new-format ID (e.g. 'combat.damage1', 'movement.speed2')
  return oldId;
}

/** Read and parse an old localStorage key. Returns null if missing or unparseable. */
function readOldKey<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Delete an old localStorage key. */
function deleteOldKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ── Old save shapes (from Phase 0 audit) ──

interface OldSaveV2 {
  version: number;
  lastCheckpoint: CheckpointData | null;
  bestBossTimeMs: number | null;
  totalKills: number;
  stages: Record<number, StageProgress>;
  settings: {
    lang: 'en' | 'fa';
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    muted: boolean;
    brightness: number;
  };
}

interface OldSaveV2Skills {
  unlocked: string[];
  level: number;
  xp: number;
  skillPoints: number;
  totalKills: number;
  bossesKilled: number;
}

interface OldSaveV3 {
  version: number;
  player: PlayerState;
  checkpoint: CheckpointData | null;
  bestBossTimes: Record<string, number>;
  settings: GameSettings;
  questFlags: Record<string, boolean>;
  questProgress: Record<string, number[]>;
  npcFlags: Record<string, Record<string, boolean>>;
  unlockedAreas: string[];
  discoveredAreas: string[];
}

/**
 * Run the migration. Safe to call multiple times.
 * Returns true if migration was performed, false if skipped (already done or no old saves).
 */
export async function migrateOldSaves(): Promise<boolean> {
  // Check if already migrated
  if (await ProfileManager.isMigrationDone()) {
    return false;
  }

  // Read all 3 old keys
  const v2 = readOldKey<OldSaveV2>(OLD_KEY_V2);
  const v2Skills = readOldKey<OldSaveV2Skills>(OLD_KEY_V2_SKILLS);
  const v3 = readOldKey<OldSaveV3>(OLD_KEY_V3);

  // If none exist, no migration needed
  if (!v2 && !v2Skills && !v3) {
    // Mark as done so we don't check again
    await ProfileManager.markMigrationDone();
    return false;
  }

  // ── Merge per conflict resolution table ──

  // Start with v3 as the base (most complete)
  const base: SaveData & { stages: Record<number, StageProgress> } = {
    version: 4,
    player: v3 ? { ...DEFAULT_PLAYER, ...v3.player } : { ...DEFAULT_PLAYER },
    checkpoint: v3?.checkpoint ?? v2?.lastCheckpoint ?? null,
    bestBossTimes: v3?.bestBossTimes ?? {},
    settings: v3 ? { ...DEFAULT_SETTINGS, ...v3.settings } : { ...DEFAULT_SETTINGS },
    questFlags: v3?.questFlags ?? {},
    questProgress: v3?.questProgress ?? {},
    npcFlags: v3?.npcFlags ?? {},
    unlockedAreas: v3?.unlockedAreas ?? [...DEFAULT_SAVE.unlockedAreas],
    discoveredAreas: v3?.discoveredAreas ?? [],
    stages: v2?.stages ?? {},
  };

  // ── totalKills: MAX of all three ──
  const v2Kills = v2?.totalKills ?? 0;
  const v3Kills = v3?.player.totalKills ?? 0;
  const v2SkillsKills = v2Skills?.totalKills ?? 0;
  base.player.totalKills = Math.max(v2Kills, v3Kills, v2SkillsKills);

  // ── bossesKilled: MAX(v3, v2_skills_v2) ──
  const v3Bosses = v3?.player.bossesKilled ?? 0;
  const v2SkillsBosses = v2Skills?.bossesKilled ?? 0;
  base.player.bossesKilled = Math.max(v3Bosses, v2SkillsBosses);

  // ── level, xp, skillPoints: v2_skills_v2 wins (HUD/gameplay uses these) ──
  if (v2Skills) {
    base.player.level = v2Skills.level;
    base.player.xp = v2Skills.xp;
    base.player.skillPoints = v2Skills.skillPoints;
  }

  // ── unlockedSkills: MERGE v3 + v2_skills_v2 (with ID remapping) ──
  const mergedSkills = new Set<string>();
  // Add v3 skills (already new-format IDs)
  if (v3?.player.unlockedSkills) {
    for (const skillId of v3.player.unlockedSkills) {
      mergedSkills.add(skillId);
    }
  }
  // Add v2_skills_v2 skills (with remapping)
  if (v2Skills?.unlocked) {
    for (const oldSkillId of v2Skills.unlocked) {
      const newId = migrateSkillId(oldSkillId);
      if (newId) {
        mergedSkills.add(newId);
      }
      // If newId is null (e.g. 'combat.melee1'), the skill is dropped — it had
      // no gameplay effect anyway (stat computation reads v3, not v2_skills_v2).
    }
  }
  base.player.unlockedSkills = [...mergedSkills];

  // ── bestBossTimes: v3 map wins; fall back to v2 single number ──
  if ((!v3 || Object.keys(v3.bestBossTimes ?? {}).length === 0) && v2?.bestBossTimeMs) {
    // v3 had no per-boss times, but v2 has a single best time — put it under a generic key
    base.bestBossTimes['migrated_v2'] = v2.bestBossTimeMs;
  }

  // ── stages: v2 wins (unique data) ──
  if (v2?.stages) {
    base.stages = v2.stages;
  }

  // ── Write merged result to IndexedDB slot 0 ──
  const slotId: SlotId = 0;
  const existingProfile = await ProfileDB.readProfile(slotId);

  // Only write if slot 0 is empty OR has an older version
  if (!existingProfile || (existingProfile.saveData as { version?: number }).version !== 4) {
    await ProfileDB.writeProfile(slotId, base, existingProfile?.displayName ?? 'PILOT 01');
  }

  // ── Delete old localStorage keys ──
  deleteOldKey(OLD_KEY_V2);
  deleteOldKey(OLD_KEY_V2_SKILLS);
  deleteOldKey(OLD_KEY_V3);

  // ── Mark migration done ──
  await ProfileManager.markMigrationDone();

  console.log('[migrateOldSaves] Migration complete:', {
    v2Present: !!v2,
    v2SkillsPresent: !!v2Skills,
    v3Present: !!v3,
    mergedSkills: base.player.unlockedSkills.length,
    totalKills: base.player.totalKills,
    bossesKilled: base.player.bossesKilled,
    level: base.player.level,
    stages: Object.keys(base.stages).length,
  });

  return true;
}

export default migrateOldSaves;
