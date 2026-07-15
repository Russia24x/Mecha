/**
 * MECHA: LAST PROTOCOL - Shaders
 * Lightweight post-processing effects using Phaser pipelines.
 * MVP uses a simple color-grade + vignette shader for cinematic look.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';

/**
 * Custom RenderPipeline: subtle vignette + slight desaturation + warm grade.
 * Fragment shader is intentionally simple — easy to extend later.
 */
export class CinematicPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    const frag = `
      precision mediump float;
      uniform sampler2D uMainSampler;
      uniform float uTime;
      uniform vec2 uResolution;
      varying vec2 outTexCoord;
      void main() {
        vec4 c = texture2D(uMainSampler, outTexCoord);
        // Vignette
        vec2 p = outTexCoord - 0.5;
        float v = 1.0 - dot(p, p) * 1.3;
        v = clamp(v, 0.0, 1.0);
        // Warm grade
        vec3 col = c.rgb;
        col.r *= 1.05;
        col.b *= 0.92;
        // Slight contrast
        col = (col - 0.5) * 1.08 + 0.5;
        col *= v;
        gl_FragColor = vec4(col, c.a);
      }
    `;
    super({
      game,
      name: 'CinematicPipeline',
      renderTarget: true,
      fragShader: frag,
    });
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    this.set1f('uTime', this.game.loop.time / 1000);
    this.set2f('uResolution', GAME.WIDTH, GAME.HEIGHT);
    this.bindAndDraw(renderTarget);
  }
}

/** Heat-distortion shader for projectile trails / explosions. */
export class HeatDistortionPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    const frag = `
      precision mediump float;
      uniform sampler2D uMainSampler;
      uniform float uTime;
      varying vec2 outTexCoord;
      void main() {
        vec2 uv = outTexCoord;
        uv.x += sin(uv.y * 30.0 + uTime * 4.0) * 0.004;
        uv.y += cos(uv.x * 20.0 + uTime * 3.0) * 0.003;
        gl_FragColor = texture2D(uMainSampler, uv);
      }
    `;
    super({
      game,
      name: 'HeatDistortionPipeline',
      renderTarget: true,
      fragShader: frag,
    });
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    this.set1f('uTime', this.game.loop.time / 1000);
    this.bindAndDraw(renderTarget);
  }
}

export default CinematicPipeline;
