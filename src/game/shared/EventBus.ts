/**
 * MECHA: LAST PROTOCOL - EventBus
 * Thin wrapper around Phaser.Events.EventEmitter for global game events.
 */

import Phaser from 'phaser';

type EventName =
  | 'PLAYER_DAMAGED'
  | 'PLAYER_DEAD'
  | 'ENEMY_DEAD'
  | 'BOSS_PHASE'
  | 'CHECKPOINT'
  | 'GAME_STATE';

class EventBusClass {
  private emitter = new Phaser.Events.EventEmitter();
  private logging = false;

  on(event: EventName, fn: (...args: unknown[]) => void, context?: unknown): void {
    this.emitter.on(event, fn, context);
  }

  once(event: EventName, fn: (...args: unknown[]) => void, context?: unknown): void {
    this.emitter.once(event, fn, context);
  }

  off(event: EventName, fn: (...args: unknown[]) => void, context?: unknown): void {
    this.emitter.off(event, fn, context);
  }

  emit(event: EventName, payload?: unknown): void {
    if (this.logging) console.log(`[EventBus] ${event}`, payload);
    this.emitter.emit(event, payload);
  }

  removeAllListeners(event?: EventName): void {
    this.emitter.removeAllListeners(event);
  }

  setLogging(enabled: boolean): void {
    this.logging = enabled;
  }
}

export const EventBus = new EventBusClass();
export default EventBus;
