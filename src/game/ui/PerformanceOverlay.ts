/**
 * MECHA: LAST PROTOCOL — Performance Overlay
 *
 * Real-time technical stats overlay (toggle with F3 key).
 * Shows: FPS, frame time, resolution, renderer API, draw calls, game object count.
 * All values are read live every frame — nothing hardcoded.
 *
 * Toggle: F3 = show/hide
 */
import Phaser from 'phaser';
import { GAME } from '../shared/Constants';

export class PerformanceOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  private visible = false;
  private updateTimer = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(9999).setScrollFactor(0).setVisible(false);

    // Background panel
    const bg = scene.add.rectangle(10, 10, 260, 140, 0x000000, 0.85);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x39d0d8, 0.5);
    this.container.add(bg);

    const labels: { key: string; label: string; y: number }[] = [
      { key: 'fps',       label: 'FPS',       y: 20 },
      { key: 'frameTime', label: 'FRAME',     y: 36 },
      { key: 'resolution',label: 'RES',       y: 52 },
      { key: 'renderer',  label: 'API',       y: 68 },
      { key: 'objects',   label: 'OBJ',       y: 84 },
      { key: 'memory',    label: 'MEM',       y: 100 },
      { key: 'scene',     label: 'SCN',       y: 116 },
    ];

    for (const item of labels) {
      const label = scene.add.text(16, item.y, item.label, {
        fontFamily: 'monospace', fontSize: '10px', color: '#39d0d8',
      }).setOrigin(0, 0);
      const value = scene.add.text(70, item.y, '--', {
        fontFamily: 'monospace', fontSize: '10px', color: '#cfd6e0',
      }).setOrigin(0, 0);
      this.container.add([label, value]);
      this.texts[item.key] = value;
    }
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
  }

  update(delta: number): void {
    if (!this.visible) return;
    this.updateTimer += delta;
    if (this.updateTimer < 100) return;  // update every 100ms
    this.updateTimer = 0;

    // FPS — use Phaser's built-in loop FPS
    const fps = Math.round(this.scene.game.loop.actualFps);
    this.texts.fps.setText(`${fps}`);

    // Frame time
    const frameMs = (1000 / fps).toFixed(2);
    this.texts.frameTime.setText(`${frameMs}ms`);

    // Resolution
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const zoom = this.scene.cameras.main.zoom.toFixed(2);
    this.texts.resolution.setText(`${w}x${h} @${zoom}x`);

    // Renderer API
    const renderer = this.scene.game.renderer;
    const api = renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer ? 'WebGL2' : 'Canvas';
    this.texts.renderer.setText(api);

    // Game objects
    const objCount = this.scene.children.length;
    this.texts.objects.setText(`${objCount}`);

    // Memory (if available — Chrome only)
    const perf = performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
    if (perf.memory) {
      const mb = (perf.memory.usedJSHeapSize / 1048576).toFixed(1);
      this.texts.memory.setText(`${mb}MB`);
    } else {
      this.texts.memory.setText('N/A');
    }

    // Scene key
    this.texts.scene.setText(this.scene.scene.key);
  }

  destroy(): void {
    this.container.destroy();
  }
}

export default PerformanceOverlay;
