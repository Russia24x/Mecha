/**
 * MECHA: LAST PROTOCOL — Area Strategy
 *
 * Strategy pattern for region-specific visual rendering.
 * Each region (Factory, Forest, Wastes, City, Orbital) has its own Strategy
 * that handles platform drawing, decorations, and hazard visuals.
 *
 * AreaLoader delegates region-specific rendering to the active strategy,
 * keeping shared logic (physics, triggers, metroidvania elements) in itself.
 *
 * Adding a new region = adding a new Strategy class. No changes to AreaLoader.
 */

import Phaser from 'phaser';
import type { LoadedArea } from '../AreaLoader';

/** Platform type determines which draw method to use. */
export type PlatformType = 'floor' | 'ledge' | 'wall' | 'pillar' | 'generic';

/** Hazard visual data — extracted from HazardData for strategy use. */
export interface HazardVisualData {
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  damage: number;
}

/**
 * Abstract base class for area rendering strategies.
 * Subclasses implement region-specific drawing, decorations, and hazards.
 *
 * Constructor receives scene + trackedTween so strategies can create
 * GameObjects and tweens that AreaLoader tracks for cleanup.
 */
export abstract class AreaStrategy {
  constructor(
    protected scene: Phaser.Scene,
    protected trackedTween: (config: Phaser.Types.Tweens.TweenBuilderConfig) => Phaser.Tweens.Tween,
  ) {}

  /**
   * Draw the platform visual on a Graphics object.
   * Called by AreaLoader.addSolid() after creating the physics body.
   * The Graphics object is already positioned — strategy just draws shapes.
   */
  abstract drawPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number, type: PlatformType): void;

  /**
   * Add region-specific decorations for a platform.
   * Called by AreaLoader.addSolid() after drawing the platform.
   * Decorations are purely cosmetic — no physics bodies.
   * Use `this.scene` and `this.trackedTween` to create visuals.
   */
  abstract addDecorations(
    result: LoadedArea,
    x: number, y: number, w: number, h: number,
    type: PlatformType,
  ): void;

  /**
   * Create a region-specific hazard visual.
   * Called by AreaLoader.createHazardVisual().
   * Returns a Container with all hazard visual elements.
   */
  abstract createHazardVisual(hazard: HazardVisualData): Phaser.GameObjects.Container;
}

export default AreaStrategy;
