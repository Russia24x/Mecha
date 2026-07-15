/**
 * MECHA: LAST PROTOCOL - VictoryScene
 * Shown when the player defeats the Stage 2 boss.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { Save } from '../../shared/Save';
import { SkillTree } from '../../shared/SkillTree';
import { Effects } from '../../shared/Effects';
import { AssetGenerator } from '../../shared/AssetGenerator';

interface InitData {
  timeMs?: number;
}

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
  }

  init(data: InitData): void {
    this.data = data;
  }

  create(): void {
    Effects.playMusic('victory');
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;

    // Procedural background
    const bgUrl = AssetGenerator.get('victory-bg', w, h);
    this.textures.addBase64('victory-bg', bgUrl);
    this.time.delayedCall(50, () => {
      if (this.textures.exists('victory-bg')) {
        this.add.image(0, 0, 'victory-bg').setOrigin(0, 0).setDepth(-1);
      }
    });

    // Confetti / particle burst
    for (let i = 0; i < 80; i++) {
      const colors = [0x39d0d8, 0xffe060, 0x40d070, 0xff60c0, 0xffffff];
      const c = colors[Math.floor(Math.random() * colors.length)];
      const p = this.add.circle(Math.random() * w, -20, 2 + Math.random() * 3, c, 0.9);
      this.tweens.add({
        targets: p,
        y: h + 40,
        x: p.x + (Math.random() - 0.5) * 200,
        rotation: Math.random() * Math.PI * 4,
        alpha: 0.6,
        duration: 3000 + Math.random() * 2000,
        delay: Math.random() * 1500,
        repeat: -1,
      });
    }

    // Big VICTORY text
    this.add.text(w / 2, h * 0.32, 'VICTORY', {
      fontFamily: 'monospace',
      fontSize: '96px',
      color: '#ffe060',
      stroke: '#000',
      strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(w / 2, h * 0.32 + 70, '— GUARDIAN AX-09 DESTROYED —', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#cfd6e0',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Stats
    const timeMs = this.data?.timeMs ?? 0;
    const sec = Math.floor(timeMs / 1000);
    const min = Math.floor(sec / 60);
    const timeStr = `${min}:${(sec % 60).toString().padStart(2, '0')}`;

    const stats = [
      `CLEAR TIME:  ${timeStr}`,
      `TOTAL KILLS: ${Save.get().totalKills}`,
      `BOSSES DOWN: ${SkillTree.get().bossesKilled}`,
      `SKILL POINTS EARNED: +3`,
    ];
    this.add.text(w / 2, h * 0.55, stats, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#9be0b0',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);

    // Buttons
    this.makeButton(w / 2 - 180, h - 100, '🗺  MAP', () => {
      Effects.play('uiClick');
      this.scene.start('MapScene');
    });
    this.makeButton(w / 2, h - 100, '⚙  SKILLS', () => {
      Effects.play('uiClick');
      this.scene.start('SkillTreeScene');
    });
    this.makeButton(w / 2 + 180, h - 100, '⌂  MENU', () => {
      Effects.play('uiClick');
      this.scene.start('MenuScene');
    });
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 180, 44, 0x1a2030, 0.95);
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

export default VictoryScene;
