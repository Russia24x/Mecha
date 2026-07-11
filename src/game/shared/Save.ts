/**
 * MECHA: LAST PROTOCOL - Save System
 * Versioned save with migration. Stored in localStorage.
 */

import { KEYS } from './Constants';
import type { CheckpointData } from './Types';

const SAVE_VERSION = 2;
const STORAGE_KEY = KEYS.SAVE_KEY;

export interface GameSettings {
  lang: 'en' | 'fa';
  masterVolume: number;
  sfxVolume: number;
  muted: boolean;
  brightness: number;
}

export interface SaveData {
  version: number;
  lastCheckpoint: CheckpointData | null;
  bestBossTimeMs: number | null;
  totalKills: number;
  bossesKilled: number;
  settings: GameSettings;
}

const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  lastCheckpoint: null,
  bestBossTimeMs: null,
  totalKills: 0,
  bossesKilled: 0,
  settings: {
    lang: 'en',
    masterVolume: 0.7,
    sfxVolume: 0.8,
    muted: false,
    brightness: 0.7,
  },
};

export class Save {
  private static cache: SaveData | null = null;

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
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache)); } catch { /* */ }
  }

  private static migrate(old: Partial<SaveData>): SaveData {
    const migrated: SaveData = { ...DEFAULT_SAVE, ...old };
    if (typeof migrated.bossesKilled !== 'number') migrated.bossesKilled = 0;
    if (typeof migrated.totalKills !== 'number') migrated.totalKills = 0;
    if (!migrated.settings) migrated.settings = { ...DEFAULT_SAVE.settings };
    if (typeof migrated.settings.brightness !== 'number') migrated.settings.brightness = DEFAULT_SAVE.settings.brightness;
    migrated.version = SAVE_VERSION;
    return migrated;
  }

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

  static recordBossKill(): void {
    const data = this.load();
    data.bossesKilled++;
    this.persist();
  }

  static recordBossTime(ms: number): void {
    const data = this.load();
    if (data.bestBossTimeMs === null || ms < data.bestBossTimeMs) {
      data.bestBossTimeMs = ms;
      this.persist();
    }
  }

  static getSettings(): GameSettings { return this.load().settings; }

  static saveSettings(s: Partial<GameSettings>): void {
    const data = this.load();
    data.settings = { ...data.settings, ...s };
    this.persist();
  }

  static clear(): void {
    this.cache = { ...DEFAULT_SAVE };
    this.persist();
  }
}

export default Save;
