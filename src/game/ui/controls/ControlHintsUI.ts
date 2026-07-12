/**
 * MECHA: LAST PROTOCOL — ControlHintsUI v1.0
 *
 * Gamepad-aware control hint bar that auto-detects input mode and swaps
 * between keyboard (WASD/SPACE/J/K) and gamepad (A/B/X/Y/LB/RB) iconography.
 *
 * Behavior:
 *   - Polls GamepadManager.connected every frame
 *   - When gamepad connects/disconnects, smoothly swaps hint icons
 *   - Shows compact bottom-bar with: MOVE / JUMP / DASH / FIRE / MELEE / INTERACT
 *   - Auto-hides during dialogue / overlay / pause (visibility flag)
 *
 * Visual style (per Theme.ts):
 *   - Dark translucent bar at bottom-center
 *   - Amber/cyan accent chips for each control
 *   - Monospace labels with letter-spacing
 *
 * Per Phaser 4 skill (input-keyboard-mouse-touch, game-object-components):
 *   - Render once, update only on input mode change (not every frame)
 *   - Use Container + ScrollFactor(0) for screen-fixed overlay
 *   - Listens to GamepadManager + InputSystem events
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { THEME } from '../Theme';
import { GamepadManager } from '../../shared/GamepadManager';

interface HintSlot {
  keyIcon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Rectangle;
}

export class ControlHintsUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private slots: HintSlot[] = [];
  private lastGamepadConnected = false;
  private visible = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(180).setScrollFactor(0, 0, true);
    this.build();
    this.lastGamepadConnected = GamepadManager.isAvailable();
  }

  private build(): void {
    const w = GAME.WIDTH;
    const barY = GAME.HEIGHT - 28;

    // Background bar
    const bar = this.scene.add.rectangle(w / 2, barY, w, 36, 0x05080c, 0.7);
    bar.setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
    this.container.add(bar);

    // Separator line
    const sep = this.scene.add.rectangle(w / 2, barY - 18, w - 100, 1, THEME.CYAN, 0.2);
    this.container.add(sep);

    // Hint slots
    const hints = [
      { id: 'move',    kbKey: 'WASD',  gpKey: 'L-STICK', label: 'MOVE' },
      { id: 'jump',    kbKey: 'SPACE', gpKey: 'A',       label: 'JUMP' },
      { id: 'dash',    kbKey: 'SHIFT', gpKey: 'B',       label: 'DASH' },
      { id: 'fire',    kbKey: 'J',     gpKey: 'X',       label: 'FIRE' },
      { id: 'melee',   kbKey: 'K',     gpKey: 'Y',       label: 'MELEE' },
      { id: 'interact',kbKey: 'E',     gpKey: 'A',       label: 'INTERACT' },
      { id: 'pause',   kbKey: 'ESC',   gpKey: 'START',   label: 'PAUSE' },
    ];

    const slotW = 130;
    const totalW = hints.length * slotW;
    const startX = (w - totalW) / 2 + slotW / 2;

    hints.forEach((hint, i) => {
      const x = startX + i * slotW;

      // Key chip (background pill)
      const bg = this.scene.add.rectangle(x - 30, barY, 44, 20, 0x0d1218, 0.95);
      bg.setStrokeStyle(1, THEME.AMBER, 0.6);
      this.container.add(bg);

      // Key text (will be swapped between KB / GP)
      const keyIcon = this.scene.add.text(x - 30, barY, hint.kbKey, {
        fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_AMBER,
        stroke: '#000', strokeThickness: 2, letterSpacing: 1,
      }).setOrigin(0.5);
      this.container.add(keyIcon);

      // Label
      const label = this.scene.add.text(x + 18, barY, hint.label, {
        fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_MED, letterSpacing: 1,
      }).setOrigin(0, 0.5);
      this.container.add(label);

      this.slots.push({ keyIcon, label, bg });
    });
  }

  /** Per-frame update — detect gamepad connect/disconnect and swap icons. */
  update(): void {
    const gpConnected = GamepadManager.isAvailable();
    if (gpConnected !== this.lastGamepadConnected) {
      this.lastGamepadConnected = gpConnected;
      this.refreshIcons();
      // Brief flash to draw attention to the swap
      this.container.setAlpha(0.3);
      this.scene.tweens.add({
        targets: this.container, alpha: 1, duration: 250, ease: 'Sine.out',
      });
    }
  }

  /** Re-render all key icons based on current input mode. */
  private refreshIcons(): void {
    const hints = this.lastGamepadConnected
      ? ['L-STICK', 'A', 'B', 'X', 'Y', 'A', 'START']
      : ['WASD', 'SPACE', 'SHIFT', 'J', 'K', 'E', 'ESC'];
    const accentColor = this.lastGamepadConnected ? THEME.CYAN : THEME.AMBER;
    this.slots.forEach((slot, i) => {
      if (slot.keyIcon && slot.keyIcon.active) {
        slot.keyIcon.setText(hints[i]);
        slot.keyIcon.setColor(this.lastGamepadConnected ? THEME.TEXT_ACCENT : THEME.TEXT_AMBER);
      }
      if (slot.bg && slot.bg.active) {
        slot.bg.setStrokeStyle(1, accentColor, 0.6);
      }
    });
  }

  /** Show/hide the hint bar (e.g., during dialogue, overlay, pause). */
  setVisible(v: boolean): void {
    this.visible = v;
    this.container.setVisible(v);
  }

  destroy(): void {
    this.container.destroy();
    this.slots = [];
  }
}

export default ControlHintsUI;
