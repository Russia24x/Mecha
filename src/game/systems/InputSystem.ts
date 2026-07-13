/**
 * MECHA: LAST PROTOCOL — Input System v3.2
 *
 * ROOT FIX (v3.2): Keyboard edge-triggered flags were being LOST.
 * Previously, onKeyDown set state.pausePressed=true, but update() reset it
 * to false at the START of the next frame — before GameScene could read it.
 * This is why ESC (pause) and interact never worked via polling.
 *
 * FIX: Keyboard edges are accumulated in `kbEdge` (a separate buffer).
 * update() MERGES kbEdge with gamepad edges into `state`, then CLEARS kbEdge.
 * This guarantees keyboard edges survive until GameScene reads them.
 *
 * - init() attaches window listeners (called ONCE in GameScene.create()).
 * - setCallbacks() registers gameplay callbacks (called by PlayerEntity).
 * - update() merges keyboard + gamepad edges, polls gamepad axes (every frame).
 */
import type { Direction } from '../data/types';

export interface InputCallbacks {
  jump?: () => void;
  fire?: () => void;
  melee?: () => void;
  dash?: (dir: Direction) => void;
  pause?: () => void;
  interact?: () => void;
  weaponNext?: () => void;
  weaponPrev?: () => void;
  grapple?: () => void;
  emp?: () => void;
}

export interface InputState {
  heldLeft: boolean;
  heldRight: boolean;
  heldUp: boolean;
  heldDown: boolean;
  heldFire: boolean;
  heldJump: boolean;
  jumpPressed: boolean;
  firePressed: boolean;
  meleePressed: boolean;
  dashPressed: boolean;
  weaponNextPressed: boolean;
  weaponPrevPressed: boolean;
  pausePressed: boolean;
  interactPressed: boolean;
  backPressed: boolean;
  grapplePressed: boolean;
  empPressed: boolean;
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
  gamepadConnected: boolean;
}

/** Keyboard edge buffer — accumulates key presses between frames. */
interface EdgeBuffer {
  jump: boolean;
  fire: boolean;
  melee: boolean;
  dash: boolean;
  weaponNext: boolean;
  weaponPrev: boolean;
  pause: boolean;
  interact: boolean;
  back: boolean;
  grapple: boolean;
  emp: boolean;
}

/** Keyboard held-state (for auto-repeat prevention + held movement). */
interface KbHeldState {
  jump: boolean;
  fire: boolean;
  melee: boolean;
  dash: boolean;
  weaponNext: boolean;
  weaponPrev: boolean;
  pause: boolean;
  interact: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  grapple: boolean;
  emp: boolean;
}

export class InputSystem {
  private static state: InputState = {
    heldLeft: false, heldRight: false, heldUp: false, heldDown: false, heldFire: false, heldJump: false,
    jumpPressed: false, firePressed: false, meleePressed: false, dashPressed: false,
    weaponNextPressed: false, weaponPrevPressed: false, pausePressed: false, interactPressed: false,
    backPressed: false,
    grapplePressed: false, empPressed: false,
    leftStickX: 0, leftStickY: 0, rightStickX: 0, rightStickY: 0,
    gamepadConnected: false,
  };

  private static prevButtons: boolean[] = [];
  private static listenersAttached = false;
  private static onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private static onKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private static onGamepadConnected: (() => void) | null = null;
  private static onGamepadDisconnected: (() => void) | null = null;
  private static callbacks: InputCallbacks = {};

  // Keyboard edge buffer — set by onKeyDown, consumed by update()
  private static kbEdge: EdgeBuffer = {
    jump: false, fire: false, melee: false, dash: false,
    weaponNext: false, weaponPrev: false, pause: false, interact: false, back: false,
    grapple: false, emp: false,
  };

  // Keyboard held state — tracks which keys are physically held (for auto-repeat prevention)
  private static kbHeld: KbHeldState = {
    jump: false, fire: false, melee: false, dash: false,
    weaponNext: false, weaponPrev: false, pause: false, interact: false,
    left: false, right: false, up: false, down: false,
    grapple: false, emp: false,
  };

  static init(): void {
    if (this.listenersAttached) return;
    if (typeof window === 'undefined') return;
    this.listenersAttached = true;

    this.onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Space':
          if (!this.kbHeld.jump) {
            this.kbHeld.jump = true;
            this.kbEdge.jump = true;
            this.callbacks.jump?.();
          }
          break;
        case 'KeyJ':
          if (!this.kbHeld.fire) {
            this.kbHeld.fire = true;
            this.kbEdge.fire = true;
            this.callbacks.fire?.();
          }
          break;
        case 'KeyK':
          if (!this.kbHeld.melee) {
            this.kbHeld.melee = true;
            this.kbEdge.melee = true;
            this.callbacks.melee?.();
          }
          break;
        case 'KeyE':
          if (!this.kbHeld.interact) {
            this.kbHeld.interact = true;
            this.kbEdge.interact = true;
            this.callbacks.interact?.();
          }
          break;
        case 'KeyQ':
          if (!this.kbHeld.weaponPrev) {
            this.kbHeld.weaponPrev = true;
            this.kbEdge.weaponPrev = true;
            this.callbacks.weaponPrev?.();
          }
          break;
        case 'KeyF':
          // Grapple ability
          if (!this.kbHeld.grapple) {
            this.kbHeld.grapple = true;
            this.kbEdge.grapple = true;
            this.callbacks.grapple?.();
          }
          break;
        case 'KeyG':
          // EMP ability
          if (!this.kbHeld.emp) {
            this.kbHeld.emp = true;
            this.kbEdge.emp = true;
            this.callbacks.emp?.();
          }
          break;
        case 'Escape':
          if (!this.kbHeld.pause) {
            this.kbHeld.pause = true;
            this.kbEdge.pause = true;
            this.kbEdge.back = true;
            this.callbacks.pause?.();
          }
          break;
        case 'ShiftLeft': case 'ShiftRight': {
          if (!this.kbHeld.dash) {
            this.kbHeld.dash = true;
            this.kbEdge.dash = true;
            const dir: Direction = this.kbHeld.left ? 'left' : this.kbHeld.right ? 'right' : 'right';
            this.callbacks.dash?.(dir);
          }
          break;
        }
        case 'KeyA': case 'ArrowLeft':
          this.kbHeld.left = true;
          this.state.heldLeft = true;
          break;
        case 'KeyD': case 'ArrowRight':
          this.kbHeld.right = true;
          this.state.heldRight = true;
          break;
        case 'KeyW': case 'ArrowUp':
          this.kbHeld.up = true;
          this.state.heldUp = true;
          break;
        case 'KeyS': case 'ArrowDown':
          this.kbHeld.down = true;
          this.state.heldDown = true;
          break;
      }
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Space': this.kbHeld.jump = false; break;
        case 'KeyJ': this.kbHeld.fire = false; break;
        case 'KeyK': this.kbHeld.melee = false; break;
        case 'KeyE': this.kbHeld.interact = false; break;
        case 'KeyQ': this.kbHeld.weaponPrev = false; break;
        case 'KeyF': this.kbHeld.grapple = false; break;
        case 'KeyG': this.kbHeld.emp = false; break;
        case 'Escape': this.kbHeld.pause = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.kbHeld.dash = false; break;
        case 'KeyA': case 'ArrowLeft':
          this.kbHeld.left = false;
          this.state.heldLeft = false;
          break;
        case 'KeyD': case 'ArrowRight':
          this.kbHeld.right = false;
          this.state.heldRight = false;
          break;
        case 'KeyW': case 'ArrowUp':
          this.kbHeld.up = false;
          this.state.heldUp = false;
          break;
        case 'KeyS': case 'ArrowDown':
          this.kbHeld.down = false;
          this.state.heldDown = false;
          break;
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    // *** FIX: store references so destroy() can remove them (was leaking anonymous arrows)
    this.onGamepadConnected = () => { this.state.gamepadConnected = true; };
    this.onGamepadDisconnected = () => { this.state.gamepadConnected = false; };
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  static setCallbacks(callbacks: InputCallbacks): void {
    this.callbacks = callbacks;
  }

  static clearCallbacks(): void {
    this.callbacks = {};
  }

  /**
   * Merge keyboard edges + poll gamepad. Call every frame.
   * Keyboard edges survive from when they were pressed until this method runs.
   */
  static update(): void {
    // Start with keyboard edges (these survived from keypress until now)
    let gpJump = false, gpFire = false, gpMelee = false, gpDash = false;
    let gpWeaponNext = false, gpWeaponPrev = false, gpPause = false, gpInteract = false, gpBack = false;

    // Poll gamepad
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      let pad: Gamepad | null = null;
      for (const p of pads) { if (p) { pad = p; break; } }
      if (pad) {
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

        if (edge(0)) { gpJump = true; this.callbacks.jump?.(); }
        if (edge(2) || edge(7)) { gpFire = true; this.callbacks.fire?.(); }
        if (edge(3)) { gpMelee = true; this.callbacks.melee?.(); }
        // Interact = B/Circle (button 1) — also serves as Back in menus
        if (edge(1)) { gpInteract = true; gpBack = true; this.callbacks.interact?.(); }
        // Dash = LT/L2 (button 6) — trigger, not face button
        if (edge(6)) {
          gpDash = true;
          this.callbacks.dash?.(this.state.leftStickX < -0.2 ? 'left' : this.state.leftStickX > 0.2 ? 'right' : 'right');
        }
        if (edge(5)) { gpWeaponNext = true; this.callbacks.weaponNext?.(); }
        if (edge(4)) { gpWeaponPrev = true; this.callbacks.weaponPrev?.(); }
        if (edge(9)) { gpPause = true; this.callbacks.pause?.(); }
        // Grapple = D-pad Up (button 12), EMP = D-pad Down (button 13)
        if (edge(12)) { this.kbEdge.grapple = true; this.callbacks.grapple?.(); }
        if (edge(13)) { this.kbEdge.emp = true; this.callbacks.emp?.(); }

        // D-pad Left/Right overrides left stick for movement (Up/Down reserved for abilities)
        if (held(14)) this.state.leftStickX = -1;
        if (held(15)) this.state.leftStickX = 1;

        // Held states
        this.state.heldFire = this.kbHeld.fire || held(2) || held(7);
        this.state.heldJump = this.kbHeld.jump || held(0);
        this.prevButtons = btns;
      } else {
        this.state.gamepadConnected = false;
        this.state.heldFire = this.kbHeld.fire;
        this.state.heldJump = this.kbHeld.jump;
        // Reset axes when no gamepad
        this.state.leftStickX = 0;
        this.state.leftStickY = 0;
        this.state.rightStickX = 0;
        this.state.rightStickY = 0;
      }
    } else {
      this.state.heldFire = this.kbHeld.fire;
      this.state.heldJump = this.kbHeld.jump;
    }

    // *** MERGE keyboard edges + gamepad edges into state ***
    // This is the key fix: keyboard edges are NOT lost between frames.
    this.state.jumpPressed = this.kbEdge.jump || gpJump;
    this.state.firePressed = this.kbEdge.fire || gpFire;
    this.state.meleePressed = this.kbEdge.melee || gpMelee;
    this.state.dashPressed = this.kbEdge.dash || gpDash;
    this.state.weaponNextPressed = this.kbEdge.weaponNext || gpWeaponNext;
    this.state.weaponPrevPressed = this.kbEdge.weaponPrev || gpWeaponPrev;
    this.state.pausePressed = this.kbEdge.pause || gpPause;
    this.state.interactPressed = this.kbEdge.interact || gpInteract;
    this.state.backPressed = this.kbEdge.back || gpBack;
    this.state.grapplePressed = this.kbEdge.grapple;
    this.state.empPressed = this.kbEdge.emp;

    // Clear keyboard edges (consumed by GameScene this frame)
    this.kbEdge.jump = false;
    this.kbEdge.fire = false;
    this.kbEdge.melee = false;
    this.kbEdge.dash = false;
    this.kbEdge.weaponNext = false;
    this.kbEdge.weaponPrev = false;
    this.kbEdge.pause = false;
    this.kbEdge.interact = false;
    this.kbEdge.back = false;
    this.kbEdge.grapple = false;
    this.kbEdge.emp = false;
  }

  static getState(): Readonly<InputState> { return this.state; }

  static destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
      if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
      // *** FIX: remove gamepad listeners too (was leaking)
      if (this.onGamepadConnected) window.removeEventListener('gamepadconnected', this.onGamepadConnected);
      if (this.onGamepadDisconnected) window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    }
    this.listenersAttached = false;
    this.onKeyDown = null;
    this.onKeyUp = null;
    this.onGamepadConnected = null;
    this.onGamepadDisconnected = null;
    this.callbacks = {};
    this.kbEdge = { jump: false, fire: false, melee: false, dash: false, weaponNext: false, weaponPrev: false, pause: false, interact: false, back: false, grapple: false, emp: false };
    this.kbHeld = { jump: false, fire: false, melee: false, dash: false, weaponNext: false, weaponPrev: false, pause: false, interact: false, left: false, right: false, up: false, down: false, grapple: false, emp: false };
  }

  static isGamepadAvailable(): boolean {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return false;
    return Array.from(navigator.getGamepads()).some(p => p !== null);
  }
}

export default InputSystem;
