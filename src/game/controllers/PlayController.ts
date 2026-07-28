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
import { ParallaxBackground, type RegionTheme } from '../world/atmosphere/ParallaxBackground';
import { AtmosphereSystem } from '../world/atmosphere/AtmosphereSystem';
import { ForestEnvironmentSystem } from '../world/atmosphere/ForestEnvironmentSystem';
import { MetroidvaniaController } from '../world/MetroidvaniaController';
import { NpcInteractionController } from '../world/NpcInteractionController';
import { BonfireController } from './BonfireController';
import { LoreController } from '../ui/lore/LoreController';
import { ControlHintsUI } from '../ui/controls/ControlHintsUI';
import { BossHealthBarUI } from '../ui/boss/BossHealthBarUI';
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
import { VisualCuller } from '../systems/VisualCuller';
import { DestructibleBarrel } from '../entities/DestructibleBarrel';
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
  bonfireController: BonfireController;
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
 * References needed for per-frame update loop.
 * Passed to static update() — all live fields from GameScene.
 */
export interface PlayUpdateRefs {
  scene: Phaser.Scene;
  player: PlayerEntity;
  render: RenderSystem | null;
  hud: HUDUI | null;
  controlHints: ControlHintsUI | null;
  atmosphere: AtmosphereSystem | null;
  npcInteraction: NpcInteractionController | null;
  metroidvania: MetroidvaniaController | null;
  loadedArea: LoadedArea | null;
  companion: CompanionEntity | null;
  forestEnv: ForestEnvironmentSystem | null;
  particles: ParticleSystem;
  projectiles: Projectile[];
  enemies: EnemyEntity[];
  targetRegistry: TargetRegistry;
  boss: BossEntity | null;
  bossHealthBar: BossHealthBarUI | null;
  bossArenaActive: boolean;
  currentSection: number;
  camera: CameraSystem;
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
  bonfireController: { cleanup: () => void } | null;
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
    targetRegistry: TargetRegistry,
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
    const theme = (area.regionId === 'forest') ? 'forest'
      : (area.regionId === 'wastes') ? 'wastes'
      : (area.regionId === 'city') ? 'city'
      : 'factory';
    const parallax = new ParallaxBackground(scene, theme as RegionTheme, area.totalWidth);
    // Set bgStartIndex per area — each area uses its own background image.
    // Per user request (round-19):
    //   Factory: factory_1→bg1, factory_2→bg2, factory_3(boss)→bg3
    //   Wastes: wastes_1→bg1, wastes_2→bg2, wastes_3(boss)→bg3
    //   City: ward_1→bg1, ward_2→bg2, courthouse→bg3+bg4(boss)
    if (theme === 'factory') {
      if (area.id === 'factory_1') parallax.bgStartIndex = 0;
      else if (area.id === 'factory_2') parallax.bgStartIndex = 1;
      else if (area.id === 'factory_3') parallax.bgStartIndex = 2;
      else parallax.bgStartIndex = 0;
    } else if (theme === 'wastes') {
      if (area.id === 'wastes_1') parallax.bgStartIndex = 0;
      else if (area.id === 'wastes_2') parallax.bgStartIndex = 1;
      else if (area.id === 'wastes_3') parallax.bgStartIndex = 2;
      else parallax.bgStartIndex = 0;
    } else if (theme === 'city') {
      if (area.id === 'act3_ward_1') parallax.bgStartIndex = 0;
      else if (area.id === 'act3_ward_2') parallax.bgStartIndex = 1;
      else if (area.id === 'act3_courthouse') parallax.bgStartIndex = 2;
      else parallax.bgStartIndex = 0;
    }
    parallax.build();
    const atmosphere = new AtmosphereSystem(scene, theme as RegionTheme, area.totalWidth);
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

    // ── Auto-checkpoint: when entering a new area, save a checkpoint at
    // the section 1 start position so the player always has a fallback.
    // This fires only once per area entry (not on every buildPlay call).
    // MUST be called AFTER player creation — CheckpointSystem.activate()
    // emits CHECKPOINT event → GameScene.onCheckpointSaved → calls
    // player.refillRepair() which needs this.sprite to exist.
    if (!CheckpointSystem.hasCheckpoint() || CheckpointSystem.getCheckpoint()?.areaId !== area.id) {
      const area1 = area.sections[0];
      const cpX = area1 ? area1.x + 200 : 200;
      const cpY = 420;
      // Delay by 1 frame to ensure player + sprite are fully initialized
      scene.time.delayedCall(100, () => {
        CheckpointSystem.activate(1, cpX, cpY);
      });
    }

    // ── Camera follow ──
    camera.follow(player.sprite, 0.1);
    camera.setDeadzone(160, 100);
    camera.setBounds(0, 0, area.totalWidth, GAME.HEIGHT);

    // ── HUD ──
    const hud = new HUDUI(scene, player);

    // ── NPC interaction ──
    const npcInteraction = new NpcInteractionController(scene);
    npcInteraction.spawnNPCs(area.id);

    // ── Bonfire controller (Dark Souls-style save points) ──
    // Per advisor: NPC-pattern (distance+prompt+interact), no Matter sensor.
    // spawnBonfires creates GameObjects (amber terminal + glow) and pushes
    // them into loadedArea.bonfires; syncLitState applies SaveSystem.isBonfireLit
    // to freshly spawned visuals (mirrors MetroidvaniaController.hidePreCollectedItems).
    // preLit policy: only bf_factory1_1 is statically preLit; all other area-entry
    // bonfires are lit dynamically via gate crossing (Phase C3).
    const bonfireController = new BonfireController(scene);
    bonfireController.spawnBonfires(area.id, loadedArea);
    bonfireController.syncLitState(loadedArea);

    // ── Lore controller ──
    const loreController = new LoreController(scene);

    // ── Control hints (only visible on section 1) ──
    const controlHints = new ControlHintsUI(scene);
    if (cp.section !== 1) {
      controlHints.setVisible(false);
    }

    // ── Companion ──
    const companion = new CompanionEntity(scene, cp.x + 30, cp.y - 40);

    // ── Target registry: use the EXISTING GameScene.targetRegistry ──
    // Projectile reads targetRegistry from scene via (scene as HasTargetRegistry).targetRegistry
    // So we MUST use the same instance — not create a new one.
    // Clear it first (in case of retry/respawn), then register player.
    targetRegistry.clear();
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
      npcInteraction, loreController, controlHints, bonfireController,
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

  /**
   * Per-frame update for the play state. Phase 9 Step 4a: only the update
   * loop body is extracted — handler methods (enterSection, handleEnemyContact,
   * etc.) remain in GameScene for Step 4b.
   *
   * This is a pure delegation method — calls .update() on existing systems.
   * No new logic, just moved the call site from GameScene.updatePlay() to here.
   */
  static update(deltaMs: number, r: PlayUpdateRefs): void {
    if (!r.player) return;

    // ── Core entity updates ──
    r.player.update(deltaMs);
    r.render?.update(r.scene.time.now);
    r.hud?.update();
    r.controlHints?.update();

    // ── Atmosphere (fog, particles, god rays) ──
    r.atmosphere?.update(deltaMs);

    // ── NPC interaction prompt + label follow ──
    r.npcInteraction?.updatePrompt(r.player, r.loadedArea);
    r.npcInteraction?.updateLabels();

    // ── Metroidvania: collectible pickups + shortcut activations ──
    if (r.metroidvania && r.loadedArea) {
      r.metroidvania.checkCollectiblePickups(r.loadedArea, r.player, r.hud);
      r.metroidvania.checkShortcutActivations(r.loadedArea, r.player, r.hud);
    }

    // ── Companion update — follows player ──
    r.companion?.update(deltaMs, r.player.position);

    // ── Forest environment update (grass, trees, vines, water, rain) ──
    r.forestEnv?.update(deltaMs, r.player.sprite.x, r.player.sprite.y);

    // ── Ambient dust motes ──
    // Per Stage 1.3: replaced `time.now % 200 < 16` (broken on slow machines)
    // with proper accumulator. Fires every ~200ms regardless of delta.
    PlayController.dustAccumulator += deltaMs;
    if (PlayController.dustAccumulator >= PlayController.AMBIENT_DUST_INTERVAL_MS) {
      PlayController.dustAccumulator = 0;
      r.particles.ambientDust(r.player.sprite.x, r.player.sprite.y - 40, 2);
    }

    // ── Projectiles ──
    for (let i = r.projectiles.length - 1; i >= 0; i--) {
      r.projectiles[i].update();
      if (!r.projectiles[i].isAlive) r.projectiles.splice(i, 1);
    }

    // ── Barrel vs projectile collision (per-frame distance check) ──
    // Per task spec: barrels have NO Matter physics body. Projectile collision
    // is a simple per-frame distance check, like MetroidvaniaController.
    // checkCollectiblePickups. Both player and enemy projectiles can trigger
    // barrels (enemy crossfire igniting barrels is a fun emergent behavior).
    //
    // Detection radius: 20px (matches DestructibleBarrel.hitRadius constant).
    // On hit: barrel.hit() decrements health by 1 + triggers a brief hit-flash.
    // If hit() returns true (health now 0), barrel.explode() fires the
    // explosion: sound, particles, camera shake, AOE damage, scorch mark.
    //
    // The projectile is consumed (proj.kill()) on hit — matches behavior of
    // projectile-enemy and projectile-solid collisions.
    if (r.loadedArea && r.loadedArea.barrels.length > 0) {
      PlayController.checkBarrelProjectileCollisions(r);
    }

    // ── Enemies (Stage 2.0: with sleep-culling) ──
    // Per Stage 2.0 design (STAGE_2_0_DESIGN.md):
    //   - Enemies off-screen get Body.set(body, 'isSleeping', true) → skips physics
    //   - Their e.update() is skipped entirely (AI, visual, posture decay all frozen)
    //   - When they come back on-screen, they wake and resume from frozen state
    //   - stateTime is delta-accumulation (not timestamp) → telegraph cannot skip
    //   - Projectile hits still work (tryHitEntity uses position, not Matter collision)
    //   - Player-enemy contact still works (player is awake → Detector.js:96 checks)
    //   - Margin: 300px (same as VisualCuller) — prevents visible-but-sleeping
    const playerPos = r.player.position;
    const cam2 = r.scene.cameras.main;
    const enemyMargin = 300;
    const enemyViewLeft = cam2.scrollX - enemyMargin;
    const enemyViewRight = cam2.scrollX + cam2.width + enemyMargin;
    const Body = r.scene.matter.body;  // cached once per frame
    let sleepCount = 0;
    let awakeCount = 0;

    for (let i = r.enemies.length - 1; i >= 0; i--) {
      const e = r.enemies[i];
      if (!e.isAlive || !e.sprite || !e.sprite.active) {
        r.targetRegistry.unregisterEnemy(e);
        r.enemies.splice(i, 1);
        continue;
      }

      // ── Sleep/wake check (Stage 2.0) ──
      const ex = e.sprite.x;
      const offscreen = ex < enemyViewLeft || ex > enemyViewRight;
      const matterBody = e.sprite.body as MatterJS.BodyType;

      if (offscreen) {
        // Sleep: skip physics + AI + visual update entirely
        if (matterBody && Body && !matterBody.isSleeping) {
          Body.set(matterBody, 'isSleeping', true);
        }
        sleepCount++;
        continue;  // skip e.update()
      } else {
        // Wake: resume physics + AI + visual
        if (matterBody && Body && matterBody.isSleeping) {
          Body.set(matterBody, 'isSleeping', false);
        }
        awakeCount++;
      }

      try { e.update(deltaMs, playerPos); } catch {
        r.targetRegistry.unregisterEnemy(e);
        r.enemies.splice(i, 1);
        continue;
      }
    }

    // ── Expose enemy stats for PerformanceOverlay (Stage 2.0) ──
    (r.scene as unknown as { __enemyStats: { sleeping: number; awake: number } }).__enemyStats = {
      sleeping: sleepCount,
      awake: awakeCount,
    };

    // ── Boss ──
    if (r.boss && r.boss.isAlive && r.boss.sprite && r.boss.sprite.active) {
      try { r.boss.update(deltaMs); } catch { /* */ }
      r.bossHealthBar?.update(r.boss);
    } else if (r.boss && (!r.boss.isAlive || !r.boss.sprite || !r.boss.sprite.active)) {
      r.targetRegistry.unregisterBoss();
    }

    // ── Physics culling — sleep/wake bodies based on camera viewport ──
    // Matter.js checks ALL bodies every frame. Sleeping off-screen bodies
    // dramatically reduces collision check complexity on large worlds.
    //
    // Per Phaser 4 physics-matter skill: setting body.isSleeping = true
    // causes Matter.js to skip the body in its broad-phase collision pass.
    // We wake it back up when the camera viewport approaches.
    //
    // ⚠️ NOTE on the previous implementation:
    //   The old code used `if (scene.time.now % 500 < 16)` which is
    //   UNRELIABLE — Phaser's time.now advances by variable delta per frame
    //   (16.67ms at 60fps, but can be 33ms at 30fps, or larger on hitches),
    //   so the modulo window can be SKIPPED ENTIRELY. With a delta of 33ms
    //   on a low-end device, every 500ms tick is jumped over. Result: the
    //   culling code NEVER ran in practice on slow machines (the very
    //   machines that need it most).
    //
    //   The fix below uses a proper accumulator that survives any delta.
    // ⚠️ Stage 1.7b: physics culling disabled entirely (was no-op for static bodies).
    //   VisualCuller (called below) handles all visual culling. Physics culling
    //   was only useful for dynamic bodies (enemies), which is Stage 2.0 work.
    // PlayController.cullAccumulator += deltaMs;
    // if (PlayController.cullAccumulator >= PlayController.CULL_INTERVAL_MS) {
    //   PlayController.cullAccumulator = 0;
    //   PlayController.runCulling(r);
    // }

    // ── Visual culling — setVisible(false) for off-screen GameObjects ──
    // Per Phaser 4 sprites-and-images skill: Phaser does NOT automatically
    // cull GameObjects outside the camera viewport. Every object on the
    // display list is processed each frame (matrix transform + batch submit),
    // even if off-screen. This is the #1 cause of FPS drops in large Acts.
    //
    // VisualCuller handles: visualRects (platforms/decorations/hazards),
    // loreObjects, landmarks, grappleAnchors, empDoors, shortcuts, collectibles.
    // It self-throttles to ~4x per second and uses camera.worldView for accuracy.
    VisualCuller.update(deltaMs, r.loadedArea, r.scene);

    // ── Out of bounds ──
    if (r.player.sprite.y > GAME.HEIGHT + 80) {
      r.player.takeDamage(25);
      const area = WorldSystem.getCurrentArea();
      if (area) {
        const sec = area.sections.find(s => s.id === r.currentSection);
        if (sec) {
          r.player.sprite.setPosition(sec.x + 200, GAME.HEIGHT - 300);
          r.player.sprite.setVelocity(0, 0);
        }
      }
    }

    // ── Boss arena zoom ──
    const cam = r.scene.cameras.main;
    if (r.bossArenaActive && r.boss && r.boss.isAlive) {
      if (cam.zoom > 0.86) {
        cam.zoomTo(0.85, 800, 'Sine.easeOut');
      }
    } else if (!r.bossArenaActive && cam.zoom < 0.99) {
      cam.zoomTo(1.0, 600, 'Sine.easeOut');
    }
  }

  constructor(private refs: PlayControllerRefs) {}

  // ── Physics culling state ──
  // Cull interval: how often (in ms) we re-evaluate body sleep state.
  // 500ms is a good balance — short enough that bodies wake before the
  // camera reaches them (player moves ~5px/frame at walk speed = 80px in
  // 500ms, well within the 200px viewport margin), long enough that we
  // don't burn CPU re-iterating the body list every frame.
  //
  // NOTE: static because PlayController.update() is static (stateless
  // delegation pattern — see class doc). The accumulator persists across
  // frames for the lifetime of the play session.
  private static readonly CULL_INTERVAL_MS = 500;
  private static cullAccumulator = 0;

  // ── Ambient dust accumulator ──
  // Per Stage 1.3 of OPTIMIZATION_PLAN.md: replaces the broken
  // `if (time.now % 200 < 16)` pattern which could be SKIPPED entirely
  // on slow machines (delta > 16ms jumps over the 200ms window).
  // Accumulator survives any delta — at 60fps fires ~3x/sec, at 30fps
  // fires ~1.5x/sec, both correct.
  private static readonly AMBIENT_DUST_INTERVAL_MS = 200;
  private static dustAccumulator = 0;

  /**
   * Sleep/wake Matter bodies based on whether they're inside (or near)
   * the camera viewport. Sleeping bodies are skipped by Matter's broad-phase
   * collision pass, saving CPU on large worlds with many platforms/hazards.
   *
   * Culls three categories:
   *   1. solids       — platforms/walls/floor (most numerous)
   *   2. hazardTriggers — spike/lava/laser sensors (heavy on collision checks
   *                       because they're sensors that fire overlap events)
   *   3. sectionTriggers — section-entry sensors (lightweight but numerous)
   *
   * Per Phaser 4 physics-matter skill: setting body.isSleeping = true is the
   * supported way to skip a body. We use a 200px margin around the viewport
   * so bodies wake slightly before they become visible (prevents pop-in of
   * collision when the player dashes into a screen-edge platform).
   *
   * NOTE: checkpointTriggers are NOT culled — they are few in number (4 per
   * area) and we want them always-active so the player can't miss a save by
   * dashing through it during a cull cycle.
   *
   * ⚠️ Stage 1.7 — solids REMOVED from culling:
   *   Per T5 analysis: ALL solids are static (isStatic: true). Matter's
   *   broad-phase uses `bodyAStatic = bodyA.isStatic || bodyA.isSleeping`,
   *   which is ALWAYS true for static bodies regardless of isSleeping.
   *   Setting isSleeping on a static body has ZERO effect on:
   *     - Collision detection (still checks static-vs-awake pairs like player-vs-platform)
   *     - Integration (was already skipped because isStatic)
   *     - Gravity (was already skipped because isStatic)
   *   The Body.set() call was costing CPU (6 field resets per body per 500ms)
   *   for zero benefit. Solids removed from cull list. Only hazards + sections
   *   remain (also static, but they're sensors — verify if culling helps them).
   *
   * ⚠️ Stage 1.7 also — hazardTriggers + sectionTriggers ARE static sensors:
   *   Same analysis applies — they're static. But sensor overlap events still
   *   fire when player enters their bounds. Setting isSleeping won't prevent
   *   the broad-phase from checking them (player is awake). So culling these
   *   is also no-op for collision. BUT they're few in number (~16 hazards + 10
   *   sections = 26 vs 84 solids), so the cost of culling them is negligible.
   *   Leaving them in for now (harmless), will revisit if needed.
   *
   * TODO: enemies are DYNAMIC and would benefit from real sleep-culling.
   *   Currently NO enemy culling exists — 25+ enemies can be active at once
   *   (all sections combined). This is a Stage 2 candidate.
   */
  private static runCulling(r: PlayUpdateRefs): void {
    // ⚠️ Stage 1.7b: ALL physics culling removed — was no-op for ALL static bodies.
    //
    // Per T5 source code analysis (Detector.js:80,96):
    //   bodyAStatic = bodyA.isStatic || bodyA.isSleeping
    //   → always true for static bodies regardless of isSleeping
    //   → collision check skipped ONLY if BOTH bodies are static/sleeping
    //   → player is always awake → static-vs-awake pairs ALWAYS checked
    //
    // All three categories were static:
    //   - solids: PhysicsSystem.addStaticRect → isStatic: true
    //   - hazardTriggers: PhysicsSystem.addSensor → isStatic: true, isSensor: true
    //   - sectionTriggers: PhysicsSystem.addSensor → isStatic: true, isSensor: true
    //
    // Setting isSleeping on any of these had ZERO effect on collision/integration/gravity.
    // The Body.set() call was costing CPU (6 field resets per body per 500ms) for zero benefit.
    //
    // What this means: physics culling was NEVER helping. The 30→45 FPS gain came
    // entirely from VisualCuller (setVisible(false) + tween pausing), not from physics.
    //
    // TODO: enemies are DYNAMIC and would benefit from real sleep-culling.
    //   Currently NO enemy culling exists — 25+ enemies can be active at once.
    //   This is a Stage 2.0 candidate (see OPTIMIZATION_PLAN.md).
    void r;  // no-op — kept method signature for PlayController.update() compatibility
  }

  /**
   * Per-frame barrel vs projectile collision check.
   *
   * Per task spec: barrels have NO Matter physics body (they're pure visual
   * Containers). Projectile collision is a per-frame distance check, mirroring
   * MetroidvaniaController.checkCollectiblePickups pattern.
   *
   * For each active, non-destroyed barrel:
   *   1. Call barrel.update() — redraws hit-flash visual if active (cheap
   *      early-return when no flash is active).
   *   2. Iterate alive projectiles; if dist(projectile, barrel) < 20px,
   *      call barrel.hit() (decrements health + spawns hit sparks). If hit()
   *      returns true (health now 0), call barrel.explode() with the player +
   *      enemies + boss + particles context.
   *   3. The projectile is consumed (proj.kill()) on hit.
   *   4. Break to next barrel after the first hit — a barrel can only lose
   *      1 HP per frame (prevents accidental multi-hits from clustered shots).
   *
   * Both player AND enemy projectiles trigger barrels — enemy crossfire
   * igniting barrels is intentional emergent gameplay (player can lure
   * enemies into shooting their own barrel stacks).
   *
   * Perf: uses squared distance comparison (no sqrt) + early AABB rejection
   * (|dx|>20 or |dy|>20 → skip). With ~3 barrels per area and ~5-10 active
   * projectiles, this is <30 cheap checks per frame.
   */
  private static checkBarrelProjectileCollisions(r: PlayUpdateRefs): void {
    if (!r.loadedArea) return;
    const barrels: DestructibleBarrel[] = r.loadedArea.barrels;
    const projectiles = r.projectiles;
    const HIT_RADIUS_SQ = 20 * 20;  // 400 — matches DestructibleBarrel.hitRadius

    for (let bi = 0; bi < barrels.length; bi++) {
      const barrel = barrels[bi];
      if (!barrel || !barrel.active || barrel.isExploded) continue;

      // Update hit-flash visual (no-op when no flash active).
      barrel.update();

      const bx = barrel.x;
      const by = barrel.y;

      for (let pi = projectiles.length - 1; pi >= 0; pi--) {
        const proj = projectiles[pi];
        if (!proj.isAlive) continue;
        const ps = proj.sprite;
        if (!ps || !ps.active) continue;
        const dx = ps.x - bx;
        const dy = ps.y - by;
        // Cheap AABB rejection before squared-distance check.
        if (dx > 20 || dx < -20 || dy > 20 || dy < -20) continue;
        const distSq = dx * dx + dy * dy;
        if (distSq > HIT_RADIUS_SQ) continue;

        // Hit! Decrement health; if destroyed, explode.
        const justDestroyed = barrel.hit();
        proj.kill();  // consume the projectile
        if (justDestroyed) {
          barrel.explode({
            player: r.player,
            enemies: r.enemies,
            boss: r.boss,
            particles: r.particles,
          });
        }
        break;  // barrel can only be hit once per frame; move to next barrel
      }
    }
  }

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
    r.bonfireController?.cleanup();
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
