/**
 * MECHA: LAST PROTOCOL — Skill Tree UI v3.2
 * 6 skill trees with unlockable nodes.
 * Full gamepad navigation: left/right to switch trees, up/down to select skill, A to unlock.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { SkillTreeSystem, type SkillNode } from '../../systems/SkillTreeSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import type { SkillTree } from '../../data/types';

const TREE_NAMES: Record<SkillTree, string> = {
  combat: '⚔', weapon: '🔫', movement: '➤', energy: '⚡', protocol: '◈', survival: '♥',
};
const TREE_COLORS: Record<SkillTree, number> = {
  combat: 0xff5050, weapon: 0xffe060, movement: 0x40d0ff,
  energy: 0x40ff80, protocol: 0xb040ff, survival: 0x40d070,
};

export class SkillTreeUI extends NavigableOverlay {
  private treeButtons: Phaser.GameObjects.Rectangle[] = [];
  private treeTexts: Phaser.GameObjects.Text[] = [];
  private selectedTree: SkillTree = 'combat';
  private skillNodes: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; node: SkillNode }[] = [];
  private trees: SkillTree[] = ['combat', 'weapon', 'movement', 'energy', 'protocol', 'survival'];
  private statsText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.9);
    this.container.add(overlay);

    this.container.add(scene.add.text(w / 2, 40, t('menu.settings') === 'تنظیمات' ? 'درخت مهارت' : 'SKILL TREE', {
      fontFamily: 'monospace', fontSize: '28px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    this.statsText = scene.add.text(w / 2, 72, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#7a8090', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.container.add(this.statsText);

    // Tree tabs
    const tabW = 180, tabGap = 10;
    const startX = (w - this.trees.length * tabW - (this.trees.length - 1) * tabGap) / 2;
    this.trees.forEach((tree, i) => {
      const x = startX + i * (tabW + tabGap) + tabW / 2;
      const bg = scene.add.rectangle(x, 110, tabW, 36, 0x1a2030, 0.95);
      bg.setStrokeStyle(1, TREE_COLORS[tree], 0.6);
      const textEl = scene.add.text(x, 110, `${TREE_NAMES[tree]} ${tree.toUpperCase()}`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#cfd6e0',
      }).setOrigin(0.5);
      this.container.add([bg, textEl]);
      this.treeButtons.push(bg);
      this.treeTexts.push(textEl);
      this.registerNav(bg, textEl, () => { this.selectedTree = tree; this.refreshTree(); AudioSystem.play('uiClick'); });
    });

    this.refreshTree();

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 40, 280, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    const textEl = scene.add.text(w / 2, h - 40, t('menu.back'), {
      fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0',
    }).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); onBack(); });
  }

  private refreshTree(): void {
    // Remove skill nav elements FIRST (keep tabs + back), THEN destroy them.
    // This avoids double-destroy: skillNodes and navElements referenced the same objects.
    const numTabs = this.trees.length;
    const numKeep = numTabs + 1; // tabs + back button
    const removed = this.navElements.splice(numKeep);
    removed.forEach(el => {
      if (el.bg && el.bg.active) el.bg.destroy();
      if (el.text && el.text.active) el.text.destroy();
    });
    // Clear skillNodes (objects already destroyed above)
    this.skillNodes = [];

    // Update stats text
    if (this.statsText) {
      const sp = ExperienceSystem.getSkillPoints();
      this.statsText.setText(`LV.${ExperienceSystem.getLevel()}  |  SP: ${sp}  |  ${SkillTreeSystem.getUnlockedCount()}/${SkillTreeSystem.getTotalCount()}`);
      this.statsText.setColor(sp > 0 ? '#ffe060' : '#7a8090');
    }

    // Highlight selected tab
    this.trees.forEach((tree, i) => {
      if (tree === this.selectedTree) {
        this.treeButtons[i].setFillStyle(0x243040, 1);
        this.treeButtons[i].setStrokeStyle(2, TREE_COLORS[tree], 1);
        this.treeTexts[i].setColor('#66f0ff');
      } else {
        this.treeButtons[i].setFillStyle(0x1a2030, 0.95);
        this.treeButtons[i].setStrokeStyle(1, TREE_COLORS[tree], 0.4);
        this.treeTexts[i].setColor('#cfd6e0');
      }
    });

    // Render skill nodes
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
      this.container.add(bg);

      const nameText = this.scene.add.text(60, y - 30, node.name, {
        fontFamily: 'monospace', fontSize: '13px',
        color: node.unlocked ? '#40d070' : node.canUnlock ? '#cfd6e0' : '#4a5260',
      }).setOrigin(0, 0);
      this.container.add(this.scene.add.text(w - 60, y - 30, `${node.skill.cost} SP`, {
        fontFamily: 'monospace', fontSize: '11px',
        color: node.unlocked ? '#40d070' : node.canUnlock ? '#ffe060' : '#3a4350',
      }).setOrigin(1, 0));
      this.container.add(this.scene.add.text(60, y - 8, node.description, {
        fontFamily: 'monospace', fontSize: '10px',
        color: node.unlocked ? '#9be0b0' : node.canUnlock ? '#7a8090' : '#3a4350',
      }).setOrigin(0, 0));
      this.container.add(this.scene.add.text(w / 2, y + 30,
        node.unlocked ? '✓ UNLOCKED' : node.canUnlock ? 'PRESS A TO UNLOCK' : node.prereqMet ? 'NOT ENOUGH SP' : '🔒 REQUIRES PREREQUISITE',
        { fontFamily: 'monospace', fontSize: '9px',
          color: node.unlocked ? '#40d070' : node.canUnlock ? '#ffe060' : '#3a4350',
        }).setOrigin(0.5, 1));

      this.skillNodes.push({ bg, text: nameText, node });

      // Register for nav (insert before back button)
      const unlockAction = () => {
        if (node.canUnlock && SkillTreeSystem.unlock(node.skill.id)) {
          AudioSystem.play('uiClick');
          this.refreshTree();
        }
      };
      // Register manually to insert before back button
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { bg.setFillStyle(0x243040, 1); });
      bg.on('pointerout', () => { bg.setFillStyle(bgColor, 0.95); });
      bg.on('pointerdown', () => { unlockAction(); });

      // Insert before back button
      const backIdx = this.navElements.length - 1;
      this.navElements.splice(backIdx, 0, {
        bg, text: nameText, onSelect: unlockAction,
        focusColor: TREE_COLORS[this.selectedTree],
        normalColor: strokeColor,
      });
    });

    this.navFocusIdx = Math.min(this.navFocusIdx, this.navElements.length - 1);
    // Defer updateNavFocus to next frame — Text objects need a frame to initialize
    // their internal canvas before setColor() can be called safely.
    // Calling setColor() immediately after creation can crash with
    // "Cannot read properties of null (reading 'drawImage')" because the
    // Text's canvas texture hasn't been created yet.
    this.scene.time.delayedCall(0, () => {
      if (this.isVisible) this.updateNavFocus();
    });
  }

  /** Left/right switches tree tabs. */
  protected onNavLeft(): void {
    const idx = this.trees.indexOf(this.selectedTree);
    this.selectedTree = this.trees[(idx - 1 + this.trees.length) % this.trees.length];
    this.refreshTree();
    AudioSystem.play('uiClick');
    this.navFocusIdx = 0;
    this.updateNavFocus();
  }

  protected onNavRight(): void {
    const idx = this.trees.indexOf(this.selectedTree);
    this.selectedTree = this.trees[(idx + 1) % this.trees.length];
    this.refreshTree();
    AudioSystem.play('uiClick');
    this.navFocusIdx = 0;
    this.updateNavFocus();
  }
}

export default SkillTreeUI;
