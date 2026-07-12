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
