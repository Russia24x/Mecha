/**
 * MECHA: LAST PROTOCOL — Settings UI v3.2
 * Volume sliders, brightness, language toggle (EN/FA).
 * Full gamepad navigation (up/down to select, left/right to adjust).
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, setLocale, getLocale } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { RenderSystem } from '../../systems/RenderSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { NavigableOverlay } from '../NavigableOverlay';
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

    // Overlay (no setInteractive — would block mouse)
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85);
    this.container.add(overlay);

    this.container.add(scene.add.text(w / 2, 50, t('menu.settings'), {
      fontFamily: 'monospace', fontSize: '32px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    let y = 130;
    this.container.add(scene.add.text(w / 2 - 280, y, t('settings.audio'), { fontFamily: 'monospace', fontSize: '14px', color: '#7a8090' }));
    y += 40;
    this.makeSlider(w / 2, y, t('settings.master_volume'), AudioSystem.getMasterVolume(), (v) => { AudioSystem.setMasterVolume(v); SaveSystem.saveSettings({ masterVolume: v }); }); y += 50;
    this.makeSlider(w / 2, y, t('settings.sfx_volume'), AudioSystem.getSfxVolume(), (v) => { AudioSystem.setSfxVolume(v); SaveSystem.saveSettings({ sfxVolume: v }); }); y += 50;
    y += 20;

    this.container.add(scene.add.text(w / 2 - 280, y, t('settings.brightness'), { fontFamily: 'monospace', fontSize: '14px', color: '#7a8090' }));
    y += 40;
    this.makeSlider(w / 2, y, t('settings.brightness'), RenderSystem.getBrightness(), (v) => { RenderSystem.setBrightness(v); SaveSystem.saveSettings({ brightness: v }); }); y += 50;
    y += 20;

    this.container.add(scene.add.text(w / 2 - 280, y, t('settings.language'), { fontFamily: 'monospace', fontSize: '14px', color: '#7a8090' }));
    y += 40;
    this.makeLanguageToggle(w / 2, y); y += 50;

    // Back button — registered for nav
    this.backBtn = scene.add.rectangle(w / 2, h - 50, 280, 44, 0x1a2030, 0.95);
    this.backBtn.setStrokeStyle(1, 0x39d0d8, 0.6);
    this.backText = scene.add.text(w / 2, h - 50, t('menu.back'), {
      fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0',
    }).setOrigin(0.5);
    this.container.add([this.backBtn, this.backText]);
    this.registerNav(this.backBtn, this.backText, () => { AudioSystem.play('uiClick'); onBack(); });
  }

  private makeSlider(x: number, y: number, label: string, value: number, onChange: (v: number) => void): void {
    const labelEl = this.scene.add.text(x - 200, y, label, { fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0' }).setOrigin(0, 0.5);
    const track = this.scene.add.rectangle(x + 20, y, 240, 8, 0x202830).setStrokeStyle(1, 0x3a4350);
    const fill = this.scene.add.rectangle(x + 20, y, 240 * value, 8, 0x39d0d8).setOrigin(0, 0.5);
    const handle = this.scene.add.circle(x + 20 + 240 * value, y, 10, 0x39d0d8).setStrokeStyle(2, 0xffffff, 0.6);
    handle.setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(handle);
    handle.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => {
      const clamped = Phaser.Math.Clamp(dragX, x + 20, x + 20 + 240);
      handle.x = clamped;
      const v = (clamped - x - 20) / 240;
      fill.width = 240 * v;
      onChange(v);
    });

    // Slider background (clickable to jump)
    const sliderBg = this.scene.add.rectangle(x + 20, y, 260, 24, 0x000000, 0);
    sliderBg.setInteractive({ useHandCursor: true });
    sliderBg.on('pointerdown', (_p: Phaser.Input.Pointer, localX: number) => {
      const v = Phaser.Math.Clamp(localX / 240, 0, 1);
      handle.x = x + 20 + 240 * v;
      fill.width = 240 * v;
      onChange(v);
    });

    this.container.add([labelEl, track, fill, handle, sliderBg]);

    const slider: Slider = { bg: sliderBg, text: labelEl, handle, fill, value, onChange, min: 0, max: 1 };
    this.sliders.push(slider);
    // Register slider for nav — selecting it does nothing (use left/right to adjust)
    this.registerNav(sliderBg, labelEl, () => { /* select = no-op, use L/R */ });
  }

  private makeLanguageToggle(x: number, y: number): void {
    const currentLang = getLocale();
    const langLabel = this.scene.add.text(x - 200, y, '', { fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0' }).setOrigin(0, 0.5);
    this.container.add(langLabel);

    this.langEnBtn = this.scene.add.rectangle(x - 60, y, 100, 32, currentLang === 'en' ? 0x243040 : 0x1a2030, 0.95)
      .setStrokeStyle(1, currentLang === 'en' ? 0x66f0ff : 0x3a4350);
    const enText = this.scene.add.text(x - 60, y, 'EN', {
      fontFamily: 'monospace', fontSize: '13px', color: currentLang === 'en' ? '#66f0ff' : '#cfd6e0',
    }).setOrigin(0.5);

    this.langFaBtn = this.scene.add.rectangle(x + 60, y, 100, 32, currentLang === 'fa' ? 0x243040 : 0x1a2030, 0.95)
      .setStrokeStyle(1, currentLang === 'fa' ? 0x66f0ff : 0x3a4350);
    const faText = this.scene.add.text(x + 60, y, 'فارسی', {
      fontFamily: 'monospace', fontSize: '13px', color: currentLang === 'fa' ? '#66f0ff' : '#cfd6e0',
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

  /** Left/right adjusts the focused slider. */
  protected onNavLeft(): void {
    const el = this.navElements[this.navFocusIdx];
    const slider = this.sliders.find(s => s.bg === el?.bg);
    if (slider) {
      slider.value = Math.max(0, slider.value - 0.05);
      slider.onChange(slider.value);
      slider.handle.x = (slider.bg.x - 120) + 240 * slider.value;
      slider.fill.width = 240 * slider.value;
      AudioSystem.play('uiHover');
    }
  }

  protected onNavRight(): void {
    const el = this.navElements[this.navFocusIdx];
    const slider = this.sliders.find(s => s.bg === el?.bg);
    if (slider) {
      slider.value = Math.min(1, slider.value + 0.05);
      slider.onChange(slider.value);
      slider.handle.x = (slider.bg.x - 120) + 240 * slider.value;
      slider.fill.width = 240 * slider.value;
      AudioSystem.play('uiHover');
    }
  }
}

export default SettingsUI;
