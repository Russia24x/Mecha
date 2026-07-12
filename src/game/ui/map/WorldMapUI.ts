/**
 * MECHA: LAST PROTOCOL — World Map UI v5.0
 *
 * REDESIGNED: Graphical hex-grid map with connected area nodes.
 * Inspired by:
 *   - Armored Core 6: mission select with tactical overview
 *   - Elden Ring: interconnected world map
 *   - Blasphemous: dark map with node markers
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  ▮ TACTICAL MAP ▮                    EXPLORED: 50%   │
 *   │  ┌────────────────────────────────────────────────┐  │
 *   │  │  ╔═══╗                                         │  │
 *   │  │  ║ ⬡ ║─── ⬡ ─── ⬡                              │  │
 *   │  │  ╚═══╝    ╱        ╲                           │  │
 *   │  │          ⬡          ⬡                          │  │
 *   │  │                       ╲                        │  │
 *   │  │                        ⬡                       │  │
 *   │  └────────────────────────────────────────────────┘  │
 *   │  Legend: ◆ Cleared  ◇ Current  ✕ Locked  ? Unknown   │
 *   │                  [DISENGAGE]                         │
 *   └──────────────────────────────────────────────────────┘
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale, fixTextStyle } from '../../systems/LocalizationSystem';
import { WorldMapSystem, type MapNode } from '../../world/WorldMapSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import { THEME, addCornerBrackets, addScanlines } from '../Theme';

interface AreaNode {
  node: MapNode;
  hex: Phaser.GameObjects.Polygon;
  glow: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  x: number;
  y: number;
  allTexts: Phaser.GameObjects.Text[];
  allShapes: Phaser.GameObjects.Shape[];
}

export class WorldMapUI extends NavigableOverlay {
  private areaNodes: AreaNode[] = [];
  private connectionGraphics?: Phaser.GameObjects.Graphics;
  private onTravel: (areaId: string) => void;

  constructor(scene: Phaser.Scene, onBack: () => void, onTravel: (areaId: string) => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';
    this.onTravel = onTravel;

    // Background
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, THEME.BG_VOID, 0.95);
    this.container.add(overlay);
    this.container.add(addScanlines(scene, w, h, 0.02));

    // Title
    const titleBg = scene.add.rectangle(w / 2, 45, 400, 44, THEME.BG_PANEL, 0.9);
    titleBg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(titleBg);
    this.container.add(addCornerBrackets(scene, w / 2, 45, 400, 44, THEME.CYAN, 8, 0.6));
    this.container.add(scene.add.text(w / 2, 45, isFa ? '▮ نقشه تاکتیکی ▮' : '▮ TACTICAL MAP ▮', fixTextStyle({
      fontFamily: 'monospace', fontSize: '20px', color: THEME.TEXT_ACCENT, stroke: '#000', strokeThickness: 5, letterSpacing: 3,
    })).setOrigin(0.5));

    // Explored percentage badge
    const fogPct = WorldMapSystem.getFogOfWarPercent();
    const fogBg = scene.add.rectangle(w - 130, 80, 180, 30, THEME.BG_PANEL, 0.9);
    fogBg.setStrokeStyle(1, THEME.AMBER, 0.4);
    this.container.add(fogBg);
    this.container.add(scene.add.text(w - 130, 80, isFa ? `کاوش: ${fogPct}٪` : `EXPLORED: ${fogPct}%`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_AMBER, letterSpacing: 1,
    })).setOrigin(0.5));

    // Map panel background
    const mapX = 60, mapY = 110, mapW = w - 120, mapH = 460;
    const mapPanel = scene.add.rectangle(w / 2, mapY + mapH / 2, mapW, mapH, THEME.BG_PANEL, 0.4);
    mapPanel.setStrokeStyle(1, THEME.CYAN, 0.4);
    this.container.add(mapPanel);
    this.container.add(addCornerBrackets(scene, w / 2, mapY + mapH / 2, mapW, mapH, THEME.CYAN, 10, 0.6));

    // Legend (bottom of map)
    const legendY = mapY + mapH - 25;
    const legendItems = isFa ? [
      { icon: '◆', label: 'تکمیل شده', color: THEME.TEXT_AMBER },
      { icon: '◇', label: 'فعلی', color: THEME.TEXT_ACCENT },
      { icon: '✕', label: 'قفل', color: THEME.TEXT_RED },
      { icon: '?', label: 'نامعلوم', color: THEME.TEXT_DIM },
    ] : [
      { icon: '◆', label: 'CLEARED', color: THEME.TEXT_AMBER },
      { icon: '◇', label: 'CURRENT', color: THEME.TEXT_ACCENT },
      { icon: '✕', label: 'LOCKED', color: THEME.TEXT_RED },
      { icon: '?', label: 'UNKNOWN', color: THEME.TEXT_DIM },
    ];
    const legendStartX = w / 2 - (legendItems.length - 1) * 80;
    legendItems.forEach((item, i) => {
      const lx = legendStartX + i * 160;
      this.container.add(scene.add.text(lx - 30, legendY, item.icon, fixTextStyle({
        fontFamily: 'monospace', fontSize: '14px', color: item.color,
      })).setOrigin(0.5));
      this.container.add(scene.add.text(lx, legendY, item.label, fixTextStyle({
        fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_MED, letterSpacing: 1,
      })).setOrigin(0, 0.5));
    });

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 30, 220, 40, THEME.BG_PANEL, 0.95);
    bg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(addCornerBrackets(scene, w / 2, h - 30, 220, 40, THEME.CYAN, 6, 0.5));
    const textEl = scene.add.text(w / 2, h - 30, isFa ? '▲ خروج' : '▲ DISENGAGE', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    })).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); onBack(); });

    this.refresh();
  }

  private refresh(): void {
    // Cleanup
    const oldHexSet = new Set(this.areaNodes.map(n => n.hex));
    this.navElements = this.navElements.filter(el => !oldHexSet.has(el.bg as unknown as Phaser.GameObjects.Polygon));
    this.areaNodes.forEach(n => {
      n.allShapes.forEach(s => { if (s && s.active) s.destroy(); });
      n.allTexts.forEach(t => { if (t && t.active) t.destroy(); });
    });
    this.areaNodes = [];
    if (this.connectionGraphics) { this.connectionGraphics.destroy(); this.connectionGraphics = undefined; }

    const tree = WorldMapSystem.getMapTree();
    const w = GAME.WIDTH;
    const isFa = getLocale() === 'fa';
    const mapCx = w / 2;
    const mapCy = 340;

    // Collect all nodes in order
    const allNodes: { node: MapNode; actIdx: number; regionIdx: number; nodeIdx: number }[] = [];
    tree.forEach((actData, ai) => {
      actData.regions.forEach((regionData, ri) => {
        regionData.nodes.forEach((node, ni) => {
          allNodes.push({ node, actIdx: ai, regionIdx: ri, nodeIdx: ni });
        });
      });
    });

    if (allNodes.length === 0) return;

    // Layout: hex grid positions
    // Arrange in a flowing pattern — act 1 nodes on left, act 2 on right
    const positions = this.computeLayout(allNodes.length, mapCx, mapCy);

    // Draw connections first (behind nodes)
    const gfx = this.scene.add.graphics();
    gfx.setDepth(1);
    allNodes.forEach((item, i) => {
      if (i === 0) return;
      const prev = allNodes[i - 1];
      const prevPos = positions[i - 1];
      const currPos = positions[i];
      const prevUnlocked = prev.node.unlocked;
      const currUnlocked = item.node.unlocked;
      const connected = prevUnlocked && currUnlocked;

      // Circuit trace (L-shaped)
      const traceColor = connected ? THEME.AMBER : THEME.STROKE_DIM;
      const traceAlpha = connected ? 0.8 : 0.3;
      gfx.lineStyle(2.5, traceColor, traceAlpha);
      gfx.beginPath();
      gfx.moveTo(prevPos.x, prevPos.y);
      const midX = (prevPos.x + currPos.x) / 2;
      gfx.lineTo(midX, prevPos.y);
      gfx.lineTo(midX, currPos.y);
      gfx.lineTo(currPos.x, currPos.y);
      gfx.strokePath();
      // Via dot
      gfx.fillStyle(traceColor, traceAlpha);
      gfx.fillCircle(midX, prevPos.y, 3);
      gfx.fillCircle(midX, currPos.y, 3);
    });
    this.connectionGraphics = gfx;
    this.container.add(gfx);

    // Build nodes
    allNodes.forEach((item, i) => {
      const pos = positions[i];
      const node = item.node;
      const hexRadius = 32;

      // Status-based colors
      let fillColor: number, strokeColor: number, strokeAlpha: number, iconColor: string;
      let iconChar: string, statusText: string;

      if (node.isCurrent) {
        fillColor = THEME.BG_PANEL_HI;
        strokeColor = THEME.CYAN;
        strokeAlpha = 1;
        iconColor = THEME.TEXT_ACCENT;
        iconChar = '◇';
        statusText = isFa ? 'فعلی' : 'CURRENT';
      } else if (node.bossDefeated) {
        fillColor = THEME.AMBER;
        strokeColor = 0xffffff;
        strokeAlpha = 1;
        iconColor = '#ffffff';
        iconChar = '◆';
        statusText = isFa ? 'تکمیل' : 'CLEARED';
      } else if (node.unlocked) {
        fillColor = THEME.BG_PANEL_HI;
        strokeColor = THEME.AMBER;
        strokeAlpha = 0.8;
        iconColor = THEME.TEXT_AMBER;
        iconChar = node.hasBoss ? '⚔' : '▶';
        statusText = node.hasBoss ? (isFa ? 'باس' : 'BOSS') : (isFa ? 'آماده' : 'READY');
      } else {
        fillColor = THEME.BG_DARK;
        strokeColor = THEME.OFFLINE;
        strokeAlpha = 0.4;
        iconColor = THEME.TEXT_DIM;
        iconChar = node.discovered ? '✕' : '?';
        statusText = isFa ? 'قفل' : 'LOCKED';
      }

      // Glow for current/ready nodes
      const glow = this.scene.add.circle(pos.x, pos.y, hexRadius + 12, strokeColor, 0);
      glow.setStrokeStyle(2, strokeColor, node.isCurrent ? 0.5 : node.unlocked ? 0.3 : 0);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(1);
      if (node.isCurrent) {
        this.scene.tweens.add({
          targets: glow, alpha: { from: 0.3, to: 0.7 }, scale: { from: 1, to: 1.2 },
          duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
      }
      this.container.add(glow);

      // Hexagon
      const hexPoints: { x: number; y: number }[] = [];
      for (let j = 0; j < 6; j++) {
        const angle = (j / 6) * Math.PI * 2 - Math.PI / 2;
        hexPoints.push({ x: Math.cos(angle) * hexRadius, y: Math.sin(angle) * hexRadius });
      }
      const hex = this.scene.add.polygon(pos.x, pos.y, hexPoints, fillColor, 0.95);
      hex.setStrokeStyle(3, strokeColor, strokeAlpha);
      hex.setDepth(2);
      this.container.add(hex);

      // Icon
      const icon = this.scene.add.text(pos.x, pos.y - 2, iconChar, fixTextStyle({
        fontFamily: 'monospace', fontSize: '22px', color: iconColor,
      })).setOrigin(0.5).setDepth(3);
      this.container.add(icon);

      // Label (area name)
      const nameText = node.unlocked ? t(node.area.nameKey) : (node.discovered ? '???' : '???');
      const label = this.scene.add.text(pos.x, pos.y + hexRadius + 14, nameText, fixTextStyle({
        fontFamily: 'monospace', fontSize: '11px',
        color: node.isCurrent ? THEME.TEXT_ACCENT : node.unlocked ? THEME.TEXT_BRIGHT : THEME.TEXT_DIM,
        stroke: '#000', strokeThickness: 2,
      })).setOrigin(0.5).setDepth(3);
      this.container.add(label);

      // Status text
      const statusTxt = this.scene.add.text(pos.x, pos.y + hexRadius + 30, statusText, fixTextStyle({
        fontFamily: 'monospace', fontSize: '8px',
        color: node.isCurrent ? THEME.TEXT_ACCENT : node.bossDefeated ? THEME.TEXT_AMBER : node.unlocked ? THEME.TEXT_MED : THEME.TEXT_DIM,
        letterSpacing: 1,
      })).setOrigin(0.5).setDepth(3);
      this.container.add(statusTxt);

      const areaNode: AreaNode = {
        node, hex, glow, icon, label, statusText: statusTxt,
        x: pos.x, y: pos.y,
        allTexts: [icon, label, statusTxt], allShapes: [hex, glow],
      };
      this.areaNodes.push(areaNode);

      // Interactive
      const travelAction = () => {
        if (node.unlocked && !node.isCurrent && node.discovered) {
          AudioSystem.play('uiClick');
          this.onTravel(node.area.id);
        }
      };
      hex.setInteractive({ useHandCursor: true });
      hex.on('pointerover', () => {
        this.navFocusIdx = this.navElements.findIndex(e => e.bg === hex);
        if (this.navFocusIdx < 0) this.navFocusIdx = 0;
        this.updateNavFocus();
        AudioSystem.play('uiHover');
      });
      hex.on('pointerout', () => this.updateNavFocus());
      hex.on('pointerdown', () => { travelAction(); });

      // Insert before back button
      const backIdx = this.navElements.length - 1;
      this.navElements.splice(backIdx, 0, {
        bg: hex as unknown as Phaser.GameObjects.Shape,
        text: icon,
        onSelect: travelAction,
        focusColor: THEME.CYAN,
        normalColor: strokeColor,
      });
    });

    this.scene.time.delayedCall(0, () => { if (this.isVisible) this.updateNavFocus(); });
  }

  // ─── Compute hex layout positions ──────────────────────────────────────
  private computeLayout(count: number, cx: number, cy: number): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    const spacing = 130;
    if (count <= 1) {
      positions.push({ x: cx, y: cy });
      return positions;
    }
    // Arrange in a flowing S-curve pattern
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const startX = cx - (cols - 1) * spacing / 2;
    const startY = cy - (rows - 1) * spacing / 2;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Offset alternate rows for hex pattern
      const offsetX = (row % 2) * spacing / 2;
      positions.push({
        x: startX + col * spacing + offsetX,
        y: startY + row * spacing,
      });
    }
    return positions;
  }
}

export default WorldMapUI;
