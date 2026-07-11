/**
 * MECHA: LAST PROTOCOL — Pause Menu UI v3.3
 *
 * ROOT FIX for mouse not working:
 * 1. Overlay rectangle now has setInteractive() to CATCH stray clicks
 *    (prevents clicks from going through to game world).
 * 2. Buttons are added AFTER overlay → higher input priority in Phaser.
 * 3. setInteractive() called AFTER object is added to container.
 * 4. Does NOT call matter.world.pause() (was potentially interfering).
 *
 * Grid layout: Resume, Skills, Inventory, Quests, Map,
 * Settings, Restart, Return to Hub, Quit to Menu.
 * Full gamepad + mouse support with cooldown.
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
    this.container = scene.add.container(0, 0).setDepth(300).setScrollFactor(0).setVisible(false);

    // Overlay with setInteractive — catches ALL clicks on pause menu area.
    // Buttons added AFTER this will have higher input priority.
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.75);
    overlay.setInteractive();
    // Consume pointer events on overlay (prevents click-through to game world)
    overlay.on('pointerdown', () => { /* swallow — do nothing */ });
    this.container.add(overlay);

    // Title
    const titleText = scene.add.text(w / 2, 50, t('pause.title'), {
      fontFamily: 'monospace', fontSize: '32px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);
    this.container.add(titleText);

    // Localization helper
    const isFa = getLocale() === 'fa';
    const L = (en: string, fa: string) => isFa ? fa : en;

    // Grid layout
    const colW = 210;
    const rowH = 44;
    const gap = 8;
    const startX = w / 2 - colW - gap / 2;
    const startY = 110;

    // Row 0: Resume (full width)
    this.makeBtn(w / 2, startY, '▶  ' + t('pause.resume'), callbacks.onResume, colW * 2 + gap);

    // Row 1: Skills | Inventory
    this.makeBtn(startX + colW / 2, startY + rowH + gap, '⚔  ' + L('SKILLS', 'مهارت‌ها'), callbacks.onSkills, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + rowH + gap, '🎒  ' + L('INVENTORY', 'کیف'), callbacks.onInventory, colW);

    // Row 2: Quests | Map
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 2, '📜  ' + L('QUESTS', 'ماموریت‌ها'), callbacks.onQuests, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 2, '🗺  ' + L('MAP', 'نقشه'), callbacks.onMap, colW);

    // Row 3: Settings | Restart
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 3, '⚙  ' + t('menu.settings'), callbacks.onSettings, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 3, '↻  ' + t('pause.restart'), callbacks.onRestart, colW);

    // Row 4: Return to Hub | Quit to Menu
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 4, '⌂  ' + t('pause.quit_hub'), callbacks.onReturnToHub, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 4, '✕  ' + t('pause.quit_menu'), callbacks.onQuit, colW);

    // NOW set interactive on all buttons (after they're in the container)
    this.buttons.forEach(b => {
      b.bg.setInteractive({ useHandCursor: true });
      b.bg.on('pointerover', () => {
        this.focusIdx = this.buttons.indexOf(b);
        this.updateFocus();
        AudioSystem.play('uiHover');
      });
      b.bg.on('pointerout', () => this.updateFocus());
      b.bg.on('pointerdown', () => {
        AudioSystem.play('uiClick');
        b.onClick();
      });
    });
  }

  private makeBtn(x: number, y: number, label: string, onClick: () => void, width: number = 320): void {
    const bg = this.scene.add.rectangle(x, y, width, 40, 0x0a1018, 0.9);
    bg.setStrokeStyle(1, 0x1a3040, 0.8);
    // NOTE: setInteractive() is called AFTER all buttons are added to container
    const textEl = this.scene.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '14px', color: '#5a6470',
    }).setOrigin(0.5);
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
    // Ensure input is enabled on the scene
    if (!this.scene.input.enabled) {
      this.scene.input.enabled = true;
    }
  }

  hide(): void {
    this.container.setVisible(false);
  }

  /** Handle gamepad/keyboard navigation. Call from scene update. */
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
      this.buttons[0]?.onClick();  // RESUME is always first
      this.navCooldown = 250;
    }
  }

  get isVisible(): boolean { return this.container.visible; }

  destroy(): void {
    this.container.destroy();
  }
}

export default PauseMenuUI;
