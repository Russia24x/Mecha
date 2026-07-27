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
import { BonfireController } from '../../controllers/BonfireController';
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
import { GameOverUI } from '../../ui/gameover/GameOverUI';
import { LoreController } from '../../ui/lore/LoreController';
import { MenuNavHelper } from '../../ui/shared/MenuNavHelper';
import { UIController } from '../../ui/UIController';
import { MenuBuilder } from '../../ui/menu/MenuBuilder';
import { HubBuilder } from '../../ui/hub/HubBuilder';
import { CollisionController, type ExitGatePayload } from '../../controllers/CollisionController';
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
  private killedBossId: string | null = null;  // for victory screen lore
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
  // Bonfire controller (Dark Souls-style save points) — PLAY-only
  // Per advisor: NPC-pattern (distance+prompt+interact via E key), no Matter sensor.
  // Instantiated in buildPlay, cleaned up in cleanupPlay.
  private bonfireController: BonfireController | null = null;
  // Collision dispatch router — PLAY-only
  private collision: CollisionController | null = null;
  // Exit gate transition guard (Phase C). When true, any further onExitGate
  // events are ignored (debounce) until travel completes. Reset in `finally`
  // block of handleExitGate — NOT at end of successful buildPlay — so that
  // early-return on missing area doesn't leave flag stuck true forever.
  // Per advisor round-5 Note 2: buildPlay early-returns on missing area
  // (PlayController.build line 160), so reset must be in finally.
  // Per advisor round-5 (mid-checkpoint note): flag lives in GameScene
  // (NOT in CollisionController) — CollisionController is pure routing.
  private gateTransitioning = false;
  // Debug counter for mid-phase checkpoint verification — counts how many
  // collisionstart events fire when player crosses a gate. Should be 1 per
  // crossing; if >1, debounce is working (extra events ignored) but Matter
  // is firing multiple times as advisor predicted. Will remove after C3
  // verification.
  private exitGateCollisionCount = 0;

  // Pause state — when paused, play is frozen but game loop runs for UI
  private paused = false;
  private lastPauseToggleAt = 0;

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    // Phase 6: async init of ProfileManager + SaveSystem + AutoSaveManager.
    // These must complete before any SaveSystem call, so we defer the rest
    // of create() to createAsync().
    void this.createAsync();
  }

  private async createAsync(): Promise<void> {
    // ── Performance: cap TweenManager tick rate to 60fps ──
    // Per Phaser 4 tweens skill: default is 240fps (4x per render frame).
    // This is overkill for visual tweens and wastes CPU on large worlds.
    // 60fps matches display refresh rate — visually identical, 4x cheaper.
    this.tweens.setFps(60);

    // Init audio
    AudioSystem.init();
    AudioSystem.resume();

    // *** ROOT FIX: Init InputSystem NOW — listeners work from menu onward ***
    // Previously init() was only called by PlayerEntity, leaving menu/hub without keyboard.
    InputSystem.init();

    // Bind OverlayManager to this scene
    OverlayManager.bind(this);

    // ── Phase 6: Profile + Save system init ──
    // Migration: if old localStorage keys exist, migrate them to IndexedDB slot 0.
    // ProfileManager uses dynamic import to avoid circular dependency issues.
    // AutoSaveManager + migrate are small and safe to dynamic import.
    const ProfileManagerModule = await import('../../systems/ProfileManager');
    const ProfileManager = ProfileManagerModule.ProfileManager;
    const autoSaveModule = await import('../../systems/AutoSaveManager');
    const autoSaveManager = autoSaveModule.autoSaveManager;
    const migrateModule = await import('../../systems/migrate');
    const migrateOldSaves = migrateModule.migrateOldSaves;

    await migrateOldSaves();
    await ProfileManager.init();
    await SaveSystem.init();
    autoSaveManager.start();

    // Load settings (now from IndexedDB-backed cache)
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
    EventBus.on('CHECKPOINT', this.onCheckpointSaved, this);
    EventBus.on('BONFIRE_LIT', this.onBonfireLit, this);
    EventBus.on('GAME_STATE', this.onGameStateChanged, this);
    EventBus.on('LEVEL_UP', this.onLevelUp, this);
    EventBus.on('SKILL_UNLOCKED', this.onSkillUnlocked, this);
    EventBus.on('ABILITY_UNLOCKED', this.onAbilityUnlocked, this);
    // ── Ability events ──
    EventBus.on('EMP_PULSE', this.onEmpPulse, this);
    EventBus.on('EMP_HIT', this.onEmpHit, this);
    EventBus.on('HACK_COMPLETE', this.onHackComplete, this);
    EventBus.on('QUEST_UPDATED', this.onQuestUpdated, this);

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
    // NOW show the shared controller — buttons are registered, keyboard can be set up
    if (next !== 'play') {
      OverlayManager.getSharedController()?.show(40);
    }
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
          (areaId: string, bonfireId?: string) => this.fastTravel(areaId, bonfireId),
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

    // *** B8 fix: ESC/B button — single consumption point with priority chain ***
    // ESC sets both kbEdge.pause and kbEdge.back. Previously these were consumed
    // by different consumers in the same frame (overlay close + hub→menu),
    // causing double-action (e.g., Hangar→menu instead of Hangar→hub).
    // Now: one priority chain, early return, no other code reads backPressed/pausePressed.
    //
    // BUT: gamepad B button sets BOTH backPressed AND interactPressed.
    // In gameplay (not paused, no overlay), B should interact (NPC/lore),
    // NOT open pause. So we check interactPressed FIRST in play state.
    if (this.state === 'play' && !this.paused && !OverlayManager.hasOpen && !this.loreController?.isOpen && input.interactPressed) {
      // B button in gameplay → interact (takes priority over backPressed)
      this.tryInteract();
      this.handleDialogueInput(input);
      return;
    }
    if (input.backPressed || input.pausePressed) {
      if (OverlayManager.hasOpen) {
        // Priority 1: overlay open → close it (back navigation)
        InputSystem.setGameplayBlocked(true);
        OverlayManager.handleInput((parent) => {
          if (parent === 'play') {
            this.pauseMenuUI.show();
          } else if (parent === 'hub' || parent === 'menu') {
            OverlayManager.getSharedController()?.show(40);
          }
        });
      } else if (this.loreController?.isOpen) {
        // Priority 2: lore panel open → close it (handles both back+pause internally)
        this.loreController.handleInput(input);
      } else if (this.paused) {
        // Priority 3: pause menu open → resume (via handleNavigation which checks backPressed)
        this.pauseMenuUI.handleNavigation();
      } else if (this.state === 'hub') {
        // Priority 4: in hub → back to menu
        this.setState('menu');
      } else if (this.state === 'play') {
        // Priority 5: in play → open pause
        this.togglePause();
      }
      // Single consumption: return early so no other code reads backPressed/pausePressed this frame
      this.handleDialogueInput(input);
      return;
    }

    // *** Non-back/pause input processing ***
    if (OverlayManager.hasOpen) {
      // Overlay navigation (gamepad/keyboard nav, but NOT back/pause — already consumed above)
      InputSystem.setGameplayBlocked(true);
      OverlayManager.handleInput((parent) => {
        if (parent === 'play') {
          this.pauseMenuUI.show();
        }
      });
      this.handleDialogueInput(input);
      return;
    }

    if (this.state === 'play') {
      // Lore controller (non-back input only — back already handled above)
      this.loreController?.handleInput(input);
      InputSystem.setGameplayBlocked(this.paused);
      if (!this.paused) {
        InputSystem.setGameplayBlocked(false);
        if (input.interactPressed) this.tryInteract();
        if (!this.loreController?.isOpen) {
          this.updatePlay(deltaMs);
        }
      } else {
        this.pauseMenuUI.handleNavigation();
      }
    } else if (this.state === 'menu' || this.state === 'hub' || this.state === 'gameover' || this.state === 'victory') {
      InputSystem.setGameplayBlocked(true);
      OverlayManager.getSharedController()?.update();
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
      onNewGame: () => {
        // NEW GAME: open profile select in "new game" mode (create new profile)
        this.showProfileSelect(true);
      },
      onContinue: () => {
        // CONTINUE: resume the currently-active profile at last checkpoint (skip profile select)
        this.continueCurrentProfile();
      },
      onLoadGame: () => {
        // LOAD GAME: open profile select in "continue" mode (switch to existing profile)
        this.showProfileSelect(false);
      },
      onOpenSettings: () => this.openOverlay('settings'),
    });
    this.menuBuilder.build();
  }

  /**
   * CONTINUE: resume the currently-active profile at its last checkpoint.
   * Called when user clicks CONTINUE (only enabled if there's an active profile with checkpoint).
   */
  private async continueCurrentProfile(): Promise<void> {
    const { CheckpointSystem } = await import('../../world/CheckpointSystem');
    const { WorldSystem } = await import('../../world/WorldSystem');
    const { ProfileManager } = await import('../../systems/ProfileManager');

    // E6 fix: explicitly call SaveSystem.selectSlot() to ensure the cache is
    // loaded from the correct profile slot. Previously this relied on
    // SaveSystem.init() (called in GameScene.create) having loaded the cache
    // from ProfileManager.getCurrentSlotId() — but if GLOBAL_KEY_SELECTED_SLOT
    // in IndexedDB was stale (pointing to a deleted/missing slot), SaveSystem
    // would load defaults (locale='en', empty litBonfires, etc.) instead of
    // the actual profile data. This caused user-facing bugs like wrong locale
    // after CONTINUE.
    //
    // Now we re-read the current slot from ProfileManager and force-load it.
    // This is idempotent — if the cache is already correct, selectSlot just
    // re-reads the same data (small IndexedDB read cost, acceptable for CONTINUE).
    const currentSlot = ProfileManager.getCurrentSlotId();
    if (currentSlot !== null) {
      await SaveSystem.selectSlot(currentSlot);
    }

    if (CheckpointSystem.hasCheckpoint()) {
      CheckpointSystem.init();
      WorldSystem.initFromSave();
      this.setState('play');
    } else {
      // No checkpoint — fall back to hub
      this.setState('hub');
    }
  }

  /**
   * Phase 6: Show the ProfileSelectUI overlay.
   * Called from NEW GAME or CONTINUE menu buttons.
   * @param isNewGame true = user clicked NEW GAME, false = CONTINUE
   */
  private async showProfileSelect(isNewGame: boolean): Promise<void> {
    const { ProfileSelectUI } = await import('../../ui/profile/ProfileSelectUI');
    const { CheckpointSystem } = await import('../../world/CheckpointSystem');
    const { QuestSystem } = await import('../../systems/QuestSystem');
    const { WorldSystem } = await import('../../world/WorldSystem');

    // Hide menu content while profile select is open
    this.menuBuilder?.destroy();
    this.stateContainer!.removeAll(true);
    this.menuNav!.reset();

    const profileUI = new ProfileSelectUI(this, this.menuNav!, {
      onSelect: async (slotId) => {
        // Hide profile select UI first
        profileUI.hide();

        // Switch SaveSystem to the selected slot
        await SaveSystem.selectSlot(slotId);

        if (isNewGame) {
          // Clear save data for this slot, start fresh from hub
          SaveSystem.clear();
          CheckpointSystem.clear();
          QuestSystem.reset();
          QuestSystem.init();
          this.setState('hub');
        } else {
          // CONTINUE: resume at last checkpoint (if any)
          if (CheckpointSystem.hasCheckpoint()) {
            CheckpointSystem.init();
            WorldSystem.initFromSave();
            this.setState('play');
          } else {
            // No checkpoint — fall back to hub
            this.setState('hub');
          }
        }
      },
      onBack: () => {
        // Hide profile select UI first (destroys overlay container)
        profileUI.hide();
        // Rebuild menu from scratch via setState('menu') — this creates a fresh
        // stateContainer + shared UIController + menuNav, avoiding the stale
        // container reference that profileUI.show() left in menuNav.
        this.setState('menu');
      },
    });

    await profileUI.show();
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
    if (!state) {
      // Area not found — save data references a removed/renamed area.
      // Fall back to hub instead of showing a black screen.
      console.warn('[buildPlay] Area not found — falling back to hub. Save data may reference an old area ID.');
      this.hud?.toast(getLocale() === 'fa' ? 'منطقه یافت نشد — بازگشت به هاب' : 'AREA NOT FOUND — returning to hub');
      this.fastTraveling = false;  // reset debounce guard on early-return (Phase D)
      this.setState('hub');
      return;
    }
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
    this.bonfireController = state.bonfireController;
    this.enemies = state.enemies;
    this.projectiles = state.projectiles;
    this.currentSection = state.currentSection;
    this.stageStartTime = state.stageStartTime;
    this.bossArenaActive = false;
    this.miniBossSpawned = false;
    this.sequenceTimers = [];
    // Reset fast-travel debounce guard (Phase D). Set in fastTravel(), cleared here
    // after buildPlay completes. If buildPlay early-returns (missing area), the
    // guard stays true — but setState('hub') fallback in buildPlay handles that
    // case and the next fastTravel attempt will reset it via the early-return path.
    // For robustness, also reset in the early-return path below.
    this.fastTraveling = false;
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
      onExitGate: (gateData: ExitGatePayload) => this.handleExitGate(gateData),
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

  /**
   * Handle exit gate collision — inter-area transition (Phase C, full C3 implementation).
   *
   * Per advisor round-5/6:
   *  - Debounce: gateTransitioning flag lives in GameScene (NOT CollisionController).
   *    First collisionstart → flag=true, subsequent ones ignored until travel completes.
   *  - Reset in `finally` block: even if buildPlay early-returns on missing area
   *    (PlayController.build line 160), the flag is guaranteed to reset.
   *  - BOTH invuln AND gameplayBlocked (per advisor round-7 Note 1):
   *    * setGameplayBlocked(true) blocks player INPUT (can't move/fire/interact).
   *    * invulnUntil = now + 600 blocks DAMAGE (enemies still move per physics not paused).
   *    * These are COMPLEMENTARY, not substitutes — gameplayBlocked alone would make
   *      the player MORE vulnerable (can't dodge) since enemies can still hit.
   *  - Event-driven sequencing (per advisor round-6 Q1, BLOCKER):
   *    * camera.once(FADE_OUT_COMPLETE) — NOT synchronous. World destruction only
   *      after screen fully black. Prevents frame overlap between old/new worlds.
   *  - Error recovery (per advisor round-7 Note 2):
   *    * catch block forces camera.fadeIn even if buildPlay throws — prevents
   *      permanent black screen. Logs error + shows toast for visibility.
   *    * Matches AutoSaveManager pattern (try/catch with error handling, not raw throw).
   *  - preLit policy enforcement: SaveSystem.lightBonfire(getEntryBonfireId(toAreaId))
   *    auto-lights destination's entry bonfire (isEntryPoint flag, not naming convention).
   */
  private handleExitGate(gateData: ExitGatePayload): void {
    // ── Debounce guard ──
    if (this.gateTransitioning) {
      // Extra event during fade window — Matter fired multiple times as
      // advisor predicted (physics not paused during fade). Ignored.
      this.exitGateCollisionCount++;
      console.log(`[ExitGate] DEBOUNCE: ignored extra collision #${this.exitGateCollisionCount} for gate ${gateData.id} (gateTransitioning=true)`);
      return;
    }
    this.gateTransitioning = true;
    this.exitGateCollisionCount = 1;
    console.log(`[ExitGate] CROSSED gate ${gateData.id} → area ${gateData.toAreaId} section ${gateData.toSection}`);

    // ── Pre-fade setup (synchronous, before fade starts) ──
    // 1. Block player INPUT — prevents interact with bonfire/another gate during fade.
    InputSystem.setGameplayBlocked(true);
    // 2. Temp invuln (600ms = 500ms fade + 100ms buffer) — prevents PLAYER_DEAD during
    //    fade window. Matter physics NOT paused, so enemies still move + can hit player.
    //    gameplayBlocked alone makes player MORE vulnerable (can't dodge), so BOTH needed.
    //    Uses extendInvuln (Math.max) so it never shortens an existing invuln window.
    if (this.player && this.player.sprite?.active) {
      this.player.extendInvuln(600);
    }
    // 3. Play gate_travel SFX (C5 added this to SFX_REGISTRY before C3, so it exists).
    AudioSystem.play('gate_travel');
    // 4. Start fade telegraph — screen fades to black over 500ms.
    this.cameras.main.fadeOut(500, 5, 7, 13);

    // ── Event-driven sequencing: world swap only after screen fully black ──
    // Per advisor round-6 Q1: synchronous execution would defeat telegraph purpose
    // (scene change instant, just black layer on top). FADE_OUT_COMPLETE fires only
    // after screen is fully black, so player never sees half-built scene.
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      try {
        // Travel to destination area (updates WorldSystem.current).
        // travelTo returns false on failure (area not found / locked / ability-gated)
        // — does NOT throw. We treat false as an error for recovery purposes.
        const traveled = WorldSystem.travelTo(gateData.toAreaId, gateData.toSection);
        if (!traveled) {
          throw new Error(`WorldSystem.travelTo failed for area ${gateData.toAreaId} — area not found, locked, or ability-gated`);
        }

        // preLit policy enforcement: auto-light destination's entry bonfire.
        // Identified by isEntryPoint flag (NOT naming convention bf_X_1).
        const entryBonfireId = WorldSystem.getEntryBonfireId(gateData.toAreaId);
        if (entryBonfireId) {
          SaveSystem.lightBonfire(entryBonfireId);
          console.log(`[ExitGate] Lit entry bonfire ${entryBonfireId} in ${gateData.toAreaId}`);
        } else {
          // Data error — every area should have exactly one isEntryPoint bonfire.
          // Not fatal (player can still travel), but log for debugging.
          console.warn(`[ExitGate] No entry bonfire (isEntryPoint=true) found in ${gateData.toAreaId} — preLit policy not enforced`);
        }

        // Set player spawn position for the new area (from gate data).
        // cleanupPlay + buildPlay will use CheckpointSystem.getRespawnPosition,
        // but we override with the gate's toX/toY for precise placement.
        // Done by setting checkpoint before buildPlay.
        const loc = WorldSystem.getCurrent();
        SaveSystem.saveCheckpoint({
          actId: loc.actId,
          regionId: loc.regionId,
          areaId: loc.areaId,
          section: gateData.toSection,
          x: gateData.toX,
          y: gateData.toY,
          timestamp: Date.now(),
        });

        // Destroy old world + build new one.
        this.cleanupPlay();
        this.setState('play');  // triggers buildPlay via state machine

        // Fade back in on the new scene.
        this.cameras.main.fadeIn(300, 5, 7, 13);
        console.log(`[ExitGate] Travel complete: now in ${gateData.toAreaId}`);
      } catch (err) {
        // ── Error recovery (per advisor round-7 Note 2) ──
        // If buildPlay throws (e.g., area data corrupted) or travelTo failed,
        // we MUST force fadeIn — otherwise screen stays black forever while
        // player input is unblocked (finally ran), giving appearance of crash.
        // Matches AutoSaveManager pattern: try/catch with error handling,
        // not raw throw.
        console.error('[ExitGate] Travel FAILED — recovering:', err);
        this.cameras.main.fadeIn(300, 5, 7, 13);
        const errMsg = err instanceof Error ? err.message : String(err);
        this.hud?.toast(`[GATE ERROR] ${errMsg.slice(0, 60)}`);
        // Note: we do NOT rethrow — finally will reset state, player keeps playing
        // in the current (old) area. The gate is now blocked (gateTransitioning
        // reset in finally) so player can try again or quit to hub.
      } finally {
        // ── Guaranteed reset (per advisor round-5 Note 2) ──
        // Even if travelTo threw, buildPlay early-returned, or any other error
        // occurred, these resets MUST happen — otherwise game is stuck.
        this.gateTransitioning = false;
        InputSystem.setGameplayBlocked(false);
        this.exitGateCollisionCount = 0;
        console.log('[ExitGate] gateTransitioning reset to false (finally)');
      }
    });
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
    // Find the enemy entity to check if hacked + get damage from data
    const enemy = this.enemies.find(e => e.id === id);
    if (enemy?.hacked) return;  // Hacked enemies don't damage the player
    // N7 fix: use EnemyData.damage instead of hardcoded ID prefix lookup
    const dmg = enemy?.data?.damage ?? 10;
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
    // ── Wire: Bonfire interaction (Dark Souls-style rest) ──
    // Per advisor: use interactPressed (instant), NOT heldInteract — bonfire
    // has no progress-bar or duration channel. BonfireController.tryInteract
    // returns true if interaction occurred (so we short-circuit).
    // NOTE: this branch runs AFTER NPC and Lore — priority chain is
    // NPC > Lore > Bonfire. If a bonfire is placed near an NPC/Lore, the
    // NPC/Lore wins. This matches the unified nearest-check in
    // NpcInteractionController.updatePrompt (visual prompt), so the
    // prompt shown and the action triggered are always consistent.
    if (this.loadedArea && this.bonfireController) {
      const interacted = this.bonfireController.tryInteract(this.loadedArea, this.player);
      if (interacted) return;
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
      bonfireController: this.bonfireController,
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
    this.bonfireController = null;
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
      // Phantom jump fix: clear keyboard edges that were set during pause
      // (e.g., Space sets kbEdge.jump during pause, which would cause
      // player to jump on the next frame after unpause)
      InputSystem.clearKbEdges();
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

  /**
   * Fast-travel to a destination area (from World Map or Hub).
   *
   * Phase D extension: optional `bonfireId` parameter — when provided,
   * player spawns at the bonfire's exact position (not section-start fallback).
   * WorldSystem.travelTo handles validation (bonfire exists + is lit) and
   * saves the checkpoint at bonfire position.
   *
   * Per advisor round-9 Note 2 (debounce): fastTravelInProgress guard prevents
   * double-click on World Map node from triggering two travelTo+buildPlay
   * cycles simultaneously. Same class of bug as gateTransitioning (Phase C).
   * Reset to false after buildPlay completes (in setState('play') path).
   */
  private fastTraveling = false;
  private fastTravel(areaId: string, bonfireId?: string): void {
    // Debounce guard — prevent double-click from triggering concurrent travels.
    if (this.fastTraveling) {
      console.log('[fastTravel] DEBOUNCE: already traveling, ignored');
      return;
    }
    this.fastTraveling = true;

    const traveled = WorldSystem.travelTo(areaId, 1, bonfireId);
    if (!traveled) {
      this.fastTraveling = false;  // reset on failure
      this.hud?.toast(getLocale() === 'fa' ? 'سفر ممکن نیست' : 'TRAVEL FAILED');
      return;
    }
    OverlayManager.closeAll();
    this.paused = false;
    this.pauseMenuUI.hide();
    this.cleanupPlay();
    this.setState('play');  // triggers buildPlay
    // fastTraveling reset in buildPlay completion (see buildPlay end).
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
    this.killedBossId = data.id;  // store for victory screen lore
    // Unlock boss-gated weapons (plasma_cannon on boss_1, energy_blade on boss_2)
    if (data.id === 'guardian_ax09' && !SaveSystem.isWeaponUnlocked('plasma_cannon')) {
      SaveSystem.unlockWeapon('plasma_cannon');
      EventBus.emit('WEAPON_UNLOCKED', { weaponId: 'plasma_cannon' });
      this.hud?.toast(getLocale() === 'fa' ? 'سلاح جدید: توپ پلاسما' : 'NEW WEAPON: Plasma Cannon');
    }
    if (data.id === 'neural_overseer' && !SaveSystem.isWeaponUnlocked('energy_blade')) {
      SaveSystem.unlockWeapon('energy_blade');
      EventBus.emit('WEAPON_UNLOCKED', { weaponId: 'energy_blade' });
      this.hud?.toast(getLocale() === 'fa' ? 'سلاح جدید: تیغ انرژی' : 'NEW WEAPON: Energy Blade');
    }
    // Act II boss: Leviathan Hulk → unlock laser
    if (data.id === 'leviathan_hulk' && !SaveSystem.isWeaponUnlocked('laser')) {
      SaveSystem.unlockWeapon('laser');
      EventBus.emit('WEAPON_UNLOCKED', { weaponId: 'laser' });
      this.hud?.toast(getLocale() === 'fa' ? 'سلاح جدید: لیزر' : 'NEW WEAPON: Laser');
    }
    // Act III boss: Iron Magistrate → unlock military_green paint
    if (data.id === 'iron_magistrate') {
      if (!SaveSystem.getPlayer().unlockedPaints.includes('military_green')) {
        SaveSystem.unlockPaint('military_green');
        EventBus.emit('PAINT_UNLOCKED', { paintId: 'military_green' });
        this.hud?.toast(getLocale() === 'fa' ? 'رنگ جدید: سبز نظامی' : 'NEW PAINT: Military Green');
      }
    }
    // Act I boss: Guardian AX-09 → unlock Act II (Drowned Wastes)
    if (data.id === 'guardian_ax09') {
      SaveSystem.unlockArea('drowned_wastes_1');
      this.hud?.toast(getLocale() === 'fa' ? 'منطقه جدید: باتلاق غرق‌شده' : 'NEW AREA: The Drowned Wastes');
    }
    // Act II boss: Leviathan Hulk → unlock Act III (all 3 areas at once)
    // Player can freely travel between areas via hub.
    // Border gate can be added later as visual element.
    if (data.id === 'leviathan_hulk') {
      SaveSystem.unlockArea('act3_ward_1');
      SaveSystem.unlockArea('act3_ward_2');
      SaveSystem.unlockArea('act3_courthouse');
      this.hud?.toast(getLocale() === 'fa' ? 'منطقه جدید: آخرین شهر' : 'NEW AREA: The Last City');
    }
    // Act III boss: Iron Magistrate → unlock Act IV (Silent Canopy / Toxic Forest)
    if (data.id === 'iron_magistrate') {
      SaveSystem.unlockArea('toxic_forest');
      this.hud?.toast(getLocale() === 'fa' ? 'منطقه جدید: سایه‌آرام' : 'NEW AREA: The Silent Canopy');
    }
    // Act IV boss: Neural Overseer → unlock Act V (Orbital Descent)
    if (data.id === 'neural_overseer') {
      SaveSystem.unlockArea('orbital_station_1');
      this.hud?.toast(getLocale() === 'fa' ? 'منطقه جدید: فرود مداری' : 'NEW AREA: Orbital Descent');
    }
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
      // Destroy caption when transitioning to victory (prevents it persisting on screen)
      this.sequenceTimers.push(this.time.delayedCall(4200, () => { caption.destroy(); }));

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
  private onLevelUp = (): void => {
    this.hud?.toast(t('levelup'));
  };

  private onSkillUnlocked = (): void => {
    this.player?.refreshStats();
  };

  private onAbilityUnlocked = (): void => {
    this.player?.refreshStats();
  };

  private onCheckpointSaved = (): void => {
    this.hud?.toast(t('checkpoint.saved'));
    // Refill repair kit charges at checkpoint
    this.player?.refillRepair();
  };

  /**
   * BONFIRE_LIT event handler — shows the localized bonfire toast.
   * The actual save/heal/light logic happens in BonfireController.tryInteract;
   * this handler just displays the toast. We do NOT call refillRepair() here
   * (already called by BonfireController.tryInteract before emitting).
   * We do NOT call SaveSystem.saveCheckpoint() here either — BonfireController
   * already calls CheckpointSystem.activate() + SaveSystem.saveCheckpoint()
   * with the bonfire's exact position, which is more specific than the
   * section-based default.
   *
   * Note: CheckpointSystem.activate() also emits 'CHECKPOINT' which triggers
   * onCheckpointSaved above, showing "Checkpoint reached. Repair kit refilled."
   * The bonfire toast will overwrite that text (since hud.toast() kills the
   * previous tween + sets new text). The player sees the bonfire message.
   */
  private onBonfireLit = (p: unknown): void => {
    const data = p as { bonfireId?: string; message?: string; wasAlreadyLit?: boolean };
    if (data.message) this.hud?.toast(data.message);
  };

  private onGameStateChanged = (p: unknown): void => {
    const data = p as { sectionName?: string };
    if (data.sectionName) this.hud?.setSection(data.sectionName);
  };

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

  private onQuestUpdated = (payload: unknown): void => {
    const data = payload as { questId: string; status: string };
    const isFa = getLocale() === 'fa';
    if (data.status === 'active') {
      this.hud?.toast(isFa ? '▶ ماموریت جدید فعال شد' : '▶ NEW MISSION ACTIVE');
      AudioSystem.play('uiClick');
    } else if (data.status === 'completed') {
      this.hud?.toast(isFa ? '✓ ماموریت کامل شد — برای پاداش برگردید' : '✓ MISSION COMPLETE — Return to turn in');
      AudioSystem.play('skillUnlock');
    } else if (data.status === 'turned_in') {
      this.hud?.toast(isFa ? '★ ماموریت تحویل داده شد' : '★ MISSION TURNED IN');
      AudioSystem.play('uiClick');
    }
  };

  // ================ GAMEOVER / VICTORY ================

  private buildGameOver(): void {
    // Delegate to standalone GameOverUI component (extracted from GameScene
    // for separation of concerns + easier UX iteration).
    //
    // CRITICAL DESIGN DECISION (per DESIGN_PILLARS "Punishing but fair"):
    //   RETRY must NOT call CheckpointSystem.clear(). The -50% XP death
    //   penalty (applied in onPlayerDied) is already the punishment. Forcing
    //   the player to replay from area start on top of that is double
    //   jeopardy. CheckpointSystem.getRespawnPosition() already falls back
    //   to area start (200, 420) when no checkpoint exists, so this is safe.
    const ui = new GameOverUI(this, {
      container: this.stateContainer!,
      menuNav: this.menuNav!,
      lostXp: this.lastLostXp,
      hasCheckpoint: CheckpointSystem.hasCheckpoint(),
      callbacks: {
        onRetry: () => this.setState('play'),
        onQuit: () => this.setState('menu'),
      },
    });
    ui.build();
  }

  private async buildVictory(): Promise<void> {
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
    // Boss lore — use the actual boss data (not LoreSystem which may not have all bosses)
    const bossData = this.killedBossId
      ? (await import('../../data/bosses/bosses')).getBoss(this.killedBossId)
      : null;
    if (bossData?.lore) {
      const lines = bossData.lore.map(key => t(key));
      c.add(this.add.text(w / 2, h * 0.5, lines, fixTextStyle({
        fontFamily: 'monospace', fontSize: '14px', color: '#a0a0a0', align: 'center', lineSpacing: 6,
      })).setOrigin(0.5).setDepth(1));
    }
    // Atlas quote — per boss (Persian-aware)
    const bossQuotes: Record<string, { en: string; fa: string }> = {
      guardian_ax09: { en: '"Atlas never stopped waiting."', fa: '"اطلس هرگز منتظر ماند."' },
      neural_overseer: { en: '"It watched over a forest that forgot it was watching."', fa: '"او بر جنگلی نظارت می‌کرد که فراموش کرده بود نظارت می‌شود."' },
      leviathan_hulk: { en: '"She protected a city that no longer exists."', fa: '"او شهری را محافظت می‌کرد که دیگر وجود ندارد."' },
      iron_magistrate: { en: '"He judged the living and the dead with the same blind eye."', fa: '"او زندگان و مردگان را با همان چشم کور قضاوت می‌کرد."' },
    };
    const quote = bossQuotes[this.killedBossId ?? ''] ?? bossQuotes.guardian_ax09;
    const atlasQuote = getLocale() === 'fa' ? quote.fa : quote.en;
    c.add(this.add.text(w / 2, h * 0.68, atlasQuote, fixTextStyle({
      fontFamily: 'monospace', fontSize: '16px', color: '#39d0d8', stroke: '#000', strokeThickness: 4, fontStyle: 'italic',
    })).setOrigin(0.5).setDepth(1));
    // ── Return to HUB (not menu) — per user: after victory, go to hub to prepare for next stage ──
    // Stats line
    const statsLine = getLocale() === 'fa'
      ? `سطح ${ExperienceSystem.getLevel()}  |  ${SaveSystem.getPlayer().totalKills} کشته`
      : `LV.${ExperienceSystem.getLevel()}  |  ${SaveSystem.getPlayer().totalKills} kills`;
    c.add(this.add.text(w / 2, h * 0.62, statsLine, fixTextStyle({
      fontFamily: 'monospace', fontSize: '12px', color: '#5a6470',
    })).setOrigin(0.5).setDepth(1));
    const returnLabel = getLocale() === 'fa' ? 'بازگشت به هاب' : t('victory.return');
    this.menuNav!.makeMenuBtn(w / 2, h * 0.82, returnLabel, () => {
      AudioSystem.play('uiClick');
      this.setState('hub');
    });
    // setupNav removed — UIController handles keyboard
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
    // Phase 6: stop AutoSaveManager + flush pending dirty state
    void import('../../systems/AutoSaveManager').then(({ autoSaveManager }) => {
      void autoSaveManager.stop();
    });
    EventBus.off('PLAYER_DEAD', this.onPlayerDied, this);
    EventBus.off('ENEMY_DEAD', this.onEnemyKilled, this);
    EventBus.off('BOSS_DEAD', this.onBossDied, this);
    EventBus.off('CHECKPOINT', this.onCheckpointSaved, this);
    EventBus.off('BONFIRE_LIT', this.onBonfireLit, this);
    EventBus.off('GAME_STATE', this.onGameStateChanged, this);
    EventBus.off('LEVEL_UP', this.onLevelUp, this);
    EventBus.off('SKILL_UNLOCKED', this.onSkillUnlocked, this);
    EventBus.off('ABILITY_UNLOCKED', this.onAbilityUnlocked, this);
    EventBus.off('EMP_PULSE', this.onEmpPulse, this);
    EventBus.off('EMP_HIT', this.onEmpHit, this);
    EventBus.off('HACK_COMPLETE', this.onHackComplete, this);
    EventBus.off('QUEST_UPDATED', this.onQuestUpdated, this);
    OverlayManager.destroy();
    InputSystem.destroy();
  }
}

export default GameScene;
