/**
 * MECHA: LAST PROTOCOL — Pause Menu UI v4.0
 *
 * REDESIGNED: Neural Cortex aesthetic. "SYSTEM SUSPEND" instead of "PAUSED".
 * Grid layout with circuit-style buttons, corner accents.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale, fixTextStyle } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { InputSystem } from '../../systems/InputSystem';
import { THEME, addCornerBrackets, addScanlines } from '../Theme';

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
  private buttons: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Text; onClick: () => void }[] = [];
  private focusIdx = 0;
  private navCooldown = 0;

  constructor(scene: Phaser.Scene, callbacks: PauseMenuCallbacks) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';
    this.container = scene.add.container(0, 0).setDepth(300).setVisible(false);
    this.container.scrollFactorX = 0;
    this.container.scrollFactorY = 0;

    // Overlay
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x05080c, 0.85);
    overlay.setInteractive();
    overlay.on('pointerdown', () => { /* swallow */ });
    this.container.add(overlay);

    // Scanlines
    this.container.add(addScanlines(scene, w, h, 0.02));

    // Title bar with corner brackets
    const titleBg = scene.add.rectangle(w / 2, 60, 500, 50, THEME.BG_PANEL, 0.9);
    titleBg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(titleBg);
    this.container.add(addCornerBrackets(scene, w / 2, 60, 500, 50, THEME.CYAN, 8, 0.6));
    this.container.add(scene.add.text(w / 2, 60, isFa ? '▮ سیستم متوقف ▮' : '▮ SYSTEM SUSPEND ▮', fixTextStyle({
      fontFamily: 'monospace', fontSize: '22px', color: THEME.TEXT_ACCENT, stroke: '#000', strokeThickness: 5, letterSpacing: 3,
    })).setOrigin(0.5));

    // Subtitle
    this.container.add(scene.add.text(w / 2, 95, isFa ? 'پروتکل‌ها متوقف شدند' : 'PROTOCOLS SUSPENDED', fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_DIM, letterSpacing: 4,
    })).setOrigin(0.5));

    // Localization
    const L = (en: string, fa: string) => isFa ? fa : en;

    // Grid layout
    const colW = 220;
    const rowH = 46;
    const gap = 8;
    const startX = w / 2 - colW - gap / 2;
    const startY = 130;

    // Row 0: RESUME (full width)
    this.makeBtn(w / 2, startY, '▶', isFa ? 'ادامه' : 'RESUME', callbacks.onResume, colW * 2 + gap);
    // Row 1
    this.makeBtn(startX + colW / 2, startY + rowH + gap, '◆', isFa ? 'چک‌پوینت' : 'CHECKPOINT', callbacks.onCheckpoint, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + rowH + gap, '↻', isFa ? 'راه‌اندازی مجدد' : 'RESTART', callbacks.onRestart, colW);
    // Row 2
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 2, '⚔', L('NEURAL CORTEX', 'قشر عصبی'), callbacks.onSkills, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 2, '◈', L('DATA VAULT', 'مخزن داده'), callbacks.onInventory, colW);
    // Row 3
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 3, '▤', L('MISSION LOG', 'گزارش'), callbacks.onQuests, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 3, '⌂', isFa ? 'بازگشت به هاب' : 'RETURN TO HUB', callbacks.onReturnToHub, colW);
    // Row 4
    this.makeBtn(startX + colW / 2, startY + (rowH + gap) * 4, '⚙', t('menu.settings'), callbacks.onSettings, colW);
    this.makeBtn(startX + colW + gap + colW / 2, startY + (rowH + gap) * 4, '✕', isFa ? 'خروج به منو' : 'QUIT TO MENU', callbacks.onQuit, colW);

    // ── Map preview (right sidebar) ──
    const previewX = w - 150;
    const previewY = 250;
    const previewW = 220;
    const previewH = 130;
    const previewBg = scene.add.rectangle(previewX, previewY, previewW, previewH, 0x05080c, 1);
    previewBg.setStrokeStyle(1, 0x1a3040, 0.6);
    previewBg.setDepth(2);
    this.container.add(previewBg);
    // Use factory_bg_2 as preview (or factory_bg_1 for forest)
    const previewTex = 'factory_bg_2';
    if (scene.textures.exists(previewTex)) {
      const pvImg = scene.add.image(previewX, previewY, previewTex);
      const tex = scene.textures.get(previewTex).getSourceImage();
      const imgAR = tex.width / tex.height;
      const frameAR = previewW / previewH;
      let sc: number;
      if (imgAR > frameAR) { sc = previewH / tex.height; } else { sc = previewW / tex.width; }
      pvImg.setScale(sc);
      // Mask
      const pvMask = scene.make.graphics({ x: previewX, y: previewY }, false);
      pvMask.fillStyle(0xffffff, 1);
      pvMask.fillRect(-previewW / 2, -previewH / 2, previewW, previewH);
      const pvMaskObj = pvMask.createGeometryMask();
      pvImg.setMask(pvMaskObj);
      pvImg.setAlpha(0.5);
      pvImg.setDepth(2);
      this.container.add(pvImg);
    }
    // Preview label
    this.container.add(scene.add.text(previewX, previewY + previewH / 2 + 14, isFa ? 'نقشه فعلی' : 'CURRENT MAP', fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: '#3a4350', letterSpacing: 2,
    })).setOrigin(0.5).setDepth(3));
    // Map button (below preview)
    this.makeBtn(previewX, previewY + previewH / 2 + 44, '▣', isFa ? 'نقشه' : 'MAP', callbacks.onMap, 160);

    // Set interactive on all buttons
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

  private makeBtn(x: number, y: number, icon: string, label: string, onClick: () => void, width: number = 320): void {
    const bg = this.scene.add.rectangle(x, y, width, 42, THEME.BG_PANEL, 0.92).setScrollFactor(0);
    bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.7);
    // Icon (circuit node style)
    const iconEl = this.scene.add.text(x - width / 2 + 20, y, icon, fixTextStyle({
      fontFamily: 'monospace', fontSize: '16px', color: THEME.TEXT_MED,
    })).setOrigin(0.5).setScrollFactor(0);
    // Label — Persian-aware (fixTextStyle forces letterSpacing 0 for fa)
    const textEl = this.scene.add.text(x + 15, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_MED, letterSpacing: 1,
    })).setOrigin(0.5).setScrollFactor(0);
    this.container.add([bg, iconEl, textEl]);
    this.buttons.push({ bg, text: textEl, icon: iconEl, onClick });
  }

  private updateFocus(): void {
    this.buttons.forEach((b, i) => {
      if (i === this.focusIdx) {
        b.bg.setFillStyle(THEME.BG_PANEL_HI, 1);
        b.bg.setStrokeStyle(2, THEME.CYAN, 0.9);
        b.bg.setScale(1.02);
        b.text.setColor(THEME.TEXT_ACCENT);
        b.icon.setColor(THEME.TEXT_ACCENT);
      } else {
        b.bg.setFillStyle(THEME.BG_PANEL, 0.92);
        b.bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.7);
        b.bg.setScale(1);
        b.text.setColor(THEME.TEXT_MED);
        b.icon.setColor(THEME.TEXT_MED);
      }
    });
  }

  show(): void {
    this.container.setVisible(true);
    this.focusIdx = 0;
    this.updateFocus();
    if (!this.scene.input.enabled) this.scene.input.enabled = true;
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
