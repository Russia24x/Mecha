/**
 * MECHA: LAST PROTOCOL — Play Controller
 *
 * Manages the 'play' state lifecycle.
 *   - build(area) — constructs all play entities + systems, returns state
 *   - spawnEnemiesForSection(sectionId) — spawns enemies for a section
 *   - destroy() — destructs everything in safe order
 *
 * Phase 9 Step 3: build() + spawnEnemiesForSection() extracted.
 * update() + handler logic (enterSection, handleEnemyContact, etc.)
 * remain in GameScene for Step 4.
 *
 * CRITICAL: cleanup order matters (see destroy() doc).
 *
 * The vignette leak fix (step 7 in destroy) is a deliberate fix for a real
 * bug — red low-HP vignette was persisting across state transitions.
 */
import Phaser from 'phaser';
import { GAME } from '../shared/Constants';
import { AudioSystem } from '../systems/AudioSystem';
import { CheckpointSystem } from '../world/CheckpointSystem';
import { WorldSystem } from '../world/WorldSystem';
import { resetEnemyIds } from '../entities/enemies/EnemyEntity';
import { AreaLoader, type LoadedArea } from '../world/AreaLoader';
import { ParallaxBackground } from '../world/atmosphere/ParallaxBackground';
import { AtmosphereSystem } from '../world/atmosphere/AtmosphereSystem';
import { ForestEnvironmentSystem } from '../world/atmosphere/ForestEnvironmentSystem';
import { MetroidvaniaController } from '../world/MetroidvaniaController';
import { NpcInteractionController } from '../world/NpcInteractionController';
import { LoreController } from '../ui/lore/LoreController';
import { ControlHintsUI } from '../ui/controls/ControlHintsUI';
import { CompanionEntity } from '../entities/companion/CompanionEntity';
import { RenderSystem } from '../systems/RenderSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { HUDUI } from '../ui/hud/HUDUI';
import { PlayerEntity } from '../entities/player/PlayerEntity';
import { EnemyEntity } from '../entities/enemies/EnemyEntity';
import { BossEntity } from '../entities/boss/BossEntity';
import { Projectile } from '../entities/combat/Projectile';
import { TargetRegistry } from '../entities/combat/TargetRegistry';
import { CollisionController } from './CollisionController';
import type { CameraSystem } from '../systems/CameraSystem';
import type { PhysicsSystem } from '../systems/PhysicsSystem';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { AreaData, EnemyTypeId } from '../data/types';

/**
 * Result of build() — all created play state, to be assigned to GameScene fields.
 */
export interface PlayBuildResult {
  parallax: ParallaxBackground;
  atmosphere: AtmosphereSystem;
  forestEnv: ForestEnvironmentSystem | null;
  areaLoader: AreaLoader;
  loadedArea: LoadedArea;
  metroidvania: MetroidvaniaController;
  render: RenderSystem;
  combat: CombatSystem;
  player: PlayerEntity;
  companion: CompanionEntity;
  hud: HUDUI;
  npcInteraction: NpcInteractionController;
  loreController: LoreController;
  controlHints: ControlHintsUI;
  enemies: EnemyEntity[];
  projectiles: Projectile[];
  currentSection: number;
  stageStartTime: number;
}

/**
 * Callbacks PlayController needs from GameScene (things that belong to GameScene).
 */
export interface PlayCallbacks {
  onToast: (msg: string) => void;
  isMiniBossSpawned: () => boolean;
  setMiniBossSpawned: (v: boolean) => void;
  setExternalRefs: (enemies: EnemyEntity[], anchors: Phaser.Math.Vector2[]) => void;
}

/**
 * All references PlayController needs to destroy the play state.
 * These are the GameScene's play-only fields, passed by reference.
 */
export interface PlayControllerRefs {
  collision: CollisionController | null;
  loreController: LoreController | null;
  bossHealthBar: { hide: () => void } | null;
  npcInteraction: { cleanup: () => void } | null;
  metroidvania: MetroidvaniaController | null;
  targetRegistry: TargetRegistry;
  player: PlayerEntity;
  enemies: EnemyEntity[];
  boss: BossEntity | null;
  projectiles: Projectile[];
  loadedArea: LoadedArea | null;
  areaLoader: AreaLoader | null;
  parallax: ParallaxBackground | null;
  atmosphere: AtmosphereSystem | null;
  forestEnv: ForestEnvironmentSystem | null;
  companion: CompanionEntity | null;
  controlHints: ControlHintsUI | null;
  hud: HUDUI | null;
  render: RenderSystem | null;
  sequenceTimers: Phaser.Time.TimerEvent[];
  scene: Phaser.Scene;
  camera: CameraSystem;
  physicsSys: PhysicsSystem;
}

export class PlayController {
  /**
   * Build the play state — creates all entities, systems, and UI.
   * Returns the created state for GameScene to assign to its fields.
   *
   * Does NOT register collision routes — that stays in GameScene (Step 3
   * decision: handlers are in GameScene, so route registration stays there too).
   */
  static build(
    scene: Phaser.Scene,
    physicsSys: PhysicsSystem,
    particles: ParticleSystem,
    camera: CameraSystem,
    callbacks: PlayCallbacks,
  ): PlayBuildResult | null {
    const area = WorldSystem.getCurrentArea();
    if (!area) return null;

    AudioSystem.resume();
    AudioSystem.startAmbient('factory');
    scene.cameras.main.setBackgroundColor(area.bgColor);
    scene.cameras.main.fadeIn(600, 5, 7, 13);
    physicsSys.setWorldBounds(area.totalWidth, GAME.HEIGHT);
    physicsSys.setGravity(0, 0.9);

    const projectiles: Projectile[] = [];
    const enemies: EnemyEntity[] = [];
    resetEnemyIds();
    const stageStartTime = scene.time.now;

    // ── Parallax + atmosphere + forest environment ──
    const theme = (area.regionId === 'forest') ? 'forest' : 'factory';
    const parallax = new ParallaxBackground(scene, theme as 'factory' | 'forest', area.totalWidth);
    parallax.build();
    const atmosphere = new AtmosphereSystem(scene, theme as 'factory' | 'forest', area.totalWidth);
    atmosphere.build();
    const forestEnv = theme === 'forest' ? new ForestEnvironmentSystem(scene, area.totalWidth) : null;
    forestEnv?.build();

    // ── World ──
    const areaLoader = new AreaLoader(scene, physicsSys);
    const loadedArea = areaLoader.load(area);

    // ── Metroidvania controller ──
    const metroidvania = new MetroidvaniaController(scene, particles);
    metroidvania.hidePreCollectedItems(loadedArea);
    metroidvania.preOpenShortcuts(loadedArea);

    // ── Render + combat systems ──
    const render = new RenderSystem(scene);
    const combat = new CombatSystem(scene);

    // ── Player ──
    const cp = CheckpointSystem.getRespawnPosition(area.id);
    const player = new PlayerEntity(scene, physicsSys, particles, combat, cp.x, cp.y, projectiles);

    // ── Camera follow ──
    camera.follow(player.sprite, 0.1);
    camera.setDeadzone(160, 100);
    camera.setBounds(0, 0, area.totalWidth, GAME.HEIGHT);

    // ── HUD ──
    const hud = new HUDUI(scene, player);

    // ── NPC interaction ──
    const npcInteraction = new NpcInteractionController(scene);
    npcInteraction.spawnNPCs(area.id);

    // ── Lore controller ──
    const loreController = new LoreController(scene);

    // ── Control hints (only visible on section 1) ──
    const controlHints = new ControlHintsUI(scene);
    if (cp.section !== 1) {
      controlHints.setVisible(false);
    }

    // ── Companion ──
    const companion = new CompanionEntity(scene, cp.x + 30, cp.y - 40);

    // ── Target registry: register player ──
    // (enemies registered via spawnEnemiesForSection below)
    const targetRegistry = new TargetRegistry();
    targetRegistry.registerPlayer(player);

    // ── Spawn enemies for initial section ──
    PlayController.spawnEnemiesForSection(
      scene, physicsSys, particles, projectiles, enemies, targetRegistry,
      cp.section, callbacks,
    );

    // ── Set player external refs (enemies + grapple anchors) ──
    const anchorPositions: Phaser.Math.Vector2[] = [];
    for (const anchor of loadedArea.grappleAnchors) {
      if (anchor && anchor.active) {
        anchorPositions.push(new Phaser.Math.Vector2(anchor.x, anchor.y));
      }
    }
    player.setExternalRefs(enemies, anchorPositions);

    return {
      parallax, atmosphere, forestEnv, areaLoader, loadedArea,
      metroidvania, render, combat, player, companion, hud,
      npcInteraction, loreController, controlHints,
      enemies, projectiles, currentSection: cp.section, stageStartTime,
    };
  }

  /**
   * Spawn enemies for a section. Called from build() (initial) and from
   * GameScene.enterSection() (subsequent sections).
   *
   * Mutates the `enemies` array (pushes new enemies) and registers them
   * in the target registry.
   */
  static spawnEnemiesForSection(
    scene: Phaser.Scene,
    physicsSys: PhysicsSystem,
    particles: ParticleSystem,
    projectiles: Projectile[],
    enemies: EnemyEntity[],
    targetRegistry: TargetRegistry,
    sectionId: number,
    callbacks: PlayCallbacks,
  ): void {
    const area = WorldSystem.getCurrentArea();
    if (!area) return;
    const section = area.sections.find(s => s.id === sectionId);
    if (!section) return;
    const enemyCount = section.enemies.length;
    for (let i = 0; i < enemyCount; i++) {
      const type = section.enemies[i];
      if (type === 'boss' || type.startsWith('boss')) continue;
      const et = type as EnemyTypeId;
      const y = et === 'drone' || et === 'flying_ai' ? GAME.HEIGHT - 100 : GAME.HEIGHT - 200;
      const sectionWidth = area.sectionWidth;
      const startX = section.x + 300;
      const spacing = (sectionWidth - 600) / Math.max(enemyCount, 1);
      const x = startX + i * spacing + (Math.random() - 0.5) * 80;
      const e = new EnemyEntity(scene, physicsSys, particles, x, y, et, projectiles);
      enemies.push(e);
      targetRegistry.registerEnemy(e);
    }
    // Mini Boss: spawn an elite in Section 4
    if (sectionId === 4 && !callbacks.isMiniBossSpawned()) {
      callbacks.setMiniBossSpawned(true);
      const mbX = section.x + area.sectionWidth - 300;
      const mbY = GAME.HEIGHT - 200;
      const miniBoss = new EnemyEntity(scene, physicsSys, particles, mbX, mbY, 'elite', projectiles);
      enemies.push(miniBoss);
      targetRegistry.registerEnemy(miniBoss);
      callbacks.onToast('⚠ ELITE DETECTED');
    }
  }

  constructor(private refs: PlayControllerRefs) {}

  /**
   * Destroy the play state — MUST be called in this exact order.
   * See class doc for rationale.
   */
  destroy(): void {
    const r = this.refs;

    // ── 1. Collision listener FIRST ──
    r.collision?.exit();

    // ── 2. Entity destruction ──
    r.loreController?.destroy();
    r.bossHealthBar?.hide();
    AudioSystem.stopAmbient();
    r.projectiles.forEach(p => p.kill());
    r.player?.destroy();
    r.enemies.forEach(e => e.destroy());
    r.boss?.destroy();
    r.targetRegistry.clear();

    // ── 3. World unload ──
    if (r.loadedArea && r.areaLoader) r.areaLoader.unload(r.loadedArea);

    // ── 4. PLAY-only system destruction ──
    r.parallax?.destroy();
    r.atmosphere?.destroy();
    r.npcInteraction?.cleanup();
    r.controlHints?.destroy();
    r.companion?.destroy();
    r.forestEnv?.destroy();

    // ── 5. Timer cleanup ──
    r.scene.tweens.killAll();
    r.sequenceTimers.forEach(t => t.remove());

    // ── 6. HUD + render destruction ──
    r.hud?.destroy();
    r.render?.destroy();

    // ── 7. Camera filter reset (vignette leak fix) ──
    try {
      const cam = r.scene.cameras.main as unknown as { filters?: { external?: { list?: unknown[]; clear?: () => void } } };
      if (cam.filters?.external?.list) cam.filters.external.list = [];
    } catch { /* camera filters API varies */ }

    // ── 8. Camera + physics reset ──
    r.camera.resetZoom();
    r.camera.stopFollow();
    r.camera.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT);
    r.physicsSys.setWorldBounds(GAME.WIDTH, GAME.HEIGHT);
  }
}

export default PlayController;
