/**
 * MECHA: LAST PROTOCOL — HUD UI v2
 * Clean cyberpunk-style HUD. Depth 200 (above all game layers).
 * No shadow boxes — uses accent lines and minimal panels.
 */
import Phaser from 'phaser';
import { COLORS, GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import { getWeapon } from '../../data/weapons/weapons';
import { WeaponUpgradeSystem } from '../../systems/WeaponUpgradeSystem';
import type { PlayerEntity } from '../../entities/player/PlayerEntity';

export class HUDUI {
  private container: Phaser.GameObjects.Container;
  private healthBarFg: Phaser.GameObjects.Rectangle;
  private energyBarFg: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private energyText: Phaser.GameObjects.Text;
  private sectionText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private weaponIcon: Phaser.GameObjects.Rectangle;
  private levelText: Phaser.GameObjects.Text;
  private xpBarFg: Phaser.GameObjects.Rectangle;
  private checkpointText: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, private player: PlayerEntity) {
    this.scene = scene;
    const w = GAME.WIDTH;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0, 0, true);

    // === LEFT PANEL: Health + Energy ===
    // Accent line above bars
    const accentLine = scene.add.rectangle(40, 18, 340, 2, 0x39d0d8, 0.4);
    accentLine.setOrigin(0, 0);
    this.container.add(accentLine);

    // HP label
    this.container.add(scene.add.text(40, 24, 'HP', {
      fontFamily: 'monospace', fontSize: '9px', color: '#2a6040',
    }));

    // Health bar — thin, with accent color
    const hBg = scene.add.rectangle(40, 42, 320, 12, 0x0a0d14, 1);
    hBg.setOrigin(0, 0.5).setStrokeStyle(1, 0x1a2030, 1);
    this.healthBarFg = scene.add.rectangle(41, 42, 318, 10, COLORS.HEALTH).setOrigin(0, 0.5);
    this.healthText = scene.add.text(365, 42, '150', {
      fontFamily: 'monospace', fontSize: '11px', color: '#40d070',
    }).setOrigin(0, 0.5);
    this.container.add([hBg, this.healthBarFg, this.healthText]);

    // EN label
    this.container.add(scene.add.text(40, 52, 'EN', {
      fontFamily: 'monospace', fontSize: '9px', color: '#204060',
    }));

    // Energy bar
    const eBg = scene.add.rectangle(40, 68, 320, 8, 0x0a0d14, 1);
    eBg.setOrigin(0, 0.5).setStrokeStyle(1, 0x1a2030, 1);
    this.energyBarFg = scene.add.rectangle(41, 68, 318, 6, COLORS.ENERGY).setOrigin(0, 0.5);
    this.energyText = scene.add.text(365, 68, '100', {
      fontFamily: 'monospace', fontSize: '10px', color: '#4090ff',
    }).setOrigin(0, 0.5);
    this.container.add([eBg, this.energyBarFg, this.energyText]);

    // === CENTER: Section title ===
    this.sectionText = scene.add.text(w / 2, 28, t('section.1.name'), {
      fontFamily: 'monospace', fontSize: '13px', color: '#3a4350',
    }).setOrigin(0.5, 0);
    this.container.add(this.sectionText);
    // Section underline
    const secLine = scene.add.rectangle(w / 2, 46, 200, 1, 0x1a2030, 0.6);
    this.container.add(secLine);

    // === RIGHT PANEL: Weapon + Level/XP ===
    // Accent line
    const rAccent = scene.add.rectangle(w - 360, 18, 340, 2, 0x39d0d8, 0.4);
    rAccent.setOrigin(0, 0);
    this.container.add(rAccent);

    // Weapon icon (colored square matching weapon color)
    this.weaponIcon = scene.add.rectangle(w - 360, 42, 16, 16, COLORS.PROJECTILE, 0.8);
    this.weaponIcon.setOrigin(0, 0.5);
    this.weaponIcon.setStrokeStyle(1, 0x1a2030, 0.8);
    this.container.add(this.weaponIcon);

    // Weapon name + level
    this.weaponText = scene.add.text(w - 340, 42, 'ASSAULT RIFLE +1', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffe060',
    }).setOrigin(0, 0.5);
    this.container.add(this.weaponText);

    // Level + XP bar
    this.levelText = scene.add.text(w - 360, 62, 'Lv1 0/100 SP:0', {
      fontFamily: 'monospace', fontSize: '10px', color: '#40d070',
    }).setOrigin(0, 0.5);
    this.container.add(this.levelText);

    // XP bar — thin line
    const xpBarBg = scene.add.rectangle(w - 200, 68, 180, 5, 0x0a0d14, 1);
    xpBarBg.setOrigin(0, 0.5).setStrokeStyle(1, 0x1a2030, 1);
    this.xpBarFg = scene.add.rectangle(w - 199, 68, 178, 3, 0x40d070).setOrigin(0, 0.5);
    this.container.add([xpBarBg, this.xpBarFg]);

    // === BOTTOM: Controls hint ===
    const hint = scene.add.text(w / 2, GAME.HEIGHT - 18, 'WASD MOVE · SPACE JUMP · SHIFT DASH · J FIRE · K MELEE · ESC PAUSE', {
      fontFamily: 'monospace', fontSize: '9px', color: '#1a2030',
    }).setOrigin(0.5, 0.5);
    this.container.add(hint);

    // === Checkpoint toast ===
    this.checkpointText = scene.add.text(w / 2, GAME.HEIGHT - 50, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffe060', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5);
    this.checkpointText.setAlpha(0);
    this.container.add(this.checkpointText);

    // setScrollFactor(0,0,true) AFTER all children are added
    this.container.setScrollFactor(0, 0, true);
  }

  update(): void {
    if (!this.player || !this.player.sprite || !this.player.sprite.active) return;
    const hp = this.player.health;
    const ep = this.player.energy;
    this.healthBarFg.setDisplaySize(318 * Math.max(0, hp.current / hp.max), 10);
    this.healthText.setText(`${Math.ceil(hp.current)}`);
    this.energyBarFg.setDisplaySize(318 * Math.max(0, ep.current / ep.max), 6);
    this.energyText.setText(`${Math.ceil(ep.current)}`);

    // Weapon
    const weapon = getWeapon(this.player.weapon);
    const wLevel = WeaponUpgradeSystem.getLevel(this.player.weapon);
    this.weaponText.setText(`${t(weapon.nameKey).toUpperCase()} +${wLevel}`);
    this.weaponIcon.setFillStyle(weapon.color, 0.8);

    // Level + XP
    const level = ExperienceSystem.getLevel();
    const xp = ExperienceSystem.getXP();
    const xpNeeded = ExperienceSystem.getXPForNextLevel();
    const sp = ExperienceSystem.getSkillPoints();
    this.levelText.setText(`Lv${level} ${xp}/${xpNeeded} SP:${sp}`);
    this.xpBarFg.setDisplaySize(178 * ExperienceSystem.getLevelProgress(), 3);
  }

  setSection(nameKey: string): void {
    this.sectionText.setText(t(nameKey).toUpperCase());
  }

  toast(msg: string): void {
    this.checkpointText.setText(msg);
    this.checkpointText.setAlpha(0);
    this.scene.tweens.add({
      targets: this.checkpointText,
      alpha: { from: 0, to: 1 },
      duration: 200, yoyo: true, hold: 1200,
      onComplete: () => this.checkpointText.setAlpha(0),
    });
  }

  destroy(): void {
    this.container.destroy();
  }
}

export default HUDUI;
