/**
 * MECHA: LAST PROTOCOL - Parallax
 * 5-layer industrial parallax background with rich detail.
 * Uses Phaser 4.2 Graphics for procedural shapes + animated fog.
 *
 * Layer 0: Deep gradient sky + stars
 * Layer 1: Far skyline with windows + neon signs
 * Layer 2: Mid pipes, tanks, catwalks
 * Layer 3: Cables, fog plumes, steam vents
 * Layer 4: Foreground haze + atmospheric particles
 */
import Phaser from 'phaser';
import { COLORS, GAME, STAGE } from '../../shared/Constants';

export class Parallax {
  private layers: Phaser.GameObjects.Container[] = [];
  private fogClouds: Phaser.GameObjects.Ellipse[] = [];
  private steamVents: { x: number; y: number; gfx: Phaser.GameObjects.Graphics }[] = [];
  private stars: Phaser.GameObjects.Arc[] = [];
  private windowLights: { obj: Phaser.GameObjects.Rectangle; baseAlpha: number; flickerSpeed: number }[] = [];

  constructor(scene: Phaser.Scene) {
    const w = STAGE.TOTAL_WIDTH;
    const h = GAME.HEIGHT;

    // ===== Layer 0: Deep gradient sky + stars =====
    const l0 = scene.add.container(0, 0);
    // Gradient background using a graphics fill
    const skyGfx = scene.add.graphics();
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const r = Math.floor(5 + t * 8);
      const g = Math.floor(7 + t * 12);
      const b = Math.floor(13 + t * 18);
      skyGfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
      skyGfx.fillRect(0, y, w, 1);
    }
    l0.add(skyGfx);
    // Stars (only visible in upper portion)
    for (let i = 0; i < 80; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h * 0.5;
      const star = scene.add.circle(sx, sy, Math.random() * 1.5 + 0.5, 0xa0c0e0, 0.3 + Math.random() * 0.4);
      this.stars.push(star);
      l0.add(star);
    }
    l0.setScrollFactor(0.05);
    this.layers.push(l0);

    // ===== Layer 1: Far skyline with windows + neon signs =====
    const l1 = scene.add.container(0, 0);
    for (let x = 0; x < w; x += 200) {
      const bh = 160 + Math.sin(x * 0.013) * 60 + (x % 400 < 200 ? 40 : 0);
      // Building body with gradient
      const bGfx = scene.add.graphics();
      bGfx.fillStyle(COLORS.BG_MID, 1);
      bGfx.fillRect(x, h - bh, 170, bh);
      // Building outline
      bGfx.lineStyle(1, 0x1a2230, 0.5);
      bGfx.strokeRect(x, h - bh, 170, bh);
      l1.add(bGfx);
      // Windows — grid pattern
      for (let wy = h - bh + 20; wy < h - 30; wy += 28) {
        for (let wx = x + 15; wx < x + 155; wx += 22) {
          if (Math.random() < 0.35) {
            const alpha = 0.2 + Math.random() * 0.5;
            const win = scene.add.rectangle(wx, wy, 6, 10, COLORS.LIGHT, alpha);
            this.windowLights.push({ obj: win, baseAlpha: alpha, flickerSpeed: 0.5 + Math.random() * 2 });
            l1.add(win);
          }
        }
      }
      // Occasional neon sign on building
      if (Math.random() < 0.15) {
        const neonColors = [0xff4060, 0x40ff80, 0x4080ff, 0xff8040];
        const nc = neonColors[Math.floor(Math.random() * neonColors.length)];
        const sign = scene.add.rectangle(x + 85, h - bh + 50, 60, 12, nc, 0.8);
        l1.add(sign);
        // Glow
        const glow = scene.add.rectangle(x + 85, h - bh + 50, 80, 24, nc, 0.2);
        l1.add(glow);
      }
    }
    l1.setScrollFactor(0.15);
    this.layers.push(l1);

    // ===== Layer 2: Mid pipes, tanks, catwalks =====
    const l2 = scene.add.container(0, 0);
    for (let x = 120; x < w; x += 380) {
      const g = scene.add.graphics();
      // Tank body (cylinder-like)
      g.fillStyle(COLORS.METAL_DARK, 1);
      g.fillRect(x - 40, h - 200, 80, 180);
      // Tank highlights
      g.fillStyle(COLORS.METAL, 0.3);
      g.fillRect(x - 40, h - 200, 10, 180); // left edge highlight
      g.fillRect(x + 30, h - 200, 5, 180);  // right edge shadow
      // Tank cap (top)
      g.fillStyle(COLORS.METAL, 1);
      g.fillRect(x - 50, h - 210, 100, 14);
      // Rust patches
      g.fillStyle(COLORS.RUST, 0.3);
      for (let r = 0; r < 4; r++) {
        const rx = x - 35 + Math.random() * 70;
        const ry = h - 180 + Math.random() * 150;
        g.fillRect(rx, ry, 8 + Math.random() * 12, 4 + Math.random() * 6);
      }
      // Horizontal pipe connecting tanks
      g.fillStyle(COLORS.METAL_DARK, 1);
      g.fillRect(x + 40, h - 175, 180, 16);
      // Pipe joints
      g.fillStyle(COLORS.METAL, 0.5);
      g.fillRect(x + 50, h - 178, 6, 22);
      g.fillRect(x + 130, h - 178, 6, 22);
      g.fillRect(x + 210, h - 178, 6, 22);
      // Warning stripes on tank
      g.fillStyle(0xffcc00, 0.4);
      g.fillRect(x - 40, h - 80, 80, 6);
      l2.add(g);
    }
    // Catwalks
    for (let x = 300; x < w; x += 600) {
      const g = scene.add.graphics();
      g.fillStyle(COLORS.METAL_DARK, 0.6);
      g.fillRect(x, h - 350, 200, 8);
      // Catwalk railings
      g.lineStyle(2, COLORS.RUST, 0.4);
      g.beginPath();
      g.moveTo(x, h - 350); g.lineTo(x, h - 370);
      g.moveTo(x + 200, h - 350); g.lineTo(x + 200, h - 370);
      g.moveTo(x, h - 370); g.lineTo(x + 200, h - 370);
      g.strokePath();
      l2.add(g);
    }
    l2.setScrollFactor(0.4);
    this.layers.push(l2);

    // ===== Layer 3: Cables, fog plumes, steam vents =====
    const l3 = scene.add.container(0, 0);
    // Hanging cables
    for (let x = 50; x < w; x += 260) {
      const g = scene.add.graphics();
      g.lineStyle(2, COLORS.RUST, 0.5);
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y < 220; y += 12) {
        const sag = Math.sin(y * 0.03) * 8 + (y > 100 ? (y - 100) * 0.3 : 0);
        g.lineTo(x + sag, y);
      }
      g.strokePath();
      l3.add(g);
    }
    // Fog clouds
    for (let x = 0; x < w; x += 180) {
      const fog = scene.add.ellipse(x + Math.random() * 100, h - 50, 200 + Math.random() * 80, 70, COLORS.FOG, 0.15);
      this.fogClouds.push(fog);
      l3.add(fog);
    }
    // Steam vents
    for (let x = 200; x < w; x += 500) {
      const gfx = scene.add.graphics();
      this.steamVents.push({ x, y: h - 180, gfx });
      l3.add(gfx);
    }
    l3.setScrollFactor(0.7);
    this.layers.push(l3);

    // ===== Layer 4: Foreground haze + atmospheric particles =====
    const l4 = scene.add.container(0, 0);
    // Bottom haze (reduced alpha so gameplay stays visible)
    const haze = scene.add.rectangle(0, h - 50, w, 80, 0x000000, 0.2);
    haze.setOrigin(0, 0);
    l4.add(haze);
    // Top vignette (reduced alpha)
    const vignette = scene.add.rectangle(0, 0, w, 60, 0x000000, 0.15);
    vignette.setOrigin(0, 0);
    l4.add(vignette);
    // Floating dust particles
    for (let i = 0; i < 40; i++) {
      const dust = scene.add.circle(
        Math.random() * w,
        Math.random() * h,
        0.5 + Math.random() * 1.5,
        0x6080a0,
        0.15 + Math.random() * 0.2
      );
      l4.add(dust);
      // Slow drift
      scene.tweens.add({
        targets: dust,
        y: dust.y - 20 - Math.random() * 30,
        x: dust.x + (Math.random() - 0.5) * 40,
        alpha: 0,
        duration: 4000 + Math.random() * 4000,
        repeat: -1,
        delay: Math.random() * 3000,
        onRepeat: () => { dust.y = h + 10; dust.x = Math.random() * w; dust.alpha = 0.15 + Math.random() * 0.2; },
      });
    }
    l4.setScrollFactor(1.1);
    this.layers.push(l4);
  }

  update(timeMs: number): void {
    // Flicker window lights
    for (const wl of this.windowLights) {
      const flicker = Math.sin(timeMs * 0.001 * wl.flickerSpeed) * 0.15 + Math.random() * 0.1;
      wl.obj.setAlpha(Phaser.Math.Clamp(wl.baseAlpha + flicker, 0.05, 0.9));
    }
    // Drift fog clouds
    for (const fog of this.fogClouds) {
      fog.x += 0.1;
      if (fog.x > STAGE.TOTAL_WIDTH + 100) fog.x = -100;
    }
    // Steam vent puffs
    for (const vent of this.steamVents) {
      if (Math.random() < 0.03) {
        vent.gfx.clear();
        vent.gfx.fillStyle(0x8090a0, 0.15);
        const r = 15 + Math.random() * 20;
        vent.gfx.fillCircle(vent.x + (Math.random() - 0.5) * 10, vent.y - Math.random() * 30, r);
      }
    }
    // Twinkle stars
    for (const star of this.stars) {
      star.setAlpha(0.3 + Math.sin(timeMs * 0.002 + star.x) * 0.2 + Math.random() * 0.1);
    }
  }

  destroy(): void {
    this.layers.forEach(l => l.destroy());
    this.layers = [];
    this.fogClouds = [];
    this.windowLights = [];
    this.steamVents = [];
    this.stars = [];
  }
}

export default Parallax;
