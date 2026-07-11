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

  /** Get respawn position for current area. Falls back to section start. */
  static getRespawnPosition(currentAreaId: string): { x: number; y: number; section: number } {
    const cp = this.getCheckpoint();
    if (cp && cp.areaId === currentAreaId) {
      return { x: cp.x, y: cp.y, section: cp.section };
    }
    // No checkpoint in this area — respawn at section 1 start
    return { x: 200, y: 420, section: 1 };
  }
}

export default CheckpointSystem;
