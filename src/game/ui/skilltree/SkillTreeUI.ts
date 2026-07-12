/**
 * MECHA: LAST PROTOCOL — Skill Tree UI v4.0
 *
 * REDESIGNED: Visual tree layout with connected nodes, particle effects on
 * unlock, detail panel, and polished graphics.
 *
 * Layout:
 *   - Left panel: 6 tree tabs (vertical) with icons
 *   - Center: tree visualization — nodes connected by lines
 *   - Right panel: skill details (name, description, cost, status)
 *   - Bottom: SP counter + Back button
 *
 * Navigation:
 *   - Left/Right (stick or D-pad): switch trees
 *   - Up/Down: cycle nodes in current tree
 *   - A button / Enter: unlock selected node
 *   - B / ESC: back (handled by OverlayManager)
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale } from '../../systems/LocalizationSystem';
import { SkillTreeSystem, type SkillNode } from '../../systems/SkillTreeSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import { getSkill } from '../../data/skills/skills';
import type { SkillTree } from '../../data/types';

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
const TREE_GLOWS: Record<SkillTree, number> = {
  combat: 0x803030, weapon: 0x806030, movement: 0x206080,
  energy: 0x208040, protocol: 0x602080, survival: 0x208040,
};

// ─── Layout constants ─────────────────────────────────────────────────────
const TREE_AREA_X = 280;        // left edge of tree area
const TREE_AREA_Y = 150;        // top edge
const TREE_AREA_W = 720;        // width
const TREE_AREA_H = 460;        // height
const NODE_RADIUS = 32;
const NODE_GAP_Y = 95;
const NODE_GAP_X = 180;

/** Safely call setColor on a Text object (guard against uninitialized canvas). */
function safeSetColor(text: Phaser.GameObjects.Text | undefined, color: string): void {
  if (!text || !text.active) return;
  const tObj = text as unknown as { canvas?: HTMLCanvasElement | null };
  if (tObj.canvas === null) return;
  try { text.setColor(color); } catch { /* canvas not ready */ }
}

interface TreeSkillNode {
  skillId: string;
  node: SkillNode;
  /** Grid position for layout: tier (0=bottom) and column */
  tier: number;
  column: number;
  /** Visual objects */
  circle: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Text;
  costLabel: Phaser.GameObjects.Text;
  connectionLines: Phaser.GameObjects.Line[];
  allTexts: Phaser.GameObjects.Text[];
}

export class SkillTreeUI extends NavigableOverlay {
  private treeTabs: { bg: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Text; label: Phaser.GameObjects.Text }[] = [];
  private selectedTree: SkillTree = 'combat';
  private trees: SkillTree[] = ['combat', 'weapon', 'movement', 'energy', 'protocol', 'survival'];
  private statsText?: Phaser.GameObjects.Text;
  private spBadge?: Phaser.GameObjects.Container;
  private treeNodes: TreeSkillNode[] = [];
  private connectionGraphics?: Phaser.GameObjects.Graphics;

  // Detail panel (right side)
  private detailPanel: { container: Phaser.GameObjects.Container; name: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text; cost: Phaser.GameObjects.Text; status: Phaser.GameObjects.Text } | null = null;

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';
    const L = (en: string, fa: string) => isFa ? fa : en;

    // === Background: dark with subtle radial glow ===
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x040810, 0.95);
    this.container.add(overlay);
    // Radial glow behind tree area
    const glow = scene.add.circle(TREE_AREA_X + TREE_AREA_W / 2, TREE_AREA_Y + TREE_AREA_H / 2, 350, 0x0a1828, 0.4);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(glow);
    // Decorative grid lines
    const gridGfx = scene.add.graphics();
    gridGfx.lineStyle(1, 0x0a1828, 0.3);
    for (let gx = 0; gx < w; gx += 40) { gridGfx.moveTo(gx, 0); gridGfx.lineTo(gx, h); }
    for (let gy = 0; gy < h; gy += 40) { gridGfx.moveTo(0, gy); gridGfx.lineTo(w, gy); }
    gridGfx.strokePath();
    this.container.add(gridGfx);

    // === Title ===
    this.container.add(scene.add.text(w / 2, 35, isFa ? 'درخت مهارت' : 'SKILL MATRIX', {
      fontFamily: 'monospace', fontSize: '26px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));
    // Subtitle line
    this.container.add(scene.add.text(w / 2, 62, isFa ? 'مهارت‌ها را باز کنید' : 'UNLOCK ABILITIES', {
      fontFamily: 'monospace', fontSize: '10px', color: '#3a4350', letterSpacing: 3,
    }).setOrigin(0.5));

    // === Left panel: tree tabs (vertical) ===
    this.buildTreeTabs(scene);

    // === Top-right: SP badge ===
    this.buildSpBadge(scene);

    // === Right panel: skill detail ===
    this.buildDetailPanel(scene);

    // === Back button (bottom center) ===
    const backBg = scene.add.rectangle(w / 2, h - 35, 220, 40, 0x1a2030, 0.95);
    backBg.setStrokeStyle(1, 0x39d0d8, 0.6);
    const backText = scene.add.text(w / 2, h - 35, t('menu.back'), {
      fontFamily: 'monospace', fontSize: '15px', color: '#cfd6e0',
    }).setOrigin(0.5);
    this.container.add([backBg, backText]);
    this.registerNav(backBg, backText, () => { AudioSystem.play('uiClick'); onBack(); });

    // === Build the tree visualization ===
    this.refreshTree();

    // Propagate scrollFactor(0) to all children
    this.container.setScrollFactor(0, 0, true);
  }

  // ─── Build vertical tree tabs on the left ──────────────────────────────
  private buildTreeTabs(scene: Phaser.Scene): void {
    const tabW = 200, tabH = 56, gap = 6;
    const startY = 110;
    this.trees.forEach((tree, i) => {
      const y = startY + i * (tabH + gap);
      const x = 20 + tabW / 2;
      const bg = scene.add.rectangle(x, y, tabW, tabH, 0x0a1018, 0.92);
      bg.setStrokeStyle(1, TREE_COLORS[tree], 0.4);
      const isFa = getLocale() === 'fa';
      const icon = scene.add.text(x - 70, y, TREE_ICONS[tree], {
        fontFamily: 'monospace', fontSize: '22px', color: '#5a6470',
      }).setOrigin(0.5);
      const label = scene.add.text(x + 20, y, isFa ? TREE_NAMES[tree].fa : TREE_NAMES[tree].en, {
        fontFamily: 'monospace', fontSize: '13px', color: '#5a6470',
      }).setOrigin(0.5);
      this.container.add([bg, icon, label]);
      this.treeTabs.push({ bg, icon, label });
      this.registerNav(bg, label, () => { this.selectedTree = tree; this.refreshTree(); AudioSystem.play('uiClick'); });
    });
  }

  // ─── Build SP badge (top-right) ────────────────────────────────────────
  private buildSpBadge(scene: Phaser.Scene): void {
    const x = GAME.WIDTH - 130, y = 60;
    const bg = scene.add.rectangle(x, y, 200, 50, 0x0a1018, 0.95);
    bg.setStrokeStyle(1, 0xffe060, 0.5);
    const icon = scene.add.text(x - 75, y, '◆', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffe060',
    }).setOrigin(0.5);
    const label = scene.add.text(x - 45, y - 8, 'SKILL POINTS', {
      fontFamily: 'monospace', fontSize: '8px', color: '#5a6470',
    }).setOrigin(0, 0.5);
    const value = scene.add.text(x - 45, y + 10, '0', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffe060', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.container.add([bg, icon, label, value]);
    this.spBadge = scene.add.container(0, 0, [bg, icon, label, value]);
    // Store reference for update
    this.statsText = value;
  }

  // ─── Build detail panel (right side) ───────────────────────────────────
  private buildDetailPanel(scene: Phaser.Scene): void {
    const x = GAME.WIDTH - 250, y = 250;
    const panelW = 220, panelH = 280;
    const bg = scene.add.rectangle(x, y, panelW, panelH, 0x0a1018, 0.92);
    bg.setStrokeStyle(1, 0x1a3040, 0.6);
    const titleBar = scene.add.rectangle(x, y - panelH / 2 + 12, panelW - 4, 24, 0x0d1820, 0.9);
    titleBar.setStrokeStyle(1, 0x1a3040, 0.4);
    const titleLabel = scene.add.text(x, y - panelH / 2 + 12, 'DETAILS', {
      fontFamily: 'monospace', fontSize: '10px', color: '#39d0d8', letterSpacing: 2,
    }).setOrigin(0.5);
    const name = scene.add.text(x, y - 80, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0', stroke: '#000', strokeThickness: 3,
      wordWrap: { width: panelW - 20 }, align: 'center',
    }).setOrigin(0.5);
    const desc = scene.add.text(x, y - 20, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#7a8090',
      wordWrap: { width: panelW - 20 }, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5);
    const cost = scene.add.text(x, y + 60, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffe060', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    const status = scene.add.text(x, y + 100, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#5a6470', letterSpacing: 1,
    }).setOrigin(0.5);
    this.container.add([bg, titleBar, titleLabel, name, desc, cost, status]);
    this.detailPanel = {
      container: scene.add.container(0, 0),
      name, desc, cost, status,
    };
  }

  // ─── Compute tier (depth) for each skill in the tree ──────────────────
  private computeTiers(skillIds: string[]): Map<string, number> {
    const tiers = new Map<string, number>();
    // Find roots (no requires, or requires not in this tree)
    const skills = skillIds.map(id => getSkill(id)!).filter(Boolean);
    // Iteratively assign tiers
    let changed = true;
    let maxTier = 0;
    while (changed) {
      changed = false;
      for (const s of skills) {
        if (tiers.has(s.id)) continue;
        if (!s.requires || !skillIds.includes(s.requires)) {
          tiers.set(s.id, 0);
          changed = true;
        } else if (tiers.has(s.requires)) {
          const t = (tiers.get(s.requires) ?? 0) + 1;
          tiers.set(s.id, t);
          if (t > maxTier) maxTier = t;
          changed = true;
        }
      }
    }
    return tiers;
  }

  // ─── Assign column positions to avoid overlap ─────────────────────────
  private computeColumns(skillIds: string[], tiers: Map<string, number>): Map<string, number> {
    const columns = new Map<string, number>();
    // Group by tier
    const byTier = new Map<number, string[]>();
    skillIds.forEach(id => {
      const t = tiers.get(id) ?? 0;
      if (!byTier.has(t)) byTier.set(t, []);
      byTier.get(t)!.push(id);
    });
    // Center each tier's skills
    const maxTier = Math.max(...tiers.values(), 0);
    byTier.forEach((ids, tier) => {
      const count = ids.length;
      const startCol = -(count - 1) / 2;
      ids.forEach((id, i) => columns.set(id, startCol + i));
    });
    return columns;
  }

  // ─── Main refresh: rebuild tree visualization ──────────────────────────
  private refreshTree(): void {
    // Destroy old nodes
    const skillBgSet = new Set(this.treeNodes.map(n => n.circle));
    const removed = this.navElements.filter(el => skillBgSet.has(el.bg as unknown as Phaser.GameObjects.Arc));
    this.navElements = this.navElements.filter(el => !skillBgSet.has(el.bg as unknown as Phaser.GameObjects.Arc));
    removed.forEach(el => { /* destroyed below */ });
    // Destroy all node visuals
    this.treeNodes.forEach(n => {
      n.circle.destroy(); n.ring.destroy(); n.icon.destroy();
      n.costLabel.destroy(); n.connectionLines.forEach(l => l.destroy());
      n.allTexts.forEach(t => { if (t && t.active) t.destroy(); });
    });
    this.treeNodes = [];
    if (this.connectionGraphics) { this.connectionGraphics.destroy(); this.connectionGraphics = undefined; }

    // Update SP badge
    if (this.statsText) {
      const sp = ExperienceSystem.getSkillPoints();
      this.statsText.setText(String(sp));
      safeSetColor(this.statsText, sp > 0 ? '#ffe060' : '#5a6470');
    }

    // Highlight selected tab
    this.trees.forEach((tree, i) => {
      if (!this.treeTabs[i]) return;
      const tab = this.treeTabs[i];
      const isSelected = tree === this.selectedTree;
      tab.bg.setFillStyle(isSelected ? 0x0d1820 : 0x0a1018, 0.95);
      tab.bg.setStrokeStyle(isSelected ? 2 : 1, TREE_COLORS[tree], isSelected ? 1 : 0.4);
      safeSetColor(tab.icon, isSelected ? '#66f0ff' : '#5a6470');
      safeSetColor(tab.label, isSelected ? '#66f0ff' : '#5a6470');
    });

    // Get nodes for selected tree
    const nodes = SkillTreeSystem.getTree(this.selectedTree);
    if (nodes.length === 0) return;

    // Compute layout
    const skillIds = nodes.map(n => n.skill.id);
    const tiers = this.computeTiers(skillIds);
    const columns = this.computeColumns(skillIds, tiers);
    const maxTier = Math.max(...tiers.values(), 0);

    // Draw connection lines first (behind nodes)
    const treeColor = TREE_COLORS[this.selectedTree];
    const gfx = this.scene.add.graphics();
    gfx.setDepth(1);
    nodes.forEach(node => {
      const skill = getSkill(node.skill.id);
      if (!skill || !skill.requires) return;
      const parent = nodes.find(n => n.skill.id === skill.requires);
      if (!parent) return;
      const parentTier = tiers.get(skill.requires) ?? 0;
      const parentCol = columns.get(skill.requires) ?? 0;
      const childTier = tiers.get(node.skill.id) ?? 0;
      const childCol = columns.get(node.skill.id) ?? 0;
      const cx = TREE_AREA_X + TREE_AREA_W / 2 + childCol * NODE_GAP_X;
      const cy = TREE_AREA_Y + TREE_AREA_H - 40 - childTier * NODE_GAP_Y;
      const px = TREE_AREA_X + TREE_AREA_W / 2 + parentCol * NODE_GAP_X;
      const py = TREE_AREA_Y + TREE_AREA_H - 40 - parentTier * NODE_GAP_Y;
      // Curved line from parent (bottom) to child (top)
      const parentUnlocked = parent.unlocked;
      gfx.lineStyle(parentUnlocked ? 3 : 2, parentUnlocked ? treeColor : 0x2a3340, parentUnlocked ? 0.8 : 0.4);
      gfx.beginPath();
      gfx.moveTo(px, py + NODE_RADIUS);
      gfx.lineTo(cx, cy - NODE_RADIUS);
      gfx.strokePath();
    });
    this.connectionGraphics = gfx;
    this.container.add(gfx);

    // Build nodes
    nodes.forEach((node) => {
      const tier = tiers.get(node.skill.id) ?? 0;
      const col = columns.get(node.skill.id) ?? 0;
      const cx = TREE_AREA_X + TREE_AREA_W / 2 + col * NODE_GAP_X;
      const cy = TREE_AREA_Y + TREE_AREA_H - 40 - tier * NODE_GAP_Y;

      // Node circle (background)
      const circle = this.scene.add.circle(cx, cy, NODE_RADIUS, this.getNodeFill(node), 0.95);
      circle.setStrokeStyle(3, this.getNodeStroke(node), this.getNodeStrokeAlpha(node));
      circle.setDepth(2);

      // Outer ring (glow effect for canUnlock)
      const ring = this.scene.add.circle(cx, cy, NODE_RADIUS + 6, treeColor, 0);
      ring.setStrokeStyle(2, treeColor, node.canUnlock ? 0.5 : 0);
      ring.setBlendMode(Phaser.BlendModes.ADD);
      ring.setDepth(1);
      if (node.canUnlock) {
        // Pulse animation
        this.scene.tweens.add({
          targets: ring, alpha: { from: 0.2, to: 0.6 }, scale: { from: 1, to: 1.15 },
          duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
      }

      // Icon inside node
      const iconChar = this.getSkillIcon(node);
      const icon = this.scene.add.text(cx, cy, iconChar, {
        fontFamily: 'monospace', fontSize: '24px',
        color: this.getNodeIconColor(node),
      }).setOrigin(0.5).setDepth(3);

      // Cost label below node
      const costLabel = this.scene.add.text(cx, cy + NODE_RADIUS + 14, `${node.skill.cost} SP`, {
        fontFamily: 'monospace', fontSize: '11px',
        color: node.unlocked ? '#40d070' : node.canUnlock ? '#ffe060' : '#3a4350',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(3);

      const allTexts: Phaser.GameObjects.Text[] = [icon, costLabel];
      this.container.add([circle, ring, icon, costLabel]);

      const treeNode: TreeSkillNode = {
        skillId: node.skill.id, node, tier, column: col,
        circle, ring, icon, costLabel, connectionLines: [], allTexts,
      };
      this.treeNodes.push(treeNode);

      // Register for nav (insert before back button)
      const unlockAction = () => {
        if (node.canUnlock && SkillTreeSystem.unlock(node.skill.id)) {
          AudioSystem.play('skillUnlock');
          // Particle burst on unlock
          this.spawnUnlockEffect(cx, cy, treeColor);
          this.refreshTree();
        }
      };
      circle.setInteractive({ useHandCursor: true });
      circle.on('pointerover', () => {
        this.navFocusIdx = this.navElements.findIndex(e => e.bg === circle);
        if (this.navFocusIdx < 0) this.navFocusIdx = 0;
        this.updateNavFocus();
        this.updateDetailPanel(node);
        AudioSystem.play('uiHover');
      });
      circle.on('pointerout', () => this.updateNavFocus());
      circle.on('pointerdown', () => { unlockAction(); });

      // Insert before back button
      const backIdx = this.navElements.length - 1;
      this.navElements.splice(backIdx, 0, {
        bg: circle as unknown as Phaser.GameObjects.Shape,
        text: icon,
        onSelect: unlockAction,
        focusColor: treeColor,
        normalColor: this.getNodeStroke(node),
      });
    });

    this.navFocusIdx = Math.min(this.navFocusIdx, this.navElements.length - 1);
    // Update detail panel with focused node
    if (this.treeNodes.length > 0) {
      const focused = this.treeNodes[Math.min(this.navFocusIdx, this.treeNodes.length - 1)];
      if (focused) this.updateDetailPanel(focused.node);
    }
    this.scene.time.delayedCall(0, () => { if (this.isVisible) this.updateNavFocus(); });
  }

  // ─── Helper: node colors based on state ────────────────────────────────
  private getNodeFill(node: SkillNode): number {
    if (node.unlocked) return TREE_GLOWS[this.selectedTree];
    if (node.canUnlock) return 0x0d1820;
    if (!node.prereqMet) return 0x05080c;
    return 0x0a1018;
  }
  private getNodeStroke(node: SkillNode): number {
    if (node.unlocked) return TREE_COLORS[this.selectedTree];
    if (node.canUnlock) return TREE_COLORS[this.selectedTree];
    return 0x2a3340;
  }
  private getNodeStrokeAlpha(node: SkillNode): number {
    if (node.unlocked) return 1;
    if (node.canUnlock) return 0.8;
    if (!node.prereqMet) return 0.3;
    return 0.5;
  }
  private getNodeIconColor(node: SkillNode): string {
    if (node.unlocked) return '#ffffff';
    if (node.canUnlock) return '#cfd6e0';
    if (!node.prereqMet) return '#2a3340';
    return '#4a5260';
  }
  private getSkillIcon(node: SkillNode): string {
    // Pick icon based on skill effect
    const skill = getSkill(node.skill.id);
    if (!skill) return '?';
    const eff = skill.effect;
    if (eff.unlock) {
      const u = eff.unlock;
      if (u === 'shotgun') return '🔫';
      if (u === 'railgun') return '🎯';
      if (u === 'rocket') return '🚀';
      if (u === 'doubleJump') return '↑↑';
      if (u === 'wallJump') return '↕';
      if (u === 'grapple') return '🪝';
      if (u === 'hover') return '≡';
      if (u === 'emp') return '⚡';
      if (u === 'hack') return '⌬';
    }
    if (eff.stat) {
      const s = eff.stat;
      if (s === 'meleeDamage') return '⚔';
      if (s === 'fireCooldownMs') return '➤';
      if (s === 'moveSpeed') return '→';
      if (s === 'maxHealth') return '♥';
      if (s === 'maxEnergy') return '⚡';
      if (s === 'energyRegen') return '⟳';
      if (s === 'dashCooldownMs') return '↯';
      if (s === 'invulnMs') return '🛡';
    }
    return '◆';
  }

  // ─── Detail panel update ───────────────────────────────────────────────
  private updateDetailPanel(node: SkillNode): void {
    if (!this.detailPanel) return;
    safeSetColor(this.detailPanel.name, node.unlocked ? '#40d070' : node.canUnlock ? '#cfd6e0' : '#5a6470');
    this.detailPanel.name.setText(node.name);
    this.detailPanel.desc.setText(node.description);
    this.detailPanel.cost.setText(node.unlocked ? '✓ UNLOCKED' : `◆ ${node.skill.cost} SP`);
    safeSetColor(this.detailPanel.cost, node.unlocked ? '#40d070' : '#ffe060');
    const isFa = getLocale() === 'fa';
    let statusText = '';
    if (node.unlocked) statusText = isFa ? '✓ باز شده' : 'UNLOCKED';
    else if (!node.prereqMet) statusText = isFa ? '🔒 نیاز به پیش‌نیاز' : 'LOCKED — REQUIRES PREREQUISITE';
    else if (!node.hasSkillPoints) statusText = isFa ? '◆ امتیاز کافی نیست' : 'NOT ENOUGH SP';
    else statusText = isFa ? '▶ آماده باز کردن' : 'READY TO UNLOCK';
    this.detailPanel.status.setText(statusText);
    safeSetColor(this.detailPanel.status, node.unlocked ? '#40d070' : node.canUnlock ? '#ffe060' : '#5a6470');
  }

  // ─── Particle burst when unlocking ─────────────────────────────────────
  private spawnUnlockEffect(x: number, y: number, color: number): void {
    // Expanding ring
    const ring = this.scene.add.circle(x, y, 10, color, 0.8);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setDepth(10);
    this.container.add(ring);
    this.scene.tweens.add({
      targets: ring, scale: { from: 1, to: 4 }, alpha: { from: 0.8, to: 0 },
      duration: 600, ease: 'Cubic.out', onComplete: () => ring.destroy(),
    });
    // Spark particles
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const spark = this.scene.add.circle(x, y, 3, color, 0.9);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      spark.setDepth(10);
      this.container.add(spark);
      const dist = 50 + Math.random() * 30;
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
        alpha: 0, scale: 0.3,
        duration: 500 + Math.random() * 200, ease: 'Cubic.out',
        onComplete: () => spark.destroy(),
      });
    }
  }

  // ─── Navigation overrides ──────────────────────────────────────────────
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
