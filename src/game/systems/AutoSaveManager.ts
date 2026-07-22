/**
 * MECHA: LAST PROTOCOL — AutoSaveManager
 *
 * Periodically flushes SaveSystem's dirty cache to IndexedDB.
 *
 * Lifecycle:
 *   - start() — begins the 30-second timer + registers visibility/unload listeners
 *   - stop()  — clears timer + removes listeners + flushes pending dirty state
 *
 * Save triggers (in priority order):
 *   1. saveNow() — explicit save at checkpoints (always writes, regardless of dirty)
 *   2. 30-second timer — writes if dirty
 *   3. visibilitychange (tab hidden) — writes if dirty
 *   4. beforeunload (tab closing) — emergency localStorage mirror (IndexedDB
 *      writes may not complete during beforeunload — that's a known browser
 *      limitation. The mirror is recovered on next boot via ProfileDB
 *      .recoverFromLocalStorageMirror()).
 *
 * Integration with SaveSystem:
 *   - SaveSystem.persist() only sets the dirty flag (O(1), no I/O)
 *   - AutoSaveManager calls SaveSystem.isDirty() to check, then
 *     SaveSystem.flushToIndexedDB() to write
 *   - On next slot selection, SaveSystem.flushToIndexedDB() is called first
 *     (best-effort) before switching
 *
 * Concurrency:
 *   - Only one write in flight at a time. If saveNow() is called while a
 *     timer-triggered save is in progress, the second call awaits the first.
 *   - The 30s timer is skipped if a save is already in flight.
 *
 * Memory:
 *   - The setInterval ID is tracked and cleared on stop()
 *   - visibilitychange + beforeunload listeners are tracked and removed on stop()
 *   - Calling stop() without start() is a no-op
 */

import { SaveSystem } from './SaveSystem';
import { ProfileDB } from './ProfileDB';
import type { SlotId } from './ProfileDB';
import { ProfileManager } from './ProfileManager';

const FLUSH_INTERVAL_MS = 30_000;

class AutoSaveManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onVisibilityChangeBound: () => void;
  private onBeforeUnloadBound: () => void;
  /** Whether a save is currently in flight (prevents overlapping writes). */
  private saveInFlight: boolean = false;
  /** Whether start() has been called without a matching stop(). */
  private started: boolean = false;

  constructor() {
    // Bind once so addEventListener and removeEventListener get the same reference
    this.onVisibilityChangeBound = this.onVisibilityChange.bind(this);
    this.onBeforeUnloadBound = this.onBeforeUnload.bind(this);
  }

  /**
   * Start the auto-save timer + register lifecycle listeners.
   * Idempotent — calling start() twice is a no-op.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    // 30-second flush timer
    this.intervalId = setInterval(() => {
      void this.flushIfDirty();
    }, FLUSH_INTERVAL_MS);

    // visibilitychange fires on document (not window) — standard DOM behavior.
    // We listen on document for the event, but keep beforeunload/pagehide on window.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChangeBound);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.onBeforeUnloadBound);
      window.addEventListener('pagehide', this.onBeforeUnloadBound); // mobile fallback
    }
  }

  /**
   * Stop the auto-save timer + remove listeners + final flush.
   * Idempotent — calling stop() twice is a no-op.
   */
  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.onBeforeUnloadBound);
      window.removeEventListener('pagehide', this.onBeforeUnloadBound);
    }

    // Wait for any in-flight save to complete.
    // The in-flight save uses a snapshot of the cache (taken at flush start),
    // so it won't capture mutations that happen during the write. After waiting,
    // we check dirty — if mutations happened during the write, dirty will be
    // true (because flushToIndexedDB sets dirty=false BEFORE writing, and
    // persist() re-sets it if mutations occur).
    let waitCount = 0;
    while (this.saveInFlight && waitCount < 1000) {
      await new Promise(resolve => setTimeout(resolve, 10));
      waitCount++;
    }
    if (this.saveInFlight) {
      console.warn('[AutoSaveManager] saveInFlight still true after 10s wait — giving up');
    }

    // Final flush — writes the latest cache state if dirty.
    await this.flushIfDirty();
  }

  /**
   * Explicit save — always writes, regardless of dirty flag.
   * Used at checkpoints, before scene transitions, before profile switches.
   */
  async saveNow(): Promise<void> {
    await this.doFlush(true);
  }

  /**
   * Flush the cache to IndexedDB if dirty.
   * Skipped if another save is in flight.
   */
  private async flushIfDirty(): Promise<void> {
    if (this.saveInFlight) return; // Skip overlapping writes
    if (!SaveSystem.isDirty()) return;
    await this.doFlush(false);
  }

  /**
   * Core flush implementation. Sets saveInFlight to prevent overlap.
   * @param force — if true, write regardless of dirty flag (for saveNow)
   */
  private async doFlush(force: boolean): Promise<void> {
    if (this.saveInFlight) {
      // If forced, wait for the current save to finish, then re-flush
      if (!force) return;
      while (this.saveInFlight) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    if (!force && !SaveSystem.isDirty()) return;

    const slotId = ProfileManager.getCurrentSlotId();
    if (slotId === null) return; // No slot selected — nothing to persist

    this.saveInFlight = true;
    try {
      await SaveSystem.flushToIndexedDB();
    } catch (err) {
      // Don't let a failed write crash the game — log and continue.
      // The dirty flag remains set, so the next timer tick will retry.
      console.error('[AutoSaveManager] flushToIndexedDB failed:', err);
    } finally {
      this.saveInFlight = false;
    }
  }

  // ── Event handlers ──

  /**
   * visibilitychange — fires when tab is hidden (alt-tab, minimize, mobile background).
   * The tab may stay alive for a while after this event, so IndexedDB writes
   * usually complete. We flush sync-ish here.
   */
  private onVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      // Flush if dirty. Fire-and-forget — the tab may be killed before this completes.
      void this.flushIfDirty();
    }
  }

  /**
   * beforeunload — fires when tab is being closed or navigated away.
   *
   * KNOWN BROWSER LIMITATION: IndexedDB writes started during beforeunload
   * may NOT complete before the tab is destroyed. The promise may be left
   * pending and the write lost.
   *
   * MITIGATION: we trigger the IndexedDB write (best-effort) AND mirror to
   * localStorage as a synchronous fallback. On next boot, ProfileDB
   * .recoverFromLocalStorageMirror() will detect if the IndexedDB write
   * didn't complete (localStorage mirror timestamp > IndexedDB lastSavedAt)
   * and recover the data.
   */
  private onBeforeUnload(): void {
    if (!SaveSystem.isDirty()) return;
    const slotId = ProfileManager.getCurrentSlotId();
    if (slotId === null) return;

    // 1. Best-effort IndexedDB write (may not complete)
    void this.flushIfDirty();

    // 2. Synchronous localStorage mirror (will definitely persist)
    const snapshot = SaveSystem.serialize();
    if (snapshot) {
      ProfileDB.emergencyMirrorToLocalStorage(slotId as SlotId, snapshot);
    }
  }

  // ── Test utilities ──

  /** Whether the manager is currently running (for tests). */
  isRunning(): boolean {
    return this.started;
  }

  /** Whether a save is currently in flight (for tests). */
  isSaveInFlight(): boolean {
    return this.saveInFlight;
  }
}

// Singleton — there's only one game running at a time
export const autoSaveManager = new AutoSaveManager();
export default autoSaveManager;
