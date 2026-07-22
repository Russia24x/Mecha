/**
 * MECHA: LAST PROTOCOL — Save System v4 (Façade)
 *
 * REWRITE (Phase 3): same public API as v3, but internal storage switched
 * from localStorage to IndexedDB via ProfileManager. The cache stays
 * in-memory for fast reads; persistence is delegated to AutoSaveManager
 * (Phase 4) via the dirty flag.
 *
 * Contract:
 *   - `persist()` is now O(1) — only marks cache dirty. Does NOT write
 *     to IndexedDB or localStorage.
 *   - AutoSaveManager calls `flushToIndexedDB()` every 30s + on checkpoints
 *     + on visibilitychange/beforeunload.
 *   - On slot switch, `selectSlot()` loads the new slot's data from
 *     IndexedDB and replaces the in-memory cache.
 *
 * SaveData v4 adds `stages: Record<number, StageProgress>` field (ported
 * from old shared/Save.ts which had unique stage data in v2 localStorage).
 *
 * Migration: ProfileManager (Phase 6) reads old localStorage keys
 * (v2, v2_skills_v2, v3) and merges them into slot 0 in IndexedDB.
 *
 * API surface: 100% backward-compatible with v3. All 40+ existing methods
 * keep the same signature and return type. New methods are clearly marked.
 */

import type { SaveData, GameSettings, CheckpointData, PlayerState, InventoryItem } from '../data/types';
import { ProfileManager, DEFAULT_SAVE, DEFAULT_SETTINGS, DEFAULT_PLAYER, SAVE_VERSION, type StageProgress } from './ProfileManager';

// Re-export StageProgress + SAVE_VERSION so existing imports from SaveSystem keep working
export type { StageProgress };
export { SAVE_VERSION };

// Internal type: SaveData v4 (extends v3 SaveData with stages field)
type SaveDataV4 = SaveData & { stages: Record<number, StageProgress> };

export class SaveSystem {
  /** In-memory cache of the currently-selected profile's SaveData. */
  private static cache: SaveDataV4 | null = null;
  /** Performance: in-memory Sets for per-frame lookups. */
  private static collectedCache: Set<string> | null = null;
  private static shortcutsCache: Set<string> | null = null;
  /** Dirty flag — set by persist(), cleared by flushToIndexedDB(). */
  private static dirty: boolean = false;
  /** Whether init() has been called. */
  private static initialized: boolean = false;

  // ──────────────────────────────────────────────────────────────
  //  INIT / SLOT MANAGEMENT (NEW in v4 — required before any other call)
  // ──────────────────────────────────────────────────────────────

  /**
   * Initialize the save system. MUST be called once on game boot, after
   * ProfileManager.init().
   *
   * - If a slot is selected in ProfileManager, loads its data into cache.
   * - If no slot is selected, cache stays null (will be loaded on selectSlot).
   *
   * Returns the currently-selected slot ID (or null).
   */
  static async init(): Promise<number | null> {
    if (this.initialized) return ProfileManager.getCurrentSlotId();
    this.initialized = true;
    const slotId = ProfileManager.getCurrentSlotId();
    if (slotId !== null) {
      await this.loadFromSlot(slotId);
    }
    return slotId;
  }

  /**
   * Switch to a different profile slot. Loads the new slot's data into
   * cache, REPLACING the current cache. The previous slot's dirty data
   * is flushed to IndexedDB before switching (best-effort).
   *
   * Used by ProfileSelectUI (Phase 5) when user picks a different slot.
   */
  static async selectSlot(slotId: number): Promise<void> {
    // Flush current slot before switching (best-effort)
    if (this.dirty && ProfileManager.getCurrentSlotId() !== null) {
      await this.flushToIndexedDB();
    }
    await ProfileManager.selectSlot(slotId as 0 | 1 | 2);
    await this.loadFromSlot(slotId);
  }

  /**
   * Load cache from a profile slot. Rebuilds the Set caches from arrays.
   */
  private static async loadFromSlot(slotId: number): Promise<void> {
    const data = await ProfileManager.readProfileData(slotId as 0 | 1 | 2);
    if (data) {
      this.cache = this.migrate(data);
    } else {
      // Slot doesn't exist or is empty — use defaults
      this.cache = this.deepCloneDefault();
    }
    // Rebuild Set caches
    this.collectedCache = new Set(this.cache.player.collectedCollectibles ?? []);
    this.shortcutsCache = new Set(this.cache.player.openedShortcuts ?? []);
    this.dirty = false;
  }

  // ──────────────────────────────────────────────────────────────
  //  PERSIST / DIRTY (REWRITTEN in v4)
  // ──────────────────────────────────────────────────────────────

  /**
   * Mark the cache as dirty. Does NOT write to IndexedDB.
   * AutoSaveManager handles actual persistence.
   *
   * This method is called by every mutator below.
   */
  private static persist(): void {
    this.dirty = true;
  }

  /** Whether there are unsaved changes in the cache. */
  static isDirty(): boolean {
    return this.dirty;
  }

  /** Clear the dirty flag (called by AutoSaveManager after successful flush). */
  static clearDirty(): void {
    this.dirty = false;
  }

  /**
   * Serialize the current cache for AutoSaveManager to write to IndexedDB.
   * Returns a deep clone so the caller can't mutate the cache.
   */
  static serialize(): SaveDataV4 | null {
    if (!this.cache) return null;
    return JSON.parse(JSON.stringify(this.cache)) as SaveDataV4;
  }

  /**
   * Write the current cache to IndexedDB via ProfileManager.
   * Called by AutoSaveManager (Phase 4). Clears the dirty flag on success.
   *
   * RACE CONDITION FIX: We snapshot the cache BEFORE writing, and set dirty=false
   * BEFORE the write. If any mutation happens during the async write, persist()
   * will re-set dirty=true, and the next flush will write the latest state.
   *
   * WRITE FAILURE HANDLING: If the write throws (quota exceeded, IndexedDB
   * unavailable, transaction aborted), we restore dirty=true so the next
   * flush cycle retries. Without this, a failed write would silently lose
   * data — dirty would stay false, but the data was never persisted.
   *
   * Flow:
   *   1. Snapshot cache (S1)
   *   2. Set dirty=false
   *   3. await writeProfileData(slotId, S1)
   *      - If mutation M happens here, persist() sets dirty=true
   *   4a. On success: if dirty was re-set (M happened), leave it for next flush
   *   4b. On failure: set dirty=true (retry next cycle), rethrow to caller
   */
  static async flushToIndexedDB(): Promise<void> {
    if (!this.cache) return;
    const slotId = ProfileManager.getCurrentSlotId();
    if (slotId === null) return;

    // Snapshot the cache state. We write THIS snapshot, not the live cache.
    const snapshot = JSON.parse(JSON.stringify(this.cache)) as SaveDataV4;

    // Mark dirty=false BEFORE the write. If any mutation happens during the
    // await, persist() will re-set dirty=true.
    this.dirty = false;

    try {
      await ProfileManager.writeProfileData(slotId, snapshot);
      // Success. If dirty was re-set during the write (mutation occurred),
      // leave it set so the next flush picks it up. No action needed here.
    } catch (err) {
      // Write failed — restore dirty=true so the next flush retries.
      // The snapshot S1 was never persisted, so the cache state (which may
      // have additional mutations on top of S1) needs to be re-flushed.
      this.dirty = true;
      console.error('[SaveSystem] flushToIndexedDB write failed, will retry:', err);
      throw err; // Re-throw so AutoSaveManager can log/handle if needed
    }
  }

  // ──────────────────────────────────────────────────────────────
  //  CACHE LOAD (REWRITTEN — uses in-memory cache, not localStorage)
  // ──────────────────────────────────────────────────────────────

  /**
   * Get the cache, loading it if necessary.
   * In v4, the cache is loaded by init()/selectSlot(), so this is mostly
   * a null-check. If cache is null (no slot selected), returns defaults.
   */
  private static load(): SaveDataV4 {
    if (this.cache) return this.cache;
    // No slot selected — use in-memory defaults (won't be persisted)
    this.cache = this.deepCloneDefault();
    this.collectedCache = new Set();
    this.shortcutsCache = new Set();
    return this.cache;
  }

  /** Deep-clone the DEFAULT_SAVE so each instance is independent. */
  private static deepCloneDefault(): SaveDataV4 {
    return {
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
  }

  /**
   * Migrate old save format to v4. Adds `stages` field if missing
   * (porting from v3 which didn't have it).
   */
  private static migrate(old: Partial<SaveDataV4>): SaveDataV4 {
    const migrated: SaveDataV4 = {
      ...DEFAULT_SAVE,
      ...old,
      player: { ...DEFAULT_PLAYER, ...old.player },
      settings: { ...DEFAULT_SETTINGS, ...old.settings },
    };
    // Ensure all nested structures exist (defensive — same as v3 migrate)
    if (!migrated.bestBossTimes) migrated.bestBossTimes = {};
    if (!migrated.questFlags) migrated.questFlags = {};
    if (!migrated.questProgress) migrated.questProgress = {};
    if (!migrated.npcFlags) migrated.npcFlags = {};
    if (!migrated.unlockedAreas) migrated.unlockedAreas = ['abandoned_factory', 'toxic_forest'];
    if (!migrated.discoveredAreas) migrated.discoveredAreas = [];
    if (!migrated.player.inventory) migrated.player.inventory = [];
    if (!migrated.player.abilities) migrated.player.abilities = [];
    if (!migrated.player.unlockedSkills) migrated.player.unlockedSkills = [];
    if (!migrated.player.unlockedWeapons) migrated.player.unlockedWeapons = ['assault_rifle'];
    if (!migrated.player.weaponLevels) migrated.player.weaponLevels = { assault_rifle: 1 };
    if (!migrated.player.collectedCollectibles) migrated.player.collectedCollectibles = [];
    if (!migrated.player.openedShortcuts) migrated.player.openedShortcuts = [];
    if (!migrated.player.selectedChassis) migrated.player.selectedChassis = 'assault';
    if (!migrated.player.selectedPaint) migrated.player.selectedPaint = 'factory_gray';
    if (!migrated.player.unlockedChassis) migrated.player.unlockedChassis = ['scout', 'assault', 'titan'];
    if (!migrated.player.unlockedPaints) migrated.player.unlockedPaints = ['factory_gray'];
    if (!migrated.player.unlockedCompanions) migrated.player.unlockedCompanions = [];
    if (migrated.player.selectedCompanion === undefined) migrated.player.selectedCompanion = null;
    if (!migrated.settings.quality) migrated.settings.quality = 'high';
    if (migrated.settings.fullscreen === undefined) migrated.settings.fullscreen = false;
    // NEW in v4: stages field (ported from old shared/Save.ts)
    if (!migrated.stages) migrated.stages = {};
    migrated.version = SAVE_VERSION;
    return migrated;
  }

  // ──────────────────────────────────────────────────────────────
  //  PUBLIC API (unchanged from v3 — same signatures, same behavior)
  // ──────────────────────────────────────────────────────────────

  static get(): Readonly<SaveDataV4> { return this.load(); }
  static getPlayer(): Readonly<PlayerState> { return this.load().player; }
  static getSettings(): GameSettings { return this.load().settings; }

  static hasCheckpoint(): boolean { return this.load().checkpoint !== null; }

  static saveCheckpoint(cp: CheckpointData): void {
    const data = this.load();
    data.checkpoint = cp;
    this.persist();
  }

  static clearCheckpoint(): void {
    const data = this.load();
    data.checkpoint = null;
    this.persist();
  }

  static recordKill(): void {
    const data = this.load();
    data.player.totalKills++;
    this.persist();
  }

  static recordBossKill(bossId: string, timeMs: number): void {
    const data = this.load();
    data.player.bossesKilled++;
    if (!data.bestBossTimes[bossId] || timeMs < data.bestBossTimes[bossId]) {
      data.bestBossTimes[bossId] = timeMs;
    }
    this.persist();
  }

  static awardXp(amount: number): { leveledUp: boolean; newLevel: number } {
    const data = this.load();
    data.player.xp += amount;
    let leveledUp = false;
    while (data.player.xp >= this.xpForLevel(data.player.level) && data.player.level < 100) {
      data.player.xp -= this.xpForLevel(data.player.level);
      data.player.level++;
      data.player.skillPoints++;
      leveledUp = true;
    }
    this.persist();
    return { leveledUp, newLevel: data.player.level };
  }

  /**
   * Phase 3: Death penalty — lose 50% of unbanked XP on death.
   * Per Design Pillars: "Combat: Heavy·Precise·Punishing" — death has stakes.
   * Only unbanked XP (toward next level) is lost, not levels themselves.
   * Skill points already earned are kept (banked).
   * Returns the amount of XP lost for display purposes.
   */
  static applyDeathPenalty(): number {
    const data = this.load();
    const lostXp = Math.floor(data.player.xp * 0.5);
    data.player.xp -= lostXp;
    this.persist();
    return lostXp;
  }

  static xpForLevel(level: number): number {
    return Math.round(100 * Math.pow(level, 1.5));
  }

  static unlockSkill(skillId: string): boolean {
    const data = this.load();
    if (data.player.unlockedSkills.includes(skillId)) return false;
    data.player.unlockedSkills.push(skillId);
    this.persist();
    return true;
  }

  static unlockWeapon(weaponId: string): void {
    const data = this.load();
    if (!data.player.unlockedWeapons.includes(weaponId)) {
      data.player.unlockedWeapons.push(weaponId);
      if (!data.player.weaponLevels[weaponId]) {
        data.player.weaponLevels[weaponId] = 1;
      }
      this.persist();
    }
  }

  static isWeaponUnlocked(weaponId: string): boolean {
    return this.load().player.unlockedWeapons.includes(weaponId);
  }

  static unlockAbility(ability: string): void {
    const data = this.load();
    if (!data.player.abilities.includes(ability)) {
      data.player.abilities.push(ability);
      this.persist();
    }
  }

  // ── Metroidvania: Collectibles + Shortcuts ──

  /** Grant a skill point directly (for collectible rewards). */
  static grantSkillPoint(): void {
    const data = this.load();
    data.player.skillPoints += 1;
    this.persist();
  }

  // ── Hangar: Chassis + Paint + Companion ──

  static setSelectedChassis(chassisId: string): void {
    const data = this.load();
    data.player.selectedChassis = chassisId;
    this.persist();
  }

  static setSelectedPaint(paintId: string): void {
    const data = this.load();
    data.player.selectedPaint = paintId;
    this.persist();
  }

  static unlockPaint(paintId: string): void {
    const data = this.load();
    if (!data.player.unlockedPaints.includes(paintId)) {
      data.player.unlockedPaints.push(paintId);
      this.persist();
    }
  }

  static unlockChassis(chassisId: string): void {
    const data = this.load();
    if (!data.player.unlockedChassis.includes(chassisId)) {
      data.player.unlockedChassis.push(chassisId);
      this.persist();
    }
  }

  static isChassisUnlocked(chassisId: string): boolean {
    return this.load().player.unlockedChassis.includes(chassisId);
  }

  static isPaintUnlocked(paintId: string): boolean {
    return this.load().player.unlockedPaints.includes(paintId);
  }

  /** Check if a collectible has already been collected (persists across deaths/reloads). */
  static isCollectibleCollected(id: string): boolean {
    if (!this.collectedCache) {
      this.collectedCache = new Set(this.load().player.collectedCollectibles ?? []);
    }
    return this.collectedCache.has(id);
  }

  /** Mark a collectible as collected. Returns true if this is a new collection. */
  static markCollectibleCollected(id: string): boolean {
    if (!this.collectedCache) {
      this.collectedCache = new Set(this.load().player.collectedCollectibles ?? []);
    }
    if (this.collectedCache.has(id)) return false;
    this.collectedCache.add(id);
    const data = this.load();
    data.player.collectedCollectibles = [...this.collectedCache];
    this.persist();
    return true;
  }

  /** Check if a shortcut door has been opened (persists across deaths/reloads). */
  static isShortcutOpened(id: string): boolean {
    if (!this.shortcutsCache) {
      this.shortcutsCache = new Set(this.load().player.openedShortcuts ?? []);
    }
    return this.shortcutsCache.has(id);
  }

  /** Mark a shortcut door as opened. Returns true if this is a new opening. */
  static markShortcutOpened(id: string): boolean {
    if (!this.shortcutsCache) {
      this.shortcutsCache = new Set(this.load().player.openedShortcuts ?? []);
    }
    if (this.shortcutsCache.has(id)) return false;
    this.shortcutsCache.add(id);
    const data = this.load();
    data.player.openedShortcuts = [...this.shortcutsCache];
    this.persist();
    return true;
  }

  static addItem(itemId: string, amount: number = 1): void {
    const data = this.load();
    const existing = data.player.inventory.find(i => i.itemId === itemId);
    if (existing) {
      existing.amount += amount;
    } else {
      data.player.inventory.push({ itemId, amount });
    }
    this.persist();
  }

  static removeItem(itemId: string, amount: number = 1): boolean {
    const data = this.load();
    const existing = data.player.inventory.find(i => i.itemId === itemId);
    if (!existing || existing.amount < amount) return false;
    existing.amount -= amount;
    if (existing.amount <= 0) {
      data.player.inventory = data.player.inventory.filter(i => i.itemId !== itemId);
    }
    this.persist();
    return true;
  }

  static hasItem(itemId: string, amount: number = 1): boolean {
    const data = this.load();
    const existing = data.player.inventory.find(i => i.itemId === itemId);
    return !!existing && existing.amount >= amount;
  }

  static setWeapon(weaponId: string): void {
    const data = this.load();
    data.player.currentWeapon = weaponId;
    this.persist();
  }

  static unlockArea(areaId: string): void {
    const data = this.load();
    if (!data.unlockedAreas.includes(areaId)) {
      data.unlockedAreas.push(areaId);
      this.persist();
    }
  }

  static discoverArea(areaId: string): void {
    const data = this.load();
    if (!data.discoveredAreas.includes(areaId)) {
      data.discoveredAreas.push(areaId);
      this.persist();
    }
  }

  static setQuestFlag(questId: string, flag: boolean): void {
    const data = this.load();
    data.questFlags[questId] = flag;
    this.persist();
  }

  /** N4 fix: proper setters to avoid bypassing persist() */
  static setSkillPoints(sp: number): void {
    const data = this.load();
    data.player.skillPoints = Math.max(0, sp);
    this.persist();
  }

  static setWeaponLevel(weaponId: string, level: number): void {
    const data = this.load();
    data.player.weaponLevels[weaponId] = level;
    this.persist();
  }

  /** N2 fix: quest progress persistence */
  static setQuestProgress(questId: string, progress: number[]): void {
    const data = this.load();
    if (!data.questProgress) data.questProgress = {};
    data.questProgress[questId] = progress;
    this.persist();
  }

  static getQuestProgress(questId: string): number[] | null {
    return this.load().questProgress?.[questId] ?? null;
  }

  static getQuestFlag(questId: string): boolean {
    return this.load().questFlags[questId] ?? false;
  }

  static setNpcFlag(npcId: string, flag: string, value: boolean): void {
    const data = this.load();
    if (!data.npcFlags[npcId]) data.npcFlags[npcId] = {};
    data.npcFlags[npcId][flag] = value;
    this.persist();
  }

  static getNpcFlag(npcId: string, flag: string): boolean {
    return this.load().npcFlags[npcId]?.[flag] ?? false;
  }

  static saveSettings(s: Partial<GameSettings>): void {
    const data = this.load();
    data.settings = { ...data.settings, ...s };
    this.persist();
  }

  // ── NEW in v4: Stages (ported from old shared/Save.ts) ──

  /** Record completion of a stage. Stores best time per stage. */
  static recordStageComplete(stageId: number, timeMs: number): void {
    const data = this.load();
    if (!data.stages[stageId]) data.stages[stageId] = { completed: false, bestTimeMs: null };
    data.stages[stageId].completed = true;
    if (data.stages[stageId].bestTimeMs === null || timeMs < data.stages[stageId].bestTimeMs!) {
      data.stages[stageId].bestTimeMs = timeMs;
    }
    this.persist();
  }

  /** Check if a stage is unlocked (previous stage must be completed). */
  static isStageUnlocked(stageId: number): boolean {
    if (stageId === 1) return true;
    const data = this.load();
    return data.stages[stageId - 1]?.completed ?? false;
  }

  /** Get all stage progress (for UI display). */
  static getStages(): Record<number, StageProgress> {
    return this.load().stages;
  }

  // ──────────────────────────────────────────────────────────────
  //  RESET
  // ──────────────────────────────────────────────────────────────

  /**
   * Reset the cache to defaults. Does NOT delete the IndexedDB record —
   * use ProfileManager.deleteProfile() for that.
   *
   * After clear(), the cache is in-memory only. The next persist() will
   * mark it dirty, and AutoSaveManager will eventually flush it to IndexedDB
   * (overwriting the existing record in the current slot).
   */
  static clear(): void {
    this.cache = this.deepCloneDefault();
    this.collectedCache = null;  // N1 fix: reset cache Sets
    this.shortcutsCache = null;
    this.dirty = true;  // Mark dirty so AutoSaveManager persists the reset
  }
}

export default SaveSystem;
