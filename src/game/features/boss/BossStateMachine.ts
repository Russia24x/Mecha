/**
 * MECHA: LAST PROTOCOL - BossStateMachine
 * Drives the Guardian AX-09 boss through its phases.
 * Stage 1: 3 phases (Recon → Assault → Frenzy)
 * Stage 2: 2 phases (Awakened → Berserk)
 *
 * Emits 'boss:phase-changed' so UI/visuals can react.
 */
import { BOSS } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';

export type BossPhase = 0 | 1 | 2;

export interface BossStateContext {
  healthPct: number;
  phase: BossPhase;
  speed: number;
  fireRateMs: number;
  phaseName: string;
}

export class BossStateMachine {
  public current: BossPhase = 0;
  private context: BossStateContext;
  private phases: ReadonlyArray<{ healthPct: number; speed: number; fireRateMs: number; name: string }>;

  constructor(stage: 1 | 2 = 1) {
    this.phases = stage === 1 ? BOSS.GUARDIAN_AX09.phases : BOSS.GUARDIAN_AX09_ENRAGED.phases;
    this.context = this.buildContext(0, 1);
  }

  private buildContext(phase: BossPhase, healthPct: number): BossStateContext {
    const p = this.phases[phase];
    return {
      healthPct,
      phase,
      speed: p.speed,
      fireRateMs: p.fireRateMs,
      phaseName: p.name,
    };
  }

  /** Returns true if phase actually changed. */
  update(healthPct: number): boolean {
    let next: BossPhase = 0;
    if (this.phases.length >= 3 && healthPct <= this.phases[2].healthPct) next = 2;
    else if (this.phases.length >= 2 && healthPct <= this.phases[1].healthPct) next = 1;
    else next = 0;

    if (next !== this.current) {
      this.current = next;
      this.context = this.buildContext(next, healthPct);
      EventBus.emit('boss:phase-changed', this.context);
      return true;
    }
    this.context.healthPct = healthPct;
    return false;
  }

  get ctx(): BossStateContext {
    return this.context;
  }
}

export default BossStateMachine;
