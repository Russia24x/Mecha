/**
 * MECHA: LAST PROTOCOL — GameScene v4.0 (Refactored)
 *
 * ARCHITECTURE (v4.0 — post-refactor):
 *
 * GameScene is now a THIN state machine + Phaser lifecycle + wiring layer.
 * All heavy logic extracted to dedicated controllers:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ GameScene (1046 lines) — state machine + wiring             │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ • State machine: menu ↔ hub ↔ play ↔ gameover ↔ victory     │
 *   │ • Phaser lifecycle: create/update/shutdown                   │
 *   │ • EventBus listeners (PLAYER_DEAD/ENEMY_DEAD/BOSS_DEAD/etc.) │
 *   │ • Collision route registration (delegates to handlers below) │
 *   │ • Inline game handlers (see "WHY HANDLERS STAY HERE" below)  │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Extracted controllers:
 *   • PlayController — build() / spawnEnemiesForSection() / update() / destroy()
 *   • CollisionController — central collision dispatch router
 *   • MetroidvaniaController — collectibles + shortcuts
 *   • NpcInteractionController — NPC sprites + prompts
 *   • LoreController — lore panel UI (terminal/corpse/echo)
 *   • MenuNavHelper — thin wrapper around UIController (backward compat)
 *   • MenuBuilder / HubBuilder — menu + hub construction
 *   • BossHealthBarUI — boss health bar
 *   • TargetRegistry — O(m) projectile hit detection
 *   • UIController — unified navigation (gamepad + keyboard + mouse + touch)
 *   • FullscreenManager — browser fullscreen
 *
 * WHY HANDLERS STAY HERE (not in PlayController):
 *   The inline handlers (handleEnemyContact, handleHazard, enterSection,
 *   enterBossArena, activateCheckpoint, tryInteract) are 3-26 lines each
 *   and tightly coupled to GameScene's state (player, enemies, boss,
 *   camera, hud, loreController, dialogueUI, loadedArea, etc.).
 *
 *   Extracting them to PlayController would require either:
 *     (a) Passing 15+ field references per call, OR
 *     (b) Creating a PlayController instance with access to all GameScene fields
 *
 *   Both options make the code HARDER to read, not easier. The handlers
 *   are short, focused, and readable where they are. GameScene at 1046
 *   lines (down from 1978, -47%) is well-modularized.
 *
 * EventBus listeners stay here because they call setState() (cinematics,
 * death/victory transitions) — only GameScene can do state transitions.
 *
 * Designed for Phaser 4.2.1 — fully data-driven, modular, extensible.
 */
import Phaser from 'phaser';
import { COLORS, GAME, PLAYER } from '../../shared/Constants';
import { EventBus } from '../../systems/EventBus';
import { AudioSystem } from '../../systems/AudioSystem';
import { InputSystem } from '../../systems/InputSystem';
import { CombatSystem } from '../../systems/CombatSystem';
import { PhysicsSystem } from '../../systems/PhysicsSystem';
import { CameraSystem } from '../../systems/CameraSystem';
import { ParticleSystem } from '../../systems/ParticleSystem';
import { RenderSystem } from '../../systems/RenderSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { setLocale, t, getLocale, fixTextStyle } from '../../systems/LocalizationSystem';
import { NPCSystem } from '../../systems/NPCSystem';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { LoreSystem } from '../../systems/LoreSystem';
import { QuestSystem } from '../../systems/QuestSystem';
import { InventorySystem } from '../../systems/InventorySystem';
import { WeaponUpgradeSystem } from '../../systems/WeaponUpgradeSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import { SkillTreeSystem } from '../../systems/SkillTreeSystem';
import { WorldSystem } from '../../world/WorldSystem';
import { WorldMapSystem } from '../../world/WorldMapSystem';
import { AreaLoader, type LoadedArea } from '../../world/AreaLoader';
import { MetroidvaniaController } from '../../world/MetroidvaniaController';
import { NpcInteractionController } from '../../world/NpcInteractionController';
import { CheckpointSystem } from '../../world/CheckpointSystem';
import { PlayerEntity } from '../../entities/player/PlayerEntity';
import { EnemyEntity, resetEnemyIds } from '../../entities/enemies/EnemyEntity';
import { BossEntity } from '../../entities/boss/BossEntity';
import { Projectile } from '../../entities/combat/Projectile';
import { TargetRegistry } from '../../entities/combat/TargetRegistry';
import { HUDUI } from '../../ui/hud/HUDUI';
import { DialogueUI } from '../../ui/dialogue/DialogueUI';
import { PauseMenuUI } from '../../ui/pause/PauseMenuUI';
import { SettingsUI } from '../../ui/settings/SettingsUI';
import { SkillTreeUI } from '../../ui/skilltree/SkillTreeUI';
import { InventoryUI } from '../../ui/inventory/InventoryUI';
import { QuestUI } from '../../ui/quest/QuestUI';
import { WorldMapUI } from '../../ui/map/WorldMapUI';
import { HangarUI } from '../../ui/hangar/HangarUI';
import { OverlayManager, type OverlayId, type OverlayUI, type OverlayParent } from '../../ui/OverlayManager';
import { ControlHintsUI } from '../../ui/controls/ControlHintsUI';
import { BossHealthBarUI } from '../../ui/boss/BossHealthBarUI';
import { LoreController } from '../../ui/lore/LoreController';
import { MenuNavHelper } from '../../ui/shared/MenuNavHelper';
import { UIController } from '../../ui/UIController';
import { MenuBuilder } from '../../ui/menu/MenuBuilder';
import { HubBuilder } from '../../ui/hub/HubBuilder';
import { CollisionController } from '../../controllers/CollisionController';
import { PlayController } from '../../controllers/PlayController';
import { PerformanceOverlay } from '../../ui/PerformanceOverlay';
import { ParallaxBackground } from '../../world/atmosphere/ParallaxBackground';
import { AtmosphereSystem } from '../../world/atmosphere/AtmosphereSystem';
import { ForestEnvironmentSystem } from '../../world/atmosphere/ForestEnvironmentSystem';
import { CompanionEntity } from '../../entities/companion/CompanionEntity';
import { GamepadManager } from '../../shared/GamepadManager';
import { InputSchemeManager } from '../../systems/InputSchemeManager';
import { QualityManager } from '../../systems/QualityManager';
import type { EnemyTypeId } from '../../data/types';

type GameState = 'menu' | 'hub' | 'play' | 'gameover' | 'victory';

export class GameScene extends Phaser.Scene {
  private state: GameState = 'menu';
  private stateContainer: Phaser.GameObjects.Container | null = null;
  // Shared menu navigation helper (used by menu, hub, gameover, victory)
  private menuNav: MenuNavHelper | null = null;
  // Builders for menu + hub (gameover/victory still inline — smaller, rarely change)
  private menuBuilder: MenuBuilder | null = null;
  private hubBuilder: HubBuilder | null = null;

  // Systems (physicsSys — NOT 'physics', which conflicts with Phaser.Scene.physics)
  private physicsSys!: PhysicsSystem;
  private camera!: CameraSystem;
  private particles!: ParticleSystem;
  private render!: RenderSystem;
  private combat!: CombatSystem;

  // Entities
  private player!: PlayerEntity;
  private enemies: EnemyEntity[] = [];
  private boss: BossEntity | null = null;
  private projectiles: Projectile[] = [];
  /** Typed registry of damageable targets — used by Projectile for O(m) hit detection. */
  private targetRegistry = new TargetRegistry();

  // World
  private areaLoader!: AreaLoader;
  private loadedArea: LoadedArea | null = null;
  private currentSection = 1;
  private stageStartTime = 0;
  private bossArenaActive = false;
  private sequenceTimers: Phaser.Time.TimerEvent[] = [];
  private miniBossSpawned = false;

  // UI
  private hud: HUDUI | null = null;
  private dialogueUI!: DialogueUI;
  private pauseMenuUI!: PauseMenuUI;
  private controlHints: ControlHintsUI | null = null;
  private loreController: LoreController | null = null;
  private bossHealthBar: BossHealthBarUI | null = null;

  // Atmosphere + Parallax + NPCs (PLAY-only — never leak to hub/menu)
  private parallax: ParallaxBackground | null = null;
  private atmosphere: AtmosphereSystem | null = null;
  private npcInteraction: NpcInteractionController | null = null;
  // Phase 3: Death penalty tracking
  private lastLostXp = 0;
  // Companion entity (Protocol Echo — follows player)
  private companion: CompanionEntity | null = null;
  // Forest environment (grass/trees/vines/water/rain — forest region only)
  private forestEnv: ForestEnvironmentSystem | null = null;
  // Performance overlay (toggle with F3)
  private perfOverlay: PerformanceOverlay | null = null;
  // Metroidvania controller (collectibles + shortcuts) — PLAY-only
  private metroidvania: MetroidvaniaController | null = null;
  // Collision dispatch router — PLAY-only
  private collision: CollisionController | null = null;

  // Pause state — when paused, play is frozen but game loop runs for UI
  private paused = false;
  private lastPauseToggleAt = 0;

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    // Init audio
    AudioSystem.init();
    AudioSystem.resume();

    // *** ROOT FIX: Init InputSystem NOW — listeners work from menu onward ***
    // Previously init() was only called by PlayerEntity, leaving menu/hub without keyboard.
    InputSystem.init();

    // Bind OverlayManager to this scene
    OverlayManager.bind(this);

    // Load settings
    const settings = SaveSystem.getSettings();
    AudioSystem.setMasterVolume(settings.masterVolume);
    AudioSystem.setSfxVolume(settings.sfxVolume);
    AudioSystem.setMuted(settings.muted);
    RenderSystem.setBrightness(settings.brightness);
    // ── Apply quality setting on startup ──
    QualityManager.setQuality((settings.quality ?? 'high') as 'low' | 'medium' | 'high');
    setLocale(settings.locale);

    // Init meta systems
    QuestSystem.init();
    LoreSystem.init();
    CheckpointSystem.init();
    WorldSystem.initFromSave();

    // Init core systems
    this.physicsSys = new PhysicsSystem(this);
    this.camera = new CameraSystem(this);
    this.particles = new ParticleSystem(this);

    // Build dialogue UI (used in any state)
    this.dialogueUI = new DialogueUI(this);

    // Build pause menu with all callbacks
    this.pauseMenuUI = new PauseMenuUI(this, {
      onResume: () => this.togglePause(),
      onRestart: () => this.restartStage(),
      onCheckpoint: () => this.returnToCheckpoint(),
      onSettings: () => this.openOverlay('settings'),
      onSkills: () => this.openOverlay('skills'),
      onInventory: () => this.openOverlay('inventory'),
      onQuests: () => this.openOverlay('quests'),
      onMap: () => this.openOverlay('map'),
      onReturnToHub: () => this.quitToHub(),
      onQuit: () => this.quitToMenu(),
    });

    // EventBus listeners
    EventBus.on('PLAYER_DEAD', this.onPlayerDied, this);
    EventBus.on('ENEMY_DEAD', this.onEnemyKilled, this);
    EventBus.on('BOSS_DEAD', this.onBossDied, this);
    EventBus.on('CHECKPOINT', () => this.hud?.toast(t('checkpoint.saved')));
    EventBus.on('GAME_STATE', (p: unknown) => {
      const data = p as { sectionName?: string };
      if (data.sectionName) this.hud?.setSection(data.sectionName);
    });
    EventBus.on('LEVEL_UP', () => this.hud?.toast(t('levelup')));
    EventBus.on('SKILL_UNLOCKED', () => { this.player?.refreshStats(); });
    EventBus.on('ABILITY_UNLOCKED', () => { this.player?.refreshStats(); });
    // ── Ability events ──
    EventBus.on('EMP_PULSE', this.onEmpPulse, this);
    EventBus.on('EMP_HIT', this.onEmpHit, this);
    EventBus.on('HACK_COMPLETE', this.onHackComplete, this);

    // Performance overlay (F3 toggle)
    this.perfOverlay = new PerformanceOverlay(this);
    // F3 key listener for toggle
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.perfOverlay?.toggle();
      }
    });

    this.setState('menu');
  }

  // ================ STATE MACHINE ================

  private setState(next: GameState): void {
    // Cleanup previous state
    this.cleanupState();
    this.state = next;
    // Create stateContainer
    this.stateContainer = this.add.container(0, 0).setDepth(50);
    // Create shared UIController for menu/hub/gameover/victory (not play)
    if (next !== 'play') {
      OverlayManager.createSharedController(this, this.stateContainer);
      // Keep MenuNavHelper for backward compat (MenuBuilder/HubBuilder/gameover/victory use it)
      this.menuNav = new MenuNavHelper(this, this.stateContainer);
    }
    switch (next) {
      case 'menu': this.buildMenu(); break;
      case 'hub': this.buildHub(); break;
      case 'play': this.buildPlay(); break;
      case 'gameover': this.buildGameOver(); break;
      case 'victory': this.buildVictory(); break;
    }
    // setScrollFactor(0,0,true) AFTER all children are added by build* methods
    this.stateContainer.setScrollFactor(0, 0, true);
  }

  private cleanupState(): void {
    // Close any open overlays first
    OverlayManager.closeAll();
    // Destroy HUD if leaving play (hub is a separate environment — no HUD)
    if (this.state === 'play') {
      this.cleanupPlay();
    }
    // Cleanup builders
    this.menuBuilder?.destroy();
    this.menuBuilder = null;
    this.hubBuilder?.destroy();
    this.hubBuilder = null;
    // Destroy shared UIController (replaces old menuNav)
    OverlayManager.destroySharedController();
    this.menuNav?.destroy();
    this.menuNav = null;
    if (this.stateContainer) {
      this.stateContainer.destroy(true);
      this.stateContainer = null;
    }
    // Hide pause menu if visible
    if (this.pauseMenuUI?.isVisible) this.pauseMenuUI.hide();
    this.paused = false;
  }

  // ================ OVERLAY MANAGEMENT ================

  /**
   * Open an overlay from the current context.
   * - From hub: overlay sits on top of hub. Closing returns to hub.
   * - From play (paused): hide pause menu first. Closing reopens pause menu.
   */
  private openOverlay(id: OverlayId): void {
    const parent: OverlayParent = this.state === 'hub' ? 'hub' : this.state === 'play' ? 'play' : 'menu';

    // If from play, hide pause menu (paused stays true so play doesn't update)
    if (parent === 'play') {
      this.pauseMenuUI.hide();
    }

    // Build the overlay UI on demand
    let ui: OverlayUI | null = null;
    switch (id) {
      case 'settings':
        ui = new SettingsUI(this, () => this.closeOverlay());
        break;
      case 'skills':
        ui = new SkillTreeUI(this, () => this.closeOverlay());
        break;
      case 'inventory':
        ui = new InventoryUI(this, () => this.closeOverlay());
        break;
      case 'quests':
        ui = new QuestUI(this, () => this.closeOverlay());
        break;
      case 'map':
        ui = new WorldMapUI(this,
          () => this.closeOverlay(),
          (areaId: string) => this.fastTravel(areaId),
        );
        break;
      case 'hangar':
        ui = new HangarUI(this, () => this.closeOverlay());
        break;
    }
    if (!ui) return;
    OverlayManager.open(id, ui, parent);
  }

  /** Close the current overlay and return to its parent. */
  private closeOverlay(): void {
    OverlayManager.close((parent) => {
      if (parent === 'play') {
        // Reopen pause menu
        this.pauseMenuUI.show();
      } else if (parent === 'hub' || parent === 'menu') {
        // Shared controller already visible (was hidden during overlay)
        OverlayManager.getSharedController()?.show(40);
      }
    });
  }

  // ================ UPDATE LOOP ================

  update(_time: number, deltaMs: number): void {
    InputSystem.update();
    InputSchemeManager.update();  // dynamic scheme detection (KB / Xbox / PS)
    const input = InputSystem.getState();

    // ── Performance overlay toggle (F3) + update ──
    if (this.perfOverlay) {
      this.perfOverlay.update(deltaMs);
    }
    // F3 key handled via window listener (set up in create)

    // *** Overlay input has highest priority — B/ESC closes, gamepad navigates ***
    if (OverlayManager.hasOpen) {
      OverlayManager.handleInput((parent) => {
        if (parent === 'play') {
          this.pauseMenuUI.show();
        }
      });
      this.handleDialogueInput(input);
      return;  // Block all other input while overlay is open
    }

    if (this.state === 'play') {
      // ── Lore controller input handling (closes panel on interact/back/ESC) ──
      // Capture open state BEFORE handleInput so ESC closes lore without
      // also triggering pause in the same frame.
      const loreWasOpen = this.loreController?.isOpen ?? false;
      this.loreController?.handleInput(input);
      // ESC / Start = toggle pause — ONLY if lore was NOT open this frame
      // (prevents ESC from both closing lore AND opening pause menu simultaneously)
      if (input.pausePressed && !loreWasOpen) {
        this.togglePause();
      }
      if (!this.paused) {
        // ── tryInteract only if lore was NOT open this frame ──
        // Without this guard, pressing E to close the lore panel would
        // immediately re-open it in the same frame (double-trigger bug).
        // Also guards the open path: if lore just closed, don't re-interact.
        if (input.interactPressed && !loreWasOpen) this.tryInteract();
        // Freeze game while lore panel is open (gating behavior preserved)
        if (!this.loreController?.isOpen) {
          this.updatePlay(deltaMs);
        }
      } else {
        // Paused — handle pause menu navigation
        this.pauseMenuUI.handleNavigation();
      }
    } else if (this.state === 'menu' || this.state === 'hub' || this.state === 'gameover' || this.state === 'victory') {
      // UIController handles cursor + input (D-pad, tabs, click)
      // MenuNavHelper handles button focus + spatial nav (uses same UIController cursor)
      OverlayManager.getSharedController()?.update();
      this.menuNav?.handleGamepadNav(input);
      // ESC in hub = back to menu
      if (this.state === 'hub' && input.pausePressed) {
        this.setState('menu');
      }
    }

    this.handleDialogueInput(input);
  }

  private handleDialogueInput(input: import('../../systems/InputSystem').InputState): void {
    if (this.dialogueUI?.isVisible) {
      if (input.jumpPressed || input.firePressed) {
        this.dialogueUI.advance();
      }
    }
  }

  // ================ MENU ================

  private buildMenu(): void {
    // Delegate to MenuBuilder — see src/game/ui/menu/MenuBuilder.ts
    this.menuBuilder = new MenuBuilder(this, this.stateContainer!, this.menuNav!, {
      onStart: () => this.setState('hub'),
      onContinue: () => {
        if (CheckpointSystem.hasCheckpoint()) {
          CheckpointSystem.init();
          WorldSystem.initFromSave();
          this.setState('hub');
        }
      },
      onOpenSettings: () => this.openOverlay('settings'),
    });
    this.menuBuilder.build();
  }

  // ================ HUB (World Map + Menu Access) ================

  private buildHub(): void {
    // Delegate to HubBuilder — see src/game/ui/hub/HubBuilder.ts
    this.hubBuilder = new HubBuilder(this, this.stateContainer!, this.menuNav!, {
      onEnterArea: (areaId: string) => {
        if (areaId !== WorldSystem.getCurrent().areaId) {
          WorldSystem.travelTo(areaId, 1);
        }
        this.setState('play');
      },
      onOpenOverlay: (overlayId: string) => this.openOverlay(overlayId as OverlayId),
      onBackToMenu: () => this.setState('menu'),
    });
    this.hubBuilder.build();
  }


  // ================ PLAY ================

  private buildPlay(): void {
    // Delegate construction to PlayController.build()
    // Pass this.targetRegistry so Projectile can find it via (scene as HasTargetRegistry).targetRegistry
    // Collision route registration stays here (handlers are in GameScene)
    const state = PlayController.build(
      this, this.physicsSys, this.particles, this.camera,
      this.targetRegistry,
      {
        onToast: (msg: string) => this.hud?.toast(msg),
        isMiniBossSpawned: () => this.miniBossSpawned,
        setMiniBossSpawned: (v: boolean) => { this.miniBossSpawned = v; },
        setExternalRefs: (enemies, anchors) => this.player?.setExternalRefs(enemies, anchors),
      },
    );
    if (!state) return;
    // Assign built state to GameScene fields
    this.parallax = state.parallax;
    this.atmosphere = state.atmosphere;
    this.forestEnv = state.forestEnv;
    this.areaLoader = state.areaLoader;
    this.loadedArea = state.loadedArea;
    this.metroidvania = state.metroidvania;
    this.render = state.render;
    this.combat = state.combat;
    this.player = state.player;
    this.companion = state.companion;
    this.hud = state.hud;
    this.npcInteraction = state.npcInteraction;
    this.loreController = state.loreController;
    this.controlHints = state.controlHints;
    this.enemies = state.enemies;
    this.projectiles = state.projectiles;
    this.currentSection = state.currentSection;
    this.stageStartTime = state.stageStartTime;
    this.bossArenaActive = false;
    this.miniBossSpawned = false;
    this.sequenceTimers = [];
    // Note: targetRegistry already cleared + player registered by PlayController.build()
    // No need to call registerPlayer again here.

    // ── Collision dispatch router (handlers are in GameScene) ──
    this.collision = new CollisionController(this);
    this.collision.routes = {
      onSection: (sectionId: number) => this.enterSection(sectionId),
      onCheckpoint: () => this.activateCheckpoint(),
      onBossEntry: () => this.enterBossArena(),
      onEnemyContact: (enemyGo: Phaser.GameObjects.GameObject) => this.handleEnemyContact(enemyGo),
      onBossContact: () => { if (this.boss) this.player.takeDamage(this.boss.getContactDamage()); },
      onHazard: (hazardGo: Phaser.GameObjects.GameObject) => this.handleHazard(hazardGo),
    };
    this.collision.enter();

    // Emit section info
    const area = WorldSystem.getCurrentArea();
    if (area) {
      const sec = area.sections.find(s => s.id === this.currentSection);
      if (sec) EventBus.emit('GAME_STATE', { sectionId: sec.id, sectionName: sec.nameKey });
    }
  }

  // ================ PLAY HELPERS ================
  // buildPlay, spawnEnemiesForSection, updatePlayerExternalRefs extracted to
  // PlayController — see src/game/controllers/PlayController.ts

  // ================ COLLISION DISPATCH ================
  // Extracted to CollisionController — see src/game/controllers/CollisionController.ts
  // GameScene registers routes in buildPlay() and delegates dispatch to the controller.
  // Handler logic (enterSection, activateCheckpoint, handleEnemyContact, handleHazard)
  // remains here as methods — only the routing mechanism was extracted.

  private handleHazard(hazardGo: Phaser.GameObjects.GameObject): void {
    const dmg = hazardGo.getData('hazardDamage') as number;
    if (dmg && this.player.takeDamage(dmg)) {
      if (this.player.sprite?.active) {
        this.player.sprite.setVelocityY(-8);
        this.camera.shake(200, 0.008);
      }
    }
  }

  // ─── Boss Health Bar ─────────────────────────────────────────────────
  private createBossHealthBar(bossId: string): void {
    if (!this.bossHealthBar) this.bossHealthBar = new BossHealthBarUI(this);
    this.bossHealthBar.show(bossId);
  }

  private updateBossHealthBar(): void {
    if (!this.boss || !this.bossHealthBar) return;
    this.bossHealthBar.update(this.boss);
  }

  private destroyBossHealthBar(): void {
    this.bossHealthBar?.hide();
  }

  private enterSection(id: number): void {
    if (id === this.currentSection) return;
    this.currentSection = id;
    WorldSystem.setSection(id);
    // Delegate enemy spawn to PlayController (static method)
    PlayController.spawnEnemiesForSection(
      this, this.physicsSys, this.particles, this.projectiles,
      this.enemies, this.targetRegistry, id,
      {
        onToast: (msg: string) => this.hud?.toast(msg),
        isMiniBossSpawned: () => this.miniBossSpawned,
        setMiniBossSpawned: (v: boolean) => { this.miniBossSpawned = v; },
        setExternalRefs: () => {},
      },
    );
    // Refresh player external refs (new enemies spawned)
    if (this.player && this.loadedArea) {
      const anchorPositions: Phaser.Math.Vector2[] = [];
      for (const anchor of this.loadedArea.grappleAnchors) {
        if (anchor && anchor.active) {
          anchorPositions.push(new Phaser.Math.Vector2(anchor.x, anchor.y));
        }
      }
      this.player.setExternalRefs(this.enemies, anchorPositions);
    }
    // ── Hide control hints after leaving section 1 ──
    if (id !== 1 && this.controlHints) {
      this.controlHints.setVisible(false);
    }
  }

  private activateCheckpoint(): void {
    CheckpointSystem.activate(this.currentSection, this.player.sprite.x, this.player.sprite.y);
  }

  private enterBossArena(): void {
    if (this.bossArenaActive) return;
    this.bossArenaActive = true;
    const area = WorldSystem.getCurrentArea();
    if (!area) return;
    const bossSection = area.sections.find(s => s.bossId);
    if (!bossSection || !bossSection.bossId) return;
    const x = bossSection.x + 800;
    const y = GAME.HEIGHT - 320;
    this.boss = new BossEntity(this, this.physicsSys, this.particles, bossSection.bossId, x, y, this.projectiles, () => this.player.position);
    this.targetRegistry.registerBoss(this.boss);
    // Switch to boss ambient (tense, dissonant)
    AudioSystem.startAmbient('boss');
    AudioSystem.play('phaseChange');
    this.particles.screenFlash(0xff3030, 0.35, 500);
    // Phaser 4 camera effects: shake + flash for boss entrance (per cameras skill)
    this.cameras.main.shake(400, 0.012);
    this.cameras.main.flash(300, 255, 30, 30);
    // Boss health bar — top center (per Design Pillars: 'Boss: every boss teaches something')
    this.createBossHealthBar(bossSection.bossId);
    // Note: boss circle light removed per user feedback — boss has its own glow via
    // BossEntity's sprite (red eyes, weapon glow). Camera shake + flash already telegraph arrival.
  }

  private handleEnemyContact(enemyGo: Phaser.GameObjects.GameObject): void {
    const id = enemyGo.getData('id') as string | undefined;
    // Find the enemy entity to check if hacked
    const enemy = this.enemies.find(e => e.id === id);
    if (enemy?.hacked) return;  // Hacked enemies don't damage the player
    const dmg = id?.startsWith('drone-') ? 8 : id?.startsWith('spider-') ? 14 : id?.startsWith('heavy-') ? 22 : id?.startsWith('sniper-') ? 12 : 10;
    if (this.player.takeDamage(dmg)) {
      const enemyX = (enemyGo as unknown as { x?: number }).x;
      if (typeof enemyX === 'number' && this.player.sprite?.active) {
        const dir = this.player.sprite.x < enemyX ? -1 : 1;
        this.player.sprite.setVelocityX(dir * 4);
        this.player.sprite.setVelocityY(-4);
      }
    }
  }

  private tryInteract(): void {
    // Close lore panel if open (delegates to LoreController)
    if (this.loreController?.isOpen) {
      this.loreController.close();
      return;
    }
    const area = WorldSystem.getCurrentArea();
    if (!area) return;
    // ── Wire: NPC interaction ──
    const npcs = NPCSystem.getNPCsInArea(area.id);
    for (const npc of npcs) {
      const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, npc.x, npc.y);
      if (dist < 80) {
        const dialogueId = NPCSystem.interact(npc.id);
        if (dialogueId) {
          this.dialogueUI.show(dialogueId);
          return;
        }
      }
    }
    // ── Wire: Lore object interaction (delegates to LoreController) ──
    if (this.loadedArea && this.loreController) {
      for (const loreObj of this.loadedArea.loreObjects) {
        if (!loreObj || !loreObj.active) continue;
        const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, loreObj.x, loreObj.y);
        if (dist < 70) {
          this.loreController.open(
            loreObj.getData('loreTitle') as string,
            loreObj.getData('loreText') as string,
          );
          return;
        }
      }
    }
  }

  // ================ LORE PANEL ================
  // Extracted to LoreController — see src/game/ui/lore/LoreController.ts
  // GameScene delegates via this.loreController.open(...) / .close() / .isOpen

  private updatePlay(deltaMs: number): void {
    // Delegate to PlayController.update() — see src/game/controllers/PlayController.ts
    // Only the update loop body is extracted; handler methods (enterSection,
    // handleEnemyContact, etc.) remain in GameScene for Step 4b.
    PlayController.update(deltaMs, {
      scene: this,
      player: this.player,
      render: this.render,
      hud: this.hud,
      controlHints: this.controlHints,
      atmosphere: this.atmosphere,
      npcInteraction: this.npcInteraction,
      metroidvania: this.metroidvania,
      loadedArea: this.loadedArea,
      companion: this.companion,
      forestEnv: this.forestEnv,
      particles: this.particles,
      projectiles: this.projectiles,
      enemies: this.enemies,
      targetRegistry: this.targetRegistry,
      boss: this.boss,
      bossHealthBar: this.bossHealthBar,
      bossArenaActive: this.bossArenaActive,
      currentSection: this.currentSection,
      camera: this.camera,
    });
  }

  private cleanupPlay(): void {
    // Delegate to PlayController — see src/game/controllers/PlayController.ts
    // PlayController.destroy() preserves the exact cleanup order:
    //   1. collision.exit() FIRST (prevent callbacks to half-destroyed bodies)
    //   2. entity destruction
    //   3. world unload
    //   4. PLAY-only systems
    //   5. timer cleanup
    //   6. HUD + render
    //   7. camera filter reset (vignette leak fix)
    //   8. camera + physics reset
    const play = new PlayController({
      collision: this.collision,
      loreController: this.loreController,
      bossHealthBar: this.bossHealthBar,
      npcInteraction: this.npcInteraction,
      metroidvania: this.metroidvania,
      targetRegistry: this.targetRegistry,
      player: this.player,
      enemies: this.enemies,
      boss: this.boss,
      projectiles: this.projectiles,
      loadedArea: this.loadedArea,
      areaLoader: this.areaLoader,
      parallax: this.parallax,
      atmosphere: this.atmosphere,
      forestEnv: this.forestEnv,
      companion: this.companion,
      controlHints: this.controlHints,
      hud: this.hud,
      render: this.render,
      sequenceTimers: this.sequenceTimers,
      scene: this,
      camera: this.camera,
      physicsSys: this.physicsSys,
    });
    play.destroy();
    // Null out nullable play-only fields (definite-assignment fields like
    // player/areaLoader/render will be overwritten in next buildPlay)
    this.collision = null;
    this.loreController = null;
    this.bossHealthBar = null;
    this.npcInteraction = null;
    this.metroidvania = null;
    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.loadedArea = null;
    this.parallax = null;
    this.atmosphere = null;
    this.forestEnv = null;
    this.companion = null;
    this.controlHints = null;
    this.hud = null;
    this.sequenceTimers = [];
    this.paused = false;
  }

  // ================ PAUSE / OVERLAYS ================

  private togglePause(): void {
    if (this.state !== 'play') return;
    // Don't toggle if an overlay is open (overlay handles its own back)
    if (OverlayManager.hasOpen) return;
    const now = this.time.now;
    if (now - this.lastPauseToggleAt < 200) return;
    this.lastPauseToggleAt = now;

    if (this.paused) {
      this.paused = false;
      this.pauseMenuUI.hide();
      // Phaser 4 camera fade — smooth resume transition (per cameras skill)
      this.cameras.main.fadeIn(300, 5, 7, 13);
      AudioSystem.play('uiClick');
    } else {
      this.paused = true;
      this.pauseMenuUI.show();
      this.input.enabled = true;
      AudioSystem.play('uiClick');
    }
  }

  private restartStage(): void {
    this.paused = false;
    this.pauseMenuUI.hide();
    CheckpointSystem.clear();
    this.cleanupPlay();
    this.setState('play');
  }

  /** Return to last checkpoint (without clearing it). */
  private returnToCheckpoint(): void {
    if (!CheckpointSystem.hasCheckpoint()) {
      this.hud?.toast(getLocale() === 'fa' ? 'چک‌پوینتی موجود نیست' : 'NO CHECKPOINT');
      return;
    }
    this.paused = false;
    this.pauseMenuUI.hide();
    this.cleanupPlay();
    this.setState('play');  // rebuilds at checkpoint position
  }

  private fastTravel(areaId: string): void {
    WorldSystem.travelTo(areaId, 1);
    OverlayManager.closeAll();
    this.paused = false;
    this.pauseMenuUI.hide();
    this.cleanupPlay();
    this.setState('play');
  }

  /** Quit from pause menu → hub (separate environment). */
  private quitToHub(): void {
    this.paused = false;
    this.pauseMenuUI.hide();
    this.cleanupPlay();
    this.setState('hub');
  }

  /** Quit from pause menu → main menu. */
  private quitToMenu(): void {
    this.paused = false;
    this.pauseMenuUI.hide();
    this.cleanupPlay();
    this.setState('menu');
  }

  // ================ EVENT HANDLERS ================

  private onPlayerDied = (): void => {
    // NOTE: Do NOT unregister — listener must survive for retry (pre-existing bug fix).
    this.particles.explosion(this.player.sprite.x, this.player.sprite.y, COLORS.PLAYER, 1.2);
    // ── Phase 3: Death penalty — lose 50% unbanked XP ──
    // Per Design Pillars: death must have stakes (Souls-like).
    this.lastLostXp = SaveSystem.applyDeathPenalty();
    // Phaser 4 camera effects: shake + fade for death (per cameras skill)
    this.cameras.main.shake(400, 0.012);
    this.cameras.main.fadeOut(700, 5, 7, 13);
    this.scheduleDelayed(900, () => {
      this.cameras.main.fadeIn(300, 5, 7, 13);
      this.setState('gameover');
    });
  };

  private onEnemyKilled = (payload: unknown): void => {
    const data = payload as { id: string; x: number; y: number };
    if (data.x && data.y) this.particles.explosion(data.x, data.y, COLORS.ENEMY_DRONE, 0.6);
    // Mini Boss (Elite) defeat → unlock Mag-Clamp Thrusters (wall slide + wall jump)
    if (data.id && data.id.startsWith('elite-') && !this.player.hasAbility('wallJump')) {
      SaveSystem.unlockAbility('wallJump');
      this.player.refreshStats();
      this.hud?.toast('◆ MAG-CLAMP THRUSTERS ONLINE');
      AudioSystem.play('skillUnlock');
      this.particles.screenFlash(0x39d0d8, 0.3, 400);
    }
  };

  private onBossDied = (payload: unknown): void => {
    const data = payload as { id: string; lore: string[] };
    // Moment 9: Atlas kneels — gentle particles, NOT explosion (per design pillars)
    if (this.boss) {
      this.particles.sparks(this.boss.position.x, this.boss.position.y, COLORS.BOSS, 8);
    }
    // Hide boss health bar
    this.destroyBossHealthBar();
    // Restore factory ambient
    AudioSystem.startAmbient('factory');
    // Moment 10: Horizon view — camera pans up to show silhouette in fog
    this.scheduleDelayed(2500, () => {
      // Pan camera upward to reveal horizon
      const targetY = this.cameras.main.scrollY - 200;
      this.cameras.main.pan(this.cameras.main.scrollX + GAME.WIDTH / 2, targetY, 2000, 'Sine.easeInOut');
      // Draw Leviathan silhouette in the distance (foreshadowing Act II)
      const silX = this.cameras.main.scrollX + GAME.WIDTH / 2;
      const silY = targetY + 50;
      const silhouette = this.add.rectangle(silX, silY, 200, 300, 0x0a0e1a, 0.6);
      silhouette.setDepth(2);
      silhouette.setBlendMode(Phaser.BlendModes.MULTIPLY);
      // Slow fade in silhouette
      silhouette.setAlpha(0);
      this.tweens.add({ targets: silhouette, alpha: 0.6, duration: 2000, delay: 500 });
      // Caption
      const caption = this.add.text(GAME.WIDTH / 2, GAME.HEIGHT * 0.7,
        'The Drowned Wastes await...', {
        fontFamily: 'monospace', fontSize: '14px', color: '#3a4350', stroke: '#000', strokeThickness: 3,
        letterSpacing: 4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(250).setAlpha(0);
      this.tweens.add({ targets: caption, alpha: 1, duration: 1500, delay: 1000 });

      // Transition to victory after horizon view
      this.scheduleDelayed(3500, () => {
        this.cameras.main.fadeOut(600, 5, 7, 13);
        this.scheduleDelayed(700, () => {
          AudioSystem.play('victory');
          this.setState('victory');
        });
      });
    });
  };

  // ================ ABILITY EVENT HANDLERS ================

  /** EMP pulse — open any EMP doors in range + stun enemies (stun handled in PlayerEntity). */
  private onEmpPulse = (payload: unknown): void => {
    const data = payload as { x: number; y: number; radius: number };
    if (!this.loadedArea) return;
    for (const door of this.loadedArea.empDoors) {
      if (!door || !door.active) continue;
      if (door.getData('empDoorOpen')) continue;
      const dist = Phaser.Math.Distance.Between(data.x, data.y, door.x, door.y);
      if (dist < data.radius) {
        // Open the door
        door.setData('empDoorOpen', true);
        // ── FIX Bug 1: Remove the physics body so player can pass through ──
        const physicsBody = door.getData('physicsBody') as Phaser.Physics.Matter.Image | null;
        if (physicsBody && physicsBody.active) {
          this.matter.world.remove(physicsBody.body as MatterJS.Body);
          physicsBody.destroy();
        }
        this.tweens.add({
          targets: door, alpha: 0, scaleY: 0, duration: 400, ease: 'Cubic.out',
          onComplete: () => { door.setVisible(false); },
        });
        // Spark burst
        this.particles.sparks(door.x, door.y, 0xc060ff, 12);
        this.hud?.toast(getLocale() === 'fa' ? '◆ در EMP باز شد' : '◆ EMP DOOR OPENED');
        AudioSystem.play('skillUnlock');
      }
    }
  };

  /** ── FIX Bug 3: EMP_HIT listener — force-stagger enemies hit by EMP ── */
  private onEmpHit = (payload: unknown): void => {
    const data = payload as { enemyId: string; x: number; y: number };
    for (const enemy of this.enemies) {
      if (enemy.id === data.enemyId) {
        enemy.forceStagger();
        break;
      }
    }
  };

  /** Hack complete — convert enemy to friendly (disable hostile AI). */
  private onHackComplete = (payload: unknown): void => {
    const data = payload as { enemyId: string };
    for (const enemy of this.enemies) {
      if (enemy.id === data.enemyId) {
        // Mark as hacked — enemy stops attacking player
        enemy.hacked = true;
        this.hud?.toast(getLocale() === 'fa' ? '◆ دشمن هک شد' : '◆ ENEMY HACKED');
        // Visual: green tint (will be handled in enemy updateFlash)
        this.particles.sparks(enemy.position.x, enemy.position.y, 0x40ff80, 10);
        break;
      }
    }
  };

  // ================ GAMEOVER / VICTORY ================

  private buildGameOver(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.88).setDepth(200);
    c.add(overlay);
    c.add(this.add.text(w / 2, h * 0.3, t('gameover.title'), fixTextStyle({
      fontFamily: 'monospace', fontSize: '56px', color: '#ff4040', stroke: '#000', strokeThickness: 8,
    })).setOrigin(0.5).setDepth(201));
    const statsLine = getLocale() === 'fa'
      ? `سطح ${ExperienceSystem.getLevel()}  |  ${SaveSystem.getPlayer().totalKills} کشته`
      : `LV.${ExperienceSystem.getLevel()}  |  ${SaveSystem.getPlayer().totalKills} kills`;
    c.add(this.add.text(w / 2, h * 0.42, statsLine, fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: '#5a6470',
    })).setOrigin(0.5).setDepth(201));
    // ── Phase 3: Death penalty display — show lost XP ──
    if (this.lastLostXp > 0) {
      const lostLine = getLocale() === 'fa'
        ? `جریمه مرگ: -${this.lastLostXp} XP`
        : `DEATH PENALTY: -${this.lastLostXp} XP`;
      c.add(this.add.text(w / 2, h * 0.48, lostLine, fixTextStyle({
        fontFamily: 'monospace', fontSize: '12px', color: '#ff4040', stroke: '#000', strokeThickness: 3,
      })).setOrigin(0.5).setDepth(201));
    }
    // Retry button — restarts the stage
    this.menuNav!.makeMenuBtn(w / 2, h * 0.55, t('gameover.retry'), () => {
      AudioSystem.play('uiClick');
      CheckpointSystem.clear();
      this.setState('play');
    });
    // Quit button — back to main menu (user: "if defeated → game over with retry/restart")
    this.menuNav!.makeMenuBtn(w / 2, h * 0.65, t('gameover.quit'), () => {
      AudioSystem.play('uiClick');
      this.setState('menu');
    });
    this.menuNav!.setupNav();
  }

  private buildVictory(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    // Background — dark void with subtle starfield
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x040810, 1).setDepth(0);
    c.add(overlay);
    // Faint stars
    for (let i = 0; i < 30; i++) {
      const star = this.add.circle(Math.random() * w, Math.random() * h, Math.random() * 1.5 + 0.3, 0x39d0d8, Math.random() * 0.2 + 0.05);
      c.add(star);
    }
    // Fade in camera
    this.cameras.main.fadeIn(600, 5, 7, 13);
    // Title — Persian-aware
    c.add(this.add.text(w / 2, h * 0.3, t('victory.title'), fixTextStyle({
      fontFamily: 'monospace', fontSize: '56px', color: '#ffe060', stroke: '#000', strokeThickness: 8,
    })).setOrigin(0.5).setDepth(1));
    // Boss lore — Persian-aware
    const lore = LoreSystem.getBossLore('guardian_ax09');
    if (lore) {
      const lines = lore.lines.map(key => t(key));
      c.add(this.add.text(w / 2, h * 0.5, lines, fixTextStyle({
        fontFamily: 'monospace', fontSize: '14px', color: '#a0a0a0', align: 'center', lineSpacing: 6,
      })).setOrigin(0.5).setDepth(1));
    }
    // Atlas quote — Persian-aware
    const atlasQuote = getLocale() === 'fa'
      ? '"اطلس هرگز منتظر ماند."'
      : '"Atlas never stopped waiting."';
    c.add(this.add.text(w / 2, h * 0.68, atlasQuote, fixTextStyle({
      fontFamily: 'monospace', fontSize: '16px', color: '#39d0d8', stroke: '#000', strokeThickness: 4, fontStyle: 'italic',
    })).setOrigin(0.5).setDepth(1));
    // ── Return to HUB (not menu) — per user: after victory, go to hub to prepare for next stage ──
    const returnLabel = getLocale() === 'fa' ? 'بازگشت به هاب' : t('victory.return');
    this.menuNav!.makeMenuBtn(w / 2, h * 0.82, returnLabel, () => {
      AudioSystem.play('uiClick');
      this.setState('hub');
    });
    this.menuNav!.setupNav();
  }

  // ================ HELPERS ================

  private scheduleDelayed(delay: number, callback: () => void): Phaser.Time.TimerEvent {
    const timer = this.time.delayedCall(delay, () => {
      const idx = this.sequenceTimers.indexOf(timer);
      if (idx >= 0) this.sequenceTimers.splice(idx, 1);
      callback();
    });
    this.sequenceTimers.push(timer);
    return timer;
  }

  shutdown(): void {
    EventBus.off('PLAYER_DEAD', this.onPlayerDied, this);
    EventBus.off('ENEMY_DEAD', this.onEnemyKilled, this);
    EventBus.off('BOSS_DEAD', this.onBossDied, this);
    EventBus.off('CHECKPOINT');
    EventBus.off('GAME_STATE');
    EventBus.off('LEVEL_UP');
    EventBus.off('SKILL_UNLOCKED');
    EventBus.off('ABILITY_UNLOCKED');
    EventBus.off('EMP_PULSE', this.onEmpPulse, this);
    EventBus.off('EMP_HIT', this.onEmpHit, this);
    EventBus.off('HACK_COMPLETE', this.onHackComplete, this);
    OverlayManager.destroy();
    InputSystem.destroy();
  }
}

export default GameScene;
