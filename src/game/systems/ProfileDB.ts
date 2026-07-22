/**
 * MECHA: LAST PROTOCOL — ProfileDB
 *
 * IndexedDB wrapper for storing multiple save profile slots + global settings.
 *
 * Database schema (DB name: `mecha_last_protocol`, version: 1):
 *   Object Store: `profiles`  (keyPath: 'slotId')
 *     - Records: { slotId: 0|1|2, saveData: SaveData, createdAt, lastSavedAt, displayName }
 *   Object Store: `global`    (keyPath: 'key')
 *     - Records: { key: 'settings'|'selectedSlot'|'migrationDone', value: any }
 *
 * All methods are async (return Promise). Callers must await.
 *
 * Safety:
 *   - On any read/write error, methods reject (caller catches).
 *   - On environments without IndexedDB (SSR, very old browsers), methods reject
 *     with a typed error. Caller should fall back to localStorage mirror.
 *   - NEVER throws synchronously.
 *
 * Concurrency:
 *   - IndexedDB transactions auto-commit. No long-lived locks.
 *   - If two tabs write to the same slot simultaneously, last write wins.
 *     This is acceptable for a single-player game.
 */

const DB_NAME = 'mecha_last_protocol';
const DB_VERSION = 1;
const STORE_PROFILES = 'profiles';
const STORE_GLOBAL = 'global';

/** Maximum number of save slots. */
export const MAX_PROFILES = 3;

/** Slot identifier: 0, 1, or 2. */
export type SlotId = 0 | 1 | 2;

/** A record in the `profiles` object store. */
export interface ProfileRecord {
  slotId: SlotId;
  /** Display name shown in profile-select UI (e.g. "PILOT 01"). */
  displayName: string;
  /** Full SaveData — see data/types.ts. */
  saveData: unknown; // SaveData; kept as unknown to avoid import cycle
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last successful write. */
  lastSavedAt: string;
}

/** A record in the `global` object store. */
interface GlobalRecord {
  key: string;
  value: unknown;
}

/** Error thrown when IndexedDB is unavailable. */
export class ProfileDBUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileDBUnavailableError';
  }
}

/** Error thrown when a slot doesn't exist. */
export class ProfileNotFoundError extends Error {
  constructor(slotId: number) {
    super(`Profile slot ${slotId} not found`);
    this.name = 'ProfileNotFoundError';
    this.slotId = slotId;
  }
  slotId: number;
}

// ── IndexedDB availability check ──

function getIDB(): IDBFactory | null {
  // Check both `globalThis` (works in Node + browser) and `window` (legacy).
  // In browser, both refer to the same object. In Node, only `globalThis`
  // exists (after `import 'fake-indexeddb/auto'` sets globalThis.indexedDB).
  const g = globalThis as unknown as { indexedDB?: IDBFactory };
  if (typeof g.indexedDB !== 'undefined') return g.indexedDB;
  if (typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
    return window.indexedDB;
  }
  return null;
}

// ── Connection management ──

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const idb = getIDB();
    if (!idb) {
      reject(new ProfileDBUnavailableError('IndexedDB not available in this environment'));
      return;
    }
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(new ProfileDBUnavailableError(`Failed to open IndexedDB: ${req.error?.message ?? 'unknown'}`));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      // Always create both stores on fresh DB (oldVersion === 0) — we never
      // add migration logic here because DB_VERSION starts at 1.
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_PROFILES)) {
          db.createObjectStore(STORE_PROFILES, { keyPath: 'slotId' });
        }
        if (!db.objectStoreNames.contains(STORE_GLOBAL)) {
          db.createObjectStore(STORE_GLOBAL, { keyPath: 'key' });
        }
      }
      // Future upgrades (DB_VERSION === 2, 3, ...) would go here as:
      //   if (oldVersion < 2) { ... }
    };
  });
  // If opening fails, drop the cached promise so subsequent callers retry.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

/** Reset the cached DB connection (for tests only). */
export function _resetDBCache(): void {
  dbPromise = null;
}

// ── Generic read/write helpers ──

function txRead<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return openDB().then(db => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onerror = () => reject(req.error ?? new Error(`read failed on ${storeName}/${String(key)}`));
    req.onsuccess = () => resolve(req.result as T | undefined);
  }));
}

function txWrite(storeName: string, value: unknown): Promise<void> {
  return openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onerror = () => reject(req.error ?? new Error(`write failed on ${storeName}`));
    req.onsuccess = () => resolve();
    // tx.oncomplete fires after commit; we don't need to await it for puts (req.onsuccess is sufficient).
  }));
}

function txDelete(storeName: string, key: IDBValidKey): Promise<void> {
  return openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onerror = () => reject(req.error ?? new Error(`delete failed on ${storeName}/${String(key)}`));
    req.onsuccess = () => resolve();
  }));
}

function txKeys(storeName: string): Promise<IDBValidKey[]> {
  return openDB().then(db => new Promise<IDBValidKey[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAllKeys();
    req.onerror = () => reject(req.error ?? new Error(`getAllKeys failed on ${storeName}`));
    req.onsuccess = () => resolve(req.result as IDBValidKey[]);
  }));
}

// ── Public API: profiles ──

export const ProfileDB = {
  /**
   * Check whether IndexedDB is available in the current environment.
   * Returns false on SSR or unsupported browsers.
   */
  isAvailable(): boolean {
    return getIDB() !== null;
  },

  /** Read a profile record by slot ID. Returns undefined if slot is empty. */
  async readProfile(slotId: SlotId): Promise<ProfileRecord | undefined> {
    return txRead<ProfileRecord>(STORE_PROFILES, slotId);
  },

  /**
   * Write (or overwrite) a profile record.
   * Updates `lastSavedAt` automatically.
   */
  async writeProfile(slotId: SlotId, saveData: unknown, displayName?: string): Promise<void> {
    const existing = await this.readProfile(slotId);
    const record: ProfileRecord = {
      slotId,
      displayName: displayName ?? existing?.displayName ?? `PILOT ${(slotId + 1).toString().padStart(2, '0')}`,
      saveData,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    };
    await txWrite(STORE_PROFILES, record);
  },

  /** Delete a profile record. No-op if slot is empty. */
  async deleteProfile(slotId: SlotId): Promise<void> {
    await txDelete(STORE_PROFILES, slotId);
  },

  /** List all non-empty slot IDs. */
  async listProfiles(): Promise<SlotId[]> {
    const keys = await txKeys(STORE_PROFILES);
    return keys.filter((k): k is SlotId => typeof k === 'number' && k >= 0 && k < MAX_PROFILES)
      .sort((a, b) => (a as number) - (b as number)) as SlotId[];
  },

  /** Read all profile records (for UI display). */
  async readAllProfiles(): Promise<ProfileRecord[]> {
    const slots = await this.listProfiles();
    const records = await Promise.all(slots.map(s => this.readProfile(s)));
    return records.filter((r): r is ProfileRecord => r !== undefined);
  },

  // ── Global key-value store ──

  async readGlobal<T>(key: string): Promise<T | undefined> {
    const rec = await txRead<GlobalRecord>(STORE_GLOBAL, key);
    return rec?.value as T | undefined;
  },

  async writeGlobal(key: string, value: unknown): Promise<void> {
    await txWrite(STORE_GLOBAL, { key, value });
  },

  async deleteGlobal(key: string): Promise<void> {
    await txDelete(STORE_GLOBAL, key);
  },

  // ── Emergency localStorage mirror (for beforeunload) ──

  /**
   * Emergency flush: mirror the current cache to localStorage as a safety net
   * when IndexedDB writes may not complete (e.g. during beforeunload).
   *
   * This is a ONE-WAY mirror — on next load, if IndexedDB write succeeded,
   * the localStorage copy is stale and ignored. If IndexedDB write failed
   * (e.g. tab closed mid-write), the localStorage copy is recovered on next
   * boot via `recoverFromLocalStorageMirror()`.
   */
  emergencyMirrorToLocalStorage(slotId: SlotId, saveData: unknown): void {
    if (typeof window === 'undefined') return;
    try {
      const key = `mecha_profile_${slotId}_emergency_mirror`;
      window.localStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        saveData,
      }));
    } catch {
      // localStorage may be full or disabled — silently give up.
    }
  },

  /**
   * On boot: check if there's a newer localStorage mirror than the IndexedDB
   * record's lastSavedAt. If so, the IndexedDB write was interrupted by tab
   * close — recover the localStorage copy.
   *
   * Returns the recovered saveData, or null if no recovery needed.
   */
  async recoverFromLocalStorageMirror(slotId: SlotId): Promise<unknown | null> {
    if (typeof window === 'undefined') return null;
    try {
      const key = `mecha_profile_${slotId}_emergency_mirror`;
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { timestamp: number; saveData: unknown };
      const profile = await this.readProfile(slotId);
      if (!profile) {
        // IndexedDB has no record but localStorage mirror exists — full recovery.
        return parsed.saveData;
      }
      const idbTime = new Date(profile.lastSavedAt).getTime();
      if (parsed.timestamp > idbTime) {
        // localStorage mirror is newer — recover.
        return parsed.saveData;
      }
      // IndexedDB is newer or equal — mirror is stale, clean it up.
      window.localStorage.removeItem(key);
      return null;
    } catch {
      return null;
    }
  },

  /** Remove the localStorage mirror for a slot (after successful IndexedDB write). */
  clearLocalStorageMirror(slotId: SlotId): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(`mecha_profile_${slotId}_emergency_mirror`);
    } catch {
      // ignore
    }
  },

  // ── Test utilities (NOT for production use) ──

  /** Wipe ALL data — profiles + global. For tests only. */
  async _wipeAll(): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PROFILES, STORE_GLOBAL], 'readwrite');
      tx.objectStore(STORE_PROFILES).clear();
      tx.objectStore(STORE_GLOBAL).clear();
      tx.onerror = () => reject(tx.error ?? new Error('wipe failed'));
      tx.oncomplete = () => resolve();
    });
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < MAX_PROFILES; i++) {
          window.localStorage.removeItem(`mecha_profile_${i}_emergency_mirror`);
        }
      } catch {
        // ignore
      }
    }
  },
};

export default ProfileDB;
