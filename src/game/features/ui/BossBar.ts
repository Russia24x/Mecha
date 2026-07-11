/**
 * MECHA: LAST PROTOCOL - BossBar
 * Boss health bar at top of screen. Depth 200 (above darkness).
 */

import Phaser from 'phaser';
import { COLORS, GAME } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';
import type { Boss } from '../boss/Boss';

export class BossBar {
  private container: Phaser.GameObjects.Container;
  private barFg: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private phaseText: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private visible = false;

  constructor(scene: Phaser.Scene, public boss: Boss | null) {
    this.scene = scene;
    const w = GAME.WIDTH;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0).setVisible(false);
    const bg = scene.add.rectangle(w / 2, 60, 600, 36, 0x0a0d14, 0.85).setStrokeStyle(1, COLORS.BOSS, 0.6);
    bg.setOrigin(0.5, 0.5);
    this.container.add(bg);
    const barBg = scene.add.rectangle(w / 2, 60, 580, 14, 0x202830).setOrigin(0.5, 0.5);
    this.container.add(barBg);
    this.barFg = scene.add.rectangle(w / 2 - 290, 60, 580, 14, COLORS.BOSS).setOrigin(0, 0.5);
    this.container.add(this.barFg);
    this.nameText = scene.add.text(w / 2, 42, 'GUARDIAN AX-09', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ff6060',
    }).setOrigin(0.5, 1);
    this.container.add(this.nameText);
    this.phaseText = scene.add.text(w / 2, 76, 'PHASE 1', {
      fontFamily: 'monospace', fontSize: '10px', color: '#7a8090',
    }).setOrigin(0.5, 0);
    this.container.add(this.phaseText);

    EventBus.on('BOSS_PHASE', (p: unknown) => {
      const data = p as { phase?: number; healthPct?: number; dead?: boolean };
      if (data.dead) { this.hide(); return; }
      if (data.phase) this.phaseText.setText(`PHASE ${data.phase}`);
    });
  }

  show(): void { this.visible = true; this.container.setVisible(true); }
  hide(): void { this.visible = false; this.container.setVisible(false); }

  update(): void {
    if (!this.visible || !this.boss || !this.boss.isAlive) return;
    const pct = Math.max(0, (this.boss as unknown as { health: number; maxHealth: number }).health / (this.boss as unknown as { health: number; maxHealth: number }).maxHealth);
    this.barFg.setDisplaySize(580 * pct, 14);
  }

  destroy(): void {
    EventBus.off('BOSS_PHASE');
    this.container.destroy();
  }
}

export default BossBar;
