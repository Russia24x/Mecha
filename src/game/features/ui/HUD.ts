/**
 * MECHA: LAST PROTOCOL - HUD
 * Polls player state every frame. No EventBus subscriptions for health/energy.
 * Depth 100+ — renders ABOVE darkness overlay (depth 90) so HUD is always visible.
 */

import Phaser from 'phaser';
import { COLORS, GAME, PLAYER } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';
import { GamepadManager } from '../../shared/GamepadManager';
import type { Player } from '../player/Player';

export class HUD {
  private container: Phaser.GameObjects.Container;
  private healthBarFg: Phaser.GameObjects.Rectangle;
  private energyBarFg: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private energyText: Phaser.GameObjects.Text;
  private sectionText: Phaser.GameObjects.Text;
  private checkpointText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, private player: Player) {
    this.scene = scene;
    const w = GAME.WIDTH;
    // HUD container at depth 200 — above ALL overlays (darkness=90, boss lore=250 uses depth 251 but is full-screen black)
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    // Panel (no shadow/box behind text — clean look)
    const panel = scene.add.rectangle(20, 20, 360, 96, 0x0a0d14, 0.7);
    panel.setOrigin(0, 0).setStrokeStyle(1, 0x2a3340, 0.9);
    this.container.add(panel);

    // Health bar — no shadow, just clean bar + text
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
    this.sectionText = scene.add.text(w / 2, 24, 'SECTION 1 — TUTORIAL ZONE', {
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0',
    }).setOrigin(0.5, 0);
    this.container.add(this.sectionText);

    // Controls hint
    const hint = scene.add.text(20, GAME.HEIGHT - 24, 'WASD:Move  SPACE:Jump  SHIFT:Dash  J:Fire  K:Melee  ESC:Pause', {
      fontFamily: 'monospace', fontSize: '10px', color: '#3a4350',
    });
    this.container.add(hint);

    // Weapon indicator
    this.weaponText = scene.add.text(w - 20, 24, 'PLASMA RIFLE', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffe060',
    }).setOrigin(1, 0);
    this.container.add(this.weaponText);

    // Checkpoint toast
    this.checkpointText = scene.add.text(w / 2, GAME.HEIGHT - 60, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffe060',
    }).setOrigin(0.5, 0.5);
    this.checkpointText.setAlpha(0);
    this.container.add(this.checkpointText);

    EventBus.on('CHECKPOINT', () => this.flashCheckpoint('CHECKPOINT SAVED'));
    EventBus.on('GAME_STATE', (p: unknown) => {
      const data = p as { sectionId?: number; sectionName?: string };
      if (data.sectionId && data.sectionName) {
        this.sectionText.setText(`SECTION ${data.sectionId} — ${data.sectionName.toUpperCase()}`);
      }
    });
  }

  update(): void {
    if (!this.player || !this.player.sprite || !this.player.sprite.active) return;
    const hp = this.player.health;
    const ep = this.player.energy;
    this.healthBarFg.setDisplaySize(320 * Math.max(0, hp.current / hp.max), 14);
    this.healthText.setText(`${Math.ceil(hp.current)}/${hp.max}`);
    this.energyBarFg.setDisplaySize(320 * Math.max(0, ep.current / ep.max), 10);
    this.energyText.setText(`${Math.ceil(ep.current)}/${ep.max}`);
    this.weaponText.setText('PLASMA RIFLE');
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
    EventBus.off('CHECKPOINT');
    EventBus.off('GAME_STATE');
    this.container.destroy();
  }
}

export default HUD;
