/**
 * MECHA: LAST PROTOCOL - FloatingText
 * Damage numbers, hit markers, combo counter.
 * Static methods — call from anywhere (Projectile, Hitscan, DamageSystem).
 */
import Phaser from 'phaser';
import { Effects } from '../../shared/Effects';

export class FloatingText {
  private static scene: Phaser.Scene | null = null;
  private static comboCount = 0;
  private static comboTimer: Phaser.Time.TimerEvent | null = null;
  private static comboText: Phaser.GameObjects.Text | null = null;

  static init(scene: Phaser.Scene): void {
    this.scene = scene;
    this.comboText = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#ffe060',
      stroke: '#000',
      strokeThickness: 4,
    }).setDepth(150).setScrollFactor(0);
    this.comboText.setVisible(false);
  }

  /** Show a damage number floating up from (x, y). */
  static damage(x: number, y: number, amount: number, color = 0xff8080, big = false): void {
    if (!this.scene) return;
    const txt = this.scene.add.text(x, y, `-${Math.round(amount)}`, {
      fontFamily: 'monospace',
      fontSize: big ? '26px' : '16px',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(120);
    this.scene.tweens.add({
      targets: txt,
      y: y - 40 - Math.random() * 20,
      x: x + (Math.random() - 0.5) * 20,
      alpha: 0,
      scale: { from: 1.3, to: 0.8 },
      duration: 700 + Math.random() * 200,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  /** Show a heal number (green, +N). */
  static heal(x: number, y: number, amount: number): void {
    if (!this.scene) return;
    const txt = this.scene.add.text(x, y, `+${Math.round(amount)}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#40d070',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(120);
    this.scene.tweens.add({
      targets: txt,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  /** Show a hit marker (small ✕) at (x, y). */
  static hitMarker(x: number, y: number, color = 0xffffff): void {
    if (!this.scene) return;
    const marker = this.scene.add.text(x, y, '✕', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(121);
    this.scene.tweens.add({
      targets: marker,
      scale: { from: 0.5, to: 1.5 },
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => marker.destroy(),
    });
  }

  /** Register a kill — increments combo counter. */
  static onKill(): void {
    if (!this.scene) return;
    this.comboCount++;
    if (this.comboCount >= 2) {
      this.showCombo();
      Effects.play('uiHover');
    }
    if (this.comboTimer) this.comboTimer.remove();
    this.comboTimer = this.scene.time.delayedCall(3000, () => {
      this.comboCount = 0;
      this.hideCombo();
    });
  }

  private static showCombo(): void {
    if (!this.comboText || !this.scene) return;
    const w = this.scene.cameras.main.width;
    this.comboText.setPosition(w / 2, 60);
    this.comboText.setText(`${this.comboCount}× COMBO`);
    this.comboText.setVisible(true);
    this.comboText.setScale(1.5);
    this.comboText.setAlpha(0);
    this.scene.tweens.add({
      targets: this.comboText,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  private static hideCombo(): void {
    if (!this.comboText || !this.scene) return;
    this.scene.tweens.add({
      targets: this.comboText,
      alpha: 0,
      duration: 300,
      onComplete: () => this.comboText?.setVisible(false),
    });
  }

  static destroy(): void {
    if (this.comboTimer) this.comboTimer.remove();
    this.comboTimer = null;
    this.comboText?.destroy();
    this.comboText = null;
    this.scene = null;
    this.comboCount = 0;
  }
}

export default FloatingText;
