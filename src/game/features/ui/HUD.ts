/**
 * MECHA: LAST PROTOCOL - HUD
 * Polls player + boss directly each frame. No EventBus subscriptions for
 * health/energy/weapon — those are read inline. Only listens to CHECKPOINT
 * and GAME_STATE events (section change).
 */
import Phaser from 'phaser';
import { COLORS, GAME } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';
import { GamepadManager } from '../../shared/GamepadManager';
import { SkillTree } from '../../shared/SkillTree';
import { getWeapon, type WeaponId } from '../combat/Weapons';
import type { Player } from '../player/Player';
import type { Boss } from '../boss/Boss';

export class HUD {
  private container: Phaser.GameObjects.Container;
  private healthBarFg: Phaser.GameObjects.Rectangle;
  private energyBarFg: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private energyText: Phaser.GameObjects.Text;
  private sectionText: Phaser.GameObjects.Text;
  private checkpointText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private levelText: Phaser.GameObjects.Text;
  private xpBarFg: Phaser.GameObjects.Rectangle;
  private scene: Phaser.Scene;
  private checkpointHandler: (() => void) | null = null;
  private gameStateHandler: ((p: unknown) => void) | null = null;

  constructor(scene: Phaser.Scene, private player: Player, private boss: Boss | null = null) {
    this.scene = scene;
    const w = GAME.WIDTH;
    this.container = scene.add.container(0, 0).setDepth(100).setScrollFactor(0);

    // Panel
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

    // Section title
    this.sectionText = scene.add.text(w / 2, 24, 'SECTION 1 — TUTORIAL ZONE', { fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0' }).setOrigin(0.5, 0);
    this.container.add(this.sectionText);

    // Controls hint (compact, single line)
    const hint = scene.add.text(20, GAME.HEIGHT - 24, 'WASD:Move  SPACE:Jump  SHIFT:Dash  J:Fire  K:Melee  1-4:Weapons  ESC:Pause', {
      fontFamily: 'monospace', fontSize: '10px', color: '#3a4350',
    });
    this.container.add(hint);

    // Weapon indicator
    this.weaponText = scene.add.text(w - 20, 24, 'PLASMA RIFLE', { fontFamily: 'monospace', fontSize: '13px', color: '#ffe060', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 0);
    this.container.add(this.weaponText);

    // Level + XP bar (below weapon indicator)
    this.levelText = scene.add.text(w - 20, 44, 'Lv1 0/100 SP:0', { fontFamily: 'monospace', fontSize: '11px', color: '#9be0b0', stroke: '#000', strokeThickness: 2 }).setOrigin(1, 0);
    this.container.add(this.levelText);
    const xpBarBg = scene.add.rectangle(w - 150, 64, 130, 6, 0x202830).setOrigin(0, 0.5);
    this.xpBarFg = scene.add.rectangle(w - 150, 64, 130, 6, 0x40d070).setOrigin(0, 0.5);
    this.container.add([xpBarBg, this.xpBarFg]);

    // Gamepad indicator (moved below XP bar to avoid overlap)
    const gpText = scene.add.text(w - 20, 78, '', { fontFamily: 'monospace', fontSize: '10px', color: '#5a6470' }).setOrigin(1, 0);
    this.container.add(gpText);
    scene.time.addEvent({ delay: 1000, loop: true, callback: () => { gpText.setText(GamepadManager.isAvailable() ? 'GAMEPAD' : ''); } });

    // Checkpoint toast
    this.checkpointText = scene.add.text(w / 2, GAME.HEIGHT - 60, '', { fontFamily: 'monospace', fontSize: '18px', color: '#ffe060', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 0.5);
    this.checkpointText.setAlpha(0);
    this.container.add(this.checkpointText);

    // Events — only 2
    this.checkpointHandler = () => this.flashCheckpoint('CHECKPOINT SAVED');
    this.gameStateHandler = (p: unknown) => {
      const data = p as { type?: string; sectionId?: number; sectionName?: string };
      if (data.sectionId && data.sectionName) {
        this.sectionText.setText(`SECTION ${data.sectionId} — ${data.sectionName.toUpperCase()}`);
      }
    };
    EventBus.on('CHECKPOINT', this.checkpointHandler, this);
    EventBus.on('GAME_STATE', this.gameStateHandler, this);
  }

  /** Called every frame by GameScene — polls player state directly. */
  update(): void {
    if (!this.player || !this.player.sprite || !this.player.sprite.active) return;
    const hp = this.player.health;
    const ep = this.player.energy;
    // Compact HUD: HP / EN bars with short labels
    this.healthBarFg.setDisplaySize(320 * Math.max(0, hp.current / hp.max), 14);
    this.healthText.setText(`${Math.ceil(hp.current)}/${hp.max}`);
    this.energyBarFg.setDisplaySize(320 * Math.max(0, ep.current / ep.max), 10);
    this.energyText.setText(`${Math.ceil(ep.current)}/${ep.max}`);
    // Weapon — short name
    const weaponName = getWeapon(this.player.weapon as WeaponId).name;
    this.weaponText.setText(weaponName.toUpperCase());
    // Level + XP — compact: "Lv3 XP 50/173 SP:1"
    // Defensive Number() coercion prevents "[object Object]" if save data is corrupted.
    const skills = SkillTree.get();
    const xpNeeded = Number(SkillTree.xpForLevel(skills.level)) || 0;
    const lvl = Number(skills.level) || 0;
    const xp = Number(skills.xp) || 0;
    const sp = Number(skills.skillPoints) || 0;
    this.levelText.setText(`Lv${lvl} ${xp}/${xpNeeded} SP:${sp}`);
    this.xpBarFg.setDisplaySize(130 * SkillTree.getLevelProgress(), 6);
  }

  private flashCheckpoint(msg: string): void {
    this.checkpointText.setText(msg);
    this.checkpointText.setAlpha(0);
    this.scene.tweens.add({
      targets: this.checkpointText,
      alpha: { from: 0, to: 1 },
      duration: 200, yoyo: true, hold: 1200,
      onComplete: () => this.checkpointText.setAlpha(0),
    });
  }

  toast(msg: string): void { this.flashCheckpoint(msg); }

  destroy(): void {
    if (this.checkpointHandler) EventBus.off('CHECKPOINT', this.checkpointHandler, this);
    if (this.gameStateHandler) EventBus.off('GAME_STATE', this.gameStateHandler, this);
    this.container.destroy();
  }
}

export default HUD;
