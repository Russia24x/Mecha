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
import type { AreaData, SectionData, PlatformData, HazardData } from '../data/types';

export interface LoadedArea {
  solids: Phaser.Physics.Matter.Image[];
  sectionTriggers: Phaser.Physics.Matter.Image[];
  checkpointTriggers: Phaser.Physics.Matter.Image[];
  bossEntryTrigger: Phaser.Physics.Matter.Image | null;
  hazardTriggers: Phaser.Physics.Matter.Image[];
  visualRects: Phaser.GameObjects.Rectangle[];
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
    if (!section.platforms) return;
    for (const plat of section.platforms) {
      this.addSolid(result, plat.x, plat.y, plat.w, plat.h);
    }
    // Hazards (spikes, lava, etc.) — future expansion
    if (section.hazards) {
      for (const hazard of section.hazards) {
        const trigger = this.physics.addSensor(hazard.x, hazard.y, hazard.w, hazard.h, `hazard-${hazard.type}`);
        trigger.setData('isHazard', true);
        trigger.setData('hazardDamage', hazard.damage);
        result.hazardTriggers.push(trigger);
      }
    }
  }

  private addSolid(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const s = this.physics.addStaticRect(x, y, w, h);
    // Visual: metal plating with top highlight + bottom shadow + rivets
    const g = this.scene.add.graphics();
    g.setDepth(5);
    // Main body
    g.fillStyle(COLORS.METAL_DARK, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    // Top highlight (lighter strip)
    g.fillStyle(0x3a4050, 0.8);
    g.fillRect(-w / 2, -h / 2, w, 3);
    // Bottom shadow
    g.fillStyle(0x1a1e28, 0.8);
    g.fillRect(-w / 2, h / 2 - 3, w, 3);
    // Outer border
    g.lineStyle(1, 0x2a3040, 0.6);
    g.strokeRect(-w / 2, -h / 2, w, h);
    // Rivets at corners (if platform is large enough)
    if (w >= 60 && h >= 20) {
      g.fillStyle(0x5a6070, 0.6);
      const rivetOffset = 8;
      const positions = [
        { x: -w / 2 + rivetOffset, y: -h / 2 + rivetOffset },
        { x: w / 2 - rivetOffset, y: -h / 2 + rivetOffset },
        { x: -w / 2 + rivetOffset, y: h / 2 - rivetOffset },
        { x: w / 2 - rivetOffset, y: h / 2 - rivetOffset },
      ];
      for (const pos of positions) {
        g.fillCircle(pos.x, pos.y, 2);
        g.fillStyle(0x2a3040, 0.8);
        g.fillCircle(pos.x, pos.y, 1);
        g.fillStyle(0x5a6070, 0.6);
      }
    }
    // Warning stripes on tall walls (h > 100)
    if (h > 100) {
      g.fillStyle(0xffcc00, 0.3);
      for (let sy = -h / 2 + 20; sy < h / 2 - 20; sy += 16) {
        g.fillRect(-w / 2 + 2, sy, 4, 8);
        g.fillRect(w / 2 - 6, sy, 4, 8);
      }
    }
    g.setPosition(x, y);
    result.solids.push(s);
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);
  }

  /** Destroy all loaded area objects. */
  unload(loaded: LoadedArea): void {
    loaded.solids.forEach(s => { if (s && s.active) s.destroy(); });
    loaded.sectionTriggers.forEach(t => { if (t && t.active) t.destroy(); });
    loaded.checkpointTriggers.forEach(t => { if (t && t.active) t.destroy(); });
    loaded.hazardTriggers.forEach(t => { if (t && t.active) t.destroy(); });
    loaded.bossEntryTrigger?.destroy();
    loaded.visualRects.forEach(v => { if (v && v.active) v.destroy(); });
    loaded.solids = [];
    loaded.sectionTriggers = [];
    loaded.checkpointTriggers = [];
    loaded.hazardTriggers = [];
    loaded.bossEntryTrigger = null;
    loaded.visualRects = [];
  }
}

export default AreaLoader;
