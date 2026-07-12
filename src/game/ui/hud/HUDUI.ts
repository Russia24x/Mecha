/**
 * MECHA: LAST PROTOCOL — HUD UI v3.0
 *
 * REDESIGNED: Neural Cortex aesthetic (Mecha circuit HUD).
 * Inspired by Blasphemous (dark UI, corner accents), Armored Core 6
 * (tactical stats, hexagonal elements, amber/cyan palette).
 *
 * Layout:
 *   ┌─[ TOP-LEFT ]─────────────┬─[ TOP-CENTER ]──┬─[ TOP-RIGHT ]──────────┐
 *   │ ╔═══ HP ████████░░ 150  │  SECTOR NAME     │  ▣ ASSAULT RIFLE +1   │
 *   │ ║   EN ██████░░░░ 100   │  ─────────────   │  Lv5  XP██░░░ SP:3    │
 *   │ ╚═══                    │                  │                        │
 *   └─────────────────────────┴──────────────────┴────────────────────────┘
 */
import Phaser from 'phaser';
import { COLORS, GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import { getWeapon } from '../../data/weapons/weapons';
import { WeaponUpgradeSystem } from '../../systems/WeaponUpgradeSystem';
import { THEME, addCornerBrackets } from '../Theme';
import type { PlayerEntity } from '../../entities/player/PlayerEntity';

export class HUDUI {
  private container: Phaser.GameObjects.Container;
  private healthBarFg: Phaser.GameObjects.Rectangle;
  private energyBarFg: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private energyText: Phaser.GameObjects.Text;
  private sectionText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private weaponIcon: Phaser.GameObjects.Polygon;
  private levelText: Phaser.GameObjects.Text;
  private xpBarFg: Phaser.GameObjects.Rectangle;
  private checkpointText: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private lowHpVignette: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, private player: PlayerEntity) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0, 0, true);

    // === LEFT PANEL: Hull (HP) + Core (Energy) ===
    // Panel background with corner brackets
    const leftBg = scene.add.rectangle(20, 20, 360, 64, THEME.BG_PANEL, 0.85);
    leftBg.setOrigin(0, 0).setStrokeStyle(1, THEME.STROKE_DIM, 0.6);
    this.container.add(leftBg);
    this.container.add(addCornerBrackets(scene, 20 + 180, 20 + 32, 360, 64, THEME.CYAN, 6, 0.5));

    // HULL label (was HP — Mecha terminology)
    this.container.add(scene.add.text(30, 26, 'HULL', {
      fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_DIM, letterSpacing: 2,
    }));
    // Hull bar
    const hBg = scene.add.rectangle(30, 42, 280, 10, THEME.BG_DARK, 1);
    hBg.setOrigin(0, 0.5).setStrokeStyle(1, THEME.STROKE_DIM, 1);
    this.healthBarFg = scene.add.rectangle(31, 42, 278, 8, COLORS.HEALTH).setOrigin(0, 0.5);
    this.healthText = scene.add.text(320, 42, '150', {
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_GREEN, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.container.add([hBg, this.healthBarFg, this.healthText]);

    // CORE label (was EN)
    this.container.add(scene.add.text(30, 54, 'CORE', {
      fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_DIM, letterSpacing: 2,
    }));
    // Core bar
    const eBg = scene.add.rectangle(30, 68, 280, 8, THEME.BG_DARK, 1);
    eBg.setOrigin(0, 0.5).setStrokeStyle(1, THEME.STROKE_DIM, 1);
    this.energyBarFg = scene.add.rectangle(31, 68, 278, 6, COLORS.ENERGY).setOrigin(0, 0.5);
    this.energyText = scene.add.text(320, 68, '100', {
      fontFamily: 'monospace', fontSize: '10px', color: '#4090ff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.container.add([eBg, this.energyBarFg, this.energyText]);

    // === CENTER: Sector name ===
    this.sectionText = scene.add.text(w / 2, 30, t('section.1.name'), {
      fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_MED, letterSpacing: 3,
    }).setOrigin(0.5, 0);
    this.container.add(this.sectionText);
    // Sector underline with circuit dots
    this.container.add(scene.add.rectangle(w / 2 - 80, 48, 160, 1, THEME.STROKE_MED, 0.6).setOrigin(0, 0.5));
    this.container.add(scene.add.circle(w / 2 - 80, 48, 2, THEME.CYAN, 0.6));
    this.container.add(scene.add.circle(w / 2 + 80, 48, 2, THEME.CYAN, 0.6));

    // === RIGHT PANEL: Weapon + Level/XP ===
    const rightBg = scene.add.rectangle(w - 380, 20, 360, 64, THEME.BG_PANEL, 0.85);
    rightBg.setOrigin(0, 0).setStrokeStyle(1, THEME.STROKE_DIM, 0.6);
    this.container.add(rightBg);
    this.container.add(addCornerBrackets(scene, w - 380 + 180, 20 + 32, 360, 64, THEME.AMBER, 6, 0.5));

    // Weapon icon (hexagon — circuit node)
    this.weaponIcon = scene.add.polygon(w - 370, 42, [
      { x: 0, y: -8 }, { x: 7, y: -4 }, { x: 7, y: 4 }, { x: 0, y: 8 }, { x: -7, y: 4 }, { x: -7, y: -4 },
    ], COLORS.PROJECTILE, 0.8);
    this.weaponIcon.setStrokeStyle(1, THEME.STROKE_DIM, 0.8);
    this.container.add(this.weaponIcon);

    // Weapon name
    this.weaponText = scene.add.text(w - 355, 42, 'ASSAULT RIFLE +1', {
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.container.add(this.weaponText);

    // Level + XP
    this.levelText = scene.add.text(w - 370, 62, 'LV.1  0/100  ◆0', {
      fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_GREEN, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.container.add(this.levelText);

    // XP bar
    const xpBarBg = scene.add.rectangle(w - 210, 68, 170, 5, THEME.BG_DARK, 1);
    xpBarBg.setOrigin(0, 0.5).setStrokeStyle(1, THEME.STROKE_DIM, 1);
    this.xpBarFg = scene.add.rectangle(w - 209, 68, 168, 3, THEME.AMBER).setOrigin(0, 0.5);
    this.container.add([xpBarBg, this.xpBarFg]);

    // === Low HP vignette (red pulse when HP < 30%) ===
    this.lowHpVignette = scene.add.rectangle(w / 2, h / 2, w, h, 0xff0030, 0);
    this.lowHpVignette.setBlendMode(Phaser.BlendModes.ADD);
    this.lowHpVignette.setDepth(199);  // below HUD but above game
    this.container.add(this.lowHpVignette);

    // === Checkpoint toast ===
    this.checkpointText = scene.add.text(w / 2, h - 60, '', {
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 3, letterSpacing: 2,
    }).setOrigin(0.5, 0.5);
    this.checkpointText.setAlpha(0);
    this.container.add(this.checkpointText);

    this.container.setScrollFactor(0, 0, true);
  }

  update(): void {
    if (!this.player || !this.player.sprite || !this.player.sprite.active) return;
    const hp = this.player.health;
    const ep = this.player.energy;
    const hpPct = Math.max(0, hp.current / hp.max);
    const epPct = Math.max(0, ep.current / ep.max);

    this.healthBarFg.setDisplaySize(278 * hpPct, 8);
    this.healthText.setText(`${Math.ceil(hp.current)}`);
    // Color shift: green → amber → red
    if (hpPct < 0.3) {
      this.healthBarFg.setFillStyle(0xff4060);
      this.healthText.setColor(THEME.TEXT_RED);
      // Low HP vignette pulse
      const pulse = 0.15 + Math.sin(this.scene.time.now * 0.008) * 0.1;
      this.lowHpVignette.setAlpha(pulse);
    } else if (hpPct < 0.6) {
      this.healthBarFg.setFillStyle(0xffc040);
      this.healthText.setColor(THEME.TEXT_AMBER);
      this.lowHpVignette.setAlpha(0);
    } else {
      this.healthBarFg.setFillStyle(COLORS.HEALTH);
      this.healthText.setColor(THEME.TEXT_GREEN);
      this.lowHpVignette.setAlpha(0);
    }

    this.energyBarFg.setDisplaySize(278 * epPct, 6);
    this.energyText.setText(`${Math.ceil(ep.current)}`);

    // Weapon
    const weapon = getWeapon(this.player.weapon);
    const wLevel = WeaponUpgradeSystem.getLevel(this.player.weapon);
    this.weaponText.setText(`${t(weapon.nameKey).toUpperCase()} +${wLevel}`);
    this.weaponIcon.setFillStyle(weapon.color, 0.85);

    // Level + XP
    const level = ExperienceSystem.getLevel();
    const xp = ExperienceSystem.getXP();
    const xpNeeded = ExperienceSystem.getXPForNextLevel();
    const sp = ExperienceSystem.getSkillPoints();
    this.levelText.setText(`LV.${level}  ${xp}/${xpNeeded}  ◆${sp}`);
    this.xpBarFg.setDisplaySize(168 * ExperienceSystem.getLevelProgress(), 3);
  }

  setSection(nameKey: string): void {
    this.sectionText.setText(t(nameKey).toUpperCase());
  }

  toast(msg: string): void {
    this.checkpointText.setText(msg);
    this.checkpointText.setAlpha(0);
    // Kill existing tweens to prevent stacking
    this.scene.tweens.killTweensOf(this.checkpointText);
    this.scene.tweens.add({
      targets: this.checkpointText,
      alpha: { from: 0, to: 1 },
      duration: 200, yoyo: true, hold: 1200,
      onComplete: () => this.checkpointText.setAlpha(0),
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.checkpointText);
    this.container.destroy();
  }
}

export default HUDUI;
