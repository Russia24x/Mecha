/**
 * MECHA: LAST PROTOCOL — ParallaxBackground v1.0
 *
 * Theme-specific multi-layer parallax backgrounds that give each region a
 * clear sense of PLACE. NO MORE EMPTY METAL PLATFORMS IN A BLACK VOID.
 *
 * Themes:
 *   - factory: Industrial decay — distant smokestacks, hanging cables,
 *     broken pipes, flickering monitor banks, distant mech silhouettes.
 *   - forest:  Nature reclaiming — distant dead trees, hanging vines,
 *     glowing spores, broken statues overgrown with moss.
 *
 * Architecture (per Phaser 4 sprites-and-images + cameras skill):
 *   - Multiple tileable layers with different scrollFactor values
 *   - Graphics objects procedurally drawn (no external assets)
 *   - Front layer (closest to camera) at depth 1
 *   - Mid layer at depth 0
 *   - Far layer at depth -1
 *   - Sky/background at depth -2
 *
 * Lifecycle:
 *   - build() creates all layers for the area
 *   - destroy() removes them all (called in cleanupPlay)
 *   - Tied to PLAY state only — never appears in hub/menu (effect separation)
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';

export type RegionTheme = 'factory' | 'forest' | 'wastes' | 'generic';

interface LayerConfig {
  scrollX: number;   // parallax factor (0 = static, 1 = full camera follow)
  scrollY: number;
  depth: number;
  alpha: number;
}

export class ParallaxBackground {
  private scene: Phaser.Scene;
  private layers: Phaser.GameObjects.GameObject[] = [];
  private theme: RegionTheme;
  private worldWidth: number;
  private tweens: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene, theme: RegionTheme, worldWidth: number) {
    this.scene = scene;
    this.theme = theme;
    this.worldWidth = worldWidth;
  }

  /** Build all parallax layers. Call once when entering play state. */
  build(): void {
    // === SKY (depth -2, fully static — base color wash) ===
    this.buildSky();

    // === BACKGROUND ART (user-provided images, tiled across world) ===
    this.buildBackgroundArt();

    // === FAR layer (depth -1, scrollFactor 0.1) ===
    const farCfg: LayerConfig = { scrollX: 0.1, scrollY: 0.05, depth: -1, alpha: 0.5 };
    if (this.theme === 'factory') this.buildFactoryFar(farCfg);
    else if (this.theme === 'forest') this.buildForestFar(farCfg);
    else this.buildGenericFar(farCfg);

    // === MID layer (depth 0, scrollFactor 0.4) ===
    const midCfg: LayerConfig = { scrollX: 0.4, scrollY: 0.2, depth: 0, alpha: 0.7 };
    if (this.theme === 'factory') this.buildFactoryMid(midCfg);
    else if (this.theme === 'forest') this.buildForestMid(midCfg);
    else this.buildGenericMid(midCfg);

    // === NEAR layer (depth 1, scrollFactor 0.7) — in front of platforms, behind player ===
    const nearCfg: LayerConfig = { scrollX: 0.7, scrollY: 0.3, depth: 1, alpha: 0.85 };
    if (this.theme === 'factory') this.buildFactoryNear(nearCfg);
    else if (this.theme === 'forest') this.buildForestNear(nearCfg);
    else this.buildGenericNear(nearCfg);
  }

  // ─── SKY ────────────────────────────────────────────────────────────────
  private buildSky(): void {
    const sky = this.scene.add.graphics();
    sky.setDepth(-2); sky.setScrollFactor(0);
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    if (this.theme === 'factory') {
      // Smoggy amber-brown gradient
      for (let y = 0; y < h; y++) {
        const t = y / h;
        const r = Math.floor(8 + t * 20);
        const g = Math.floor(7 + t * 10);
        const b = Math.floor(13 - t * 5);
        sky.fillStyle((r << 16) | (g << 8) | b, 1);
        sky.fillRect(0, y, w, 1);
      }
      // Faint horizon glow (amber — distant fires)
      sky.fillStyle(0xffc040, 0.04);
      sky.fillCircle(w * 0.7, h * 0.75, 200);
      sky.fillStyle(0xff6020, 0.03);
      sky.fillCircle(w * 0.3, h * 0.7, 180);
    } else if (this.theme === 'forest') {
      // Deep green-teal gradient
      for (let y = 0; y < h; y++) {
        const t = y / h;
        const r = Math.floor(5 + t * 8);
        const g = Math.floor(15 + t * 20);
        const b = Math.floor(10 + t * 5);
        sky.fillStyle((r << 16) | (g << 8) | b, 1);
        sky.fillRect(0, y, w, 1);
      }
      // Misty glow
      sky.fillStyle(0x40ff80, 0.025);
      sky.fillCircle(w * 0.5, h * 0.4, 250);
    } else {
      // Wastes / generic — sickly green-gray gradient
      for (let y = 0; y < h; y++) {
        const t = y / h;
        const r = Math.floor(8 + t * 10);
        const g = Math.floor(12 + t * 8);
        const b = Math.floor(6 + t * 4);
        sky.fillStyle((r << 16) | (g << 8) | b, 1);
        sky.fillRect(0, y, w, 1);
      }
      // Sickly fog glow (green-gray)
      sky.fillStyle(0x4a5a40, 0.03);
      sky.fillCircle(w * 0.5, h * 0.5, 300);
    }
    this.layers.push(sky);
  }

  /**
   * Build background art layer using user-provided images.
   * The images are tiled horizontally across the entire world width
   * with a slow parallax scroll factor. This gives the world a real
   * painted/artistic backdrop instead of just procedural graphics.
   */
  private buildBackgroundArt(): void {
    // Only factory and wastes have art for now
    if (this.theme !== 'factory' && this.theme !== 'wastes') return;

    // Determine texture keys based on theme
    const bgKeys: string[] = [];
    if (this.theme === 'factory') {
      if (!this.scene.textures.exists('factory_bg_1')) return;
      bgKeys.push('factory_bg_1');
      if (this.scene.textures.exists('factory_bg_2')) bgKeys.push('factory_bg_2');
    } else if (this.theme === 'wastes') {
      if (!this.scene.textures.exists('wastes_bg_1')) return;
      bgKeys.push('wastes_bg_1');
      if (this.scene.textures.exists('wastes_bg_2')) bgKeys.push('wastes_bg_2');
      if (this.scene.textures.exists('wastes_bg_3')) bgKeys.push('wastes_bg_3');
    }
    if (bgKeys.length === 0) return;

    const textureKey = bgKeys[0];
    const tex = this.scene.textures.get(textureKey);
    const imgW = tex.getSourceImage().width;
    const imgH = tex.getSourceImage().height;
    const targetH = GAME.HEIGHT;
    const scale = targetH / imgH;  // scale to fit screen height
    const tileW = imgW * scale;

    // Tile across the world width
    const tileCount = Math.ceil(this.worldWidth / tileW) + 1;
    const container = this.scene.add.container(0, 0);
    container.setDepth(-1.5);  // between sky (-2) and far layer (-1)
    container.setScrollFactor(0.15, 0.05);  // slow parallax
    container.setAlpha(this.theme === 'wastes' ? 0.7 : 0.65);  // wastes slightly more visible

    for (let i = 0; i < tileCount; i++) {
      const x = i * tileW;
      // Cycle through available textures for variety
      const key = bgKeys[i % bgKeys.length];
      const img = this.scene.add.image(x, GAME.HEIGHT / 2, key);
      img.setOrigin(0, 0.5);
      img.setScale(scale);
      // Flip every other tile for seamless tiling
      if (i % 2 === 1) {
        img.setFlipX(true);
      }
      container.add(img);

      // ── Cover seams between tiles with decorative overlays ──
      // Place a fog wisp or dark gradient at each tile boundary to hide the hard edge
      if (i > 0) {
        const seamX = x;
        // Dark gradient strip at seam (blends left and right tiles)
        const seam = this.scene.add.graphics();
        seam.setDepth(-1.4);  // slightly above background
        seam.fillStyle(0x000000, 0.3);
        seam.fillRect(seamX - 30, 0, 60, GAME.HEIGHT);
        // Gradient fade
        for (let g = 0; g < 6; g++) {
          seam.fillStyle(0x000000, 0.15 - g * 0.02);
          seam.fillRect(seamX - 30 + g * 10, 0, 10, GAME.HEIGHT);
          seam.fillRect(seamX + 30 - g * 10, 0, 10, GAME.HEIGHT);
        }
        container.add(seam);

        // Fog wisp at seam (for wastes theme — extra atmospheric cover)
        // Limit to every 3rd seam to avoid excessive tweens on large worlds
        if (this.theme === 'wastes' && i % 3 === 0) {
          const fogSeam = this.scene.add.circle(seamX, GAME.HEIGHT * 0.4, 60, 0x5a6a50, 0.08);
          fogSeam.setBlendMode(Phaser.BlendModes.ADD);
          fogSeam.setDepth(-1.3);
          container.add(fogSeam);
          this.tweens.push(this.scene.tweens.add({
            targets: fogSeam,
            alpha: { from: 0.04, to: 0.12 },
            scale: { from: 0.8, to: 1.3 },
            y: { from: GAME.HEIGHT * 0.35, to: GAME.HEIGHT * 0.45 },
            duration: 4000 + Math.random() * 2000,
            yoyo: true, repeat: -1, ease: 'Sine.inOut',
          }));
        }
      }
    }
    this.layers.push(container);

    // Subtle drift tween
    this.tweens.push(this.scene.tweens.add({
      targets: container, alpha: { from: 0.55, to: 0.75 },
      duration: 5000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    }));
  }

  // ─── FACTORY: FAR — distant smokestacks + skyline ───────────────────────
  private buildFactoryFar(cfg: LayerConfig): void {
    const g = this.scene.add.graphics();
    g.setDepth(cfg.depth); g.setAlpha(cfg.alpha);
    g.setScrollFactor(cfg.scrollX, cfg.scrollY);

    // Repeat skyline across the whole world width
    const tileW = 600;
    const tiles = Math.ceil(this.worldWidth / tileW) + 1;
    for (let t = 0; t < tiles; t++) {
      const baseX = t * tileW;
      // Distant smokestacks (3 per tile, varied heights)
      for (let i = 0; i < 4; i++) {
        const x = baseX + 80 + i * 130 + Math.sin(t * 7 + i * 3) * 30;
        const stackH = 200 + Math.sin(t * 11 + i * 5) * 80;
        const stackW = 30 + (i % 2) * 10;
        const yTop = GAME.HEIGHT - stackH;
        // Stack body
        g.fillStyle(0x1a1410, 1); g.fillRect(x, yTop, stackW, stackH);
        g.fillStyle(0x2a2018, 1); g.fillRect(x, yTop, 4, stackH);
        // Top cap
        g.fillStyle(0x0a0805, 1); g.fillRect(x - 4, yTop - 6, stackW + 8, 6);
        // Smoke plume (faint, drifting)
        g.fillStyle(0x2a2218, 0.15);
        for (let s = 0; s < 3; s++) {
          g.fillCircle(x + stackW / 2 + Math.sin(s) * 8, yTop - 10 - s * 14, 10 + s * 4);
        }
      }
      // Distant broken factory wall silhouette
      g.fillStyle(0x0a0805, 1);
      g.fillRect(baseX, GAME.HEIGHT - 280, tileW, 280);
      // Window gaps (faint amber — long-dead lights)
      for (let wy = 0; wy < 4; wy++) {
        for (let wx = 0; wx < 6; wx++) {
          if (Math.random() < 0.25) {
            g.fillStyle(0xff8030, 0.15 + Math.random() * 0.1);
            g.fillRect(baseX + 60 + wx * 90, GAME.HEIGHT - 250 + wy * 50, 30, 20);
          }
        }
      }
    }
    this.layers.push(g);

    // Animate smoke (slow drift) — tween the whole layer's alpha slightly
    this.tweens.push(this.scene.tweens.add({
      targets: g, alpha: { from: cfg.alpha * 0.9, to: cfg.alpha * 1.05 },
      duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    }));
  }

  // ─── FACTORY: MID — hanging cables, broken pipes, hanging mechs ────────
  private buildFactoryMid(cfg: LayerConfig): void {
    const container = this.scene.add.container(0, 0);
    container.setDepth(cfg.depth); container.setAlpha(cfg.alpha);
    container.setScrollFactor(cfg.scrollX, cfg.scrollY);

    // Hanging cables (from ceiling)
    const cableCount = Math.ceil(this.worldWidth / 350);
    for (let i = 0; i < cableCount; i++) {
      const x = i * 350 + Math.random() * 80;
      const len = 80 + Math.random() * 120;
      const cable = this.scene.add.graphics();
      cable.lineStyle(2, 0x1a1814, 0.7);
      cable.beginPath();
      let cy = 0;
      cable.moveTo(x, cy);
      for (let s = 0; s < 5; s++) {
        cy += len / 5;
        const sway = Math.sin(s) * 4;
        cable.lineTo(x + sway, cy);
      }
      cable.strokePath();
      // End fitting
      cable.fillStyle(0x2a2820, 0.8);
      cable.fillCircle(x, len, 4);
      container.add(cable);
      // Gentle sway
      this.tweens.push(this.scene.tweens.add({
        targets: cable, x: x + 3, duration: 3000 + Math.random() * 2000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      }));
    }

    // Broken pipes (horizontal, mid-frame)
    const pipeCount = Math.ceil(this.worldWidth / 500);
    for (let i = 0; i < pipeCount; i++) {
      const x = i * 500 + 100;
      const y = 100 + Math.random() * 100;
      const w = 100 + Math.random() * 80;
      const pipe = this.scene.add.graphics();
      pipe.fillStyle(0x2a2820, 0.8); pipe.fillRect(x, y, w, 12);
      pipe.fillStyle(0x1a1814, 0.9); pipe.fillRect(x, y + 10, w, 2);
      pipe.fillStyle(0x3a3830, 0.6); pipe.fillRect(x, y, w, 1);
      // Break point (gap + dripping)
      pipe.fillStyle(0x0a0805, 1); pipe.fillRect(x + w * 0.7, y, 20, 12);
      // Drip
      const drip = this.scene.add.circle(x + w * 0.75, y + 14, 2, 0x4a3a2a, 0.6);
      drip.setBlendMode(Phaser.BlendModes.ADD);
      container.add(pipe); container.add(drip);
      this.tweens.push(this.scene.tweens.add({
        targets: drip, y: y + 60, alpha: 0, duration: 2000, repeat: -1, delay: Math.random() * 2000,
        onComplete: (_t, targets) => { (targets[0] as Phaser.GameObjects.Arc).setY(y + 14).setAlpha(0.6); },
      }));
    }

    // Hanging broken mech silhouettes (faded, swinging gently)
    const mechCount = Math.ceil(this.worldWidth / 800);
    for (let i = 0; i < mechCount; i++) {
      const x = i * 800 + 200 + Math.random() * 100;
      const y = 120 + Math.random() * 60;
      const silhouette = this.scene.add.graphics();
      silhouette.fillStyle(0x1a1814, 0.6);
      // Body
      silhouette.fillRect(x - 12, y, 24, 30);
      // Head
      silhouette.fillRect(x - 8, y - 8, 16, 10);
      // One arm hanging
      silhouette.fillRect(x - 18, y + 4, 6, 20);
      // Cable from ceiling
      silhouette.lineStyle(1, 0x2a2820, 0.5);
      silhouette.beginPath(); silhouette.moveTo(x, 0); silhouette.lineTo(x, y); silhouette.strokePath();
      // Dead eye (red dot, flickering)
      const eye = this.scene.add.circle(x - 2, y - 4, 1, 0xff3030, 0.5);
      eye.setBlendMode(Phaser.BlendModes.ADD);
      container.add(silhouette); container.add(eye);
      this.tweens.push(this.scene.tweens.add({
        targets: silhouette, rotation: 0.04, duration: 4000 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      }));
      this.tweens.push(this.scene.tweens.add({
        targets: eye, alpha: { from: 0.1, to: 0.5 }, duration: 800 + Math.random() * 600, yoyo: true, repeat: -1,
      }));
    }

    this.layers.push(container);
  }

  // ─── FACTORY: NEAR — floor debris, warning signs, foreground pipes ──────
  private buildFactoryNear(cfg: LayerConfig): void {
    const container = this.scene.add.container(0, 0);
    container.setDepth(cfg.depth); container.setAlpha(cfg.alpha);
    container.setScrollFactor(cfg.scrollX, cfg.scrollY);

    // Foreground broken pipes (large, bottom of screen)
    const pipeCount = Math.ceil(this.worldWidth / 400);
    for (let i = 0; i < pipeCount; i++) {
      const x = i * 400 + 50;
      const y = GAME.HEIGHT - 60;
      const pipe = this.scene.add.graphics();
      // Vertical broken pipe
      pipe.fillStyle(0x2a2820, 0.9); pipe.fillRect(x, y, 18, 80);
      pipe.fillStyle(0x3a3830, 0.7); pipe.fillRect(x, y, 18, 2);
      pipe.fillStyle(0x1a1814, 1); pipe.fillRect(x + 2, y, 14, 80);
      // Jagged break top
      pipe.fillStyle(0x2a2820, 0.9);
      pipe.fillTriangle(x, y, x + 18, y, x + 9, y - 10);
      // Rust stain
      pipe.fillStyle(0x8a4a2a, 0.3); pipe.fillRect(x, y + 30, 18, 6);
      container.add(pipe);
    }

    // Floor warning stripes (yellow/black — industrial)
    const stripe = this.scene.add.graphics();
    for (let x = 0; x < this.worldWidth; x += 30) {
      stripe.fillStyle(0x2a2820, 0.6); stripe.fillRect(x, GAME.HEIGHT - 30, 15, 6);
      stripe.fillStyle(0xffcc00, 0.15); stripe.fillRect(x + 15, GAME.HEIGHT - 30, 15, 6);
    }
    container.add(stripe);

    // Foreground sparks (random small flickers — gives "live" feel)
    for (let i = 0; i < 8; i++) {
      const sx = Math.random() * this.worldWidth;
      const sy = GAME.HEIGHT - 100 - Math.random() * 100;
      const spark = this.scene.add.circle(sx, sy, 1.5, 0xffc040, 0);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      container.add(spark);
      this.tweens.push(this.scene.tweens.add({
        targets: spark, alpha: { from: 0, to: 0.8 }, duration: 100, yoyo: true, repeat: -1,
        delay: Math.random() * 4000, repeatDelay: 2000 + Math.random() * 3000,
      }));
    }

    this.layers.push(container);
  }

  // ─── FOREST: FAR — distant dead trees + ancient ruins ───────────────────
  private buildForestFar(cfg: LayerConfig): void {
    const g = this.scene.add.graphics();
    g.setDepth(cfg.depth); g.setAlpha(cfg.alpha);
    g.setScrollFactor(cfg.scrollX, cfg.scrollY);

    const tileW = 700;
    const tiles = Math.ceil(this.worldWidth / tileW) + 1;
    for (let t = 0; t < tiles; t++) {
      const baseX = t * tileW;
      // Distant dead trees (tall thin silhouettes)
      for (let i = 0; i < 6; i++) {
        const x = baseX + i * 110 + Math.sin(t * 9 + i * 4) * 40;
        const treeH = 280 + Math.sin(t * 13 + i * 7) * 60;
        const trunkW = 14 + (i % 2) * 4;
        const yTop = GAME.HEIGHT - treeH;
        // Trunk
        g.fillStyle(0x0a1410, 1); g.fillRect(x, yTop, trunkW, treeH);
        g.fillStyle(0x142018, 0.8); g.fillRect(x, yTop, 3, treeH);
        // Bare branches (a few)
        g.lineStyle(3, 0x0a1410, 0.7);
        for (let b = 0; b < 4; b++) {
          const by = yTop + 30 + b * 40;
          const dir = b % 2 === 0 ? -1 : 1;
          g.beginPath(); g.moveTo(x + trunkW / 2, by);
          g.lineTo(x + trunkW / 2 + dir * (20 + b * 5), by - 15); g.strokePath();
        }
      }
      // Distant ruined archway (moss-covered)
      if (t % 2 === 0) {
        g.fillStyle(0x1a2818, 0.7);
        const ax = baseX + 300;
        const ay = GAME.HEIGHT - 200;
        g.fillRect(ax, ay, 14, 200);
        g.fillRect(ax + 80, ay, 14, 200);
        g.fillRect(ax, ay, 94, 16);
        // Moss
        g.fillStyle(0x2a4a30, 0.4);
        g.fillRect(ax, ay + 50, 14, 80);
        g.fillRect(ax + 80, ay + 30, 14, 60);
      }
    }
    this.layers.push(g);
  }

  // ─── FOREST: MID — hanging vines, glowing spores ───────────────────────
  private buildForestMid(cfg: LayerConfig): void {
    const container = this.scene.add.container(0, 0);
    container.setDepth(cfg.depth); container.setAlpha(cfg.alpha);
    container.setScrollFactor(cfg.scrollX, cfg.scrollY);

    // Hanging vines (from ceiling)
    const vineCount = Math.ceil(this.worldWidth / 250);
    for (let i = 0; i < vineCount; i++) {
      const x = i * 250 + Math.random() * 80;
      const len = 100 + Math.random() * 80;
      const vine = this.scene.add.graphics();
      vine.lineStyle(3, 0x2a4a20, 0.7);
      let vy = 0;
      vine.beginPath(); vine.moveTo(x, vy);
      for (let s = 0; s < 6; s++) {
        vy += len / 6;
        vine.lineTo(x + Math.sin(s + i) * 6, vy);
      }
      vine.strokePath();
      // Leaves (small green dots at end)
      vine.fillStyle(0x40a040, 0.6);
      for (let l = 0; l < 3; l++) {
        vine.fillCircle(x + Math.sin(l) * 5, vy + l * 3, 2);
      }
      container.add(vine);
      this.tweens.push(this.scene.tweens.add({
        targets: vine, x: x + 4, duration: 4000 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      }));
    }

    // Glowing spores (floating, bioluminescent)
    const sporeCount = 30;
    for (let i = 0; i < sporeCount; i++) {
      const sx = Math.random() * this.worldWidth;
      const sy = 50 + Math.random() * (GAME.HEIGHT - 200);
      const spore = this.scene.add.circle(sx, sy, 1.5 + Math.random() * 1.5, 0x80ff80, 0.6);
      spore.setBlendMode(Phaser.BlendModes.ADD);
      container.add(spore);
      // Drift upward slowly
      this.tweens.push(this.scene.tweens.add({
        targets: spore, y: sy - 80, x: sx + (Math.random() - 0.5) * 40,
        alpha: { from: 0.6, to: 0 }, duration: 6000 + Math.random() * 4000, repeat: -1,
        delay: Math.random() * 3000, onComplete: (_t, targets) => {
          (targets[0] as Phaser.GameObjects.Arc).setPosition(sx, sy).setAlpha(0.6);
        },
      }));
    }

    this.layers.push(container);
  }

  // ─── FOREST: NEAR — foreground ferns, roots, mushroom clusters ─────────
  private buildForestNear(cfg: LayerConfig): void {
    const container = this.scene.add.container(0, 0);
    container.setDepth(cfg.depth); container.setAlpha(cfg.alpha);
    container.setScrollFactor(cfg.scrollX, cfg.scrollY);

    // Foreground ferns (silhouettes at bottom)
    const fernCount = Math.ceil(this.worldWidth / 180);
    for (let i = 0; i < fernCount; i++) {
      const x = i * 180 + Math.random() * 60;
      const y = GAME.HEIGHT - 30;
      const fern = this.scene.add.graphics();
      fern.fillStyle(0x0a2010, 0.8);
      // Fronds (curved strokes)
      fern.lineStyle(3, 0x1a3a20, 0.8);
      for (let f = 0; f < 5; f++) {
        const ang = -Math.PI / 2 + (f - 2) * 0.4;
        const len = 40 + f * 5;
        fern.beginPath();
        fern.moveTo(x, y);
        fern.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        fern.strokePath();
        // Leaflets
        fern.lineStyle(1, 0x2a5a30, 0.6);
        for (let l = 0; l < 4; l++) {
          const lx = x + Math.cos(ang) * (l * 10 + 5);
          const ly = y + Math.sin(ang) * (l * 10 + 5);
          fern.beginPath();
          fern.moveTo(lx, ly);
          fern.lineTo(lx + Math.cos(ang + Math.PI / 2) * 4, ly + Math.sin(ang + Math.PI / 2) * 4);
          fern.strokePath();
          fern.beginPath();
          fern.moveTo(lx, ly);
          fern.lineTo(lx + Math.cos(ang - Math.PI / 2) * 4, ly + Math.sin(ang - Math.PI / 2) * 4);
          fern.strokePath();
        }
        fern.lineStyle(3, 0x1a3a20, 0.8);
      }
      container.add(fern);
    }

    // Glowing mushroom clusters (occasional, bioluminescent)
    const mushCount = Math.ceil(this.worldWidth / 600);
    for (let i = 0; i < mushCount; i++) {
      const x = i * 600 + 100 + Math.random() * 200;
      const y = GAME.HEIGHT - 40;
      const mush = this.scene.add.graphics();
      // Stem
      mush.fillStyle(0x4a4a5a, 0.8); mush.fillRect(x - 2, y - 12, 4, 12);
      // Cap
      mush.fillStyle(0x40c080, 0.7); mush.fillEllipse(x, y - 12, 14, 8);
      mush.fillStyle(0x80ff80, 0.4); mush.fillEllipse(x, y - 13, 10, 4);
      container.add(mush);
      // Glow halo
      const glow = this.scene.add.circle(x, y - 12, 16, 0x40ff80, 0.15);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
      this.tweens.push(this.scene.tweens.add({
        targets: glow, alpha: { from: 0.08, to: 0.22 }, scale: { from: 0.8, to: 1.2 }, duration: 2000 + i * 400, yoyo: true, repeat: -1,
      }));
    }

    this.layers.push(container);
  }

  // ─── GENERIC fallbacks ─────────────────────────────────────────────────
  private buildGenericFar(cfg: LayerConfig): void {
    const g = this.scene.add.graphics();
    g.setDepth(cfg.depth); g.setAlpha(cfg.alpha);
    g.setScrollFactor(cfg.scrollX, cfg.scrollY);
    g.fillStyle(0x0a0d14, 1); g.fillRect(0, GAME.HEIGHT - 200, this.worldWidth, 200);
    this.layers.push(g);
  }
  private buildGenericMid(cfg: LayerConfig): void {
    const g = this.scene.add.graphics();
    g.setDepth(cfg.depth); g.setAlpha(cfg.alpha);
    g.setScrollFactor(cfg.scrollX, cfg.scrollY);
    for (let x = 0; x < this.worldWidth; x += 200) {
      g.fillStyle(0x1a2030, 0.5); g.fillRect(x, GAME.HEIGHT - 150, 60, 150);
    }
    this.layers.push(g);
  }
  private buildGenericNear(cfg: LayerConfig): void {
    const g = this.scene.add.graphics();
    g.setDepth(cfg.depth); g.setAlpha(cfg.alpha);
    g.setScrollFactor(cfg.scrollX, cfg.scrollY);
    g.fillStyle(0x0a0d14, 0.6); g.fillRect(0, GAME.HEIGHT - 40, this.worldWidth, 40);
    this.layers.push(g);
  }

  /** Destroy all parallax layers + tweens. Call on cleanupPlay. */
  destroy(): void {
    this.tweens.forEach(tw => { if (tw && tw.isPlaying()) tw.stop(); });
    this.tweens = [];
    this.layers.forEach(l => { if (l && l.active) l.destroy(); });
    this.layers = [];
  }
}

export default ParallaxBackground;
