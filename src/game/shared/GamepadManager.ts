/**
 * MECHA: LAST PROTOCOL - GamepadManager
 * HTML5 Gamepad API integration. Polls all connected gamepads every frame.
 *
 * Layout (Xbox 360 / PS4 / Generic):
 *   A/Cross (0) → jump
 *   X/Square (2) → fire
 *   Y/Triangle (3) → melee
 *   B/Circle (1) → dash
 *   LB (4) → weapon prev
 *   RB (5) → weapon next
 *   Start (9) → pause
 *   Back (8) → menu back
 */

export interface GamepadState {
  connected: boolean;
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
  jumpPressed: boolean;
  firePressed: boolean;
  meleePressed: boolean;
  dashPressed: boolean;
  weaponNextPressed: boolean;
  weaponPrevPressed: boolean;
  pausePressed: boolean;
  backPressed: boolean;
  jumpHeld: boolean;
  fireHeld: boolean;
}

export class GamepadManager {
  private static state: GamepadState = {
    connected: false,
    leftStickX: 0, leftStickY: 0,
    rightStickX: 0, rightStickY: 0,
    jumpPressed: false, firePressed: false, meleePressed: false,
    dashPressed: false, weaponNextPressed: false, weaponPrevPressed: false,
    pausePressed: false, backPressed: false,
    jumpHeld: false, fireHeld: false,
  };

  private static prevButtons: boolean[] = [];
  private static listenersAttached = false;
  private static enabled = true;

  static setEnabled(v: boolean): void { this.enabled = v; if (!v) this.reset(); }
  static isEnabled(): boolean { return this.enabled; }

  static init(): void {
    if (this.listenersAttached) return;
    if (typeof window === 'undefined') return;
    window.addEventListener('gamepadconnected', (e) => {
      this.state.connected = true;
      console.log('[Gamepad] connected:', e.gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.state.connected = false;
      console.log('[Gamepad] disconnected');
    });
    this.listenersAttached = true;
  }

  private static reset(): void {
    this.state.leftStickX = 0;
    this.state.leftStickY = 0;
    this.state.jumpPressed = false;
    this.state.firePressed = false;
    this.state.meleePressed = false;
    this.state.dashPressed = false;
    this.state.weaponNextPressed = false;
    this.state.weaponPrevPressed = false;
    this.state.pausePressed = false;
    this.state.backPressed = false;
    this.state.jumpHeld = false;
    this.state.fireHeld = false;
  }

  static update(): void {
    this.state.jumpPressed = false;
    this.state.firePressed = false;
    this.state.meleePressed = false;
    this.state.dashPressed = false;
    this.state.weaponNextPressed = false;
    this.state.weaponPrevPressed = false;
    this.state.pausePressed = false;
    this.state.backPressed = false;

    if (!this.enabled) return;
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

    const pads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (const p of pads) { if (p) { pad = p; break; } }
    if (!pad) { this.state.connected = false; return; }
    this.state.connected = true;

    const deadzone = 0.18;
    const ax = (v: number) => Math.abs(v) < deadzone ? 0 : v;
    this.state.leftStickX = ax(pad.axes[0] ?? 0);
    this.state.leftStickY = ax(pad.axes[1] ?? 0);
    this.state.rightStickX = ax(pad.axes[2] ?? 0);
    this.state.rightStickY = ax(pad.axes[3] ?? 0);

    const btns = pad.buttons.map(b => b.pressed);
    const edge = (i: number) => btns[i] && !this.prevButtons[i];
    const held = (i: number) => btns[i];

    // Each button has exactly one role to avoid conflicts.
    this.state.jumpPressed = edge(0);
    this.state.firePressed = edge(2) || edge(7);
    this.state.meleePressed = edge(3);
    this.state.dashPressed = edge(1);
    this.state.weaponNextPressed = edge(5);
    this.state.weaponPrevPressed = edge(4);
    this.state.pausePressed = edge(9);
    this.state.backPressed = edge(8);

    // D-pad overrides left stick for menu navigation.
    if (held(12)) this.state.leftStickY = -1;
    if (held(13)) this.state.leftStickY = 1;
    if (held(14)) this.state.leftStickX = -1;
    if (held(15)) this.state.leftStickX = 1;

    this.state.jumpHeld = held(0);
    this.state.fireHeld = held(2) || held(7);
    this.prevButtons = btns;
  }

  static getState(): Readonly<GamepadState> { return this.state; }

  static isAvailable(): boolean {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return false;
    const pads = navigator.getGamepads();
    return Array.from(pads).some(p => p !== null);
  }
}

export default GamepadManager;
