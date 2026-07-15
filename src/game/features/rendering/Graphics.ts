/**
 * MECHA: LAST PROTOCOL - Graphics
 * Combined Lighting + Shaders + RenderInfo.
 * One module for all rendering helpers.
 */
import Phaser from 'phaser';
import { COLORS, GAME } from '../../shared/Constants';
import { Effects } from '../../shared/Effects';

// ---- Lighting ----
interface Light {
  go: Phaser.GameObjects.Arc;
  baseRadius: number;
  intensity: number;
  follow?: () => Phaser.Math.Vector2;
  flicker: number;
}

// ---- RenderInfo ----
class RenderInfoDisplay {
  private container: Phaser.GameObjects.Container;
  private text: Phaser.GameObjects.Text;
  private isVisible = false;
  private frameCount = 0;
  private fpsTimer = 0;
  private realFps = 0;
  private glInfo: { version: string; glsl: string; isWebGL2: boolean; maxTex: number; maxSamples: number; exts: string[] } | null = null;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0).setVisible(false);
    const bg = scene.add.rectangle(GAME.WIDTH - 130, GAME.HEIGHT - 110, 250, 220, 0x000000, 0.88);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    bg.setOrigin(0.5);
    this.container.add(bg);
    this.text = scene.add.text(GAME.WIDTH - 250, GAME.HEIGHT - 210, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#39d0d8', lineSpacing: 2,
    });
    this.container.add(this.text);
    // Cache GL info once
    this.cacheGlInfo(scene);
    // Toggle with F3 — H6 fix: store handler so it can be removed in destroy().
    this.scene = scene;
    this.onF3 = () => this.toggle();
    scene.input.keyboard?.on('keydown-F3', this.onF3);
  }
  private scene: Phaser.Scene;
  private onF3: (() => void) | null = null;

  private cacheGlInfo(scene: Phaser.Scene): void {
    const renderer = scene.game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const gl = (renderer as unknown as { gl: WebGL2RenderingContext | WebGLRenderingContext }).gl;
      if (gl) {
        const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
        // MAX_SAMPLES is WebGL2-only (0x910E). On WebGL1 it throws INVALID_ENUM.
        let maxSamples = 0;
        if (isWebGL2) {
          try { maxSamples = gl.getParameter(0x910E) as number; } catch { /* */ }
        }
        this.glInfo = {
          version: gl.getParameter(gl.VERSION) as string,
          glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION) as string,
          isWebGL2,
          maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
          maxSamples,
          exts: gl.getSupportedExtensions?.() || [],
        };
      }
    }
  }

  private toggle(): void {
    this.isVisible = !this.isVisible;
    this.container.setVisible(this.isVisible);
  }

  update(deltaMs: number): void {
    if (!this.isVisible) return;
    // Real-time FPS calculation
    this.frameCount++;
    this.fpsTimer += deltaMs;
    if (this.fpsTimer >= 500) {
      this.realFps = Math.round((this.frameCount * 1000) / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }
    const game = this.container.scene.game;
    const scene = this.container.scene;
    const lines: string[] = [];

    // Renderer
    const renderer = game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      lines.push('=== RENDERER ===');
      lines.push('Type: WebGL');
      if (this.glInfo) {
        lines.push(`GL: ${this.glInfo.isWebGL2 ? 'WebGL 2.0' : 'WebGL 1.0'}`);
        lines.push(`GLSL: ${this.glInfo.glsl?.substring(0, 30) || '?'}`);
        lines.push(`Max Tex: ${this.glInfo.maxTex}px`);
        lines.push(`MSAA: ${this.glInfo.maxSamples || 0}x`);
        lines.push(`Extensions: ${this.glInfo.exts.length}`);
      }
    } else if (renderer instanceof Phaser.Renderer.Canvas.CanvasRenderer) {
      lines.push('=== RENDERER ===');
      lines.push('Type: Canvas 2D');
    }

    // Performance
    lines.push('');
    lines.push('=== PERFORMANCE ===');
    lines.push(`FPS: ${this.realFps} / ${game.loop.targetFps}`);
    lines.push(`Delta: ${Math.round(deltaMs)}ms`);
    lines.push(`Objects: ${scene.children.length}`);

    // Systems
    lines.push('');
    lines.push('=== SYSTEMS ===');
    lines.push(`Scenes: ${game.scene.scenes.length}`);
    lines.push(`Physics: ${scene.matter ? 'Matter.js' : 'none'}`);
    lines.push(`Audio: ${Effects.isMuted() ? 'muted' : 'active'}`);
    lines.push(`Textures: ${game.textures.list.size ?? '?'}`);

    this.text.setText(lines);
  }

  destroy(): void {
    // H6 fix: remove F3 listener to prevent accumulation across play sessions.
    if (this.onF3) this.scene.input.keyboard?.off('keydown-F3', this.onF3);
    this.container.destroy();
  }
}

// ---- Main Graphics class ----
export class Graphics {
  private darkness: Phaser.GameObjects.Rectangle;
  private lights: Light[] = [];
  private ambientFlicker = 1;
  private renderInfo: RenderInfoDisplay;
  /** Current brightness 0 (darkest) → 1 (brightest). Persisted via Save.settings.brightness. */
  private static brightness = 0.8;
  /** Maximum darkness alpha at brightness=0. Lower = brighter overall. */
  private static readonly MAX_DARKNESS = 0.15;

  constructor(scene: Phaser.Scene) {
    // Darkness alpha scales inversely with brightness.
    // brightness=1 → alpha 0 (no darkness), brightness=0 → alpha MAX_DARKNESS.
    const alpha = (1 - Graphics.brightness) * Graphics.MAX_DARKNESS;
    this.darkness = scene.add.rectangle(
      GAME.WIDTH / 2, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x000010, alpha
    );
    this.darkness.setScrollFactor(0);
    this.darkness.setDepth(90);
    this.darkness.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.renderInfo = new RenderInfoDisplay(scene);
    this.registerInstance();
  }

  /** Set brightness (0 = darkest, 1 = brightest). Updates the darkness overlay live. */
  static setBrightness(b: number): void {
    Graphics.brightness = Phaser.Math.Clamp(b, 0, 1);
    // Only adjust the darkness overlay alpha — do NOT use ColorMatrix brightness
    // (it was making the entire scene invisible at certain values).
    // brightness=1 → alpha 0 (no darkness), brightness=0 → alpha MAX_DARKNESS.
    for (const inst of Graphics._instances) {
      if (inst.darkness && inst.darkness.active) {
        inst.darkness.setAlpha((1 - Graphics.brightness) * Graphics.MAX_DARKNESS);
      }
    }
  }

  static getBrightness(): number { return Graphics.brightness; }

  /** Track active instances so setBrightness can update them live. */
  private static _instances: Graphics[] = [];
  private cmFilter: unknown | null = null;
  private registerInstance(): void { Graphics._instances.push(this); }
  private unregisterInstance(): void {
    const idx = Graphics._instances.indexOf(this);
    if (idx >= 0) Graphics._instances.splice(idx, 1);
  }

  // ---- Lighting ----
  addLight(opts: {
    follow?: () => Phaser.Math.Vector2;
    radius?: number;
    color?: number;
    intensity?: number;
    flicker?: number;
  }): Light {
    const scene = this.darkness.scene;
    const radius = opts.radius ?? 120;
    const color = opts.color ?? COLORS.LIGHT;
    const intensity = opts.intensity ?? 0.6;
    const flicker = opts.flicker ?? 0.1;
    const go = scene.add.circle(0, 0, radius, color, intensity);
    go.setBlendMode(Phaser.BlendModes.ADD);
    go.setDepth(91);
    const light: Light = { go, baseRadius: radius, intensity, flicker, follow: opts.follow };
    this.lights.push(light);
    return light;
  }

  removeLight(l: Light): void {
    const idx = this.lights.indexOf(l);
    if (idx >= 0) {
      this.lights.splice(idx, 1);
      l.go.destroy();
    }
  }

  update(timeMs: number, deltaMs: number = 16): void {
    this.ambientFlicker = 0.92 + Math.sin(timeMs / 100) * 0.04 + Math.sin(timeMs / 33) * 0.04;
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      if (l.follow) {
        try {
          const p = l.follow();
          if (!p || typeof p.x !== 'number') { this.removeLight(l); continue; }
          l.go.x = p.x; l.go.y = p.y;
        } catch { this.removeLight(l); continue; }
      }
      const flicker = 1 + (Math.random() - 0.5) * l.flicker;
      const r = l.baseRadius * flicker * this.ambientFlicker;
      l.go.setRadius(r);
    }
    this.renderInfo.update(deltaMs);
  }

  destroy(): void {
    this.unregisterInstance();
    // H7 fix: remove the brightness ColorMatrix filter from the camera (if added).
    try {
      const cam = (this.darkness.scene as unknown as { cameras?: { main?: { filters?: { internal?: { remove?: (f: unknown) => void } } } } }).cameras?.main;
      if (this.cmFilter && cam?.filters?.internal?.remove) {
        cam.filters.internal.remove(this.cmFilter);
      }
    } catch { /* filter already removed */ }
    this.cmFilter = null;
    this.lights.forEach(l => l.go.destroy());
    this.lights = [];
    this.darkness.destroy();
    this.renderInfo.destroy();
  }
}

// M9/M13 fix: CinematicPipeline (Phaser 3 PostFXPipeline class) removed — it was dead code
// using Phaser 3 GLSL syntax (varying/gl_FragColor) incompatible with Phaser 4.2 WebGL 2.0.
// Cinematic grade is now applied via Phaser 4.2's native Filter API (see GameScene.applyCinematicGrade).

export default Graphics;
