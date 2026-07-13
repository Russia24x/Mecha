/**
 * MECHA: LAST PROTOCOL — Fullscreen Manager
 *
 * Unified fullscreen controller that:
 *   1. Requests browser fullscreen on the game's parent container element
 *      (not just Phaser's internal scale mode)
 *   2. Removes Tailwind CSS constraints (aspect-ratio, max-width, border)
 *      via the :fullscreen CSS rule in globals.css
 *   3. Calls Phaser's scale.refresh() after entering/exiting so the canvas
 *      recalculates its dimensions to fill the screen
 *   4. Listens for 'fullscreenchange' events to sync state (user can exit
 *      fullscreen via ESC or browser controls — we must detect that)
 *
 * Usage:
 *   FullscreenManager.init(scale)   — call once after game creation
 *   FullscreenManager.enter()       — request browser fullscreen
 *   FullscreenManager.exit()        — exit browser fullscreen
 *   FullscreenManager.toggle()      — toggle on/off
 *   FullscreenManager.isActive()    — check current state
 *   FullscreenManager.destroy()     — cleanup listeners
 */

import type Phaser from 'phaser';

type FullscreenChangeCallback = (active: boolean) => void;

class FullscreenManagerImpl {
  private scale: Phaser.Scale.ScaleManager | null = null;
  private changeHandler: (() => void) | null = null;
  private listeners: Set<FullscreenChangeCallback> = new Set();

  /**
   * Initialize the manager with Phaser's ScaleManager.
   * Registers a 'fullscreenchange' listener on document to detect when
   * the user exits fullscreen via ESC / browser controls.
   */
  init(scale: Phaser.Scale.ScaleManager): void {
    if (this.scale === scale) return;
    this.cleanup();
    this.scale = scale;
    if (typeof document !== 'undefined') {
      this.changeHandler = () => {
        const active = this.isActive();
        // Notify all registered listeners (settings toggle, etc.)
        for (const cb of this.listeners) {
          try { cb(active); } catch { /* listener error — ignore */ }
        }
        // Refresh Phaser scale after a short delay so the canvas
        // recalculates dimensions for the new screen size
        if (this.scale) {
          setTimeout(() => {
            try { this.scale?.refresh(); } catch { /* scale destroyed */ }
          }, 100);
        }
      };
      document.addEventListener('fullscreenchange', this.changeHandler);
      document.addEventListener('webkitfullscreenchange', this.changeHandler as EventListener);
    }
  }

  /**
   * Register a callback to be notified when fullscreen state changes.
   * Returns an unsubscribe function.
   */
  onChange(cb: FullscreenChangeCallback): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /** Request browser fullscreen on the game's parent container. */
  async enter(): Promise<void> {
    if (!this.scale) return;
    const parent = this.scale.parent;
    if (!parent) return;
    // Exit if already fullscreen
    if (this.isActive()) return;
    try {
      const el = parent as HTMLElement;
      // Prefer requestFullscreen; fall back to webkit prefix for Safari
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
        (el as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
      }
    } catch (err) {
      // Browser may reject (e.g. not triggered by user gesture)
      console.warn('[FullscreenManager] enter failed:', err);
    }
    // Refresh scale after a delay to let the browser apply fullscreen
    setTimeout(() => {
      try { this.scale?.refresh(); } catch { /* */ }
    }, 200);
  }

  /** Exit browser fullscreen. */
  async exit(): Promise<void> {
    if (typeof document === 'undefined') return;
    if (!this.isActive()) return;
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
        (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('[FullscreenManager] exit failed:', err);
    }
    setTimeout(() => {
      try { this.scale?.refresh(); } catch { /* */ }
    }, 200);
  }

  /** Toggle fullscreen on/off. */
  async toggle(): Promise<void> {
    if (this.isActive()) {
      await this.exit();
    } else {
      await this.enter();
    }
  }

  /** Check if browser is currently in fullscreen mode. */
  isActive(): boolean {
    if (typeof document === 'undefined') return false;
    return !!document.fullscreenElement || !!(document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
  }

  /** Cleanup listeners — call on game destroy. */
  cleanup(): void {
    if (this.changeHandler && typeof document !== 'undefined') {
      document.removeEventListener('fullscreenchange', this.changeHandler);
      document.removeEventListener('webkitfullscreenchange', this.changeHandler as EventListener);
      this.changeHandler = null;
    }
    this.listeners.clear();
  }
}

export const FullscreenManager = new FullscreenManagerImpl();
export default FullscreenManager;
