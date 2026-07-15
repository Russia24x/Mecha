/**
 * MECHA: LAST PROTOCOL - SkillTreeScene
 * Visual skill tree where the player spends skill points to unlock
 * permanent gameplay modifiers. Saves to localStorage immediately.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { SkillTree, SKILL_DEFS, type SkillDef } from '../../shared/SkillTree';
import { Effects } from '../../shared/Effects';
import { AssetGenerator } from '../../shared/AssetGenerator';

export class SkillTreeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SkillTreeScene' });
  }

  create(): void {
    Effects.playMusic('menuAmbient');
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;

    // Procedural background
    const bgUrl = AssetGenerator.get('skills-bg', w, h);
    this.textures.addBase64('skills-bg', bgUrl);
    this.time.delayedCall(50, () => {
      if (this.textures.exists('skills-bg')) {
        this.add.image(0, 0, 'skills-bg').setOrigin(0, 0).setDepth(-1);
      }
    });

    // Title
    this.add.text(w / 2, 50, 'SKILL TREE', {
      fontFamily: 'monospace', fontSize: '32px',
      color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);

    const skills = SkillTree.get();
    const spText = this.add.text(w / 2, 90, `SKILL POINTS: ${skills.skillPoints}`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffe060',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Three columns: combat / mobility / survival
    const trees: Array<{ name: string; color: number; tree: 'combat' | 'mobility' | 'survival' }> = [
      { name: '⚔  COMBAT', color: 0xff5050, tree: 'combat' },
      { name: '➤  MOBILITY', color: 0x40d0ff, tree: 'mobility' },
      { name: '♥  SURVIVAL', color: 0x40d070, tree: 'survival' },
    ];

    const colW = 280;
    const colGap = 30;
    const totalW = trees.length * colW + (trees.length - 1) * colGap;
    const startX = (w - totalW) / 2;

    trees.forEach((t, ti) => {
      const x = startX + ti * (colW + colGap);
      // Column header
      const header = this.add.text(x + colW / 2, 140, t.name, {
        fontFamily: 'monospace', fontSize: '16px', color: '#' + t.color.toString(16).padStart(6, '0'),
      }).setOrigin(0.5);
      // Column background
      const bg = this.add.rectangle(x + colW / 2, h / 2 + 30, colW, h - 220, 0x101820, 0.6);
      bg.setStrokeStyle(1, 0x2a3340);

      // Skill cards in this column
      const treeSkills = SKILL_DEFS.filter(s => s.tree === t.tree);
      const cardH = 95;
      const cardGap = 12;
      const startY = 180;
      treeSkills.forEach((skill, si) => {
        const y = startY + si * (cardH + cardGap);
        this.makeSkillCard(x + 10, y, colW - 20, cardH, skill, t.color, spText);
      });
    });

    // Back button
    this.makeButton(w / 2, h - 40, '←  BACK', () => {
      Effects.play('uiClick');
      this.scene.start('MapScene');
    });

    this.add.text(w / 2, h - 10, 'Earn skill points by killing enemies (every 10) and defeating bosses (3 each).', {
      fontFamily: 'monospace', fontSize: '10px', color: '#3a4350',
    }).setOrigin(0.5);
  }

  private makeSkillCard(x: number, y: number, w: number, h: number, skill: SkillDef, color: number, spText: Phaser.GameObjects.Text): void {
    const unlocked = SkillTree.isUnlocked(skill.id);
    const canUnlock = SkillTree.canUnlock(skill.id);
    const prereqMet = !skill.requires || SkillTree.isUnlocked(skill.requires);

    const c = this.add.container(x + w / 2, y + h / 2);
    const bg = this.add.rectangle(0, 0, w, h, unlocked ? 0x1a3020 : (canUnlock ? 0x1a2030 : 0x101418), 0.95);
    bg.setStrokeStyle(1, unlocked ? 0x40d070 : (canUnlock ? color : 0x2a3340), unlocked ? 0.9 : 0.5);

    if (canUnlock) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { bg.setFillStyle(0x243040, 1); Effects.play('uiHover'); });
      bg.on('pointerout',  () => bg.setFillStyle(0x1a2030, 0.95));
      bg.on('pointerup', () => {
        if (SkillTree.unlock(skill.id)) {
          Effects.play('checkpoint');  // positive SFX
          // Re-render this scene
          this.scene.restart();
        }
      });
    }

    const name = this.add.text(-w / 2 + 12, -h / 2 + 12, skill.name, {
      fontFamily: 'monospace', fontSize: '13px',
      color: unlocked ? '#40d070' : (prereqMet ? '#cfd6e0' : '#4a5260'),
    }).setOrigin(0, 0);

    const cost = this.add.text(w / 2 - 12, -h / 2 + 12, `${skill.cost} SP`, {
      fontFamily: 'monospace', fontSize: '11px',
      color: unlocked ? '#40d070' : (canUnlock ? '#ffe060' : '#3a4350'),
    }).setOrigin(1, 0);

    const desc = this.add.text(-w / 2 + 12, -h / 2 + 36, this.wrap(skill.description, 32), {
      fontFamily: 'monospace', fontSize: '10px',
      color: unlocked ? '#9be0b0' : (prereqMet ? '#7a8090' : '#3a4350'),
      lineSpacing: 3,
    }).setOrigin(0, 0);

    const status = this.add.text(0, h / 2 - 12,
      unlocked ? '✓  UNLOCKED' : (prereqMet ? (canUnlock ? 'CLICK TO UNLOCK' : 'NOT ENOUGH SP') : '🔒  REQUIRES PREREQUISITE'),
      {
        fontFamily: 'monospace', fontSize: '9px',
        color: unlocked ? '#40d070' : (canUnlock ? '#ffe060' : '#3a4350'),
      }
    ).setOrigin(0.5, 1);

    c.add([bg, name, cost, desc, status]);
  }

  private wrap(text: string, max: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      if (line.length + w.length + 1 > max) { lines.push(line); line = w; }
      else line += (line ? ' ' : '') + w;
    }
    if (line) lines.push(line);
    return lines.join('\n');
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

export default SkillTreeScene;
