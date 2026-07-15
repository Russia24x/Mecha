/**
 * MECHA: LAST PROTOCOL - MenuScene
 * Title screen with START / CONTINUE / CREDITS buttons.
 */
import Phaser from 'phaser';
import { GAME, STAGE } from '../../shared/Constants';
import { Save } from '../../shared/Save';
import { Effects } from '../../shared/Effects';
import { AssetGenerator } from '../../shared/AssetGenerator';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    Effects.init();
    Effects.resume();
    Effects.playMusic('menuAmbient');
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;

    // Procedural background image
    const bgUrl = AssetGenerator.get('menu-bg', w, h);
    this.textures.addBase64('menu-bg', bgUrl);
    // Use a delayed add to ensure texture is loaded
    this.time.delayedCall(50, () => {
      if (this.textures.exists('menu-bg')) {
        this.add.image(0, 0, 'menu-bg').setOrigin(0, 0).setDepth(-1);
      }
    });

    // Animated background: drifting dust
    const dust: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 60; i++) {
      const d = this.add.circle(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0x39d0d8, 0.3);
      d.setDepth(0);
      this.tweens.add({
        targets: d,
        x: d.x + (Math.random() - 0.5) * 200,
        y: d.y - 200 - Math.random() * 300,
        alpha: 0,
        duration: 4000 + Math.random() * 4000,
        repeat: -1,
        delay: Math.random() * 2000,
      });
      dust.push(d);
    }

    // Big title
    this.add.text(w / 2, h * 0.28, 'MECHA', {
      fontFamily: 'monospace',
      fontSize: '96px',
      color: '#39d0d8',
      stroke: '#000',
      strokeThickness: 8,
    }).setOrigin(0.5).setAlpha(0.95);

    this.add.text(w / 2, h * 0.28 + 80, 'LAST PROTOCOL', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#cfd6e0',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(w / 2, h * 0.28 + 140, '— ABANDONED FACTORY —', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#7a8090',
    }).setOrigin(0.5);

    // Buttons
    const startY = h * 0.62;
    this.makeButton(w / 2, startY, '▶  START', () => {
      Effects.play('uiClick');
      this.scene.start('MapScene');
    });
    this.makeButton(w / 2, startY + 60, '↻  CONTINUE', () => {
      Effects.play('uiClick');
      const cp = Save.get().lastCheckpoint;
      if (cp) {
        this.scene.start('FactoryStage', { section: cp.section, restoreX: cp.x, restoreY: cp.y });
      } else {
        this.scene.start('FactoryStage', { section: 1 });
      }
    }, !Save.hasCheckpoint());
    this.makeButton(w / 2, startY + 120, 'i  HOW TO PLAY', () => {
      Effects.play('uiClick');
      this.showControls();
    });

    // Footer
    this.add.text(w / 2, h - 30, 'MVP 1.0  •  PHASER 4.2  •  MATTER.JS', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#3a4350',
    }).setOrigin(0.5);
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void, disabled = false): void {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 320, 44, disabled ? 0x101820 : 0x1a2030, 0.95);
    bg.setStrokeStyle(1, disabled ? 0x202830 : 0x39d0d8, 0.6);
    if (!disabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { bg.setFillStyle(0x243040, 1); Effects.play('uiHover'); });
      bg.on('pointerout',  () => bg.setFillStyle(0x1a2030, 0.95));
      bg.on('pointerup', onClick);
    }
    const t = this.add.text(0, 0, label, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: disabled ? '#4a5260' : '#cfd6e0',
    }).setOrigin(0.5);
    c.add([bg, t]);
  }

  private showControls(): void {
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85).setDepth(200);
    const panel = this.add.rectangle(w / 2, h / 2, 540, 360, 0x101820, 0.95).setDepth(201);
    panel.setStrokeStyle(1, 0x39d0d8, 0.5);

    const lines = [
      'HOW TO PLAY',
      '',
      'WASD / ARROWS    →   MOVE',
      'SPACE                   →   JUMP  (double jump unlocked via skills)',
      'SHIFT                   →   DASH (uses energy)',
      'J / LEFT MOUSE   →   FIRE',
      'K / RIGHT MOUSE  →   MELEE SLASH',
      '1 / 2 / 3 / 4     →   SWITCH WEAPONS',
      'Q / E                    →   CYCLE WEAPONS',
      'GAMEPAD                 →   fully supported',
      'ESC                       →   PAUSE',
      '',
      'OBJECTIVE',
      'Traverse 6 sections of the abandoned factory,',
      'defeat the 2-stage Guardian AX-09 boss.',
    ];
    const txt = this.add.text(w / 2, h / 2, lines, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#cfd6e0',
      align: 'center',
    }).setOrigin(0.5).setDepth(202);

    const close = this.add.text(w / 2, h / 2 + 150, '[ click anywhere to close ]', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#7a8090',
    }).setOrigin(0.5).setDepth(202);

    this.input.once('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      txt.destroy();
      close.destroy();
    });
  }
}

export default MenuScene;
