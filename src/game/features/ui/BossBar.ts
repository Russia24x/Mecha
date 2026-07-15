/**
 * MECHA: LAST PROTOCOL - BossBar
 * Polls boss health directly each frame. Only listens to BOSS_PHASE event
 * for show/hide + phase name changes.
 */
import Phaser from 'phaser';
import { COLORS, GAME } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';
import type { Boss } from '../boss/Boss';

export class BossBar {
  private container: Phaser.GameObjects.Container;
  private barFg: Phaser.GameObjects.Rectangle;
  private phaseText: Phaser.GameObjects.Text;
  private visible = false;
  private phaseHandler: ((p: unknown) => void) | null = null;

  constructor(scene: Phaser.Scene, private boss: Boss | null = null) {
    const w = GAME.WIDTH;
    this.container = scene.add.container(0, 0).setDepth(110).setScrollFactor(0).setVisible(false);
    const panel = scene.add.rectangle(w / 2, 70, 760, 60, 0x0a0d14, 0.8).setStrokeStyle(1, 0x6a1818, 0.9);
    this.container.add(panel);
    this.container.add(scene.add.text(w / 2, 52, 'GUARDIAN AX-09', { fontFamily: 'monospace', fontSize: '16px', color: '#ff8080', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0.5));
    const barBg = scene.add.rectangle(w / 2, 80, 720, 12, 0x2a1010).setOrigin(0.5, 0.5);
    this.barFg = scene.add.rectangle(w / 2, 80, 720, 12, COLORS.BOSS).setOrigin(0.5, 0.5);
    this.phaseText = scene.add.text(w / 2, 100, '', { fontFamily: 'monospace', fontSize: '11px', color: '#c0c0c0' }).setOrigin(0.5, 0.5);
    this.container.add([barBg, this.barFg, this.phaseText]);

    this.phaseHandler = (p: unknown) => {
      const data = p as { phaseName?: string; phase?: number; type?: string };
      if (data.type === 'dead' || data.type === 'hidden') {
        this.hide();
      } else if (data.phaseName) {
        this.phaseText.setText(`${data.phaseName}  [PHASE ${(data.phase ?? 0) + 1}/3]`);
        this.show();
      }
    };
    EventBus.on('BOSS_PHASE', this.phaseHandler, this);
  }

  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.container.setVisible(true);
  }

  hide(): void { this.visible = false; this.container.setVisible(false); }

  /** Called every frame by GameScene — polls boss health directly. */
  update(): void {
    if (!this.boss || !this.boss.isAlive || !this.boss.sprite?.active) {
      if (this.visible) this.hide();
      return;
    }
    this.barFg.setDisplaySize(720 * Math.max(0, this.boss.health / this.boss.maxHealth), 12);
  }

  destroy(): void {
    if (this.phaseHandler) EventBus.off('BOSS_PHASE', this.phaseHandler, this);
    this.container.destroy();
  }
}

export default BossBar;
