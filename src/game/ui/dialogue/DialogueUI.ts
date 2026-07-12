/**
 * MECHA: LAST PROTOCOL — Dialogue UI
 * Bottom-of-screen dialogue box with speaker name + lines.
 * Supports RTL (Persian) and advance on click/Enter.
 * Depth 210 (above HUD).
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { DialogueSystem, type DialogueLine } from '../../systems/DialogueSystem';
import { t, getLocale, fixTextStyle, isRTL } from '../../systems/LocalizationSystem';
import { NPCSystem } from '../../systems/NPCSystem';
import { EventBus } from '../../systems/EventBus';

export class DialogueUI {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private box: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private lineText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private advanceHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    // Depth raised to 290 — above ALL atmosphere/filter layers (max 95) + HUD (200) + lore panel (280)
    this.container = scene.add.container(0, 0).setDepth(290).setVisible(false);

    // Box (bottom 1/3 of screen) — semi-opaque so it stays readable over any backdrop
    this.box = scene.add.rectangle(w / 2, h - 80, w - 80, 100, 0x0a0d14, 0.95);
    this.box.setStrokeStyle(2, 0x39d0d8, 0.7);
    this.container.add(this.box);

    // Speaker name — Persian-aware font
    this.nameText = scene.add.text(60, h - 120, '', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: '#39d0d8',
    })).setOrigin(0, 0.5);
    this.container.add(this.nameText);

    // Dialogue line — Persian-aware font (forces letterSpacing 0 + DejaVu Sans for fa)
    this.lineText = scene.add.text(60, h - 80, '', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0',
      wordWrap: { width: w - 160 }, maxLines: 3,
    })).setOrigin(0, 0.5);
    this.container.add(this.lineText);

    // Hint (press Enter / click)
    this.hintText = scene.add.text(w - 60, h - 30, '▼', fixTextStyle({
      fontFamily: 'monospace', fontSize: '12px', color: '#5a6470',
    })).setOrigin(1, 0.5);
    this.container.add(this.hintText);

    // Pulsing hint animation
    scene.tweens.add({
      targets: this.hintText, alpha: { from: 0.3, to: 1 },
      duration: 600, yoyo: true, repeat: -1,
    });

    // Advance on click or Enter
    this.box.setInteractive({ useHandCursor: true });
    this.box.on('pointerdown', () => this.advance());

    // setScrollFactor(0,0,true) AFTER all children are added
    this.container.setScrollFactor(0, 0, true);
  }

  /** Show a dialogue by ID. Sets up advance handler. */
  show(dialogueId: string): void {
    const started = DialogueSystem.start(dialogueId);
    if (!started) return;
    this.container.setVisible(true);
    this.renderLine();

    // *** FIX: remove previous listener BEFORE adding new one (prevents leak).
    // Also filter by key code so WASD/arrows don't advance the dialogue.
    if (this.advanceHandler) {
      window.removeEventListener('keydown', this.advanceHandler);
    }
    this.advanceHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        this.advance();
      }
    };
    window.addEventListener('keydown', this.advanceHandler);
  }

  private renderLine(): void {
    const line = DialogueSystem.getCurrentLine();
    if (!line) { this.hide(); return; }
    this.nameText.setText(line.speakerName);

    // RTL support for Persian
    const isRTL = getLocale() === 'fa';
    if (isRTL) {
      this.lineText.setAlign('right');
      this.lineText.setOrigin(1, 0.5);
      this.lineText.setPosition(GAME.WIDTH - 60, GAME.HEIGHT - 80);
      this.nameText.setOrigin(1, 0.5);
      this.nameText.setPosition(GAME.WIDTH - 60, GAME.HEIGHT - 120);
    } else {
      this.lineText.setAlign('left');
      this.lineText.setOrigin(0, 0.5);
      this.lineText.setPosition(60, GAME.HEIGHT - 80);
      this.nameText.setOrigin(0, 0.5);
      this.nameText.setPosition(60, GAME.HEIGHT - 120);
    }
    this.lineText.setText(line.text);
    this.hintText.setVisible(!line.isLast);
  }

  /** Advance to next line or close dialogue. Public for gamepad support. */
  advance(): void {
    // Only respond to Enter/Space/click
    if (!DialogueSystem.isActive) return;
    const hasMore = DialogueSystem.advance();
    if (hasMore) {
      this.renderLine();
    } else {
      this.hide();
    }
  }

  /** Hide the dialogue box. */
  hide(): void {
    DialogueSystem.end();
    this.container.setVisible(false);
    if (this.advanceHandler) {
      window.removeEventListener('keydown', this.advanceHandler);
      this.advanceHandler = null;
    }
  }

  get isVisible(): boolean { return this.container.visible; }

  destroy(): void {
    if (this.advanceHandler) window.removeEventListener('keydown', this.advanceHandler);
    this.container.destroy();
  }
}

export default DialogueUI;
