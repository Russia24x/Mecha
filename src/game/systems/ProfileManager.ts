/**
 * MECHA: LAST PROTOCOL — ProfileManager
 *
 * Lifecycle management for save profile slots.
 *
 * Responsibilities:
 *   - Create a new profile in an empty slot (with default SaveData v4)
 *   - Select the active profile slot
 *   - Delete a profile slot
 *   - List existing profiles (for UI display)
 *   - Persist the currently-selected slot ID in the global store
 *
 * NOT responsibilities (handled elsewhere):
 *   - Actual save/load of SaveData cache → SaveSystem (Phase 3 façade)
 *   - IndexedDB I/O → ProfileDB
 *   - Auto-save scheduling → AutoSaveManager (Phase 4)
 *
 * Concurrency:
 *   - All async methods await their ProfileDB calls.
 *   - Callers MUST serialize: don't call createProfile() twice in parallel.
 *   - The `currentSlotId` is kept in-memory (set on init) and persisted to
 *     ProfileDB global store on every change.
 */

import { ProfileDB, MAX_PROFILES, type SlotId, type ProfileRecord } from './ProfileDB';
import type { SaveData, GameSettings, PlayerState } from '../data/types';

const GLOBAL_KEY_SELECTED_SLOT = 'selectedSlot';
const GLOBAL_KEY_MIGRATION_DONE = 'migrationDone';

// ── SaveData v4 defaults ──
// NOTE: This is the SINGLE source of truth for SaveData v4 shape.
// Phase 3 SaveSystem façade will import this default instead of having its own.
// `stages` field is NEW in v4 — ported from old shared/Save.ts to preserve
// stage completion data after migration.

export interface StageProgress {
  completed: boolean;
  bestTimeMs: number | null;
}

export const SAVE_VERSION = 4;

export const DEFAULT_SETTINGS: GameSettings = {
  locale: 'en',
  masterVolume: 0.7,
  musicVolume: 0.4,
  sfxVolume: 0.8,
  muted: false,
  brightness: 0.85,
  quality: 'high',
  fullscreen: false,
};

export const DEFAULT_PLAYER: PlayerState = {
  level: 1,
  xp: 0,
  skillPoints: 0,
  totalKills: 0,
  bossesKilled: 0,
  unlockedSkills: [],
  unlockedWeapons: ['assault_rifle'],
  currentWeapon: 'assault_rifle',
  weaponLevels: { assault_rifle: 1 },
  inventory: [],
  abilities: [],
  collectedCollectibles: [],
  openedShortcuts: [],
  selectedChassis: 'assault',
  selectedPaint: 'factory_gray',
  unlockedChassis: ['scout', 'assault', 'titan'],
  unlockedPaints: ['factory_gray'],
  unlockedCompanions: [],
  selectedCompanion: null,
};

export const DEFAULT_SAVE: SaveData & { stages: Record<number, StageProgress> } = {
  version: SAVE_VERSION,
  player: { ...DEFAULT_PLAYER },
  checkpoint: null,
  bestBossTimes: {},
  settings: { ...DEFAULT_SETTINGS },
  questFlags: {},
  questProgress: {},
  npcFlags: {},
  unlockedAreas: ['abandoned_factory', 'toxic_forest'],
  discoveredAreas: [],
  // NEW in v4 — ported from shared/Save.ts (was unique to v2 localStorage)
  stages: {},
};

// ── Manager ──

export interface ProfileSummary {
  slotId: SlotId;
  displayName: string;
  createdAt: string;
  lastSavedAt: string;
  /** Player level for display in the slot list. */
  level: number;
  /** Whether this slot has a checkpoint (Continue is available). */
  hasCheckpoint: boolean;
  /** Total kills for display. */
  totalKills: number;
}

// In-memory state for ProfileManager.
// Kept as a module-private variable (not exported) so it can't be mutated
// from outside this module. All mutations go through the methods below.
const state: {
  currentSlotId: SlotId | null;
  initialized: boolean;
} = {
  currentSlotId: null,
  initialized: false,
};

export const ProfileManager = {
  // ── Lifecycle ──

  /**
   * Initialize the manager. MUST be called once on game boot (before any
   * other ProfileManager or SaveSystem call).
   *
   * Reads the persisted `selectedSlot` from the global store. If the stored
   * slot no longer exists (e.g. profile was deleted in another tab), resets
   * to null.
   *
   * Returns the currently-selected slot ID (or null).
   */
  async init(): Promise<SlotId | null> {
    if (state.initialized) return state.currentSlotId;

    if (!ProfileDB.isAvailable()) {
      // IndexedDB unavailable — fail gracefully. SaveSystem will fall back
      // to in-memory-only mode (no persistence).
      state.initialized = true;
      state.currentSlotId = null;
      return null;
    }

    const stored = await ProfileDB.readGlobal<SlotId>(GLOBAL_KEY_SELECTED_SLOT);
    if (stored !== undefined && stored !== null) {
      // Validate the slot still exists
      const profile = await ProfileDB.readProfile(stored);
      if (profile) {
        state.currentSlotId = stored;
      } else {
        // Stale reference — clean up
        await ProfileDB.deleteGlobal(GLOBAL_KEY_SELECTED_SLOT);
        state.currentSlotId = null;
      }
    }
    state.initialized = true;
    return state.currentSlotId;
  },

  /** Get the currently-selected slot ID (or null if none selected). */
  getCurrentSlotId(): SlotId | null {
    return state.currentSlotId;
  },

  /** Whether init() has been called. */
  isInitialized(): boolean {
    return state.initialized;
  },

  // ── Slot operations ──

  /**
   * Create a new profile in the first available empty slot.
   *
   * @param displayName Optional display name. Defaults to "PILOT 01" etc.
   * @returns The slot ID of the newly-created profile.
   * @throws Error if all slots are full.
   */
  async createProfile(displayName?: string): Promise<SlotId> {
    const existing = await ProfileDB.listProfiles();
    const existingSet = new Set(existing);
    let slotId: SlotId | null = null;
    for (let i = 0; i < MAX_PROFILES; i++) {
      if (!existingSet.has(i as SlotId)) {
        slotId = i as SlotId;
        break;
      }
    }
    if (slotId === null) {
      throw new Error(`All ${MAX_PROFILES} profile slots are full`);
    }
    const name = displayName ?? `PILOT ${(slotId + 1).toString().padStart(2, '0')}`;
    // Deep-copy the default save (so each profile has its own arrays/objects)
    const saveData: SaveData & { stages: Record<number, StageProgress> } = {
      ...DEFAULT_SAVE,
      player: { ...DEFAULT_PLAYER },
      settings: { ...DEFAULT_SETTINGS },
      bestBossTimes: {},
      questFlags: {},
      questProgress: {},
      npcFlags: {},
      unlockedAreas: [...DEFAULT_SAVE.unlockedAreas],
      discoveredAreas: [],
      stages: {},
    };
    await ProfileDB.writeProfile(slotId, saveData, name);
    return slotId;
  },

  /**
   * Select a profile slot as the active one.
   * The slot must exist.
   * Persists the selection to the global store.
   */
  async selectSlot(slotId: SlotId): Promise<void> {
    const profile = await ProfileDB.readProfile(slotId);
    if (!profile) {
      throw new Error(`Cannot select slot ${slotId}: does not exist`);
    }
    state.currentSlotId = slotId;
    await ProfileDB.writeGlobal(GLOBAL_KEY_SELECTED_SLOT, slotId);
  },

  /**
   * Deselect the current profile (without deleting it).
   * Used when returning to the main menu / profile-select screen.
   */
  async clearSelection(): Promise<void> {
    state.currentSlotId = null;
    await ProfileDB.deleteGlobal(GLOBAL_KEY_SELECTED_SLOT);
  },

  /**
   * Delete a profile slot.
   * If the deleted slot was the current one, clears the selection.
   */
  async deleteProfile(slotId: SlotId): Promise<void> {
    await ProfileDB.deleteProfile(slotId);
    if (state.currentSlotId === slotId) {
      state.currentSlotId = null;
      await ProfileDB.deleteGlobal(GLOBAL_KEY_SELECTED_SLOT);
    }
  },

  /**
   * Rename a profile slot's display name.
   */
  async renameProfile(slotId: SlotId, newName: string): Promise<void> {
    const profile = await ProfileDB.readProfile(slotId);
    if (!profile) {
      throw new Error(`Cannot rename slot ${slotId}: does not exist`);
    }
    await ProfileDB.writeProfile(slotId, profile.saveData, newName);
  },

  // ── Queries ──

  /**
   * List all existing profiles as summaries (for UI display).
   * Empty slots are not included.
   */
  async listProfiles(): Promise<ProfileSummary[]> {
    const records = await ProfileDB.readAllProfiles();
    return records.map(rec => {
      const save = rec.saveData as SaveData & { stages?: Record<number, StageProgress> };
      return {
        slotId: rec.slotId,
        displayName: rec.displayName,
        createdAt: rec.createdAt,
        lastSavedAt: rec.lastSavedAt,
        level: save?.player?.level ?? 1,
        hasCheckpoint: save?.checkpoint !== null && save?.checkpoint !== undefined,
        totalKills: save?.player?.totalKills ?? 0,
      };
    });
  },

  /**
   * Get the full SaveData for a slot (without selecting it).
   * Used by SaveSystem to load the cache on slot selection.
   */
  async readProfileData(slotId: SlotId): Promise<(SaveData & { stages: Record<number, StageProgress> }) | null> {
    const rec = await ProfileDB.readProfile(slotId);
    if (!rec) return null;
    return rec.saveData as SaveData & { stages: Record<number, StageProgress> };
  },

  /**
   * Write SaveData to a slot (used by SaveSystem façade + AutoSaveManager).
   * Does NOT change the current selection.
   */
  async writeProfileData(slotId: SlotId, saveData: SaveData & { stages: Record<number, StageProgress> }): Promise<void> {
    const existing = await ProfileDB.readProfile(slotId);
    const displayName = existing?.displayName ?? `PILOT ${(slotId + 1).toString().padStart(2, '0')}`;
    await ProfileDB.writeProfile(slotId, saveData, displayName);
  },

  // ── Migration flag ──

  /**
   * Check whether the v2/v2_skills_v2/v3 → v4 IndexedDB migration has been run.
   * Used by the migration script (Phase 6) to avoid re-running.
   */
  async isMigrationDone(): Promise<boolean> {
    const done = await ProfileDB.readGlobal<boolean>(GLOBAL_KEY_MIGRATION_DONE);
    return done === true;
  },

  /** Mark the migration as complete. Called by the migration script after success. */
  async markMigrationDone(): Promise<void> {
    await ProfileDB.writeGlobal(GLOBAL_KEY_MIGRATION_DONE, true);
  },

  // ── Test utilities ──

  /**
   * Wipe ALL profile data (for tests only).
   * Resets in-memory state too.
   */
  async _wipeAll(): Promise<void> {
    await ProfileDB._wipeAll();
    state.currentSlotId = null;
    state.initialized = false;
  },
};

export default ProfileManager;
