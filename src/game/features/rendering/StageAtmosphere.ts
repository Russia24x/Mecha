/**
 * MECHA: LAST PROTOCOL - StageAtmosphere
 * Per-stage atmospheric effects that layer on top of the static background:
 *   - Lightning storm (Stage 2 Neon District): camera flash + jagged bolt + thunder
 *   - Neon signs (Stage 2): flickering colored rectangles with ADD-blend glow
 *   - Rain (optional, toggled per section): diagonal particle streaks
 *
 * All effects are screen-fixed (scrollFactor 0) so they stay in view as the
 * camera pans across the world.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { Effects } from '../../shared/Effects';

export class StageAtmosphere {
  private scene: Phaser.Scene;
  private lightningTimer = 0;
  private lightningNextAt = 8000;  // first strike ~8s after stage start
  private neonSigns: Phaser.GameObjects.Rectangle[] = [];
  private neonGlows: Phaser.GameObjects.Rectangle[] = [];  // H9 fix: track glow halos
  private rainTimer: Phaser.Time.TimerEvent | null = null;  // H8 fix: track rain timer
  private enabled = false;

  constructor(scene: Phaser.Scene, stageId: number) {
    this.scene = scene;
    if (stageId === 2) {
      this.enabled = true;
      this.buildNeonSigns();
      this.buildRain();
    }
  }

  // ---- Lightning ----

  /** Random lightning strike: white camera flash + jagged bolt graphic + thunder. */
  private triggerLightning(): void {
    // 1. Full-screen white flash (300 ms total: 80 ms peak, 220 ms fade)
    this.scene.cameras.main.flash(300, 220, 230, 255, true);

    // 2. Jagged bolt graphic (top → bottom, ADD blend)
    const bolt = this.scene.add.graphics();
    bolt.setDepth(95);
    bolt.setScrollFactor(0);
    bolt.lineStyle(2, 0xeeeeff, 0.95);
    bolt.beginPath();
    let x = Phaser.Math.Between(120, GAME.WIDTH - 120);
    let y = 0;
    bolt.moveTo(x, y);
    while (y < GAME.HEIGHT * 0.6) {
      x += Phaser.Math.Between(-35, 35);
      y += Phaser.Math.Between(18, 42);
      bolt.lineTo(x, y);
    }
    bolt.strokePath();
    bolt.setBlendMode(Phaser.BlendModes.ADD);

    // Outer glow stroke (wider, lower alpha)
    const glow = this.scene.add.graphics();
    glow.setDepth(94);
    glow.setScrollFactor(0);
    glow.lineStyle(6, 0x88aaff, 0.35);
    glow.beginPath();
    let x2 = 120;
    let y2 = 0;
    glow.moveTo(x2, y2);
    // Redraw the same path for the glow (simpler: just copy bolt's geometry)
    // We approximate by drawing a second slightly-offset jagged line.
    let gx = x;
    let gy = 0;
    glow.moveTo(gx, gy);
    while (gy < GAME.HEIGHT * 0.6) {
      gx += Phaser.Math.Between(-30, 30);
      gy += Phaser.Math.Between(18, 40);
      glow.lineTo(gx, gy);
    }
    glow.strokePath();
    glow.setBlendMode(Phaser.BlendModes.ADD);

    // 3. Fade + destroy bolt + glow after 220 ms
    this.scene.tweens.add({
      targets: [bolt, glow],
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => { bolt.destroy(); glow.destroy(); },
    });

    // 4. Thunder rumble ~400 ms later (speed-of-sound dramatic delay)
    this.scene.time.delayedCall(400, () => {
      Effects.play('explosion');
    });

    // Schedule next strike: 12–28 seconds from now
    this.lightningNextAt = this.scene.time.now + Phaser.Math.Between(12000, 28000);
  }

  // ---- Neon signs (Stage 2) ----

  /** Place a few flickering neon rectangles across the screen for Neon District mood. */
  private buildNeonSigns(): void {
    const signConfigs = [
      { x: 180,  y: 120, w: 70, h: 18, color: 0xff3060 },  // pink
      { x: 420,  y: 90,  w: 50, h: 14, color: 0x40ff80 },  // green
      { x: 720,  y: 140, w: 90, h: 20, color: 0x4080ff },  // blue
      { x: 1020, y: 100, w: 60, h: 16, color: 0xff8040 },  // orange
      { x: 1180, y: 180, w: 80, h: 18, color: 0xff40a0 },  // magenta
    ];
    for (const cfg of signConfigs) {
      // Glow halo (ADD blend, behind sign)
      const glow = this.scene.add.rectangle(cfg.x, cfg.y, cfg.w + 16, cfg.h + 12, cfg.color, 0.25);
      glow.setScrollFactor(0.15);
      glow.setDepth(-1.6);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      // Sign body
      const sign = this.scene.add.rectangle(cfg.x, cfg.y, cfg.w, cfg.h, cfg.color, 0.85);
      sign.setScrollFactor(0.15);
      sign.setDepth(-1.5);
      // Flicker tween — irregular on/off pattern
      this.scene.tweens.add({
        targets: sign,
        alpha: { from: 0.85, to: 0.15 },
        duration: Phaser.Math.Between(60, 120),
        yoyo: true,
        repeat: -1,
        repeatDelay: Phaser.Math.Between(800, 3500),
        onComplete: () => {},
      });
      this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.25, to: 0.05 },
        duration: Phaser.Math.Between(60, 120),
        yoyo: true,
        repeat: -1,
        repeatDelay: Phaser.Math.Between(800, 3500),
      });
      this.neonSigns.push(sign);
      this.neonGlows.push(glow);  // H9 fix: track glow for cleanup
    }
  }

  // ---- Rain (Stage 2 toxic canal mood) ----

  private buildRain(): void {
    // Use manual circle particles (compatible with current particle approach).
    // Spawn a raindrop every ~40ms via a timer event.
    // H8 fix: store timer handle so it can be cancelled in destroy().
    this.rainTimer = this.scene.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => this.spawnRaindrop(),
    });
  }

  private spawnRaindrop(): void {
    if (!this.enabled) return;
    const x = Phaser.Math.Between(0, GAME.WIDTH + 200);
    const drop = this.scene.add.rectangle(x, -10, 1.5, 14, 0x88aacc, 0.45);
    drop.setScrollFactor(0);
    drop.setDepth(40);
    drop.setAngle(10);  // slight diagonal
    this.scene.tweens.add({
      targets: drop,
      y: GAME.HEIGHT + 20,
      x: x - 80,  // wind slant
      alpha: 0.1,
      duration: 900,
      ease: 'Linear',
      onComplete: () => drop.destroy(),
    });
  }

  // ---- Per-frame update ----

  update(_deltaMs: number): void {
    if (!this.enabled) return;
    // Lightning trigger check
    if (this.scene.time.now >= this.lightningNextAt) {
      this.triggerLightning();
    }
  }

  destroy(): void {
    this.enabled = false;
    // H8 fix: cancel rain timer.
    this.rainTimer?.remove();
    this.rainTimer = null;
    // H9 fix: kill tweens on neon signs + glows before destroying.
    this.neonSigns.forEach(s => { this.scene.tweens.killTweensOf(s); s.destroy(); });
    this.neonGlows.forEach(g => { this.scene.tweens.killTweensOf(g); g.destroy(); });
    this.neonSigns = [];
    this.neonGlows = [];
  }
}

export default StageAtmosphere;
