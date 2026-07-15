/**
 * MECHA: LAST PROTOCOL - ComingSoonScene
 * Placeholder shown after Victory — teases future content.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { Effects } from '../../shared/Effects';
import { AssetGenerator } from '../../shared/AssetGenerator';

export class ComingSoonScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ComingSoonScene' });
  }

  create(): void {
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;

    // Procedural background
    const bgUrl = AssetGenerator.get('comingsoon-bg', w, h);
    this.textures.addBase64('comingsoon-bg', bgUrl);
    this.time.delayedCall(50, () => {
      if (this.textures.exists('comingsoon-bg')) {
        this.add.image(0, 0, 'comingsoon-bg').setOrigin(0, 0).setDepth(-1);
      }
    });

    // Subtle drift dust
    for (let i = 0; i < 40; i++) {
      const d = this.add.circle(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0x39d0d8, 0.3);
      this.tweens.add({
        targets: d,
        y: d.y - 100 - Math.random() * 200,
        alpha: 0,
        duration: 5000 + Math.random() * 3000,
        repeat: -1,
        delay: Math.random() * 2000,
      });
    }

    this.add.text(w / 2, h * 0.35, '— COMING SOON —', {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#39d0d8',
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(w / 2, h * 0.35 + 70, 'NEXT MISSIONS IN DEVELOPMENT', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#7a8090',
    }).setOrigin(0.5);

    // Tease upcoming content
    const upcoming = [
      { name: 'STAGE 2', subtitle: 'NEON DISTRICT', color: '#ff60c0' },
      { name: 'STAGE 3', subtitle: 'ORBITAL STATION', color: '#4090ff' },
      { name: 'STAGE 4', subtitle: 'DEEP CORE', color: '#ff5030' },
    ];
    upcoming.forEach((u, i) => {
      const x = w / 2 + (i - 1) * 240;
      const card = this.add.rectangle(x, h * 0.62, 200, 120, 0x101820, 0.95);
      card.setStrokeStyle(1, 0x2a3340);
      this.add.text(x, h * 0.62 - 20, u.name, {
        fontFamily: 'monospace', fontSize: '24px', color: u.color,
      }).setOrigin(0.5);
      this.add.text(x, h * 0.62 + 15, u.subtitle, {
        fontFamily: 'monospace', fontSize: '12px', color: '#7a8090',
      }).setOrigin(0.5);
      this.add.text(x, h * 0.62 + 40, '🔒 LOCKED', {
        fontFamily: 'monospace', fontSize: '10px', color: '#3a4350',
      }).setOrigin(0.5);
    });

    // Back button
    this.makeButton(w / 2, h - 80, '←  BACK TO MAP', () => {
      Effects.play('uiClick');
      this.scene.start('MapScene');
    });
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 220, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { bg.setFillStyle(0x243040, 1); Effects.play('uiHover'); });
    bg.on('pointerout',  () => bg.setFillStyle(0x1a2030, 0.95));
    bg.on('pointerup', onClick);
    const t = this.add.text(0, 0, label, {
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0',
    }).setOrigin(0.5);
    c.add([bg, t]);
  }
}

export default ComingSoonScene;
