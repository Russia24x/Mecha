/**
 * MECHA: LAST PROTOCOL — Settings UI v5.1
 *
 * FIX: Options now properly cleared when switching categories.
 * All option elements (track, fill, handle, valueText) tracked and destroyed.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, setLocale, getLocale, fixTextStyle } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { RenderSystem } from '../../systems/RenderSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import { THEME, addCornerBrackets, addScanlines } from '../Theme';
import { QualityManager, type QualityLevel } from '../../systems/QualityManager';
import { FullscreenManager } from '../../systems/FullscreenManager';
import type { Locale } from '../../data/types';

type CategoryId = 'audio' | 'display' | 'language';

const CATEGORIES: { id: CategoryId; icon: string; en: string; fa: string }[] = [
  { id: 'audio', icon: '⚙', en: 'AUDIO', fa: 'صدا' },
  { id: 'display', icon: '▣', en: 'DISPLAY', fa: 'نمایشگر' },
  { id: 'language', icon: '⌬', en: 'LANGUAGE', fa: 'زبان' },
];

interface OptionElement {
  objects: Phaser.GameObjects.GameObject[];
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  onSelect: () => void;
}

export class SettingsUI extends NavigableOverlay {
  private categoryBgs: Phaser.GameObjects.Rectangle[] = [];
  private categoryTexts: Phaser.GameObjects.Text[] = [];
  private categoryIcons: Phaser.GameObjects.Text[] = [];
  private selectedCategory: CategoryId = 'audio';
  private optionElements: OptionElement[] = [];

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
    this.container.add(scene.add.text(w / 2, 45, isFa ? '▮ پیکربندی سیستم ▮' : '▮ SYSTEM CONFIG ▮', fixTextStyle({
      fontFamily: 'monospace', fontSize: '20px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 5, letterSpacing: 3,
    })).setOrigin(0.5));

    // Left panel: category list
    const leftX = 140, leftY = 280, leftW = 220, leftH = 360;
    const leftBg = scene.add.rectangle(leftX, leftY, leftW, leftH, THEME.BG_PANEL, 0.85);
    leftBg.setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
    this.container.add(leftBg);
    this.container.add(addCornerBrackets(scene, leftX, leftY, leftW, leftH, THEME.CYAN, 8, 0.5));
    this.container.add(scene.add.text(leftX, leftY - leftH / 2 + 18, isFa ? 'بخش‌ها' : 'CATEGORIES', fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_AMBER, letterSpacing: 2,
    })).setOrigin(0.5));

    // Categories
    CATEGORIES.forEach((cat) => {
      const i = CATEGORIES.indexOf(cat);
      const cy = leftY - leftH / 2 + 60 + i * 80;
      const bg = scene.add.rectangle(leftX, cy, leftW - 20, 60, THEME.BG_PANEL, 0.9);
      bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
      this.container.add(scene.add.rectangle(leftX - leftW / 2 + 12, cy, 3, 48, THEME.AMBER, 0.3));
      const icon = scene.add.text(leftX - 60, cy, cat.icon, fixTextStyle({
        fontFamily: 'monospace', fontSize: '22px', color: THEME.TEXT_MED,
      })).setOrigin(0.5);
      const label = scene.add.text(leftX + 20, cy, isFa ? cat.fa : cat.en, fixTextStyle({
        fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_MED, letterSpacing: 1,
      })).setOrigin(0.5);
      this.container.add([bg, icon, label]);
      this.categoryBgs.push(bg);
      this.categoryTexts.push(label);
      this.categoryIcons.push(icon);
      this.registerNav(bg, label, () => {
        this.selectedCategory = cat.id;
        this.refreshOptions();
        AudioSystem.play('uiClick');
      });
    });

    // Register categories as tabs for L1/R1 switching
    this.getController()?.addTabs(CATEGORIES.map(cat => ({
      id: cat.id, label: cat.en,
      onSelect: () => { this.selectedCategory = cat.id; this.refreshOptions(); AudioSystem.play('uiClick'); },
    })));

    // Right panel: options
    const rightX = 590, rightY = 280, rightW = 580, rightH = 360;
    const rightBg = scene.add.rectangle(rightX, rightY, rightW, rightH, THEME.BG_PANEL, 0.6);
    rightBg.setStrokeStyle(1, THEME.CYAN, 0.4);
    this.container.add(rightBg);
    this.container.add(addCornerBrackets(scene, rightX, rightY, rightW, rightH, THEME.CYAN, 8, 0.5));
    this.container.add(scene.add.text(rightX, rightY - rightH / 2 + 18, isFa ? 'گزینه‌ها' : 'OPTIONS', fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_AMBER, letterSpacing: 2,
    })).setOrigin(0.5));

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 30, 220, 40, THEME.BG_PANEL, 0.95);
    bg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(addCornerBrackets(scene, w / 2, h - 30, 220, 40, THEME.CYAN, 6, 0.5));
    const textEl = scene.add.text(w / 2, h - 30, isFa ? '▲ خروج' : '▲ DISENGAGE', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    })).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); onBack(); });

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
    // Sync UIController tab index
    const catIdx = CATEGORIES.findIndex(c => c.id === this.selectedCategory);
    this.getController()?.setCurrentTab(catIdx >= 0 ? catIdx : 0);
    this.refreshCategories();
    // *** FIX: destroy ALL option objects (was only destroying bg + text)
    this.optionElements.forEach(e => {
      e.objects.forEach(o => { if (o && o.active) o.destroy(); });
    });
    // Remove old option nav elements (keep categories + back)
    const numCats = CATEGORIES.length;
    const numKeep = numCats + 1; // categories + back
    this.navElements.splice(numKeep);
    this.optionElements = [];

    const isFa = getLocale() === 'fa';
    const rightX = 590, rightY = 280;
    const optStartY = rightY - 130;

    if (this.selectedCategory === 'audio') {
      this.makeSlider(rightX, optStartY, isFa ? 'صدای اصلی' : 'Master Volume', AudioSystem.getMasterVolume(),
        (v) => { AudioSystem.setMasterVolume(v); SaveSystem.saveSettings({ masterVolume: v }); });
      this.makeSlider(rightX, optStartY + 70, isFa ? 'صدای افکت' : 'SFX Volume', AudioSystem.getSfxVolume(),
        (v) => { AudioSystem.setSfxVolume(v); SaveSystem.saveSettings({ sfxVolume: v }); });
    } else if (this.selectedCategory === 'display') {
      this.makeSlider(rightX, optStartY, t('settings.brightness'), RenderSystem.getBrightness(),
        (v) => { RenderSystem.setBrightness(v); SaveSystem.saveSettings({ brightness: v }); });
      // ── Fullscreen toggle (browser fullscreen + canvas fill) ──
      const savedFullscreen = SaveSystem.getSettings().fullscreen ?? false;
      const setFullscreenVisual = this.makeToggle(rightX, optStartY + 50, isFa ? 'تمام صفحه' : 'FULLSCREEN',
        FullscreenManager.isActive() || savedFullscreen,
        (on) => {
          // FullscreenManager.toggle() handles browser fullscreen + canvas resize.
          // We don't call startFullscreen/stopFullscreen directly because those
          // only fullscreen the Phaser canvas, not the browser window.
          if (on) {
            FullscreenManager.enter();
          } else {
            FullscreenManager.exit();
          }
          SaveSystem.saveSettings({ fullscreen: on });
        });
      // Sync toggle visual when fullscreen state changes externally
      // (e.g. user presses ESC or F11 to exit fullscreen)
      FullscreenManager.onChange((active) => {
        setFullscreenVisual(active);
      });
      // ── Resolution selector (data-driven, not hardcoded) ──
      const resolutions = this.getAvailableResolutions();
      const currentRes = `${this.scene.scale.width}x${this.scene.scale.height}`;
      this.makeSelector(rightX, optStartY + 100, isFa ? 'رزولوشن' : 'RESOLUTION',
        resolutions.map(r => r.label),
        resolutions.findIndex(r => r.label === currentRes) >= 0 ? resolutions.findIndex(r => r.label === currentRes) : 0,
        (idx) => {
          const res = resolutions[idx];
          if (res) {
            // Phaser Scale.FIT mode: resize the parent container CSS size
            // The game always renders at 1280x720 internally, browser scales canvas
            const canvas = this.scene.scale.canvas;
            if (canvas) {
              canvas.style.width = res.w + 'px';
              canvas.style.height = res.h + 'px';
            }
            this.scene.scale.refresh();
          }
        });
      // ── Render quality — actually changes game behavior ──
      const savedQuality = (SaveSystem.getSettings().quality ?? 'high') as QualityLevel;
      const qualityIdx = savedQuality === 'low' ? 0 : savedQuality === 'medium' ? 1 : 2;
      const qualityOptions = [isFa ? 'کم' : 'LOW', isFa ? 'متوسط' : 'MEDIUM', isFa ? 'بالا' : 'HIGH'];
      this.makeSelector(rightX, optStartY + 150, isFa ? 'کیفیت' : 'QUALITY',
        qualityOptions, qualityIdx, (idx) => {
          const level: QualityLevel = idx === 0 ? 'low' : idx === 1 ? 'medium' : 'high';
          QualityManager.setQuality(level);
          SaveSystem.saveSettings({ quality: level });
          // Adjust FPS target
          this.scene.game.loop.targetFps = QualityManager.getFpsTarget();
        });
    } else if (this.selectedCategory === 'language') {
      this.makeLanguageToggle(rightX, optStartY);
    }
  }

  private makeSlider(x: number, y: number, label: string, value: number, onChange: (v: number) => void): void {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const labelEl = this.scene.add.text(x - 240, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_BRIGHT,
    })).setOrigin(0, 0.5);
    objects.push(labelEl);
    const track = this.scene.add.rectangle(x, y, 300, 8, THEME.BG_DARK, 1).setStrokeStyle(1, THEME.STROKE_DIM, 1);
    track.setOrigin(0.5);
    objects.push(track);
    const fill = this.scene.add.rectangle(x - 150, y, 300 * value, 8, THEME.AMBER).setOrigin(0, 0.5);
    objects.push(fill);
    const handle = this.scene.add.circle(x - 150 + 300 * value, y, 10, THEME.AMBER).setStrokeStyle(2, 0xffffff, 0.4);
    objects.push(handle);
    const valueText = this.scene.add.text(x + 170, y, `${Math.round(value * 100)}%`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 2,
    })).setOrigin(0, 0.5);
    objects.push(valueText);

    // Slider hit area
    const sliderBg = this.scene.add.rectangle(x, y, 320, 24, 0x000000, 0);
    objects.push(sliderBg);

    // Handle: draggable (manual — slider-specific behavior)
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

    this.container.add(objects);

    // Register sliderBg via registerNav (handles setInteractive + ctrl.addButton)
    // onSelect = click-to-jump (same as pointerdown behavior)
    const backIdx = this.navElements.length - 1;
    this.registerNav(sliderBg, labelEl, () => {
      // A button on slider = nudge by 5%
      let v = parseFloat(valueText.text) / 100;
      v = Math.min(1, v + 0.05);
      handle.x = x - 150 + 300 * v;
      fill.setDisplaySize(300 * v, 8);
      valueText.setText(`${Math.round(v * 100)}%`);
      onChange(v);
    }, { insertAt: backIdx });
    // Add click-to-jump on sliderBg (complements registerNav's pointerdown)
    sliderBg.on('pointerdown', (_p: Phaser.Input.Pointer, localX: number) => {
      const v = Phaser.Math.Clamp((localX + 150) / 300, 0, 1);
      handle.x = x - 150 + 300 * v;
      fill.setDisplaySize(300 * v, 8);
      valueText.setText(`${Math.round(v * 100)}%`);
      onChange(v);
    });
    this.optionElements.push({ objects, bg: sliderBg, text: labelEl, onSelect: () => {} });
  }

  /** Get available resolutions dynamically from the screen. */
  private getAvailableResolutions(): { w: number; h: number; label: string }[] {
    const screenW = window.screen?.width ?? 1920;
    const screenH = window.screen?.height ?? 1080;
    const res: { w: number; h: number; label: string }[] = [];
    // Common resolutions up to screen size
    const common = [
      { w: 1280, h: 720, label: '1280x720' },
      { w: 1366, h: 768, label: '1366x768' },
      { w: 1600, h: 900, label: '1600x900' },
      { w: 1920, h: 1080, label: '1920x1080' },
      { w: 2560, h: 1440, label: '2560x1440' },
    ];
    for (const r of common) {
      if (r.w <= screenW && r.h <= screenH) {
        res.push(r);
      }
    }
    // Always include current
    const cur = `${this.scene.scale.width}x${this.scene.scale.height}`;
    if (!res.find(r => r.label === cur)) {
      res.unshift({ w: this.scene.scale.width, h: this.scene.scale.height, label: cur });
    }
    return res;
  }

  /** Toggle switch (on/off). */
  private makeToggle(x: number, y: number, label: string, isOn: boolean, onToggle: (on: boolean) => void): (on: boolean) => void {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const labelEl = this.scene.add.text(x - 240, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_BRIGHT,
    })).setOrigin(0, 0.5);
    objects.push(labelEl);
    let state = isOn;
    const bg = this.scene.add.rectangle(x + 100, y, 60, 24, state ? 0x0d2818 : 0x280d0d, 0.95);
    bg.setStrokeStyle(1, state ? 0x40d070 : 0xff4040, 0.8);
    objects.push(bg);
    const knob = this.scene.add.circle(x + 100 + (state ? 18 : -18), y, 8, state ? 0x40d070 : 0xff4040);
    objects.push(knob);
    const stateText = this.scene.add.text(x + 170, y, state ? 'ON' : 'OFF', fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: state ? '#40d070' : '#ff4040',
    })).setOrigin(0, 0.5);
    objects.push(stateText);

    /** Update visual state without triggering onToggle (for external sync). */
    const setVisualState = (on: boolean): void => {
      state = on;
      if (!bg.active) return;
      bg.setFillStyle(state ? 0x0d2818 : 0x280d0d, 0.95);
      bg.setStrokeStyle(1, state ? 0x40d070 : 0xff4040, 0.8);
      knob.setPosition(x + 100 + (state ? 18 : -18), y);
      knob.setFillStyle(state ? 0x40d070 : 0xff4040);
      stateText.setText(state ? 'ON' : 'OFF');
      stateText.setColor(state ? '#40d070' : '#ff4040');
    };

    // Register via registerNav (handles setInteractive + ctrl.addButton)
    this.registerNav(bg, labelEl, () => {
      setVisualState(!state);
      onToggle(state);
    });
    this.optionElements.push({ objects, bg, text: labelEl, onSelect: () => {} });
    this.container.add(objects);
    return setVisualState;
  }

  /** Selector (dropdown-like, cycles through options on click). */
  private makeSelector(x: number, y: number, label: string, options: string[], currentIdx: number, onSelect: (idx: number) => void): void {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const labelEl = this.scene.add.text(x - 240, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_BRIGHT,
    })).setOrigin(0, 0.5);
    objects.push(labelEl);
    let idx = currentIdx;
    const bg = this.scene.add.rectangle(x + 100, y, 120, 24, 0x0a1018, 0.95);
    bg.setStrokeStyle(1, 0x1a3040, 0.7);
    objects.push(bg);
    const valueText = this.scene.add.text(x + 100, y, options[idx] || '--', fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_AMBER,
    })).setOrigin(0.5);
    objects.push(valueText);
    const arrowL = this.scene.add.text(x + 50, y, '◀', {
      fontFamily: 'monospace', fontSize: '8px', color: '#3a4350',
    }).setOrigin(0.5);
    const arrowR = this.scene.add.text(x + 150, y, '▶', {
      fontFamily: 'monospace', fontSize: '8px', color: '#3a4350',
    }).setOrigin(0.5);
    objects.push(arrowL, arrowR);
    // Register via registerNav (handles setInteractive + ctrl.addButton)
    this.registerNav(bg, labelEl, () => {
      idx = (idx + 1) % options.length;
      valueText.setText(options[idx]);
      onSelect(idx);
    });
    this.optionElements.push({ objects, bg, text: labelEl, onSelect: () => {} });
    this.container.add(objects);
  }

  private makeLanguageToggle(x: number, y: number): void {
    const isFa = getLocale() === 'fa';
    const currentLang = getLocale();
    const objects: Phaser.GameObjects.GameObject[] = [];

    const labelEl = this.scene.add.text(x - 240, y, isFa ? 'زبان' : 'Language', fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_BRIGHT,
    })).setOrigin(0, 0.5);
    objects.push(labelEl);

    const enBg = this.scene.add.rectangle(x - 60, y, 120, 36, currentLang === 'en' ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.95)
      .setStrokeStyle(1, currentLang === 'en' ? THEME.AMBER : THEME.STROKE_DIM, currentLang === 'en' ? 0.9 : 0.5);
    objects.push(enBg);
    const enText = this.scene.add.text(x - 60, y, 'EN', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: currentLang === 'en' ? THEME.TEXT_AMBER : THEME.TEXT_MED,
    })).setOrigin(0.5);
    objects.push(enText);
    const faBg = this.scene.add.rectangle(x + 80, y, 120, 36, currentLang === 'fa' ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.95)
      .setStrokeStyle(1, currentLang === 'fa' ? THEME.AMBER : THEME.STROKE_DIM, currentLang === 'fa' ? 0.9 : 0.5);
    objects.push(faBg);
    const faText = this.scene.add.text(x + 80, y, 'فارسی', fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: currentLang === 'fa' ? THEME.TEXT_AMBER : THEME.TEXT_MED,
    })).setOrigin(0.5);
    objects.push(faText);

    this.container.add(objects);

    const switchLang = (locale: Locale) => {
      setLocale(locale);
      SaveSystem.saveSettings({ locale });
      AudioSystem.play('uiClick');
      this.scene.scene.restart();
    };
    // Register via registerNav (handles setInteractive + ctrl.addButton)
    const backIdx = this.navElements.length - 1;
    this.registerNav(enBg, enText, () => { if (currentLang !== 'en') switchLang('en'); }, { insertAt: backIdx });
    this.registerNav(faBg, faText, () => { if (currentLang !== 'fa') switchLang('fa'); }, { insertAt: backIdx });
    this.optionElements.push({ objects, bg: enBg, text: enText, onSelect: () => {} });
  }

  protected onNavLeft(): void {
    const el = this.navElements[this.navFocusIdx];
    // Find slider by checking if its bg is a slider hit area
    for (const opt of this.optionElements) {
      if (opt.bg === el?.bg && opt.objects.length > 4) {
        // It's a slider (has track, fill, handle, valueText)
        const handle = opt.objects[3] as Phaser.GameObjects.Arc;
        const fill = opt.objects[2] as Phaser.GameObjects.Rectangle;
        const valueText = opt.objects[4] as Phaser.GameObjects.Text;
        const trackX = (opt.objects[1] as Phaser.GameObjects.Rectangle).x;
        let value = parseFloat(valueText.text) / 100;
        value = Math.max(0, value - 0.05);
        handle.x = trackX - 150 + 300 * value;
        fill.setDisplaySize(300 * value, 8);
        valueText.setText(`${Math.round(value * 100)}%`);
        AudioSystem.play('uiHover');
        return;
      }
    }
  }

  protected onNavRight(): void {
    const el = this.navElements[this.navFocusIdx];
    for (const opt of this.optionElements) {
      if (opt.bg === el?.bg && opt.objects.length > 4) {
        const handle = opt.objects[3] as Phaser.GameObjects.Arc;
        const fill = opt.objects[2] as Phaser.GameObjects.Rectangle;
        const valueText = opt.objects[4] as Phaser.GameObjects.Text;
        const trackX = (opt.objects[1] as Phaser.GameObjects.Rectangle).x;
        let value = parseFloat(valueText.text) / 100;
        value = Math.min(1, value + 0.05);
        handle.x = trackX - 150 + 300 * value;
        fill.setDisplaySize(300 * value, 8);
        valueText.setText(`${Math.round(value * 100)}%`);
        AudioSystem.play('uiHover');
        return;
      }
    }
  }
}

export default SettingsUI;
