/**
 * MECHA: LAST PROTOCOL — Quality Manager
 *
 * Controls actual game quality settings that affect rendering + performance.
 * NOT just brightness — this changes real parameters:
 *
 * LOW:
 *   - FPS target: 30 (saves battery + reduces heat)
 *   - Particle count multiplier: 0.4 (fewer particles)
 *   - Darkness: heavier (MAX_DARKNESS 0.15) — hides low detail
 *   - Atmosphere particle pool: 20 (was 40-60)
 *   - Disable forest grass (performance heavy)
 *   - Disable rain
 *
 * MEDIUM:
 *   - FPS target: 60
 *   - Particle count multiplier: 0.7
 *   - Darkness: normal (MAX_DARKNESS 0.10)
 *   - Atmosphere particle pool: 40
 *   - Enable forest grass but reduced count
 *   - Enable rain but reduced count
 *
 * HIGH:
 *   - FPS target: 60
 *   - Particle count multiplier: 1.0 (full)
 *   - Darkness: light (MAX_DARKNESS 0.08) — show all detail
 *   - Atmosphere particle pool: 60
 *   - Full forest grass
 *   - Full rain
 *
 * Phaser 4 ScaleManager integration:
 *   - Scale.FIT: game canvas fits inside parent while maintaining aspect ratio
 *   - Scale.RESIZE: game canvas resizes to fill parent (changes internal resolution)
 *   - We use FIT (default) — the game always renders at 1280x720 internally,
 *     and the browser scales the canvas. This means "resolution" setting
 *     controls the CSS size of the canvas, not the internal render resolution.
 *   - For actual render resolution changes, we'd need Scale.RESIZE mode +
 *     responsive camera/world bounds — that's a bigger refactor.
 *
 * Persistence: saved in GameSettings.quality, loaded on game start.
 */
import { RenderSystem } from './RenderSystem';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityConfig {
  fpsTarget: number;
  particleMult: number;
  maxDarkness: number;
  atmospherePoolSize: number;
  forestGrassEnabled: boolean;
  forestGrassSpacing: number;  // px between grass blades (higher = fewer)
  rainEnabled: boolean;
  rainCount: number;
  antialias: boolean;
}

const QUALITY_CONFIGS: Record<QualityLevel, QualityConfig> = {
  low: {
    fpsTarget: 30,
    particleMult: 0.4,
    maxDarkness: 0.15,
    atmospherePoolSize: 20,
    forestGrassEnabled: false,
    forestGrassSpacing: 50,
    rainEnabled: false,
    rainCount: 0,
    antialias: false,
  },
  medium: {
    fpsTarget: 60,
    particleMult: 0.7,
    maxDarkness: 0.10,
    atmospherePoolSize: 40,
    forestGrassEnabled: true,
    forestGrassSpacing: 35,
    rainEnabled: true,
    rainCount: 30,
    antialias: true,
  },
  high: {
    fpsTarget: 60,
    particleMult: 1.0,
    maxDarkness: 0.08,
    atmospherePoolSize: 60,
    forestGrassEnabled: true,
    forestGrassSpacing: 25,
    rainEnabled: true,
    rainCount: 60,
    antialias: true,
  },
};

export class QualityManager {
  private static current: QualityLevel = 'high';
  private static config: QualityConfig = QUALITY_CONFIGS.high;

  static setQuality(level: QualityLevel): void {
    this.current = level;
    this.config = QUALITY_CONFIGS[level];
    // Apply darkness
    RenderSystem.setMaxDarkness(this.config.maxDarkness);
  }

  static getQuality(): QualityLevel {
    return this.current;
  }

  static getConfig(): QualityConfig {
    return this.config;
  }

  /** Get particle count adjusted by quality multiplier. */
  static adjustParticleCount(base: number): number {
    return Math.max(1, Math.round(base * this.config.particleMult));
  }

  /** Get atmosphere particle pool size. */
  static getAtmospherePoolSize(): number {
    return this.config.atmospherePoolSize;
  }

  /** Check if forest grass should be rendered. */
  static isForestGrassEnabled(): boolean {
    return this.config.forestGrassEnabled;
  }

  /** Get grass spacing (higher = fewer blades). */
  static getForestGrassSpacing(): number {
    return this.config.forestGrassSpacing;
  }

  /** Check if rain should be rendered. */
  static isRainEnabled(): boolean {
    return this.config.rainEnabled;
  }

  /** Get rain drop count. */
  static getRainCount(): number {
    return this.config.rainCount;
  }

  /** Get FPS target. */
  static getFpsTarget(): number {
    return this.config.fpsTarget;
  }
}

export default QualityManager;
