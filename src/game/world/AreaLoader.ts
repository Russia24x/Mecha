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
import { AreaStrategy, type HazardVisualData, type PlatformType } from './strategies/AreaStrategy';
import { FactoryAreaStrategy } from './strategies/FactoryAreaStrategy';
import { ForestAreaStrategy } from './strategies/ForestAreaStrategy';
import { WastesAreaStrategy } from './strategies/WastesAreaStrategy';

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
  shortcuts: Phaser.GameObjects.Container[];
  collectibles: Phaser.GameObjects.Container[];
}

export class AreaLoader {
  private scene: Phaser.Scene;
  private physics: PhysicsSystem;
  private regionId: string = 'factory';
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private strategy: AreaStrategy | null = null;

  constructor(scene: Phaser.Scene, physics: PhysicsSystem) {
    this.scene = scene;
    this.physics = physics;
  }

  /** Create a tween and track it for cleanup on unload. */
  private trackedTween(config: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const t = this.scene.tweens.add(config);
    this.activeTweens.push(t);
    return t;
  }

  /** Create the appropriate strategy for a region. */
  private createStrategy(regionId: string): AreaStrategy {
    const tweenFn = (config: Phaser.Types.Tweens.TweenBuilderConfig) => this.trackedTween(config);
    if (regionId === 'forest') return new ForestAreaStrategy(this.scene, tweenFn);
    if (regionId === 'wastes') return new WastesAreaStrategy(this.scene, tweenFn);
    // Default: factory
    return new FactoryAreaStrategy(this.scene, tweenFn);
  }

  /**
   * Build the full area: floor, ceiling, per-section platforms, hazards,
   * section triggers, checkpoint triggers, boss entry trigger.
   * RegionId controls ALL visual styling — factory vs forest are completely separate.
   */
  load(area: AreaData): LoadedArea {
    this.regionId = area.regionId;  // ── Store region for all visual decisions
    this.strategy = this.createStrategy(area.regionId);
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
      shortcuts: [],
      collectibles: [],
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
        // ── Graphical hazard visuals per type ──
        const hazardVis = this.createHazardVisual(hazard);
        result.visualRects.push(hazardVis as unknown as Phaser.GameObjects.Rectangle);
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
    // Shortcuts — one-way doors (Dark Souls style backtracking)
    if (section.shortcuts) {
      for (const sc of section.shortcuts) {
        const container = this.createShortcut(sc);
        result.shortcuts.push(container);
      }
    }
    // Collectibles — pickups (health/energy fragments, skill points)
    if (section.collectibles) {
      for (const col of section.collectibles) {
        const container = this.createCollectible(col);
        result.collectibles.push(container);
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
    this.trackedTween({
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
    this.trackedTween({ targets: container, rotation: Math.PI * 2, duration: 4000, repeat: -1, ease: 'Linear' });
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
      this.trackedTween({
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
    // ── FIX Bug 1: Add physics body so the door actually blocks the player ──
    const physicsBody = this.physics.addStaticRect(door.x, door.y, door.w, door.h);
    physicsBody.setData('isEmpDoorBody', true);
    physicsBody.setData('empDoorId', door.id);
    container.setData('physicsBody', physicsBody);
    return container;
  }

  /** Create a shortcut door — one-way, opens from one side and stays open. */
  private createShortcut(sc: { id: string; x: number; y: number; w: number; h: number; toSection: number; opensFrom: string }): Phaser.GameObjects.Container {
    const container = this.scene.add.container(sc.x, sc.y);
    // Door frame (amber, industrial)
    const frame = this.scene.add.rectangle(0, 0, sc.w + 8, sc.h + 8, 0x1a1814, 0.9);
    frame.setStrokeStyle(2, 0xffc040, 0.6);
    container.add(frame);
    // Door body (closed = solid, open = transparent)
    const body = this.scene.add.rectangle(0, 0, sc.w, sc.h, 0x2a2018, 0.85);
    body.setStrokeStyle(1, 0xffc040, 0.4);
    container.add(body);
    // "Opens from" indicator — small arrow on the correct side
    const arrowColor = 0xffc040;
    let arrowX = 0, arrowY = 0, arrowRot = 0;
    switch (sc.opensFrom) {
      case 'left':  arrowX = -sc.w / 2 - 8; arrowRot = Math.PI; break;
      case 'right': arrowX = sc.w / 2 + 8;  arrowRot = 0; break;
      case 'top':   arrowY = -sc.h / 2 - 8; arrowRot = Math.PI / 2; break;
      case 'bottom': arrowY = sc.h / 2 + 8; arrowRot = -Math.PI / 2; break;
    }
    const arrow = this.scene.add.triangle(arrowX, arrowY, -4, -4, 4, -4, 0, 4, arrowColor, 0.8);
    arrow.setRotation(arrowRot);
    container.add(arrow);
    // Label
    const label = this.scene.add.text(0, 0, '⇌', { fontSize: '12px', color: '#ffc040' }).setOrigin(0.5);
    container.add(label);

    container.setDepth(6);
    container.setData('shortcutId', sc.id);
    container.setData('isShortcut', true);
    container.setData('shortcutOpen', false);
    container.setData('opensFrom', sc.opensFrom);
    container.setData('toSection', sc.toSection);
    container.setSize(sc.w, sc.h);
    // ── FIX Bug 1: Add physics body so the shortcut door actually blocks the player ──
    const physicsBody = this.physics.addStaticRect(sc.x, sc.y, sc.w, sc.h);
    physicsBody.setData('isShortcutBody', true);
    physicsBody.setData('shortcutId', sc.id);
    container.setData('physicsBody', physicsBody);
    return container;
  }

  /** Create a collectible pickup — glowing orb that grants a reward. */
  private createCollectible(col: { id: string; type: string; x: number; y: number; requiredAbility?: string }): Phaser.GameObjects.Container {
    const container = this.scene.add.container(col.x, col.y);
    // Color per type
    const colors: Record<string, number> = {
      health_fragment: 0x40d070,
      energy_fragment: 0x4090ff,
      skill_point: 0xffc040,
      weapon_part: 0xff80ff,
    };
    const color = colors[col.type] ?? 0xffffff;

    // Outer glow (pulsing)
    const glow = this.scene.add.circle(0, 0, 16, color, 0.15);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    container.add(glow);
    this.trackedTween({
      targets: glow, alpha: { from: 0.08, to: 0.25 }, scale: { from: 0.9, to: 1.3 },
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });

    // Core orb
    const orb = this.scene.add.circle(0, 0, 5, color, 0.9);
    orb.setBlendMode(Phaser.BlendModes.ADD);
    container.add(orb);

    // Type-specific icon (small shape inside)
    let icon: Phaser.GameObjects.Shape;
    if (col.type === 'health_fragment') {
      // Plus sign
      icon = this.scene.add.rectangle(0, 0, 6, 2, 0xffffff, 0.9);
      container.add(icon);
      const icon2 = this.scene.add.rectangle(0, 0, 2, 6, 0xffffff, 0.9);
      container.add(icon2);
    } else if (col.type === 'energy_fragment') {
      // Diamond
      icon = this.scene.add.polygon(0, 0, [0, -4, 4, 0, 0, 4, -4, 0], 0xffffff, 0.9);
      container.add(icon);
    } else if (col.type === 'skill_point') {
      // Star (approximated with triangle)
      icon = this.scene.add.triangle(0, 0, -4, 3, 4, 3, 0, -4, 0xffffff, 0.9);
      container.add(icon);
    } else {
      // weapon_part — small square
      icon = this.scene.add.rectangle(0, 0, 4, 4, 0xffffff, 0.9);
      container.add(icon);
    }

    // Float animation
    this.trackedTween({
      targets: container, y: col.y - 6, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
    // Slow rotation on the glow
    this.trackedTween({
      targets: glow, rotation: Math.PI * 2, duration: 3000, repeat: -1, ease: 'Linear',
    });

    container.setDepth(8);
    container.setData('collectibleId', col.id);
    container.setData('isCollectible', true);
    container.setData('collectibleType', col.type);
    container.setData('collected', false);
    container.setData('requiredAbility', col.requiredAbility || null);  // ── FIX Bug 5 ──
    container.setSize(20, 20);
    container.setInteractive({ useHandCursor: false });
    return container;
  }

  private addSolid(result: LoadedArea, x: number, y: number, w: number, h: number): void {
    const s = this.physics.addStaticRect(x, y, w, h);
    const g = this.scene.add.graphics();
    g.setDepth(5);

    // ── Determine platform type ──
    const isWall = h > 80 && w < 100;
    const isFloor = h <= 30 && w >= 100;
    const isLedge = h <= 30 && w < 100;
    const isPillar = h > 80 && w >= 100;

    let platformType: PlatformType = 'generic';
    if (isWall) platformType = 'wall';
    else if (isFloor) platformType = 'floor';
    else if (isLedge) platformType = 'ledge';
    else if (isPillar) platformType = 'pillar';

    // ── Delegate platform drawing to strategy ──
    this.strategy?.drawPlatform(g, w, h, platformType);

    g.setPosition(x, y);
    result.solids.push(s);
    result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);

    // ── Delegate decorations to strategy ──
    this.strategy?.addDecorations(result, x, y, w, h, platformType);
  }  /**
   * Create a graphical hazard visual based on hazard type.
   * - spike: jagged metal spikes pointing up
   * - lava/molten: glowing orange-red molten metal with bubbles + glow
   * - laser: horizontal energy beam with flicker
   */
  private createHazardVisual(hazard: { type: string; x: number; y: number; w: number; h: number; damage: number }): Phaser.GameObjects.Container {
    // Delegate to region-specific strategy
    return this.strategy?.createHazardVisual(hazard as HazardVisualData) 
      ?? this.scene.add.container(hazard.x, hazard.y);
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
      this.trackedTween({ targets: screen, alpha: { from: 0.08, to: 0.25 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      // Scan lines on screen
      for (let i = 0; i < 4; i++) {
        const line = this.scene.add.rectangle(0, -18 + i * 6, 24, 1, 0xffc040, 0.2);
        parts.push(line);
      }
      // Ambient glow halo
      const glow = this.scene.add.circle(0, -5, 50, 0xffc040, 0.04);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      parts.push(glow);
      this.trackedTween({ targets: glow, scale: { from: 0.9, to: 1.2 }, alpha: { from: 0.03, to: 0.08 }, duration: 2000, yoyo: true, repeat: -1 });
      // Prompt
      const label = this.scene.add.text(0, 32, '▼ EXAMINE', { fontFamily: 'monospace', fontSize: '8px', color: '#ffc040', letterSpacing: 1 }).setOrigin(0.5);
      parts.push(label);
      this.trackedTween({ targets: label, alpha: { from: 0.4, to: 1 }, duration: 800, yoyo: true, repeat: -1 });

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
      this.trackedTween({ targets: core, alpha: { from: 0.1, to: 0.6 }, duration: 400 + Math.random() * 200, yoyo: true, repeat: -1 });
      // Oil pool (dark ellipse)
      const oil = this.scene.add.ellipse(0, 16, 60, 12, 0x050408, 0.6);
      parts.push(oil);
      // Prompt
      const label = this.scene.add.text(0, 28, '▼ EXAMINE', { fontFamily: 'monospace', fontSize: '8px', color: '#6a5060', letterSpacing: 1 }).setOrigin(0.5);
      parts.push(label);
      this.trackedTween({ targets: label, alpha: { from: 0.3, to: 0.8 }, duration: 1000, yoyo: true, repeat: -1 });

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
        this.trackedTween({
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
      this.trackedTween({ targets: container, y: lore.y - 5, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      // Prompt
      const label = this.scene.add.text(0, 24, '▼ LISTEN', { fontFamily: 'monospace', fontSize: '8px', color: '#40c0ff', letterSpacing: 1 }).setOrigin(0.5);
      parts.push(label);
      this.trackedTween({ targets: label, alpha: { from: 0.4, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
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
      this.trackedTween({ targets: eye, alpha: { from: 0.1, to: 0.3 }, duration: 3000, yoyo: true, repeat: -1 });
      // Dust particles around
      for (let i = 0; i < 5; i++) {
        const dust = this.scene.add.circle(
          (Math.random() - 0.5) * lm.w * 1.2,
          (Math.random() - 0.5) * lm.h,
          1 + Math.random(), 0x6a6a7a, 0.1 + Math.random() * 0.1
        );
        dust.setBlendMode(Phaser.BlendModes.ADD);
        container.add(dust);
        this.trackedTween({
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
          this.trackedTween({ targets: spark, alpha: { from: 0, to: 0.4 }, duration: 200, yoyo: true, repeat: -1, delay: Math.random() * 3000 });
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
      this.trackedTween({ targets: light, alpha: { from: 0.1, to: 0.5 }, scale: { from: 0.8, to: 1.3 }, duration: 1500, yoyo: true, repeat: -1 });
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
    // ── Stop all tracked tweens (sparks, fire, steam, lore pulses, etc.) ──
    this.activeTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
    this.activeTweens = [];
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
    // ── FIX Bug 1: Clean up physics bodies from EMP doors + shortcuts (not auto-destroyed) ──
    loaded.empDoors.forEach(d => {
      if (!d) return;
      const pb = d.getData('physicsBody') as Phaser.Physics.Matter.Image | null;
      if (pb && pb.active) {
        try { this.scene.matter.world.remove(pb.body as MatterJS.Body); } catch { /* */ }
        pb.destroy();
      }
      if (d.active) d.destroy();
    });
    loaded.shortcuts.forEach(s => {
      if (!s) return;
      const pb = s.getData('physicsBody') as Phaser.Physics.Matter.Image | null;
      if (pb && pb.active) {
        try { this.scene.matter.world.remove(pb.body as MatterJS.Body); } catch { /* */ }
        pb.destroy();
      }
      if (s.active) s.destroy();
    });
    loaded.collectibles.forEach(c => { if (c && c.active) c.destroy(); });
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
    loaded.shortcuts = [];
    loaded.collectibles = [];
  }
}

export default AreaLoader;
