/**
 * MECHA: LAST PROTOCOL — Factory Area Strategy
 *
 * Factory-specific rendering: industrial metal platforms, hanging cables,
 * electrical sparks, fire hazards, steam vents, and metal/lava/laser hazards.
 *
 * Extracted from AreaLoader — preserves the exact rendering logic so visual
 * output is identical. AreaLoader will delegate to this strategy for the
 * 'factory' region.
 */

import Phaser from 'phaser';
import { GAME, COLORS } from '../../shared/Constants';
import type { LoadedArea } from '../AreaLoader';
import { AreaStrategy } from './AreaStrategy';
import type { HazardVisualData, PlatformType } from './AreaStrategy';

export class FactoryAreaStrategy extends AreaStrategy {
  constructor(
    scene: Phaser.Scene,
    trackedTween: (config: Phaser.Types.Tweens.TweenBuilderConfig) => Phaser.Tweens.Tween,
  ) {
    super(scene, trackedTween);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Abstract implementation: dispatch platform drawing by type
  // ─────────────────────────────────────────────────────────────────────────────

  /** Draw the factory platform visual based on its type. */
  public drawPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number, type: PlatformType): void {
    switch (type) {
      case 'floor':  this.drawFloor(g, w, h);  break;
      case 'ledge':  this.drawLedge(g, w, h);  break;
      case 'wall':   this.drawWall(g, w, h);   break;
      case 'pillar': this.drawPillar(g, w, h); break;
      case 'generic':
      default:       this.drawGeneric(g, w, h); break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Abstract implementation: dispatch decorations by type
  // ─────────────────────────────────────────────────────────────────────────────

  /** Add factory decorations based on platform type (mirrors AreaLoader.addSolid factory branch). */
  public addDecorations(
    result: LoadedArea,
    x: number, y: number, w: number, h: number,
    type: PlatformType,
  ): void {
    // Replicate AreaLoader.addSolid factory decoration logic (lines 377-394):
    //   if (isFloor && w >= 120) this.addFloorDecorations(...)
    //   if (isWall && h > 150)   this.addWallDecorations(...)
    //   if (isFloor && w >= 100) random sparks/fire/steam
    //   if ((isFloor || isLedge) && y < GAME.HEIGHT - 100) this.addPlatformSupports(...)
    if (type === 'floor' && w >= 120) {
      this.addFloorDecorations(result, x, y, w, h);
    }
    if (type === 'wall' && h > 150) {
      this.addWallDecorations(result, x, y, w, h);
    }
    if (type === 'floor' && w >= 100) {
      if (Math.random() < 0.25) this.addElectricalSparks(result, x + (Math.random() - 0.5) * w * 0.6, y + h / 2 + 6);
      if (Math.random() < 0.15) this.addFireHazard(result, x + (Math.random() - 0.5) * w * 0.5, y + h / 2 - 2);
      if (Math.random() < 0.20) this.addSteamVent(result, x + (Math.random() - 0.5) * w * 0.6, y - h / 2 - 4);
    }
    // Visual supports for floating platforms (Issue #4 fix) — cables/pipes hang DOWN from
    // platform bottom to make it look supported rather than floating in mid-air.
    if ((type === 'floor' || type === 'ledge') && y < GAME.HEIGHT - 100) {
      this.addPlatformSupports(result, x, y, w, h);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Abstract implementation: factory hazard visual
  // ─────────────────────────────────────────────────────────────────────────────

  /** Create a factory-specific hazard visual (spike / lava/molten / laser / default). */
  public createHazardVisual(hazard: HazardVisualData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(hazard.x, hazard.y);
    container.setDepth(5);

    if (hazard.type === 'spike') {
      const base = this.scene.add.rectangle(0, hazard.h / 2 - 4, hazard.w, 4, 0x1a1e28, 1);
      base.setStrokeStyle(1, 0x2a3040, 0.8);
      container.add(base);
      const spikeCount = Math.floor(hazard.w / 10);
      const spikeSpacing = hazard.w / spikeCount;
      for (let i = 0; i < spikeCount; i++) {
        const sx = -hazard.w / 2 + (i + 0.5) * spikeSpacing;
        const spike = this.scene.add.triangle(sx, 0, -4, hazard.h / 2, 4, hazard.h / 2, 0, -hazard.h / 2 + 2, 0x4a5060, 0.9);
        spike.setStrokeStyle(1, 0x6a7080, 0.6);
        container.add(spike);
        const tip = this.scene.add.circle(sx, -hazard.h / 2 + 3, 1, 0x8a90a0, 0.8);
        container.add(tip);
      }
      const warning = this.scene.add.rectangle(0, hazard.h / 2 - 1, hazard.w, 2, 0xffcc00, 0.4);
      container.add(warning);

    } else if (hazard.type === 'lava' || hazard.type === 'molten') {
      const glow = this.scene.add.rectangle(0, 0, hazard.w + 20, hazard.h + 10, 0xff4020, 0.15);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
      this.trackedTween({ targets: glow, alpha: { from: 0.1, to: 0.25 }, duration: 800, yoyo: true, repeat: -1 });
      const surface = this.scene.add.rectangle(0, 0, hazard.w, hazard.h, 0xff6020, 0.7);
      surface.setBlendMode(Phaser.BlendModes.ADD);
      container.add(surface);
      const base = this.scene.add.rectangle(0, hazard.h / 4, hazard.w, hazard.h / 2, 0x8a2010, 0.8);
      container.add(base);
      for (let i = 0; i < 4; i++) {
        const cx = (Math.random() - 0.5) * hazard.w * 0.8;
        const crack = this.scene.add.rectangle(cx, hazard.h / 4, 2 + Math.random() * 3, hazard.h / 2 - 2, 0xff8030, 0.6);
        crack.setBlendMode(Phaser.BlendModes.ADD);
        container.add(crack);
      }
      const bubbleCount = Math.max(3, Math.floor(hazard.w / 30));
      for (let i = 0; i < bubbleCount; i++) {
        const bx = (Math.random() - 0.5) * hazard.w * 0.8;
        const bubble = this.scene.add.circle(bx, 0, 2 + Math.random() * 2, 0xffc040, 0.8);
        bubble.setBlendMode(Phaser.BlendModes.ADD);
        container.add(bubble);
        this.trackedTween({
          targets: bubble,
          y: { from: hazard.h / 4, to: -hazard.h / 4 },
          scale: { from: 0.5, to: 1.5 },
          alpha: { from: 0.8, to: 0 },
          duration: 1200 + Math.random() * 800, repeat: -1, delay: Math.random() * 2000,
          onComplete: (_t, targets) => { (targets[0] as Phaser.GameObjects.Arc).setY(hazard.h / 4).setAlpha(0.8).setScale(0.5); },
        });
      }
      for (let i = 0; i < 3; i++) {
        const shimmer = this.scene.add.rectangle((Math.random() - 0.5) * hazard.w * 0.6, -hazard.h / 2 - 4 - i * 3, 8, 1, 0xff8040, 0.3);
        shimmer.setBlendMode(Phaser.BlendModes.ADD);
        container.add(shimmer);
        this.trackedTween({ targets: shimmer, x: { from: shimmer.x - 6, to: shimmer.x + 6 }, alpha: { from: 0.1, to: 0.4 }, duration: 600 + i * 200, yoyo: true, repeat: -1 });
      }

    } else if (hazard.type === 'laser') {
      const beam = this.scene.add.rectangle(0, 0, hazard.w, 3, 0x66f0ff, 0.9);
      beam.setBlendMode(Phaser.BlendModes.ADD);
      container.add(beam);
      const beamGlow = this.scene.add.rectangle(0, 0, hazard.w, 8, 0x66f0ff, 0.3);
      beamGlow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(beamGlow);
      for (const ex of [-hazard.w / 2, hazard.w / 2]) {
        const emitter = this.scene.add.rectangle(ex, 0, 6, 10, 0x1a3040, 0.9);
        emitter.setStrokeStyle(1, 0x66f0ff, 0.7);
        container.add(emitter);
        const emitterGlow = this.scene.add.circle(ex, 0, 5, 0x66f0ff, 0.5);
        emitterGlow.setBlendMode(Phaser.BlendModes.ADD);
        container.add(emitterGlow);
      }
      this.trackedTween({ targets: [beam, beamGlow], alpha: { from: 0.7, to: 1 }, duration: 80, yoyo: true, repeat: -1 });

    } else {
      const vis = this.scene.add.rectangle(0, 0, hazard.w, hazard.h, 0xff2030, 0.3);
      vis.setStrokeStyle(1, 0xff4050, 0.5);
      container.add(vis);
    }

    // ⚠️ Set size so VisualCuller can use bounding-box culling.
    // Per Stage 1.1 of OPTIMIZATION_PLAN.md.
    container.setSize(hazard.w, hazard.h);
    return container;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Platform support cables (below floating platforms)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add visual supports (hanging cables + thin pipes) below floating platforms.
   * This makes platforms look anchored rather than floating in mid-air.
   * Purely cosmetic — no physics body.
   */
  private addPlatformSupports(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(4);  // slightly behind platform (depth 5)
    const bottomY = y + h / 2;

    // Hanging cables from platform bottom — 2-3 thin vertical lines
    const cableCount = w >= 200 ? 3 : 2;
    for (let i = 0; i < cableCount; i++) {
      const cx = x - w / 2 + (w / (cableCount + 1)) * (i + 1);
      const cableLen = 20 + Math.random() * 40;
      // Cable (dark thin line)
      g.lineStyle(2, 0x1a1e28, 0.8);
      g.beginPath();
      g.moveTo(cx, bottomY);
      g.lineTo(cx, bottomY + cableLen);
      g.strokePath();
      // Cable end cap (small circle)
      g.fillStyle(0x2a3040, 0.7);
      g.fillCircle(cx, bottomY + cableLen, 2);
    }

    // Thin support strut at each end (diagonal brace to wall or ground)
    const strutLen = Math.min(60, (GAME.HEIGHT - 80) - bottomY);
    if (strutLen > 20) {
      const leftX = x - w / 2 + 4;
      const rightX = x + w / 2 - 4;
      // Left strut (diagonal going down-out)
      g.lineStyle(3, 0x2a3040, 0.6);
      g.beginPath();
      g.moveTo(leftX, bottomY);
      g.lineTo(leftX - 8, bottomY + strutLen);
      g.strokePath();
      // Right strut
      g.beginPath();
      g.moveTo(rightX, bottomY);
      g.lineTo(rightX + 8, bottomY + strutLen);
      g.strokePath();
    }

    g.setPosition(0, 0);
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Platform shape renderers
  // ─────────────────────────────────────────────────────────────────────────────

  /** Draw a wide factory floor — modular metal with rivets, rust, warning stripes. */
  private drawFloor(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    // Body — dark metal
    g.fillStyle(COLORS.METAL_DARK, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    // Top walking surface — lighter metal strip with anti-slip texture
    g.fillStyle(0x3a4050, 1);
    g.fillRect(-w / 2, -h / 2, w, 4);
    // Anti-slip grating pattern (small diagonal lines on top)
    g.fillStyle(0x4a5060, 0.4);
    for (let gx = -w / 2 + 4; gx < w / 2 - 4; gx += 8) {
      g.fillRect(gx, -h / 2 + 1, 4, 1);
    }
    // Bottom shadow
    g.fillStyle(0x1a1e28, 0.9);
    g.fillRect(-w / 2, h / 2 - 4, w, 4);
    // Side panels (every 80px) — gives "modular" factory feel
    g.lineStyle(1, 0x2a3040, 0.7);
    g.strokeRect(-w / 2, -h / 2, w, h);
    for (let px = -w / 2 + 80; px < w / 2 - 20; px += 80) {
      g.lineStyle(1, 0x1a1e28, 0.8);
      g.beginPath();
      g.moveTo(px, -h / 2 + 4);
      g.lineTo(px, h / 2 - 4);
      g.strokePath();
    }
    // Rivets along the top edge
    g.fillStyle(0x6a7080, 0.7);
    for (let rx = -w / 2 + 10; rx < w / 2 - 5; rx += 24) {
      g.fillCircle(rx, -h / 2 + 7, 1.5);
      g.fillStyle(0x2a3040, 0.8);
      g.fillCircle(rx, -h / 2 + 7, 0.8);
      g.fillStyle(0x6a7080, 0.7);
    }
    // Rust stains (random, subtle)
    g.fillStyle(0x6a3a1a, 0.25);
    const rustCount = Math.floor(w / 100);
    for (let i = 0; i < rustCount; i++) {
      const rx = -w / 2 + 20 + Math.random() * (w - 40);
      g.fillEllipse(rx, h / 2 - 6, 14 + Math.random() * 12, 4);
    }
    // Edge warning stripes (yellow/black) — only on the very ends
    g.fillStyle(0xffcc00, 0.5);
    g.fillRect(-w / 2, -h / 2, 8, 4);
    g.fillRect(w / 2 - 8, -h / 2, 8, 4);
    g.fillStyle(0x1a1e28, 0.6);
    g.fillRect(-w / 2 + 4, -h / 2, 4, 4);
    g.fillRect(w / 2 - 8, -h / 2, 4, 4);
  }

  /** Small ledge — narrow platform, simpler detail. */
  private drawLedge(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    g.fillStyle(COLORS.METAL_DARK, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle(0x3a4050, 1);
    g.fillRect(-w / 2, -h / 2, w, 3);
    g.fillStyle(0x1a1e28, 0.9);
    g.fillRect(-w / 2, h / 2 - 2, w, 2);
    g.lineStyle(1, 0x2a3040, 0.7);
    g.strokeRect(-w / 2, -h / 2, w, h);
    // Single rivet at each end
    g.fillStyle(0x6a7080, 0.7);
    g.fillCircle(-w / 2 + 5, 0, 1.2);
    g.fillCircle(w / 2 - 5, 0, 1.2);
  }

  /** Tall narrow wall — industrial barrier with warning stripes. */
  private drawWall(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    // Body
    g.fillStyle(0x1a1e28, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    // Vertical highlight on left edge
    g.fillStyle(0x3a4050, 0.8);
    g.fillRect(-w / 2, -h / 2, 3, h);
    // Vertical shadow on right edge
    g.fillStyle(0x0a0e14, 0.9);
    g.fillRect(w / 2 - 3, -h / 2, 3, h);
    // Border
    g.lineStyle(1, 0x2a3040, 0.6);
    g.strokeRect(-w / 2, -h / 2, w, h);
    // Industrial hazard stripes (yellow/black) at top and bottom 20px
    const stripeZone = 20;
    for (let sy = -h / 2; sy < -h / 2 + stripeZone; sy += 8) {
      g.fillStyle(0xffcc00, 0.5);
      g.fillRect(-w / 2, sy, w, 4);
      g.fillStyle(0x1a1e28, 0.7);
      g.fillRect(-w / 2, sy + 4, w, 4);
    }
    for (let sy = h / 2 - stripeZone; sy < h / 2; sy += 8) {
      g.fillStyle(0xffcc00, 0.5);
      g.fillRect(-w / 2, sy, w, 4);
      g.fillStyle(0x1a1e28, 0.7);
      g.fillRect(-w / 2, sy + 4, w, 4);
    }
    // Center section — panel lines
    g.lineStyle(1, 0x2a3040, 0.5);
    for (let sy = -h / 2 + stripeZone + 20; sy < h / 2 - stripeZone - 20; sy += 40) {
      g.beginPath();
      g.moveTo(-w / 2 + 2, sy);
      g.lineTo(w / 2 - 2, sy);
      g.strokePath();
    }
    // Center rivet column
    g.fillStyle(0x6a7080, 0.7);
    for (let sy = -h / 2 + 30; sy < h / 2 - 30; sy += 40) {
      g.fillCircle(0, sy, 1.5);
      g.fillStyle(0x2a3040, 0.8);
      g.fillCircle(0, sy, 0.8);
      g.fillStyle(0x6a7080, 0.7);
    }
  }

  /** Large pillar/block — chunky industrial machinery housing. */
  private drawPillar(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    // Main body
    g.fillStyle(0x1a1e28, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    // Top edge highlight
    g.fillStyle(0x3a4050, 1);
    g.fillRect(-w / 2, -h / 2, w, 4);
    // Bottom shadow
    g.fillStyle(0x0a0e14, 1);
    g.fillRect(-w / 2, h / 2 - 4, w, 4);
    // Border
    g.lineStyle(2, 0x2a3040, 0.8);
    g.strokeRect(-w / 2, -h / 2, w, h);
    // Faux control panel (rectangle with rivets) — center
    g.fillStyle(0x0a0e14, 0.8);
    g.fillRect(-w / 2 + 8, -10, w - 16, 20);
    g.lineStyle(1, 0x2a3040, 0.6);
    g.strokeRect(-w / 2 + 8, -10, w - 16, 20);
    // Indicator lights on panel
    g.fillStyle(0xff4030, 0.8);
    g.fillCircle(-w / 2 + 14, -4, 1.5);
    g.fillStyle(0xffcc00, 0.8);
    g.fillCircle(-w / 2 + 14, 4, 1.5);
    // Rivets at all corners
    g.fillStyle(0x6a7080, 0.7);
    const ro = 6;
    const corners = [
      { x: -w / 2 + ro, y: -h / 2 + ro },
      { x: w / 2 - ro, y: -h / 2 + ro },
      { x: -w / 2 + ro, y: h / 2 - ro },
      { x: w / 2 - ro, y: h / 2 - ro },
    ];
    for (const pos of corners) {
      g.fillCircle(pos.x, pos.y, 2);
      g.fillStyle(0x2a3040, 0.8);
      g.fillCircle(pos.x, pos.y, 1);
      g.fillStyle(0x6a7080, 0.7);
    }
    // Rust streaks from rivets
    g.fillStyle(0x6a3a1a, 0.2);
    for (const pos of corners) {
      g.fillRect(pos.x - 1, pos.y, 2, 20);
    }
  }

  /** Generic fallback (uncategorized shape). */
  private drawGeneric(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    g.fillStyle(COLORS.METAL_DARK, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle(0x3a4050, 0.8);
    g.fillRect(-w / 2, -h / 2, w, 3);
    g.fillStyle(0x1a1e28, 0.8);
    g.fillRect(-w / 2, h / 2 - 3, w, 3);
    g.lineStyle(1, 0x2a3040, 0.6);
    g.strokeRect(-w / 2, -h / 2, w, h);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Decorations
  // ─────────────────────────────────────────────────────────────────────────────

  /** Add decorations BELOW a floor platform: hanging cables, pipes, dripping. */
  private addFloorDecorations(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(4);  // just below the platform itself (depth 5)
    // Hanging cables from the bottom of the platform
    const cableCount = Math.max(1, Math.floor(w / 80));
    for (let i = 0; i < cableCount; i++) {
      const cx = -w / 2 + (i + 0.5) * (w / cableCount);
      const cableLen = 20 + Math.random() * 40;
      g.lineStyle(1.5, 0x2a2820, 0.6);
      g.beginPath();
      g.moveTo(cx, h / 2);
      let cy = h / 2;
      for (let s = 0; s < 4; s++) {
        cy += cableLen / 4;
        g.lineTo(cx + Math.sin(s) * 3, cy);
      }
      g.strokePath();
      // End fitting (small plug)
      g.fillStyle(0x3a3830, 0.7);
      g.fillCircle(cx + Math.sin(3) * 3, cy, 2);
    }
    // A broken pipe stub on one side
    if (w >= 160) {
      const pipeX = -w / 2 + 20;
      g.fillStyle(0x2a2820, 0.7);
      g.fillRect(pipeX, h / 2 + 4, 8, 14);
      g.fillStyle(0x1a1814, 0.9);
      g.fillRect(pipeX + 2, h / 2 + 16, 4, 4);
    }
    g.setPosition(x, y);
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);

    // Random sparkles near the platform (rare, gives "live wire" feel)
    if (Math.random() < 0.3) {
      const sparkX = x + (Math.random() - 0.5) * w * 0.6;
      const sparkY = y + h / 2 + 8;
      const spark = this.scene.add.circle(sparkX, sparkY, 1.5, 0xffc040, 0);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      spark.setDepth(6);
      this.trackedTween({
        targets: spark, alpha: { from: 0, to: 0.8 }, duration: 80, yoyo: true, repeat: -1,
        delay: Math.random() * 4000, repeatDelay: 3000 + Math.random() * 4000,
      });
      result.visualRects.push(spark as unknown as Phaser.GameObjects.Rectangle);
    }
  }

  /** Add decorations ON a wall: mounted junction boxes, warning signs. */
  private addWallDecorations(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(6);  // slightly above wall
    // Junction box (small rectangle) mounted on wall
    const boxY = y - h / 4;
    g.fillStyle(0x2a2820, 0.9);
    g.fillRect(x - 8, boxY - 8, 16, 16);
    g.lineStyle(1, 0x3a3830, 0.7);
    g.strokeRect(x - 8, boxY - 8, 16, 16);
    // Indicator light on box (pulsing amber)
    g.fillStyle(0xffc040, 0.9);
    g.fillCircle(x, boxY, 1.5);
    // Warning sign (triangle with !) — lower on wall
    const signY = y + h / 4;
    g.fillStyle(0xffcc00, 0.7);
    g.fillTriangle(x - 6, signY + 5, x + 6, signY + 5, x, signY - 5);
    g.fillStyle(0x1a1e28, 1);
    g.fillRect(x - 0.5, signY - 2, 1, 4);
    g.fillCircle(x, signY + 3, 0.8);
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Ambient hazard decorations (cosmetic, recurring)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Electrical short — broken wire with arcing blue-white sparks. */
  private addElectricalSparks(result: LoadedArea, x: number, y: number): void {
    // Broken wire stub
    const wire = this.scene.add.graphics();
    wire.setDepth(6);
    wire.lineStyle(2, 0x2a2820, 0.8);
    wire.beginPath();
    wire.moveTo(x, y - 8);
    wire.lineTo(x + 2, y);
    wire.strokePath();
    // Exposed copper end
    wire.fillStyle(0xcc8030, 0.9);
    wire.fillCircle(x + 2, y, 2);
    result.visualRects.push(wire as unknown as Phaser.GameObjects.Rectangle);

    // Arcing spark burst (recurring — every 2-4 seconds)
    const sparkBurst = () => {
      if (!wire.active) return;
      // Main flash
      const flash = this.scene.add.circle(x + 2, y, 4 + Math.random() * 3, 0xc0e0ff, 0.9);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      flash.setDepth(7);
      this.trackedTween({
        targets: flash, alpha: 0, scale: 2, duration: 100,
        onComplete: () => flash.destroy(),
      });
      // Lightning bolt zig-zag (2-3 segments)
      const bolt = this.scene.add.graphics();
      bolt.setDepth(7);
      bolt.lineStyle(1.5, 0xc0e0ff, 0.9);
      bolt.beginPath();
      bolt.moveTo(x + 2, y);
      let bx = x + 2, by = y;
      const segments = 2 + Math.floor(Math.random() * 2);
      for (let s = 0; s < segments; s++) {
        bx += (Math.random() - 0.5) * 12;
        by += (Math.random() - 0.5) * 8;
        bolt.lineTo(bx, by);
      }
      bolt.strokePath();
      bolt.setBlendMode(Phaser.BlendModes.ADD);
      this.trackedTween({
        targets: bolt, alpha: 0, duration: 80,
        onComplete: () => bolt.destroy(),
      });
      // Scattered spark particles
      for (let i = 0; i < 4; i++) {
        const px = x + 2 + (Math.random() - 0.5) * 8;
        const py = y + (Math.random() - 0.5) * 6;
        const p = this.scene.add.circle(px, py, 1, 0xc0e0ff, 1);
        p.setBlendMode(Phaser.BlendModes.ADD).setDepth(7);
        this.trackedTween({
          targets: p,
          x: px + (Math.random() - 0.5) * 20,
          y: py + 4 + Math.random() * 8,
          alpha: 0, duration: 300,
          onComplete: () => p.destroy(),
        });
      }
    };

    // Schedule recurring sparks
    const sparkTimer = this.scene.time.addEvent({
      delay: 1500 + Math.random() * 2500,
      loop: true,
      callback: sparkBurst,
    });
    // Store the timer on the wire so it gets cleaned up when wire is destroyed
    (wire as unknown as { __sparkTimer?: Phaser.Time.TimerEvent }).__sparkTimer = sparkTimer;
    // Initial spark
    this.scene.time.delayedCall(500 + Math.random() * 1000, sparkBurst);
  }

  /** Small fire hazard — oil leak that ignited. Flickering orange flames + smoke. */
  private addFireHazard(result: LoadedArea, x: number, y: number): void {
    // Oil stain on the ground
    const oil = this.scene.add.ellipse(x, y + 2, 24, 6, 0x1a0a05, 0.8);
    oil.setDepth(5);
    result.visualRects.push(oil as unknown as Phaser.GameObjects.Rectangle);

    // Flame cluster (3 overlapping flickering triangles)
    const flames: Phaser.GameObjects.Triangle[] = [];
    for (let i = 0; i < 3; i++) {
      const fx = x + (i - 1) * 4;
      const fy = y - 2;
      const flameColor = i === 1 ? 0xff8030 : 0xffa040;  // center is hotter
      const flame = this.scene.add.triangle(fx, fy, -3, 4, 3, 4, 0, -8 - Math.random() * 4, flameColor, 0.85);
      flame.setBlendMode(Phaser.BlendModes.ADD);
      flame.setDepth(6);
      flames.push(flame);
      result.visualRects.push(flame as unknown as Phaser.GameObjects.Rectangle);

      // Flicker: scale + alpha oscillation
      this.trackedTween({
        targets: flame,
        scaleX: { from: 0.7, to: 1.2 },
        scaleY: { from: 0.8, to: 1.3 },
        alpha: { from: 0.5, to: 0.9 },
        duration: 80 + Math.random() * 80,
        yoyo: true, repeat: -1,
        ease: 'Sine.inOut',
      });
    }

    // Glow halo
    const glow = this.scene.add.circle(x, y - 4, 20, 0xff6020, 0.15);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setDepth(5);
    result.visualRects.push(glow as unknown as Phaser.GameObjects.Rectangle);
    this.trackedTween({
      targets: glow, alpha: { from: 0.1, to: 0.2 }, scale: { from: 0.9, to: 1.1 },
      duration: 200, yoyo: true, repeat: -1,
    });

    // Rising smoke particles (occasional)
    const smokeTimer = this.scene.time.addEvent({
      delay: 400 + Math.random() * 300,
      loop: true,
      callback: () => {
        if (!oil.active) { smokeTimer.remove(); return; }
        const smoke = this.scene.add.circle(x + (Math.random() - 0.5) * 10, y - 8, 3 + Math.random() * 2, 0x3a3a3a, 0.3);
        smoke.setDepth(7);
        this.trackedTween({
          targets: smoke,
          y: y - 40 - Math.random() * 20,
          x: x + (Math.random() - 0.5) * 20,
          alpha: 0, scale: 2.5,
          duration: 2000 + Math.random() * 1000,
          onComplete: () => smoke.destroy(),
        });
      },
    });
    (oil as unknown as { __smokeTimer?: Phaser.Time.TimerEvent }).__smokeTimer = smokeTimer;
  }

  /** Steam vent — hissing pipe releasing white steam upward. */
  private addSteamVent(result: LoadedArea, x: number, y: number): void {
    // Pipe stub (horizontal, with crack)
    const pipe = this.scene.add.graphics();
    pipe.setDepth(5);
    pipe.fillStyle(0x2a2820, 0.9);
    pipe.fillRect(x - 12, y, 24, 6);
    pipe.fillStyle(0x3a3830, 0.7);
    pipe.fillRect(x - 12, y, 24, 1);
    pipe.fillStyle(0x1a1814, 1);
    pipe.fillRect(x - 2, y + 4, 4, 2);  // crack
    result.visualRects.push(pipe as unknown as Phaser.GameObjects.Rectangle);

    // Steam emission (recurring puffs)
    const steamTimer = this.scene.time.addEvent({
      delay: 200 + Math.random() * 200,
      loop: true,
      callback: () => {
        if (!pipe.active) { steamTimer.remove(); return; }
        const steam = this.scene.add.circle(
          x + (Math.random() - 0.5) * 4,
          y + 2,
          2 + Math.random() * 2,
          0xa0a0b0, 0.4,
        );
        steam.setDepth(6);
        this.trackedTween({
          targets: steam,
          y: y - 30 - Math.random() * 20,
          x: x + (Math.random() - 0.5) * 30,
          alpha: 0, scale: 3,
          duration: 1200 + Math.random() * 800,
          onComplete: () => steam.destroy(),
        });
      },
    });
    (pipe as unknown as { __steamTimer?: Phaser.Time.TimerEvent }).__steamTimer = steamTimer;
  }
}

export default FactoryAreaStrategy;
