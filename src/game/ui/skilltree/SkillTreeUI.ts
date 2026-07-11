/**
 * MECHA: LAST PROTOCOL — Skill Tree UI
 * Displays 6 skill trees with unlockable nodes.
 * Click a skill to unlock it (if prerequisites + SP met).
 * Shows: skill name, description, cost, locked/unlocked status.
 * Depth 250.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { SkillTreeSystem, type SkillNode } from '../../systems/SkillTreeSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import type { SkillTree } from '../../data/types';

const TREE_NAMES: Record<SkillTree, string> = {
  combat: '⚔',
  weapon: '🔫',
  movement: '➤',
  energy: '⚡',
  protocol: '◈',
  survival: '♥',
};

const TREE_COLORS: Record<SkillTree, number> = {
  combat: 0xff5050, weapon: 0xffe060, movement: 0x40d0ff,
  energy: 0x40ff80, protocol: 0xb040ff, survival: 0x40d070,
};

export class SkillTreeUI {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private treeButtons: Phaser.GameObjects.Rectangle[] = [];
  private selectedTree: SkillTree = 'combat';
  private skillNodes: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; node: SkillNode }[] = [];

  constructor(scene: Phaser.Scene, onBack: () => void) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.9);
    overlay.setInteractive();
    this.container.add(overlay);

    // Title + stats
    this.container.add(scene.add.text(w / 2, 40, t('menu.settings') === 'تنظیمات' ? 'درخت مهارت' : 'SKILL TREE', {
      fontFamily: 'monospace', fontSize: '28px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    this.container.add(scene.add.text(w / 2, 72, `LV.${ExperienceSystem.getLevel()}  |  SP: ${ExperienceSystem.getSkillPoints()}  |  ${SkillTreeSystem.getUnlockedCount()}/${SkillTreeSystem.getTotalCount()}`, {
      fontFamily: 'monospace', fontSize: '14px', color: ExperienceSystem.getSkillPoints() > 0 ? '#ffe060' : '#7a8090', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));

    // Tree selection tabs
    const trees: SkillTree[] = ['combat', 'weapon', 'movement', 'energy', 'protocol', 'survival'];
    const tabW = 180, tabGap = 10;
    const startX = (w - trees.length * tabW - (trees.length - 1) * tabGap) / 2;
    trees.forEach((tree, i) => {
      const x = startX + i * (tabW + tabGap) + tabW / 2;
      const bg = scene.add.rectangle(x, 110, tabW, 36, 0x1a2030, 0.95);
      bg.setStrokeStyle(1, TREE_COLORS[tree], 0.6);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => { this.selectedTree = tree; this.refreshTree(); AudioSystem.play('uiClick'); });
      const textEl = scene.add.text(x, 110, `${TREE_NAMES[tree]} ${tree.toUpperCase()}`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#cfd6e0',
      }).setOrigin(0.5);
      this.container.add([bg, textEl]);
      this.treeButtons.push(bg);
    });

    // Skill nodes area (rebuilt on tree selection)
    this.refreshTree();

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 40, 280, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onBack(); });
    this.container.add(bg);
    this.container.add(scene.add.text(w / 2, h - 40, t('menu.back'), { fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0' }).setOrigin(0.5));
  }

  private refreshTree(): void {
    // Destroy old nodes
    this.skillNodes.forEach(n => { n.bg.destroy(); n.text.destroy(); });
    this.skillNodes = [];

    // Highlight selected tab
    const trees: SkillTree[] = ['combat', 'weapon', 'movement', 'energy', 'protocol', 'survival'];
    this.treeButtons.forEach((bg, i) => {
      if (trees[i] === this.selectedTree) {
        bg.setFillStyle(0x243040, 1);
        bg.setStrokeStyle(2, TREE_COLORS[this.selectedTree], 1);
      } else {
        bg.setFillStyle(0x1a2030, 0.95);
        bg.setStrokeStyle(1, TREE_COLORS[trees[i]], 0.4);
      }
    });

    // Render skill nodes for selected tree
    const nodes = SkillTreeSystem.getTree(this.selectedTree);
    const w = GAME.WIDTH;
    const startY = 160;
    const cardH = 90;
    const cardW = w - 120;
    const gap = 10;
    nodes.forEach((node, i) => {
      const y = startY + i * (cardH + gap);
      const bgColor = node.unlocked ? 0x1a3020 : node.canUnlock ? 0x1a2030 : 0x0e1218;
      const strokeColor = node.unlocked ? 0x40d070 : node.canUnlock ? TREE_COLORS[this.selectedTree] : 0x2a3340;
      const bg = this.scene.add.rectangle(w / 2, y, cardW, cardH, bgColor, 0.95);
      bg.setStrokeStyle(1, strokeColor, node.unlocked ? 0.9 : node.canUnlock ? 0.7 : 0.4);
      if (node.canUnlock) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x243040, 1));
        bg.on('pointerout', () => bg.setFillStyle(bgColor, 0.95));
        bg.on('pointerdown', () => {
          if (SkillTreeSystem.unlock(node.skill.id)) {
            this.refreshTree();
            // Update SP display
          }
        });
      }
      this.container.add(bg);
      // Name
      const nameText = this.scene.add.text(60, y - 30, node.name, {
        fontFamily: 'monospace', fontSize: '13px',
        color: node.unlocked ? '#40d070' : node.canUnlock ? '#cfd6e0' : '#4a5260',
      }).setOrigin(0, 0);
      // Cost
      const costText = this.scene.add.text(w - 60, y - 30, `${node.skill.cost} SP`, {
        fontFamily: 'monospace', fontSize: '11px',
        color: node.unlocked ? '#40d070' : node.canUnlock ? '#ffe060' : '#3a4350',
      }).setOrigin(1, 0);
      // Description
      const descText = this.scene.add.text(60, y - 8, node.description, {
        fontFamily: 'monospace', fontSize: '10px',
        color: node.unlocked ? '#9be0b0' : node.canUnlock ? '#7a8090' : '#3a4350',
      }).setOrigin(0, 0);
      // Status
      const statusText = this.scene.add.text(w / 2, y + 30,
        node.unlocked ? '✓ UNLOCKED' : node.canUnlock ? 'CLICK TO UNLOCK' : node.prereqMet ? 'NOT ENOUGH SP' : '🔒 REQUIRES PREREQUISITE',
        { fontFamily: 'monospace', fontSize: '9px',
          color: node.unlocked ? '#40d070' : node.canUnlock ? '#ffe060' : '#3a4350',
        }).setOrigin(0.5, 1);
      this.container.add([nameText, costText, descText, statusText]);
      this.skillNodes.push({ bg, text: nameText, node });
    });
  }

  show(): void { this.container.setVisible(true); this.refreshTree(); }
  hide(): void { this.container.setVisible(false); }
  get isVisible(): boolean { return this.container.visible; }

  destroy(): void { this.container.destroy(); }
}

export default SkillTreeUI;
