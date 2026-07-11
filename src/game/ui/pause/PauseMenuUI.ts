/**
 * MECHA: LAST PROTOCOL — Pause Menu UI v3.4
 *
 * ROOT FIX for mouse not working in pause menu:
 * Phaser Container.setScrollFactor(0,0,true) is SUPPOSED to update children,
 * but it doesn't work reliably in Phaser 4.2.1 during constructor.
 * Instead, each child explicitly calls setScrollFactor(0) on creation.
 *
 * Without this, children have scrollFactor=1, so when the camera scrolls
 * (following the player), the hit-test coordinates are offset and clicks
 * never land on buttons.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { InputSystem } from '../../systems/InputSystem';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onSkills: () => void;
  onInventory: () => void;
  onQuests: () => void;
  onMap: () => void;
  onReturnToHub: () => void;
  onQuit: () => void;
}

export class PauseMenuUI {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private buttons: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; onClick: () => void }[] = [];
  private focusIdx = 0;
  private navCooldown = 0;

  constructor(scene: Phaser.Scene, callbacks: PauseMenuCallbacks) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    this.container = scene.add.container(0, 0).setDepth(300).setVisible(false);
    this.container.scrollFactorX = 0;
    this.container.scrollFactorY = 0;

    // Overlay — visual only, NOT interactive (doesn't block button clicks)
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.75).setScrollFactor(0);
    this.container.add(overlay);

    // Title
    const titleText = scene.add.text(w / 2, 50, t('pause.title'), {
      fontFamily: 'monospace', fontSize: '32px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0);
    this.container.add(titleText);

    const isFa = getLocale() === 'fa';
    const L = (en: string, fa: string) => isFa ? fa : en;

    const colW = 210, rowH = 44, gap = 8;
    const startX = w / 2 - colW - gap / 2;
    const startY = 110;

    this.makeBtn(w / 2, startY, '▶  ' + t('pause.resume'), callbacks.onResume, colW * 2 + gap);
    this.makeBtn(startX + colW / 2, startY + rowH + gap, '⚔  ' + L('SKILLS', 'مهارت‌ها'), callbacks.onSkills, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + rowH + gap, '🎒  ' + L('INVENTORY', 'کیف'), callbacks.onInventory, colW);
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 2, '📜  ' + L('QUESTS', 'ماموریت‌ها'), callbacks.onQuests, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 2, '🗺  ' + L('MAP', 'نقشه'), callbacks.onMap, colW);
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 3, '⚙  ' + t('menu.settings'), callbacks.onSettings, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 3, '↻  ' + t('pause.restart'), callbacks.onRestart, colW);
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 4, '⌂  ' + t('pause.quit_hub'), callbacks.onReturnToHub, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 4, '✕  ' + t('pause.quit_menu'), callbacks.onQuit, colW);
  }

  private makeBtn(x: number, y: number, label: string, onClick: () => void, width: number = 320): void {
    const bg = this.scene.add.rectangle(x, y, width, 40, 0x0a1018, 0.9).setScrollFactor(0);
    bg.setStrokeStyle(1, 0x1a3040, 0.8);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      this.focusIdx = this.buttons.findIndex(b => b.bg === bg);
      this.updateFocus();
      AudioSystem.play('uiHover');
    });
    bg.on('pointerout', () => this.updateFocus());
    bg.on('pointerdown', () => {
      AudioSystem.play('uiClick');
      onClick();
    });
    const textEl = this.scene.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '14px', color: '#5a6470',
    }).setOrigin(0.5).setScrollFactor(0);
    this.container.add([bg, textEl]);
    this.buttons.push({ bg, text: textEl, onClick });
  }

  private updateFocus(): void {
    this.buttons.forEach((b, i) => {
      if (i === this.focusIdx) {
        b.bg.setFillStyle(0x0d1820, 1);
        b.bg.setStrokeStyle(2, 0x39d0d8, 0.9);
        b.bg.setScale(1.03);
        b.text.setColor('#66f0ff');
      } else {
        b.bg.setFillStyle(0x0a1018, 0.9);
        b.bg.setStrokeStyle(1, 0x1a3040, 0.8);
        b.bg.setScale(1);
        b.text.setColor('#5a6470');
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

  handleNavigation(): void {
    const input = InputSystem.getState();
    this.navCooldown -= 16;
    if (this.navCooldown > 0) return;

    if (input.leftStickY < -0.3 || input.heldUp) {
      this.focusIdx = (this.focusIdx - 1 + this.buttons.length) % this.buttons.length;
      this.updateFocus();
      AudioSystem.play('uiHover');
      this.navCooldown = 110;
    } else if (input.leftStickY > 0.3 || input.heldDown) {
      this.focusIdx = (this.focusIdx + 1) % this.buttons.length;
      this.updateFocus();
      AudioSystem.play('uiHover');
      this.navCooldown = 110;
    }
    if (input.jumpPressed || input.firePressed) {
      AudioSystem.play('uiClick');
      this.buttons[this.focusIdx]?.onClick();
      this.navCooldown = 250;
    }
    if (input.backPressed) {
      AudioSystem.play('uiClick');
      this.buttons[0]?.onClick();
      this.navCooldown = 250;
    }
  }

  get isVisible(): boolean { return this.container.visible; }

  destroy(): void {
    this.container.destroy();
  }
}

export default PauseMenuUI;
