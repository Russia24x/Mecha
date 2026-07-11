/**
 * MECHA: LAST PROTOCOL — EventBus
 * Global event system. All inter-system communication goes through here.
 * Systems never import each other directly.
 */
import Phaser from 'phaser';
import type { GameEvent } from '../data/types';

type EventPayload = unknown;

class EventBusClass {
  private emitter = new Phaser.Events.EventEmitter();
  private logging = false;

  on(event: GameEvent, fn: (payload?: EventPayload) => void, context?: unknown): void {
    this.emitter.on(event, fn, context);
  }

  once(event: GameEvent, fn: (payload?: EventPayload) => void, context?: unknown): void {
    this.emitter.once(event, fn, context);
  }

  off(event: GameEvent, fn?: (payload?: EventPayload) => void, context?: unknown): void {
    if (fn) {
      this.emitter.off(event, fn, context);
    } else {
      this.emitter.removeAllListeners(event);
    }
  }

  emit(event: GameEvent, payload?: EventPayload): void {
    if (this.logging) console.log(`[EventBus] ${event}`, payload);
    this.emitter.emit(event, payload);
  }

  removeAllListeners(event?: GameEvent): void {
    this.emitter.removeAllListeners(event);
  }

  setLogging(enabled: boolean): void {
    this.logging = enabled;
  }
}

export const EventBus = new EventBusClass();
export default EventBus;
