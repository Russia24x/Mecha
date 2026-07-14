/**
 * MECHA: LAST PROTOCOL — Quest Log UI v4.0
 *
 * REDESIGNED: "MISSION LOG" — tactical objectives display.
 * Inspired by Armored Core 6 (mission briefing UI) + Blasphemous (dark panels).
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale, fixTextStyle } from '../../systems/LocalizationSystem';
import { QuestSystem } from '../../systems/QuestSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import { THEME, addCornerBrackets, addScanlines } from '../Theme';
import type { QuestData } from '../../data/types';

export class QuestUI extends NavigableOverlay {
  private questEntries: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';

    // Background
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, THEME.BG_VOID, 0.95);
    this.container.add(overlay);
    this.container.add(addScanlines(scene, w, h, 0.02));

    // Title with corner brackets
    const titleBg = scene.add.rectangle(w / 2, 45, 400, 44, THEME.BG_PANEL, 0.9);
    titleBg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(titleBg);
    this.container.add(addCornerBrackets(scene, w / 2, 45, 400, 44, THEME.CYAN, 8, 0.6));
    this.container.add(scene.add.text(w / 2, 45, isFa ? '▮ گزارش ماموریت ▮' : '▮ MISSION LOG ▮', fixTextStyle({
      fontFamily: 'monospace', fontSize: '20px', color: THEME.TEXT_ACCENT, stroke: '#000', strokeThickness: 5, letterSpacing: 3,
    })).setOrigin(0.5));

    this.refresh();

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 30, 220, 40, THEME.BG_PANEL, 0.95);
    bg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(addCornerBrackets(scene, w / 2, h - 30, 220, 40, THEME.CYAN, 6, 0.5));
    const textEl = scene.add.text(w / 2, h - 30, isFa ? '▲ خروج' : '▲ DISENGAGE', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    })).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); onBack(); });

    this.container.setScrollFactor(0, 0, true);
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
    this.questEntries.forEach(e => { if (e && e.active) e.destroy(); });
    this.questEntries = [];

    const activeQuests = QuestSystem.getActiveQuests();
    const completedQuests = QuestSystem.getCompletedQuests();
    const turnedInQuests = QuestSystem.getTurnedInQuests();
    const w = GAME.WIDTH;
    const isFa = getLocale() === 'fa';
    let y = 90;

    if (activeQuests.length > 0) {
      this.container.add(this.scene.add.text(80, y, isFa ? '▶ فعال' : '▶ ACTIVE', fixTextStyle({
        fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_AMBER, letterSpacing: 2,
      })));
      y += 28;
      for (const quest of activeQuests) {
        y = this.renderQuest(quest, y, THEME.TEXT_BRIGHT, THEME.AMBER);
      }
      y += 16;
    }

    if (completedQuests.length > 0) {
      this.container.add(this.scene.add.text(80, y, isFa ? '✓ آماده تحویل' : '✓ READY TO TURN IN', fixTextStyle({
        fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_GREEN, letterSpacing: 2,
      })));
      y += 28;
      for (const quest of completedQuests) {
        y = this.renderQuest(quest, y, '#9be0b0', THEME.ACTIVE);
      }
      y += 16;
    }

    if (turnedInQuests.length > 0) {
      this.container.add(this.scene.add.text(80, y, isFa ? '★ تکمیل شده' : '★ COMPLETED', fixTextStyle({
        fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_DIM, letterSpacing: 2,
      })));
      y += 28;
      for (const quest of turnedInQuests) {
        y = this.renderQuest(quest, y, THEME.TEXT_DIM, THEME.OFFLINE);
      }
    }

    if (activeQuests.length === 0 && completedQuests.length === 0 && turnedInQuests.length === 0) {
      this.container.add(this.scene.add.text(w / 2, 300, isFa ? '◇ بدون ماموریت ◇' : '◇ NO MISSIONS ◇', fixTextStyle({
        fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_DIM, letterSpacing: 3,
      })).setOrigin(0.5));
    }
  }

  private renderQuest(quest: QuestData, y: number, color: string, accentColor: number): number {
    const w = GAME.WIDTH;
    const entry = this.scene.add.container(80, y);
    const cardH = 70 + quest.objectives.length * 16;

    const bg = this.scene.add.rectangle(w / 2 - 80, cardH / 2, w - 160, cardH, THEME.BG_PANEL, 0.9);
    bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
    entry.add(bg);
    // Left accent bar
    entry.add(this.scene.add.rectangle(2, cardH / 2, 3, cardH - 8, accentColor, 0.5));

    const nameText = this.scene.add.text(20, 10, t(quest.nameKey), fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color, stroke: '#000', strokeThickness: 2,
    })).setOrigin(0, 0);
    entry.add(nameText);

    entry.add(this.scene.add.text(20, 28, t(quest.descriptionKey), fixTextStyle({
      fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_MED,
    })).setOrigin(0, 0));

    const progress = QuestSystem.getProgress(quest.id);
    quest.objectives.forEach((obj, i) => {
      const prog = progress[i] ?? 0;
      const done = prog >= obj.amount;
      entry.add(this.scene.add.text(20, 48 + i * 16,
        `${done ? '✓' : '○'} ${obj.type} ${obj.target}: ${prog}/${obj.amount}`,
        fixTextStyle({ fontFamily: 'monospace', fontSize: '10px', color: done ? THEME.TEXT_GREEN : THEME.TEXT_MED })
      ).setOrigin(0, 0));
    });

    this.container.add(entry);
    this.questEntries.push(entry);

    // Register via registerNav (handles setInteractive + ctrl.addButton)
    const backIdx = this.navElements.length - 1;
    this.registerNav(bg, nameText, () => { /* view only */ }, { insertAt: backIdx });

    return y + cardH + 8;
  }
}

export default QuestUI;
