/**
 * MECHA: LAST PROTOCOL - UIScene
 * Pause menu overlay scene. Runs on top of GameScene.
 */

import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { Effects } from '../../shared/Effects';
import { GamepadManager } from '../../shared/GamepadManager';

interface PauseButton {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  onClick: () => void;
}

export class UIScene extends Phaser.Scene {
  private buttons: PauseButton[] = [];
  private focusIdx = 0;
  private navCooldown = 0;
  private gpPollTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.buttons = [];
    this.focusIdx = 0;
    this.navCooldown = 0;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7);
    overlay.setScrollFactor(0);
    overlay.setInteractive();

    this.add.text(w / 2, h / 2 - 140, '— PAUSED —', {
      fontFamily: 'monospace', fontSize: '40px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0);

    this.makeBtn(w / 2, h / 2 - 50, '▶  RESUME', () => this.resume());
    this.makeBtn(w / 2, h / 2 + 10, '↻  RESTART STAGE', () => {
      Effects.play('uiClick');
      this.scene.stop();
      this.scene.resume('GameScene');
      const gs = this.scene.get('GameScene') as unknown as { setState: (s: string) => void };
      gs.setState('play');
    });
    this.makeBtn(w / 2, h / 2 + 70, '🗺  QUIT TO MAP', () => {
      Effects.play('uiClick');
      Effects.playMusic('menuAmbient');
      this.scene.stop();
      this.scene.resume('GameScene');
      const gs = this.scene.get('GameScene') as unknown as { setState: (s: string) => void };
      gs.setState('map');
    });
    this.makeBtn(w / 2, h / 2 + 130, '⌂  QUIT TO MENU', () => {
      Effects.play('uiClick');
      Effects.playMusic('menuAmbient');
      this.scene.stop();
      this.scene.resume('GameScene');
      const gs = this.scene.get('GameScene') as unknown as { setState: (s: string) => void };
      gs.setState('menu');
    });

    this.input.keyboard!.on('keydown-ESC', () => this.resume());
    this.input.keyboard!.on('keydown-W', () => this.navigate(-1));
    this.input.keyboard!.on('keydown-S', () => this.navigate(1));
    this.input.keyboard!.on('keydown-UP', () => this.navigate(-1));
    this.input.keyboard!.on('keydown-DOWN', () => this.navigate(1));
    this.input.keyboard!.on('keydown-ENTER', () => this.activate());
    this.input.keyboard!.on('keydown-SPACE', () => this.activate());

    this.updateFocus();

    this.gpPollTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => this.pollGamepad(),
    });
  }

  private resume(): void {
    Effects.play('uiClick');
    this.gpPollTimer?.remove();
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  private navigate(dir: number): void {
    this.focusIdx = (this.focusIdx + dir + this.buttons.length) % this.buttons.length;
    this.updateFocus();
    Effects.play('uiHover');
  }

  private activate(): void {
    const btn = this.buttons[this.focusIdx];
    if (btn) btn.onClick();
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

  private pollGamepad(): void {
    GamepadManager.update();
    const gp = GamepadManager.getState();
    this.navCooldown -= 50;
    if (this.navCooldown <= 0) {
      if (gp.leftStickY < -0.3) { this.navigate(-1); this.navCooldown = 200; }
      else if (gp.leftStickY > 0.3) { this.navigate(1); this.navCooldown = 200; }
    }
    if (gp.jumpPressed) this.activate();
    if (gp.backPressed) this.resume();
  }

  private makeBtn(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 320, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x3a4350);
    bg.setScrollFactor(0);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { this.focusIdx = this.buttons.findIndex(b => b.bg === bg); this.updateFocus(); });
    bg.on('pointerdown', onClick);
    const t = this.add.text(x, y, label, { fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0' }).setOrigin(0.5);
    t.setScrollFactor(0);
    this.buttons.push({ bg, text: t, onClick });
  }
}

export default UIScene;
