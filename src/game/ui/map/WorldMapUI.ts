/**
 * MECHA: LAST PROTOCOL — World Map UI
 * Fog of war + area cards + fast travel.
 * Shows Act → Region → Area tree with lock/discover/complete status.
 * Click an unlocked+discovered area to fast travel.
 * Depth 250.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { WorldMapSystem, type MapNode } from '../../world/WorldMapSystem';
import { WorldSystem } from '../../world/WorldSystem';
import { AudioSystem } from '../../systems/AudioSystem';

export class WorldMapUI {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private areaCards: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, onBack: () => void, onTravel: (areaId: string) => void) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.9);
    this.container.add(overlay);

    this.container.add(scene.add.text(w / 2, 40, t('mission.title'), {
      fontFamily: 'monospace', fontSize: '28px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    // Fog of war percentage
    const fogPct = WorldMapSystem.getFogOfWarPercent();
    this.container.add(scene.add.text(w / 2, 72, `EXPLORED: ${fogPct}%`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#5a6470',
    }).setOrigin(0.5));

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 40, 280, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onBack(); });
    this.container.add(bg);
    this.container.add(scene.add.text(w / 2, h - 40, t('menu.back'), { fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0' }).setOrigin(0.5));

    // Store travel callback
    this.onTravel = onTravel;
  }

  private onTravel: (areaId: string) => void;

  private refresh(): void {
    this.areaCards.forEach(c => c.destroy());
    this.areaCards = [];

    const tree = WorldMapSystem.getMapTree();
    const w = GAME.WIDTH;
    let y = 110;

    for (const actData of tree) {
      // Act header
      this.container.add(this.scene.add.text(w / 2, y, t(actData.act.nameKey), {
        fontFamily: 'monospace', fontSize: '18px', color: '#39d0d8',
      }).setOrigin(0.5));
      y += 30;

      for (const regionData of actData.regions) {
        // Region header
        this.container.add(this.scene.add.text(80, y, t(regionData.region.nameKey), {
          fontFamily: 'monospace', fontSize: '14px', color: '#7a8090',
        }));
        y += 25;

        // Area cards
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

    // Area name
    let name = t(node.area.nameKey);
    if (!node.discovered) name = '??? (UNDISCOVERED)';
    if (!node.unlocked) name = '🔒 LOCKED';
    card.add(this.scene.add.text(20, 10, name, {
      fontFamily: 'monospace', fontSize: '13px',
      color: node.isCurrent ? '#66f0ff' : node.unlocked ? '#cfd6e0' : '#3a4350',
    }).setOrigin(0, 0));

    // Status badges
    let status = '';
    if (node.isCurrent) status += '◆ CURRENT ';
    if (node.bossDefeated) status += '★ BOSS DEFEATED ';
    else if (node.hasBoss && node.unlocked) status += '⚔ BOSS ';
    if (node.unlocked && !node.isCurrent && node.discovered) status += '▶ TRAVEL';
    card.add(this.scene.add.text(cardW - 20, 10, status, {
      fontFamily: 'monospace', fontSize: '10px', color: '#5a6470',
    }).setOrigin(1, 0));

    // Click to travel
    if (node.unlocked && !node.isCurrent && node.discovered) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x243040, 1));
      bg.on('pointerout', () => bg.setFillStyle(bgColor, 0.95));
      bg.on('pointerdown', () => {
        AudioSystem.play('uiClick');
        this.onTravel(node.area.id);
      });
    }

    this.container.add(card);
    this.areaCards.push(card);
    return y + cardH + 8;
  }

  show(): void { this.container.setVisible(true); this.refresh(); }
  hide(): void { this.container.setVisible(false); }
  get isVisible(): boolean { return this.container.visible; }

  destroy(): void { this.container.destroy(); }
}

export default WorldMapUI;
