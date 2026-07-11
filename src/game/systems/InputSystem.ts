/**
 * MECHA: LAST PROTOCOL — Input System
 * Unified keyboard + gamepad input. Independent of Player.
 * Systems poll InputSystem.getState() each frame.
 */
import type { Direction } from '../data/types';

export interface InputState {
  // Held movement
  heldLeft: boolean;
  heldRight: boolean;
  heldUp: boolean;
  heldDown: boolean;
  heldFire: boolean;
  // Edge-triggered actions
  jumpPressed: boolean;
  firePressed: boolean;
  meleePressed: boolean;
  dashPressed: boolean;
  weaponNextPressed: boolean;
  weaponPrevPressed: boolean;
  pausePressed: boolean;
  interactPressed: boolean;
  backPressed: boolean;      // B button or Back — for "go back" in menus
  // Analog
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
  // Connected
  gamepadConnected: boolean;
}

export class InputSystem {
  private static state: InputState = {
    heldLeft: false, heldRight: false, heldUp: false, heldDown: false, heldFire: false,
    jumpPressed: false, firePressed: false, meleePressed: false, dashPressed: false,
    weaponNextPressed: false, weaponPrevPressed: false, pausePressed: false, interactPressed: false,
    backPressed: false,
    leftStickX: 0, leftStickY: 0, rightStickX: 0, rightStickY: 0,
    gamepadConnected: false,
  };

  private static prevButtons: boolean[] = [];
  private static listenersAttached = false;
  private static onKeyDown!: (e: KeyboardEvent) => void;
  private static onKeyUp!: (e: KeyboardEvent) => void;
  private static callbacks: { jump?: () => void; fire?: () => void; melee?: () => void; dash?: (dir: Direction) => void; pause?: () => void; interact?: () => void; weaponNext?: () => void; weaponPrev?: () => void; } = {};

  static init(callbacks: { jump?: () => void; fire?: () => void; melee?: () => void; dash?: (dir: Direction) => void; pause?: () => void; interact?: () => void; weaponNext?: () => void; weaponPrev?: () => void; }): void {
    this.callbacks = callbacks;
    if (this.listenersAttached) return;
    if (typeof window === 'undefined') return;
    this.listenersAttached = true;

    this.onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Space': this.state.jumpPressed = true; this.callbacks.jump?.(); break;
        case 'KeyJ': this.state.firePressed = true; this.state.heldFire = true; this.callbacks.fire?.(); break;
        case 'KeyK': this.state.meleePressed = true; this.callbacks.melee?.(); break;
        case 'KeyE': this.state.interactPressed = true; this.callbacks.interact?.(); break;
        case 'KeyQ': this.state.weaponPrevPressed = true; this.callbacks.weaponPrev?.(); break;
        case 'Escape': this.state.pausePressed = true; this.callbacks.pause?.(); break;
        case 'ShiftLeft': case 'ShiftRight': {
          this.state.dashPressed = true;
          const dir: Direction = this.state.heldLeft ? 'left' : this.state.heldRight ? 'right' : 'right';
          this.callbacks.dash?.(dir);
          break;
        }
        case 'KeyA': case 'ArrowLeft': this.state.heldLeft = true; break;
        case 'KeyD': case 'ArrowRight': this.state.heldRight = true; break;
        case 'KeyW': case 'ArrowUp': this.state.heldUp = true; break;
        case 'KeyS': case 'ArrowDown': this.state.heldDown = true; break;
      }
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyA': case 'ArrowLeft': this.state.heldLeft = false; break;
        case 'KeyD': case 'ArrowRight': this.state.heldRight = false; break;
        case 'KeyW': case 'ArrowUp': this.state.heldUp = false; break;
        case 'KeyS': case 'ArrowDown': this.state.heldDown = false; break;
        case 'KeyJ': this.state.heldFire = false; break;
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    window.addEventListener('gamepadconnected', () => { this.state.gamepadConnected = true; });
    window.addEventListener('gamepaddisconnected', () => { this.state.gamepadConnected = false; });
  }

  /** Poll gamepad + reset edge-triggered flags. Call every frame. */
  static update(): void {
    // Reset edge flags
    this.state.jumpPressed = false;
    this.state.firePressed = false;
    this.state.meleePressed = false;
    this.state.dashPressed = false;
    this.state.weaponNextPressed = false;
    this.state.weaponPrevPressed = false;
    this.state.pausePressed = false;
    this.state.interactPressed = false;
    this.state.backPressed = false;

    // Poll gamepad
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (const p of pads) { if (p) { pad = p; break; } }
    if (!pad) { this.state.gamepadConnected = false; return; }
    this.state.gamepadConnected = true;

    const deadzone = 0.18;
    const ax = (v: number) => Math.abs(v) < deadzone ? 0 : v;
    this.state.leftStickX = ax(pad.axes[0] ?? 0);
    this.state.leftStickY = ax(pad.axes[1] ?? 0);
    this.state.rightStickX = ax(pad.axes[2] ?? 0);
    this.state.rightStickY = ax(pad.axes[3] ?? 0);

    const btns = pad.buttons.map(b => b.pressed);
    const edge = (i: number) => btns[i] && !this.prevButtons[i];
    const held = (i: number) => btns[i];

    // Each button has exactly one role
    // A(0)=jump/confirm, B(1)=back/cancel, X(2)=fire, Y(3)=melee
    // LB(4)=weapon prev, RB(5)=weapon next, LT(6)=dash, RT(7)=fire alt
    // Back(8)=interact/back, Start(9)=pause, L3(10)=dash alt
    if (edge(0)) { this.state.jumpPressed = true; this.callbacks.jump?.(); }
    if (edge(2) || edge(7)) { this.state.firePressed = true; this.callbacks.fire?.(); }
    if (edge(3)) { this.state.meleePressed = true; this.callbacks.melee?.(); }
    if (edge(1)) { this.state.backPressed = true; }  // B = back in menus (no callback — handled by polling)
    if (edge(6) || edge(10)) { this.state.dashPressed = true; this.callbacks.dash?.(this.state.leftStickX < -0.2 ? 'left' : this.state.leftStickX > 0.2 ? 'right' : 'right'); }
    if (edge(5)) { this.state.weaponNextPressed = true; this.callbacks.weaponNext?.(); }
    if (edge(4)) { this.state.weaponPrevPressed = true; this.callbacks.weaponPrev?.(); }
    if (edge(9)) { this.state.pausePressed = true; this.callbacks.pause?.(); }
    if (edge(8)) { this.state.interactPressed = true; this.callbacks.interact?.(); }

    // D-pad overrides
    if (held(12)) this.state.leftStickY = -1;
    if (held(13)) this.state.leftStickY = 1;
    if (held(14)) this.state.leftStickX = -1;
    if (held(15)) this.state.leftStickX = 1;

    // Held states — combine keyboard (set by keydown/keyup handlers) + gamepad
    const kbFire = this.state.heldFire; // keyboard sets this via keydown-J / keyup-J
    this.state.heldFire = kbFire || held(2) || held(7);

    this.prevButtons = btns;
  }

  static getState(): Readonly<InputState> { return this.state; }

  static destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
      if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    }
    this.listenersAttached = false;
  }

  static isGamepadAvailable(): boolean {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return false;
    return Array.from(navigator.getGamepads()).some(p => p !== null);
  }
}

export default InputSystem;
