/**
 * MECHA: LAST PROTOCOL — World Map UI v3.2
 * Fog of war + area cards + fast travel.
 * Full gamepad navigation: up/down to select area, A to travel.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { WorldMapSystem, type MapNode } from '../../world/WorldMapSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';

export class WorldMapUI extends NavigableOverlay {
  private areaCards: Phaser.GameObjects.Container[] = [];
  private onTravel: (areaId: string) => void;

  constructor(scene: Phaser.Scene, onBack: () => void, onTravel: (areaId: string) => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    this.onTravel = onTravel;

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.9);
    this.container.add(overlay);

    this.container.add(scene.add.text(w / 2, 40, t('mission.title'), {
      fontFamily: 'monospace', fontSize: '28px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    const fogPct = WorldMapSystem.getFogOfWarPercent();
    this.container.add(scene.add.text(w / 2, 72, `EXPLORED: ${fogPct}%`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#5a6470',
    }).setOrigin(0.5));

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 40, 280, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    const textEl = scene.add.text(w / 2, h - 40, t('menu.back'), {
      fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0',
    }).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); onBack(); });

    this.refresh();
  }

  private refresh(): void {
    this.areaCards.forEach(c => c.destroy());
    this.areaCards = [];
    // Clear area nav elements (keep back button)
    const backIdx = this.navElements.length - 1;
    const backEl = backIdx >= 0 ? this.navElements[backIdx] : null;
    this.navElements = backEl ? [backEl] : [];

    const tree = WorldMapSystem.getMapTree();
    const w = GAME.WIDTH;
    let y = 110;

    for (const actData of tree) {
      this.container.add(this.scene.add.text(w / 2, y, t(actData.act.nameKey), {
        fontFamily: 'monospace', fontSize: '18px', color: '#39d0d8',
      }).setOrigin(0.5));
      y += 30;

      for (const regionData of actData.regions) {
        this.container.add(this.scene.add.text(80, y, t(regionData.region.nameKey), {
          fontFamily: 'monospace', fontSize: '14px', color: '#7a8090',
        }));
        y += 25;

        for (const node of regionData.nodes) {
          y = this.renderAreaCard(node, y, w);
        }
        y += 15;
      }
    }
  }

  private renderAreaCard(node: MapNode, y: number, w: number): number {
    const cardW = w - 160;
    const cardH = 60;
    const card = this.scene.add.container(80, y);

    const bgColor = node.isCurrent ? 0x243040 : node.unlocked ? 0x1a2030 : 0x0e1218;
    const strokeColor = node.isCurrent ? 0x66f0ff : node.unlocked ? 0x39d0d8 : 0x2a3340;
    const bg = this.scene.add.rectangle(cardW / 2, cardH / 2, cardW, cardH, bgColor, 0.95);
    bg.setStrokeStyle(1, strokeColor, node.isCurrent ? 1 : 0.5);
    card.add(bg);

    let name = t(node.area.nameKey);
    if (!node.discovered) name = '??? (UNDISCOVERED)';
    if (!node.unlocked) name = '🔒 LOCKED';
    const nameText = this.scene.add.text(20, 10, name, {
      fontFamily: 'monospace', fontSize: '13px',
      color: node.isCurrent ? '#66f0ff' : node.unlocked ? '#cfd6e0' : '#3a4350',
    }).setOrigin(0, 0);
    card.add(nameText);

    let status = '';
    if (node.isCurrent) status += '◆ CURRENT ';
    if (node.bossDefeated) status += '★ BOSS DEFEATED ';
    else if (node.hasBoss && node.unlocked) status += '⚔ BOSS ';
    if (node.unlocked && !node.isCurrent && node.discovered) status += '▶ TRAVEL';
    card.add(this.scene.add.text(cardW - 20, 10, status, {
      fontFamily: 'monospace', fontSize: '10px', color: '#5a6470',
    }).setOrigin(1, 0));

    this.container.add(card);
    this.areaCards.push(card);

    // Register for gamepad navigation + mouse
    const travelAction = () => {
      if (node.unlocked && !node.isCurrent && node.discovered) {
        AudioSystem.play('uiClick');
        this.onTravel(node.area.id);
      }
    };
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { bg.setFillStyle(0x243040, 1); });
    bg.on('pointerout', () => { bg.setFillStyle(bgColor, 0.95); });
    bg.on('pointerdown', () => { travelAction(); });

    // Insert before back button
    const backIdx = this.navElements.length - 1;
    this.navElements.splice(backIdx, 0, {
      bg, text: nameText, onSelect: travelAction,
      focusColor: node.unlocked ? 0x39d0d8 : 0x2a3340,
      normalColor: strokeColor,
    });

    return y + cardH + 8;
  }
}

export default WorldMapUI;
