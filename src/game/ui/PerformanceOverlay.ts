/**
 * MECHA: LAST PROTOCOL — Performance Overlay v2.0
 *
 * Real-time technical stats overlay (toggle with F3 key).
 * ALL values are read live from Phaser's engine — nothing is fake or hardcoded.
 *
 * Shows:
 *   FPS         — game.loop.actualFps (Phaser's measured FPS)
 *   FRAME       — delta time from last frame (actual measured ms)
 *   RES         — canvas internal resolution + display size + zoom
 *   API         — WebGL2 / WebGL1 / Canvas (from renderer type)
 *   DRAWS       — render session draw count (from renderer.stats)
 *   TEXTURES    — texture count in memory
 *   OBJ         — game objects in current scene
 *   MEM         — JS heap size (Chrome performance.memory API)
 *   SCN         — current scene key
 *   QUALITY     — current quality level from QualityManager
 *
 * Toggle: F3 = show/hide
 * Update: every 100ms (10 times/sec)
 */
import Phaser from 'phaser';
import { QualityManager } from '../systems/QualityManager';

export class PerformanceOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  private visible = false;
  private updateTimer = 0;
  private frameCount = 0;
  private fpsAccumulator = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(9999).setScrollFactor(0).setVisible(false);

    // Background panel
    const bg = scene.add.rectangle(10, 10, 280, 172, 0x000000, 0.88);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x39d0d8, 0.5);
    this.container.add(bg);

    // Title
    this.container.add(scene.add.text(16, 14, 'PERFORMANCE', {
      fontFamily: 'monospace', fontSize: '9px', color: '#39d0d8', letterSpacing: 2,
    }).setOrigin(0, 0));

    const labels: { key: string; label: string; y: number }[] = [
      { key: 'fps',       label: 'FPS',       y: 30 },
      { key: 'frameTime', label: 'FRAME',     y: 44 },
      { key: 'resolution',label: 'RES',       y: 58 },
      { key: 'display',   label: 'DISPLAY',   y: 72 },
      { key: 'renderer',  label: 'API',       y: 86 },
      { key: 'draws',     label: 'DRAWS',     y: 100 },
      { key: 'textures',  label: 'TEX',       y: 114 },
      { key: 'objects',   label: 'OBJ',       y: 128 },
      { key: 'memory',    label: 'MEM',       y: 142 },
      { key: 'quality',   label: 'QUAL',      y: 156 },
    ];

    for (const item of labels) {
      const label = scene.add.text(16, item.y, item.label, {
        fontFamily: 'monospace', fontSize: '9px', color: '#39d0d8',
      }).setOrigin(0, 0);
      const value = scene.add.text(80, item.y, '--', {
        fontFamily: 'monospace', fontSize: '9px', color: '#cfd6e0',
      }).setOrigin(0, 0);
      this.container.add([label, value]);
      this.texts[item.key] = value;
    }
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
  }

  /** Called every frame with the real delta time. */
  update(delta: number): void {
    if (!this.visible) return;

    // Accumulate frame time for real FPS calculation
    this.frameCount++;
    this.fpsAccumulator += delta;
    this.updateTimer += delta;
    if (this.updateTimer < 100) return;  // update display every 100ms
    this.updateTimer = 0;

    // ── FPS — two sources for accuracy ──
    // Source 1: Phaser's internal FPS counter
    const phaserFps = this.scene.game.loop.actualFps;
    // Source 2: our own measurement (frames in last 100ms * 10)
    const measuredFps = Math.round((this.frameCount * 1000) / this.fpsAccumulator);
    // Use whichever is lower (more conservative = more honest)
    const fps = Math.min(Math.round(phaserFps), measuredFps);
    this.texts.fps.setText(`${fps}`);
    this.frameCount = 0;
    this.fpsAccumulator = 0;

    // ── Frame time — actual measured delta ──
    this.texts.frameTime.setText(`${delta.toFixed(2)}ms`);

    // ── Internal resolution (what the game renders at) ──
    const gameW = this.scene.game.config.width;
    const gameH = this.scene.game.config.height;
    const zoom = this.scene.cameras.main.zoom.toFixed(2);
    this.texts.resolution.setText(`${gameW}x${gameH} @${zoom}x`);

    // ── Display size (what the canvas shows in browser) ──
    const canvas = this.scene.scale.canvas;
    if (canvas) {
      const dispW = canvas.clientWidth || canvas.width;
      const dispH = canvas.clientHeight || canvas.height;
      this.texts.display.setText(`${dispW}x${dispH}`);
    } else {
      this.texts.display.setText('N/A');
    }

    // ── Renderer API — check actual renderer type ──
    const renderer = this.scene.game.renderer;
    let api = 'Canvas';
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      // Check WebGL version
      const gl = (renderer as unknown as { gl?: WebGL2RenderingContext | WebGLRenderingContext }).gl;
      if (gl instanceof WebGL2RenderingContext) api = 'WebGL2';
      else api = 'WebGL1';
    }
    this.texts.renderer.setText(api);

    // ── Draw calls — from renderer stats (real draw count) ──
    const stats = (renderer as unknown as { stats?: { totalDraws?: number; textCount?: number } }).stats;
    if (stats) {
      this.texts.draws.setText(`${stats.totalDraws ?? 0}`);
    } else {
      // Fallback: count display lists
      this.texts.draws.setText(`${this.scene.children.length}`);
    }

    // ── Texture count — from texture manager ──
    const texManager = this.scene.textures;
    const texCount = (texManager as unknown as { list?: Record<string, unknown> }).list;
    this.texts.textures.setText(texCount ? `${Object.keys(texCount).length}` : 'N/A');

    // ── Game objects — actual scene children count ──
    this.texts.objects.setText(`${this.scene.children.length}`);

    // ── Memory — real JS heap (Chrome only, honest N/A on others) ──
    const perf = performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
    if (perf.memory) {
      const used = (perf.memory.usedJSHeapSize / 1048576).toFixed(1);
      const limit = (perf.memory.jsHeapSizeLimit / 1048576).toFixed(0);
      this.texts.memory.setText(`${used}/${limit}MB`);
    } else {
      this.texts.memory.setText('N/A');
    }

    // ── Quality level — from QualityManager ──
    this.texts.quality.setText(QualityManager.getQuality().toUpperCase());
  }

  destroy(): void {
    this.container.destroy();
  }
}

export default PerformanceOverlay;
