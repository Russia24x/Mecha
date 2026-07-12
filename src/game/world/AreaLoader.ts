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

  /** Create an interactable lore object (terminal, corpse, or echo). */
  private createLoreObject(lore: LoreObjectData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(lore.x, lore.y);
    let bg: Phaser.GameObjects.Shape;
    let icon: Phaser.GameObjects.Text;
    let label: Phaser.GameObjects.Text;

    if (lore.type === 'terminal') {
      // Terminal: amber rectangle with screen
      bg = this.scene.add.rectangle(0, 0, 40, 50, 0x1a1820, 0.9);
      bg.setStrokeStyle(2, 0xffc040, 0.7);
      icon = this.scene.add.text(0, -8, '▣', { fontFamily: 'monospace', fontSize: '16px', color: '#ffc040' }).setOrigin(0.5);
      label = this.scene.add.text(0, 14, 'E', { fontFamily: 'monospace', fontSize: '8px', color: '#ffc040' }).setOrigin(0.5);
      // Pulsing glow
      this.scene.tweens.add({ targets: bg, alpha: { from: 0.7, to: 1 }, duration: 1200, yoyo: true, repeat: -1 });
    } else if (lore.type === 'corpse') {
      // Corpse: dark slumped shape with flickering panel
      bg = this.scene.add.rectangle(0, 0, 50, 30, 0x1a1018, 0.9);
      bg.setStrokeStyle(1, 0x6a3040, 0.5);
      icon = this.scene.add.text(0, -2, '✕', { fontFamily: 'monospace', fontSize: '14px', color: '#6a3040' }).setOrigin(0.5);
      label = this.scene.add.text(0, 14, 'E', { fontFamily: 'monospace', fontSize: '8px', color: '#6a3040' }).setOrigin(0.5);
      // Flickering panel light
      this.scene.tweens.add({ targets: icon, alpha: { from: 0.3, to: 0.8 }, duration: 300, yoyo: true, repeat: -1 });
    } else {
      // Echo: floating speaker with waves
      bg = this.scene.add.circle(0, 0, 18, 0x101820, 0.8);
      bg.setStrokeStyle(2, 0x40c0ff, 0.6);
      icon = this.scene.add.text(0, 0, '))', { fontFamily: 'monospace', fontSize: '14px', color: '#40c0ff' }).setOrigin(0.5);
      label = this.scene.add.text(0, 24, 'E', { fontFamily: 'monospace', fontSize: '8px', color: '#40c0ff' }).setOrigin(0.5);
      // Floating animation
      this.scene.tweens.add({ targets: container, y: lore.y - 4, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    container.add([bg, icon, label]);
    container.setDepth(8);
    container.setData('isLoreObject', true);
    container.setData('loreId', lore.id);
    container.setData('loreTitle', lore.titleKey);
    container.setData('loreText', lore.textKey);
    container.setSize(60, 60);
    container.setInteractive({ useHandCursor: true });
    return container;
  }

  /** Create a visual landmark (large structure, non-interactive). */
  private createLandmark(lm: LandmarkData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(lm.x, lm.y);
    const bg = this.scene.add.rectangle(0, 0, lm.w, lm.h, lm.color, 0.6);
    bg.setStrokeStyle(2, 0x3a4050, 0.4);
    container.add(bg);
    container.setDepth(3);

    if (lm.type === 'crashed_mech') {
      // Crashed mech: silhouette with "dead" eye
      const eye = this.scene.add.circle(-lm.w * 0.2, -lm.h * 0.2, 3, 0x3a1010, 0.5);
      container.add(eye);
    } else if (lm.type === 'assembly_line') {
      // Assembly line: horizontal bars suggesting conveyor
      for (let i = 0; i < 3; i++) {
        const bar = this.scene.add.rectangle(0, -20 + i * 15, lm.w * 0.8, 4, 0x3a3040, 0.4);
        container.add(bar);
      }
    } else if (lm.type === 'tower') {
      // Tower: vertical structure with light at top
      const light = this.scene.add.circle(0, -lm.h / 2 + 10, 4, 0xffc040, 0.3);
      container.add(light);
      this.scene.tweens.add({ targets: light, alpha: { from: 0.1, to: 0.4 }, duration: 2000, yoyo: true, repeat: -1 });
    }
    return container;
  }

  /** Destroy all loaded area objects. */
  unload(loaded: LoadedArea): void {
    loaded.solids.forEach(s => { if (s && s.active) s.destroy(); });
    loaded.sectionTriggers.forEach(t => { if (t && t.active) t.destroy(); });
    loaded.checkpointTriggers.forEach(t => { if (t && t.active) t.destroy(); });
    loaded.hazardTriggers.forEach(t => { if (t && t.active) t.destroy(); });
    loaded.bossEntryTrigger?.destroy();
    loaded.visualRects.forEach(v => { if (v && v.active) v.destroy(); });
    loaded.loreObjects.forEach(l => { if (l && l.active) l.destroy(); });
    loaded.landmarks.forEach(l => { if (l && l.active) l.destroy(); });
    loaded.solids = [];
    loaded.sectionTriggers = [];
    loaded.checkpointTriggers = [];
    loaded.hazardTriggers = [];
    loaded.bossEntryTrigger = null;
    loaded.visualRects = [];
    loaded.loreObjects = [];
    loaded.landmarks = [];
  }
}

export default AreaLoader;
