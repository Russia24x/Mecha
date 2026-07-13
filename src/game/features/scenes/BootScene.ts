/**
 * MECHA: LAST PROTOCOL - BootScene
 * Preloads shared assets and generates procedural textures.
 */

import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Generate procedural 1x1 white pixel texture (used for all tinted rectangles).
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture('__white', 1, 1);
    g.destroy();

    // ── Load background art assets (user-provided images) ──
    this.load.image('factory_bg_1', '/game-assets/backgrounds/factory_bg_1.png');
    this.load.image('factory_bg_2', '/game-assets/backgrounds/factory_bg_2.png');

    // Loading bar.
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;
    const barBg = this.add.rectangle(w / 2, h / 2 + 60, 320, 8, 0x202830).setOrigin(0.5);
    const barFg = this.add.rectangle(w / 2 - 160, h / 2 + 60, 0, 8, 0x39d0d8).setOrigin(0, 0.5);
    const pctText = this.add.text(w / 2, h / 2 + 80, '0%', {
      fontFamily: 'monospace', fontSize: '11px', color: '#5a6470',
    }).setOrigin(0.5);

    const progressHandler = (progress: number) => {
      barFg.width = 320 * progress;
      pctText.setText(`${Math.round(progress * 100)}%`);
    };
    this.load.on('progress', progressHandler);
    this.load.once('complete', () => {
      this.load.off('progress', progressHandler);
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME.BG_COLOR);
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;
    this.add.text(w / 2, h / 2 - 40, 'MECHA: LAST PROTOCOL', {
      fontFamily: 'monospace', fontSize: '42px', color: '#39d0d8',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(w / 2, h / 2 + 10, 'SYSTEMS READY', {
      fontFamily: 'monospace', fontSize: '14px', color: '#40d070',
    }).setOrigin(0.5);

    this.time.delayedCall(400, () => {
      this.scene.start('GameScene');
    });
  }
}

export default BootScene;
