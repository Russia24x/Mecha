/**
 * MECHA: LAST PROTOCOL — HUD UI
 * Always-visible in-game overlay. Depth 200 (above all game layers).
 * Polls PlayerEntity + ExperienceSystem every frame.
 * No shadow boxes behind text — clean look.
 */
import Phaser from 'phaser';
import { COLORS, GAME } from '../../shared/Constants';
import { t, getLocale } from '../../systems/LocalizationSystem';
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
  private levelText: Phaser.GameObjects.Text;
  private xpBarFg: Phaser.GameObjects.Rectangle;
  private checkpointText: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, private player: PlayerEntity) {
    this.scene = scene;
    const w = GAME.WIDTH;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    // Panel (clean, no shadow)
    const panel = scene.add.rectangle(20, 20, 360, 96, 0x0a0d14, 0.7);
    panel.setOrigin(0, 0).setStrokeStyle(1, 0x2a3340, 0.9);
    this.container.add(panel);

    // Health bar
    const hBg = scene.add.rectangle(40, 36, 320, 14, 0x202830).setOrigin(0, 0.5);
    this.healthBarFg = scene.add.rectangle(40, 36, 320, 14, COLORS.HEALTH).setOrigin(0, 0.5);
    this.healthText = scene.add.text(40, 22, '150/150', { fontFamily: 'monospace', fontSize: '12px', color: '#9be0b0' });
    this.container.add([hBg, this.healthBarFg, this.healthText]);

    // Energy bar
    const eBg = scene.add.rectangle(40, 64, 320, 10, 0x202830).setOrigin(0, 0.5);
    this.energyBarFg = scene.add.rectangle(40, 64, 320, 10, COLORS.ENERGY).setOrigin(0, 0.5);
    this.energyText = scene.add.text(40, 50, '100/100', { fontFamily: 'monospace', fontSize: '10px', color: '#7eb0ff' });
    this.container.add([eBg, this.energyBarFg, this.energyText]);

    // Section title (center top)
    this.sectionText = scene.add.text(w / 2, 24, t('section.1.name'), {
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0',
    }).setOrigin(0.5, 0);
    this.container.add(this.sectionText);

    // Controls hint (bottom)
    const hint = scene.add.text(20, GAME.HEIGHT - 24, 'WASD:Move  SPACE:Jump  SHIFT:Dash  J:Fire  K:Melee  ESC:Pause', {
      fontFamily: 'monospace', fontSize: '10px', color: '#3a4350',
    });
    this.container.add(hint);

    // Weapon indicator (top right)
    this.weaponText = scene.add.text(w - 20, 24, 'ASSAULT RIFLE', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffe060',
    }).setOrigin(1, 0);
    this.container.add(this.weaponText);

    // Level + XP bar (below weapon)
    this.levelText = scene.add.text(w - 20, 44, 'Lv1 0/100 SP:0', {
      fontFamily: 'monospace', fontSize: '11px', color: '#9be0b0',
    }).setOrigin(1, 0);
    this.container.add(this.levelText);
    const xpBarBg = scene.add.rectangle(w - 150, 64, 130, 6, 0x202830).setOrigin(0, 0.5);
    this.xpBarFg = scene.add.rectangle(w - 150, 64, 130, 6, 0x40d070).setOrigin(0, 0.5);
    this.container.add([xpBarBg, this.xpBarFg]);

    // Checkpoint toast (center bottom)
    this.checkpointText = scene.add.text(w / 2, GAME.HEIGHT - 60, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffe060',
    }).setOrigin(0.5, 0.5);
    this.checkpointText.setAlpha(0);
    this.container.add(this.checkpointText);
  }

  update(): void {
    if (!this.player || !this.player.sprite || !this.player.sprite.active) return;
    const hp = this.player.health;
    const ep = this.player.energy;
    this.healthBarFg.setDisplaySize(320 * Math.max(0, hp.current / hp.max), 14);
    this.healthText.setText(`${Math.ceil(hp.current)}/${hp.max}`);
    this.energyBarFg.setDisplaySize(320 * Math.max(0, ep.current / ep.max), 10);
    this.energyText.setText(`${Math.ceil(ep.current)}/${ep.max}`);

    // Weapon name + upgrade level
    const weapon = getWeapon(this.player.weapon);
    const wLevel = WeaponUpgradeSystem.getLevel(this.player.weapon);
    this.weaponText.setText(`${t(weapon.nameKey).toUpperCase()} +${wLevel}`);

    // Level + XP
    const level = ExperienceSystem.getLevel();
    const xp = ExperienceSystem.getXP();
    const xpNeeded = ExperienceSystem.getXPForNextLevel();
    const sp = ExperienceSystem.getSkillPoints();
    this.levelText.setText(`Lv${level} ${xp}/${xpNeeded} SP:${sp}`);
    this.xpBarFg.setDisplaySize(130 * ExperienceSystem.getLevelProgress(), 6);
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
