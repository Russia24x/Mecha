/**
 * MECHA: LAST PROTOCOL — ControlHintsUI v2.0
 *
 * Dynamic control hint bar that auto-adapts to keyboard / Xbox / PlayStation.
 * Pulls button labels from InputSchemeManager — when the player switches
 * input devices, ALL hint icons update in real time without page reload.
 *
 * Behavior:
 *   - Listens to 'INPUT_SCHEME_CHANGED' event from EventBus
 *   - Shows compact bottom-bar with: MOVE / JUMP / DASH / FIRE / MELEE / INTERACT / PAUSE
 *   - Each slot shows the correct button label for the active scheme:
 *     Keyboard: WASD / SPACE / SHIFT / J / K / E / ESC
 *     Xbox:     L-STICK / A / B / X / Y / A / START
 *     PS:       L-STICK / CROSS / CIRCLE / SQUARE / TRIANGLE / CROSS / OPTIONS
 *   - Auto-hides during dialogue / overlay / pause
 *   - Brief alpha flash on scheme change to draw attention
 *
 * Per Phaser 4 skill (input-keyboard-mouse-touch, events-system):
 *   - EventBus subscription for scheme changes
 *   - Render once, re-render labels only on scheme change
 *   - Container + ScrollFactor(0) for screen-fixed overlay
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { THEME } from '../Theme';
import { InputSchemeManager, type GameAction } from '../../systems/InputSchemeManager';
import { EventBus } from '../../systems/EventBus';
import { fixTextStyle } from '../../systems/LocalizationSystem';

interface HintSlot {
  keyIcon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Rectangle;
  action: GameAction;
}

export class ControlHintsUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private slots: HintSlot[] = [];
  private schemeChangeHandler: ((payload: unknown) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(180).setScrollFactor(0, 0, true);
    this.build();
    // Listen for scheme changes → re-render labels
    this.schemeChangeHandler = () => this.refreshIcons();
    EventBus.on('INPUT_SCHEME_CHANGED', this.schemeChangeHandler);
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

    // Hint slots — each tied to a GameAction
    const hints: { action: GameAction; label: string }[] = [
      { action: 'move',         label: 'MOVE' },
      { action: 'jump',         label: 'JUMP' },
      { action: 'dash',         label: 'DASH' },
      { action: 'fire',         label: 'FIRE' },
      { action: 'melee',        label: 'MELEE' },
      { action: 'interact',     label: 'INTERACT' },
      { action: 'pause',        label: 'PAUSE' },
    ];

    const slotW = 130;
    const totalW = hints.length * slotW;
    const startX = (w - totalW) / 2 + slotW / 2;

    hints.forEach((hint, i) => {
      const x = startX + i * slotW;

      // Key chip (background pill)
      const bg = this.scene.add.rectangle(x - 30, barY, 50, 20, 0x0d1218, 0.95);
      bg.setStrokeStyle(1, THEME.AMBER, 0.6);
      this.container.add(bg);

      // Key text (will be swapped between KB / Xbox / PS labels)
      const keyIcon = this.scene.add.text(x - 30, barY, '', fixTextStyle({
        fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_AMBER,
        stroke: '#000', strokeThickness: 2,
      })).setOrigin(0.5);
      this.container.add(keyIcon);

      // Label
      const label = this.scene.add.text(x + 18, barY, hint.label, fixTextStyle({
        fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_MED,
      })).setOrigin(0, 0.5);
      this.container.add(label);

      this.slots.push({ keyIcon, label, bg, action: hint.action });
    });

    // Initial render
    this.refreshIcons();
  }

  /** Re-render all key icons based on current input scheme. */
  private refreshIcons(): void {
    const isGamepad = InputSchemeManager.isGamepad();
    const accentColor = isGamepad ? THEME.CYAN : THEME.AMBER;
    const textColor = isGamepad ? THEME.TEXT_ACCENT : THEME.TEXT_AMBER;

    this.slots.forEach((slot) => {
      if (!slot.keyIcon || !slot.keyIcon.active) return;
      const label = InputSchemeManager.getLabel(slot.action);
      slot.keyIcon.setText(label);
      slot.keyIcon.setColor(textColor);
      if (slot.bg && slot.bg.active) {
        slot.bg.setStrokeStyle(1, accentColor, 0.6);
      }
    });

    // Brief flash to draw attention to the swap
    this.container.setAlpha(0.3);
    this.scene.tweens.add({
      targets: this.container, alpha: 1, duration: 250, ease: 'Sine.out',
    });
  }

  /** Per-frame update stub. ControlHintsUI v2.0 is event-driven (no per-frame work needed). */
  update(): void {
    // No-op — labels update on 'INPUT_SCHEME_CHANGED' event, not per-frame.
  }

  /** Show/hide the hint bar (e.g., during dialogue, overlay, pause). */
  setVisible(v: boolean): void {
    this.container.setVisible(v);
  }

  destroy(): void {
    if (this.schemeChangeHandler) {
      EventBus.off('INPUT_SCHEME_CHANGED', this.schemeChangeHandler);
      this.schemeChangeHandler = null;
    }
    this.container.destroy();
    this.slots = [];
  }
}

export default ControlHintsUI;
