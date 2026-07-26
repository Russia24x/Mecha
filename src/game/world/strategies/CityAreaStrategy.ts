/**
 * MECHA: LAST PROTOCOL — City Area Strategy (Act III)
 *
 * Renders platforms, decorations, and hazards for The Last City region.
 *
 * Visual style: burning urban combat zone — cracked concrete, sandbag
 * barricades, ruined buildings, fire-scorched walls, shattered glass.
 * Color palette is fire-orange and dark concrete, matching WORLD_BIBLE's
 * "نارنجی-آتشین با Accentهای قرمز و آبی".
 *
 * Architecture: narrow streets, barricades, collapsed buildings,
 * vertical apartment interiors, war bunkers, courthouse.
 */

import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import type { LoadedArea } from '../AreaLoader';
import { AreaStrategy } from './AreaStrategy';
import type { HazardVisualData, PlatformType } from './AreaStrategy';

// ── City color palette (per WORLD_BIBLE: fire-orange + dark concrete) ──
const CITY = {
  CONCRETE_DARK: 0x1a1612,
  CONCRETE_BASE: 0x2a2620,
  CONCRETE_LIGHT: 0x3a3630,
  BRICK: 0x4a2a1a,
  BRICK_DARK: 0x2a1a0a,
  FIRE_GLOW: 0xff6020,
  ASH: 0x4a4a4a,
  RUST: 0x8a5a2a,
  METAL: 0x3a3a40,
  METAL_DARK: 0x1a1a20,
  GLASS: 0x2a3a4a,
  SAND: 0x5a4a30,
} as const;

export class CityAreaStrategy extends AreaStrategy {
  constructor(
    scene: Phaser.Scene,
    trackedTween: (config: Phaser.Types.Tweens.TweenBuilderConfig) => Phaser.Tweens.Tween,
  ) {
    super(scene, trackedTween);
  }

  drawPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number, _type: PlatformType): void {
    this.drawCityPlatform(g, w, h);
  }

  addDecorations(
    result: LoadedArea,
    x: number, y: number, w: number, h: number,
    type: PlatformType,
  ): void {
    // Floor decorations: fire, ash, debris, sandbags
    if (type === 'floor' && w >= 80) {
      if (Math.random() < 0.3) this.addFireDebris(result, x, y, w, h);
      if (Math.random() < 0.15) this.addSandbags(result, x, y, w, h);
      if (Math.random() < 0.1) this.addBrokenGlass(result, x, y, w);
    }
    // Wall decorations: cracks, bullet holes, scorch marks
    if (type === 'wall' && h > 100 && Math.random() < 0.4) {
      this.addWallDamage(result, x, y, w, h);
    }
    // Ledge: rubble
    if (type === 'ledge' && w >= 60) {
      if (Math.random() < 0.3) this.addRubble(result, x, y, w, h);
    }
  }

  createHazardVisual(hazard: HazardVisualData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(hazard.x, hazard.y);
    container.setDepth(5);

    if (hazard.type === 'spike') {
      // Barbed wire / rebar shards from rubble
      const base = this.scene.add.rectangle(0, hazard.h / 2 - 4, hazard.w, 4, CITY.CONCRETE_DARK, 1);
      base.setStrokeStyle(1, CITY.CONCRETE_BASE, 0.6);
      container.add(base);
      const shardCount = Math.floor(hazard.w / 14);
      const spacing = hazard.w / shardCount;
      for (let i = 0; i < shardCount; i++) {
        const sx = -hazard.w / 2 + (i + 0.5) * spacing;
        // Rusted rebar shard
        const shard = this.scene.add.triangle(sx, 0, -3, hazard.h / 2, 3, hazard.h / 2, 0, -hazard.h / 2 + 2, CITY.RUST, 0.9);
        shard.setStrokeStyle(1, CITY.BRICK_DARK, 0.5);
        container.add(shard);
      }
    } else if (hazard.type === 'lava') {
      // Fire — burning building debris
      const glow = this.scene.add.rectangle(0, 0, hazard.w + 12, hazard.h + 6, CITY.FIRE_GLOW, 0.08);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
      this.trackedTween({ targets: glow, alpha: { from: 0.04, to: 0.12 }, duration: 1500, yoyo: true, repeat: -1 });
      // Fire base (dark scorched earth)
      const surface = this.scene.add.rectangle(0, 0, hazard.w, hazard.h, CITY.BRICK_DARK, 0.8);
      container.add(surface);
      // Deep fire (orange bottom)
      const deep = this.scene.add.rectangle(0, hazard.h / 4, hazard.w, hazard.h / 2, CITY.BRICK, 0.9);
      container.add(deep);
      // Flame flicker
      const flicker = this.scene.add.rectangle(0, -1, hazard.w, 1, CITY.FIRE_GLOW, 0.3);
      flicker.setBlendMode(Phaser.BlendModes.ADD);
      container.add(flicker);
      this.trackedTween({
        targets: flicker, alpha: { from: 0.15, to: 0.4 }, scaleX: { from: 0.95, to: 1 },
        duration: 800, yoyo: true, repeat: -1,
      });
      // Embers (rising particles)
      const emberCount = Math.max(2, Math.floor(hazard.w / 50));
      for (let i = 0; i < emberCount; i++) {
        const bx = (Math.random() - 0.5) * hazard.w * 0.7;
        const ember = this.scene.add.circle(bx, 0, 1 + Math.random() * 1.5, CITY.FIRE_GLOW, 0.5);
        ember.setBlendMode(Phaser.BlendModes.ADD);
        container.add(ember);
        this.trackedTween({
          targets: ember,
          y: { from: hazard.h / 4, to: -hazard.h / 4 },
          scale: { from: 0.3, to: 1.2 },
          alpha: { from: 0.5, to: 0 },
          duration: 1500 + Math.random() * 1000, repeat: -1, delay: Math.random() * 2000,
        });
      }
    } else if (hazard.type === 'laser') {
      // Broken power line — electric arc
      const wire = this.scene.add.rectangle(0, 0, hazard.w, 2, CITY.METAL, 0.8);
      container.add(wire);
      const sparkGlow = this.scene.add.rectangle(0, 0, hazard.w, 6, CITY.FIRE_GLOW, 0.2);
      sparkGlow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(sparkGlow);
      this.trackedTween({
        targets: [wire, sparkGlow],
        alpha: { from: 0.3, to: 0.9 },
        duration: 100, yoyo: true, repeat: -1,
      });
      for (const ex of [-hazard.w / 2, hazard.w / 2]) {
        const cap = this.scene.add.rectangle(ex, 0, 4, 8, CITY.METAL_DARK, 0.9);
        cap.setStrokeStyle(1, CITY.RUST, 0.6);
        container.add(cap);
      }
    } else {
      // Default: rubble patch
      const vis = this.scene.add.rectangle(0, 0, hazard.w, hazard.h, CITY.CONCRETE_BASE, 0.4);
      vis.setStrokeStyle(1, CITY.CONCRETE_LIGHT, 0.5);
      container.add(vis);
    }

    container.setSize(hazard.w, hazard.h);
    return container;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Private rendering methods
  // ═══════════════════════════════════════════════════════════════════════

  /** Draw a city platform — cracked concrete with scorch marks. */
  private drawCityPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    // Body — dark cracked concrete
    g.fillStyle(CITY.CONCRETE_DARK, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 3);

    // Concrete texture — irregular lighter patches (cracks)
    g.fillStyle(CITY.CONCRETE_BASE, 0.6);
    for (let mx = -w / 2 + 8; mx < w / 2 - 4; mx += 14) {
      const my = -h / 2 + 4 + Math.random() * (h - 8);
      g.fillCircle(mx, my, 2 + Math.random() * 3);
    }

    // Top surface — lighter, scuffed concrete
    g.fillStyle(CITY.CONCRETE_LIGHT, 0.7);
    g.fillRoundedRect(-w / 2, -h / 2, w, 4, 2);

    // Scorch marks (dark burns from fire/blast)
    g.fillStyle(CITY.BRICK_DARK, 0.3);
    for (let sx = -w / 2 + 15; sx < w / 2 - 10; sx += 25) {
      if (Math.random() < 0.3) {
        const sy = -h / 2 + 6 + Math.random() * (h - 12);
        g.fillCircle(sx, sy, 2 + Math.random() * 3);
      }
    }

    // Fire glow stains (orange residue)
    g.fillStyle(CITY.FIRE_GLOW, 0.08);
    for (let fx = -w / 2 + 20; fx < w / 2 - 15; fx += 30) {
      if (Math.random() < 0.2) {
        g.fillCircle(fx, -h / 2 + 4, 3 + Math.random() * 4);
      }
    }

    // Rebar fragments (rusted metal poking through broken concrete)
    g.fillStyle(CITY.RUST, 0.5);
    for (let rx = -w / 2 + 15; rx < w / 2 - 10; rx += 22) {
      if (Math.random() < 0.3) {
        const ry = -h / 2 + 6 + Math.random() * (h - 12);
        g.fillRect(rx, ry, 3 + Math.random() * 3, 1.5);
      }
    }

    // Crack lines (jagged)
    g.lineStyle(1, CITY.CONCRETE_DARK, 0.6);
    for (let cx = -w / 2 + 10; cx < w / 2 - 10; cx += 30) {
      if (Math.random() < 0.3) {
        const cy = -h / 2 + 4 + Math.random() * (h - 8);
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + 5, cy + 3);
        g.lineTo(cx + 3, cy + 8);
        g.lineTo(cx + 8, cy + 10);
        g.strokePath();
      }
    }

    // Border
    g.lineStyle(1, CITY.CONCRETE_DARK, 0.8);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 3);

    // Occasional iron reinforcement (on wider platforms)
    if (w >= 100 && Math.random() < 0.3) {
      const edgeX = (Math.random() - 0.5) * w * 0.5;
      g.fillStyle(CITY.METAL, 0.6);
      g.fillRect(edgeX - 6, -h / 2, 12, 3);
      g.fillStyle(CITY.RUST, 0.4);
      g.fillRect(edgeX - 6, -h / 2, 12, 1);
    }
  }

  /** Add fire debris on floor — small burning piles with glow. */
  private addFireDebris(result: LoadedArea, x: number, y: number, w: number, _h: number): void {
    const count = Math.floor(w / 200);
    for (let i = 0; i < count; i++) {
      const fx = x + (Math.random() - 0.5) * w * 0.7;
      const fy = y - 2;
      // Glow
      const glow = this.scene.add.circle(fx, fy, 8, CITY.FIRE_GLOW, 0.1);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(4);
      result.visualRects.push(glow as unknown as Phaser.GameObjects.Rectangle);
      this.trackedTween({
        targets: glow, alpha: { from: 0.06, to: 0.15 }, scale: { from: 0.9, to: 1.2 },
        duration: 1200 + Math.random() * 800, yoyo: true, repeat: -1,
      });
    }
  }

  /** Add sandbag barricade on floor. */
  private addSandbags(result: LoadedArea, x: number, y: number, w: number, _h: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(4);
    const count = Math.floor(w / 60);
    for (let i = 0; i < count; i++) {
      const sx = x + (i - count / 2) * 50 + Math.random() * 20;
      const sy = y - 8 + (i % 2) * 6;
      // Sandbag body
      g.fillStyle(CITY.SAND, 0.8);
      g.fillRoundedRect(sx - 12, sy - 6, 24, 12, 3);
      g.fillStyle(CITY.CONCRETE_LIGHT, 0.3);
      g.fillRect(sx - 12, sy - 6, 24, 2);
    }
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);
  }

  /** Add broken glass shards on floor. */
  private addBrokenGlass(result: LoadedArea, x: number, y: number, w: number): void {
    const count = Math.floor(w / 80);
    for (let i = 0; i < count; i++) {
      const gx = x + (Math.random() - 0.5) * w * 0.6;
      const shard = this.scene.add.triangle(gx, y, -3, 2, 3, 2, 0, -4, CITY.GLASS, 0.4);
      shard.setBlendMode(Phaser.BlendModes.ADD);
      shard.setDepth(4);
      result.visualRects.push(shard as unknown as Phaser.GameObjects.Rectangle);
    }
  }

  /** Add wall damage — cracks, bullet holes, scorch marks. */
  private addWallDamage(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(6);
    // Cracks
    const crackCount = 2 + Math.floor(w / 50);
    for (let i = 0; i < crackCount; i++) {
      const cx = x + (Math.random() - 0.5) * w * 0.7;
      const cy = y - h / 2 + 4;
      g.lineStyle(1, CITY.CONCRETE_DARK, 0.6);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + 5, cy + 10);
      g.lineTo(cx - 3, cy + 20);
      g.lineTo(cx + 6, cy + 30);
      g.strokePath();
    }
    // Bullet holes
    const holeCount = 1 + Math.floor(h / 60);
    for (let i = 0; i < holeCount; i++) {
      const hx = x + (Math.random() - 0.5) * w * 0.6;
      const hy = y + (Math.random() - 0.5) * h * 0.5;
      g.fillStyle(CITY.CONCRETE_DARK, 0.7);
      g.fillCircle(hx, hy, 2);
      g.fillStyle(CITY.ASH, 0.3);
      g.fillCircle(hx, hy, 3);
    }
    // Scorch marks
    g.fillStyle(CITY.BRICK_DARK, 0.3);
    g.fillCircle(x + (Math.random() - 0.5) * w * 0.5, y - h / 4, 8 + Math.random() * 6);
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);
  }

  /** Add rubble on ledges. */
  private addRubble(result: LoadedArea, x: number, y: number, w: number, _h: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(6);
    const count = 2 + Math.floor(w / 40);
    for (let i = 0; i < count; i++) {
      const rx = x + (Math.random() - 0.5) * w * 0.7;
      const ry = y + (Math.random() - 0.5) * 4;
      g.fillStyle(CITY.CONCRETE_BASE, 0.6);
      g.fillCircle(rx, ry, 2 + Math.random() * 3);
      g.fillStyle(CITY.CONCRETE_DARK, 0.4);
      g.fillCircle(rx + 1, ry + 1, 1 + Math.random() * 2);
    }
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);
  }
}

export default CityAreaStrategy;
