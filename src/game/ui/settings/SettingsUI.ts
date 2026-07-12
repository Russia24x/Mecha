/**
 * MECHA: LAST PROTOCOL — Settings UI v4.0
 *
 * REDESIGNED: "SYSTEM CONFIG" — Mecha system configuration.
 * Inspired by Armored Core 6 (system settings) + Blasphemous (dark panels).
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
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}

export class SettingsUI extends NavigableOverlay {
  private sliders: Slider[] = [];
  private langEnBtn?: Phaser.GameObjects.Rectangle;
  private langFaBtn?: Phaser.GameObjects.Rectangle;
  private backBtn?: Phaser.GameObjects.Rectangle;
  private backText?: Phaser.GameObjects.Text;

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

    let y = 110;
    // Audio section
    this.container.add(scene.add.text(w / 2 - 280, y, isFa ? '▼ صدا' : '▼ AUDIO', {
      fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_MED, letterSpacing: 2,
    }));
    y += 35;
    this.makeSlider(w / 2, y, t('settings.master_volume'), AudioSystem.getMasterVolume(), (v) => { AudioSystem.setMasterVolume(v); SaveSystem.saveSettings({ masterVolume: v }); }); y += 50;
    this.makeSlider(w / 2, y, t('settings.sfx_volume'), AudioSystem.getSfxVolume(), (v) => { AudioSystem.setSfxVolume(v); SaveSystem.saveSettings({ sfxVolume: v }); }); y += 50;
    y += 20;

    // Brightness
    this.container.add(scene.add.text(w / 2 - 280, y, isFa ? '▼ نمایشگر' : '▼ DISPLAY', {
      fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_MED, letterSpacing: 2,
    }));
    y += 35;
    this.makeSlider(w / 2, y, t('settings.brightness'), RenderSystem.getBrightness(), (v) => { RenderSystem.setBrightness(v); SaveSystem.saveSettings({ brightness: v }); }); y += 50;
    y += 20;

    // Language
    this.container.add(scene.add.text(w / 2 - 280, y, isFa ? '▼ زبان' : '▼ LANGUAGE', {
      fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_MED, letterSpacing: 2,
    }));
    y += 35;
    this.makeLanguageToggle(w / 2, y); y += 50;

    // Back button
    this.backBtn = scene.add.rectangle(w / 2, h - 30, 220, 40, THEME.BG_PANEL, 0.95);
    this.backBtn.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(addCornerBrackets(scene, w / 2, h - 30, 220, 40, THEME.CYAN, 6, 0.5));
    this.backText = scene.add.text(w / 2, h - 30, isFa ? '▲ خروج' : '▲ DISENGAGE', {
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    }).setOrigin(0.5);
    this.container.add([this.backBtn, this.backText]);
    this.registerNav(this.backBtn, this.backText, () => { AudioSystem.play('uiClick'); onBack(); });

    this.container.setScrollFactor(0, 0, true);
  }

  private makeSlider(x: number, y: number, label: string, value: number, onChange: (v: number) => void): void {
    const labelEl = this.scene.add.text(x - 200, y, label, {
      fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_BRIGHT,
    }).setOrigin(0, 0.5);
    const track = this.scene.add.rectangle(x + 20, y, 240, 6, THEME.BG_DARK, 1).setStrokeStyle(1, THEME.STROKE_DIM, 1);
    const fill = this.scene.add.rectangle(x + 20, y, 240 * value, 6, THEME.AMBER).setOrigin(0, 0.5);
    const handle = this.scene.add.circle(x + 20 + 240 * value, y, 9, THEME.AMBER).setStrokeStyle(2, 0xffffff, 0.4);
    handle.setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(handle);
    handle.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => {
      const clamped = Phaser.Math.Clamp(dragX, x + 20, x + 20 + 240);
      handle.x = clamped;
      const v = (clamped - x - 20) / 240;
      fill.setDisplaySize(240 * v, 6);
      onChange(v);
    });
    const sliderBg = this.scene.add.rectangle(x + 20, y, 260, 22, 0x000000, 0);
    sliderBg.setInteractive({ useHandCursor: true });
    sliderBg.on('pointerdown', (_p: Phaser.Input.Pointer, localX: number) => {
      const v = Phaser.Math.Clamp(localX / 240, 0, 1);
      handle.x = x + 20 + 240 * v;
      fill.setDisplaySize(240 * v, 6);
      onChange(v);
    });
    this.container.add([labelEl, track, fill, handle, sliderBg]);

    const slider: Slider = { bg: sliderBg, text: labelEl, handle, fill, value, onChange, min: 0, max: 1 };
    this.sliders.push(slider);
    this.registerNav(sliderBg, labelEl, () => { /* select = no-op, use L/R */ });
  }

  private makeLanguageToggle(x: number, y: number): void {
    const currentLang = getLocale();
    const langLabel = this.scene.add.text(x - 200, y, '', {
      fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_BRIGHT,
    }).setOrigin(0, 0.5);
    this.container.add(langLabel);

    this.langEnBtn = this.scene.add.rectangle(x - 60, y, 100, 32, currentLang === 'en' ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.95)
      .setStrokeStyle(1, currentLang === 'en' ? THEME.AMBER : THEME.STROKE_DIM, currentLang === 'en' ? 0.9 : 0.5);
    const enText = this.scene.add.text(x - 60, y, 'EN', {
      fontFamily: 'monospace', fontSize: '13px', color: currentLang === 'en' ? THEME.TEXT_AMBER : THEME.TEXT_MED,
    }).setOrigin(0.5);

    this.langFaBtn = this.scene.add.rectangle(x + 60, y, 100, 32, currentLang === 'fa' ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.95)
      .setStrokeStyle(1, currentLang === 'fa' ? THEME.AMBER : THEME.STROKE_DIM, currentLang === 'fa' ? 0.9 : 0.5);
    const faText = this.scene.add.text(x + 60, y, 'فارسی', {
      fontFamily: 'monospace', fontSize: '13px', color: currentLang === 'fa' ? THEME.TEXT_AMBER : THEME.TEXT_MED,
    }).setOrigin(0.5);

    this.container.add([this.langEnBtn, enText, this.langFaBtn, faText]);

    const switchLang = (locale: Locale) => {
      setLocale(locale);
      SaveSystem.saveSettings({ locale });
      AudioSystem.play('uiClick');
      this.scene.scene.restart();
    };

    this.registerNav(this.langEnBtn, enText, () => switchLang('en'));
    this.registerNav(this.langFaBtn, faText, () => switchLang('fa'));
  }

  protected onNavLeft(): void {
    const el = this.navElements[this.navFocusIdx];
    const slider = this.sliders.find(s => s.bg === el?.bg);
    if (slider) {
      slider.value = Math.max(0, slider.value - 0.05);
      slider.onChange(slider.value);
      slider.handle.x = slider.bg.x + 240 * slider.value;
      slider.fill.setDisplaySize(240 * slider.value, 6);
      AudioSystem.play('uiHover');
    }
  }

  protected onNavRight(): void {
    const el = this.navElements[this.navFocusIdx];
    const slider = this.sliders.find(s => s.bg === el?.bg);
    if (slider) {
      slider.value = Math.min(1, slider.value + 0.05);
      slider.onChange(slider.value);
      slider.handle.x = slider.bg.x + 240 * slider.value;
      slider.fill.setDisplaySize(240 * slider.value, 6);
      AudioSystem.play('uiHover');
    }
  }
}

export default SettingsUI;
