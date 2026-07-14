/**
 * MECHA: LAST PROTOCOL — Hangar UI v4.0
 *
 * Uses UIController for unified navigation (gamepad + keyboard + mouse + touch).
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │  HANGAR                              [EXIT] │
 *   ├─────────────────────────────────────────────┤
 *   │ [CHASSIS] [LOADOUT] [COMPANION] [PAINT]     │
 *   ├──────────────────┬──────────────────────────┤
 *   │   ITEM LIST      │   PREVIEW + STATS        │
 *   │                  │   [SELECT] / [EQUIPPED]  │
 *   └──────────────────┴──────────────────────────┘
 *
 * Navigation (via UIController):
 *   D-pad/stick up/down → navigate items
 *   L1/R1 or stick left/right → switch tabs
 *   A button / Enter / mouse / touch → select
 *   B button / ESC → close (handled by OverlayManager)
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale, fixTextStyle } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { THEME } from '../Theme';
import { getAllChassis } from '../../data/chassis/chassis';
import { getAllPaints } from '../../data/paints/paints';
import { getAllCompanions } from '../../data/companions/companions';
import { SaveSystem } from '../../systems/SaveSystem';
import { UIController } from '../UIController';
import type { OverlayUI } from '../OverlayManager';

type HangarTab = 'chassis' | 'loadout' | 'companion' | 'paint';

export class HangarUI implements OverlayUI {
  private container: Phaser.GameObjects.Container;
  private contentContainer: Phaser.GameObjects.Container | null = null;
  private scene: Phaser.Scene;
  private currentTab: HangarTab = 'chassis';
  private onBackCallback: () => void;
  private visible = false;
  private ctrl: UIController;
  // Persistent button references (NOT in contentContainer — survive tab switches)
  private tabButtons: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; tab: HangarTab }[] = [];
  private exitBg!: Phaser.GameObjects.Rectangle;
  private exitText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, onBack: () => void) {
    this.scene = scene;
    this.onBackCallback = onBack;
    this.container = scene.add.container(0, 0).setDepth(300).setVisible(false);
    this.container.scrollFactorX = 0;
    this.container.scrollFactorY = 0;
    this.ctrl = new UIController(scene, this.container);
    this.ctrl.setupKeyboard();
    this.buildLayout();
  }

  /** OverlayUI: return our controller so OverlayManager uses it. */
  getController(): UIController { return this.ctrl; }

  // ================ LAYOUT (persistent) ================

  private buildLayout(): void {
    const scene = this.scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;

    // Background
    const bgOverlay = scene.add.rectangle(w / 2, h / 2, w, h, THEME.BG_VOID, 0.97);
    bgOverlay.setScrollFactor(0);
    bgOverlay.setInteractive();
    this.container.add(bgOverlay);

    // Panel frame
    const panelBg = scene.add.rectangle(w / 2, h / 2, w - 60, h - 60, THEME.BG_PANEL, 0.95);
    panelBg.setStrokeStyle(2, THEME.STROKE_DIM, 0.6);
    panelBg.setScrollFactor(0);
    this.container.add(panelBg);

    // Title bar
    const titleBg = scene.add.rectangle(w / 2, 42, w - 80, 40, THEME.BG_DARK, 0.95);
    titleBg.setStrokeStyle(1, THEME.CYAN, 0.4);
    titleBg.setScrollFactor(0);
    this.container.add(titleBg);
    this.container.add(scene.add.text(w / 2, 42, `▸ ${t('hangar.title')}`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '18px', color: THEME.TEXT_ACCENT, stroke: '#000', strokeThickness: 3, letterSpacing: 4,
    })).setOrigin(0.5).setScrollFactor(0));

    // Exit button (top right) — persistent, stored as field
    this.exitBg = scene.add.rectangle(w - 100, 42, 100, 32, THEME.BG_PANEL, 0.95);
    this.exitBg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.exitBg.setScrollFactor(0);
    this.exitText = scene.add.text(w - 100, 42, getLocale() === 'fa' ? '▲ خروج' : '▲ EXIT', fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    })).setOrigin(0.5).setScrollFactor(0);
    this.container.add([this.exitBg, this.exitText]);
    // No manual setInteractive — ctrl.addButton() in showTab() handles all input

    // Tab buttons — persistent
    const tabY = 85;
    const tabW = 170, tabGap = 6;
    const tabs: { id: HangarTab; label: string }[] = [
      { id: 'chassis', label: t('hangar.tab.chassis') },
      { id: 'loadout', label: t('hangar.tab.loadout') },
      { id: 'companion', label: t('hangar.tab.companion') },
      { id: 'paint', label: t('hangar.tab.paint') },
    ];
    const totalW = tabs.length * tabW + (tabs.length - 1) * tabGap;
    const startX = (w - totalW) / 2 + tabW / 2;

    tabs.forEach((tab, i) => {
      const x = startX + i * (tabW + tabGap);
      const bg = scene.add.rectangle(x, tabY, tabW, 32, THEME.BG_PANEL, 0.9);
      bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.6);
      bg.setScrollFactor(0);
      const textEl = scene.add.text(x, tabY, tab.label, fixTextStyle({
        fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_MED, letterSpacing: 2,
      })).setOrigin(0.5).setScrollFactor(0);
      this.container.add([bg, textEl]);
      this.tabButtons.push({ bg, text: textEl, tab: tab.id });
      // No manual setInteractive — ctrl.addButton() in showTab() handles all input
    });
  }

  // ================ TAB SWITCHING ================

  private switchingTab = false;

  private showTab(tab: HangarTab): void {
    // Guard against re-entrant calls (rapid L1/R1 switching)
    if (this.switchingTab) return;
    this.switchingTab = true;
    try {
      this.currentTab = tab;
    // Update tab highlights
    this.tabButtons.forEach(tb => {
      if (tb.tab === tab) {
        tb.bg.setFillStyle(THEME.BG_PANEL_HI, 1);
        tb.bg.setStrokeStyle(2, THEME.CYAN, 0.9);
        tb.text.setColor(THEME.TEXT_ACCENT);
      } else {
        tb.bg.setFillStyle(THEME.BG_PANEL, 0.9);
        tb.bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.6);
        tb.text.setColor(THEME.TEXT_MED);
      }
    });
    this.ctrl.setCurrentTab(this.tabButtons.findIndex(tb => tb.tab === tab));
    // Clear content container
    if (this.contentContainer) {
      this.contentContainer.destroy(true);
      this.contentContainer = null;
    }
    // Clear all focusables and re-register persistent buttons
    this.ctrl.clearFocusables();
    // Re-register EXIT (using stored field references — no list.find hack)
    this.ctrl.addButton(this.exitBg.x, this.exitBg.y, this.exitBg,
      () => { this.hide(); this.onBackCallback(); }, { text: this.exitText });
    // Re-register tab buttons
    this.tabButtons.forEach(tb => {
      this.ctrl.addButton(tb.bg.x, tb.bg.y, tb.bg,
        () => { this.showTab(tb.tab); }, { text: tb.text });
    });
    // Re-register tabs for L1/R1 switching
    this.ctrl.addTabs(this.tabButtons.map(tb => ({
      id: tb.tab, label: tb.text.text,
      onSelect: () => { this.showTab(tb.tab); },
    })));
    // Build content (registers content-specific buttons)
    this.contentContainer = this.scene.add.container(0, 0);
    this.contentContainer.scrollFactorX = 0;
    this.contentContainer.scrollFactorY = 0;
    this.container.add(this.contentContainer);
    switch (tab) {
      case 'chassis': this.renderChassisTab(); break;
      case 'loadout': this.renderLoadoutTab(); break;
      case 'companion': this.renderCompanionTab(); break;
      case 'paint': this.renderPaintTab(); break;
    }
    } finally {
      this.switchingTab = false;
    }
  }

  // ================ CHASSIS TAB ================

  private renderChassisTab(): void {
    const scene = this.scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const cc = this.contentContainer!;
    const allChassis = getAllChassis();
    const selected = SaveSystem.getPlayer().selectedChassis;

    const listX = 120, listY = 140;
    const listW = 200, itemH = 80, itemGap = 12;

    allChassis.forEach((chassis, i) => {
      const y = listY + i * (itemH + itemGap);
      const isUnlocked = SaveSystem.isChassisUnlocked(chassis.id);
      const isSelected = selected === chassis.id;

      const itemBg = scene.add.rectangle(listX, y + itemH / 2, listW, itemH,
        isSelected ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.95);
      itemBg.setStrokeStyle(2, isSelected ? THEME.CYAN : THEME.STROKE_DIM, isSelected ? 0.9 : 0.4);
      cc.add(itemBg);

      const iconGfx = scene.add.graphics();
      iconGfx.fillStyle(chassis.color, isUnlocked ? 0.9 : 0.3);
      const s = chassis.scale;
      if (chassis.category === 'light') iconGfx.fillRoundedRect(-14 * s, -12 * s, 28 * s, 24 * s, 3);
      else if (chassis.category === 'balanced') iconGfx.fillRoundedRect(-16, -14, 32, 28, 3);
      else iconGfx.fillRoundedRect(-20 * s, -18 * s, 40 * s, 32 * s, 4);
      iconGfx.setPosition(listX - 70, y + itemH / 2);
      cc.add(iconGfx);

      cc.add(scene.add.text(listX - 40, y + 18, t(chassis.nameKey), fixTextStyle({
        fontFamily: 'monospace', fontSize: '13px',
        color: isSelected ? THEME.TEXT_ACCENT : isUnlocked ? THEME.TEXT_BRIGHT : THEME.TEXT_DIM, letterSpacing: 1,
      })).setOrigin(0, 0.5));
      cc.add(scene.add.text(listX - 40, y + 42, chassis.category.toUpperCase(), fixTextStyle({
        fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_DIM, letterSpacing: 1,
      })).setOrigin(0, 0.5));

      if (isSelected) {
        cc.add(scene.add.text(listX + listW / 2 - 12, y + itemH / 2, '◆', { fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_ACCENT }).setOrigin(0.5));
      }

      const selectAction = () => {
        if (isUnlocked && !isSelected) { SaveSystem.setSelectedChassis(chassis.id); this.showTab('chassis'); }
      };
      this.ctrl.addButton(listX, y + itemH / 2, itemBg, selectAction, {
        focusColor: chassis.color, disabled: !isUnlocked || isSelected,
      });
    });

    // Right: preview + stats
    const previewX = w / 2 + 120, previewY = h / 2 + 20;
    const selChassis = allChassis.find(c => c.id === selected) ?? allChassis[0];
    cc.add(scene.add.rectangle(previewX, previewY, 340, 360, THEME.BG_DARK, 0.9).setStrokeStyle(1, THEME.STROKE_DIM, 0.5));

    const mechGfx = scene.add.graphics();
    mechGfx.fillStyle(selChassis.color, 0.8);
    const ms = selChassis.scale * 2.5;
    mechGfx.fillRoundedRect(-18 * ms, -16 * ms, 36 * ms, 30 * ms, 5);
    mechGfx.lineStyle(3, selChassis.color, 0.9);
    mechGfx.strokeRoundedRect(-18 * ms, -16 * ms, 36 * ms, 30 * ms, 5);
    mechGfx.fillStyle(0xffffff, 0.6); mechGfx.fillCircle(0, -2 * ms, 5 * ms);
    mechGfx.fillStyle(selChassis.color, 0.9); mechGfx.fillCircle(0, -2 * ms, 3 * ms);
    mechGfx.fillStyle(0x2a3850, 0.9);
    mechGfx.fillRect(-14 * ms, 12 * ms, 8 * ms, 14 * ms);
    mechGfx.fillRect(6 * ms, 12 * ms, 8 * ms, 14 * ms);
    mechGfx.fillRoundedRect(-7 * ms, -26 * ms, 14 * ms, 12 * ms, 2);
    mechGfx.setPosition(previewX, previewY - 20);
    cc.add(mechGfx);

    const glow = scene.add.circle(previewX, previewY - 20, 60 * selChassis.scale, selChassis.color, 0.08);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    cc.add(glow);
    scene.tweens.add({ targets: glow, alpha: { from: 0.05, to: 0.12 }, scale: { from: 0.9, to: 1.1 }, duration: 1500, yoyo: true, repeat: -1 });

    const isFa = getLocale() === 'fa';
    const statsY = previewY + 130;
    const stats = [
      { label: isFa ? 'سرعت' : 'SPEED', val: selChassis.movement.speedMult, color: 0x39d0d8 },
      { label: isFa ? 'پرش' : 'JUMP', val: selChassis.movement.jumpMult, color: 0x66f0ff },
      { label: isFa ? 'سلامتی' : 'HEALTH', val: selChassis.combat.maxHealthMult, color: 0x40d070 },
      { label: isFa ? 'ضربه' : 'MELEE', val: selChassis.combat.meleeMult, color: 0xff6040 },
      { label: isFa ? 'انرژی' : 'ENERGY', val: selChassis.combat.maxEnergyMult, color: 0x4090ff },
    ];
    stats.forEach((stat, si) => {
      const sy = statsY + si * 22;
      cc.add(scene.add.text(previewX - 130, sy, stat.label, fixTextStyle({ fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_DIM, letterSpacing: 1 })).setOrigin(0, 0.5));
      cc.add(scene.add.rectangle(previewX - 60, sy, 100, 8, 0x05080c, 1).setStrokeStyle(1, THEME.STROKE_DIM, 0.5).setOrigin(0, 0.5));
      cc.add(scene.add.rectangle(previewX - 59, sy, Math.min(100, 100 * stat.val / 1.5), 6, stat.color, 1).setOrigin(0, 0.5));
    });

    cc.add(scene.add.text(previewX, previewY + 200, t(selChassis.descKey), fixTextStyle({ fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_MED, align: 'center', wordWrap: { width: 300 }, lineSpacing: 4 })).setOrigin(0.5));

    if (selected === selChassis.id) {
      cc.add(scene.add.text(previewX, previewY + 250, '◆ ' + (isFa ? 'انتخاب شده' : 'EQUIPPED'), fixTextStyle({ fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_ACCENT, letterSpacing: 2 })).setOrigin(0.5));
    } else if (SaveSystem.isChassisUnlocked(selChassis.id)) {
      const btnBg = scene.add.rectangle(previewX, previewY + 250, 120, 28, THEME.BG_PANEL, 0.95);
      btnBg.setStrokeStyle(1, selChassis.color, 0.7);
      const btnText = scene.add.text(previewX, previewY + 250, '▶ ' + (isFa ? 'انتخاب' : 'SELECT'), fixTextStyle({ fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_BRIGHT, letterSpacing: 1 })).setOrigin(0.5);
      cc.add([btnBg, btnText]);
      this.ctrl.addButton(previewX, previewY + 250, btnBg, () => { SaveSystem.setSelectedChassis(selChassis.id); this.showTab('chassis'); }, { text: btnText, focusColor: selChassis.color });
    }
  }

  // ================ LOADOUT TAB ================

  private renderLoadoutTab(): void {
    const scene = this.scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const cc = this.contentContainer!;
    const player = SaveSystem.getPlayer();
    const isFa = getLocale() === 'fa';
    const panelX = w / 2, panelY = h / 2 + 20;

    cc.add(scene.add.rectangle(panelX, panelY, 500, 300, THEME.BG_DARK, 0.9).setStrokeStyle(1, THEME.STROKE_DIM, 0.5));
    cc.add(scene.add.text(panelX, panelY - 100, isFa ? 'تجهیزات فعلی' : 'CURRENT LOADOUT', fixTextStyle({ fontFamily: 'monospace', fontSize: '16px', color: THEME.TEXT_BRIGHT, letterSpacing: 3 })).setOrigin(0.5));
    cc.add(scene.add.text(panelX, panelY - 50, isFa ? `سلاح: ${player.currentWeapon}` : `WEAPON: ${player.currentWeapon}`, fixTextStyle({ fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_AMBER })).setOrigin(0.5));
    cc.add(scene.add.text(panelX, panelY + 20, isFa
      ? 'سیستم تجهیزات کامل در نسخه‌های آینده\nشامل: سلاح اصلی، سلاح کمکی، ضربه نزدیک، ماژول هسته، ماژول غیرفعال'
      : 'Full loadout system coming in future versions\nIncludes: Primary, Secondary, Melee, Core Module, Passive Module',
      fixTextStyle({ fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_DIM, align: 'center', lineSpacing: 6 })
    ).setOrigin(0.5));
  }

  // ================ COMPANION TAB ================

  private renderCompanionTab(): void {
    const scene = this.scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const cc = this.contentContainer!;
    const allCompanions = getAllCompanions();
    const isFa = getLocale() === 'fa';
    const cardW = 160, cardH = 180, gap = 16;
    const totalW = allCompanions.length * cardW + (allCompanions.length - 1) * gap;
    const startX = (w - totalW) / 2 + cardW / 2;
    const cardY = h / 2 + 20;

    allCompanions.forEach((companion, i) => {
      const x = startX + i * (cardW + gap);
      const isUnlocked = companion.unlockedByDefault;
      cc.add(scene.add.rectangle(x, cardY, cardW, cardH, isUnlocked ? THEME.BG_PANEL : 0x05080c, 0.95).setStrokeStyle(1, isUnlocked ? companion.color : THEME.STROKE_DIM, isUnlocked ? 0.7 : 0.3));
      const orb = scene.add.circle(x, cardY - 40, 18, companion.color, isUnlocked ? 0.6 : 0.12);
      orb.setBlendMode(Phaser.BlendModes.ADD);
      cc.add(orb);
      if (isUnlocked) scene.tweens.add({ targets: orb, alpha: { from: 0.4, to: 0.8 }, scale: { from: 0.9, to: 1.1 }, duration: 1500, yoyo: true, repeat: -1 });
      cc.add(scene.add.circle(x, cardY - 40, 10, 0x000000, 0).setStrokeStyle(1, companion.color, isUnlocked ? 0.5 : 0.15));
      cc.add(scene.add.text(x, cardY + 10, t(companion.nameKey), fixTextStyle({ fontFamily: 'monospace', fontSize: '10px', color: isUnlocked ? THEME.TEXT_BRIGHT : THEME.TEXT_DIM, letterSpacing: 1 })).setOrigin(0.5));
      if (!isUnlocked) {
        cc.add(scene.add.text(x, cardY + 38, t('hangar.locked'), fixTextStyle({ fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_RED, letterSpacing: 2 })).setOrigin(0.5));
        cc.add(scene.add.text(x, cardY + 56, t('hangar.coming_soon'), fixTextStyle({ fontFamily: 'monospace', fontSize: '7px', color: THEME.TEXT_DIM, letterSpacing: 1 })).setOrigin(0.5));
      } else {
        cc.add(scene.add.text(x, cardY + 38, companion.category.toUpperCase(), fixTextStyle({ fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_DIM, letterSpacing: 1 })).setOrigin(0.5));
      }
    });

    cc.add(scene.add.text(w / 2, cardY + 140, isFa
      ? 'همراهان سیستم مستقلی هستند که دنبال بازیکن می‌آیند.\nمعماری آماده است — در نسخه‌های آینده فعال می‌شود.\nProtocol Echo: شروع به عنوان گوی خفته → رشد با داستان → آشکارسازی'
      : 'Companions are independent AI entities that follow the player.\nArchitecture is ready — activated in future versions.\nProtocol Echo: dormant orb → grows with story → revealed',
      fixTextStyle({ fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_DIM, align: 'center', wordWrap: { width: 600 }, lineSpacing: 4 })
    ).setOrigin(0.5));
  }

  // ================ PAINT TAB ================

  private renderPaintTab(): void {
    const scene = this.scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const cc = this.contentContainer!;
    const allPaints = getAllPaints();
    const selected = SaveSystem.getPlayer().selectedPaint;
    const isFa = getLocale() === 'fa';

    const listX = 120, listY = 140;
    const listW = 200, itemH = 70, itemGap = 12;

    allPaints.forEach((paint, i) => {
      const y = listY + i * (itemH + itemGap);
      const isUnlocked = SaveSystem.isPaintUnlocked(paint.id);
      const isSelected = selected === paint.id;

      const itemBg = scene.add.rectangle(listX, y + itemH / 2, listW, itemH,
        isSelected ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.95);
      itemBg.setStrokeStyle(2, isSelected ? paint.accentColor : THEME.STROKE_DIM, isSelected ? 0.9 : 0.4);
      cc.add(itemBg);

      const swatch = scene.add.graphics();
      swatch.fillStyle(paint.primaryColor, isUnlocked ? 0.9 : 0.3);
      swatch.fillRoundedRect(-18, -14, 36, 28, 3);
      swatch.lineStyle(2, paint.accentColor, isUnlocked ? 0.9 : 0.3);
      swatch.strokeRoundedRect(-18, -14, 36, 28, 3);
      swatch.fillStyle(paint.accentColor, isUnlocked ? 0.8 : 0.2);
      swatch.fillCircle(0, -2, 4);
      swatch.setPosition(listX - 70, y + itemH / 2);
      cc.add(swatch);

      cc.add(scene.add.text(listX - 40, y + 18, t(paint.nameKey), fixTextStyle({
        fontFamily: 'monospace', fontSize: '12px',
        color: isSelected ? THEME.TEXT_ACCENT : isUnlocked ? THEME.TEXT_BRIGHT : THEME.TEXT_DIM, letterSpacing: 1,
      })).setOrigin(0, 0.5));

      if (isSelected) {
        cc.add(scene.add.text(listX + listW / 2 - 12, y + itemH / 2, '◆', { fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_ACCENT }).setOrigin(0.5));
      } else if (!isUnlocked) {
        cc.add(scene.add.text(listX - 40, y + 40, t('hangar.locked'), fixTextStyle({ fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_RED })).setOrigin(0, 0.5));
      }

      const selectAction = () => {
        if (isUnlocked && !isSelected) { SaveSystem.setSelectedPaint(paint.id); this.showTab('paint'); }
      };
      this.ctrl.addButton(listX, y + itemH / 2, itemBg, selectAction, {
        focusColor: paint.accentColor, disabled: !isUnlocked || isSelected,
      });
    });

    const previewX = w / 2 + 120, previewY = h / 2 + 20;
    const selPaint = allPaints.find(p => p.id === selected) ?? allPaints[0];
    cc.add(scene.add.rectangle(previewX, previewY, 340, 360, THEME.BG_DARK, 0.9).setStrokeStyle(1, THEME.STROKE_DIM, 0.5));

    const mechGfx = scene.add.graphics();
    mechGfx.fillStyle(selPaint.primaryColor, 0.9);
    mechGfx.fillRoundedRect(-45, -40, 90, 75, 6);
    mechGfx.lineStyle(3, selPaint.accentColor, 0.9);
    mechGfx.strokeRoundedRect(-45, -40, 90, 75, 6);
    mechGfx.fillStyle(selPaint.accentColor, 0.8); mechGfx.fillCircle(0, -5, 8);
    mechGfx.fillStyle(0x2a3850, 0.9);
    mechGfx.fillRect(-35, 30, 20, 35); mechGfx.fillRect(15, 30, 20, 35);
    mechGfx.fillRoundedRect(-18, -65, 36, 30, 3);
    mechGfx.lineStyle(1, selPaint.accentColor, 0.6); mechGfx.strokeRoundedRect(-18, -65, 36, 30, 3);
    mechGfx.setPosition(previewX, previewY - 20);
    cc.add(mechGfx);

    cc.add(scene.add.text(previewX, previewY + 150, t(selPaint.nameKey), fixTextStyle({ fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, letterSpacing: 2 })).setOrigin(0.5));
    cc.add(scene.add.text(previewX, previewY + 175, t(selPaint.descKey), fixTextStyle({ fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_MED, align: 'center', wordWrap: { width: 280 } })).setOrigin(0.5));

    if (selected === selPaint.id) {
      cc.add(scene.add.text(previewX, previewY + 230, '◆ ' + (isFa ? 'انتخاب شده' : 'EQUIPPED'), fixTextStyle({ fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_ACCENT, letterSpacing: 2 })).setOrigin(0.5));
    } else if (SaveSystem.isPaintUnlocked(selPaint.id)) {
      const btnBg = scene.add.rectangle(previewX, previewY + 230, 120, 28, THEME.BG_PANEL, 0.95);
      btnBg.setStrokeStyle(1, selPaint.accentColor, 0.7);
      const btnText = scene.add.text(previewX, previewY + 230, '▶ ' + (isFa ? 'انتخاب' : 'SELECT'), fixTextStyle({ fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_BRIGHT, letterSpacing: 1 })).setOrigin(0.5);
      cc.add([btnBg, btnText]);
      this.ctrl.addButton(previewX, previewY + 230, btnBg, () => { SaveSystem.setSelectedPaint(selPaint.id); this.showTab('paint'); }, { text: btnText, focusColor: selPaint.accentColor });
    } else {
      cc.add(scene.add.text(previewX, previewY + 230, t('hangar.locked'), fixTextStyle({ fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_RED, letterSpacing: 2 })).setOrigin(0.5));
    }
  }

  // ================ OverlayUI interface ================

  show(): void {
    this.visible = true;
    this.container.setVisible(true);
    this.showTab('chassis');
    this.ctrl.show(280);
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
    this.ctrl.hide();
  }

  get isVisible(): boolean { return this.visible; }

  destroy(): void {
    this.ctrl.destroy();
    this.container.destroy();
    this.contentContainer = null;
  }
}

export default HangarUI;
