/**
 * MECHA: LAST PROTOCOL — Skill Tree UI v7.0
 *
 * REDESIGNED: Minimal diamond-node layout (PCB style, not hex).
 * Inspired by Blasphemous (dark minimalism) + Armored Core 6 (clean circuit).
 *
 * Design:
 *   - Diamond-shaped nodes (rotated squares) — clean, unique, readable
 *   - Circuit traces: right-angled L-lines with via dots
 *   - Three node sizes: small (minor), medium (notable), large (core)
 *   - Node states: dim (locked), glow (ready), bright (unlocked)
 *   - Connection lines: dim (locked), amber (unlocked path)
 *   - No hexagons — diamonds are cleaner and more readable
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale, fixTextStyle } from '../../systems/LocalizationSystem';
import { SkillTreeSystem, type SkillNode } from '../../systems/SkillTreeSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import { getSkill } from '../../data/skills/skills';
import { THEME, addCornerBrackets, addScanlines } from '../Theme';
import type { SkillTree, SkillData } from '../../data/types';

const TREE_ICONS: Record<SkillTree, string> = {
  combat: '†', weapon: '▣', movement: '➤', energy: '⚡', protocol: '◈', survival: '♥',
};
const TREE_NAMES: Record<SkillTree, { en: string; fa: string }> = {
  combat: { en: 'COMBAT', fa: 'رزم' },
  weapon: { en: 'WEAPON', fa: 'سلاح' },
  movement: { en: 'MOVEMENT', fa: 'حرکت' },
  energy: { en: 'ENERGY', fa: 'انرژی' },
  protocol: { en: 'PROTOCOL', fa: 'پروتکل' },
  survival: { en: 'SURVIVAL', fa: 'بقا' },
};
const TREE_SUBTITLES: Record<SkillTree, { en: string; fa: string }> = {
  combat: { en: 'OFFENSIVE SYSTEMS', fa: 'سیستم‌های تهاجمی' },
  weapon: { en: 'ARSENAL MODULES', fa: 'ماژول‌های تسلیحات' },
  movement: { en: 'LOCOMOTION CORE', fa: 'هسته حرکت' },
  energy: { en: 'POWER GRID', fa: 'شبکه قدرت' },
  protocol: { en: 'AI COUNTERMEASURES', fa: 'ضداقدام هوش مصنوعی' },
  survival: { en: 'DEFENSE MATRIX', fa: 'ماتریس دفاع' },
};
const TREE_COLORS: Record<SkillTree, number> = {
  combat: 0xff6030, weapon: 0xffc040, movement: 0x40c0ff,
  energy: 0x40ffe0, protocol: 0xc060ff, survival: 0x60ff80,
};
const TIER_LABELS: Record<number, { en: string; fa: string }> = {
  0: { en: 'TERMINAL', fa: 'ترمینال' },
  1: { en: 'SUBROUTINE', fa: 'زیرروتین' },
  2: { en: 'CORE', fa: 'هسته' },
};

const LEFT_PANEL_W = 200;
const TREE_AREA = { x: LEFT_PANEL_W + 30, y: 120, w: 580, h: 460 };
const GRID_SIZE = 110;
const DETAIL_PANEL = { x: GAME.WIDTH - 160, y: 340, w: 250, h: 340 };

function safeSetColor(text: Phaser.GameObjects.Text | undefined, color: string): void {
  if (!text || !text.active) return;
  const tObj = text as unknown as { canvas?: HTMLCanvasElement | null };
  if (tObj.canvas === null) return;
  try { text.setColor(color); } catch { /* canvas not ready */ }
}

interface TreeNode {
  skillId: string;
  skillData: SkillData;
  node: SkillNode;
  screenX: number;
  screenY: number;
  diamond: Phaser.GameObjects.Rectangle;  // rotated square
  glow: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Text;
  costLabel: Phaser.GameObjects.Text;
  allTexts: Phaser.GameObjects.Text[];
  allShapes: Phaser.GameObjects.Shape[];
}

export class SkillTreeUI extends NavigableOverlay {
  private treeTabs: { bg: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Text; label: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Rectangle }[] = [];
  private selectedTree: SkillTree = 'combat';
  private trees: SkillTree[] = ['combat', 'weapon', 'movement', 'energy', 'protocol', 'survival'];
  private treeNodes: TreeNode[] = [];
  private connectionGraphics?: Phaser.GameObjects.Graphics;
  private bgGraphics?: Phaser.GameObjects.Graphics;
  private headerText?: Phaser.GameObjects.Text;
  private spValueText?: Phaser.GameObjects.Text;

  private detail: {
    name: Phaser.GameObjects.Text;
    tier: Phaser.GameObjects.Text;
    desc: Phaser.GameObjects.Text;
    effect: Phaser.GameObjects.Text;
    cost: Phaser.GameObjects.Text;
    status: Phaser.GameObjects.Text;
  } | null = null;

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';

    // Background
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, THEME.BG_VOID, 0.96);
    this.container.add(overlay);
    this.container.add(addScanlines(scene, w, h, 0.02));

    // Starfield
    for (let i = 0; i < 40; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h;
      const star = scene.add.circle(sx, sy, Math.random() * 1 + 0.3, 0x40c0ff, Math.random() * 0.2 + 0.05);
      this.container.add(star);
    }

    // Title
    this.container.add(scene.add.text(w / 2, 28, isFa ? 'قشر عصبی' : 'NEURAL CORTEX', fixTextStyle({
      fontFamily: 'monospace', fontSize: '22px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 5, letterSpacing: 3,
    })).setOrigin(0.5));
    this.container.add(scene.add.text(w / 2, 52, isFa ? 'پروتکل‌ها را بکوب' : 'FORGE NEW PROTOCOLS', fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_DIM, letterSpacing: 4,
    })).setOrigin(0.5));

    // Header
    this.headerText = scene.add.text(TREE_AREA.x + TREE_AREA.w / 2, 82, '', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, stroke: '#000', strokeThickness: 3, letterSpacing: 1,
    })).setOrigin(0.5);
    this.container.add(this.headerText);

    // SP badge
    const spX = w - 85, spY = 38;
    const spBg = scene.add.rectangle(spX, spY, 140, 42, THEME.BG_PANEL, 0.9);
    spBg.setStrokeStyle(1, THEME.AMBER, 0.5);
    this.container.add(spBg);
    this.container.add(addCornerBrackets(scene, spX, spY, 140, 42, THEME.AMBER, 6, 0.5));
    this.container.add(scene.add.text(spX - 48, spY, '◆', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_AMBER,
    })).setOrigin(0.5));
    this.container.add(scene.add.text(spX - 28, spY - 9, 'PROTOCOL SP', fixTextStyle({
      fontFamily: 'monospace', fontSize: '7px', color: THEME.TEXT_DIM, letterSpacing: 1,
    })).setOrigin(0, 0.5));
    this.spValueText = scene.add.text(spX - 28, spY + 7, '0', fixTextStyle({
      fontFamily: 'monospace', fontSize: '15px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 3,
    })).setOrigin(0, 0.5);
    this.container.add(this.spValueText);

    // Left panel: tree tabs
    this.buildTreeTabs(scene);

    // Detail panel
    this.buildDetailPanel(scene);

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 28, 200, 36, THEME.BG_PANEL, 0.95);
    bg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(addCornerBrackets(scene, w / 2, h - 28, 200, 36, THEME.CYAN, 6, 0.5));
    const backText = scene.add.text(w / 2, h - 28, isFa ? '▲ خروج' : '▲ DISENGAGE', fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    })).setOrigin(0.5);
    this.container.add([bg, backText]);
    this.registerNav(bg, backText, () => { AudioSystem.play('uiClick'); onBack(); });

    this.refreshTree();
    this.container.setScrollFactor(0, 0, true);
  }

  private buildTreeTabs(scene: Phaser.Scene): void {
    const tabW = LEFT_PANEL_W - 20, tabH = 62, gap = 4;
    const startY = 110;
    const isFa = getLocale() === 'fa';
    this.trees.forEach((tree) => {
      const i = this.trees.indexOf(tree);
      const y = startY + i * (tabH + gap);
      const x = 10 + tabW / 2;
      const color = TREE_COLORS[tree];
      const bg = scene.add.rectangle(x, y, tabW, tabH, THEME.BG_PANEL, 0.92);
      bg.setStrokeStyle(1, color, 0.25);
      const bar = scene.add.rectangle(x - tabW / 2 + 3, y, 3, tabH - 10, color, 0.4);
      const icon = scene.add.text(x - tabW / 2 + 22, y, TREE_ICONS[tree], fixTextStyle({
        fontFamily: 'monospace', fontSize: '18px', color: THEME.TEXT_MED,
      })).setOrigin(0.5);
      const label = scene.add.text(x + 15, y - 10, isFa ? TREE_NAMES[tree].fa : TREE_NAMES[tree].en, fixTextStyle({
        fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_MED, letterSpacing: 1,
      })).setOrigin(0.5);
      const sub = scene.add.text(x + 15, y + 8, isFa ? TREE_SUBTITLES[tree].fa : TREE_SUBTITLES[tree].en, fixTextStyle({
        fontFamily: 'monospace', fontSize: '7px', color: THEME.TEXT_DIM,
      })).setOrigin(0.5);
      const count = SkillTreeSystem.getTree(tree).filter(n => n.unlocked).length;
      const total = SkillTreeSystem.getTree(tree).length;
      const countText = scene.add.text(x + 15, y + 18, `${count}/${total}`, fixTextStyle({
        fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_DIM,
      })).setOrigin(0.5);
      this.container.add([bg, bar, icon, label, sub, countText]);
      this.treeTabs.push({ bg, icon, label, sub, bar });
      this.registerNav(bg, label, () => { this.selectedTree = tree; this.refreshTree(); AudioSystem.play('uiClick'); });
    });

    // Register tabs for L1/R1 switching
    this.getController()?.addTabs(this.trees.map(t => ({
      id: t, label: t,
      onSelect: () => { this.selectedTree = t; this.refreshTree(); AudioSystem.play('uiClick'); },
    })));
  }

  private buildDetailPanel(scene: Phaser.Scene): void {
    const { x, y, w, h } = DETAIL_PANEL;
    const isFa = getLocale() === 'fa';
    const bg = scene.add.rectangle(x, y, w, h, THEME.BG_PANEL, 0.92);
    bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
    this.container.add(bg);
    this.container.add(addCornerBrackets(scene, x, y, w, h, THEME.AMBER, 6, 0.5));
    const titleBar = scene.add.rectangle(x, y - h / 2 + 14, w - 8, 24, THEME.BG_PANEL_HI, 0.9);
    this.container.add(titleBar);
    this.container.add(scene.add.text(x, y - h / 2 + 14, isFa ? 'گره هدف' : 'TARGET NODE', fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_AMBER, letterSpacing: 2,
    })).setOrigin(0.5));
    const tier = scene.add.text(x, y - h / 2 + 45, '', fixTextStyle({
      fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_MED, letterSpacing: 2,
    })).setOrigin(0.5);
    const name = scene.add.text(x, y - h / 2 + 75, '', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, stroke: '#000', strokeThickness: 3,
      wordWrap: { width: w - 20 }, align: 'center',
    })).setOrigin(0.5);
    this.container.add(scene.add.rectangle(x, y - 25, w - 30, 1, THEME.STROKE_MED, 0.7));
    const desc = scene.add.text(x, y + 5, '', fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_MED,
      wordWrap: { width: w - 20 }, align: 'center', lineSpacing: 3,
    })).setOrigin(0.5);
    const effect = scene.add.text(x, y + 55, '', fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_ACCENT,
      wordWrap: { width: w - 20 }, align: 'center',
    })).setOrigin(0.5);
    const cost = scene.add.text(x, y + 95, '', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 3,
    })).setOrigin(0.5);
    const status = scene.add.text(x, y + 125, '', fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_DIM, letterSpacing: 1,
    })).setOrigin(0.5);
    this.container.add([tier, name, desc, effect, cost, status]);
    this.detail = { name, tier, desc, effect, cost, status };
  }

  private gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    const cx = TREE_AREA.x + TREE_AREA.w / 2;
    const cy = TREE_AREA.y + TREE_AREA.h - 60;
    return { x: cx + gridX * GRID_SIZE, y: cy - gridY * GRID_SIZE };
  }

  private refreshTree(): void {
    // Sync UIController tab index
    const treeIdx = this.trees.indexOf(this.selectedTree);
    this.getController()?.setCurrentTab(treeIdx >= 0 ? treeIdx : 0);
    // Cleanup
    const oldSet = new Set(this.treeNodes.map(n => n.diamond));
    this.navElements = this.navElements.filter(el => !oldSet.has(el.bg as unknown as Phaser.GameObjects.Rectangle));
    this.treeNodes.forEach(n => {
      n.allShapes.forEach(s => { if (s && s.active) s.destroy(); });
      n.allTexts.forEach(t => { if (t && t.active) t.destroy(); });
    });
    this.treeNodes = [];
    if (this.connectionGraphics) { this.connectionGraphics.destroy(); this.connectionGraphics = undefined; }
    if (this.bgGraphics) { this.bgGraphics.destroy(); this.bgGraphics = undefined; }
    this.scene.tweens.killTweensOf(this.container);

    // SP
    if (this.spValueText) {
      const sp = ExperienceSystem.getSkillPoints();
      this.spValueText.setText(String(sp));
      safeSetColor(this.spValueText, sp > 0 ? THEME.TEXT_AMBER : THEME.TEXT_DIM);
    }

    // Tabs
    this.trees.forEach((tree, i) => {
      if (!this.treeTabs[i]) return;
      const tab = this.treeTabs[i];
      const isSelected = tree === this.selectedTree;
      const color = TREE_COLORS[tree];
      tab.bg.setFillStyle(isSelected ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.92);
      tab.bg.setStrokeStyle(isSelected ? 2 : 1, color, isSelected ? 0.8 : 0.25);
      tab.bar.setFillStyle(color, isSelected ? 1 : 0.3);
      safeSetColor(tab.icon, isSelected ? '#ffe080' : THEME.TEXT_MED);
      safeSetColor(tab.label, isSelected ? '#ffe080' : THEME.TEXT_MED);
      safeSetColor(tab.sub, isSelected ? THEME.TEXT_MED : THEME.TEXT_DIM);
    });

    // Header
    const isFa = getLocale() === 'fa';
    const treeName = isFa ? TREE_NAMES[this.selectedTree].fa : TREE_NAMES[this.selectedTree].en;
    const treeSub = isFa ? TREE_SUBTITLES[this.selectedTree].fa : TREE_SUBTITLES[this.selectedTree].en;
    const unlockedCount = SkillTreeSystem.getTree(this.selectedTree).filter(n => n.unlocked).length;
    const totalCount = SkillTreeSystem.getTree(this.selectedTree).length;
    if (this.headerText) {
      this.headerText.setText(`${TREE_ICONS[this.selectedTree]}  ${treeName}  ·  ${treeSub}  ·  ${unlockedCount}/${totalCount}`);
      safeSetColor(this.headerText, THEME.TEXT_BRIGHT);
    }

    // Tree area background
    this.bgGraphics = this.scene.add.graphics();
    this.bgGraphics.fillStyle(THEME.BG_PANEL, 0.3);
    this.bgGraphics.fillRoundedRect(TREE_AREA.x - 8, TREE_AREA.y - 8, TREE_AREA.w + 16, TREE_AREA.h + 16, 8);
    // Corner brackets
    const bx = TREE_AREA.x - 8, by = TREE_AREA.y - 8, bw = TREE_AREA.w + 16, bh = TREE_AREA.h + 16;
    this.bgGraphics.lineStyle(2, TREE_COLORS[this.selectedTree], 0.4);
    this.bgGraphics.beginPath();
    this.bgGraphics.moveTo(bx, by + 20); this.bgGraphics.lineTo(bx, by); this.bgGraphics.lineTo(bx + 20, by);
    this.bgGraphics.moveTo(bx + bw - 20, by); this.bgGraphics.lineTo(bx + bw, by); this.bgGraphics.lineTo(bx + bw, by + 20);
    this.bgGraphics.moveTo(bx, by + bh - 20); this.bgGraphics.lineTo(bx, by + bh); this.bgGraphics.lineTo(bx + 20, by + bh);
    this.bgGraphics.moveTo(bx + bw - 20, by + bh); this.bgGraphics.lineTo(bx + bw, by + bh); this.bgGraphics.lineTo(bx + bw, by + bh - 20);
    this.bgGraphics.strokePath();
    this.container.add(this.bgGraphics);

    // Get nodes
    const nodes = SkillTreeSystem.getTree(this.selectedTree);
    if (nodes.length === 0) return;

    // Draw connections
    const treeColor = TREE_COLORS[this.selectedTree];
    const gfx = this.scene.add.graphics();
    gfx.setDepth(1);
    nodes.forEach(node => {
      const skill = getSkill(node.skill.id);
      if (!skill || !skill.requires) return;
      const parent = nodes.find(n => n.skill.id === skill.requires);
      if (!parent) return;
      const parentSkill = getSkill(parent.skill.id);
      if (!parentSkill) return;
      const childPos = this.gridToScreen(skill.pos?.x ?? 0, skill.pos?.y ?? 0);
      const parentPos = this.gridToScreen(parentSkill.pos?.x ?? 0, parentSkill.pos?.y ?? 0);
      const parentUnlocked = parent.unlocked;
      const childRadius = this.getNodeSize(skill);
      const parentRadius = this.getNodeSize(parentSkill);
      const traceColor = parentUnlocked ? treeColor : THEME.STROKE_DIM;
      const traceAlpha = parentUnlocked ? 0.8 : 0.3;
      const traceWidth = parentUnlocked ? 2.5 : 1.5;
      gfx.lineStyle(traceWidth, traceColor, traceAlpha);
      gfx.beginPath();
      gfx.moveTo(parentPos.x, parentPos.y - parentRadius);
      const midY = (parentPos.y + childPos.y) / 2;
      gfx.lineTo(parentPos.x, midY);
      gfx.strokePath();
      gfx.fillStyle(traceColor, traceAlpha);
      gfx.fillCircle(parentPos.x, midY, 2.5);
      gfx.lineStyle(traceWidth, traceColor, traceAlpha);
      gfx.beginPath();
      gfx.moveTo(parentPos.x, midY);
      gfx.lineTo(childPos.x, midY);
      gfx.strokePath();
      gfx.beginPath();
      gfx.moveTo(childPos.x, midY);
      gfx.lineTo(childPos.x, childPos.y + childRadius);
      gfx.strokePath();
    });
    this.connectionGraphics = gfx;
    this.container.add(gfx);

    // Build nodes — DIAMOND shape (rotated square)
    nodes.forEach((node) => {
      const skill = getSkill(node.skill.id);
      if (!skill) return;
      const pos = this.gridToScreen(skill.pos?.x ?? 0, skill.pos?.y ?? 0);
      const tier = skill.tier ?? 0;
      const size = this.getNodeSize(skill);  // half-width of the diamond
      const allShapes: Phaser.GameObjects.Shape[] = [];
      const allTexts: Phaser.GameObjects.Text[] = [];

      // Glow
      const glow = this.scene.add.circle(pos.x, pos.y, size + 12, treeColor, 0);
      glow.setStrokeStyle(2, treeColor, node.canUnlock ? 0.5 : 0);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(1);
      if (node.canUnlock) {
        this.scene.tweens.add({
          targets: glow, alpha: { from: 0.3, to: 0.7 }, scale: { from: 1, to: 1.15 },
          duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
      }
      allShapes.push(glow);

      // Diamond = rotated square
      const diamondSize = size * 2;
      const diamond = this.scene.add.rectangle(pos.x, pos.y, diamondSize, diamondSize, this.getNodeFill(node), 0.95);
      diamond.setAngle(45);
      const strokeW = tier === 2 ? 4 : tier === 1 ? 3 : 2;
      diamond.setStrokeStyle(strokeW, this.getNodeStroke(node), this.getNodeStrokeAlpha(node));
      diamond.setDepth(2);
      allShapes.push(diamond);

      // Inner dot for CORE/SUBROUTINE (smaller diamond inside)
      if (tier >= 1) {
        const innerSize = size * 0.8;
        const inner = this.scene.add.rectangle(pos.x, pos.y, innerSize, innerSize, this.getNodeStroke(node), 0.3);
        inner.setAngle(45);
        inner.setDepth(3);
        allShapes.push(inner);
      }

      // Icon
      const iconChar = this.getSkillIcon(skill);
      const iconSize = tier === 2 ? 20 : tier === 1 ? 17 : 15;
      const icon = this.scene.add.text(pos.x, pos.y, iconChar, fixTextStyle({
        fontFamily: 'monospace', fontSize: `${iconSize}px`,
        color: this.getNodeIconColor(node),
      })).setOrigin(0.5).setDepth(4);
      allTexts.push(icon);

      // Cost label
      const costLabel = this.scene.add.text(pos.x, pos.y + size + 16, `${skill.cost} SP`, fixTextStyle({
        fontFamily: 'monospace', fontSize: '10px',
        color: node.unlocked ? THEME.TEXT_GREEN : node.canUnlock ? THEME.TEXT_AMBER : THEME.TEXT_DIM,
        stroke: '#000', strokeThickness: 2,
      })).setOrigin(0.5).setDepth(3);
      allTexts.push(costLabel);

      this.container.add([...allShapes, ...allTexts]);

      const treeNode: TreeNode = {
        skillId: skill.id, skillData: skill, node,
        screenX: pos.x, screenY: pos.y,
        diamond, glow, icon, costLabel, allTexts, allShapes,
      };
      this.treeNodes.push(treeNode);

      // Nav
      const unlockAction = () => {
        if (node.canUnlock && SkillTreeSystem.unlock(skill.id)) {
          AudioSystem.play('skillUnlock');
          this.spawnUnlockEffect(pos.x, pos.y, treeColor, tier);
          this.refreshTree();
        }
      };
      // Register via registerNav (handles setInteractive + ctrl.addButton)
      const backIdx = this.navElements.length - 1;
      this.registerNav(diamond, icon, unlockAction, {
        insertAt: backIdx,
        focusColor: treeColor,
        normalColor: this.getNodeStroke(node),
      });
      // Preview detail panel on hover — MUST be AFTER registerNav
      // (registerNav → addButton → bg.off('pointerover') would remove our handler if placed before)
      diamond.on('pointerover', () => {
        this.updateDetailPanel(node, skill);
      });
    });

    this.navFocusIdx = Math.min(this.navFocusIdx, this.navElements.length - 1);
    if (this.treeNodes.length > 0) {
      const idx = Math.min(this.navFocusIdx, this.treeNodes.length - 1);
      if (idx >= 0 && this.treeNodes[idx]) {
        this.updateDetailPanel(this.treeNodes[idx].node, this.treeNodes[idx].skillData);
      }
    }
    this.scene.time.delayedCall(0, () => { if (this.isVisible) this.updateNavFocus(); });
  }

  private getNodeSize(skill: SkillData): number {
    const tier = skill.tier ?? 0;
    if (tier === 2) return 34;
    if (tier === 1) return 26;
    return 20;
  }

  private getNodeFill(node: SkillNode): number {
    if (node.unlocked) return TREE_COLORS[this.selectedTree];
    if (node.canUnlock) return THEME.BG_PANEL_HI;
    if (!node.prereqMet) return THEME.BG_DARK;
    return THEME.BG_PANEL;
  }
  private getNodeStroke(node: SkillNode): number {
    if (node.unlocked) return 0xffffff;
    if (node.canUnlock) return TREE_COLORS[this.selectedTree];
    return THEME.STROKE_DIM;
  }
  private getNodeStrokeAlpha(node: SkillNode): number {
    if (node.unlocked) return 1;
    if (node.canUnlock) return 0.9;
    if (!node.prereqMet) return 0.25;
    return 0.5;
  }
  private getNodeIconColor(node: SkillNode): string {
    if (node.unlocked) return '#ffffff';
    if (node.canUnlock) return THEME.TEXT_BRIGHT;
    if (!node.prereqMet) return THEME.TEXT_DIM;
    return THEME.TEXT_MED;
  }
  private getSkillIcon(skill: SkillData): string {
    if (skill.category === 'unlock' && skill.effect.unlock) {
      const u = skill.effect.unlock;
      if (u === 'shotgun') return '▣';
      if (u === 'railgun') return '━';
      if (u === 'rocket') return '◈';
      if (u === 'doubleJump') return '↑↑';
      if (u === 'wallJump') return '⇅';
      if (u === 'grapple') return '⋙';
      if (u === 'hover') return '≡';
      if (u === 'emp') return '⚡';
      if (u === 'hack') return '⌬';
    }
    if (skill.category === 'damage') return '†';
    if (skill.category === 'speed') return '➤';
    if (skill.category === 'defense') return '♥';
    if (skill.category === 'ability') return '◈';
    if (skill.category === 'utility') return '◆';
    return '◆';
  }

  private updateDetailPanel(node: SkillNode, skill: SkillData): void {
    if (!this.detail) return;
    const isFa = getLocale() === 'fa';
    const tier = skill.tier ?? 0;
    const tierLabel = isFa ? TIER_LABELS[tier]?.fa : TIER_LABELS[tier]?.en;
    safeSetColor(this.detail.name, node.unlocked ? THEME.TEXT_GREEN : node.canUnlock ? THEME.TEXT_BRIGHT : THEME.TEXT_MED);
    this.detail.name.setText(node.name);
    this.detail.tier.setText(`[ ${tierLabel} ]`);
    safeSetColor(this.detail.tier, tier === 2 ? THEME.TEXT_AMBER : tier === 1 ? THEME.TEXT_ACCENT : THEME.TEXT_MED);
    this.detail.desc.setText(node.description);
    const eff = skill.effect;
    let effectText = '';
    if (eff.multiplier) {
      const pct = Math.round((eff.multiplier - 1) * 100);
      effectText = `${pct > 0 ? '+' : ''}${pct}% ${this.statName(eff.stat, isFa)}`;
    } else if (eff.additive) {
      effectText = `+${eff.additive} ${this.statName(eff.stat, isFa)}`;
    } else if (eff.unlock) {
      effectText = isFa ? `قابلیت: ${eff.unlock}` : `ABILITY: ${eff.unlock.toUpperCase()}`;
    }
    this.detail.effect.setText(effectText);
    this.detail.cost.setText(node.unlocked ? '✓ INTEGRATED' : `◆ ${skill.cost} SP`);
    safeSetColor(this.detail.cost, node.unlocked ? THEME.TEXT_GREEN : THEME.TEXT_AMBER);
    let statusText = '';
    if (node.unlocked) statusText = isFa ? '✓ فعال' : 'ONLINE';
    else if (!node.prereqMet) statusText = isFa ? '🔒 قفل' : 'OFFLINE';
    else if (!node.hasSkillPoints) statusText = isFa ? '◆ SP ناکافی' : 'INSUFFICIENT SP';
    else statusText = isFa ? '▶ آماده' : 'READY';
    this.detail.status.setText(statusText);
    safeSetColor(this.detail.status, node.unlocked ? THEME.TEXT_GREEN : node.canUnlock ? THEME.TEXT_AMBER : THEME.TEXT_DIM);
  }

  private statName(stat: string, isFa: boolean): string {
    const names: Record<string, { en: string; fa: string }> = {
      maxHealth: { en: 'Max HP', fa: 'جان ماکزیمم' },
      maxEnergy: { en: 'Max Energy', fa: 'انرژی ماکزیمم' },
      energyRegen: { en: 'Energy Regen', fa: 'بازسازی انرژی' },
      moveSpeed: { en: 'Move Speed', fa: 'سرعت حرکت' },
      meleeDamage: { en: 'Melee Damage', fa: 'آسیب نزدیک' },
      fireCooldownMs: { en: 'Fire Rate', fa: 'نرخ شلیک' },
      dashCooldownMs: { en: 'Dash Cooldown', fa: 'دش' },
      invulnMs: { en: 'Invuln', fa: 'آسیب‌ناپذیری' },
    };
    const n = names[stat];
    return n ? (isFa ? n.fa : n.en) : stat;
  }

  private spawnUnlockEffect(x: number, y: number, color: number, tier: number): void {
    const particleCount = tier === 2 ? 20 : tier === 1 ? 16 : 12;
    const ring = this.scene.add.circle(x, y, 10, color, 0.8);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setDepth(10);
    this.container.add(ring);
    this.scene.tweens.add({
      targets: ring, scale: { from: 1, to: 5 }, alpha: { from: 0.8, to: 0 },
      duration: 700, ease: 'Cubic.out', onComplete: () => ring.destroy(),
    });
    const ring2 = this.scene.add.circle(x, y, 10, color, 0.5);
    ring2.setBlendMode(Phaser.BlendModes.ADD);
    ring2.setDepth(10);
    this.container.add(ring2);
    this.scene.tweens.add({
      targets: ring2, scale: { from: 1, to: 3 }, alpha: { from: 0.5, to: 0 },
      duration: 500, delay: 150, ease: 'Cubic.out', onComplete: () => ring2.destroy(),
    });
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const spark = this.scene.add.circle(x, y, 2.5, color, 0.9);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      spark.setDepth(10);
      this.container.add(spark);
      const dist = 55 + Math.random() * 40;
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
        alpha: 0, scale: 0.2,
        duration: 600 + Math.random() * 300, ease: 'Cubic.out',
        onComplete: () => spark.destroy(),
      });
    }
  }

  // onNavLeft/onNavRight removed — UIController handles L1/R1 tree switching
  // via ctrl.addTabs() registered in buildTreeTabs()
}

export default SkillTreeUI;
