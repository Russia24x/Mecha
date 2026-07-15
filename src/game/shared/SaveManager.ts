/**
 * MECHA: LAST PROTOCOL - SaveManager
 * Persists checkpoint + progression to localStorage.
 * AI-Friendly: pure static API, no side effects on import.
 */
import { KEYS } from './Constants';
import type { CheckpointData } from './Types';

interface SaveData {
  version: string;
  lastCheckpoint: CheckpointData | null;
  bestBossTimeMs: number | null;
  totalKills: number;
  unlocked: boolean;
}

const DEFAULT_SAVE: SaveData = {
  version: '1.0',
  lastCheckpoint: null,
  bestBossTimeMs: null,
  totalKills: 0,
  unlocked: false,
};

export class SaveManager {
  private static cache: SaveData | null = null;

  private static load(): SaveData {
    if (this.cache) return this.cache;
    try {
      const raw = typeof window !== 'undefined'
        ? window.localStorage.getItem(KEYS.SAVE_KEY)
        : null;
      this.cache = raw ? { ...DEFAULT_SAVE, ...JSON.parse(raw) } : { ...DEFAULT_SAVE };
    } catch {
      this.cache = { ...DEFAULT_SAVE };
    }
    return this.cache;
  }

  private static persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEYS.SAVE_KEY, JSON.stringify(this.cache));
    } catch {
      /* storage may be unavailable — fail silently */
    }
  }

  static get(): Readonly<SaveData> {
    return this.load();
  }

  static saveCheckpoint(cp: CheckpointData): void {
    const data = this.load();
    data.lastCheckpoint = cp;
    this.persist();
  }

  static recordKill(): void {
    const data = this.load();
    data.totalKills += 1;
    this.persist();
  }

  static recordBossTime(ms: number): void {
    const data = this.load();
    if (data.bestBossTimeMs === null || ms < data.bestBossTimeMs) {
      data.bestBossTimeMs = ms;
      data.unlocked = true;
      this.persist();
    }
  }

  static clear(): void {
    this.cache = { ...DEFAULT_SAVE };
    this.persist();
  }

  static hasCheckpoint(): boolean {
    return this.load().lastCheckpoint !== null;
  }
}

export default SaveManager;
