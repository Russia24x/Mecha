/**
 * MECHA: LAST PROTOCOL - PauseMenu
 * Overlay scene that runs on top of FactoryStage when paused.
 * Resume / Restart / Quit to map / Quit to menu.
 *
 * Button interaction: the rectangle bg is the interactive object,
 * and handlers are attached directly to it (not the container).
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { Effects } from '../../shared/Effects';

export class PauseMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PauseMenuScene' });
  }

  create(): void {
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;

    // Semi-transparent overlay (also absorbs clicks so the game underneath doesn't react)
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7);
    overlay.setScrollFactor(0);
    // Make overlay absorb pointer events so clicks don't pass through to the game
    overlay.setInteractive();

    // Title
    this.add.text(w / 2, h / 2 - 140, '— PAUSED —', {
      fontFamily: 'monospace',
      fontSize: '40px',
      color: '#39d0d8',
      stroke: '#000',
      strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0);

    this.add.text(w / 2, h / 2 - 100, 'MECHA: LAST PROTOCOL', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#7a8090',
    }).setOrigin(0.5).setScrollFactor(0);

    // Buttons — handlers attached to the interactive rectangle itself
    this.makeButton(w / 2, h / 2 - 50, '▶  RESUME', () => {
      Effects.play('uiClick');
      this.scene.stop();
      this.scene.resume('FactoryStage');
    });

    this.makeButton(w / 2, h / 2 + 10, '↻  RESTART STAGE', () => {
      Effects.play('uiClick');
      this.scene.stop();
      this.scene.stop('FactoryStage');
      this.scene.start('FactoryStage');
    });

    this.makeButton(w / 2, h / 2 + 70, '🗺  QUIT TO MAP', () => {
      Effects.play('uiClick');
      Effects.playMusic('menuAmbient');
      this.scene.stop();
      this.scene.stop('FactoryStage');
      this.scene.start('MapScene');
    });

    this.makeButton(w / 2, h / 2 + 130, '⌂  QUIT TO MENU', () => {
      Effects.play('uiClick');
      Effects.playMusic('menuAmbient');
      this.scene.stop();
      this.scene.stop('FactoryStage');
      this.scene.start('MenuScene');
    });

    // ESC resumes
    this.input.keyboard!.on('keydown-ESC', () => {
      Effects.play('uiClick');
      this.scene.stop();
      this.scene.resume('FactoryStage');
    });
  }

  /**
   * Build a button. The rectangle is the interactive element and the
   * onClick handler is attached directly to it (not to the container).
   * This avoids the common Phaser gotcha where container.on('pointerup')
   * never fires because the container itself was never made interactive.
   */
  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 320, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x3a4350);
    bg.setScrollFactor(0);
    bg.setInteractive({ useHandCursor: true });
    // Attach handlers directly to the interactive object
    bg.on('pointerover', () => {
      bg.setFillStyle(0x243040, 1);
      Effects.play('uiHover');
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x1a2030, 0.95);
    });
    bg.on('pointerup', () => {
      onClick();
    });
    // Text label (non-interactive — pointer events pass through to the bg underneath)
    const t = this.add.text(x, y, label, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#cfd6e0',
    }).setOrigin(0.5).setScrollFactor(0);
    // Make text non-blocking so the bg receives the clicks
    t.setInteractive({ useHandCursor: false });
    t.on('pointerup', () => onClick());
    t.on('pointerover', () => {
      bg.setFillStyle(0x243040, 1);
    });
  }
}

export default PauseMenuScene;
