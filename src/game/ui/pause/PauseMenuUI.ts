/**
 * MECHA: LAST PROTOCOL — Pause Menu UI
 * Overlay on top of game. Depth 250.
 * Buttons: Resume, Restart, Settings, Quit to Menu.
 * Uses localization for all text.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { InputSystem } from '../../systems/InputSystem';

export class PauseMenuUI {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private buttons: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; onClick: () => void }[] = [];
  private focusIdx = 0;

  constructor(scene: Phaser.Scene, callbacks: {
    onResume: () => void;
    onRestart: () => void;
    onSettings: () => void;
    onQuit: () => void;
  }) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7);
    overlay.setInteractive();
    this.container.add(overlay);

    this.container.add(scene.add.text(w / 2, h / 2 - 140, t('pause.title'), {
      fontFamily: 'monospace', fontSize: '40px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    this.makeBtn(w / 2, h / 2 - 50, t('pause.resume'), callbacks.onResume);
    this.makeBtn(w / 2, h / 2 + 10, t('pause.restart'), callbacks.onRestart);
    this.makeBtn(w / 2, h / 2 + 70, '⚙  ' + t('menu.settings'), callbacks.onSettings);
    this.makeBtn(w / 2, h / 2 + 130, t('pause.quit_menu'), callbacks.onQuit);
  }

  private makeBtn(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.scene.add.rectangle(x, y, 320, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x3a4350);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { this.focusIdx = this.buttons.findIndex(b => b.bg === bg); this.updateFocus(); AudioSystem.play('uiHover'); });
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    const textEl = this.scene.add.text(x, y, label, { fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0' }).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.buttons.push({ bg, text: textEl, onClick });
  }

  private updateFocus(): void {
    this.buttons.forEach((b, i) => {
      if (i === this.focusIdx) {
        b.bg.setFillStyle(0x243040, 1);
        b.bg.setStrokeStyle(2, 0x66f0ff, 1);
        b.text.setColor('#66f0ff');
      } else {
        b.bg.setFillStyle(0x1a2030, 0.95);
        b.bg.setStrokeStyle(1, 0x3a4350);
        b.text.setColor('#cfd6e0');
      }
    });
  }

  show(): void {
    this.container.setVisible(true);
    this.focusIdx = 0;
    this.updateFocus();
  }

  hide(): void {
    this.container.setVisible(false);
  }

  /** Handle gamepad/keyboard navigation. Call from scene update. */
  handleNavigation(): void {
    const input = InputSystem.getState();
    if (input.leftStickY < -0.3 || input.heldUp) {
      this.focusIdx = (this.focusIdx - 1 + this.buttons.length) % this.buttons.length;
      this.updateFocus();
      AudioSystem.play('uiHover');
    } else if (input.leftStickY > 0.3 || input.heldDown) {
      this.focusIdx = (this.focusIdx + 1) % this.buttons.length;
      this.updateFocus();
      AudioSystem.play('uiHover');
    }
    if (input.jumpPressed || input.firePressed) {
      AudioSystem.play('uiClick');
      this.buttons[this.focusIdx]?.onClick();
    }
    // B button = resume (first button)
    if (input.backPressed) {
      AudioSystem.play('uiClick');
      this.buttons[0]?.onClick();  // RESUME is always first
    }
  }

  get isVisible(): boolean { return this.container.visible; }

  destroy(): void {
    this.container.destroy();
  }
}

export default PauseMenuUI;
