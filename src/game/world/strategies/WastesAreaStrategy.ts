/**
 * MECHA: LAST PROTOCOL — Wastes Area Strategy (Act II)
 *
 * Renders platforms, decorations, and hazards for the Drowned Wastes region.
 *
 * Visual style: sickly green-gray mud platforms, rusted metal remnants,
 * stagnant water, permanent fog, moss and corrosion.
 *
 * Color palette (from WORLD_BIBLE):
 *   Base:     sickly green-gray (#3a4a30 → 0x3a4a30)
 *   Accent:   rusted orange     (#8a5a2a → 0x8a5a2a)
 *   Water:    murky green       (#2a3a20 → 0x2a3a20)
 *   Fog:      pale gray-green   (#5a6a50 → 0x5a6a50)
 *
 * Architecture: wide muddy plains, giant fallen mechs as landmarks,
 *   stagnant pools, permanent fog, half-submerged metal bridges.
 */

import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import type { LoadedArea } from '../AreaLoader';
import { AreaStrategy } from './AreaStrategy';
import type { HazardVisualData, PlatformType } from './AreaStrategy';

// ── Wastes color palette ──
const WASTES = {
  MUD_DARK:    0x1a2418,
  MUD_BASE:    0x2a3a20,
  MUD_LIGHT:   0x3a4a30,
  RUST:        0x8a5a2a,
  RUST_DARK:   0x5a3a1a,
  WATER_DARK:  0x0a1a08,
  WATER_BASE:  0x1a2a14,
  WATER_GLOW:  0x2a4a18,
  FOG:         0x5a6a50,
  MOSS:        0x4a6a30,
  METAL:       0x2a3038,
  METAL_DARK:  0x1a1e24,
} as const;

export class WastesAreaStrategy extends AreaStrategy {
  constructor(
    scene: Phaser.Scene,
    trackedTween: (config: Phaser.Types.Tweens.TweenBuilderConfig) => Phaser.Tweens.Tween,
  ) {
    super(scene, trackedTween);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Abstract implementations
  // ═══════════════════════════════════════════════════════════════════════

  drawPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number, _type: PlatformType): void {
    this.drawWastesPlatform(g, w, h);
  }

  addDecorations(
    result: LoadedArea,
    x: number, y: number, w: number, h: number,
    type: PlatformType,
  ): void {
    // Floor decorations: water puddles, fog wisps, dripping water
    // Heavily limited for performance — large worlds have many platforms
    if (type === 'floor' && w >= 80) {
      if (Math.random() < 0.3) this.addWaterPuddles(result, x, y, w, h);
      if (Math.random() < 0.1) this.addFogWisp(result, x, y, w);
      if (Math.random() < 0.08) this.addDrippingWater(result, x, y, w);
    }
    // Wall decorations: moss, rust streaks, exposed pipes
    if (type === 'wall' && h > 100 && Math.random() < 0.4) {
      this.addWastesWallDecorations(result, x, y, w, h);
    }
    // Rusted metal debris on ledges
    if (type === 'ledge' && w >= 60) {
      if (Math.random() < 0.4) this.addRustDebris(result, x, y, w, h);
    }
  }

  createHazardVisual(hazard: HazardVisualData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(hazard.x, hazard.y);
    container.setDepth(5);

    if (hazard.type === 'spike') {
      // Rusted metal shards / rebar poking out of mud
      const base = this.scene.add.rectangle(0, hazard.h / 2 - 4, hazard.w, 4, WASTES.MUD_DARK, 1);
      base.setStrokeStyle(1, WASTES.MUD_BASE, 0.6);
      container.add(base);
      const shardCount = Math.floor(hazard.w / 14);
      const spacing = hazard.w / shardCount;
      for (let i = 0; i < shardCount; i++) {
        const sx = -hazard.w / 2 + (i + 0.5) * spacing;
        // Rusted rebar shard
        const shard = this.scene.add.triangle(sx, 0, -3, hazard.h / 2, 3, hazard.h / 2, 0, -hazard.h / 2 + 2, WASTES.RUST_DARK, 0.9);
        shard.setStrokeStyle(1, WASTES.RUST, 0.5);
        container.add(shard);
        // Rust tip glow
        const tip = this.scene.add.circle(sx, -hazard.h / 2 + 3, 1.5, WASTES.RUST, 0.5);
        tip.setBlendMode(Phaser.BlendModes.ADD);
        container.add(tip);
      }
    } else if (hazard.type === 'lava') {
      // Toxic swamp pool — murky green liquid with bubbles
      const glow = this.scene.add.rectangle(0, 0, hazard.w + 12, hazard.h + 6, WASTES.WATER_GLOW, 0.08);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
      this.trackedTween({ targets: glow, alpha: { from: 0.04, to: 0.12 }, duration: 1500, yoyo: true, repeat: -1 });
      // Surface (murky green)
      const surface = this.scene.add.rectangle(0, 0, hazard.w, hazard.h, WASTES.WATER_BASE, 0.8);
      container.add(surface);
      // Deep water (darker bottom)
      const deep = this.scene.add.rectangle(0, hazard.h / 4, hazard.w, hazard.h / 2, WASTES.WATER_DARK, 0.9);
      container.add(deep);
      // Surface ripple (subtle horizontal line)
      const ripple = this.scene.add.rectangle(0, -1, hazard.w, 1, WASTES.WATER_GLOW, 0.3);
      ripple.setBlendMode(Phaser.BlendModes.ADD);
      container.add(ripple);
      this.trackedTween({
        targets: ripple, alpha: { from: 0.15, to: 0.4 }, scaleX: { from: 0.95, to: 1 },
        duration: 2000, yoyo: true, repeat: -1,
      });
      // Gas bubbles (slow, sickly)
      const bubbleCount = Math.max(2, Math.floor(hazard.w / 40));
      for (let i = 0; i < bubbleCount; i++) {
        const bx = (Math.random() - 0.5) * hazard.w * 0.7;
        const bubble = this.scene.add.circle(bx, 0, 1.5 + Math.random() * 2, WASTES.WATER_GLOW, 0.5);
        bubble.setBlendMode(Phaser.BlendModes.ADD);
        container.add(bubble);
        this.trackedTween({
          targets: bubble,
          y: { from: hazard.h / 4, to: -hazard.h / 4 },
          scale: { from: 0.3, to: 1.2 },
          alpha: { from: 0.5, to: 0 },
          duration: 2000 + Math.random() * 1000, repeat: -1, delay: Math.random() * 2500,
        });
      }
    } else if (hazard.type === 'laser') {
      // Rusted energy conduit — flickering exposed wire
      const wire = this.scene.add.rectangle(0, 0, hazard.w, 2, WASTES.RUST, 0.8);
      container.add(wire);
      const sparkGlow = this.scene.add.rectangle(0, 0, hazard.w, 6, WASTES.RUST, 0.2);
      sparkGlow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(sparkGlow);
      this.trackedTween({
        targets: [wire, sparkGlow],
        alpha: { from: 0.3, to: 0.9 },
        duration: 100, yoyo: true, repeat: -1,
      });
      // Exposed wire ends
      for (const ex of [-hazard.w / 2, hazard.w / 2]) {
        const cap = this.scene.add.rectangle(ex, 0, 4, 8, WASTES.METAL_DARK, 0.9);
        cap.setStrokeStyle(1, WASTES.RUST, 0.6);
        container.add(cap);
      }
    } else {
      // Default: murky mud patch
      const vis = this.scene.add.rectangle(0, 0, hazard.w, hazard.h, WASTES.MUD_BASE, 0.4);
      vis.setStrokeStyle(1, WASTES.MUD_LIGHT, 0.5);
      container.add(vis);
    }

    // ⚠️ Set size so VisualCuller can use bounding-box culling.
    // Wide lava pits (up to 300px) need this to avoid being culled when
    // their center scrolls off-screen even though part is still visible.
    // Per Stage 1.1 of OPTIMIZATION_PLAN.md.
    container.setSize(hazard.w, hazard.h);
    return container;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Private rendering methods
  // ═══════════════════════════════════════════════════════════════════════

  /** Draw a wastes platform — muddy, mossy, with rusted metal remnants. */
  private drawWastesPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    // Body — dark muddy earth
    g.fillStyle(WASTES.MUD_DARK, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 3);

    // Mud texture — irregular lighter patches
    g.fillStyle(WASTES.MUD_BASE, 0.6);
    for (let mx = -w / 2 + 8; mx < w / 2 - 4; mx += 14) {
      const my = -h / 2 + 4 + Math.random() * (h - 8);
      g.fillCircle(mx, my, 2 + Math.random() * 3);
    }

    // Top surface — wet mud layer (slightly lighter, slimy)
    g.fillStyle(WASTES.MUD_LIGHT, 0.7);
    g.fillRoundedRect(-w / 2, -h / 2, w, 4, 2);

    // Moss patches on top (green, sparse)
    g.fillStyle(WASTES.MOSS, 0.4);
    for (let mx = -w / 2 + 10; mx < w / 2 - 6; mx += 18) {
      if (Math.random() < 0.5) {
        g.fillCircle(mx, -h / 2 + 2, 1 + Math.random() * 2);
      }
    }

    // Rusted metal fragments embedded in mud (orange-brown spots)
    g.fillStyle(WASTES.RUST, 0.5);
    for (let rx = -w / 2 + 15; rx < w / 2 - 10; rx += 22) {
      if (Math.random() < 0.4) {
        const ry = -h / 2 + 6 + Math.random() * (h - 12);
        g.fillRect(rx, ry, 3 + Math.random() * 3, 1.5);
      }
    }

    // Root tendrils (dangling from bottom — dead roots)
    g.fillStyle(WASTES.MUD_DARK, 0.5);
    for (let rx = -w / 2 + 12; rx < w / 2 - 8; rx += 20) {
      const len = 3 + Math.random() * 6;
      g.fillRect(rx, h / 2 - 2, 1.5, len);
    }

    // Border (dark earth)
    g.lineStyle(1, WASTES.MUD_DARK, 0.8);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 3);

    // Occasional rusted metal edge (on wider platforms)
    if (w >= 100 && Math.random() < 0.3) {
      const edgeX = (Math.random() - 0.5) * w * 0.5;
      g.fillStyle(WASTES.METAL, 0.6);
      g.fillRect(edgeX - 6, -h / 2, 12, 3);
      g.fillStyle(WASTES.RUST, 0.4);
      g.fillRect(edgeX - 6, -h / 2, 12, 1);
    }
  }

  /** Add water puddles on floor surfaces. */
  private addWaterPuddles(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const puddleCount = Math.floor(w / 120);
    for (let i = 0; i < puddleCount; i++) {
      const px = x + (Math.random() - 0.5) * w * 0.7;
      const py = y + h / 2 - 2;
      const pw = 20 + Math.random() * 30;
      // Puddle body
      const puddle = this.scene.add.ellipse(px, py, pw, 6, WASTES.WATER_BASE, 0.6);
      puddle.setDepth(4);
      result.visualRects.push(puddle as unknown as Phaser.GameObjects.Rectangle);
      // Puddle glow (subtle)
      const glow = this.scene.add.ellipse(px, py, pw + 4, 8, WASTES.WATER_GLOW, 0.08);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(4);
      result.visualRects.push(glow as unknown as Phaser.GameObjects.Rectangle);
      this.trackedTween({
        targets: glow, alpha: { from: 0.04, to: 0.12 }, scale: { from: 0.95, to: 1.05 },
        duration: 2000 + Math.random() * 1000, yoyo: true, repeat: -1,
      });
    }
  }

  /** Add a fog wisp — slow-moving semi-transparent cloud. */
  private addFogWisp(result: LoadedArea, x: number, y: number, w: number): void {
    const fx = x + (Math.random() - 0.5) * w * 0.5;
    const fy = y - 20 - Math.random() * 40;
    const fog = this.scene.add.circle(fx, fy, 30 + Math.random() * 20, WASTES.FOG, 0.06);
    fog.setBlendMode(Phaser.BlendModes.ADD);
    fog.setDepth(3);
    result.visualRects.push(fog as unknown as Phaser.GameObjects.Rectangle);
    this.trackedTween({
      targets: fog,
      x: { from: fx - 20, to: fx + 20 },
      alpha: { from: 0.03, to: 0.08 },
      scale: { from: 0.8, to: 1.2 },
      duration: 4000 + Math.random() * 2000,
      yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }

  /** Add dripping water effect from platform bottom. */
  private addDrippingWater(result: LoadedArea, x: number, y: number, w: number): void {
    const dripCount = 1 + Math.floor(w / 200);
    for (let i = 0; i < dripCount; i++) {
      const dx = x + (Math.random() - 0.5) * w * 0.6;
      const drip = this.scene.add.circle(dx, y + 4, 1.5, WASTES.WATER_GLOW, 0.4);
      drip.setBlendMode(Phaser.BlendModes.ADD);
      drip.setDepth(4);
      result.visualRects.push(drip as unknown as Phaser.GameObjects.Rectangle);
      this.trackedTween({
        targets: drip,
        y: { from: y + 4, to: y + 30 + Math.random() * 20 },
        alpha: { from: 0.4, to: 0 },
        scale: { from: 1, to: 0.5 },
        duration: 1500 + Math.random() * 1000,
        repeat: -1, delay: Math.random() * 2000,
        onComplete: (_t, targets) => {
          (targets[0] as Phaser.GameObjects.Arc).setY(y + 4).setAlpha(0.4).setScale(1);
        },
      });
    }
  }

  /** Add wall decorations — moss streaks, rust runs, exposed pipes. */
  private addWastesWallDecorations(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(6);

    // Rust streaks (vertical orange-brown lines running down walls)
    const streakCount = 2 + Math.floor(w / 60);
    for (let i = 0; i < streakCount; i++) {
      const sx = x + (Math.random() - 0.5) * w * 0.7;
      const sy = y - h / 2 + 4;
      const len = h * 0.4 + Math.random() * h * 0.3;
      g.fillStyle(WASTES.RUST, 0.15 + Math.random() * 0.2);
      g.fillRect(sx, sy, 2 + Math.random() * 2, len);
    }

    // Moss patches (sparse, dark green)
    const mossCount = 1 + Math.floor(h / 80);
    for (let i = 0; i < mossCount; i++) {
      const mx = x + (Math.random() - 0.5) * w * 0.6;
      const my = y + (Math.random() - 0.5) * h * 0.5;
      g.fillStyle(WASTES.MOSS, 0.25 + Math.random() * 0.2);
      g.fillEllipse(mx, my, 10 + Math.random() * 8, 6 + Math.random() * 4);
    }

    g.setPosition(0, 0);
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);

    // Occasional exposed pipe (rusted, with dripping)
    if (Math.random() < 0.3) {
      const px = x + (Math.random() - 0.5) * w * 0.5;
      const py = y + (Math.random() - 0.5) * h * 0.3;
      const pipe = this.scene.add.graphics();
      pipe.setDepth(5);
      pipe.fillStyle(WASTES.METAL, 0.7);
      pipe.fillRoundedRect(px - 8, py - 2, 16, 4, 1);
      pipe.fillStyle(WASTES.RUST, 0.4);
      pipe.fillCircle(px - 6, py, 2);
      pipe.fillCircle(px + 6, py, 2);
      result.visualRects.push(pipe as unknown as Phaser.GameObjects.Rectangle);
    }
  }

  /** Add rusted metal debris on ledges. */
  private addRustDebris(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const debrisCount = 1 + Math.floor(w / 80);
    for (let i = 0; i < debrisCount; i++) {
      const dx = x + (Math.random() - 0.5) * w * 0.6;
      const dy = y + h / 2 - 3;
      const g = this.scene.add.graphics();
      g.setDepth(6);
      // Rusted metal shard
      g.fillStyle(WASTES.METAL_DARK, 0.7);
      const sw = 4 + Math.random() * 6;
      const sh = 2 + Math.random() * 3;
      g.fillRoundedRect(dx - sw / 2, dy - sh, sw, sh, 1);
      g.fillStyle(WASTES.RUST, 0.5);
      g.fillCircle(dx, dy - sh / 2, 1);
      result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);
    }
  }
}

export default WastesAreaStrategy;
