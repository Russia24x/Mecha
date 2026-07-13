/**
 * MECHA: LAST PROTOCOL — Hangar UI
 *
 * The Hangar is the central customization hub. It has 4 tabs:
 *   1. CHASSIS — select mech frame (Scout/Assault/Titan) — changes visual + stats + animation
 *   2. LOADOUT — weapon selection (future — currently shows current loadout)
 *   3. COMPANION — AI companion selection (locked — architecture-ready for future)
 *   4. PAINT — cosmetic color scheme
 *
 * Architecture is future-proof: adding new chassis/paints/companions = data only.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale, fixTextStyle } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { THEME } from '../Theme';
import { CHASSIS, getAllChassis } from '../../data/chassis/chassis';
import { PAINTS, getAllPaints } from '../../data/paints/paints';
import { COMPANIONS, getAllCompanions } from '../../data/companions/companions';
import { SaveSystem } from '../../systems/SaveSystem';
import { NavigableOverlay } from '../NavigableOverlay';

type HangarTab = 'chassis' | 'loadout' | 'companion' | 'paint';

export class HangarUI extends NavigableOverlay {
  private currentTab: HangarTab = 'chassis';
  private contentContainer: Phaser.GameObjects.Container | null = null;
  private tabButtons: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; tab: HangarTab }[] = [];
  private onBackCallback: () => void;

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    this.onBackCallback = onBack;
    // Build title bar
    const w = GAME.WIDTH;
    this.addFixed(this.scene.add.text(w / 2, 50, t('hangar.title'), fixTextStyle({
      fontFamily: 'monospace', fontSize: '22px', color: THEME.TEXT_ACCENT, stroke: '#000', strokeThickness: 4, letterSpacing: 4,
    })).setOrigin(0.5));
    // Back button
    const backBg = this.scene.add.rectangle(w - 80, 50, 120, 32, THEME.BG_PANEL, 0.95);
    backBg.setStrokeStyle(1, THEME.CYAN, 0.5);
    const backText = this.scene.add.text(w - 80, 50, getLocale() === 'fa' ? '▲ خروج' : '▲ EXIT', fixTextStyle({
      fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    })).setOrigin(0.5);
    this.addFixed(backBg, backText);
    backBg.setInteractive({ useHandCursor: true });
    backBg.on('pointerdown', () => { AudioSystem.play('uiClick'); this.hide(); this.onBackCallback(); });
    this.registerNav(backBg, backText, () => { AudioSystem.play('uiClick'); this.hide(); this.onBackCallback(); });

    this.buildTabs();
    this.showTab('chassis');
    this.show();
  }

  private buildTabs(): void {
    const w = GAME.WIDTH;
    const tabY = 100;
    const tabW = 180;
    const tabGap = 8;
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
      const bg = this.scene.add.rectangle(x, tabY, tabW, 36, THEME.BG_PANEL, 0.9);
      bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.6);
      bg.setInteractive({ useHandCursor: true });
      const textEl = this.scene.add.text(x, tabY, tab.label, fixTextStyle({
        fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_MED, letterSpacing: 2,
      })).setOrigin(0.5);
      this.addFixed(bg, textEl);
      this.tabButtons.push({ bg, text: textEl, tab: tab.id });
      bg.on('pointerover', () => { bg.setFillStyle(THEME.BG_PANEL_HI, 1); AudioSystem.play('uiHover'); });
      bg.on('pointerout', () => { if (this.currentTab !== tab.id) bg.setFillStyle(THEME.BG_PANEL, 0.9); });
      bg.on('pointerdown', () => { AudioSystem.play('uiClick'); this.showTab(tab.id); });
      this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); this.showTab(tab.id); });
    });
  }

  private showTab(tab: HangarTab): void {
    this.currentTab = tab;
    // Update tab highlight
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
    // Clear content
    if (this.contentContainer) {
      this.contentContainer.destroy(true);
      this.contentContainer = null;
    }
    this.contentContainer = this.scene.add.container(0, 0);
    this.addFixed(this.contentContainer);
    // Render tab content
    switch (tab) {
      case 'chassis': this.renderChassisTab(); break;
      case 'loadout': this.renderLoadoutTab(); break;
      case 'companion': this.renderCompanionTab(); break;
      case 'paint': this.renderPaintTab(); break;
    }
  }

  // ─── CHASSIS TAB ───────────────────────────────────────────────────────
  private renderChassisTab(): void {
    const w = GAME.WIDTH;
    const cc = this.contentContainer!;
    const allChassis = getAllChassis();
    const selected = SaveSystem.getPlayer().selectedChassis;
    const cardW = 240, cardH = 200, gap = 24;
    const totalW = allChassis.length * cardW + (allChassis.length - 1) * gap;
    const startX = (w - totalW) / 2 + cardW / 2;
    const cardY = 260;

    allChassis.forEach((chassis, i) => {
      const x = startX + i * (cardW + gap);
      const isUnlocked = SaveSystem.isChassisUnlocked(chassis.id);
      const isSelected = selected === chassis.id;

      // Card background
      const cardBg = this.scene.add.rectangle(x, cardY, cardW, cardH, isSelected ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.95);
      cardBg.setStrokeStyle(2, isSelected ? THEME.CYAN : THEME.STROKE_DIM, isSelected ? 0.9 : 0.5);
      cc.add(cardBg);

      // Chassis visual preview (scaled mech silhouette)
      const previewY = cardY - 50;
      const previewGfx = this.scene.add.graphics();
      previewGfx.fillStyle(chassis.color, 0.8);
      // Body shape varies by category
      if (chassis.category === 'light') {
        // Scout — slim
        previewGfx.fillRoundedRect(-16 * chassis.scale, -14 * chassis.scale, 32 * chassis.scale, 28 * chassis.scale, 4);
      } else if (chassis.category === 'balanced') {
        // Assault — standard
        previewGfx.fillRoundedRect(-18, -16, 36, 30, 4);
      } else {
        // Titan — bulky
        previewGfx.fillRoundedRect(-22 * chassis.scale, -20 * chassis.scale, 44 * chassis.scale, 36 * chassis.scale, 4);
      }
      previewGfx.lineStyle(2, chassis.color, 0.9);
      previewGfx.strokeRoundedRect(-22, -24, 44, 40, 4);
      previewGfx.setPosition(x, previewY);
      cc.add(previewGfx);

      // Glow if selected
      if (isSelected) {
        const glow = this.scene.add.circle(x, previewY, 36, chassis.color, 0.1);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        cc.add(glow);
        this.scene.tweens.add({ targets: glow, alpha: { from: 0.05, to: 0.15 }, scale: { from: 0.9, to: 1.1 }, duration: 1200, yoyo: true, repeat: -1 });
      }

      // Name
      cc.add(this.scene.add.text(x, cardY + 10, t(chassis.nameKey), fixTextStyle({
        fontFamily: 'monospace', fontSize: '14px', color: isSelected ? THEME.TEXT_ACCENT : THEME.TEXT_BRIGHT, letterSpacing: 2,
      })).setOrigin(0.5));

      // Category
      cc.add(this.scene.add.text(x, cardY + 30, chassis.category.toUpperCase(), fixTextStyle({
        fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_DIM, letterSpacing: 1,
      })).setOrigin(0.5));

      // Stats bars (simplified)
      const statY = cardY + 50;
      const stats = [
        { label: 'SPD', val: chassis.movement.speedMult },
        { label: 'HP', val: chassis.combat.maxHealthMult },
        { label: 'DMG', val: chassis.combat.meleeMult },
      ];
      stats.forEach((stat, si) => {
        const sy = statY + si * 16;
        cc.add(this.scene.add.text(x - 70, sy, stat.label, fixTextStyle({
          fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_DIM,
        })).setOrigin(0, 0.5));
        const barBg = this.scene.add.rectangle(x - 40, sy, 80, 6, 0x05080c, 1).setStrokeStyle(1, THEME.STROKE_DIM, 0.5).setOrigin(0, 0.5);
        cc.add(barBg);
        const barFill = this.scene.add.rectangle(x - 39, sy, 78 * Math.min(1, stat.val / 1.5), 4, chassis.color, 1).setOrigin(0, 0.5);
        cc.add(barFill);
      });

      // Select button
      if (isUnlocked && !isSelected) {
        const btnBg = this.scene.add.rectangle(x, cardY + cardH / 2 - 16, 100, 24, THEME.BG_PANEL, 0.9);
        btnBg.setStrokeStyle(1, chassis.color, 0.7);
        btnBg.setInteractive({ useHandCursor: true });
        const btnText = this.scene.add.text(x, cardY + cardH / 2 - 16, '▶ ' + (getLocale() === 'fa' ? 'انتخاب' : 'SELECT'), fixTextStyle({
          fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_BRIGHT, letterSpacing: 1,
        })).setOrigin(0.5);
        cc.add([btnBg, btnText]);
        btnBg.on('pointerover', () => { btnBg.setFillStyle(THEME.BG_PANEL_HI, 1); AudioSystem.play('uiHover'); });
        btnBg.on('pointerout', () => { btnBg.setFillStyle(THEME.BG_PANEL, 0.9); });
        btnBg.on('pointerdown', () => {
          AudioSystem.play('uiClick');
          SaveSystem.setSelectedChassis(chassis.id);
          this.showTab('chassis');  // refresh
        });
        this.registerNav(btnBg, btnText, () => {
          AudioSystem.play('uiClick');
          SaveSystem.setSelectedChassis(chassis.id);
          this.showTab('chassis');
        });
      } else if (isSelected) {
        cc.add(this.scene.add.text(x, cardY + cardH / 2 - 16, '◆ ' + (getLocale() === 'fa' ? 'انتخاب شده' : 'EQUIPPED'), fixTextStyle({
          fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_ACCENT, letterSpacing: 1,
        })).setOrigin(0.5));
      }
    });

    // Description at bottom
    const selectedChassis = CHASSIS[selected as keyof typeof CHASSIS];
    if (selectedChassis) {
      cc.add(this.scene.add.text(w / 2, 400, t(selectedChassis.descKey), fixTextStyle({
        fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_MED, align: 'center', wordWrap: { width: 600 },
      })).setOrigin(0.5));
    }
  }

  // ─── LOADOUT TAB ───────────────────────────────────────────────────────
  private renderLoadoutTab(): void {
    const w = GAME.WIDTH;
    const cc = this.contentContainer!;
    const player = SaveSystem.getPlayer();
    cc.add(this.scene.add.text(w / 2, 250, getLocale() === 'fa' ? 'تجهیزات فعلی' : 'CURRENT LOADOUT', fixTextStyle({
      fontFamily: 'monospace', fontSize: '16px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    })).setOrigin(0.5));
    // Show current weapon
    cc.add(this.scene.add.text(w / 2, 290, getLocale() === 'fa' ? `سلاح: ${player.currentWeapon}` : `WEAPON: ${player.currentWeapon}`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: THEME.TEXT_AMBER,
    })).setOrigin(0.5));
    cc.add(this.scene.add.text(w / 2, 320, getLocale() === 'fa' ? 'بخش تجهیزات کامل در نسخه‌های آینده' : 'Full loadout system coming in future versions', fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_DIM, align: 'center',
    })).setOrigin(0.5));
  }

  // ─── COMPANION TAB ─────────────────────────────────────────────────────
  private renderCompanionTab(): void {
    const w = GAME.WIDTH;
    const cc = this.contentContainer!;
    const allCompanions = getAllCompanions();
    const cardW = 200, cardH = 160, gap = 20;
    const totalW = allCompanions.length * cardW + (allCompanions.length - 1) * gap;
    const startX = (w - totalW) / 2 + cardW / 2;
    const cardY = 280;

    allCompanions.forEach((companion, i) => {
      const x = startX + i * (cardW + gap);
      const isUnlocked = companion.unlockedByDefault;
      // Card
      const cardBg = this.scene.add.rectangle(x, cardY, cardW, cardH, isUnlocked ? THEME.BG_PANEL : 0x05080c, 0.95);
      cardBg.setStrokeStyle(1, isUnlocked ? companion.color : THEME.STROKE_DIM, isUnlocked ? 0.7 : 0.3);
      cc.add(cardBg);
      // Companion visual (orb)
      const orb = this.scene.add.circle(x, cardY - 30, 16, companion.color, isUnlocked ? 0.6 : 0.15);
      orb.setBlendMode(Phaser.BlendModes.ADD);
      cc.add(orb);
      if (isUnlocked) {
        this.scene.tweens.add({ targets: orb, alpha: { from: 0.4, to: 0.8 }, scale: { from: 0.9, to: 1.1 }, duration: 1500, yoyo: true, repeat: -1 });
      }
      // Name
      cc.add(this.scene.add.text(x, cardY + 10, t(companion.nameKey), fixTextStyle({
        fontFamily: 'monospace', fontSize: '11px', color: isUnlocked ? THEME.TEXT_BRIGHT : THEME.TEXT_DIM, letterSpacing: 1,
      })).setOrigin(0.5));
      // Status
      if (!isUnlocked) {
        cc.add(this.scene.add.text(x, cardY + 40, t('hangar.locked'), fixTextStyle({
          fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_RED, letterSpacing: 2,
        })).setOrigin(0.5));
        cc.add(this.scene.add.text(x, cardY + 60, t('hangar.coming_soon'), fixTextStyle({
          fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_DIM, letterSpacing: 1,
        })).setOrigin(0.5));
      } else {
        cc.add(this.scene.add.text(x, cardY + 40, companion.category.toUpperCase(), fixTextStyle({
          fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_DIM, letterSpacing: 1,
        })).setOrigin(0.5));
      }
    });

    // Description
    cc.add(this.scene.add.text(w / 2, 420, getLocale() === 'fa'
      ? 'همراهان سیستم مستقلی هستند که دنبال بازیکن می‌آیند. معماری آماده است — در نسخه‌های آینده فعال می‌شود.'
      : 'Companions are independent AI entities that follow the player. Architecture is ready — activated in future versions.',
      fixTextStyle({
        fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_DIM, align: 'center', wordWrap: { width: 600 }, lineSpacing: 4,
      })).setOrigin(0.5));
  }

  // ─── PAINT TAB ─────────────────────────────────────────────────────────
  private renderPaintTab(): void {
    const w = GAME.WIDTH;
    const cc = this.contentContainer!;
    const allPaints = getAllPaints();
    const selected = SaveSystem.getPlayer().selectedPaint;
    const cardW = 180, cardH = 140, gap = 20;
    const totalW = allPaints.length * cardW + (allPaints.length - 1) * gap;
    const startX = (w - totalW) / 2 + cardW / 2;
    const cardY = 280;

    allPaints.forEach((paint, i) => {
      const x = startX + i * (cardW + gap);
      const isUnlocked = SaveSystem.isPaintUnlocked(paint.id);
      const isSelected = selected === paint.id;
      // Card
      const cardBg = this.scene.add.rectangle(x, cardY, cardW, cardH, isSelected ? THEME.BG_PANEL_HI : THEME.BG_PANEL, 0.95);
      cardBg.setStrokeStyle(2, isSelected ? paint.accentColor : THEME.STROKE_DIM, isSelected ? 0.9 : 0.5);
      cc.add(cardBg);
      // Paint preview (colored mech silhouette)
      const previewGfx = this.scene.add.graphics();
      previewGfx.fillStyle(paint.primaryColor, isUnlocked ? 0.9 : 0.3);
      previewGfx.fillRoundedRect(-18, -16, 36, 30, 4);
      previewGfx.lineStyle(2, paint.accentColor, isUnlocked ? 0.9 : 0.3);
      previewGfx.strokeRoundedRect(-18, -16, 36, 30, 4);
      previewGfx.fillStyle(paint.accentColor, isUnlocked ? 0.8 : 0.2);
      previewGfx.fillCircle(0, -2, 4);
      previewGfx.setPosition(x, cardY - 30);
      cc.add(previewGfx);
      // Name
      cc.add(this.scene.add.text(x, cardY + 20, t(paint.nameKey), fixTextStyle({
        fontFamily: 'monospace', fontSize: '11px', color: isUnlocked ? (isSelected ? THEME.TEXT_ACCENT : THEME.TEXT_BRIGHT) : THEME.TEXT_DIM, letterSpacing: 1,
      })).setOrigin(0.5));
      // Status / select button
      if (isUnlocked && !isSelected) {
        const btnBg = this.scene.add.rectangle(x, cardY + cardH / 2 - 16, 80, 22, THEME.BG_PANEL, 0.9);
        btnBg.setStrokeStyle(1, paint.accentColor, 0.6);
        btnBg.setInteractive({ useHandCursor: true });
        const btnText = this.scene.add.text(x, cardY + cardH / 2 - 16, '▶ ' + (getLocale() === 'fa' ? 'انتخاب' : 'SELECT'), fixTextStyle({
          fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_BRIGHT,
        })).setOrigin(0.5);
        cc.add([btnBg, btnText]);
        btnBg.on('pointerover', () => { btnBg.setFillStyle(THEME.BG_PANEL_HI, 1); AudioSystem.play('uiHover'); });
        btnBg.on('pointerout', () => { btnBg.setFillStyle(THEME.BG_PANEL, 0.9); });
        btnBg.on('pointerdown', () => {
          AudioSystem.play('uiClick');
          SaveSystem.setSelectedPaint(paint.id);
          this.showTab('paint');
        });
        this.registerNav(btnBg, btnText, () => {
          AudioSystem.play('uiClick');
          SaveSystem.setSelectedPaint(paint.id);
          this.showTab('paint');
        });
      } else if (isSelected) {
        cc.add(this.scene.add.text(x, cardY + cardH / 2 - 16, '◆ ' + (getLocale() === 'fa' ? 'انتخاب شده' : 'EQUIPPED'), fixTextStyle({
          fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_ACCENT,
        })).setOrigin(0.5));
      } else {
        cc.add(this.scene.add.text(x, cardY + cardH / 2 - 16, t('hangar.locked'), fixTextStyle({
          fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_RED,
        })).setOrigin(0.5));
      }
    });
  }
}

export default HangarUI;
