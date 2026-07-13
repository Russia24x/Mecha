/**
 * MECHA: LAST PROTOCOL — Area Loader
 * Converts AreaData into Matter physics bodies + visual rectangles + triggers.
 * Reads platform/hazard data from AreaData.sections.
 * Independent of entities — just builds the physical world.
 */
import Phaser from 'phaser';
import { GAME, COLORS } from '../shared/Constants';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { WorldSystem } from './WorldSystem';
import { t } from '../systems/LocalizationSystem';
import type { AreaData, SectionData, PlatformData, HazardData, LoreObjectData, LandmarkData } from '../data/types';

export interface LoadedArea {
  solids: Phaser.Physics.Matter.Image[];
  sectionTriggers: Phaser.Physics.Matter.Image[];
  checkpointTriggers: Phaser.Physics.Matter.Image[];
  bossEntryTrigger: Phaser.Physics.Matter.Image | null;
  hazardTriggers: Phaser.Physics.Matter.Image[];
  visualRects: Phaser.GameObjects.Rectangle[];
  loreObjects: Phaser.GameObjects.Container[];
  landmarks: Phaser.GameObjects.Container[];
  grappleAnchors: Phaser.GameObjects.Container[];
  empDoors: Phaser.GameObjects.Container[];
}

export class AreaLoader {
  private scene: Phaser.Scene;
  private physics: PhysicsSystem;

  constructor(scene: Phaser.Scene, physics: PhysicsSystem) {
    this.scene = scene;
    this.physics = physics;
  }

  /**
   * Build the full area: floor, ceiling, per-section platforms, hazards,
   * section triggers, checkpoint triggers, boss entry trigger.
   */
  load(area: AreaData): LoadedArea {
    const result: LoadedArea = {
      solids: [],
      sectionTriggers: [],
      checkpointTriggers: [],
      bossEntryTrigger: null,
      hazardTriggers: [],
      visualRects: [],
      loreObjects: [],
      landmarks: [],
      grappleAnchors: [],
      empDoors: [],
    };

    // Floor (spans entire area)
    this.addSolid(result, area.totalWidth / 2, GAME.HEIGHT, area.totalWidth, 80);
    // Ceiling
    this.addSolid(result, area.totalWidth / 2, -20, area.totalWidth, 40);

    // Per-section platforms + hazards
    for (const section of area.sections) {
      this.buildSection(result, section, area.sectionWidth);
    }

    // Section triggers (at start of each section)
    for (let i = 0; i < area.sections.length; i++) {
      const sec = area.sections[i];
      const trigger = this.physics.addSensor(sec.x + 80, GAME.HEIGHT / 2, 40, GAME.HEIGHT, `section-${sec.id}`);
      trigger.setData('sectionId', sec.id);
      result.sectionTriggers.push(trigger);
    }

    // Checkpoint triggers
    for (const secId of area.checkpointSections) {
      const cpX = (secId - 1) * area.sectionWidth + 640;
      const cp = this.physics.addSensor(cpX, GAME.HEIGHT - 80, 60, 60, `checkpoint-${secId}`);
      cp.setData('isCheckpoint', true);
      cp.setData('checkpointSection', secId);
      result.checkpointTriggers.push(cp);
    }

    // Boss entry trigger (section 6 = last section with bossId)
    const bossSection = area.sections.find(s => s.bossId);
    if (bossSection) {
      const bossX = bossSection.x + 400;
      const trigger = this.physics.addSensor(bossX, GAME.HEIGHT - 100, 40, 200, 'boss-entry');
      trigger.setData('isBossEntry', true);
      trigger.setData('bossId', bossSection.bossId);
      result.bossEntryTrigger = trigger;
    }

    return result;
  }

  private buildSection(result: LoadedArea, section: SectionData, sectionWidth: number): void {
    if (section.platforms) {
      for (const plat of section.platforms) {
        this.addSolid(result, plat.x, plat.y, plat.w, plat.h);
      }
    }
    // Hazards
    if (section.hazards) {
      for (const hazard of section.hazards) {
        const trigger = this.physics.addSensor(hazard.x, hazard.y, hazard.w, hazard.h, `hazard-${hazard.type}`);
        trigger.setData('isHazard', true);
        trigger.setData('hazardDamage', hazard.damage);
        result.hazardTriggers.push(trigger);
        // Visual: red spike strip
        const hazardVis = this.scene.add.rectangle(hazard.x, hazard.y, hazard.w, hazard.h, 0xff2030, 0.3);
        hazardVis.setStrokeStyle(1, 0xff4050, 0.5);
        hazardVis.setDepth(5);
        result.visualRects.push(hazardVis);
      }
    }
    // Lore Objects — interactable environmental storytelling
    if (section.loreObjects) {
      for (const lore of section.loreObjects) {
        const container = this.createLoreObject(lore);
        result.loreObjects.push(container);
      }
    }
    // Landmarks — large visual structures
    if (section.landmarks) {
      for (const lm of section.landmarks) {
        const container = this.createLandmark(lm);
        result.landmarks.push(container);
      }
    }
    // Grapple Anchors — ability-gated (Metroidvania)
    if (section.grappleAnchors) {
      for (const anchor of section.grappleAnchors) {
        const container = this.createGrappleAnchor(anchor);
        result.grappleAnchors.push(container);
      }
    }
    // EMP Doors — ability-gated (Metroidvania)
    if (section.empDoors) {
      for (const door of section.empDoors) {
        const container = this.createEmpDoor(door);
        result.empDoors.push(container);
      }
    }
  }

  /** Create a grapple anchor — glowing ring that the player can grapple to. */
  private createGrappleAnchor(anchor: { id: string; x: number; y: number }): Phaser.GameObjects.Container {
    const container = this.scene.add.container(anchor.x, anchor.y);
    // Outer glow ring (pulsing cyan)
    const glow = this.scene.add.circle(0, 0, 14, 0x66f0ff, 0.15);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    container.add(glow);
    this.scene.tweens.add({
      targets: glow, alpha: { from: 0.08, to: 0.25 }, scale: { from: 0.9, to: 1.2 },
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
    // Inner ring (solid)
    const ring = this.scene.add.circle(0, 0, 8, 0x66f0ff, 0);
    ring.setStrokeStyle(2, 0x66f0ff, 0.8);
    container.add(ring);
    // Center dot
    const dot = this.scene.add.circle(0, 0, 2, 0x66f0ff, 0.9);
    dot.setBlendMode(Phaser.BlendModes.ADD);
    container.add(dot);
    // Rotating spokes (4 small lines)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const spoke = this.scene.add.rectangle(
        Math.cos(angle) * 6, Math.sin(angle) * 6, 4, 1, 0x66f0ff, 0.6
      );
      spoke.setRotation(angle);
      spoke.setBlendMode(Phaser.BlendModes.ADD);
      container.add(spoke);
    }
    // Slow rotation
    this.scene.tweens.add({ targets: container, rotation: Math.PI * 2, duration: 4000, repeat: -1, ease: 'Linear' });
    container.setDepth(6);
    container.setData('grappleAnchorId', anchor.id);
    container.setData('isGrappleAnchor', true);
    return container;
  }

  /** Create an EMP door — locked barrier that opens when hit by EMP pulse. */
  private createEmpDoor(door: { id: string; x: number; y: number; w: number; h: number }): Phaser.GameObjects.Container {
    const container = this.scene.add.container(door.x, door.y);
    // Door body (magenta barrier)
    const body = this.scene.add.rectangle(0, 0, door.w, door.h, 0x602080, 0.6);
    body.setStrokeStyle(2, 0xc060ff, 0.8);
    container.add(body);
    // Energy field lines (horizontal, animated)
    for (let i = 0; i < 3; i++) {
      const line = this.scene.add.rectangle(0, -door.h / 4 + i * door.h / 4, door.w - 4, 1, 0xc060ff, 0.5);
      line.setBlendMode(Phaser.BlendModes.ADD);
      container.add(line);
      this.scene.tweens.add({
        targets: line, alpha: { from: 0.2, to: 0.7 }, duration: 600 + i * 200, yoyo: true, repeat: -1,
      });
    }
    // Lock indicator (small icon)
    const lock = this.scene.add.text(0, 0, '🔒', { fontSize: '10px', color: '#c060ff' }).setOrigin(0.5);
    container.add(lock);
    container.setDepth(7);
    container.setData('empDoorId', door.id);
    container.setData('isEmpDoor', true);
    container.setData('empDoorOpen', false);
    container.setSize(door.w, door.h);
    return container;
  }

  private addSolid(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const s = this.physics.addStaticRect(x, y, w, h);
    const g = this.scene.add.graphics();
    g.setDepth(5);

    // ── Categorize the solid by shape ──
    const isWall = h > 80 && w < 100;       // tall narrow = wall
    const isFloor = h <= 30 && w >= 100;    // wide thin = floor / platform
    const isLedge = h <= 30 && w < 100;     // small thin = ledge
    const isPillar = h > 80 && w >= 100;    // tall wide = pillar/block

    if (isWall) {
      this.drawWall(g, w, h);
    } else if (isFloor) {
      this.drawFloor(g, w, h);
    } else if (isLedge) {
      this.drawLedge(g, w, h);
    } else if (isPillar) {
      this.drawPillar(g, w, h);
    } else {
      this.drawGeneric(g, w, h);
    }

    g.setPosition(x, y);
    result.solids.push(s);
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);

    // ── Add depth decorations: hanging cables / pipes / machine parts ──
    // (drawn as separate graphics so they don't move with the body)
    if (isFloor && w >= 120) {
      this.addFloorDecorations(result, x, y, w, h);
    }
    if (isWall && h > 150) {
      this.addWallDecorations(result, x, y, w, h);
    }

    // ── Random environmental hazards (electrical sparks, fire, steam) ──
    // These give the factory a lived-in, dangerous feel — not just empty platforms.
    if (isFloor && w >= 100) {
      // 25% chance of an electrical short (broken wire sparking)
      if (Math.random() < 0.25) {
        this.addElectricalSparks(result, x + (Math.random() - 0.5) * w * 0.6, y + h / 2 + 6);
      }
      // 15% chance of a small fire (oil leak ignited)
      if (Math.random() < 0.15) {
        this.addFireHazard(result, x + (Math.random() - 0.5) * w * 0.5, y + h / 2 - 2);
      }
      // 20% chance of a steam vent (hissing pipe)
      if (Math.random() < 0.20) {
        this.addSteamVent(result, x + (Math.random() - 0.5) * w * 0.6, y - h / 2 - 4);
      }
    }
  }

  /** Wide floor platform — the main walking surface. Looks like industrial metal grating. */
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
      this.scene.tweens.add({
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
      this.scene.tweens.add({
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
      this.scene.tweens.add({
        targets: bolt, alpha: 0, duration: 80,
        onComplete: () => bolt.destroy(),
      });
      // Scattered spark particles
      for (let i = 0; i < 4; i++) {
        const px = x + 2 + (Math.random() - 0.5) * 8;
        const py = y + (Math.random() - 0.5) * 6;
        const p = this.scene.add.circle(px, py, 1, 0xc0e0ff, 1);
        p.setBlendMode(Phaser.BlendModes.ADD).setDepth(7);
        this.scene.tweens.add({
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
      this.scene.tweens.add({
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
    this.scene.tweens.add({
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
        this.scene.tweens.add({
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
        this.scene.tweens.add({
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

  /** Create an interactable lore object — dramatic visual, not just a rectangle */
  private createLoreObject(lore: LoreObjectData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(lore.x, lore.y);
    const parts: Phaser.GameObjects.GameObject[] = [];

    if (lore.type === 'terminal') {
      // TERMINAL: Full mech-sized terminal station with glowing screen
      // Base pedestal
      const pedestal = this.scene.add.rectangle(0, 18, 44, 16, 0x1a1e28, 0.95);
      pedestal.setStrokeStyle(1, 0x3a3040, 0.6);
      parts.push(pedestal);
      // Screen housing
      const housing = this.scene.add.rectangle(0, -5, 36, 40, 0x12141c, 0.95);
      housing.setStrokeStyle(2, 0x4a4030, 0.7);
      parts.push(housing);
      // Glowing screen (amber, pulsing)
      const screen = this.scene.add.rectangle(0, -8, 28, 24, 0xffc040, 0.15);
      screen.setBlendMode(Phaser.BlendModes.ADD);
      parts.push(screen);
      this.scene.tweens.add({ targets: screen, alpha: { from: 0.08, to: 0.25 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      // Scan lines on screen
      for (let i = 0; i < 4; i++) {
        const line = this.scene.add.rectangle(0, -18 + i * 6, 24, 1, 0xffc040, 0.2);
        parts.push(line);
      }
      // Ambient glow halo
      const glow = this.scene.add.circle(0, -5, 50, 0xffc040, 0.04);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      parts.push(glow);
      this.scene.tweens.add({ targets: glow, scale: { from: 0.9, to: 1.2 }, alpha: { from: 0.03, to: 0.08 }, duration: 2000, yoyo: true, repeat: -1 });
      // Prompt
      const label = this.scene.add.text(0, 32, '▼ EXAMINE', { fontFamily: 'monospace', fontSize: '8px', color: '#ffc040', letterSpacing: 1 }).setOrigin(0.5);
      parts.push(label);
      this.scene.tweens.add({ targets: label, alpha: { from: 0.4, to: 1 }, duration: 800, yoyo: true, repeat: -1 });

    } else if (lore.type === 'corpse') {
      // CORPSE: Full fallen mech — body, limbs, flickering core
      // Main body (slumped)
      const body = this.scene.add.rectangle(0, 0, 56, 28, 0x1a1820, 0.95);
      body.setStrokeStyle(1, 0x3a2830, 0.5);
      body.setAngle(-8);
      parts.push(body);
      // Arm outstretched
      const arm = this.scene.add.rectangle(-22, 8, 28, 10, 0x1a1820, 0.9);
      arm.setStrokeStyle(1, 0x2a2030, 0.4);
      arm.setAngle(-25);
      parts.push(arm);
      // Head/unit (tilted)
      const head = this.scene.add.rectangle(20, -10, 18, 16, 0x12101a, 0.95);
      head.setStrokeStyle(1, 0x3a2030, 0.5);
      head.setAngle(12);
      parts.push(head);
      // Flickering core light (dying)
      const core = this.scene.add.circle(0, -2, 4, 0x6a3040, 0.6);
      core.setBlendMode(Phaser.BlendModes.ADD);
      parts.push(core);
      this.scene.tweens.add({ targets: core, alpha: { from: 0.1, to: 0.6 }, duration: 400 + Math.random() * 200, yoyo: true, repeat: -1 });
      // Oil pool (dark ellipse)
      const oil = this.scene.add.ellipse(0, 16, 60, 12, 0x050408, 0.6);
      parts.push(oil);
      // Prompt
      const label = this.scene.add.text(0, 28, '▼ EXAMINE', { fontFamily: 'monospace', fontSize: '8px', color: '#6a5060', letterSpacing: 1 }).setOrigin(0.5);
      parts.push(label);
      this.scene.tweens.add({ targets: label, alpha: { from: 0.3, to: 0.8 }, duration: 1000, yoyo: true, repeat: -1 });

    } else {
      // ECHO: Suspended speaker array with visible sound waves
      // Speaker body
      const speaker = this.scene.add.rectangle(0, 0, 30, 24, 0x101820, 0.9);
      speaker.setStrokeStyle(2, 0x40c0ff, 0.5);
      parts.push(speaker);
      // Speaker cone
      const cone = this.scene.add.circle(0, 0, 8, 0x0a1018, 0.8);
      cone.setStrokeStyle(1, 0x40c0ff, 0.4);
      parts.push(cone);
      // Sound wave rings (expanding)
      for (let i = 0; i < 3; i++) {
        const wave = this.scene.add.circle(0, 0, 12 + i * 8, 0x40c0ff, 0);
        wave.setStrokeStyle(1, 0x40c0ff, 0.3);
        wave.setBlendMode(Phaser.BlendModes.ADD);
        parts.push(wave);
        this.scene.tweens.add({
          targets: wave, scale: { from: 1, to: 2.5 }, alpha: { from: 0.4, to: 0 },
          duration: 2000, delay: i * 600, repeat: -1, ease: 'Sine.out',
        });
      }
      // Mounting cable (from ceiling)
      const cable = this.scene.add.rectangle(0, -18, 2, 20, 0x2a3040, 0.6);
      parts.push(cable);
      // Blue ambient glow
      const glow = this.scene.add.circle(0, 0, 40, 0x40c0ff, 0.04);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      parts.push(glow);
      // Floating animation
      this.scene.tweens.add({ targets: container, y: lore.y - 5, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      // Prompt
      const label = this.scene.add.text(0, 24, '▼ LISTEN', { fontFamily: 'monospace', fontSize: '8px', color: '#40c0ff', letterSpacing: 1 }).setOrigin(0.5);
      parts.push(label);
      this.scene.tweens.add({ targets: label, alpha: { from: 0.4, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
    }

    container.add(parts);
    container.setDepth(8);
    container.setData('isLoreObject', true);
    container.setData('loreId', lore.id);
    container.setData('loreTitle', lore.titleKey);
    container.setData('loreText', lore.textKey);
    container.setSize(80, 80);
    container.setInteractive({ useHandCursor: true });
    return container;
  }

  /** Create a visual landmark — dramatic large structure */
  private createLandmark(lm: LandmarkData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(lm.x, lm.y);

    if (lm.type === 'crashed_mech') {
      // CRASHED MECH: Full silhouette — body, head, broken leg, dead eye
      // Main body (large, tilted)
      const body = this.scene.add.rectangle(0, 0, lm.w, lm.h * 0.6, lm.color, 0.7);
      body.setStrokeStyle(2, 0x4a4050, 0.3);
      body.setAngle(-5);
      container.add(body);
      // Head (cockpit area)
      const head = this.scene.add.rectangle(-lm.w * 0.3, -lm.h * 0.3, lm.w * 0.35, lm.h * 0.35, lm.color, 0.65);
      head.setStrokeStyle(1, 0x3a3040, 0.3);
      head.setAngle(-5);
      container.add(head);
      // Broken leg (sticking up)
      const leg = this.scene.add.rectangle(lm.w * 0.25, lm.h * 0.15, 12, lm.h * 0.5, lm.color, 0.6);
      leg.setAngle(35);
      container.add(leg);
      // Dead eye (dark red, barely visible)
      const eye = this.scene.add.circle(-lm.w * 0.3, -lm.h * 0.3, 4, 0x3a1010, 0.4);
      eye.setBlendMode(Phaser.BlendModes.ADD);
      container.add(eye);
      this.scene.tweens.add({ targets: eye, alpha: { from: 0.1, to: 0.3 }, duration: 3000, yoyo: true, repeat: -1 });
      // Dust particles around
      for (let i = 0; i < 5; i++) {
        const dust = this.scene.add.circle(
          (Math.random() - 0.5) * lm.w * 1.2,
          (Math.random() - 0.5) * lm.h,
          1 + Math.random(), 0x6a6a7a, 0.1 + Math.random() * 0.1
        );
        dust.setBlendMode(Phaser.BlendModes.ADD);
        container.add(dust);
        this.scene.tweens.add({
          targets: dust, y: dust.y - 20 - Math.random() * 30, alpha: 0,
          duration: 3000 + Math.random() * 2000, repeat: -1, delay: Math.random() * 2000,
        });
      }

    } else if (lm.type === 'assembly_line') {
      // ASSEMBLY LINE: Hall with hanging mechs on conveyor
      // Conveyor base
      const conveyor = this.scene.add.rectangle(0, lm.h / 2 - 10, lm.w, 8, 0x2a2530, 0.5);
      container.add(conveyor);
      // Hanging mech silhouettes (3 of them, half-built)
      for (let i = 0; i < 3; i++) {
        const x = -lm.w * 0.3 + i * lm.w * 0.3;
        // Body
        const mechBody = this.scene.add.rectangle(x, -10, 24, 36, lm.color, 0.5);
        mechBody.setStrokeStyle(1, 0x3a3040, 0.3);
        container.add(mechBody);
        // Head
        const mechHead = this.scene.add.rectangle(x, -32, 14, 12, lm.color, 0.5);
        container.add(mechHead);
        // Missing arm (only one side)
        if (i % 2 === 0) {
          const arm = this.scene.add.rectangle(x + 14, -8, 8, 20, lm.color, 0.4);
          container.add(arm);
        }
        // Hanging cable
        const cable = this.scene.add.rectangle(x, -60, 2, 24, 0x2a2530, 0.4);
        container.add(cable);
        // Faint spark (random)
        if (Math.random() < 0.5) {
          const spark = this.scene.add.circle(x, -20, 2, 0xffc040, 0.3);
          spark.setBlendMode(Phaser.BlendModes.ADD);
          container.add(spark);
          this.scene.tweens.add({ targets: spark, alpha: { from: 0, to: 0.4 }, duration: 200, yoyo: true, repeat: -1, delay: Math.random() * 3000 });
        }
      }

    } else if (lm.type === 'tower') {
      // TOWER: Massive door frame with flickering light
      // Left pillar
      const leftP = this.scene.add.rectangle(-lm.w / 2 + 8, 0, 16, lm.h, lm.color, 0.7);
      leftP.setStrokeStyle(1, 0x4a3040, 0.3);
      container.add(leftP);
      // Right pillar
      const rightP = this.scene.add.rectangle(lm.w / 2 - 8, 0, 16, lm.h, lm.color, 0.7);
      rightP.setStrokeStyle(1, 0x4a3040, 0.3);
      container.add(rightP);
      // Top arch
      const arch = this.scene.add.rectangle(0, -lm.h / 2 + 10, lm.w, 20, lm.color, 0.6);
      container.add(arch);
      // Light at top (flickering amber)
      const light = this.scene.add.circle(0, -lm.h / 2 + 10, 8, 0xffc040, 0.3);
      light.setBlendMode(Phaser.BlendModes.ADD);
      container.add(light);
      this.scene.tweens.add({ targets: light, alpha: { from: 0.1, to: 0.5 }, scale: { from: 0.8, to: 1.3 }, duration: 1500, yoyo: true, repeat: -1 });
      // Light cone (shining down)
      const cone = this.scene.add.triangle(0, 0, -30, -lm.h / 2, 30, -lm.h / 2, 0, 0, 0xffc040, 0.02);
      cone.setBlendMode(Phaser.BlendModes.ADD);
      container.add(cone);
      // Caption text (faded, near bottom)
      const caption = this.scene.add.text(0, lm.h / 2 - 15, 'GUARDIAN POST', {
        fontFamily: 'monospace', fontSize: '9px', color: '#3a3020', letterSpacing: 3,
      }).setOrigin(0.5);
      container.add(caption);
    }

    container.setDepth(3);
    return container;
  }

  /** Destroy all loaded area objects. */
  unload(loaded: LoadedArea): void {
    // Clean up hazard timers (electrical sparks, fire smoke, steam) before destroying visuals
    loaded.visualRects.forEach(v => {
      if (!v) return;
      const obj = v as unknown as { __sparkTimer?: Phaser.Time.TimerEvent; __smokeTimer?: Phaser.Time.TimerEvent; __steamTimer?: Phaser.Time.TimerEvent };
      obj.__sparkTimer?.remove();
      obj.__smokeTimer?.remove();
      obj.__steamTimer?.remove();
      if (v.active) v.destroy();
    });
    loaded.solids.forEach(s => { if (s && s.active) s.destroy(); });
    loaded.sectionTriggers.forEach(t => { if (t && t.active) t.destroy(); });
    loaded.checkpointTriggers.forEach(t => { if (t && t.active) t.destroy(); });
    loaded.hazardTriggers.forEach(t => { if (t && t.active) t.destroy(); });
    loaded.bossEntryTrigger?.destroy();
    loaded.loreObjects.forEach(l => { if (l && l.active) l.destroy(); });
    loaded.landmarks.forEach(l => { if (l && l.active) l.destroy(); });
    loaded.grappleAnchors.forEach(a => { if (a && a.active) a.destroy(); });
    loaded.empDoors.forEach(d => { if (d && d.active) d.destroy(); });
    loaded.solids = [];
    loaded.sectionTriggers = [];
    loaded.checkpointTriggers = [];
    loaded.hazardTriggers = [];
    loaded.bossEntryTrigger = null;
    loaded.visualRects = [];
    loaded.loreObjects = [];
    loaded.landmarks = [];
    loaded.grappleAnchors = [];
    loaded.empDoors = [];
  }
}

export default AreaLoader;
