/**
 * MECHA: LAST PROTOCOL — Lore Controller
 *
 * Manages the lore panel UI that displays story text when player examines
 * a lore object (terminal/corpse/echo) in the world.
 *
 * Extracted from GameScene to reduce God Object size.
 *
 * CRITICAL BEHAVIOR — gating:
 *   When the lore panel is open, GameScene freezes updatePlay() entirely
 *   (enemies, projectiles, player all stop). This is intentional — the lore
 *   panel is a "gate" not just a UI. GameScene checks loreController.isOpen
 *   before calling updatePlay().
 *
 * Lifecycle:
 *   open(titleKey, textKey) → build panel + show
 *   handleInput(input)      → close on interact/back/click
 *   close()                 → destroy panel
 *   get isOpen              → check state
 *
 * Dependencies: scene (for add.* + time + audio), localization.
 * No back-reference to GameScene.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, fixTextStyle, getLocale } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import type { InputState } from '../../systems/InputSystem';

export class LoreController {
  private panel: Phaser.GameObjects.Container | null = null;
  private closeTimer: Phaser.Time.TimerEvent | null = null;

  constructor(private scene: Phaser.Scene) {}

  get isOpen(): boolean {
    return this.panel !== null;
  }

  /**
   * Open the lore panel with localized title + body text.
   * Keys are resolved via LocalizationSystem.t().
   * If already open, does nothing (guard against re-open).
   */
  open(titleKey: string, textKey: string): void {
    if (this.panel) return;  // guard against re-open
    this.panel = this.buildPanel(titleKey, textKey);
    AudioSystem.play('uiClick');
    // Auto-close after 10 seconds (matches old behavior)
    this.closeTimer = this.scene.time.delayedCall(10000, () => this.close());
  }

  /**
   * Handle input — close on interact press, back press, or ESC.
   * Called from GameScene's input handling chain.
   */
  handleInput(input: InputState): void {
    if (!this.isOpen) return;
    if (input.interactPressed || input.backPressed || input.pausePressed) {
      this.close();
    }
  }

  /** Close the lore panel and clean up. */
  close(): void {
    if (this.closeTimer) {
      this.closeTimer.remove();
      this.closeTimer = null;
    }
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
  }

  /** Destroy — called on cleanupPlay. */
  destroy(): void {
    this.close();
  }

  /**
   * Build the lore panel UI.
   * Depth 285 — above atmosphere (95) + HUD (200), below dialogue (290).
   * This is a direct copy of the old GameScene.showLorePanel() logic,
   * preserving all visual details (corner accents, colors, Persian-aware text).
   */
  private buildPanel(titleKey: string, textKey: string): Phaser.GameObjects.Container {
    const scene = this.scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const panel = scene.add.container(0, 0).setDepth(285).setScrollFactor(0);

    // Dim overlay (also acts as click-to-close target)
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x05080c, 0.9);
    overlay.setInteractive();
    panel.add(overlay);

    const px = w / 2, py = h / 2;
    const pw = 600, ph = 300;
    const bg = scene.add.rectangle(px, py, pw, ph, 0x0a0d14, 0.97);
    bg.setStrokeStyle(2, 0xffc040, 0.7);
    panel.add(bg);

    // Corner accents (amber triangles)
    const cs = 12;
    panel.add(scene.add.polygon(px - pw / 2, py - ph / 2, [0, 0, cs, 0, 0, cs], 0xffc040, 0.7));
    panel.add(scene.add.polygon(px + pw / 2, py - ph / 2, [0, 0, -cs, 0, 0, cs], 0xffc040, 0.7));
    panel.add(scene.add.polygon(px - pw / 2, py + ph / 2, [0, 0, cs, 0, 0, -cs], 0xffc040, 0.7));
    panel.add(scene.add.polygon(px + pw / 2, py + ph / 2, [0, 0, -cs, 0, 0, -cs], 0xffc040, 0.7));

    // Title — Persian-aware (fixTextStyle forces letterSpacing 0 + DejaVu Sans for fa)
    panel.add(scene.add.text(px, py - ph / 2 + 30, t(titleKey), fixTextStyle({
      fontFamily: 'monospace', fontSize: '16px', color: '#ffc040', stroke: '#000', strokeThickness: 4, letterSpacing: 2,
    })).setOrigin(0.5));

    // Divider line
    panel.add(scene.add.rectangle(px, py - ph / 2 + 55, pw - 40, 1, 0x3a3040, 0.7));

    // Body text — Persian-aware
    panel.add(scene.add.text(px, py + 10, t(textKey), fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0', lineSpacing: 6,
      wordWrap: { width: pw - 60 }, align: 'center',
    })).setOrigin(0.5));

    // Close hint — Persian-aware
    const closeHint = getLocale() === 'fa' ? '▲ برای بستن E یا کلیک کنید' : '▲ PRESS E OR CLICK TO CLOSE';
    panel.add(scene.add.text(px, py + ph / 2 - 25, closeHint, fixTextStyle({
      fontFamily: 'monospace', fontSize: '10px', color: '#5a6470', letterSpacing: 2,
    })).setOrigin(0.5));

    // Click overlay to close
    overlay.on('pointerdown', () => this.close());

    return panel;
  }
}

export default LoreController;
