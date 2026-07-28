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

export type RegionTheme = 'factory' | 'forest' | 'wastes' | 'city' | 'generic';

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
  /** For city theme: which pair of bg images to use (0=bg_1/2, 2=bg_3/4) */
  bgStartIndex = 0;

  constructor(scene: Phaser.Scene, theme: RegionTheme, worldWidth: number) {
    this.scene = scene;
    this.theme = theme;
    this.worldWidth = worldWidth;
  }

  /** Build all parallax layers. Call once when entering play state. */
  build(): void {
    // === SKY (depth -2, fully static — base color wash) ===
    this.buildSky();

    // === BACKGROUND ART (Layer 1 — existing, scrollFactor 0.15, depth -1.5) ===
    // Painted bg images tiled across world width. Keep as-is per task spec.
    this.buildBackgroundArt();

    // === CLOUD / SMOKE DRIFT (scrollFactor 0.08, depth -1.6) ===
    // 3-4 large semi-transparent circles drifting slowly across the background.
    // Rendered BEHIND the painted bg art so it appears as distant atmospheric
    // haze filtering through the skyline. Color 0x1a2030, alpha 0.03-0.05.
    this.buildCloudDrift();

    // === Layer 2 — MID SILHOUETTES (scrollFactor 0.3, depth -1.2) ===
    // Dark structural silhouettes (color 0x05080c, alpha 0.6) that scroll
    // faster than bg art (0.15) but slower than existing far layer (0.1).
    // Per theme: factory → pipes/tanks, wastes → dead trees/rocks,
    // city → building rooftops. Simple shapes only (rectangles, triangles)
    // for performance. Skipped for forest (already has procedural mid layer).
    this.buildMidSilhouettes();

    // === Layer 3 — FOREGROUND HAZE / VIGNETTE (scrollFactor 0.5, depth 9) ===
    // Top + bottom dark gradient (cinematic vignette). Scrolls fastest
    // among the new layers, adding perceived depth. Rendered above platforms
    // (depth 5) and landmarks (depth 6-8) but below atmosphere effects (80+).
    this.buildVignette();

    // ⚠️ Stage 2.2: Wastes + City skip procedural Far/Mid/Near silhouette layers.
    // The painted backdrop art at depth -1.5 already contains
    // all depth/silhouettes the artist intended. The generic Far/Mid/Near layers
    // (dark rectangles at depths -1, 0, 1) render ON TOP of the painted art,
    // creating visible flat dark bands that hide the backdrop.
    // Factory and Forest keep these layers (no painted backdrops yet).
    if (this.theme === 'wastes' || this.theme === 'city') return;

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
    // ⚠️ Stage 2.2: Wastes + City sky tint disabled — painted backdrop art provides
    // full-screen atmospheric color. Procedural sky gradient was over-darkening
    // the painted art and shifting its hue away from artist intent.
    // Factory and Forest keep their sky (no painted backdrops yet).
    if (this.theme === 'wastes' || this.theme === 'city') return;

    // Generate sky as a texture ONCE (not 720 fillRect calls per render)
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const g = this.scene.add.graphics();

    if (this.theme === 'factory') {
      // Smoggy amber-brown gradient
      for (let y = 0; y < h; y += 2) {  // step by 2 = half the draw calls
        const t = y / h;
        const r = Math.floor(8 + t * 20);
        const gg = Math.floor(7 + t * 10);
        const b = Math.floor(13 - t * 5);
        g.fillStyle((r << 16) | (gg << 8) | b, 1);
        g.fillRect(0, y, w, 2);
      }
      g.fillStyle(0xffc040, 0.04);
      g.fillCircle(w * 0.7, h * 0.75, 200);
      g.fillStyle(0xff6020, 0.03);
      g.fillCircle(w * 0.3, h * 0.7, 180);
    } else if (this.theme === 'forest') {
      for (let y = 0; y < h; y += 2) {
        const t = y / h;
        const r = Math.floor(5 + t * 8);
        const gg = Math.floor(15 + t * 20);
        const b = Math.floor(10 + t * 5);
        g.fillStyle((r << 16) | (gg << 8) | b, 1);
        g.fillRect(0, y, w, 2);
      }
      g.fillStyle(0x40ff80, 0.025);
      g.fillCircle(w * 0.5, h * 0.4, 250);
    } else {
      // Wastes — sickly green-gray gradient (re-enabled per user request)
      for (let y = 0; y < h; y += 2) {
        const t = y / h;
        const r = Math.floor(8 + t * 10);
        const gg = Math.floor(12 + t * 8);
        const b = Math.floor(6 + t * 4);
        g.fillStyle((r << 16) | (gg << 8) | b, 1);
        g.fillRect(0, y, w, 2);
      }
      g.fillStyle(0x4a5a40, 0.03);
      g.fillCircle(w * 0.5, h * 0.5, 300);
    }

    // Generate texture from graphics — rendered once, reused as image
    g.generateTexture('__sky_' + this.theme, w, h);
    g.destroy();

    // Create image from texture — much cheaper to render than Graphics
    const sky = this.scene.add.image(0, 0, '__sky_' + this.theme);
    sky.setOrigin(0, 0);
    sky.setDepth(-1.4);  // above background (-1.5), below far layer (-1)
    sky.setScrollFactor(0);
    sky.setAlpha(0.3);   // semi-transparent tint over background
    this.layers.push(sky);
  }

  /**
   * Build background art layer using user-provided images.
   * The images are tiled horizontally across the entire world width
   * with a slow parallax scroll factor. This gives the world a real
   * painted/artistic backdrop instead of just procedural graphics.
   */
  private buildBackgroundArt(): void {
    // Factory, Wastes, and City have painted background art
    if (this.theme !== 'factory' && this.theme !== 'wastes' && this.theme !== 'city') return;

    // Determine texture keys based on theme + bgStartIndex (per-area selection).
    // Per user request (round-19):
    //   Act I (factory): area 1 → factory_bg_1, area 2 → factory_bg_2, area 3 (boss) → factory_bg_3
    //   Act II (wastes): area 1 → wastes_bg_1, area 2 → wastes_bg_2, area 3 (boss) → wastes_bg_3
    //   Act III (city): area 1 → city_bg_1, area 2 → city_bg_2 (double width), area 3 → city_bg_3+city_bg_4 (boss)
    const bgKeys: string[] = [];
    if (this.theme === 'factory') {
      // bgStartIndex: 0=factory_1, 1=factory_2, 2=factory_3(boss)
      const key = `factory_bg_${this.bgStartIndex + 1}`;
      if (!this.scene.textures.exists(key)) return;
      bgKeys.push(key);
    } else if (this.theme === 'wastes') {
      // bgStartIndex: 0=wastes_1, 1=wastes_2, 2=wastes_3(boss)
      const key = `wastes_bg_${this.bgStartIndex + 1}`;
      if (!this.scene.textures.exists(key)) return;
      bgKeys.push(key);
    } else if (this.theme === 'city') {
      // Per user request (round-20):
      //   ward_1 → city_bg_1
      //   ward_2 → city_bg_2 + city_bg_3 (double width area, two images tiled)
      //   courthouse (boss) → city_bg_4 only
      if (this.bgStartIndex === 0) {
        if (!this.scene.textures.exists('city_bg_1')) return;
        bgKeys.push('city_bg_1');
      } else if (this.bgStartIndex === 1) {
        // ward_2: two images for double-width area
        if (!this.scene.textures.exists('city_bg_2')) return;
        bgKeys.push('city_bg_2');
        if (this.scene.textures.exists('city_bg_3')) bgKeys.push('city_bg_3');
      } else if (this.bgStartIndex === 2) {
        // courthouse (boss): only city_bg_4
        if (!this.scene.textures.exists('city_bg_4')) return;
        bgKeys.push('city_bg_4');
      }
    }
    if (bgKeys.length === 0) return;

    const textureKey = bgKeys[0];
    const tex = this.scene.textures.get(textureKey);
    const imgW = tex.getSourceImage().width;
    const imgH = tex.getSourceImage().height;
    const targetH = GAME.HEIGHT;
    const scale = targetH / imgH;  // scale to fit screen height

    // ── City theme: use standard tiling (same as factory/wastes) ──
    // Each Act III area has 2 images that tile across its width.
    // This is the proven Act I pattern — no fixed placement, just cycle.
    const tileW = imgW * scale;

    // Tile across the world width
    const tileCount = Math.ceil(this.worldWidth / tileW) + 1;
    const container = this.scene.add.container(0, 0);
    container.setDepth(-1.5);  // between sky (-2) and far layer (-1)
    // ⚠️ Per Phaser 4 groups-and-containers skill: pass `true` as the 3rd arg
    // so scrollFactor propagates to all child Images/Graphics. Without it,
    // children keep scrollFactor=1 (full camera follow) and only the container
    // itself parallaxes — children appear to "swim" relative to the container
    // and parallax is broken in practice.
    container.setScrollFactor(0.15, 0.05, true);  // slow parallax, propagate to children
    container.setAlpha(this.theme === 'wastes' ? 0.7 : this.theme === 'city' ? 0.7 : 0.65);  // city/wastes slightly more visible

    if (this.theme === 'city' && bgKeys.length === 2) {
      // ward_2: city_bg_2 first half, city_bg_3 second half (per user round-23)
      // FIXED (round-24): tileW was computed from bgKeys[0] only, but city_bg_2
      // and city_bg_3 may have different widths. Now each image gets its own
      // tile width and is placed sequentially (not via percentage-based selection).
      // Image 0 (city_bg_2) covers x=0 to tileW0, then repeats.
      // Image 1 (city_bg_3) covers x=tileW0 onward, then repeats.
      const tex0 = this.scene.textures.get(bgKeys[0]);
      const tex1 = this.scene.textures.get(bgKeys[1]);
      const imgW0 = tex0.getSourceImage().width;
      const imgW1 = tex1.getSourceImage().width;
      const tileW0 = imgW0 * scale;
      const tileW1 = imgW1 * scale;
      const halfWorld = this.worldWidth / 2;

      // Place city_bg_2 tiles in first half
      const tiles0 = Math.ceil(halfWorld / tileW0) + 1;
      for (let i = 0; i < tiles0; i++) {
        const x = i * tileW0;
        if (x >= halfWorld) break;
        const img = this.scene.add.image(x, GAME.HEIGHT / 2, bgKeys[0]);
        img.setOrigin(0, 0.5);
        img.setScale(scale);
        if (i % 2 === 1) img.setFlipX(true);
        container.add(img);
        // Seam cover
        if (i > 0) {
          const seam = this.scene.add.graphics();
          seam.fillStyle(0x000000, 0.3);
          seam.fillRect(x - 30, 0, 60, GAME.HEIGHT);
          for (let g = 0; g < 6; g++) {
            seam.fillStyle(0x000000, 0.15 - g * 0.02);
            seam.fillRect(x - 30 + g * 10, 0, 10, GAME.HEIGHT);
          }
          seam.setDepth(-1.4);
          container.add(seam);
        }
      }

      // Place city_bg_3 tiles in second half
      const tiles1 = Math.ceil(halfWorld / tileW1) + 1;
      for (let i = 0; i < tiles1; i++) {
        const x = halfWorld + i * tileW1;
        if (x >= this.worldWidth) break;
        const img = this.scene.add.image(x, GAME.HEIGHT / 2, bgKeys[1]);
        img.setOrigin(0, 0.5);
        img.setScale(scale);
        if (i % 2 === 1) img.setFlipX(true);
        container.add(img);
        // Seam cover
        if (i > 0) {
          const seam = this.scene.add.graphics();
          seam.fillStyle(0x000000, 0.3);
          seam.fillRect(x - 30, 0, 60, GAME.HEIGHT);
          for (let g = 0; g < 6; g++) {
            seam.fillStyle(0x000000, 0.15 - g * 0.02);
            seam.fillRect(x - 30 + g * 10, 0, 10, GAME.HEIGHT);
          }
          seam.setDepth(-1.4);
          container.add(seam);
        }
      }

      // Boundary seam between bg_2 and bg_3
      const boundarySeam = this.scene.add.graphics();
      boundarySeam.fillStyle(0x000000, 0.35);
      boundarySeam.fillRect(halfWorld - 30, 0, 60, GAME.HEIGHT);
      for (let g = 0; g < 6; g++) {
        boundarySeam.fillStyle(0x000000, 0.18 - g * 0.02);
        boundarySeam.fillRect(halfWorld - 30 + g * 10, 0, 10, GAME.HEIGHT);
      }
      boundarySeam.setDepth(-1.4);
      container.add(boundarySeam);

      return;  // Skip the generic tiling loop below
    }

    for (let i = 0; i < tileCount; i++) {
      const x = i * tileW;
      let key: string;
      if (this.theme === 'city' && bgKeys.length === 4) {
        // Legacy 4-image city layout (unused but kept for safety)
        const worldPct = x / this.worldWidth;
        if (worldPct < 0.30) key = bgKeys[0];
        else if (worldPct < 0.55) key = bgKeys[1];
        else if (worldPct < 0.78) key = bgKeys[2];
        else key = bgKeys[3];
      } else {
        key = bgKeys[i % bgKeys.length];
      }
      const img = this.scene.add.image(x, GAME.HEIGHT / 2, key);
      img.setOrigin(0, 0.5);
      img.setScale(scale);
      // Flip every other tile for seamless tiling (not for city bg_4 — different aspect)
      if (i % 2 === 1 && this.theme !== 'city') {
        img.setFlipX(true);
      }
      container.add(img);

      // ── Cover seams between tiles with a dark gradient strip ──
      // Skip seam covers for city — painted art is continuous and seams
      // would create visible dark bands that break the artist's vision.
      if (i > 0 && this.theme !== 'city') {
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

        // Fog wisp at seam (re-enabled per user request — adds atmospheric cover)
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

  // ─── CLOUD / SMOKE DRIFT ────────────────────────────────────────────────
  // 3-4 large semi-transparent circles drifting slowly across the background.
  // scrollFactor 0.08 (slowest layer — distant atmospheric haze).
  // Color 0x1a2030, alpha 0.03-0.05. Rendered BEHIND painted bg art (depth -1.6).
  private buildCloudDrift(): void {
    const cloudCount = 4;
    const container = this.scene.add.container(0, 0);
    container.setDepth(-1.6);  // behind bg art (-1.5)
    // ⚠️ Propagate scrollFactor to children (cloud circles).
    container.setScrollFactor(0.08, 0.04, true);

    for (let i = 0; i < cloudCount; i++) {
      const cx = (i + 0.5) * (this.worldWidth / cloudCount) + (Math.random() - 0.5) * 200;
      const cy = 80 + Math.random() * 220;
      const radius = 180 + Math.random() * 140;
      const alpha = 0.03 + Math.random() * 0.02;  // 0.03–0.05 per spec
      const cloud = this.scene.add.circle(cx, cy, radius, 0x1a2030, alpha);
      cloud.setBlendMode(Phaser.BlendModes.ADD);
      container.add(cloud);
      // Slow horizontal drift across the background (very long duration = distant feel)
      const driftDist = 280 + Math.random() * 240;
      this.tweens.push(this.scene.tweens.add({
        targets: cloud,
        x: cx + driftDist,
        alpha: { from: alpha * 0.7, to: alpha * 1.3 },
        duration: 28000 + Math.random() * 22000,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      }));
    }

    this.layers.push(container);
  }

  // ─── Layer 2: MID SILHOUETTES ──────────────────────────────────────────
  // Dark structural silhouettes (color 0x05080c, alpha 0.6) at scrollFactor 0.3.
  // Rendered at depth -1.2 (between sky tint -1.4 and existing far layer -1).
  // Per theme: factory → pipes/tanks, wastes → dead trees/rocks,
  // city → building rooftops. Simple shapes only (rectangles, triangles, ellipses)
  // for performance — no complex paths.
  private buildMidSilhouettes(): void {
    // Skip themes that already have their own procedural mid layer (forest/generic).
    if (this.theme !== 'factory' && this.theme !== 'wastes' && this.theme !== 'city') return;

    const SILH_COLOR = 0x05080c;
    const SILH_ALPHA = 0.6;
    const container = this.scene.add.container(0, 0);
    container.setDepth(-1.2);
    container.setAlpha(SILH_ALPHA);
    // ⚠️ Propagate scrollFactor (0.3) to all silhouette children.
    container.setScrollFactor(0.3, 0.15, true);

    if (this.theme === 'factory') this.drawFactorySilhouettes(container, SILH_COLOR);
    else if (this.theme === 'wastes') this.drawWastesSilhouettes(container, SILH_COLOR);
    // City: silhouettes removed per user request (round-22) — didn't match bg art.
    // Rain effect (in AtmosphereSystem) provides enough atmospheric depth for city.

    this.layers.push(container);
  }

  // Factory silhouettes: horizontal pipes + vertical tanks (industrial decay).
  private drawFactorySilhouettes(container: Phaser.GameObjects.Container, color: number): void {
    const tileW = 520;
    const tiles = Math.ceil(this.worldWidth / tileW) + 1;
    for (let t = 0; t < tiles; t++) {
      const baseX = t * tileW;
      // 2 horizontal pipes per tile (rectangles with rounded end caps).
      for (let p = 0; p < 2; p++) {
        const px = baseX + 60 + p * 220 + Math.random() * 30;
        const py = 180 + Math.random() * 220;
        const pw = 120 + Math.random() * 80;
        const g = this.scene.add.graphics();
        g.fillStyle(color, 1);
        g.fillRect(px, py, pw, 14);                // pipe body
        g.fillCircle(px, py + 7, 10);              // left cap
        g.fillCircle(px + pw, py + 7, 10);         // right cap
        container.add(g);
      }
      // 1 vertical tank per tile (cylinder shape).
      const tx = baseX + 340 + Math.random() * 60;
      const ty = GAME.HEIGHT - 280;
      const tw = 54;
      const th = 130 + Math.random() * 70;
      const tank = this.scene.add.graphics();
      tank.fillStyle(color, 1);
      tank.fillRect(tx, ty, tw, th);                // tank body
      tank.fillEllipse(tx + tw / 2, ty, tw, 18);    // top dome
      tank.fillRect(tx - 4, ty + 24, 4, th - 36);   // left shadow stripe (depth)
      container.add(tank);
    }
  }

  // Wastes silhouettes: dead trees (vertical + branch triangles) + rock formations.
  private drawWastesSilhouettes(container: Phaser.GameObjects.Container, color: number): void {
    const tileW = 420;
    const tiles = Math.ceil(this.worldWidth / tileW) + 1;
    for (let t = 0; t < tiles; t++) {
      const baseX = t * tileW;
      // 1-2 dead trees per tile (alternating for spacing variety).
      const treeCount = 1 + (t % 2);
      for (let i = 0; i < treeCount; i++) {
        const x = baseX + 80 + i * 180 + Math.random() * 40;
        const trunkH = 180 + Math.random() * 120;
        const trunkW = 8 + Math.random() * 4;
        const yTop = GAME.HEIGHT - trunkH;
        const g = this.scene.add.graphics();
        g.fillStyle(color, 1);
        g.fillRect(x, yTop, trunkW, trunkH);         // trunk
        // 3 branches (simple triangles for stark silhouettes).
        for (let b = 0; b < 3; b++) {
          const by = yTop + 40 + b * 50;
          const dir = b % 2 === 0 ? -1 : 1;
          g.fillTriangle(
            x + trunkW / 2, by,
            x + trunkW / 2 + dir * 32, by - 12,
            x + trunkW / 2 + dir * 32, by + 6
          );
        }
        container.add(g);
      }
      // 1 rock formation per tile (triangle = simple jagged rock).
      const rx = baseX + 250 + Math.random() * 60;
      const ry = GAME.HEIGHT - 80;
      const rw = 110 + Math.random() * 70;
      const rh = 70 + Math.random() * 50;
      const rock = this.scene.add.graphics();
      rock.fillStyle(color, 1);
      rock.fillTriangle(
        rx, ry,
        rx + rw / 2, ry - rh,
        rx + rw, ry
      );
      container.add(rock);
    }
  }

  // City silhouettes: building rooftops (rectangles of varying heights + antenna).
  private drawCitySilhouettes(container: Phaser.GameObjects.Container, color: number): void {
    const tileW = 320;
    const tiles = Math.ceil(this.worldWidth / tileW) + 1;
    for (let t = 0; t < tiles; t++) {
      const baseX = t * tileW;
      // 3 buildings per tile for dense skyline.
      for (let i = 0; i < 3; i++) {
        const x = baseX + i * 100 + Math.random() * 20;
        const bldH = 160 + Math.random() * 220;
        const bldW = 60 + Math.random() * 32;
        const yTop = GAME.HEIGHT - bldH;
        const g = this.scene.add.graphics();
        g.fillStyle(color, 1);
        g.fillRect(x, yTop, bldW, bldH);             // building body
        g.fillRect(x + bldW * 0.2, yTop - 12, bldW * 0.6, 12);  // rooftop accent
        // Antenna spire (thin triangle on top).
        g.fillTriangle(
          x + bldW / 2 - 2, yTop - 12,
          x + bldW / 2 + 2, yTop - 12,
          x + bldW / 2, yTop - 32
        );
        container.add(g);
      }
    }
  }

  // ─── Layer 3: FOREGROUND HAZE / VIGNETTE ───────────────────────────────
  // Top + bottom dark gradient (cinematic vignette) at scrollFactor 0.5.
  // 2 Graphics rectangles with fillGradientStyle for smooth gradient fade.
  // Rendered at depth 9 (above platforms 5, landmarks 6-8; below atmosphere 80+).
  private buildVignette(): void {
    const container = this.scene.add.container(0, 0);
    container.setDepth(9);
    // ⚠️ Propagate scrollFactor (0.5) to children (top + bottom gradient rects).
    container.setScrollFactor(0.5, 0.25, true);

    // Extend width beyond world to handle parallax shift:
    // With scrollFactor 0.5, camera moving across worldWidth shifts the vignette
    // by worldWidth/2 in screen space. Adding GAME.WIDTH * 2 buffer on each side
    // ensures the vignette always covers the visible viewport.
    const vigW = this.worldWidth + GAME.WIDTH * 2;
    const vigX = -GAME.WIDTH;          // start before world origin
    const fadeH = 180;                  // gradient fade height

    // Top vignette: dark (alpha 0.6) at y=0 → transparent at y=fadeH.
    const topG = this.scene.add.graphics();
    topG.fillGradientStyle(
      0x000000, 0x000000, 0x000000, 0x000000,  // colors (all black)
      0.6, 0.6, 0, 0                            // alphas (top dark, bottom clear)
    );
    topG.fillRect(vigX, 0, vigW, fadeH);
    container.add(topG);

    // Bottom vignette: transparent at y=GAME.HEIGHT-fadeH → dark at y=GAME.HEIGHT.
    const botG = this.scene.add.graphics();
    botG.fillGradientStyle(
      0x000000, 0x000000, 0x000000, 0x000000,
      0, 0, 0.6, 0.6                            // top clear, bottom dark
    );
    botG.fillRect(vigX, GAME.HEIGHT - fadeH, vigW, fadeH);
    container.add(botG);

    this.layers.push(container);
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
    // ⚠️ Propagate scrollFactor to children (cables, pipes, drips, mechs, eyes).
    // Without `true`, each child keeps scrollFactor=1 — children appear to
    // "swim" relative to the container and parallax is broken in practice.
    container.setScrollFactor(cfg.scrollX, cfg.scrollY, true);

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
    // ⚠️ Propagate scrollFactor to children (pipes, stripes, sparks).
    container.setScrollFactor(cfg.scrollX, cfg.scrollY, true);

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
    // ⚠️ Propagate scrollFactor to children (vines, spores).
    container.setScrollFactor(cfg.scrollX, cfg.scrollY, true);

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
    // ⚠️ Propagate scrollFactor to children (ferns, mushrooms, glow halos).
    container.setScrollFactor(cfg.scrollX, cfg.scrollY, true);

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
