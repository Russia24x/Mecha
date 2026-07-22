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
import { InputSystem } from '../../systems/InputSystem';
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
  private fullscreenUnsub: (() => void) | null = null;  // N5 fix: track listener for cleanup

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
      // Categories are clickable (mouse) but NOT in the focusable list.
      // D-pad up/down navigates between sliders only; L1/R1 switches categories.
      // This prevents the "D-pad stuck on categories, can't reach sliders" issue.
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        AudioSystem.play('uiHover');
      });
      bg.on('pointerdown', () => {
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
    // Clean up slider pointerdown listeners BEFORE destroying objects
    // (otherwise destroyed valueText/handle cause 'null glTexture' errors)
    const cleanups = (this as unknown as { _sliderCleanups?: Array<() => void> })._sliderCleanups;
    if (cleanups) { cleanups.forEach(c => c()); (this as unknown as { _sliderCleanups?: Array<() => void> })._sliderCleanups = []; }
    // *** FIX: destroy ALL option objects (was only destroying bg + text)
    this.optionElements.forEach(e => {
      e.objects.forEach(o => { if (o && o.active) o.destroy(); });
    });
    // Remove old option nav elements (keep only back button — categories
    // are no longer in the focusable list, they're tab-only now)
    const numKeep = 1; // back button only
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
      // N5 fix: store unsubscribe function for cleanup in destroy()
      if (this.fullscreenUnsub) this.fullscreenUnsub();  // remove previous if refreshOptions called again
      this.fullscreenUnsub = FullscreenManager.onChange((active) => {
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

    // After rebuilding options, focus the first slider/option so D-pad
    // navigation starts from the top of the options list (not back button).
    // focusables order: [back, slider1, slider2, ...] (back is registered first)
    // So index 1 = first slider.
    const ctrl = this.getController();
    if (ctrl) {
      (ctrl as unknown as { focusIndex: number }).focusIndex = 1;
      (ctrl as unknown as { updateFocusVisual: () => void }).updateFocusVisual?.();
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

    // Slider hit area — use alpha=0.01 (not 0) to ensure hit-test works.
    // Some Phaser versions skip hit-test for alpha=0 objects.
    // Width 340 (slightly wider than track 300) for easier clicking.
    const sliderBg = this.scene.add.rectangle(x, y, 340, 36, 0x000000, 0.01);
    sliderBg.setInteractive({ useHandCursor: true });
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

    // Store slider control data on sliderBg for gamepad navigation.
    // handleNavigation() reads this to adjust value with left/right stick.
    const sliderData = {
      getValue: () => parseFloat(valueText.text) / 100,
      setValue: (v: number) => {
        const clamped = Phaser.Math.Clamp(v, 0, 1);
        handle.x = x - 150 + 300 * clamped;
        fill.setDisplaySize(300 * clamped, 8);
        valueText.setText(`${Math.round(clamped * 100)}%`);
        onChange(clamped);
      },
    };
    sliderBg.setData('sliderData', sliderData);

    // Gamepad slider control: check every frame if this slider is focused
    // and left/right stick is held. This runs via scene.events.on('preupdate')
    // because OverlayManager calls ctrl.update() directly (not handleNavigation).
    const preUpdateHandler = () => {
      // Guard: if slider objects destroyed, remove listener
      if (!valueText.active || !handle.active) {
        this.scene.events.off('preupdate', preUpdateHandler);
        return;
      }
      const ctrl = this.getController();
      if (!ctrl || ctrl.isVisible) return; // Skip in cursor mode

      // Check if THIS slider is the focused element
      const focusables = (ctrl as unknown as { focusables: Array<{ bg: Phaser.GameObjects.Shape }> }).focusables;
      const focusIndex = (ctrl as unknown as { focusIndex: number }).focusIndex;
      const currentFocus = focusables?.[focusIndex];

      const input = InputSystem.getState();
      const leftStickActive = input.leftStickX < -0.3 || input.leftStickX > 0.3;
      if (leftStickActive) {
        console.log('[Slider] preUpdateHandler: leftStickX=', input.leftStickX.toFixed(2),
          '| focusIndex=', focusIndex,
          '| focusMatch=', currentFocus?.bg === sliderBg,
          '| focusables.length=', focusables?.length);
      }

      if (currentFocus?.bg !== sliderBg) return; // Not focused on this slider

      const leftStickX = input.leftStickX;
      const heldLeft = input.heldLeft;
      const heldRight = input.heldRight;

      if (heldLeft || leftStickX < -0.3) {
        const newV = Math.max(0, sliderData.getValue() - 0.02);
        sliderData.setValue(newV);
      } else if (heldRight || leftStickX > 0.3) {
        const newV = Math.min(1, sliderData.getValue() + 0.02);
        sliderData.setValue(newV);
      }
    };
    this.scene.events.on('preupdate', preUpdateHandler);
    // Store cleanup for this listener too
    (this as unknown as { _sliderCleanups?: Array<() => void> })._sliderCleanups ??= [];
    (this as unknown as { _sliderCleanups: Array<() => void> })._sliderCleanups.push(() => {
      this.scene.events.off('preupdate', preUpdateHandler);
    });

    // Slider: register with UIController for D-pad focus + A button nudge.
    // registerNav wires setInteractive + pointerover + pointerdown (plays uiClick + onSelect).
    // For mouse click, we need click-to-jump (localX) — so we override pointerdown
    // AFTER registerNav to replace the generic onSelect with click-to-jump.
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

    // Override pointerdown: click-to-jump on slider track.
    // We use scene.input.on('pointerdown') instead of sliderBg.on('pointerdown')
    // because the UIController's hit-test may not reliably detect the transparent
    // sliderBg in all cases. This approach checks if the click is within the
    // slider's bounds and handles it directly.
    const clickToJump = (pointer: Phaser.Input.Pointer) => {
      // Guard: if any slider object is destroyed, skip (prevents null glTexture error)
      if (!valueText.active || !handle.active || !fill.active) return;
      // Check if pointer is within slider hit area (340x36 centered at x,y)
      const px = pointer.x;
      const py = pointer.y;
      if (px < x - 170 || px > x + 170 || py < y - 18 || py > y + 18) {
        return; // Not on this slider
      }
      AudioSystem.play('uiClick');
      const relX = px - (x - 150);
      const v = Phaser.Math.Clamp(relX / 300, 0, 1);
      handle.x = x - 150 + 300 * v;
      fill.setDisplaySize(300 * v, 8);
      valueText.setText(`${Math.round(v * 100)}%`);
      onChange(v);
    };
    // Register on scene input — will be cleaned up when overlay closes
    this.scene.input.on('pointerdown', clickToJump);
    // Also register on sliderBg for cursor-mode A-button clicks (UIController
    // emits 'pointerdown' on the hovered object when A is pressed in cursor mode).
    // We need to handle the case where pointer/localX may be undefined.
    sliderBg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Guard: if any slider object is destroyed, skip
      if (!valueText.active || !handle.active || !fill.active) return;
      // Use pointer world position (cursor position in cursor mode)
      const px = p?.x ?? (this.scene.input.activePointer?.x ?? x);
      AudioSystem.play('uiClick');
      const relX = px - (x - 150);
      const v = Phaser.Math.Clamp(relX / 300, 0, 1);
      handle.x = x - 150 + 300 * v;
      fill.setDisplaySize(300 * v, 8);
      valueText.setText(`${Math.round(v * 100)}%`);
      onChange(v);
    });
    // Store cleanup reference so we can remove it when overlay closes
    (this as unknown as { _sliderCleanups?: Array<() => void> })._sliderCleanups ??= [];
    (this as unknown as { _sliderCleanups: Array<() => void> })._sliderCleanups.push(() => {
      this.scene.input.off('pointerdown', clickToJump);
    });

    // Also enable drag on the sliderBg (so dragging anywhere on the track works,
    // not just on the small handle)
    this.scene.input.setDraggable(sliderBg);
    sliderBg.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => {
      const clamped = Phaser.Math.Clamp(dragX, x - 150, x + 150);
      handle.x = clamped;
      const v = (clamped - (x - 150)) / 300;
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
      if (valueText && valueText.active) { try { valueText.setText(options[idx]); } catch { /* destroyed */ } }
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

  // onNavLeft/onNavRight removed — UIController handles L1/R1 tab switching
  // and slider nudge via addButton onSelect (A button = nudge 5%)

  /**
   * Override handleNavigation to add gamepad slider control.
   * Note: OverlayManager calls ctrl.update() directly, not handleNavigation().
   * So this method is NOT called by OverlayManager. Instead, slider gamepad
   * control is handled via scene.events.on('preupdate') in makeSlider().
   *
   * Kept for backward compat (in case any code calls handleNavigation directly).
   */
  handleNavigation(): void {
    super.handleNavigation();
  }

  destroy(): void {
    // N5 fix: unsubscribe from FullscreenManager before destroying
    if (this.fullscreenUnsub) { this.fullscreenUnsub(); this.fullscreenUnsub = null; }
    // Clean up slider pointerdown listeners
    const cleanups = (this as unknown as { _sliderCleanups?: Array<() => void> })._sliderCleanups;
    if (cleanups) { cleanups.forEach(c => c()); (this as unknown as { _sliderCleanups?: Array<() => void> })._sliderCleanups = []; }
    super.destroy();
  }
}

export default SettingsUI;
