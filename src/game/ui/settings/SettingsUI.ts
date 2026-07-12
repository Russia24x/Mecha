/**
 * MECHA: LAST PROTOCOL — Settings UI v5.0
 *
 * REDESIGNED: Two-column layout with category list + options panel.
 * Inspired by Armored Core 6 (system config) + Blasphemous (dark panels).
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  ▮ SYSTEM CONFIG ▮                                   │
 *   │  ┌──────────┐  ┌────────────────────────────────────┐│
 *   │  │ ⚙ AUDIO  │  │  Master Volume    ━━━━●━━━ 70%    ││
 *   │  │ ▣ DISPLAY│  │  SFX Volume       ━━━●━━━━━ 50%    ││
 *   │  │ ⌬ LANG   │  │  Music Volume     ━━━━━●━━━ 80%    ││
 *   │  │          │  │                                    ││
 *   │  │          │  │                                    ││
 *   │  └──────────┘  └────────────────────────────────────┘│
 *   │                  [DISENGAGE]                         │
 *   └──────────────────────────────────────────────────────┘
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, setLocale, getLocale } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { RenderSystem } from '../../systems/RenderSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import { THEME, addCornerBrackets, addScanlines } from '../Theme';
import type { Locale } from '../../data/types';

interface Slider {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  handle: Phaser.GameObjects.Arc;
  fill: Phaser.GameObjects.Rectangle;
  valueText: Phaser.GameObjects.Text;
  value: number;
  onChange: (v: number) => void;
}

type CategoryId = 'audio' | 'display' | 'language';

const CATEGORIES: { id: CategoryId; icon: string; en: string; fa: string }[] = [
  { id: 'audio', icon: '⚙', en: 'AUDIO', fa: 'صدا' },
  { id: 'display', icon: '▣', en: 'DISPLAY', fa: 'نمایشگر' },
  { id: 'language', icon: '⌬', en: 'LANGUAGE', fa: 'زبان' },
];

export class SettingsUI extends NavigableOverlay {
  private sliders: Slider[] = [];
  private categoryBgs: Phaser.GameObjects.Rectangle[] = [];
  private categoryTexts: Phaser.GameObjects.Text[] = [];
  private categoryIcons: Phaser.GameObjects.Text[] = [];
  private selectedCategory: CategoryId = 'audio';
  private optionsContainer: Phaser.GameObjects.Container;
  private optionElements: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; onSelect: () => void }[] = [];

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';

    // Background
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, THEME.BG_VOID, 0.95);
    this.container.add(overlay);
    this.container.add(addScanlines(scene, w, h, 0.02));

    // Title
    const titleBg = scene.add.rectangle(w / 2, 45, 400, 44, THEME.BG_PANEL, 0.9);
    titleBg.setStrokeStyle(1, THEME.AMBER, 0.5);
    this.container.add(titleBg);
    this.container.add(addCornerBrackets(scene, w / 2, 45, 400, 44, THEME.AMBER, 8, 0.6));
    this.container.add(scene.add.text(w / 2, 45, isFa ? '▮ پیکربندی سیستم ▮' : '▮ SYSTEM CONFIG ▮', {
      fontFamily: 'monospace', fontSize: '20px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 5, letterSpacing: 3,
    }).setOrigin(0.5));

    // Left panel: category list
    const leftX = 140, leftY = 280, leftW = 220, leftH = 360;
    const leftBg = scene.add.rectangle(leftX, leftY, leftW, leftH, THEME.BG_PANEL, 0.85);
    leftBg.setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
    this.container.add(leftBg);
    this.container.add(addCornerBrackets(scene, leftX, leftY, leftW, leftH, THEME.CYAN, 8, 0.5));
    // Left panel title
    this.container.add(scene.add.text(leftX, leftY - leftH / 2 + 18, isFa ? 'بخش‌ها' : 'CATEGORIES', {
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_AMBER, letterSpacing: 2,
    }).setOrigin(0.5));

    // Categories
    CATEGORIES.forEach((cat, i) => {
      const cy = leftY - leftH / 2 + 60 + i * 80;
      const bg = scene.add.rectangle(leftX, cy, leftW - 20, 60, THEME.BG_PANEL, 0.9);
      bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
      // Left accent bar
      this.container.add(scene.add.rectangle(leftX - leftW / 2 + 12, cy, 3, 48, THEME.AMBER, 0.3));
      const icon = scene.add.text(leftX - 60, cy, cat.icon, {
        fontFamily: 'monospace', fontSize: '22px', color: THEME.TEXT_MED,
      }).setOrigin(0.5);
      const label = scene.add.text(leftX + 20, cy, isFa ? cat.fa : cat.en, {
        fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_MED, letterSpacing: 1,
      }).setOrigin(0.5);
      this.container.add([bg, icon, label]);
      this.categoryBgs.push(bg);
      this.categoryTexts.push(label);
      this.categoryIcons.push(icon);
      this.registerNav(bg, label, () => { this.selectedCategory = cat.id; this.refreshOptions(); AudioSystem.play('uiClick'); });
    });

    // Right panel: options
    const rightX = 590, rightY = 280, rightW = 580, rightH = 360;
    const rightBg = scene.add.rectangle(rightX, rightY, rightW, rightH, THEME.BG_PANEL, 0.6);
    rightBg.setStrokeStyle(1, THEME.CYAN, 0.4);
    this.container.add(rightBg);
    this.container.add(addCornerBrackets(scene, rightX, rightY, rightW, rightH, THEME.CYAN, 8, 0.5));
    // Right panel title
    this.container.add(scene.add.text(rightX, rightY - rightH / 2 + 18, isFa ? 'گزینه‌ها' : 'OPTIONS', {
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_AMBER, letterSpacing: 2,
    }).setOrigin(0.5));

    // Options container (content changes based on selected category)
    this.optionsContainer = scene.add.container(0, 0);
    this.container.add(this.optionsContainer);

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 30, 220, 40, THEME.BG_PANEL, 0.95);
    bg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(addCornerBrackets(scene, w / 2, h - 30, 220, 40, THEME.CYAN, 6, 0.5));
    const textEl = scene.add.text(w / 2, h - 30, isFa ? '▲ خروج' : '▲ DISENGAGE', {
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    }).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); onBack(); });

    this.refreshCategories();
    this.refreshOptions();
    this.container.setScrollFactor(0, 0, true);
  }

  private refreshCategories(): void {
    CATEGORIES.forEach((cat, i) => {
      if (!this.categoryBgs[i]) return;
      const isSelected = cat.id === this.selectedCategory;
      this.categoryBgs[i].setFillStyle(isSelected ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.9);
      this.categoryBgs[i].setStrokeStyle(isSelected ? 2 : 1, isSelected ? THEME.AMBER : THEME.STROKE_DIM, isSelected ? 0.9 : 0.5);
      this.categoryIcons[i].setColor(isSelected ? THEME.TEXT_AMBER : THEME.TEXT_MED);
      this.categoryTexts[i].setColor(isSelected ? THEME.TEXT_AMBER : THEME.TEXT_MED);
    });
  }

  private refreshOptions(): void {
    this.refreshCategories();
    // Clear old options
    this.optionElements.forEach(e => { if (e.bg.active) e.bg.destroy(); if (e.text.active) e.text.destroy(); });
    // Remove old option nav elements (keep categories + back)
    const numCats = CATEGORIES.length;
    const numKeep = numCats + 1;
    const removed = this.navElements.splice(numKeep);
    removed.forEach(el => { /* destroyed above */ });
    this.optionElements = [];
    this.sliders = [];

    const isFa = getLocale() === 'fa';
    const rightX = 590, rightY = 280, rightW = 580;
    const optStartY = rightY - 130;

    if (this.selectedCategory === 'audio') {
      this.makeSlider(rightX, optStartY, isFa ? 'صدای اصلی' : 'Master Volume', AudioSystem.getMasterVolume(), (v) => { AudioSystem.setMasterVolume(v); SaveSystem.saveSettings({ masterVolume: v }); });
      this.makeSlider(rightX, optStartY + 70, isFa ? 'صدای افکت' : 'SFX Volume', AudioSystem.getSfxVolume(), (v) => { AudioSystem.setSfxVolume(v); SaveSystem.saveSettings({ sfxVolume: v }); });
    } else if (this.selectedCategory === 'display') {
      this.makeSlider(rightX, optStartY, t('settings.brightness'), RenderSystem.getBrightness(), (v) => { RenderSystem.setBrightness(v); SaveSystem.saveSettings({ brightness: v }); });
    } else if (this.selectedCategory === 'language') {
      this.makeLanguageToggle(rightX, optStartY);
    }
  }

  private makeSlider(x: number, y: number, label: string, value: number, onChange: (v: number) => void): void {
    const isFa = getLocale() === 'fa';
    const labelEl = this.scene.add.text(x - 240, y, label, {
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_BRIGHT,
    }).setOrigin(0, 0.5);
    // Track
    const track = this.scene.add.rectangle(x, y, 300, 8, THEME.BG_DARK, 1).setStrokeStyle(1, THEME.STROKE_DIM, 1);
    track.setOrigin(0.5);
    const fill = this.scene.add.rectangle(x - 150, y, 300 * value, 8, THEME.AMBER).setOrigin(0, 0.5);
    const handle = this.scene.add.circle(x - 150 + 300 * value, y, 10, THEME.AMBER).setStrokeStyle(2, 0xffffff, 0.4);
    // Value text
    const valueText = this.scene.add.text(x + 170, y, `${Math.round(value * 100)}%`, {
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5);

    handle.setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(handle);
    handle.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => {
      const clamped = Phaser.Math.Clamp(dragX, x - 150, x + 150);
      handle.x = clamped;
      const v = (clamped - (x - 150)) / 300;
      fill.setDisplaySize(300 * v, 8);
      valueText.setText(`${Math.round(v * 100)}%`);
      onChange(v);
    });
    // Click on track
    const sliderBg = this.scene.add.rectangle(x, y, 320, 24, 0x000000, 0);
    sliderBg.setInteractive({ useHandCursor: true });
    sliderBg.on('pointerdown', (_p: Phaser.Input.Pointer, localX: number) => {
      const v = Phaser.Math.Clamp((localX + 150) / 300, 0, 1);
      handle.x = x - 150 + 300 * v;
      fill.setDisplaySize(300 * v, 8);
      valueText.setText(`${Math.round(v * 100)}%`);
      onChange(v);
    });

    this.optionsContainer.add([labelEl, track, fill, handle, valueText, sliderBg]);

    const slider: Slider = { bg: sliderBg, text: labelEl, handle, fill, valueText, value, onChange };
    this.sliders.push(slider);
    // Insert before back button
    const backIdx = this.navElements.length - 1;
    this.navElements.splice(backIdx, 0, {
      bg: sliderBg,
      text: labelEl,
      onSelect: () => { /* use L/R */ },
    });
  }

  private makeLanguageToggle(x: number, y: number): void {
    const isFa = getLocale() === 'fa';
    const currentLang = getLocale();
    const labelEl = this.scene.add.text(x - 240, y, isFa ? 'زبان' : 'Language', {
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_BRIGHT,
    }).setOrigin(0, 0.5);
    this.optionsContainer.add(labelEl);

    const enBg = this.scene.add.rectangle(x - 60, y, 120, 36, currentLang === 'en' ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.95)
      .setStrokeStyle(1, currentLang === 'en' ? THEME.AMBER : THEME.STROKE_DIM, currentLang === 'en' ? 0.9 : 0.5);
    const enText = this.scene.add.text(x - 60, y, 'EN', {
      fontFamily: 'monospace', fontSize: '14px', color: currentLang === 'en' ? THEME.TEXT_AMBER : THEME.TEXT_MED,
    }).setOrigin(0.5);
    const faBg = this.scene.add.rectangle(x + 80, y, 120, 36, currentLang === 'fa' ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.95)
      .setStrokeStyle(1, currentLang === 'fa' ? THEME.AMBER : THEME.STROKE_DIM, currentLang === 'fa' ? 0.9 : 0.5);
    const faText = this.scene.add.text(x + 80, y, 'فارسی', {
      fontFamily: 'monospace', fontSize: '14px', color: currentLang === 'fa' ? THEME.TEXT_AMBER : THEME.TEXT_MED,
    }).setOrigin(0.5);
    this.optionsContainer.add([enBg, enText, faBg, faText]);

    const switchLang = (locale: Locale) => {
      setLocale(locale);
      SaveSystem.saveSettings({ locale });
      AudioSystem.play('uiClick');
      this.scene.scene.restart();
    };
    // Insert before back button
    const backIdx = this.navElements.length - 1;
    this.navElements.splice(backIdx, 0, { bg: enBg, text: enText, onSelect: () => switchLang('en') });
    this.navElements.splice(backIdx, 0, { bg: faBg, text: faText, onSelect: () => switchLang('fa') });
  }

  protected onNavLeft(): void {
    const el = this.navElements[this.navFocusIdx];
    const slider = this.sliders.find(s => s.bg === el?.bg);
    if (slider) {
      slider.value = Math.max(0, slider.value - 0.05);
      slider.onChange(slider.value);
      slider.handle.x = slider.bg.x - 150 + 300 * slider.value;
      slider.fill.setDisplaySize(300 * slider.value, 8);
      slider.valueText.setText(`${Math.round(slider.value * 100)}%`);
      AudioSystem.play('uiHover');
    }
  }

  protected onNavRight(): void {
    const el = this.navElements[this.navFocusIdx];
    const slider = this.sliders.find(s => s.bg === el?.bg);
    if (slider) {
      slider.value = Math.min(1, slider.value + 0.05);
      slider.onChange(slider.value);
      slider.handle.x = slider.bg.x - 150 + 300 * slider.value;
      slider.fill.setDisplaySize(300 * slider.value, 8);
      slider.valueText.setText(`${Math.round(slider.value * 100)}%`);
      AudioSystem.play('uiHover');
    }
  }
}

export default SettingsUI;
