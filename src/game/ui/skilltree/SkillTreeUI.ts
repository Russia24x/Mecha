/**
 * MECHA: LAST PROTOCOL — Skill Tree UI v5.0
 *
 * INSPIRATION: Path of Exile (node graph), Diablo (tiered tree),
 * Last Epoch (skill nodes with categories).
 *
 * ARCHITECTURE:
 *   - Layout: position-based (each skill has explicit x,y grid position)
 *   - Node shapes: circle (minor), diamond (notable), hexagon (keystone)
 *   - Connection lines: curved bezier between parent→child
 *   - Detail panel: rich — name, tier badge, description, effect, cost, status
 *   - Tree header: icon + name + progress (X/Y unlocked)
 *   - Background: animated starfield + radial glow per tree color
 *
 * Layout (1280×720):
 *   ┌──────────────────────────────────────────────────────┐
 *   │  TITLE: SKILL MATRIX                          SP: 5  │
 *   │  ┌─────────┐                          ┌────────────┐ │
 *   │  │ COMBAT ⚔│     ◆ ─ ◯ ─ ◇            │  DETAILS   │ │
 *   │  │ WEAPON 🔫│         │                │            │ │
 *   │  │ MOVE ➤  │     ◯ ─ ◇                │  Name      │ │
 *   │  │ ENERGY ⚡│         │                │  [TIER]    │ │
 *   │  │ PROTO ◈ │     ◇ ─ ⬡                │  Desc...   │ │
 *   │  │ SURV ♥  │                          │  Effect    │ │
 *   │  └─────────┘                          │  Cost: 3SP │ │
 *   │                                       │  [STATUS]  │ │
 *   │              [BACK]                   └────────────┘ │
 *   └──────────────────────────────────────────────────────┘
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale } from '../../systems/LocalizationSystem';
import { SkillTreeSystem, type SkillNode } from '../../systems/SkillTreeSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import { getSkill } from '../../data/skills/skills';
import type { SkillTree, SkillData } from '../../data/types';

// ─── Tree metadata ────────────────────────────────────────────────────────
const TREE_ICONS: Record<SkillTree, string> = {
  combat: '⚔', weapon: '🔫', movement: '➤', energy: '⚡', protocol: '◈', survival: '♥',
};
const TREE_NAMES: Record<SkillTree, { en: string; fa: string }> = {
  combat: { en: 'COMBAT', fa: 'رزم' },
  weapon: { en: 'WEAPON', fa: 'سلاح' },
  movement: { en: 'MOVEMENT', fa: 'حرکت' },
  energy: { en: 'ENERGY', fa: 'انرژی' },
  protocol: { en: 'PROTOCOL', fa: 'پروتکل' },
  survival: { en: 'SURVIVAL', fa: 'بقا' },
};
const TREE_COLORS: Record<SkillTree, number> = {
  combat: 0xff5050, weapon: 0xffe060, movement: 0x40d0ff,
  energy: 0x40ff80, protocol: 0xb040ff, survival: 0x40d070,
};
const TREE_BG_COLORS: Record<SkillTree, number> = {
  combat: 0x1a0810, weapon: 0x1a1808, movement: 0x08101a,
  energy: 0x081a10, protocol: 0x14081a, survival: 0x081a10,
};
const TREE_DESC: Record<SkillTree, { en: string; fa: string }> = {
  combat: { en: 'Offensive capabilities', fa: 'قابلیت‌های تهاجمی' },
  weapon: { en: 'Arsenal expansion', fa: 'گسترش تسلیحات' },
  movement: { en: 'Mobility & agility', fa: 'تحرک و چابکی' },
  energy: { en: 'Core power systems', fa: 'سیستم‌های قدرت هسته' },
  protocol: { en: 'AI manipulation', fa: 'دستکاری هوش مصنوعی' },
  survival: { en: 'Defensive protocols', fa: 'پروتکل‌های دفاعی' },
};

const TIER_LABELS: Record<number, { en: string; fa: string }> = {
  0: { en: 'MINOR', fa: 'جزئی' },
  1: { en: 'NOTABLE', fa: 'مهم' },
  2: { en: 'KEYSTONE', fa: 'کلیدی' },
};

// ─── Layout constants ─────────────────────────────────────────────────────
const LEFT_PANEL_W = 200;
const TREE_AREA = {
  x: LEFT_PANEL_W + 20,
  y: 100,
  w: 760,
  h: 520,
};
const GRID_SIZE = 100;  // pixels per grid unit
const DETAIL_PANEL = {
  x: GAME.WIDTH - 240,
  y: 320,
  w: 220,
  h: 300,
};

/** Safely call setColor on a Text object. */
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
  gridX: number;
  gridY: number;
  screenX: number;
  screenY: number;
  shape: Phaser.GameObjects.Shape;      // main shape (circle/diamond/hex)
  glow: Phaser.GameObjects.Shape;       // outer glow ring
  icon: Phaser.GameObjects.Text;
  costLabel: Phaser.GameObjects.Text;
  allTexts: Phaser.GameObjects.Text[];
  allShapes: Phaser.GameObjects.Shape[];
}

export class SkillTreeUI extends NavigableOverlay {
  private treeTabs: { bg: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Text; label: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Rectangle }[] = [];
  private selectedTree: SkillTree = 'combat';
  private trees: SkillTree[] = ['combat', 'weapon', 'movement', 'energy', 'protocol', 'survival'];
  private treeNodes: TreeNode[] = [];
  private connectionGraphics?: Phaser.GameObjects.Graphics;
  private bgGraphics?: Phaser.GameObjects.Graphics;
  private headerText?: Phaser.GameObjects.Text;
  private spValueText?: Phaser.GameObjects.Text;

  // Detail panel elements
  private detail: {
    name: Phaser.GameObjects.Text;
    tier: Phaser.GameObjects.Text;
    desc: Phaser.GameObjects.Text;
    effect: Phaser.GameObjects.Text;
    cost: Phaser.GameObjects.Text;
    status: Phaser.GameObjects.Text;
    divider: Phaser.GameObjects.Rectangle;
  } | null = null;

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';
    const L = (en: string, fa: string) => isFa ? fa : en;

    // === Background ===
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x040810, 0.96);
    this.container.add(overlay);
    // Grid background
    this.bgGraphics = scene.add.graphics();
    this.bgGraphics.fillStyle(0x040810, 1);
    this.container.add(this.bgGraphics);
    // Starfield (static dots)
    for (let i = 0; i < 80; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h;
      const star = scene.add.circle(sx, sy, Math.random() * 1.5 + 0.3, 0x39d0d8, Math.random() * 0.3 + 0.05);
      this.container.add(star);
    }

    // === Title bar ===
    this.container.add(scene.add.text(w / 2, 28, isFa ? 'ماتریس مهارت' : 'SKILL MATRIX', {
      fontFamily: 'monospace', fontSize: '24px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));
    this.container.add(scene.add.text(w / 2, 54, isFa ? 'قابلیت‌ها را باز کنید' : 'UNLOCK ABILITIES', {
      fontFamily: 'monospace', fontSize: '9px', color: '#3a4350', letterSpacing: 4,
    }).setOrigin(0.5));

    // === Tree header (above tree area) ===
    this.headerText = scene.add.text(TREE_AREA.x + TREE_AREA.w / 2, 80, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.container.add(this.headerText);

    // === SP badge (top-right) ===
    const spX = w - 90, spY = 40;
    const spBg = scene.add.rectangle(spX, spY, 140, 44, 0x0a1018, 0.95);
    spBg.setStrokeStyle(1, 0xffe060, 0.5);
    const spIcon = scene.add.text(spX - 50, spY, '◆', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffe060',
    }).setOrigin(0.5);
    const spLabel = scene.add.text(spX - 28, spY - 10, 'SP', {
      fontFamily: 'monospace', fontSize: '9px', color: '#5a6470',
    }).setOrigin(0, 0.5);
    this.spValueText = scene.add.text(spX - 28, spY + 8, '0', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffe060', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.container.add([spBg, spIcon, spLabel, this.spValueText]);

    // === Left panel: tree tabs ===
    this.buildTreeTabs(scene);

    // === Detail panel (right) ===
    this.buildDetailPanel(scene);

    // === Back button ===
    const backBg = scene.add.rectangle(w / 2, h - 30, 200, 38, 0x1a2030, 0.95);
    backBg.setStrokeStyle(1, 0x39d0d8, 0.6);
    const backText = scene.add.text(w / 2, h - 30, t('menu.back'), {
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0',
    }).setOrigin(0.5);
    this.container.add([backBg, backText]);
    this.registerNav(backBg, backText, () => { AudioSystem.play('uiClick'); onBack(); });

    // === Build tree ===
    this.refreshTree();
    this.container.setScrollFactor(0, 0, true);
  }

  // ─── Build vertical tree tabs ──────────────────────────────────────────
  private buildTreeTabs(scene: Phaser.Scene): void {
    const tabW = LEFT_PANEL_W - 20, tabH = 64, gap = 4;
    const startY = 110;
    this.trees.forEach((tree, i) => {
      const y = startY + i * (tabH + gap);
      const x = 10 + tabW / 2;
      const color = TREE_COLORS[tree];
      const bg = scene.add.rectangle(x, y, tabW, tabH, 0x0a1018, 0.92);
      bg.setStrokeStyle(1, color, 0.3);
      // Left accent bar
      const bar = scene.add.rectangle(x - tabW / 2 + 3, y, 4, tabH - 8, color, 0.5);
      const isFa = getLocale() === 'fa';
      const icon = scene.add.text(x - tabW / 2 + 28, y, TREE_ICONS[tree], {
        fontFamily: 'monospace', fontSize: '22px', color: '#5a6470',
      }).setOrigin(0.5);
      const label = scene.add.text(x + 15, y - 8, isFa ? TREE_NAMES[tree].fa : TREE_NAMES[tree].en, {
        fontFamily: 'monospace', fontSize: '12px', color: '#5a6470',
      }).setOrigin(0.5);
      const descLabel = scene.add.text(x + 15, y + 10, isFa ? TREE_DESC[tree].fa : TREE_DESC[tree].en, {
        fontFamily: 'monospace', fontSize: '7px', color: '#3a4350',
      }).setOrigin(0.5);
      this.container.add([bg, bar, icon, label, descLabel]);
      this.treeTabs.push({ bg, icon, label, bar });
      this.registerNav(bg, label, () => { this.selectedTree = tree; this.refreshTree(); AudioSystem.play('uiClick'); });
    });
  }

  // ─── Build detail panel ────────────────────────────────────────────────
  private buildDetailPanel(scene: Phaser.Scene): void {
    const { x, y, w, h } = DETAIL_PANEL;
    const bg = scene.add.rectangle(x, y, w, h, 0x0a1018, 0.95);
    bg.setStrokeStyle(1, 0x1a3040, 0.5);
    // Title bar
    const titleBar = scene.add.rectangle(x, y - h / 2 + 14, w - 4, 26, 0x0d1820, 0.9);
    titleBar.setStrokeStyle(1, 0x1a3040, 0.4);
    const titleText = scene.add.text(x, y - h / 2 + 14, 'SKILL DETAILS', {
      fontFamily: 'monospace', fontSize: '10px', color: '#39d0d8', letterSpacing: 2,
    }).setOrigin(0.5);
    // Tier badge
    const tier = scene.add.text(x, y - h / 2 + 50, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#7a8090', letterSpacing: 2,
    }).setOrigin(0.5);
    // Name
    const name = scene.add.text(x, y - h / 2 + 80, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#cfd6e0', stroke: '#000', strokeThickness: 3,
      wordWrap: { width: w - 20 }, align: 'center',
    }).setOrigin(0.5);
    // Divider
    const divider = scene.add.rectangle(x, y - 20, w - 30, 1, 0x1a3040, 0.6);
    // Description
    const desc = scene.add.text(x, y + 10, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#7a8090',
      wordWrap: { width: w - 20 }, align: 'center', lineSpacing: 3,
    }).setOrigin(0.5);
    // Effect
    const effect = scene.add.text(x, y + 60, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#40d070',
      wordWrap: { width: w - 20 }, align: 'center',
    }).setOrigin(0.5);
    // Cost
    const cost = scene.add.text(x, y + 100, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffe060', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    // Status
    const status = scene.add.text(x, y + 130, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#5a6470', letterSpacing: 1,
    }).setOrigin(0.5);
    this.container.add([bg, titleBar, titleText, tier, name, divider, desc, effect, cost, status]);
    this.detail = { name, tier, desc, effect, cost, status, divider };
  }

  // ─── Convert grid position to screen position ──────────────────────────
  private gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    const cx = TREE_AREA.x + TREE_AREA.w / 2;
    const cy = TREE_AREA.y + TREE_AREA.h - 60;  // bottom anchor
    return {
      x: cx + gridX * GRID_SIZE,
      y: cy - gridY * GRID_SIZE,  // y goes up
    };
  }

  // ─── Main refresh ──────────────────────────────────────────────────────
  private refreshTree(): void {
    // Cleanup old nodes
    const oldShapeSet = new Set(this.treeNodes.map(n => n.shape));
    this.navElements = this.navElements.filter(el => !oldShapeSet.has(el.bg as unknown as Phaser.GameObjects.Shape));
    this.treeNodes.forEach(n => {
      n.allShapes.forEach(s => { if (s && s.active) s.destroy(); });
      n.allTexts.forEach(t => { if (t && t.active) t.destroy(); });
    });
    this.treeNodes = [];
    if (this.connectionGraphics) { this.connectionGraphics.destroy(); this.connectionGraphics = undefined; }
    // Kill any active tweens on old shapes (they're destroyed, but be safe)
    this.scene.tweens.killAll();

    // Update SP
    if (this.spValueText) {
      const sp = ExperienceSystem.getSkillPoints();
      this.spValueText.setText(String(sp));
      safeSetColor(this.spValueText, sp > 0 ? '#ffe060' : '#5a6470');
    }

    // Update tree tabs
    this.trees.forEach((tree, i) => {
      if (!this.treeTabs[i]) return;
      const tab = this.treeTabs[i];
      const isSelected = tree === this.selectedTree;
      const color = TREE_COLORS[tree];
      tab.bg.setFillStyle(isSelected ? 0x0d1820 : 0x0a1018, 0.95);
      tab.bg.setStrokeStyle(isSelected ? 2 : 1, color, isSelected ? 0.9 : 0.3);
      tab.bar.setFillStyle(color, isSelected ? 1 : 0.3);
      safeSetColor(tab.icon, isSelected ? '#66f0ff' : '#5a6470');
      safeSetColor(tab.label, isSelected ? '#66f0ff' : '#5a6470');
    });

    // Update header
    const isFa = getLocale() === 'fa';
    const treeName = isFa ? TREE_NAMES[this.selectedTree].fa : TREE_NAMES[this.selectedTree].en;
    const treeDesc = isFa ? TREE_DESC[this.selectedTree].fa : TREE_DESC[this.selectedTree].en;
    const unlockedCount = SkillTreeSystem.getTree(this.selectedTree).filter(n => n.unlocked).length;
    const totalCount = SkillTreeSystem.getTree(this.selectedTree).length;
    if (this.headerText) {
      this.headerText.setText(`${TREE_ICONS[this.selectedTree]}  ${treeName}  —  ${unlockedCount}/${totalCount}  |  ${treeDesc}`);
      safeSetColor(this.headerText, '#cfd6e0');
    }

    // Background glow for tree area
    if (this.bgGraphics) {
      this.bgGraphics.clear();
      this.bgGraphics.fillStyle(TREE_BG_COLORS[this.selectedTree], 0.3);
      this.bgGraphics.fillRoundedRect(TREE_AREA.x - 10, TREE_AREA.y - 10, TREE_AREA.w + 20, TREE_AREA.h + 20, 12);
      // Inner glow
      const glowColor = TREE_COLORS[this.selectedTree];
      this.bgGraphics.fillStyle(glowColor, 0.05);
      this.bgGraphics.fillCircle(TREE_AREA.x + TREE_AREA.w / 2, TREE_AREA.y + TREE_AREA.h / 2, 250);
    }

    // Get nodes
    const nodes = SkillTreeSystem.getTree(this.selectedTree);
    if (nodes.length === 0) return;

    // Draw connections first (behind nodes)
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
      const childRadius = this.getNodeRadius(skill);
      const parentRadius = this.getNodeRadius(parentSkill);
      // Curved bezier line
      gfx.lineStyle(parentUnlocked ? 3 : 2, parentUnlocked ? treeColor : 0x2a3340, parentUnlocked ? 0.85 : 0.35);
      gfx.beginPath();
      gfx.moveTo(parentPos.x, parentPos.y - parentRadius);
      const midY = (parentPos.y + childPos.y) / 2;
      gfx.lineTo(parentPos.x, midY);
      gfx.lineTo(childPos.x, midY);
      gfx.lineTo(childPos.x, childPos.y + childRadius);
      gfx.strokePath();
    });
    this.connectionGraphics = gfx;
    this.container.add(gfx);

    // Build nodes
    nodes.forEach((node) => {
      const skill = getSkill(node.skill.id);
      if (!skill) return;
      const pos = this.gridToScreen(skill.pos?.x ?? 0, skill.pos?.y ?? 0);
      const tier = skill.tier ?? 0;
      const radius = this.getNodeRadius(skill);
      const allShapes: Phaser.GameObjects.Shape[] = [];
      const allTexts: Phaser.GameObjects.Text[] = [];

      // Glow ring (for canUnlock)
      const glow = this.scene.add.circle(pos.x, pos.y, radius + 8, treeColor, 0);
      glow.setStrokeStyle(2, treeColor, node.canUnlock ? 0.4 : 0);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(1);
      if (node.canUnlock) {
        this.scene.tweens.add({
          targets: glow, alpha: { from: 0.3, to: 0.7 }, scale: { from: 1, to: 1.15 },
          duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
      }
      allShapes.push(glow);

      // Main shape based on tier
      let shape: Phaser.GameObjects.Shape;
      if (tier === 2) {
        // Keystone: hexagon
        shape = this.createHexagon(this.scene, pos.x, pos.y, radius, this.getNodeFill(node), this.getNodeStrokeAlpha(node));
        shape.setStrokeStyle(4, this.getNodeStroke(node), this.getNodeStrokeAlpha(node));
      } else if (tier === 1) {
        // Notable: diamond (rotated square)
        shape = this.scene.add.rectangle(pos.x, pos.y, radius * 1.8, radius * 1.8, this.getNodeFill(node), 0.95);
        shape.setAngle(45);
        shape.setStrokeStyle(3, this.getNodeStroke(node), this.getNodeStrokeAlpha(node));
      } else {
        // Minor: circle
        shape = this.scene.add.circle(pos.x, pos.y, radius, this.getNodeFill(node), 0.95);
        shape.setStrokeStyle(2, this.getNodeStroke(node), this.getNodeStrokeAlpha(node));
      }
      shape.setDepth(2);
      allShapes.push(shape);

      // Icon
      const iconChar = this.getSkillIcon(skill, node);
      const icon = this.scene.add.text(pos.x, pos.y, iconChar, {
        fontFamily: 'monospace', fontSize: `${tier === 2 ? 22 : tier === 1 ? 18 : 16}px`,
        color: this.getNodeIconColor(node),
      }).setOrigin(0.5).setDepth(3);
      allTexts.push(icon);

      // Cost label
      const costLabel = this.scene.add.text(pos.x, pos.y + radius + 16, `${skill.cost} SP`, {
        fontFamily: 'monospace', fontSize: '10px',
        color: node.unlocked ? '#40d070' : node.canUnlock ? '#ffe060' : '#3a4350',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(3);
      allTexts.push(costLabel);

      this.container.add([...allShapes, ...allTexts]);

      const treeNode: TreeNode = {
        skillId: skill.id, skillData: skill, node,
        gridX: skill.pos?.x ?? 0, gridY: skill.pos?.y ?? 0,
        screenX: pos.x, screenY: pos.y,
        shape, glow, icon, costLabel, allTexts, allShapes,
      };
      this.treeNodes.push(treeNode);

      // Register for nav
      const unlockAction = () => {
        if (node.canUnlock && SkillTreeSystem.unlock(skill.id)) {
          AudioSystem.play('skillUnlock');
          this.spawnUnlockEffect(pos.x, pos.y, treeColor, tier);
          this.refreshTree();
        }
      };
      shape.setInteractive({ useHandCursor: true });
      shape.on('pointerover', () => {
        this.navFocusIdx = this.navElements.findIndex(e => e.bg === shape);
        if (this.navFocusIdx < 0) this.navFocusIdx = 0;
        this.updateNavFocus();
        this.updateDetailPanel(node, skill);
        AudioSystem.play('uiHover');
      });
      shape.on('pointerout', () => this.updateNavFocus());
      shape.on('pointerdown', () => { unlockAction(); });

      // Insert before back button
      const backIdx = this.navElements.length - 1;
      this.navElements.splice(backIdx, 0, {
        bg: shape,
        text: icon,
        onSelect: unlockAction,
        focusColor: treeColor,
        normalColor: this.getNodeStroke(node),
      });
    });

    this.navFocusIdx = Math.min(this.navFocusIdx, this.navElements.length - 1);
    // Update detail panel with focused node
    if (this.treeNodes.length > 0) {
      const idx = Math.min(this.navFocusIdx, this.treeNodes.length - 1);
      if (idx >= 0 && this.treeNodes[idx]) {
        this.updateDetailPanel(this.treeNodes[idx].node, this.treeNodes[idx].skillData);
      }
    }
    this.scene.time.delayedCall(0, () => { if (this.isVisible) this.updateNavFocus(); });
  }

  // ─── Create hexagon shape (for keystone nodes) ─────────────────────────
  private createHexagon(scene: Phaser.Scene, x: number, y: number, radius: number, fillColor: number, alpha: number): Phaser.GameObjects.Polygon {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    return scene.add.polygon(x, y, points, fillColor, 0.95);
  }

  // ─── Node size based on tier ───────────────────────────────────────────
  private getNodeRadius(skill: SkillData): number {
    const tier = skill.tier ?? 0;
    if (tier === 2) return 38;   // keystone
    if (tier === 1) return 28;   // notable
    return 22;                    // minor
  }

  // ─── Node colors ────────────────────────────────────────────────────────
  private getNodeFill(node: SkillNode): number {
    const tier = getSkill(node.skill.id)?.tier ?? 0;
    if (node.unlocked) return TREE_COLORS[this.selectedTree];
    if (node.canUnlock) return 0x0d1820;
    if (!node.prereqMet) return 0x05080c;
    return 0x0a1018;
  }
  private getNodeStroke(node: SkillNode): number {
    if (node.unlocked) return 0xffffff;
    if (node.canUnlock) return TREE_COLORS[this.selectedTree];
    return 0x2a3340;
  }
  private getNodeStrokeAlpha(node: SkillNode): number {
    if (node.unlocked) return 1;
    if (node.canUnlock) return 0.9;
    if (!node.prereqMet) return 0.25;
    return 0.5;
  }
  private getNodeIconColor(node: SkillNode): string {
    if (node.unlocked) return '#ffffff';
    if (node.canUnlock) return '#cfd6e0';
    if (!node.prereqMet) return '#2a3340';
    return '#4a5260';
  }
  private getSkillIcon(skill: SkillData, node: SkillNode): string {
    if (skill.category === 'unlock' && skill.effect.unlock) {
      const u = skill.effect.unlock;
      if (u === 'shotgun') return '🔫';
      if (u === 'railgun') return '🎯';
      if (u === 'rocket') return '🚀';
      if (u === 'doubleJump') return '⇈';
      if (u === 'wallJump') return '⇅';
      if (u === 'grapple') return '⋙';
      if (u === 'hover') return '≡';
      if (u === 'emp') return '⚡';
      if (u === 'hack') return '⌬';
    }
    if (skill.category === 'damage') return '⚔';
    if (skill.category === 'speed') return '➤';
    if (skill.category === 'defense') return '🛡';
    if (skill.category === 'ability') return '◈';
    if (skill.category === 'utility') return '◆';
    return '◆';
  }

  // ─── Detail panel update ───────────────────────────────────────────────
  private updateDetailPanel(node: SkillNode, skill: SkillData): void {
    if (!this.detail) return;
    const isFa = getLocale() === 'fa';
    const tier = skill.tier ?? 0;
    const tierLabel = isFa ? TIER_LABELS[tier]?.fa : TIER_LABELS[tier]?.en;

    safeSetColor(this.detail.name, node.unlocked ? '#40d070' : node.canUnlock ? '#cfd6e0' : '#5a6470');
    this.detail.name.setText(node.name);
    this.detail.tier.setText(`[ ${tierLabel} ]`);
    safeSetColor(this.detail.tier, tier === 2 ? '#ffe060' : tier === 1 ? '#66f0ff' : '#7a8090');
    this.detail.desc.setText(node.description);
    // Effect summary
    const eff = skill.effect;
    let effectText = '';
    if (eff.multiplier) {
      const pct = Math.round((eff.multiplier - 1) * 100);
      effectText = isFa ? `${pct > 0 ? '+' : ''}${pct}٪ ${this.statName(eff.stat, isFa)}` : `${pct > 0 ? '+' : ''}${pct}% ${this.statName(eff.stat, isFa)}`;
    } else if (eff.additive) {
      effectText = isFa ? `${eff.additive}+ ${this.statName(eff.stat, isFa)}` : `+${eff.additive} ${this.statName(eff.stat, isFa)}`;
    } else if (eff.unlock) {
      effectText = isFa ? `قابلیت: ${eff.unlock}` : `Ability: ${eff.unlock}`;
    }
    this.detail.effect.setText(effectText);
    this.detail.cost.setText(node.unlocked ? '✓ UNLOCKED' : `◆ ${skill.cost} SP`);
    safeSetColor(this.detail.cost, node.unlocked ? '#40d070' : '#ffe060');
    let statusText = '';
    if (node.unlocked) statusText = isFa ? '✓ فعال' : 'ACTIVE';
    else if (!node.prereqMet) statusText = isFa ? '🔒 قفل' : 'LOCKED';
    else if (!node.hasSkillPoints) statusText = isFa ? '◆ SP ناکافی' : 'NEED SP';
    else statusText = isFa ? '▶ آماده' : 'READY';
    this.detail.status.setText(statusText);
    safeSetColor(this.detail.status, node.unlocked ? '#40d070' : node.canUnlock ? '#ffe060' : '#5a6470');
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
      invulnMs: { en: 'Invuln Duration', fa: 'آسیب‌ناپذیری' },
    };
    const n = names[stat];
    return n ? (isFa ? n.fa : n.en) : stat;
  }

  // ─── Particle burst on unlock ──────────────────────────────────────────
  private spawnUnlockEffect(x: number, y: number, color: number, tier: number): void {
    const particleCount = tier === 2 ? 20 : tier === 1 ? 16 : 12;
    // Expanding ring
    const ring = this.scene.add.circle(x, y, 10, color, 0.8);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setDepth(10);
    this.container.add(ring);
    this.scene.tweens.add({
      targets: ring, scale: { from: 1, to: 5 }, alpha: { from: 0.8, to: 0 },
      duration: 700, ease: 'Cubic.out', onComplete: () => ring.destroy(),
    });
    // Second ring (delayed)
    const ring2 = this.scene.add.circle(x, y, 10, color, 0.5);
    ring2.setBlendMode(Phaser.BlendModes.ADD);
    ring2.setDepth(10);
    this.container.add(ring2);
    this.scene.tweens.add({
      targets: ring2, scale: { from: 1, to: 3 }, alpha: { from: 0.5, to: 0 },
      duration: 500, delay: 150, ease: 'Cubic.out', onComplete: () => ring2.destroy(),
    });
    // Sparks
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const spark = this.scene.add.circle(x, y, 3, color, 0.9);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      spark.setDepth(10);
      this.container.add(spark);
      const dist = 60 + Math.random() * 40;
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
        alpha: 0, scale: 0.2,
        duration: 600 + Math.random() * 300, ease: 'Cubic.out',
        onComplete: () => spark.destroy(),
      });
    }
  }

  // ─── Navigation ────────────────────────────────────────────────────────
  protected onNavLeft(): void {
    const idx = this.trees.indexOf(this.selectedTree);
    this.selectedTree = this.trees[(idx - 1 + this.trees.length) % this.trees.length];
    this.refreshTree();
    AudioSystem.play('uiClick');
    this.navFocusIdx = 0;
    this.scene.time.delayedCall(0, () => { if (this.isVisible) this.updateNavFocus(); });
  }
  protected onNavRight(): void {
    const idx = this.trees.indexOf(this.selectedTree);
    this.selectedTree = this.trees[(idx + 1) % this.trees.length];
    this.refreshTree();
    AudioSystem.play('uiClick');
    this.navFocusIdx = 0;
    this.scene.time.delayedCall(0, () => { if (this.isVisible) this.updateNavFocus(); });
  }
}

export default SkillTreeUI;
