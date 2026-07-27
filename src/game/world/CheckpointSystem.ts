/**
 * MECHA: LAST PROTOCOL — Checkpoint System
 * Manages checkpoint save/restore within areas.
 * When player enters a checkpoint trigger, saves position.
 * On death/respawn, restores to last checkpoint.
 */
import { SaveSystem } from '../systems/SaveSystem';
import { EventBus } from '../systems/EventBus';
import { AudioSystem } from '../systems/AudioSystem';
import { WorldSystem } from './WorldSystem';
import { getArea } from '../data/acts/acts';
import type { CheckpointData } from '../data/types';

export class CheckpointSystem {
  private static currentCheckpoint: CheckpointData | null = null;

  /** Initialize from save on game start. */
  static init(): void {
    this.currentCheckpoint = SaveSystem.get().checkpoint;
  }

  /**
   * Activate a checkpoint — saves to SaveSystem + shows toast.
   * Called when player enters a checkpoint trigger.
   */
  static activate(section: number, x: number, y: number): void {
    const loc = WorldSystem.getCurrent();
    const cp: CheckpointData = {
      actId: loc.actId,
      regionId: loc.regionId,
      areaId: loc.areaId,
      section,
      x,
      y,
      timestamp: Date.now(),
    };
    this.currentCheckpoint = cp;
    SaveSystem.saveCheckpoint(cp);
    EventBus.emit('CHECKPOINT', { section });
    AudioSystem.play('checkpoint');
  }

  /** Get the last checkpoint (for respawn). */
  static getCheckpoint(): CheckpointData | null {
    return this.currentCheckpoint ?? SaveSystem.get().checkpoint;
  }

  /** Check if a checkpoint exists. */
  static hasCheckpoint(): boolean {
    return this.currentCheckpoint !== null || SaveSystem.hasCheckpoint();
  }

  /** Clear checkpoint (on retry/new game). */
  static clear(): void {
    this.currentCheckpoint = null;
    SaveSystem.clearCheckpoint();
  }

  /**
   * Get respawn position for current area. Falls back to section 1 start.
   *
   * E1 fix: fallback was hardcoded {x:200, y:420} — now reads from area data
   * (section 1's x + 200 offset, y=420 for ground level). This is only used
   * when no checkpoint exists for the current area (first entry, or checkpoint
   * was cleared). The bonfire fast-travel path (Phase D) saves a checkpoint
   * at the bonfire's exact position, so this fallback is only for the edge
   * case of entering an area with no prior checkpoint.
   */
  static getRespawnPosition(currentAreaId: string): { x: number; y: number; section: number } {
    const cp = this.getCheckpoint();
    if (cp && cp.areaId === currentAreaId) {
      return { x: cp.x, y: cp.y, section: cp.section };
    }
    // No checkpoint in this area — respawn at section 1 start.
    // E1: read from area data instead of hardcoded {200, 420}.
    const area = getArea(currentAreaId);
    if (area && area.sections.length > 0) {
      const section1 = area.sections[0];
      return { x: section1.x + 200, y: 420, section: 1 };
    }
    // Ultimate fallback if area not found (shouldn't happen — buildPlay
    // early-returns on missing area)
    return { x: 200, y: 420, section: 1 };
  }
}

export default CheckpointSystem;
