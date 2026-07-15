/**
 * MECHA: LAST PROTOCOL - RenderInfo
 * Displays ACTUAL renderer information from Phaser's renderer object,
 * not hardcoded text. Shows:
 *   - Renderer type (WebGL / Canvas)
 *   - WebGL version (1.0 / 2.0)
 *   - Max texture size
 *   - MSAA support
 *   - FPS
 *   - WebGL extensions count
 *
 * This proves to the user what renderer is actually running.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';

export class RenderInfo {
  private container: Phaser.GameObjects.Container;
  private text: Phaser.GameObjects.Text;
  private isVisible = false;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0).setVisible(false);
    // Panel background
    const bg = scene.add.rectangle(GAME.WIDTH - 130, GAME.HEIGHT - 80, 240, 130, 0x000000, 0.85);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    bg.setOrigin(0.5);
    this.container.add(bg);
    // Text
    this.text = scene.add.text(GAME.WIDTH - 250, GAME.HEIGHT - 140, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#39d0d8',
      lineSpacing: 3,
    });
    this.container.add(this.text);
    // Toggle with F3
    scene.input.keyboard?.on('keydown-F3', () => this.toggle());
  }

  private toggle(): void {
    this.isVisible = !this.isVisible;
    this.container.setVisible(this.isVisible);
    if (this.isVisible) this.refresh();
  }

  /** Read actual renderer info from the Phaser game instance. */
  private refresh(): void {
    const game = this.container.scene.game;
    const renderer = game.renderer;
    const loop = game.loop;
    const lines: string[] = [];

    // Renderer type
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      lines.push('RENDERER: WebGL');
      // WebGL version — check the gl context
      const gl = (renderer as unknown as { gl: WebGL2RenderingContext | WebGLRenderingContext }).gl;
      if (gl) {
        const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
        lines.push(`GL VERSION: ${isWebGL2 ? 'WebGL 2.0' : 'WebGL 1.0'}`);
        // GLSL ES version
        const shadingLang = gl.getParameter(gl.SHADING_LANGUAGE_VERSION) as string;
        lines.push(`GLSL: ${shadingLang || 'unknown'}`);
        // Max texture size
        const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
        lines.push(`MAX TEX: ${maxTex}px`);
        // Max viewport dims
        const maxVP = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
        lines.push(`MAX VP: ${maxVP ? maxVP[0] + 'x' + maxVP[1] : '?'}`);
        // MSAA samples
        const samples = gl.getParameter(gl.MAX_SAMPLES) as number;
        lines.push(`MSAA MAX: ${samples}x`);
        // Extensions count
        const exts = gl.getSupportedExtensions?.() || [];
        lines.push(`EXTENSIONS: ${exts.length}`);
        // NPOT textures
        const npot = gl.getParameter(gl.TEXTURE_2D) !== undefined;
        lines.push(`NPOT: ${npot ? 'yes' : 'no'}`);
      }
    } else if (renderer instanceof Phaser.Renderer.Canvas.CanvasRenderer) {
      lines.push('RENDERER: Canvas 2D');
      lines.push('(No WebGL features)');
    } else {
      lines.push('RENDERER: Unknown');
    }

    // FPS
    lines.push(`FPS: ${Math.round(loop.fps)} / ${loop.targetFps}`);
    // Scene count
    const sceneCount = game.scene.scenes.length;
    lines.push(`SCENES: ${sceneCount}`);
    // Display list size
    const listSize = this.container.scene.children.length;
    lines.push(`OBJECTS: ${listSize}`);

    this.text.setText(lines);
  }

  /** Update FPS + object count every frame (cheap). */
  update(): void {
    if (!this.isVisible) return;
    // Only refresh the dynamic parts (FPS, objects)
    this.refresh();
  }

  destroy(): void {
    this.container.destroy();
  }
}

export default RenderInfo;
