/**
 * MECHA: LAST PROTOCOL — Boss Health Bar UI
 *
 * Self-contained UI component for displaying boss health during boss fights.
 * Extracted from GameScene to reduce God Object size.
 *
 * Lifecycle:
 *   - show(bossId)    → create bar + fade in
 *   - update(boss)    → refresh fill width + color shift
 *   - hide()          → destroy all objects
 *
 * Dependencies: scene (for add.* + tweens), BossEntity static data, localization.
 * No game state — purely presentational.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { BossEntity } from '../../entities/boss/BossEntity';
import { t, fixTextStyle } from '../../systems/LocalizationSystem';

export class BossHealthBarUI {
  private container: Phaser.GameObjects.Container | null = null;
  private fill: Phaser.GameObjects.Rectangle | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;

  constructor(private scene: Phaser.Scene) {}

  /** Create the health bar and fade it in. Destroys any existing bar first. */
  show(bossId: string): void {
    this.hide();
    const w = GAME.WIDTH;
    const barW = 600, barH = 16;
    const x = w / 2, y = 30;
    const container = this.scene.add.container(0, 0).setDepth(210).setScrollFactor(0);
    // BG
    const bg = this.scene.add.rectangle(x, y, barW + 4, barH + 4, 0x0a0d14, 0.9);
    bg.setStrokeStyle(1, 0xff4060, 0.5);
    container.add(bg);
    // Fill
    this.fill = this.scene.add.rectangle(x - barW / 2, y, barW, barH, 0xff4060, 0.9);
    this.fill.setOrigin(0, 0.5);
    container.add(this.fill);
    // Name
    const bossData = BossEntity.getBossData ? BossEntity.getBossData(bossId) : null;
    const bossName = bossData ? t(bossData.nameKey) : 'BOSS';
    this.nameText = this.scene.add.text(x, y - 18, bossName, fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: '#ff6080', stroke: '#000', strokeThickness: 3, letterSpacing: 3,
    })).setOrigin(0.5);
    container.add(this.nameText);
    // Fade in
    container.setAlpha(0);
    this.scene.tweens.add({ targets: container, alpha: 1, duration: 600, delay: 400 });
    this.container = container;
  }

  /** Update fill width + color based on boss health percentage. */
  update(boss: BossEntity): void {
    if (!this.fill) return;
    if (!boss.isAlive) return;
    const pct = boss.getHealthPct();
    this.fill.setDisplaySize(600 * pct, 16);
    // Color shift: red → amber as HP drops
    if (pct < 0.3) this.fill.setFillStyle(0xff2030, 0.9);
    else if (pct < 0.6) this.fill.setFillStyle(0xff8030, 0.9);
  }

  /** Destroy all UI objects. */
  hide(): void {
    if (this.container) { this.container.destroy(); this.container = null; }
    this.fill = null;
    this.nameText = null;
  }
}

export default BossHealthBarUI;
