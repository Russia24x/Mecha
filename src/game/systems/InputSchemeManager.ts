/**
 * MECHA: LAST PROTOCOL — Input Scheme Manager v1.0
 *
 * Dynamic, intelligent input scheme detection. The system auto-detects whether
 * the player is using keyboard+mouse, Xbox controller, or PlayStation controller,
 * and exposes button labels that match the active scheme.
 *
 * All UI components (control hints, dialogue prompts, interaction prompts,
 * How To Play screen, pause menu) pull labels from here — so when the player
 * switches from keyboard to gamepad (or Xbox to PS), ALL on-screen button
 * prompts update automatically in real time.
 *
 * Detection:
 *   - Polls navigator.getGamepads() every frame
 *   - Inspects gamepad.id for "Sony", "DualShock", "PS4", "PS5" → PlayStation
 *   - Inspects for "Xbox", "XInput", "Microsoft" → Xbox
 *   - Otherwise → generic gamepad (uses Xbox layout as fallback)
 *   - No gamepad connected → keyboard
 *
 * Button mapping (standard gamepad API):
 *   Button 0: A/Cross   → JUMP / INTERACT (near NPC)
 *   Button 1: B/Circle  → DASH / BACK (in menus)
 *   Button 2: X/Square  → FIRE
 *   Button 3: Y/Triangle→ MELEE
 *   Button 4: LB/L1     → WEAPON PREV
 *   Button 5: RB/R1     → WEAPON NEXT
 *   Button 6: LT/L2     → (dash alt)
 *   Button 7: RT/R2     → FIRE (alt)
 *   Button 8: Back/Share→ INTERACT
 *   Button 9: Start/Options → PAUSE
 *   Button 10-13: D-pad
 *
 * Per Phaser 4 skill (input-keyboard-mouse-touch):
 *   - Event-driven detection with fallback polling
 *   - Emits 'INPUT_SCHEME_CHANGED' on EventBus when scheme changes
 *   - All consumers re-render labels on change
 */
import { EventBus } from './EventBus';

export type InputScheme = 'keyboard' | 'xbox' | 'playstation' | 'generic_gamepad';

export type GameAction =
  | 'move' | 'jump' | 'dash' | 'fire' | 'melee'
  | 'interact' | 'pause' | 'back'
  | 'weaponNext' | 'weaponPrev';

interface SchemeLabels {
  [key: string]: string;  // action → display label
}

const KEYBOARD_LABELS: SchemeLabels = {
  move: 'WASD',
  jump: 'SPACE',
  dash: 'SHIFT',
  fire: 'J',
  melee: 'K',
  interact: 'E',
  pause: 'ESC',
  back: 'ESC',
  weaponNext: 'Q',
  weaponPrev: 'E',
};

const XBOX_LABELS: SchemeLabels = {
  move: 'L-STICK',
  jump: 'A',
  dash: 'LT',
  fire: 'X',
  melee: 'Y',
  interact: 'B',
  pause: 'START',
  back: 'B',
  weaponNext: 'RB',
  weaponPrev: 'LB',
};

const PLAYSTATION_LABELS: SchemeLabels = {
  move: 'L-STICK',
  jump: 'CROSS',
  dash: 'L2',
  fire: 'SQUARE',
  melee: 'TRIANGLE',
  interact: 'CIRCLE',
  pause: 'OPTIONS',
  back: 'CIRCLE',
  weaponNext: 'R1',
  weaponPrev: 'L1',
};

const GENERIC_LABELS: SchemeLabels = {
  ...XBOX_LABELS,  // fallback to Xbox layout for generic gamepads
};

export class InputSchemeManager {
  private static currentScheme: InputScheme = 'keyboard';
  private static lastScheme: InputScheme = 'keyboard';
  private static lastCheckTime = 0;
  private static readonly CHECK_INTERVAL_MS = 200;  // poll every 200ms

  /** Get the currently active input scheme. */
  static getActiveScheme(): InputScheme {
    return this.currentScheme;
  }

  /** Get the display label for a game action in the current scheme. */
  static getLabel(action: GameAction): string {
    const labels = this.getLabelsForScheme(this.currentScheme);
    return labels[action] ?? action.toUpperCase();
  }

  /** Get all labels for a specific scheme. */
  static getLabelsForScheme(scheme: InputScheme): SchemeLabels {
    switch (scheme) {
      case 'keyboard': return KEYBOARD_LABELS;
      case 'xbox': return XBOX_LABELS;
      case 'playstation': return PLAYSTATION_LABELS;
      case 'generic_gamepad': return GENERIC_LABELS;
    }
  }

  /** True if the current scheme is a gamepad (any type). */
  static isGamepad(): boolean {
    return this.currentScheme !== 'keyboard';
  }

  /** True if the current scheme is keyboard. */
  static isKeyboard(): boolean {
    return this.currentScheme === 'keyboard';
  }

  /**
   * Per-frame update — polls for gamepad connect/disconnect + type detection.
   * Call from GameScene.update() every frame (cheap internal throttle).
   */
  static update(): void {
    const now = performance.now();
    if (now - this.lastCheckTime < this.CHECK_INTERVAL_MS) return;
    this.lastCheckTime = now;

    const newScheme = this.detectScheme();
    if (newScheme !== this.currentScheme) {
      this.lastScheme = this.currentScheme;
      this.currentScheme = newScheme;
      // Notify all consumers to re-render their button labels
      EventBus.emit('INPUT_SCHEME_CHANGED', { scheme: newScheme, prev: this.lastScheme });
    }
  }

  /** Detect the current input scheme by inspecting connected gamepads. */
  private static detectScheme(): InputScheme {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return 'keyboard';
    const pads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (const p of pads) { if (p) { pad = p; break; } }
    if (!pad) return 'keyboard';

    // Inspect gamepad.id for manufacturer hints
    const id = (pad.id || '').toLowerCase();
    if (id.includes('sony') || id.includes('dualshock') || id.includes('dualsense') ||
        id.includes('ps4') || id.includes('ps5') || id.includes('playstation')) {
      return 'playstation';
    }
    if (id.includes('xbox') || id.includes('xinput') || id.includes('microsoft')) {
      return 'xbox';
    }
    // Generic gamepad — use Xbox layout as fallback (most common layout)
    return 'generic_gamepad';
  }

  /** Force a scheme change (for testing or manual override). */
  static forceScheme(scheme: InputScheme): void {
    if (scheme !== this.currentScheme) {
      this.lastScheme = this.currentScheme;
      this.currentScheme = scheme;
      EventBus.emit('INPUT_SCHEME_CHANGED', { scheme, prev: this.lastScheme });
    }
  }
}

export default InputSchemeManager;
