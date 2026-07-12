/**
 * MECHA: LAST PROTOCOL — Skill Tree UI v6.0
 *
 * INSPIRATION (corrected):
 *   - Blasphemous: dark intricate UI, religious-technological aesthetic
 *   - Child of Light: constellation/star-based skill layout
 *   - Armored Core 6: Mecha assembly, hex grid, tactical stats display
 *   - Elden Ring: deep builds, interconnected progression
 *   - Rayman: fluid navigation feel
 *
 * AESTHETIC: Circuit board / data network
 *   The skill tree is a MECHA's neural cortex — a living circuit map
 *   where the pilot forges new combat protocols. Not a fantasy tree.
 *
 * VISUAL LANGUAGE:
 *   - Nodes are "data ports" (hexagonal) connected by circuit traces
 *   - Three tiers: TERMINAL (minor), SUBROUTINE (notable), CORE (keystone)
 *   - Color: amber/cyan for unlocked Mecha protocols,
 *            red/purple for AI-corrupted paths
 *   - Circuit traces are right-angled (PCB style), not bezier curves
 *
 * LAYOUT:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  NEURAL CORTEX                              ◆ PROTOCOL SP│
 *   │  ┌──────────┐                              ┌────────────┐│
 *   │  │COMBAT  ⚔ │      ⬡ ── ◇ ── ◯             │ TARGET NODE││
 *   │  │WEAPON 🔫 │      │         │             │            ││
 *   │  │MOVE   ➤  │      ◇       ◯               │ [TIER]     ││
 *   │  │ENERGY ⚡ │      │                       │ NAME       ││
 *   │  │PROTO  ◈  │      ⬡                       │ ─────────  ││
 *   │  │SURVIV ♥  │                              │ DESC       ││
 *   │  └──────────┘                              │ EFFECT     ││
 *   │                                            │ COST       ││
 *   │             [DISENGAGE]                    │ STATUS     ││
 *   │                                            └────────────┘│
 *   └──────────────────────────────────────────────────────────┘
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

// ─── Tree metadata (Mecha protocol branches) ─────────────────────────────
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
const TREE_SUBTITLES: Record<SkillTree, { en: string; fa: string }> = {
  combat: { en: 'OFFENSIVE SYSTEMS', fa: 'سیستم‌های تهاجمی' },
  weapon: { en: 'ARSENAL MODULES', fa: 'ماژول‌های تسلیحات' },
  movement: { en: 'LOCOMOTION CORE', fa: 'هسته حرکت' },
  energy: { en: 'POWER GRID', fa: 'شبکه قدرت' },
  protocol: { en: 'AI COUNTERMEASURES', fa: 'ضداقدام هوش مصنوعی' },
  survival: { en: 'DEFENSE MATRIX', fa: 'ماتریس دفاع' },
};
// Amber/cyan for Mecha, with per-branch accent
const TREE_COLORS: Record<SkillTree, number> = {
  combat: 0xff6030,    // amber-red
  weapon: 0xffc040,    // amber
  movement: 0x40c0ff,  // cyan
  energy: 0x40ffe0,    // teal
  protocol: 0xc060ff,  // violet (AI-counter)
  survival: 0x60ff80,  // green
};
const TREE_PANES: Record<SkillTree, number> = {
  combat: 0x1a0810, weapon: 0x1a1408, movement: 0x081420,
  energy: 0x08201a, protocol: 0x14081a, survival: 0x081a0e,
};

const TIER_LABELS: Record<number, { en: string; fa: string }> = {
  0: { en: 'TERMINAL', fa: 'ترمینال' },
  1: { en: 'SUBROUTINE', fa: 'زیرروتین' },
  2: { en: 'CORE', fa: 'هسته' },
};

// ─── Layout ───────────────────────────────────────────────────────────────
const LEFT_PANEL_W = 200;
const TREE_AREA = { x: LEFT_PANEL_W + 20, y: 120, w: 620, h: 480 };
const GRID_SIZE = 110;
const DETAIL_PANEL = { x: GAME.WIDTH - 175, y: 340, w: 270, h: 340 };

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
  screenX: number;
  screenY: number;
  shape: Phaser.GameObjects.Shape;
  innerShape: Phaser.GameObjects.Shape | null;  // inner ring for CORE/SUBROUTINE
  glow: Phaser.GameObjects.Shape;
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

  // Detail panel
  private detail: {
    name: Phaser.GameObjects.Text;
    tier: Phaser.GameObjects.Text;
    desc: Phaser.GameObjects.Text;
    effect: Phaser.GameObjects.Text;
    cost: Phaser.GameObjects.Text;
    status: Phaser.GameObjects.Text;
    divider: Phaser.GameObjects.Rectangle;
    corner1: Phaser.GameObjects.Polygon;
    corner2: Phaser.GameObjects.Polygon;
  } | null = null;

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';

    // === Background: dark void with scanlines ===
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x05080c, 0.97);
    this.container.add(overlay);
    // Scanlines (subtle horizontal lines, Blasphemous-style)
    const scanGfx = scene.add.graphics();
    scanGfx.fillStyle(0xffffff, 0.02);
    for (let y = 0; y < h; y += 3) { scanGfx.fillRect(0, y, w, 1); }
    this.container.add(scanGfx);
    // Starfield (Child of Light — constellation feel)
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h;
      const star = scene.add.circle(sx, sy, Math.random() * 1.2 + 0.3, 0x40c0ff, Math.random() * 0.25 + 0.05);
      this.container.add(star);
      // Twinkle
      if (Math.random() < 0.3) {
        scene.tweens.add({
          targets: star, alpha: { from: 0.1, to: 0.4 },
          duration: 1500 + Math.random() * 2000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
      }
    }

    // === Title ===
    this.container.add(scene.add.text(w / 2, 26, isFa ? 'قشر عصبی مکا' : 'NEURAL CORTEX', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffc040', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));
    this.container.add(scene.add.text(w / 2, 50, isFa ? 'پروتکل‌ها را بکوب' : 'FORGE NEW PROTOCOLS', {
      fontFamily: 'monospace', fontSize: '9px', color: '#3a4350', letterSpacing: 4,
    }).setOrigin(0.5));

    // === Tree header ===
    this.headerText = scene.add.text(TREE_AREA.x + TREE_AREA.w / 2, 80, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.container.add(this.headerText);

    // === SP badge (top-right) — like Armored Core's resource display ===
    const spX = w - 85, spY = 38;
    const spBg = scene.add.rectangle(spX, spY, 140, 42, 0x0a0d14, 0.95);
    spBg.setStrokeStyle(1, 0xffc040, 0.5);
    // Corner accents
    this.container.add(scene.add.polygon(spX - 65, spY - 18, [0, 0, 8, 0, 0, 8], 0xffc040, 0.6));
    this.container.add(scene.add.polygon(spX + 65, spY + 18, [0, 0, -8, 0, 0, -8], 0xffc040, 0.6));
    const spIcon = scene.add.text(spX - 48, spY, '◆', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffc040',
    }).setOrigin(0.5);
    const spLabel = scene.add.text(spX - 30, spY - 9, 'PROTOCOL SP', {
      fontFamily: 'monospace', fontSize: '7px', color: '#5a6470', letterSpacing: 1,
    }).setOrigin(0, 0.5);
    this.spValueText = scene.add.text(spX - 30, spY + 7, '0', {
      fontFamily: 'monospace', fontSize: '15px', color: '#ffc040', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.container.add([spBg, spIcon, spLabel, this.spValueText]);

    // === Left panel: protocol branches ===
    this.buildTreeTabs(scene);

    // === Detail panel ===
    this.buildDetailPanel(scene);

    // === Back button ===
    const backBg = scene.add.rectangle(w / 2, h - 28, 200, 36, 0x0a0d14, 0.95);
    backBg.setStrokeStyle(1, 0x39d0d8, 0.5);
    // Corner accents on back button
    this.container.add(scene.add.polygon(w / 2 - 90, h - 28 - 14, [0, 0, 6, 0, 0, 6], 0x39d0d8, 0.5));
    this.container.add(scene.add.polygon(w / 2 + 90, h - 28 + 14, [0, 0, -6, 0, 0, -6], 0x39d0d8, 0.5));
    const backText = scene.add.text(w / 2, h - 28, isFa ? '▲ خروج' : '▲ DISENGAGE', {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0', letterSpacing: 2,
    }).setOrigin(0.5);
    this.container.add([backBg, backText]);
    this.registerNav(backBg, backText, () => { AudioSystem.play('uiClick'); onBack(); });

    this.refreshTree();
    this.container.setScrollFactor(0, 0, true);
  }

  // ─── Tree tabs (vertical, with subtitle + progress) ────────────────────
  private buildTreeTabs(scene: Phaser.Scene): void {
    const tabW = LEFT_PANEL_W - 20, tabH = 70, gap = 4;
    const startY = 110;
    this.trees.forEach((tree) => {
      const y = startY + this.trees.indexOf(tree) * (tabH + gap);
      const x = 10 + tabW / 2;
      const color = TREE_COLORS[tree];
      const isFa = getLocale() === 'fa';
      const bg = scene.add.rectangle(x, y, tabW, tabH, 0x0a0d14, 0.92);
      bg.setStrokeStyle(1, color, 0.25);
      // Left accent bar (like circuit edge)
      const bar = scene.add.rectangle(x - tabW / 2 + 3, y, 3, tabH - 10, color, 0.4);
      // Icon in a "port" circle
      const portBg = scene.add.circle(x - tabW / 2 + 22, y, 14, 0x05080c, 0.9);
      portBg.setStrokeStyle(1, color, 0.4);
      const icon = scene.add.text(x - tabW / 2 + 22, y, TREE_ICONS[tree], {
        fontFamily: 'monospace', fontSize: '16px', color: '#5a6470',
      }).setOrigin(0.5);
      const label = scene.add.text(x + 15, y - 12, isFa ? TREE_NAMES[tree].fa : TREE_NAMES[tree].en, {
        fontFamily: 'monospace', fontSize: '11px', color: '#5a6470', letterSpacing: 1,
      }).setOrigin(0.5);
      const sub = scene.add.text(x + 15, y + 4, isFa ? TREE_SUBTITLES[tree].fa : TREE_SUBTITLES[tree].en, {
        fontFamily: 'monospace', fontSize: '7px', color: '#3a4350',
      }).setOrigin(0.5);
      const count = SkillTreeSystem.getTree(tree).filter(n => n.unlocked).length;
      const total = SkillTreeSystem.getTree(tree).length;
      const countText = scene.add.text(x + 15, y + 16, `${count}/${total}`, {
        fontFamily: 'monospace', fontSize: '8px', color: '#5a6470',
      }).setOrigin(0.5);
      this.container.add([bg, bar, portBg, icon, label, sub, countText]);
      this.treeTabs.push({ bg, icon, label, sub, bar });
      this.registerNav(bg, label, () => { this.selectedTree = tree; this.refreshTree(); AudioSystem.play('uiClick'); });
    });
  }

  // ─── Detail panel (Armored Core style with corner accents) ─────────────
  private buildDetailPanel(scene: Phaser.Scene): void {
    const { x, y, w, h } = DETAIL_PANEL;
    const isFa = getLocale() === 'fa';
    const bg = scene.add.rectangle(x, y, w, h, 0x0a0d14, 0.95);
    bg.setStrokeStyle(1, 0x1a3040, 0.5);
    // Corner accents (4 corners)
    const cs = 8;
    const corners = [
      scene.add.polygon(x - w / 2 + 2, y - h / 2 + 2, [0, 0, cs, 0, 0, cs], 0xffc040, 0.6),
      scene.add.polygon(x + w / 2 - 2, y - h / 2 + 2, [0, 0, -cs, 0, 0, cs], 0xffc040, 0.6),
      scene.add.polygon(x - w / 2 + 2, y + h / 2 - 2, [0, 0, cs, 0, 0, -cs], 0xffc040, 0.6),
      scene.add.polygon(x + w / 2 - 2, y + h / 2 - 2, [0, 0, -cs, 0, 0, -cs], 0xffc040, 0.6),
    ];
    // Title bar
    const titleBar = scene.add.rectangle(x, y - h / 2 + 14, w - 8, 24, 0x0d1218, 0.9);
    const titleText = scene.add.text(x, y - h / 2 + 14, isFa ? 'گره هدف' : 'TARGET NODE', {
      fontFamily: 'monospace', fontSize: '9px', color: '#ffc040', letterSpacing: 2,
    }).setOrigin(0.5);
    // Tier label
    const tier = scene.add.text(x, y - h / 2 + 45, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#7a8090', letterSpacing: 2,
    }).setOrigin(0.5);
    // Name
    const name = scene.add.text(x, y - h / 2 + 75, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0', stroke: '#000', strokeThickness: 3,
      wordWrap: { width: w - 20 }, align: 'center',
    }).setOrigin(0.5);
    const divider = scene.add.rectangle(x, y - 25, w - 30, 1, 0x2a3040, 0.7);
    const desc = scene.add.text(x, y + 5, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#7a8090',
      wordWrap: { width: w - 20 }, align: 'center', lineSpacing: 3,
    }).setOrigin(0.5);
    const effect = scene.add.text(x, y + 55, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#40c0ff',
      wordWrap: { width: w - 20 }, align: 'center',
    }).setOrigin(0.5);
    const cost = scene.add.text(x, y + 95, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffc040', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    const status = scene.add.text(x, y + 125, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#5a6470', letterSpacing: 1,
    }).setOrigin(0.5);
    this.container.add([bg, ...corners, titleBar, titleText, tier, name, divider, desc, effect, cost, status]);
    this.detail = { name, tier, desc, effect, cost, status, divider, corner1: corners[0], corner2: corners[1] };
  }

  // ─── Grid to screen ────────────────────────────────────────────────────
  private gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    const cx = TREE_AREA.x + TREE_AREA.w / 2;
    const cy = TREE_AREA.y + TREE_AREA.h - 70;
    return { x: cx + gridX * GRID_SIZE, y: cy - gridY * GRID_SIZE };
  }

  // ─── Main refresh ──────────────────────────────────────────────────────
  private refreshTree(): void {
    // Cleanup
    const oldShapeSet = new Set(this.treeNodes.map(n => n.shape));
    this.navElements = this.navElements.filter(el => !oldShapeSet.has(el.bg as unknown as Phaser.GameObjects.Shape));
    this.treeNodes.forEach(n => {
      n.allShapes.forEach(s => { if (s && s.active) s.destroy(); });
      n.allTexts.forEach(t => { if (t && t.active) t.destroy(); });
    });
    this.treeNodes = [];
    if (this.connectionGraphics) { this.connectionGraphics.destroy(); this.connectionGraphics = undefined; }
    this.scene.tweens.killAll();

    // SP
    if (this.spValueText) {
      const sp = ExperienceSystem.getSkillPoints();
      this.spValueText.setText(String(sp));
      safeSetColor(this.spValueText, sp > 0 ? '#ffc040' : '#5a6470');
    }

    // Tabs
    this.trees.forEach((tree, i) => {
      if (!this.treeTabs[i]) return;
      const tab = this.treeTabs[i];
      const isSelected = tree === this.selectedTree;
      const color = TREE_COLORS[tree];
      tab.bg.setFillStyle(isSelected ? 0x0d1218 : 0x0a0d14, 0.95);
      tab.bg.setStrokeStyle(isSelected ? 2 : 1, color, isSelected ? 0.8 : 0.25);
      tab.bar.setFillStyle(color, isSelected ? 1 : 0.3);
      safeSetColor(tab.icon, isSelected ? '#ffe080' : '#5a6470');
      safeSetColor(tab.label, isSelected ? '#ffe080' : '#5a6470');
      safeSetColor(tab.sub, isSelected ? '#7a8090' : '#3a4350');
    });

    // Header
    const isFa = getLocale() === 'fa';
    const treeName = isFa ? TREE_NAMES[this.selectedTree].fa : TREE_NAMES[this.selectedTree].en;
    const treeSub = isFa ? TREE_SUBTITLES[this.selectedTree].fa : TREE_SUBTITLES[this.selectedTree].en;
    const unlockedCount = SkillTreeSystem.getTree(this.selectedTree).filter(n => n.unlocked).length;
    const totalCount = SkillTreeSystem.getTree(this.selectedTree).length;
    if (this.headerText) {
      this.headerText.setText(`${TREE_ICONS[this.selectedTree]}  ${treeName}  ·  ${treeSub}  ·  ${unlockedCount}/${totalCount} ACTIVE`);
      safeSetColor(this.headerText, '#cfd6e0');
    }

    // Background panel for tree area
    if (this.bgGraphics) {
      this.bgGraphics.clear();
      this.bgGraphics.fillStyle(TREE_PANES[this.selectedTree], 0.35);
      this.bgGraphics.fillRoundedRect(TREE_AREA.x - 8, TREE_AREA.y - 8, TREE_AREA.w + 16, TREE_AREA.h + 16, 8);
      // Inner glow
      const glowColor = TREE_COLORS[this.selectedTree];
      this.bgGraphics.fillStyle(glowColor, 0.04);
      this.bgGraphics.fillCircle(TREE_AREA.x + TREE_AREA.w / 2, TREE_AREA.y + TREE_AREA.h / 2, 220);
      // Corner brackets (Blasphemous-style framing)
      const bx = TREE_AREA.x - 8, by = TREE_AREA.y - 8, bw = TREE_AREA.w + 16, bh = TREE_AREA.h + 16;
      this.bgGraphics.lineStyle(2, glowColor, 0.4);
      this.bgGraphics.beginPath();
      // Top-left bracket
      this.bgGraphics.moveTo(bx, by + 20); this.bgGraphics.lineTo(bx, by); this.bgGraphics.lineTo(bx + 20, by);
      // Top-right bracket
      this.bgGraphics.moveTo(bx + bw - 20, by); this.bgGraphics.lineTo(bx + bw, by); this.bgGraphics.lineTo(bx + bw, by + 20);
      // Bottom-left bracket
      this.bgGraphics.moveTo(bx, by + bh - 20); this.bgGraphics.lineTo(bx, by + bh); this.bgGraphics.lineTo(bx + 20, by + bh);
      // Bottom-right bracket
      this.bgGraphics.moveTo(bx + bw - 20, by + bh); this.bgGraphics.lineTo(bx + bw, by + bh); this.bgGraphics.lineTo(bx + bw, by + bh - 20);
      this.bgGraphics.strokePath();
    }

    // Get nodes
    const nodes = SkillTreeSystem.getTree(this.selectedTree);
    if (nodes.length === 0) return;

    // Draw circuit traces (right-angled PCB lines, not bezier)
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
      const traceColor = parentUnlocked ? treeColor : 0x2a3340;
      const traceAlpha = parentUnlocked ? 0.85 : 0.3;
      const traceWidth = parentUnlocked ? 2.5 : 1.5;
      // Right-angled circuit trace (L-shape)
      gfx.lineStyle(traceWidth, traceColor, traceAlpha);
      gfx.beginPath();
      gfx.moveTo(parentPos.x, parentPos.y - parentRadius);
      const midY = (parentPos.y + childPos.y) / 2;
      gfx.lineTo(parentPos.x, midY);
      // Small "via" dot at the bend (circuit board style)
      gfx.strokePath();
      gfx.fillStyle(traceColor, traceAlpha);
      gfx.fillCircle(parentPos.x, midY, 2);
      // Horizontal segment
      gfx.lineStyle(traceWidth, traceColor, traceAlpha);
      gfx.beginPath();
      gfx.moveTo(parentPos.x, midY);
      gfx.lineTo(childPos.x, midY);
      gfx.strokePath();
      // Vertical to child
      gfx.beginPath();
      gfx.moveTo(childPos.x, midY);
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
      const glow = this.scene.add.circle(pos.x, pos.y, radius + 10, treeColor, 0);
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

      // Main shape — all hexagons (circuit node aesthetic), size varies by tier
      const shape = this.createHexagon(this.scene, pos.x, pos.y, radius, this.getNodeFill(node), 0.95);
      const strokeW = tier === 2 ? 4 : tier === 1 ? 3 : 2;
      shape.setStrokeStyle(strokeW, this.getNodeStroke(node), this.getNodeStrokeAlpha(node));
      shape.setDepth(2);
      allShapes.push(shape);

      // Inner shape for CORE/SUBROUTINE (nested hexagon — Armored Core assembly style)
      let innerShape: Phaser.GameObjects.Shape | null = null;
      if (tier >= 1) {
        const innerRadius = radius * 0.55;
        innerShape = this.createHexagon(this.scene, pos.x, pos.y, innerRadius, this.getNodeStroke(node), 0.4);
        innerShape.setDepth(3);
        allShapes.push(innerShape);
      }

      // Icon
      const iconChar = this.getSkillIcon(skill);
      const iconSize = tier === 2 ? 20 : tier === 1 ? 17 : 15;
      const icon = this.scene.add.text(pos.x, pos.y, iconChar, {
        fontFamily: 'monospace', fontSize: `${iconSize}px`,
        color: this.getNodeIconColor(node),
      }).setOrigin(0.5).setDepth(4);
      allTexts.push(icon);

      // Cost label
      const costLabel = this.scene.add.text(pos.x, pos.y + radius + 14, `${skill.cost} SP`, {
        fontFamily: 'monospace', fontSize: '10px',
        color: node.unlocked ? '#40ff80' : node.canUnlock ? '#ffc040' : '#3a4350',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(3);
      allTexts.push(costLabel);

      this.container.add([...allShapes, ...allTexts]);

      const treeNode: TreeNode = {
        skillId: skill.id, skillData: skill, node,
        screenX: pos.x, screenY: pos.y,
        shape, innerShape, glow, icon, costLabel, allTexts, allShapes,
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

      const backIdx = this.navElements.length - 1;
      this.navElements.splice(backIdx, 0, {
        bg: shape, text: icon, onSelect: unlockAction,
        focusColor: treeColor, normalColor: this.getNodeStroke(node),
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

  // ─── Create hexagon ────────────────────────────────────────────────────
  private createHexagon(scene: Phaser.Scene, x: number, y: number, radius: number, fillColor: number, alpha: number): Phaser.GameObjects.Polygon {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    const poly = scene.add.polygon(x, y, points, fillColor, alpha);
    return poly;
  }

  private getNodeRadius(skill: SkillData): number {
    const tier = skill.tier ?? 0;
    if (tier === 2) return 42;
    if (tier === 1) return 34;
    return 28;
  }
  private getNodeFill(node: SkillNode): number {
    if (node.unlocked) return TREE_COLORS[this.selectedTree];
    if (node.canUnlock) return 0x0d1218;
    if (!node.prereqMet) return 0x05080c;
    return 0x0a0d14;
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
  private getSkillIcon(skill: SkillData): string {
    if (skill.category === 'unlock' && skill.effect.unlock) {
      const u = skill.effect.unlock;
      if (u === 'shotgun') return '▣';
      if (u === 'railgun') return '═';
      if (u === 'rocket') return '◈';
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

  // ─── Detail panel ──────────────────────────────────────────────────────
  private updateDetailPanel(node: SkillNode, skill: SkillData): void {
    if (!this.detail) return;
    const isFa = getLocale() === 'fa';
    const tier = skill.tier ?? 0;
    const tierLabel = isFa ? TIER_LABELS[tier]?.fa : TIER_LABELS[tier]?.en;
    safeSetColor(this.detail.name, node.unlocked ? '#40ff80' : node.canUnlock ? '#cfd6e0' : '#5a6470');
    this.detail.name.setText(node.name);
    this.detail.tier.setText(`[ ${tierLabel} ]`);
    safeSetColor(this.detail.tier, tier === 2 ? '#ffc040' : tier === 1 ? '#40c0ff' : '#7a8090');
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
    safeSetColor(this.detail.cost, node.unlocked ? '#40ff80' : '#ffc040');
    let statusText = '';
    if (node.unlocked) statusText = isFa ? '✓ فعال' : 'ONLINE';
    else if (!node.prereqMet) statusText = isFa ? '🔒 قفل' : 'OFFLINE';
    else if (!node.hasSkillPoints) statusText = isFa ? '◆ SP ناکافی' : 'INSUFFICIENT SP';
    else statusText = isFa ? '▶ آماده' : 'READY';
    this.detail.status.setText(statusText);
    safeSetColor(this.detail.status, node.unlocked ? '#40ff80' : node.canUnlock ? '#ffc040' : '#5a6470');
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

  // ─── Unlock effect (data burst, not fantasy magic) ─────────────────────
  private spawnUnlockEffect(x: number, y: number, color: number, tier: number): void {
    const particleCount = tier === 2 ? 20 : tier === 1 ? 16 : 12;
    // Expanding data ring
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
    // Data sparks
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
