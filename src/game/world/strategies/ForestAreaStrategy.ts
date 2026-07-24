/**
 * MECHA: LAST PROTOCOL — Forest Area Strategy
 *
 * Renders platforms, decorations, and hazards for forest regions
 * (Act IV — The Silent Canopy / toxic_forest).
 *
 * Visual style: mossy stone/wood, bioluminescent fungi, poison pools,
 * organic thorns. Completely different from factory metal.
 */

import Phaser from 'phaser';
import { AreaStrategy, type HazardVisualData, type PlatformType } from './AreaStrategy';
import type { LoadedArea } from '../AreaLoader';

export class ForestAreaStrategy extends AreaStrategy {
  constructor(
    scene: Phaser.Scene,
    trackedTween: (config: Phaser.Types.Tweens.TweenBuilderConfig) => Phaser.Tweens.Tween,
  ) {
    super(scene, trackedTween);
  }

  /** Draw platform — forest uses a single draw method for all platform types. */
  drawPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number, _type: PlatformType): void {
    this.drawForestPlatform(g, w, h);
  }

  /** Add forest-specific decorations. */
  addDecorations(
    result: LoadedArea,
    x: number, y: number, w: number, h: number,
    type: PlatformType,
  ): void {
    if (type === 'floor' && w >= 100) {
      this.addForestDecorations(result, x, y, w, h);
    }
    if (type === 'wall' && h > 100) {
      this.addForestWallDecorations(result, x, y, w, h);
    }
  }

  /** Create forest-specific hazard visual (poison thorns, poison pools, spore vents). */
  createHazardVisual(hazard: HazardVisualData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(hazard.x, hazard.y);
    container.setDepth(5);

    if (hazard.type === 'spike') {
      // Poison thorns — organic, green-tipped
      const base = this.scene.add.rectangle(0, hazard.h / 2 - 4, hazard.w, 4, 0x1a2a14, 1);
      base.setStrokeStyle(1, 0x2a3a18, 0.6);
      container.add(base);
      const thornCount = Math.floor(hazard.w / 12);
      const spacing = hazard.w / thornCount;
      for (let i = 0; i < thornCount; i++) {
        const sx = -hazard.w / 2 + (i + 0.5) * spacing;
        const thorn = this.scene.add.triangle(sx, 0, -4, hazard.h / 2, 4, hazard.h / 2, 0, -hazard.h / 2 + 2, 0x3a5a28, 0.9);
        thorn.setStrokeStyle(1, 0x4a6a30, 0.5);
        container.add(thorn);
        // Poison tip (green glow)
        const tip = this.scene.add.circle(sx, -hazard.h / 2 + 3, 1.5, 0x40ff80, 0.6);
        tip.setBlendMode(Phaser.BlendModes.ADD);
        container.add(tip);
      }
    } else if (hazard.type === 'lava') {
      // Poison pool — toxic green liquid
      const glow = this.scene.add.rectangle(0, 0, hazard.w + 16, hazard.h + 8, 0x40ff40, 0.1);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
      this.trackedTween({ targets: glow, alpha: { from: 0.05, to: 0.15 }, duration: 1000, yoyo: true, repeat: -1 });
      const surface = this.scene.add.rectangle(0, 0, hazard.w, hazard.h, 0x40a020, 0.7);
      surface.setBlendMode(Phaser.BlendModes.ADD);
      container.add(surface);
      const base = this.scene.add.rectangle(0, hazard.h / 4, hazard.w, hazard.h / 2, 0x1a3a08, 0.8);
      container.add(base);
      // Toxic bubbles
      for (let i = 0; i < 4; i++) {
        const bx = (Math.random() - 0.5) * hazard.w * 0.7;
        const bubble = this.scene.add.circle(bx, 0, 2 + Math.random() * 2, 0x80ff40, 0.7);
        bubble.setBlendMode(Phaser.BlendModes.ADD);
        container.add(bubble);
        this.trackedTween({
          targets: bubble, y: { from: hazard.h / 4, to: -hazard.h / 4 },
          scale: { from: 0.5, to: 1.5 }, alpha: { from: 0.7, to: 0 },
          duration: 1200 + Math.random() * 600, repeat: -1, delay: Math.random() * 1500,
        });
      }
    } else {
      // Default forest hazard
      const vis = this.scene.add.rectangle(0, 0, hazard.w, hazard.h, 0x40a020, 0.3);
      vis.setStrokeStyle(1, 0x40ff40, 0.5);
      container.add(vis);
    }

    // ⚠️ Set size so VisualCuller can use bounding-box culling.
    // Per Stage 1.1 of OPTIMIZATION_PLAN.md.
    container.setSize(hazard.w, hazard.h);
    return container;
  }

  // ── Private rendering methods ──

  /** Forest platform — mossy stone/wood, completely different from factory metal. */
  private drawForestPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    // Body — dark mossy stone
    g.fillStyle(0x1a2a14, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 3);
    // Top surface — moss layer (green)
    g.fillStyle(0x2a4a20, 0.8);
    g.fillRoundedRect(-w / 2, -h / 2, w, 4, 2);
    // Moss highlights
    g.fillStyle(0x4a6a30, 0.4);
    for (let mx = -w / 2 + 6; mx < w / 2 - 4; mx += 10) {
      g.fillCircle(mx, -h / 2 + 2, 1 + Math.random());
    }
    // Root tendrils (dangling from bottom)
    g.fillStyle(0x3a2a14, 0.6);
    for (let rx = -w / 2 + 15; rx < w / 2 - 10; rx += 25) {
      const len = 4 + Math.random() * 8;
      g.fillRect(rx, h / 2 - 2, 2, len);
    }
    // Border (dark earth)
    g.lineStyle(1, 0x2a3a18, 0.5);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 3);
    // Small mushrooms (rare)
    if (w >= 100 && Math.random() < 0.3) {
      const mx = (Math.random() - 0.5) * w * 0.6;
      g.fillStyle(0x8a4a6a, 0.5);
      g.fillCircle(mx, -h / 2 - 2, 3);
      g.fillStyle(0x4a2a3a, 0.7);
      g.fillRect(mx - 1, -h / 2, 2, 4);
    }
  }

  /** Forest wall decorations — moss, vines, glowing fungi. */
  private addForestWallDecorations(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(6);
    // Moss patches on wall
    for (let i = 0; i < 4; i++) {
      const mx = x + (Math.random() - 0.5) * w * 0.6;
      const my = y + (Math.random() - 0.5) * h * 0.6;
      g.fillStyle(0x2a4a20, 0.4 + Math.random() * 0.3);
      g.fillEllipse(mx, my, 14 + Math.random() * 10, 8 + Math.random() * 6);
    }
    // Glowing fungi (bioluminescent — green-cyan)
    if (Math.random() < 0.5) {
      const fx = x + (Math.random() - 0.5) * w * 0.5;
      const fy = y + (Math.random() - 0.5) * h * 0.5;
      const glow = this.scene.add.circle(fx, fy, 6, 0x40ff80, 0.15);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(6);
      result.visualRects.push(glow as unknown as Phaser.GameObjects.Rectangle);
      this.trackedTween({
        targets: glow, alpha: { from: 0.08, to: 0.2 }, scale: { from: 0.8, to: 1.2 },
        duration: 2000 + Math.random() * 1000, yoyo: true, repeat: -1,
      });
    }
    g.setPosition(0, 0);
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);
  }

  /** Forest floor decorations — spore clouds, small plants. */
  private addForestDecorations(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    // Spore cloud (ambient particle puff)
    if (Math.random() < 0.3) {
      const sx = x + (Math.random() - 0.5) * w * 0.5;
      const sy = y + h / 2 + 5;
      const spore = this.scene.add.circle(sx, sy, 3 + Math.random() * 3, 0x80ff80, 0.3);
      spore.setBlendMode(Phaser.BlendModes.ADD);
      spore.setDepth(4);
      result.visualRects.push(spore as unknown as Phaser.GameObjects.Rectangle);
      this.trackedTween({
        targets: spore,
        y: sy - 30, alpha: 0, scale: 2,
        duration: 2000 + Math.random() * 1000, repeat: -1,
        delay: Math.random() * 2000,
      });
    }
    // Small glowing plant (occasional)
    if (Math.random() < 0.2) {
      const px = x + (Math.random() - 0.5) * w * 0.6;
      const py = y + h / 2 - 3;
      const plant = this.scene.add.circle(px, py, 2, 0x40c080, 0.6);
      plant.setBlendMode(Phaser.BlendModes.ADD);
      plant.setDepth(6);
      result.visualRects.push(plant as unknown as Phaser.GameObjects.Rectangle);
      this.trackedTween({
        targets: plant, alpha: { from: 0.3, to: 0.7 }, duration: 1500, yoyo: true, repeat: -1,
      });
    }
  }
}

export default ForestAreaStrategy;
