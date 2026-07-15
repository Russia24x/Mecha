/**
 * MECHA: LAST PROTOCOL — Pause Menu UI v5.0
 *
 * Uses UIController for unified navigation.
 * No custom buttons[] / focusIdx / navCooldown / handleNavigation —
 * everything handled by UIController.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale, fixTextStyle } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { InputSystem } from '../../systems/InputSystem';
import { THEME, addCornerBrackets, addScanlines } from '../Theme';
import { UIController } from '../UIController';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onCheckpoint: () => void;
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
  private ctrl: UIController;

  constructor(scene: Phaser.Scene, callbacks: PauseMenuCallbacks) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';
    const L = (en: string, fa: string) => isFa ? fa : en;
    this.container = scene.add.container(0, 0).setDepth(300).setVisible(false);
    this.container.scrollFactorX = 0;
    this.container.scrollFactorY = 0;

    // UIController
    this.ctrl = new UIController(scene, this.container);
    // NOTE: do NOT call setupKeyboard() here — show() will attach the keyHandler
    // only when pause is actually open. Calling it in constructor leaves a
    // dangling keyHandler active even when pause is closed, causing A4
    // (listener leak: PauseMenu's keyHandler fires alongside shared controller's).

    // Overlay (blocks clicks behind)
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x05080c, 0.85);
    overlay.setScrollFactor(0);
    overlay.setInteractive();
    overlay.on('pointerdown', () => { /* swallow */ });
    this.container.add(overlay);
    this.container.add(addScanlines(scene, w, h, 0.02));

    // Title
    const titleBg = scene.add.rectangle(w / 2, 60, 500, 50, THEME.BG_DARK, 0.95);
    titleBg.setStrokeStyle(1, THEME.CYAN, 0.4);
    titleBg.setScrollFactor(0);
    this.container.add(titleBg);
    this.container.add(addCornerBrackets(scene, w / 2, 60, 500, 50, THEME.CYAN, 8, 0.6));
    this.container.add(scene.add.text(w / 2, 60, isFa ? '▮ سیستم متوقف ▮' : '▮ SYSTEM SUSPEND ▮', fixTextStyle({
      fontFamily: 'monospace', fontSize: '22px', color: '#39d0d8', stroke: '#000', strokeThickness: 4, letterSpacing: 4,
    })).setOrigin(0.5).setScrollFactor(0));
    this.container.add(scene.add.text(w / 2, 95, isFa ? 'پروتکل‌ها متوقف شدند' : 'PROTOCOLS SUSPENDED', fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_DIM, letterSpacing: 3,
    })).setOrigin(0.5).setScrollFactor(0));

    // Map preview (left side)
    const previewX = 240, previewY = h / 2 + 20;
    const previewW = 300, previewH = 180;
    const previewBg = scene.add.rectangle(previewX, previewY, previewW, previewH, THEME.BG_DARK, 0.9);
    previewBg.setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
    previewBg.setScrollFactor(0);
    this.container.add(previewBg);
    const previewTex = 'factory_bg_2';
    if (scene.textures.exists(previewTex)) {
      const pvImg = scene.add.image(previewX, previewY, previewTex);
      const tex = scene.textures.get(previewTex).getSourceImage();
      const imgAR = tex.width / tex.height;
      const frameAR = previewW / previewH;
      let sc: number;
      if (imgAR > frameAR) sc = previewW / tex.width; else sc = previewH / tex.height;
      pvImg.setScale(sc);
      pvImg.setAlpha(0.5);
      pvImg.setDepth(2);
      this.container.add(pvImg);
    }
    this.container.add(scene.add.text(previewX, previewY + previewH / 2 + 14, isFa ? 'نقشه فعلی' : 'CURRENT MAP', fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: '#3a4350', letterSpacing: 2,
    })).setOrigin(0.5).setDepth(3).setScrollFactor(0));

    // Buttons (right side, grid layout)
    const startX = 600, startY = 160;
    const colW = 170, rowH = 52, gap = 8;

    this.makeBtn(startX, startY, '▶', L('RESUME', 'ادامه'), callbacks.onResume, colW * 2 + gap);
    this.makeBtn(startX + colW / 2, startY + rowH + gap, '◆', L('CHECKPOINT', 'چک‌پوینت'), callbacks.onCheckpoint, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + rowH + gap, '↻', L('RESTART', 'راه‌اندازی مجدد'), callbacks.onRestart, colW);
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 2, '⚔', L('NEURAL CORTEX', 'قشر عصبی'), callbacks.onSkills, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 2, '◈', L('DATA VAULT', 'مخزن داده'), callbacks.onInventory, colW);
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 3, '▤', L('MISSION LOG', 'گزارش'), callbacks.onQuests, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 3, '⌂', L('RETURN TO HUB', 'بازگشت به هاب'), callbacks.onReturnToHub, colW);
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 4, '⚙', t('menu.settings'), callbacks.onSettings, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 4, '✕', L('QUIT TO MENU', 'خروج به منو'), callbacks.onQuit, colW);
    this.makeBtn(previewX, previewY + previewH / 2 + 44, '▣', L('MAP', 'نقشه'), callbacks.onMap, 160);
  }

  private makeBtn(x: number, y: number, icon: string, label: string, onClick: () => void, width: number = 320): void {
    const bg = this.scene.add.rectangle(x, y, width, 42, THEME.BG_PANEL, 0.92).setScrollFactor(0);
    bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.7);
    const iconEl = this.scene.add.text(x - width / 2 + 20, y, icon, fixTextStyle({
      fontFamily: 'monospace', fontSize: '16px', color: THEME.TEXT_MED,
    })).setOrigin(0.5).setScrollFactor(0);
    const textEl = this.scene.add.text(x + 15, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_MED, letterSpacing: 1,
    })).setOrigin(0.5).setScrollFactor(0);
    this.container.add([bg, iconEl, textEl]);
    // Register with UIController — it handles all input
    this.ctrl.addButton(x, y, bg, onClick, { text: textEl });
  }

  show(): void {
    this.container.setVisible(true);
    this.ctrl.show(280);
    if (!this.scene.input.enabled) this.scene.input.enabled = true;
  }

  hide(): void {
    this.container.setVisible(false);
    this.ctrl.hide();
  }

  getController(): UIController { return this.ctrl; }

  /** Called by GameScene when paused — delegates to UIController. */
  handleNavigation(): void {
    const input = InputSystem.getState();
    // B button / ESC / Start button = resume (first button = RESUME)
    if (input.backPressed || input.pausePressed) {
      AudioSystem.play('uiClick');
      this.ctrl.triggerFirst();
      return;
    }
    this.ctrl.update();
  }

  get isVisible(): boolean { return this.container.visible; }

  destroy(): void {
    this.ctrl.destroy();
    this.container.destroy();
  }
}

export default PauseMenuUI;
