/**
 * MECHA: LAST PROTOCOL - Save System
 * Standard save system with versioning, migration, and structured data.
 * All game progress is stored in a single JSON object in localStorage.
 *
 * Structure:
 *   {
 *     version: 2,           // save format version for migration
 *     lastCheckpoint: { section, x, y, timestamp },
 *     bestBossTimeMs: number | null,
 *     totalKills: number,
 *     stages: { 1: { completed, bestTime }, 2: { ... } },
 *     settings: { lang, masterVolume, musicVolume, sfxVolume, muted }
 *   }
 */
import { KEYS } from './Constants';
import type { CheckpointData } from './Types';

const SAVE_VERSION = 2;
const STORAGE_KEY = KEYS.SAVE_KEY;

export interface StageProgress {
  completed: boolean;
  bestTimeMs: number | null;
}
export interface GameSettings {
  lang: 'en' | 'fa';
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  /** Brightness 0 (darkest) → 1 (brightest). Default 0.8. Affects darkness overlay alpha + ColorMatrix. */
  brightness: number;
}
export interface SaveData {
  version: number;
  lastCheckpoint: CheckpointData | null;
  bestBossTimeMs: number | null;
  totalKills: number;
  stages: Record<number, StageProgress>;
  settings: GameSettings;
}

const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  lastCheckpoint: null,
  bestBossTimeMs: null,
  totalKills: 0,
  stages: {},
  settings: {
    lang: 'en',
    masterVolume: 0.7,
    musicVolume: 0.4,
    sfxVolume: 0.8,
    muted: false,
    brightness: 0.8,
  },
};

export class Save {
  private static cache: SaveData | null = null;

  // ---- Load / Persist ----
  private static load(): SaveData {
    if (this.cache) return this.cache;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        this.cache = this.migrate(parsed);
      } else {
        this.cache = { ...DEFAULT_SAVE };
      }
    } catch {
      this.cache = { ...DEFAULT_SAVE };
    }
    return this.cache;
  }

  private static persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch { /* storage unavailable */ }
  }

  /** Migrate old save format to current version. */
  private static migrate(old: Partial<SaveData>): SaveData {
    const migrated: SaveData = { ...DEFAULT_SAVE, ...old };
    // v1 → v2: add stages + settings
    if (!migrated.stages) migrated.stages = {};
    if (!migrated.settings) migrated.settings = { ...DEFAULT_SAVE.settings };
    // v2 + brightness: ensure brightness field exists (default 0.6 if missing)
    if (typeof migrated.settings.brightness !== 'number') {
      migrated.settings.brightness = DEFAULT_SAVE.settings.brightness;
    }
    migrated.version = SAVE_VERSION;
    return migrated;
  }

  // ---- Public API ----
  static get(): Readonly<SaveData> { return this.load(); }

  static hasCheckpoint(): boolean { return this.load().lastCheckpoint !== null; }

  static saveCheckpoint(cp: CheckpointData): void {
    const data = this.load();
    data.lastCheckpoint = cp;
    this.persist();
  }

  static clearCheckpoint(): void {
    const data = this.load();
    data.lastCheckpoint = null;
    this.persist();
  }

  static recordKill(): void {
    const data = this.load();
    data.totalKills++;
    this.persist();
  }

  static recordBossTime(ms: number): void {
    const data = this.load();
    if (data.bestBossTimeMs === null || ms < data.bestBossTimeMs) {
      data.bestBossTimeMs = ms;
      this.persist();
    }
  }

  static recordStageComplete(stageId: number, timeMs: number): void {
    const data = this.load();
    if (!data.stages[stageId]) data.stages[stageId] = { completed: false, bestTimeMs: null };
    data.stages[stageId].completed = true;
    if (data.stages[stageId].bestTimeMs === null || timeMs < data.stages[stageId].bestTimeMs!) {
      data.stages[stageId].bestTimeMs = timeMs;
    }
    this.persist();
  }

  static isStageUnlocked(stageId: number): boolean {
    if (stageId === 1) return true;
    const data = this.load();
    return data.stages[stageId - 1]?.completed ?? false;
  }

  // ---- Settings ----
  static getSettings(): GameSettings { return this.load().settings; }
  static saveSettings(s: Partial<GameSettings>): void {
    const data = this.load();
    data.settings = { ...data.settings, ...s };
    this.persist();
  }

  // ---- Reset ----
  static clear(): void {
    this.cache = { ...DEFAULT_SAVE };
    this.persist();
  }
}

export default Save;
