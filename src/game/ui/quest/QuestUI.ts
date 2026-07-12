/**
 * MECHA: LAST PROTOCOL — Quest Log UI v3.2
 * Shows active, completed, and finished quests with progress.
 * Full gamepad navigation: up/down to scroll, A to select (no-op for quests).
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { QuestSystem } from '../../systems/QuestSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import type { QuestData } from '../../data/types';

export class QuestUI extends NavigableOverlay {
  private questEntries: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.9);
    this.container.add(overlay);

    this.container.add(scene.add.text(w / 2, 40, 'QUEST LOG', {
      fontFamily: 'monospace', fontSize: '28px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    this.refresh();

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 40, 280, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    const textEl = scene.add.text(w / 2, h - 40, t('menu.back'), {
      fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0',
    }).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); onBack(); });

    // *** FIX: propagate scrollFactor(0) to ALL children (overlay, title, quest cards, etc.)
    this.container.setScrollFactor(0, 0, true);
  }

  private refresh(): void {
    // Remove quest nav elements FIRST (keep back button), then destroy.
    const backIdx = this.navElements.length - 1;
    const backEl = backIdx >= 0 ? this.navElements[backIdx] : null;
    for (let i = 0; i < backIdx; i++) {
      const el = this.navElements[i];
      if (el.bg && el.bg.active) el.bg.destroy();
      if (el.text && el.text.active) el.text.destroy();
    }
    this.navElements = backEl ? [backEl] : [];
    // Destroy quest entry containers (their bg/text already destroyed above)
    this.questEntries.forEach(e => { if (e && e.active) e.destroy(); });
    this.questEntries = [];

    const activeQuests = QuestSystem.getActiveQuests();
    const completedQuests = QuestSystem.getCompletedQuests();
    const turnedInQuests = QuestSystem.getTurnedInQuests();
    const w = GAME.WIDTH;
    let y = 100;

    if (activeQuests.length > 0) {
      this.container.add(this.scene.add.text(80, y, '▶ ACTIVE', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe060' }));
      y += 30;
      for (const quest of activeQuests) {
        y = this.renderQuest(quest, y, '#cfd6e0');
      }
      y += 20;
    }

    if (completedQuests.length > 0) {
      this.container.add(this.scene.add.text(80, y, '✓ READY TO TURN IN', { fontFamily: 'monospace', fontSize: '14px', color: '#40d070' }));
      y += 30;
      for (const quest of completedQuests) {
        y = this.renderQuest(quest, y, '#9be0b0');
      }
      y += 20;
    }

    if (turnedInQuests.length > 0) {
      this.container.add(this.scene.add.text(80, y, '★ COMPLETED', { fontFamily: 'monospace', fontSize: '14px', color: '#5a6470' }));
      y += 30;
      for (const quest of turnedInQuests) {
        y = this.renderQuest(quest, y, '#3a4350');
      }
    }

    if (activeQuests.length === 0 && completedQuests.length === 0 && turnedInQuests.length === 0) {
      this.container.add(this.scene.add.text(w / 2, 300, '— NO QUESTS —', {
        fontFamily: 'monospace', fontSize: '14px', color: '#3a4350',
      }).setOrigin(0.5));
    }
  }

  private renderQuest(quest: QuestData, y: number, color: string): number {
    const w = GAME.WIDTH;
    const entry = this.scene.add.container(80, y);
    const cardH = 70 + quest.objectives.length * 16;

    const bg = this.scene.add.rectangle(w / 2 - 80, cardH / 2, w - 160, cardH, 0x1a2030, 0.9);
    bg.setStrokeStyle(1, 0x2a3340, 0.6);
    entry.add(bg);

    const nameText = this.scene.add.text(20, 10, t(quest.nameKey), {
      fontFamily: 'monospace', fontSize: '13px', color,
    }).setOrigin(0, 0);
    entry.add(nameText);

    entry.add(this.scene.add.text(20, 28, t(quest.descriptionKey), {
      fontFamily: 'monospace', fontSize: '10px', color: '#5a6470',
    }).setOrigin(0, 0));

    const progress = QuestSystem.getProgress(quest.id);
    quest.objectives.forEach((obj, i) => {
      const prog = progress[i] ?? 0;
      const done = prog >= obj.amount;
      entry.add(this.scene.add.text(20, 48 + i * 16,
        `${done ? '✓' : '○'} ${obj.type} ${obj.target}: ${prog}/${obj.amount}`,
        { fontFamily: 'monospace', fontSize: '10px', color: done ? '#40d070' : '#7a8090' }
      ).setOrigin(0, 0));
    });

    this.container.add(entry);
    this.questEntries.push(entry);

    // Register quest card for gamepad navigation
    // bg is inside container, need to set interactive on it
    bg.setInteractive({ useHandCursor: true });
    // Insert nav element before back button
    this.navElements.splice(this.navElements.length - 1, 0, {
      bg, text: nameText, onSelect: () => { /* view only */ },
    });

    return y + cardH + 8;
  }
}

export default QuestUI;
