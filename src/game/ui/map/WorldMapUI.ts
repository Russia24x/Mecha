/**
 * MECHA: LAST PROTOCOL — World Map UI v4.0
 *
 * REDESIGNED: "TACTICAL MAP" — strategic area overview.
 * Inspired by Armored Core 6 (mission select) + Blasphemous (dark panels).
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale } from '../../systems/LocalizationSystem';
import { WorldMapSystem, type MapNode } from '../../world/WorldMapSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import { THEME, addCornerBrackets, addScanlines } from '../Theme';

export class WorldMapUI extends NavigableOverlay {
  private areaCards: Phaser.GameObjects.Container[] = [];
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
    this.container.add(scene.add.text(w / 2, 45, isFa ? '▮ نقشه تاکتیکی ▮' : '▮ TACTICAL MAP ▮', {
      fontFamily: 'monospace', fontSize: '20px', color: THEME.TEXT_ACCENT, stroke: '#000', strokeThickness: 5, letterSpacing: 3,
    }).setOrigin(0.5));

    // Fog of war percentage
    const fogPct = WorldMapSystem.getFogOfWarPercent();
    this.container.add(scene.add.text(w / 2, 75, isFa ? `کاوش شده: ${fogPct}٪` : `EXPLORED: ${fogPct}%`, {
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_MED, letterSpacing: 2,
    }).setOrigin(0.5));

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 30, 220, 40, THEME.BG_PANEL, 0.95);
    bg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(addCornerBrackets(scene, w / 2, h - 30, 220, 40, THEME.CYAN, 6, 0.5));
    const textEl = scene.add.text(w / 2, h - 30, isFa ? '▲ خروج' : '▲ DISENGAGE', {
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    }).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); onBack(); });

    this.refresh();
  }

  private refresh(): void {
    // Cleanup
    const backIdx = this.navElements.length - 1;
    const backEl = backIdx >= 0 ? this.navElements[backIdx] : null;
    for (let i = 0; i < backIdx; i++) {
      const el = this.navElements[i];
      if (el.bg && el.bg.active) el.bg.destroy();
      if (el.text && el.text.active) el.text.destroy();
    }
    this.navElements = backEl ? [backEl] : [];
    this.areaCards.forEach(c => { if (c && c.active) c.destroy(); });
    this.areaCards = [];

    const tree = WorldMapSystem.getMapTree();
    const w = GAME.WIDTH;
    const isFa = getLocale() === 'fa';
    let y = 105;

    for (const actData of tree) {
      this.container.add(this.scene.add.text(w / 2, y, t(actData.act.nameKey), {
        fontFamily: 'monospace', fontSize: '16px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 3, letterSpacing: 2,
      }).setOrigin(0.5));
      // Accent line
      this.container.add(this.scene.add.rectangle(w / 2 - 100, y + 14, 200, 1, THEME.AMBER, 0.3).setOrigin(0, 0.5));
      y += 30;

      for (const regionData of actData.regions) {
        this.container.add(this.scene.add.text(80, y, t(regionData.region.nameKey), {
          fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_MED, letterSpacing: 1,
        }));
        y += 24;

        for (const node of regionData.nodes) {
          y = this.renderAreaCard(node, y, w, isFa);
        }
        y += 12;
      }
    }
  }

  private renderAreaCard(node: MapNode, y: number, w: number, isFa: boolean): number {
    const cardW = w - 160;
    const cardH = 56;
    const card = this.scene.add.container(80, y);

    const bgColor = node.isCurrent ? THEME.BG_PANEL_HI : node.unlocked ? THEME.BG_PANEL : THEME.BG_DARK;
    const strokeColor = node.isCurrent ? THEME.CYAN : node.unlocked ? THEME.AMBER : THEME.OFFLINE;
    const bg = this.scene.add.rectangle(cardW / 2, cardH / 2, cardW, cardH, bgColor, 0.92);
    bg.setStrokeStyle(1, strokeColor, node.isCurrent ? 0.9 : 0.4);
    card.add(bg);
    // Left accent bar
    card.add(this.scene.add.rectangle(2, cardH / 2, 3, cardH - 8, strokeColor, 0.6));

    let name = t(node.area.nameKey);
    if (!node.discovered) name = isFa ? '؟؟؟ (کاوش نشده)' : '??? (UNDISCOVERED)';
    if (!node.unlocked) name = isFa ? '🔒 قفل' : '🔒 LOCKED';
    const nameText = this.scene.add.text(20, 8, name, {
      fontFamily: 'monospace', fontSize: '13px',
      color: node.isCurrent ? THEME.TEXT_ACCENT : node.unlocked ? THEME.TEXT_BRIGHT : THEME.TEXT_DIM,
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0);
    card.add(nameText);

    let status = '';
    if (node.isCurrent) status = isFa ? '◆ فعلی ' : '◆ CURRENT ';
    if (node.bossDefeated) status += isFa ? '★ باس شکست خورد ' : '★ BOSS DEFEATED ';
    else if (node.hasBoss && node.unlocked) status += isFa ? '⚔ باس ' : '⚔ BOSS ';
    if (node.unlocked && !node.isCurrent && node.discovered) status += isFa ? '▶ سفر' : '▶ TRAVEL';
    card.add(this.scene.add.text(cardW - 20, 8, status, {
      fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_MED,
    }).setOrigin(1, 0));

    this.container.add(card);
    this.areaCards.push(card);

    const travelAction = () => {
      if (node.unlocked && !node.isCurrent && node.discovered) {
        AudioSystem.play('uiClick');
        this.onTravel(node.area.id);
      }
    };
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { bg.setFillStyle(THEME.BG_PANEL_HI, 1); });
    bg.on('pointerout', () => { bg.setFillStyle(bgColor, 0.92); });
    bg.on('pointerdown', () => { travelAction(); });

    const backIdx = this.navElements.length - 1;
    this.navElements.splice(backIdx, 0, {
      bg, text: nameText, onSelect: travelAction,
      focusColor: node.unlocked ? THEME.AMBER : THEME.OFFLINE,
      normalColor: strokeColor,
    });

    return y + cardH + 6;
  }
}

export default WorldMapUI;
