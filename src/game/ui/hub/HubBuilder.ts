/**
 * MECHA: LAST PROTOCOL — Hub Builder
 *
 * Builds the hub screen (mission select + nav bar).
 *
 * Extracted from GameScene to reduce God Object size.
 *
 * Design:
 *   - build() creates all visuals + registers buttons via MenuNavHelper
 *   - Uses callbacks for state transitions (no back-reference to GameScene)
 *   - MenuNavHelper is passed in (shared with MenuBuilder + gameover/victory)
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, fixTextStyle, getLocale } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import { WorldSystem } from '../../world/WorldSystem';
import { WorldMapSystem } from '../../world/WorldMapSystem';
import { MenuNavHelper } from '../shared/MenuNavHelper';

export interface HubCallbacks {
  onEnterArea: (areaId: string) => void;
  onOpenOverlay: (overlayId: string) => void;
  onBackToMenu: () => void;
}

export class HubBuilder {
  constructor(
    private scene: Phaser.Scene,
    private container: Phaser.GameObjects.Container,
    private nav: MenuNavHelper,
    private callbacks: HubCallbacks,
  ) {}

  /** Build the hub screen. */
  build(): void {
    const c = this.container;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';
    const L = (en: string, fa: string) => isFa ? fa : en;

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0e1a, 1);
    bg.fillRect(0, 0, w, h);
    for (let r = 400; r > 0; r -= 25) {
      bg.fillStyle(0x101828, 0.025);
      bg.fillCircle(w / 2, h * 0.45, r);
    }
    bg.setDepth(0);
    c.add(bg);

    // === Top bar: Title + Player stats ===
    const headerBg = this.scene.add.rectangle(w / 2, 30, w - 40, 44, 0x0a0d14, 0.8);
    headerBg.setStrokeStyle(1, 0x1a3040, 0.5);
    headerBg.setDepth(1);
    c.add(headerBg);

    // Title with accent bracket
    const titleText = isFa ? 'انتخاب ماموریت' : 'MISSION SELECT';
    c.add(this.scene.add.text(40, 30, `▸ ${titleText}`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '16px', color: '#39d0d8', letterSpacing: 2,
    })).setOrigin(0, 0.5).setDepth(2));

    // Player stats (right side) — level + XP bar + skill points
    const save = SaveSystem.getPlayer();
    const xpNeeded = ExperienceSystem.xpForLevel(save.level);
    const xpPct = Math.min(1, save.xp / xpNeeded);
    // Level badge
    c.add(this.scene.add.text(w - 280, 20, isFa ? `سطح ${save.level}` : `LV.${save.level}`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: '#40ff80', stroke: '#000', strokeThickness: 2,
    })).setOrigin(0, 0.5).setDepth(2));
    // XP bar background
    c.add(this.scene.add.rectangle(w - 200, 26, 100, 6, 0x05080c, 1).setStrokeStyle(1, 0x1a3040, 0.6).setOrigin(0, 0.5).setDepth(2));
    // XP bar fill
    c.add(this.scene.add.rectangle(w - 199, 26, 98 * xpPct, 4, 0xffc040, 1).setOrigin(0, 0.5).setDepth(2));
    // XP text
    c.add(this.scene.add.text(w - 200, 36, `${save.xp}/${xpNeeded}`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '8px', color: '#5a6470',
    })).setOrigin(0, 0.5).setDepth(2));
    // Skill points badge
    const spLabel = isFa ? `◆ ${save.skillPoints}` : `◆${save.skillPoints}`;
    c.add(this.scene.add.text(w - 90, 30, spLabel, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: save.skillPoints > 0 ? '#ffc040' : '#3a4350', stroke: '#000', strokeThickness: 2,
    })).setOrigin(0.5).setDepth(2));
    // Kills
    const killsLabel = isFa ? `☠ ${save.totalKills}` : `☠${save.totalKills}`;
    c.add(this.scene.add.text(w - 45, 30, killsLabel, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: '#5a6470', stroke: '#000', strokeThickness: 2,
    })).setOrigin(0.5).setDepth(2));

    // === Act-based world map ===
    const tree = WorldMapSystem.getMapTree();

    // ── Collect all acts with their areas ──
    const actData: {
      actId: number;
      actName: string;
      areas: { areaId: string; nameKey: string; unlocked: boolean; isCurrent: boolean; bossDefeated: boolean; hasBoss: boolean; regionId: string }[];
    }[] = [];
    for (const act of tree) {
      const actAreas: { areaId: string; nameKey: string; unlocked: boolean; isCurrent: boolean; bossDefeated: boolean; hasBoss: boolean; regionId: string }[] = [];
      for (const regionData of act.regions) {
        for (const node of regionData.nodes) {
          actAreas.push({
            areaId: node.area.id,
            nameKey: node.area.nameKey,
            unlocked: node.unlocked,
            isCurrent: node.isCurrent,
            bossDefeated: node.bossDefeated,
            hasBoss: node.hasBoss,
            regionId: node.area.regionId,
          });
        }
      }
      actData.push({
        actId: act.act.id,
        actName: t(act.act.nameKey),
        areas: actAreas,
      });
    }

    // ── Layout: Act columns side by side ──
    const cardW = 200;
    const cardH = 180;
    const cardGap = 12;
    const actGap = 28;
    const actTitleH = 36;
    const actsToShow = actData.filter(a => a.areas.length > 0);
    const totalW = actsToShow.length * cardW + (actsToShow.length - 1) * actGap;
    const startX = (w - totalW) / 2 + cardW / 2;
    const baseY = 110;

    actsToShow.forEach((act, actIdx) => {
      const actX = startX + actIdx * (cardW + actGap);
      const hasUnlocked = act.areas.some(a => a.unlocked);

      // ── Act title bar ──
      const actTitleH2 = 44;
      const actTitleBg = this.scene.add.rectangle(actX, baseY, cardW, actTitleH2, hasUnlocked ? 0x0d1820 : 0x05080c, 0.95);
      actTitleBg.setStrokeStyle(2, hasUnlocked ? 0x39d0d8 : 0x1a3040, hasUnlocked ? 0.8 : 0.4);
      actTitleBg.setDepth(2);
      c.add(actTitleBg);
      const romanNum = ['I', 'II', 'III', 'IV', 'V'][act.actId - 1] || String(act.actId);
      c.add(this.scene.add.text(actX, baseY - 8, `ACT ${romanNum}`, fixTextStyle({
        fontFamily: 'monospace', fontSize: '14px', color: hasUnlocked ? '#66f0ff' : '#3a4350',
        stroke: '#000', strokeThickness: 3, letterSpacing: 3,
      })).setOrigin(0.5).setDepth(3));
      c.add(this.scene.add.text(actX, baseY + 10, act.actName, fixTextStyle({
        fontFamily: 'monospace', fontSize: '10px',
        color: hasUnlocked ? '#cfd6e0' : '#2a3040',
        stroke: '#000', strokeThickness: 2,
        wordWrap: { width: cardW - 16 }, align: 'center',
      })).setOrigin(0.5).setDepth(3));

      // ── Area cards inside this Act ──
      act.areas.forEach((area, areaIdx) => {
        const cardY = baseY + actTitleH + 20 + areaIdx * (cardH + cardGap) + cardH / 2;
        const previewH = 80;
        const previewW = cardW - 16;
        const previewY = cardY - cardH / 2 + 14 + previewH / 2;

        // Card background
        const cardBg = this.scene.add.rectangle(actX, cardY, cardW, cardH, area.unlocked ? 0x0a1018 : 0x05080c, 0.92);
        cardBg.setStrokeStyle(1, area.isCurrent ? 0x39d0d8 : area.unlocked ? 0x1a3040 : 0x0a1018, area.isCurrent ? 0.9 : 0.5);
        cardBg.setDepth(2);
        c.add(cardBg);

        // Preview frame
        const previewFrame = this.scene.add.rectangle(actX, previewY, previewW, previewH, 0x05080c, 1);
        previewFrame.setDepth(2.5);
        c.add(previewFrame);

        // Preview image
        const previewTexture = area.regionId === 'forest' ? 'factory_bg_1'
          : area.regionId === 'wastes' ? 'wastes_bg_1'
          : 'factory_bg_2';
        if (this.scene.textures.exists(previewTexture)) {
          const previewImg = this.scene.add.image(actX, previewY, previewTexture);
          previewImg.setDepth(2.6);
          const tex = this.scene.textures.get(previewTexture).getSourceImage();
          const imgAR = tex.width / tex.height;
          const frameAR = previewW / previewH;
          // "Contain" scaling: image fits entirely within frame (no overflow, no mask needed)
          // Phaser 4 WebGL doesn't support setMask() — using contain avoids the need
          let scale: number;
          if (imgAR > frameAR) {
            scale = previewW / tex.width;   // fit by width → height has padding
          } else {
            scale = previewH / tex.height;  // fit by height → width has padding
          }
          previewImg.setScale(scale);
          c.add(previewImg);
          if (!area.unlocked) {
            previewImg.setAlpha(0.2);
            previewImg.setTint(0x303030);
          } else if (area.isCurrent) {
            previewImg.setTint(0x99ddff);
          }
          // Gradient overlay
          const gradient = this.scene.add.rectangle(actX, previewY + previewH / 2 - 10, previewW, 20, 0x05080c, 0.7);
          gradient.setDepth(2.7);
          c.add(gradient);
        }

        // Preview border
        const previewBorder = this.scene.add.rectangle(actX, previewY, previewW, previewH, 0x000000, 0);
        previewBorder.setStrokeStyle(1, 0x1a3040, 0.8);
        previewBorder.setDepth(2.8);
        c.add(previewBorder);

        // Area name
        const nameY = previewY + previewH / 2 + 18;
        c.add(this.scene.add.text(actX, nameY, area.unlocked ? t(area.nameKey) : '🔒 ' + L('LOCKED', 'قفل'), fixTextStyle({
          fontFamily: 'monospace', fontSize: '12px',
          color: area.isCurrent ? '#66f0ff' : area.unlocked ? '#e0e8f0' : '#3a4350',
          stroke: '#000', strokeThickness: 3, wordWrap: { width: cardW - 10 }, align: 'center', letterSpacing: 1,
        })).setOrigin(0.5).setDepth(3));

        // Status
        let status = '';
        let statusColor = '#3a4350';
        if (area.isCurrent) { status = '◆ ' + L('CURRENT', 'فعلی'); statusColor = '#39d0d8'; }
        else if (area.bossDefeated) { status = '★ ' + L('CLEARED', 'تکمیل'); statusColor = '#ffc040'; }
        else if (area.hasBoss && area.unlocked) { status = '⚔ ' + L('BOSS', 'باس'); statusColor = '#ff6060'; }
        c.add(this.scene.add.text(actX, nameY + 18, status, fixTextStyle({
          fontFamily: 'monospace', fontSize: '8px', color: statusColor, letterSpacing: 1,
        })).setOrigin(0.5).setDepth(3));

        // Enter / locked
        if (area.unlocked) {
          const enterAction = () => {
            AudioSystem.play('uiClick');
            this.callbacks.onEnterArea(area.areaId);
          };
          this.nav.makeHubCardBtn(actX, nameY + 38, '▶ ' + L('ENTER', 'ورود'), enterAction);
        } else {
          c.add(this.scene.add.text(actX, nameY + 38, L('LOCKED', 'قفل'), fixTextStyle({
            fontFamily: 'monospace', fontSize: '9px', color: '#2a3040',
          })).setOrigin(0.5).setDepth(3));
        }
      });
    });

    // === Bottom bar: Navigation icons ===
    const navBarBg = this.scene.add.rectangle(w / 2, h - 55, w - 80, 56, 0x0a0d14, 0.85);
    navBarBg.setStrokeStyle(1, 0x1a3040, 0.5);
    navBarBg.setDepth(1.5);
    c.add(navBarBg);

    const navY = h - 55;
    const navItems: { icon: string; label: string; action: () => void }[] = [
      { icon: '⚙', label: L('HANGAR', 'هانگر'), action: () => this.callbacks.onOpenOverlay('hangar') },
      { icon: '⚔', label: L('SKILLS', 'مهارت‌ها'), action: () => this.callbacks.onOpenOverlay('skills') },
      { icon: '◈', label: L('INVENTORY', 'کیف'), action: () => this.callbacks.onOpenOverlay('inventory') },
      { icon: '▤', label: L('QUESTS', 'ماموریت‌ها'), action: () => this.callbacks.onOpenOverlay('quests') },
      { icon: '⌂', label: L('SETTINGS', 'تنظیمات'), action: () => this.callbacks.onOpenOverlay('settings') },
      { icon: '←', label: t('menu.back'), action: () => this.callbacks.onBackToMenu() },
    ];
    const navGap = 115;
    const navStartX = w / 2 - (navItems.length - 1) * navGap / 2;

    navItems.forEach((item, idx) => {
      const nx = navStartX + idx * navGap;
      this.nav.makeHubNavBtn(nx, navY, item.icon, item.label, item.action);
    });

    this.nav.setupNav();
  }

  /** Destroy — no special cleanup needed (container destroyed by GameScene). */
  destroy(): void {
    // No timers to clean up
  }
}

export default HubBuilder;
