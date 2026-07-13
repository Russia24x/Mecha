/**
 * MECHA: LAST PROTOCOL — Forest Environment System
 *
 * Creates the living forest atmosphere for the Toxic Forest region:
 *   1. GrassBending — grass blades that bend when player walks through
 *   2. TreeSway — tree foliage that sways with wind (sine wave skew)
 *   3. HangingVines — vines dangling from ceilings, sway on proximity
 *   4. WaterSurface — dynamic spring-mass water with ripples on impact
 *   5. RainParticles — ambient rain falling across the screen
 *
 * Per user spec:
 *   - Grass Bending: bend grass based on player X proximity, springiness return
 *   - Tree Foliage Swaying: skew/sine sway with per-tree randomization
 *   - Hanging Ivy/Vines: rope-like sway, reacts to nearby explosions
 *   - Dynamic Water Surface: spring-mass system, wave propagation + damping
 *
 * All systems are tied to PLAY state only — destroyed in cleanupPlay.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';

// ─── GRASS BLADE ────────────────────────────────────────────────────────
interface GrassBlade {
  gfx: Phaser.GameObjects.Graphics;
  x: number;
  baseY: number;
  height: number;
  bend: number;       // current bend offset (-1 to 1)
  targetBend: number; // target bend
  springiness: number;
  color: number;
}

// ─── TREE ───────────────────────────────────────────────────────────────
interface TreeFoliage {
  container: Phaser.GameObjects.Container;
  x: number;
  y: number;
  phase: number;      // random phase offset
  swaySpeed: number;  // wind speed
  swayAmplitude: number;
}

// ─── VINE ───────────────────────────────────────────────────────────────
interface Vine {
  segments: Phaser.GameObjects.Graphics[];
  anchorX: number;
  anchorY: number;
  length: number;
  sway: number;
  swayVel: number;
}

// ─── WATER SURFACE ──────────────────────────────────────────────────────
interface WaterPoint {
  x: number;
  y: number;
  baseY: number;
  vel: number;
  displacement: number;
}

export class ForestEnvironmentSystem {
  private scene: Phaser.Scene;
  private worldWidth: number;
  private grass: GrassBlade[] = [];
  private trees: TreeFoliage[] = [];
  private vines: Vine[] = [];
  private waterPoints: WaterPoint[] = [];
  private waterGfx: Phaser.GameObjects.Graphics | null = null;
  private rainParticles: Phaser.GameObjects.GameObject[] = [];
  private animTime = 0;

  constructor(scene: Phaser.Scene, worldWidth: number) {
    this.scene = scene;
    this.worldWidth = worldWidth;
  }

  build(): void {
    this.buildGrass();
    this.buildTrees();
    this.buildVines();
    this.buildWater();
    this.buildRain();
  }

  // ─── GRASS BENDING ─────────────────────────────────────────────────────
  private buildGrass(): void {
    const grassCount = Math.floor(this.worldWidth / 25);
    for (let i = 0; i < grassCount; i++) {
      const x = i * 25 + Math.random() * 15;
      const y = GAME.HEIGHT - 30 + Math.random() * 10;
      const height = 12 + Math.random() * 16;
      const color = [0x2a5a30, 0x3a6a40, 0x4a7a50][Math.floor(Math.random() * 3)];
      const gfx = this.scene.add.graphics();
      gfx.setDepth(4);
      const blade: GrassBlade = {
        gfx, x, baseY: y, height,
        bend: 0, targetBend: 0,
        springiness: 0.08 + Math.random() * 0.04,
        color,
      };
      this.drawGrassBlade(blade);
      this.grass.push(blade);
    }
  }

  private drawGrassBlade(blade: GrassBlade): void {
    const g = blade.gfx;
    g.clear();
    g.lineStyle(2, blade.color, 0.8);
    g.beginPath();
    g.moveTo(blade.x, blade.baseY);
    // Bend the top of the blade based on bend value
    const tipX = blade.x + blade.bend * blade.height * 0.5;
    const tipY = blade.baseY - blade.height;
    // Curve through a midpoint
    const midX = blade.x + blade.bend * blade.height * 0.25;
    const midY = blade.baseY - blade.height * 0.5;
    g.lineTo(midX, midY);
    g.lineTo(tipX, tipY);
    g.strokePath();
    // Small leaf at the tip
    g.fillStyle(blade.color, 0.6);
    g.fillCircle(tipX, tipY, 1.5);
  }

  updateGrass(playerX: number): void {
    for (const blade of this.grass) {
      const dist = Math.abs(blade.x - playerX);
      if (dist < 40) {
        // Bend away from player
        const dir = blade.x < playerX ? -1 : 1;
        const intensity = (1 - dist / 40);
        blade.targetBend = dir * intensity;
      } else {
        blade.targetBend = 0;
      }
      // Spring back
      blade.bend = Phaser.Math.Linear(blade.bend, blade.targetBend, blade.springiness);
      this.drawGrassBlade(blade);
    }
  }

  // ─── TREE FOLIAGE SWAYING ──────────────────────────────────────────────
  private buildTrees(): void {
    const treeCount = Math.floor(this.worldWidth / 400);
    for (let i = 0; i < treeCount; i++) {
      const x = i * 400 + Math.random() * 200;
      const y = 100 + Math.random() * 80;
      const container = this.scene.add.container(x, y);
      container.setDepth(1);
      container.setScrollFactor(0.3, 0.1);  // parallax
      // Trunk
      const trunk = this.scene.add.graphics();
      trunk.fillStyle(0x1a2a14, 0.7);
      trunk.fillRect(-6, 0, 12, 200);
      trunk.fillStyle(0x2a3a20, 0.5);
      trunk.fillRect(-4, 0, 2, 200);
      container.add(trunk);
      // Foliage canopy (multiple circles)
      const foliageColors = [0x2a4a20, 0x3a5a28, 0x4a6a30];
      for (let f = 0; f < 5; f++) {
        const fx = (Math.random() - 0.5) * 50;
        const fy = -20 - Math.random() * 40;
        const fr = 25 + Math.random() * 20;
        const foliage = this.scene.add.circle(fx, fy, fr, foliageColors[f % 3], 0.5);
        foliage.setStrokeStyle(1, 0x1a3a18, 0.3);
        container.add(foliage);
      }
      this.trees.push({
        container, x, y,
        phase: Math.random() * Math.PI * 2,
        swaySpeed: 0.5 + Math.random() * 0.5,
        swayAmplitude: 0.02 + Math.random() * 0.03,
      });
    }
  }

  updateTrees(deltaMs: number): void {
    this.animTime += deltaMs;
    for (const tree of this.trees) {
      const sway = Math.sin(this.animTime / 1000 * tree.swaySpeed + tree.phase) * tree.swayAmplitude;
      tree.container.setRotation(sway);
      // Slight horizontal drift
      tree.container.x = tree.x + Math.sin(this.animTime / 1500 * tree.swaySpeed + tree.phase) * 3;
    }
  }

  // ─── HANGING VINES ─────────────────────────────────────────────────────
  private buildVines(): void {
    const vineCount = Math.floor(this.worldWidth / 250);
    for (let i = 0; i < vineCount; i++) {
      const x = i * 250 + Math.random() * 100;
      const anchorY = 0;
      const length = 60 + Math.random() * 80;
      const segments: Phaser.GameObjects.Graphics[] = [];
      const segCount = 5;
      for (let s = 0; s < segCount; s++) {
        const segGfx = this.scene.add.graphics();
        segGfx.setDepth(3);
        segGfx.setScrollFactor(0.4, 0.15);
        segments.push(segGfx);
      }
      this.vines.push({
        segments, anchorX: x, anchorY, length,
        sway: 0, swayVel: 0,
      });
      this.drawVine(this.vines[i]);
    }
  }

  private drawVine(vine: Vine): void {
    const segLen = vine.length / vine.segments.length;
    let prevX = vine.anchorX;
    let prevY = vine.anchorY;
    for (let s = 0; s < vine.segments.length; s++) {
      const g = vine.segments[s];
      g.clear();
      const t = (s + 1) / vine.segments.length;
      // Sway increases toward the bottom (like a pendulum)
      const swayOffset = vine.sway * t * t * vine.length * 0.3;
      const segX = vine.anchorX + swayOffset;
      const segY = vine.anchorY + (s + 1) * segLen;
      g.lineStyle(2, 0x2a4a20, 0.7);
      g.beginPath();
      g.moveTo(prevX, prevY);
      g.lineTo(segX, segY);
      g.strokePath();
      // Leaves
      if (s % 2 === 1) {
        g.fillStyle(0x3a5a28, 0.5);
        g.fillCircle(segX, segY, 3);
      }
      prevX = segX;
      prevY = segY;
    }
  }

  updateVines(deltaMs: number, playerX: number): void {
    for (const vine of this.vines) {
      // Proximity sway
      const dist = Math.abs(vine.anchorX - playerX);
      if (dist < 100) {
        const force = (1 - dist / 100) * 0.5;
        vine.swayVel += (vine.anchorX < playerX ? -force : force) * (deltaMs / 16);
      }
      // Spring back
      vine.swayVel += -vine.sway * 0.03 * (deltaMs / 16);
      vine.swayVel *= 0.95;  // damping
      vine.sway += vine.swayVel * (deltaMs / 16);
      this.drawVine(vine);
    }
  }

  // ─── DYNAMIC WATER SURFACE ─────────────────────────────────────────────
  private buildWater(): void {
    // Water at bottom of screen (a pool)
    const waterY = GAME.HEIGHT - 15;
    const pointCount = Math.ceil(this.worldWidth / 15);
    for (let i = 0; i <= pointCount; i++) {
      this.waterPoints.push({
        x: i * 15,
        y: waterY,
        baseY: waterY,
        vel: 0,
        displacement: 0,
      });
    }
    this.waterGfx = this.scene.add.graphics();
    this.waterGfx.setDepth(3);
  }

  /** Splash at a position — creates ripples that propagate. */
  splash(x: number, force: number = 5): void {
    // Find nearest water point
    for (const p of this.waterPoints) {
      const dist = Math.abs(p.x - x);
      if (dist < 60) {
        const impact = (1 - dist / 60) * force;
        p.vel += impact;
      }
    }
  }

  updateWater(deltaMs: number): void {
    if (!this.waterGfx) return;
    const dt = deltaMs / 16;
    // Spring physics: each point springs back to baseY + propagates to neighbors
    for (const p of this.waterPoints) {
      const springForce = -p.displacement * 0.025;
      p.vel += springForce * dt;
      p.vel *= 0.98;  // damping
      p.displacement += p.vel * dt;
      p.y = p.baseY + p.displacement;
    }
    // Wave propagation — each point pulls neighbors
    const spread = 0.15;
    const deltas: number[] = [];
    for (let i = 0; i < this.waterPoints.length; i++) {
      if (i > 0) {
        const d = spread * (this.waterPoints[i].displacement - this.waterPoints[i - 1].displacement);
        this.waterPoints[i - 1].vel += d;
      }
      if (i < this.waterPoints.length - 1) {
        const d = spread * (this.waterPoints[i].displacement - this.waterPoints[i + 1].displacement);
        this.waterPoints[i + 1].vel += d;
      }
    }
    // Draw water surface
    this.waterGfx.clear();
    this.waterGfx.fillStyle(0x1a3a5a, 0.4);
    this.waterGfx.beginPath();
    this.waterGfx.moveTo(0, GAME.HEIGHT);
    for (const p of this.waterPoints) {
      this.waterGfx.lineTo(p.x, p.y);
    }
    this.waterGfx.lineTo(this.worldWidth, GAME.HEIGHT);
    this.waterGfx.closePath();
    this.waterGfx.fillPath();
    // Surface highlight line
    this.waterGfx.lineStyle(1, 0x4080a0, 0.5);
    this.waterGfx.beginPath();
    this.waterGfx.moveTo(this.waterPoints[0].x, this.waterPoints[0].y);
    for (const p of this.waterPoints) {
      this.waterGfx.lineTo(p.x, p.y);
    }
    this.waterGfx.strokePath();
  }

  // ─── RAIN PARTICLES ────────────────────────────────────────────────────
  private buildRain(): void {
    const rainCount = 60;
    for (let i = 0; i < rainCount; i++) {
      const drop = this.scene.add.line(
        Math.random() * GAME.WIDTH,
        Math.random() * GAME.HEIGHT,
        0, 0, 2, 12,
        0x6090b0, 0.3
      );
      drop.setScrollFactor(0.2, 0);
      drop.setDepth(50);
      this.rainParticles.push(drop);
      // Falling animation
      this.scene.tweens.add({
        targets: drop,
        y: `+=${GAME.HEIGHT + 20}`,
        x: `+=${30}`,  // slight diagonal (wind)
        duration: 400 + Math.random() * 200,
        repeat: -1,
        delay: Math.random() * 400,
        onRepeat: () => {
          drop.y = -20;
          drop.x = Math.random() * GAME.WIDTH;
        },
      });
    }
  }

  // ─── MASTER UPDATE ─────────────────────────────────────────────────────
  update(deltaMs: number, playerX: number, playerY: number): void {
    this.updateGrass(playerX);
    this.updateTrees(deltaMs);
    this.updateVines(deltaMs, playerX);
    this.updateWater(deltaMs);
    // Splash if player is near water level
    if (playerY > GAME.HEIGHT - 40) {
      this.splash(playerX, 3);
    }
  }

  destroy(): void {
    this.grass.forEach(g => { if (g.gfx && g.gfx.active) g.gfx.destroy(); });
    this.grass = [];
    this.trees.forEach(t => { if (t.container && t.container.active) t.container.destroy(); });
    this.trees = [];
    this.vines.forEach(v => v.segments.forEach(s => { if (s && s.active) s.destroy(); }));
    this.vines = [];
    this.waterGfx?.destroy();
    this.waterGfx = null;
    this.waterPoints = [];
    this.rainParticles.forEach(r => { if (r && r.active) r.destroy(); });
    this.rainParticles = [];
  }
}

export default ForestEnvironmentSystem;
