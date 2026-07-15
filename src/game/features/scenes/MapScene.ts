/**
 * MECHA: LAST PROTOCOL - MapScene
 * World map / stage-select screen. Shows the player's progress
 * and lets them choose a stage (currently only Factory).
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { Save } from '../../shared/Save';
import { SkillTree } from '../../shared/SkillTree';
import { Effects } from '../../shared/Effects';
import { AssetGenerator } from '../../shared/AssetGenerator';

export class MapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' });
  }

  create(): void {
    Effects.playMusic('menuAmbient');
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;

    // Procedural background
    const bgUrl = AssetGenerator.get('map-bg', w, h);
    this.textures.addBase64('map-bg', bgUrl);
    this.time.delayedCall(50, () => {
      if (this.textures.exists('map-bg')) {
        this.add.image(0, 0, 'map-bg').setOrigin(0, 0).setDepth(-1);
      }
    });

    // Title
    this.add.text(w / 2, 60, 'MISSION SELECT', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#39d0d8',
      stroke: '#000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(w / 2, 100, '— ABANDONED FACTORY COMPLEX —', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#7a8090',
    }).setOrigin(0.5);

    // Player progression panel
    const save = Save.get();
    const skills = SkillTree.get();
    const panel = this.add.rectangle(w / 2, 170, 800, 60, 0x101820, 0.9);
    panel.setStrokeStyle(1, 0x2a3340);
    this.add.text(w / 2 - 380, 170, 'PROGRESS', {
      fontFamily: 'monospace', fontSize: '11px', color: '#7a8090',
    }).setOrigin(0, 0.5);
    this.add.text(w / 2 - 200, 170, `Kills: ${save.totalKills}`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0',
    }).setOrigin(0.5, 0.5);
    this.add.text(w / 2, 170, `Skill Points: ${skills.skillPoints}`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffe060',
    }).setOrigin(0.5, 0.5);
    this.add.text(w / 2 + 200, 170, `Bosses: ${skills.bossesKilled}`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ff8080',
    }).setOrigin(0.5, 0.5);

    // Stage cards
    const stages = [
      {
        id: 1,
        name: 'ABANDONED FACTORY',
        subtitle: 'Stage 1 — Industrial Complex',
        desc: '6 sections • 3 enemy types • 2-stage boss',
        unlocked: true,
        action: () => {
          Effects.play('uiClick');
          this.scene.start('FactoryStage', { section: save.lastCheckpoint?.section ?? 1 });
        },
      },
      {
        id: 2,
        name: 'NEON DISTRICT',
        subtitle: 'Stage 2 — Locked',
        desc: 'Coming Soon — unlock by defeating Stage 1 boss',
        unlocked: false,
        action: () => { Effects.play('uiHover'); },
      },
      {
        id: 3,
        name: 'ORBITAL STATION',
        subtitle: 'Stage 3 — Locked',
        desc: 'Coming Soon — unlock by defeating Stage 2 boss',
        unlocked: false,
        action: () => { Effects.play('uiHover'); },
      },
    ];

    const cardW = 240;
    const cardH = 280;
    const gap = 20;
    const totalW = stages.length * cardW + (stages.length - 1) * gap;
    const startX = (w - totalW) / 2;

    stages.forEach((stage, i) => {
      const x = startX + i * (cardW + gap) + cardW / 2;
      const y = h / 2 + 40;
      this.makeStageCard(x, y, cardW, cardH, stage);
    });

    // Bottom buttons
    this.makeButton(w / 2 - 200, h - 60, '⚙  SKILLS', () => {
      Effects.play('uiClick');
      this.scene.start('SkillTreeScene');
    });
    this.makeButton(w / 2, h - 60, '⚙  SETTINGS', () => {
      Effects.play('uiClick');
      this.scene.start('SettingsScene');
    });
    this.makeButton(w / 2 + 200, h - 60, '←  BACK', () => {
      Effects.play('uiClick');
      this.scene.start('MenuScene');
    });

    // Footer
    this.add.text(w / 2, h - 20, 'Click a stage to begin', {
      fontFamily: 'monospace', fontSize: '10px', color: '#3a4350',
    }).setOrigin(0.5);
  }

  private makeStageCard(x: number, y: number, w: number, h: number, stage: {
    id: number; name: string; subtitle: string; desc: string; unlocked: boolean; action: () => void;
  }): void {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, stage.unlocked ? 0x1a2030 : 0x0e1218, 0.95);
    bg.setStrokeStyle(1, stage.unlocked ? 0x39d0d8 : 0x2a3340, 0.7);

    if (stage.unlocked) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { bg.setFillStyle(0x243040, 1); Effects.play('uiHover'); });
      bg.on('pointerout',  () => bg.setFillStyle(0x1a2030, 0.95));
      bg.on('pointerup', stage.action);
    }

    const stageNum = this.add.text(0, -h / 2 + 30, `0${stage.id}`, {
      fontFamily: 'monospace', fontSize: '48px',
      color: stage.unlocked ? '#39d0d8' : '#3a4350',
    }).setOrigin(0.5);

    const name = this.add.text(0, -h / 2 + 90, stage.name, {
      fontFamily: 'monospace', fontSize: '14px',
      color: stage.unlocked ? '#cfd6e0' : '#4a5260',
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, -h / 2 + 115, stage.subtitle, {
      fontFamily: 'monospace', fontSize: '10px',
      color: stage.unlocked ? '#7a8090' : '#3a4350',
    }).setOrigin(0.5);

    // Wrap description
    const descLines = this.wrapText(stage.desc, 28);
    const desc = this.add.text(0, 0, descLines, {
      fontFamily: 'monospace', fontSize: '10px',
      color: stage.unlocked ? '#5a6470' : '#2a3038',
      align: 'center',
    }).setOrigin(0.5);

    // Preview art (procedural)
    const previewY = h / 2 - 70;
    this.drawStagePreview(c, 0, previewY, w - 40, 50, stage.id, stage.unlocked);

    const status = this.add.text(0, h / 2 - 20, stage.unlocked ? '▶  ENTER' : '🔒  LOCKED', {
      fontFamily: 'monospace', fontSize: '11px',
      color: stage.unlocked ? '#39d0d8' : '#3a4350',
    }).setOrigin(0.5);

    c.add([bg, stageNum, name, subtitle, desc, status]);
  }

  private drawStagePreview(c: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, stageId: number, unlocked: boolean): void {
    const g = this.add.graphics();
    const baseColor = unlocked ? (stageId === 1 ? 0x4a5260 : stageId === 2 ? 0x504060 : 0x405060) : 0x202830;
    g.fillStyle(baseColor, 0.5);
    g.fillRect(x - w / 2, y - h / 2, w, h);
    // Silhouettes
    g.fillStyle(unlocked ? 0x2a3038 : 0x101820, 0.9);
    for (let i = 0; i < 8; i++) {
      const bx = x - w / 2 + i * (w / 8) + 4;
      const bh = 10 + (i % 3) * 8;
      g.fillRect(bx, y + h / 2 - bh - 4, w / 8 - 8, bh);
    }
    c.add(g);
  }

  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      if (line.length + w.length + 1 > maxChars) {
        lines.push(line);
        line = w;
      } else {
        line += (line ? ' ' : '') + w;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 180, 40, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x3a4350);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { bg.setFillStyle(0x243040, 1); Effects.play('uiHover'); });
    bg.on('pointerout',  () => bg.setFillStyle(0x1a2030, 0.95));
    bg.on('pointerup', onClick);
    const t = this.add.text(0, 0, label, {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0',
    }).setOrigin(0.5);
    c.add([bg, t]);
  }
}

export default MapScene;
