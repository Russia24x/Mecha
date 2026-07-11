/**
 * MECHA: LAST PROTOCOL — Quest Log UI
 * Shows active, completed (ready to turn in), and finished quests.
 * Displays objectives with progress bars.
 * Depth 250.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { QuestSystem } from '../../systems/QuestSystem';
import { getQuest } from '../../data/quests/quests';
import { AudioSystem } from '../../systems/AudioSystem';

export class QuestUI {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private questEntries: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, onBack: () => void) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.9);
    overlay.setInteractive();
    this.container.add(overlay);

    this.container.add(scene.add.text(w / 2, 40, 'QUEST LOG', {
      fontFamily: 'monospace', fontSize: '28px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 40, 280, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onBack(); });
    this.container.add(bg);
    this.container.add(scene.add.text(w / 2, h - 40, t('menu.back'), { fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0' }).setOrigin(0.5));
  }

  private refresh(): void {
    this.questEntries.forEach(e => e.destroy());
    this.questEntries = [];

    const activeQuests = QuestSystem.getActiveQuests();
    const completedQuests = QuestSystem.getCompletedQuests();
    const turnedInQuests = QuestSystem.getTurnedInQuests();
    const w = GAME.WIDTH;
    let y = 100;

    // Active quests
    if (activeQuests.length > 0) {
      this.container.add(this.scene.add.text(80, y, '▶ ACTIVE', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe060' }));
      y += 30;
      for (const quest of activeQuests) {
        y = this.renderQuest(quest, y, '#cfd6e0');
      }
      y += 20;
    }

    // Completed (ready to turn in)
    if (completedQuests.length > 0) {
      this.container.add(this.scene.add.text(80, y, '✓ READY TO TURN IN', { fontFamily: 'monospace', fontSize: '14px', color: '#40d070' }));
      y += 30;
      for (const quest of completedQuests) {
        y = this.renderQuest(quest, y, '#9be0b0');
      }
      y += 20;
    }

    // Turned in (completed)
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

  private renderQuest(quest: import('../../data/types').QuestData, y: number, color: string): number {
    const w = GAME.WIDTH;
    const entry = this.scene.add.container(80, y);
    const cardH = 70 + quest.objectives.length * 16;

    // Card background
    const bg = this.scene.add.rectangle(w / 2 - 80, cardH / 2, w - 160, cardH, 0x1a2030, 0.9);
    bg.setStrokeStyle(1, 0x2a3340, 0.6);
    entry.add(bg);

    // Name
    entry.add(this.scene.add.text(20, 10, t(quest.nameKey), {
      fontFamily: 'monospace', fontSize: '13px', color,
    }).setOrigin(0, 0));

    // Description
    entry.add(this.scene.add.text(20, 28, t(quest.descriptionKey), {
      fontFamily: 'monospace', fontSize: '10px', color: '#5a6470',
    }).setOrigin(0, 0));

    // Objectives with progress
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
    return y + cardH + 8;
  }

  show(): void { this.container.setVisible(true); this.refresh(); }
  hide(): void { this.container.setVisible(false); }
  get isVisible(): boolean { return this.container.visible; }

  destroy(): void { this.container.destroy(); }
}

export default QuestUI;
