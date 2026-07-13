/**
 * MECHA: LAST PROTOCOL — GameScene v3.1
 *
 * ARCHITECTURE (v3.1 — root-cause fix for overlay navigation):
 * - Main states: menu | hub | play | gameover | victory
 * - Overlays (settings/skills/inventory/quests/map) managed by OverlayManager
 *   as a STACK — NOT as states. Opening/closing overlays never rebuilds play.
 * - Pause is a boolean flag (not a state). When paused, play update is skipped.
 * - InputSystem.init() called in create() — listeners work from menu onward.
 * - ESC sets both pausePressed AND backPressed — works as "back" in overlays,
 *   "pause" in play, "quit to menu" in hub.
 * - Gamepad nav works everywhere via handleMenuGamepadNav + OverlayManager.handleInput.
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
import { CheckpointSystem } from '../../world/CheckpointSystem';
import { PlayerEntity } from '../../entities/player/PlayerEntity';
import { EnemyEntity, resetEnemyIds } from '../../entities/enemies/EnemyEntity';
import { BossEntity } from '../../entities/boss/BossEntity';
import { Projectile } from '../../entities/combat/Projectile';
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
import { ParallaxBackground } from '../../world/atmosphere/ParallaxBackground';
import { AtmosphereSystem } from '../../world/atmosphere/AtmosphereSystem';
import { ForestEnvironmentSystem } from '../../world/atmosphere/ForestEnvironmentSystem';
import { MechaSpriteFactory, type MechVisualHandle } from '../../entities/sprites/MechaSpriteFactory';
import { CompanionEntity } from '../../entities/companion/CompanionEntity';
import { GamepadManager } from '../../shared/GamepadManager';
import { InputSchemeManager } from '../../systems/InputSchemeManager';
import type { EnemyTypeId } from '../../data/types';

type GameState = 'menu' | 'hub' | 'play' | 'gameover' | 'victory';

/** A focusable button for gamepad/keyboard navigation. */
interface Focusable {
  bg: Phaser.GameObjects.Shape;   // Rectangle or Arc
  text: Phaser.GameObjects.Text;
  onSelect: () => void;
}

export class GameScene extends Phaser.Scene {
  private state: GameState = 'menu';
  private stateContainer: Phaser.GameObjects.Container | null = null;
  private menuButtons: Focusable[] = [];
  private menuFocusIndex = 0;
  private menuNavHandler: ((e: KeyboardEvent) => void) | null = null;

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
  private lorePanel: Phaser.GameObjects.Container | null = null;
  private bossHealthBar: Phaser.GameObjects.Container | null = null;
  private bossHealthFill: Phaser.GameObjects.Rectangle | null = null;
  private bossNameText: Phaser.GameObjects.Text | null = null;

  // Atmosphere + Parallax + NPCs (PLAY-only — never leak to hub/menu)
  private parallax: ParallaxBackground | null = null;
  private atmosphere: AtmosphereSystem | null = null;
  private npcVisuals: Map<string, MechVisualHandle> = new Map();
  private npcLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private npcInteractionPrompt: Phaser.GameObjects.Container | null = null;
  // Phase 3: Death penalty tracking
  private lastLostXp = 0;
  // ── FIX Bug 5: Throttle for locked collectible toast ──
  private _lastLockedToastAt = 0;
  // Companion entity (Protocol Echo — follows player)
  private companion: CompanionEntity | null = null;
  // Forest environment (grass/trees/vines/water/rain — forest region only)
  private forestEnv: ForestEnvironmentSystem | null = null;

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

    this.setState('menu');
  }

  // ================ STATE MACHINE ================

  private setState(next: GameState): void {
    // Cleanup previous state
    this.cleanupState();
    this.state = next;
    this.menuButtons = [];
    this.menuFocusIndex = 0;
    this.stateContainer = this.add.container(0, 0).setDepth(50);
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
    if (this.menuNavHandler) {
      window.removeEventListener('keydown', this.menuNavHandler);
      this.menuNavHandler = null;
    }
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
      }
      // If parent === 'hub', hub is still visible underneath — nothing to do
    });
  }

  // ================ UPDATE LOOP ================

  update(_time: number, deltaMs: number): void {
    InputSystem.update();
    InputSchemeManager.update();  // dynamic scheme detection (KB / Xbox / PS)
    const input = InputSystem.getState();

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
      // ESC / Start = toggle pause
      if (input.pausePressed) {
        this.togglePause();
      }
      if (!this.paused) {
        if (input.interactPressed) this.tryInteract();
        // Freeze game while lore panel is open
        if (!this.lorePanel) {
          this.updatePlay(deltaMs);
        }
      } else {
        // Paused — handle pause menu navigation
        this.pauseMenuUI.handleNavigation();
      }
    } else if (this.state === 'menu' || this.state === 'hub' || this.state === 'gameover' || this.state === 'victory') {
      // Gamepad + keyboard navigation
      this.handleMenuGamepadNav(input);
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
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;

    // === Background: starry night sky ===
    const bg = this.add.graphics();
    bg.setDepth(0);
    bg.fillStyle(0x040814, 1);
    bg.fillRect(0, 0, w, h);
    for (let r = 500; r > 0; r -= 30) {
      bg.fillStyle(0x0a1228, 0.02);
      bg.fillCircle(w / 2, h * 0.35, r);
    }
    c.add(bg);

    // Stars — 120 twinkling, drifting dots
    for (let i = 0; i < 120; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h * 0.75;
      const size = 0.5 + Math.random() * 2;
      const brightness = 0.2 + Math.random() * 0.8;
      const starColor = Math.random() < 0.15 ? 0xffe0a0 : Math.random() < 0.3 ? 0xa0c0ff : 0xc0e0ff;
      const star = this.add.circle(sx, sy, size, starColor, brightness);
      star.setDepth(1);
      c.add(star);
      this.tweens.add({
        targets: star,
        alpha: { from: brightness * 0.1, to: brightness },
        scale: { from: size * 0.5, to: size * 1.2 },
        duration: 600 + Math.random() * 2500,
        yoyo: true, repeat: -1,
        delay: Math.random() * 3000,
        ease: 'Sine.inOut',
      });
      this.tweens.add({
        targets: star,
        x: sx + (Math.random() - 0.5) * 30,
        y: sy + (Math.random() - 0.5) * 20,
        duration: 5000 + Math.random() * 8000,
        yoyo: true, repeat: -1,
        ease: 'Sine.inOut',
      });
    }

    // Shooting stars
    const shootingStarFunc = () => {
      const ss = this.add.rectangle(0, 0, 40 + Math.random() * 30, 1.5, 0xffffff, 0.9);
      ss.setBlendMode(Phaser.BlendModes.ADD);
      ss.setDepth(1);
      ss.setOrigin(0, 0.5);
      ss.setRotation(0.3 + Math.random() * 0.2);
      c.add(ss);
      const startX = Math.random() * w * 0.7;
      const startY = Math.random() * h * 0.3;
      const endX = startX + 300 + Math.random() * 200;
      const endY = startY + 120 + Math.random() * 80;
      this.tweens.add({
        targets: ss,
        x: endX, y: endY,
        alpha: { from: 0.9, to: 0 },
        duration: 600 + Math.random() * 400,
        onComplete: () => ss.destroy(),
      });
    };
    this.time.addEvent({
      delay: 3000, loop: true,
      callback: () => { if (Math.random() < 0.4) shootingStarFunc(); },
    });

    // Brighter "beacon" stars with pulsing glow
    for (let i = 0; i < 8; i++) {
      const bx = Math.random() * w;
      const by = Math.random() * h * 0.55;
      const beaconColor = [0xffffff, 0x80a0ff, 0xffd0a0, 0xa0ffff][Math.floor(Math.random() * 4)];
      const beacon = this.add.circle(bx, by, 2 + Math.random(), beaconColor, 1);
      beacon.setDepth(1); beacon.setBlendMode(Phaser.BlendModes.ADD);
      c.add(beacon);
      const beaconGlow = this.add.circle(bx, by, 10 + Math.random() * 6, beaconColor, 0.12);
      beaconGlow.setDepth(1); beaconGlow.setBlendMode(Phaser.BlendModes.ADD);
      c.add(beaconGlow);
      this.tweens.add({
        targets: beaconGlow,
        alpha: { from: 0.05, to: 0.25 },
        scale: { from: 0.7, to: 1.3 },
        duration: 1200 + Math.random() * 2000,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
      this.tweens.add({
        targets: beacon,
        alpha: { from: 0.6, to: 1 },
        duration: 800 + Math.random() * 1200,
        yoyo: true, repeat: -1,
      });
    }

    // === Title: MECHA (very large) ===
    const titleY = h * 0.3;
    const glow = this.add.circle(w / 2, titleY, 250, 0x39d0d8, 0.05);
    glow.setBlendMode(Phaser.BlendModes.ADD); glow.setDepth(2);
    c.add(glow);
    this.tweens.add({ targets: glow, alpha: { from: 0.03, to: 0.08 }, duration: 3000, yoyo: true, repeat: -1 });

    const mechaText = this.add.text(w / 2, titleY, 'MECHA', {
      fontFamily: 'monospace', fontSize: '96px', color: '#39d0d8',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(3);
    c.add(mechaText);

    const protocolText = this.add.text(w / 2, titleY + 65, 'LAST PROTOCOL', {
      fontFamily: 'monospace', fontSize: '22px', color: '#e0e8f0',
      stroke: '#000', strokeThickness: 3, letterSpacing: 4,
    }).setOrigin(0.5).setDepth(3);
    c.add(protocolText);
    this.tweens.add({ targets: protocolText, alpha: { from: 0.6, to: 1 }, duration: 2500, yoyo: true, repeat: -1 });

    // === Small minimal buttons ===
    const btnY = h * 0.6;
    const btnGap = 48;
    this.makeMenuBtn(w / 2, btnY, t('menu.start'), () => { AudioSystem.play('uiClick'); this.setState('hub'); });
    this.makeMenuBtn(w / 2, btnY + btnGap, t('menu.continue'), () => {
      AudioSystem.play('uiClick');
      if (CheckpointSystem.hasCheckpoint()) {
        CheckpointSystem.init();
        WorldSystem.initFromSave();
        this.setState('hub');
      }
    }, !SaveSystem.hasCheckpoint());
    this.makeMenuBtn(w / 2, btnY + btnGap * 2, t('menu.settings'), () => { AudioSystem.play('uiClick'); this.openOverlay('settings'); });
    this.makeMenuBtn(w / 2, btnY + btnGap * 3, t('menu.how_to_play'), () => { AudioSystem.play('uiClick'); this.showHowToPlay(); });

    // === Footer ===
    c.add(this.add.text(w / 2, h - 25, t('game.version') + '  ·  PHASER 4.2 · MATTER.JS', {
      fontFamily: 'monospace', fontSize: '9px', color: '#0a1220',
    }).setOrigin(0.5).setDepth(3));

    this.setupMenuNav();
  }

  // ================ HUB (World Map + Menu Access) ================

  private buildHub(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';
    const L = (en: string, fa: string) => isFa ? fa : en;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0e1a, 1);
    bg.fillRect(0, 0, w, h);
    for (let r = 400; r > 0; r -= 25) {
      bg.fillStyle(0x101828, 0.025);
      bg.fillCircle(w / 2, h * 0.45, r);
    }
    bg.setDepth(0);
    c.add(bg);

    // === Top bar: Title + Player stats (improved UI) ===
    const headerBg = this.add.rectangle(w / 2, 30, w - 40, 44, 0x0a0d14, 0.8);
    headerBg.setStrokeStyle(1, 0x1a3040, 0.5);
    headerBg.setDepth(1);
    c.add(headerBg);

    // Title with accent bracket
    const titleText = isFa ? 'انتخاب ماموریت' : 'MISSION SELECT';
    c.add(this.add.text(40, 30, `▸ ${titleText}`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '16px', color: '#39d0d8', letterSpacing: 2,
    })).setOrigin(0, 0.5).setDepth(2));

    // Player stats (right side) — level + XP bar + skill points
    const save = SaveSystem.getPlayer();
    const xpNeeded = ExperienceSystem.xpForLevel(save.level);
    const xpPct = Math.min(1, save.xp / xpNeeded);
    // Level badge
    c.add(this.add.text(w - 280, 20, isFa ? `سطح ${save.level}` : `LV.${save.level}`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: '#40ff80', stroke: '#000', strokeThickness: 2,
    })).setOrigin(0, 0.5).setDepth(2));
    // XP bar background
    c.add(this.add.rectangle(w - 200, 26, 100, 6, 0x05080c, 1).setStrokeStyle(1, 0x1a3040, 0.6).setOrigin(0, 0.5).setDepth(2));
    // XP bar fill
    c.add(this.add.rectangle(w - 199, 26, 98 * xpPct, 4, 0xffc040, 1).setOrigin(0, 0.5).setDepth(2));
    // XP text
    c.add(this.add.text(w - 200, 36, `${save.xp}/${xpNeeded}`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '8px', color: '#5a6470',
    })).setOrigin(0, 0.5).setDepth(2));
    // Skill points badge
    const spLabel = isFa ? `◆ ${save.skillPoints}` : `◆${save.skillPoints}`;
    c.add(this.add.text(w - 90, 30, spLabel, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: save.skillPoints > 0 ? '#ffc040' : '#3a4350', stroke: '#000', strokeThickness: 2,
    })).setOrigin(0.5).setDepth(2));
    // Kills
    const killsLabel = isFa ? `☠ ${save.totalKills}` : `☠${save.totalKills}`;
    c.add(this.add.text(w - 45, 30, killsLabel, fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: '#5a6470', stroke: '#000', strokeThickness: 2,
    })).setOrigin(0.5).setDepth(2));

    // === Act-based world map ===
    // Layout: horizontal scrollable columns, one per Act.
    // Each Act column has: Act title + 3 area cards stacked vertically.
    const tree = WorldMapSystem.getMapTree();

    // ── Collect all acts with their areas ──
    const actData: {
      actId: number;
      actName: string;
      areas: { areaId: string; nameKey: string; unlocked: boolean; isCurrent: boolean; bossDefeated: boolean; hasBoss: boolean; regionId: string }[];
    }[] = [];
    for (const act of tree) {
      const actAreas: { areaId: string; nameKey: string; unlocked: boolean; isCurrent: boolean; bossDefeated: boolean; hasBoss: boolean; regionId: string }[] = [];
      for (const regionData of act.regions) {
        for (const node of regionData.nodes) {
          actAreas.push({
            areaId: node.area.id,
            nameKey: node.area.nameKey,
            unlocked: node.unlocked,
            isCurrent: node.isCurrent,
            bossDefeated: node.bossDefeated,
            hasBoss: node.hasBoss,
            regionId: node.area.regionId,
          });
        }
      }
      actData.push({
        actId: act.act.id,
        actName: t(act.act.nameKey),
        areas: actAreas,
      });
    }

    // ── Layout: Act columns side by side ──
    const cardW = 200;
    const cardH = 180;
    const cardGap = 12;
    const actGap = 28;
    const actTitleH = 36;
    const actsToShow = actData.filter(a => a.areas.length > 0);
    const totalW = actsToShow.length * cardW + (actsToShow.length - 1) * actGap;
    const startX = (w - totalW) / 2 + cardW / 2;
    const baseY = 110;

    actsToShow.forEach((act, actIdx) => {
      const actX = startX + actIdx * (cardW + actGap);
      const hasUnlocked = act.areas.some(a => a.unlocked);

      // ── Act title bar ──
      const actTitleH2 = 44;
      const actTitleBg = this.add.rectangle(actX, baseY, cardW, actTitleH2, hasUnlocked ? 0x0d1820 : 0x05080c, 0.95);
      actTitleBg.setStrokeStyle(2, hasUnlocked ? 0x39d0d8 : 0x1a3040, hasUnlocked ? 0.8 : 0.4);
      actTitleBg.setDepth(2);
      c.add(actTitleBg);
      const romanNum = ['I', 'II', 'III', 'IV', 'V'][act.actId - 1] || String(act.actId);
      // ACT number — bigger + brighter
      c.add(this.add.text(actX, baseY - 8, `ACT ${romanNum}`, fixTextStyle({
        fontFamily: 'monospace', fontSize: '14px', color: hasUnlocked ? '#66f0ff' : '#3a4350',
        stroke: '#000', strokeThickness: 3, letterSpacing: 3,
      })).setOrigin(0.5).setDepth(3));
      // Act name — bigger + brighter
      c.add(this.add.text(actX, baseY + 10, act.actName, fixTextStyle({
        fontFamily: 'monospace', fontSize: '10px',
        color: hasUnlocked ? '#cfd6e0' : '#2a3040',
        stroke: '#000', strokeThickness: 2,
        wordWrap: { width: cardW - 16 }, align: 'center',
      })).setOrigin(0.5).setDepth(3));

      // ── Area cards inside this Act (stacked vertically) ──
      act.areas.forEach((area, areaIdx) => {
        const cardY = baseY + actTitleH + 20 + areaIdx * (cardH + cardGap) + cardH / 2;
        const previewH = 80;
        const previewW = cardW - 16;
        const previewY = cardY - cardH / 2 + 14 + previewH / 2;

        // Card background
        const cardBg = this.add.rectangle(actX, cardY, cardW, cardH, area.unlocked ? 0x0a1018 : 0x05080c, 0.92);
        cardBg.setStrokeStyle(1, area.isCurrent ? 0x39d0d8 : area.unlocked ? 0x1a3040 : 0x0a1018, area.isCurrent ? 0.9 : 0.5);
        cardBg.setDepth(2);
        c.add(cardBg);

        // Preview frame
        const previewFrame = this.add.rectangle(actX, previewY, previewW, previewH, 0x05080c, 1);
        previewFrame.setDepth(2.5);
        c.add(previewFrame);

        // Preview image — use factory_bg_2 for factory, different for forest
        const previewTexture = area.regionId === 'forest' ? 'factory_bg_1' : 'factory_bg_2';
        if (this.textures.exists(previewTexture)) {
          const imgContainer = this.add.container(actX, previewY);
          imgContainer.setDepth(2.6);
          const previewImg = this.add.image(0, 0, previewTexture);
          const tex = this.textures.get(previewTexture).getSourceImage();
          const imgAR = tex.width / tex.height;
          const frameAR = previewW / previewH;
          let scale: number;
          if (imgAR > frameAR) {
            scale = previewH / tex.height;
          } else {
            scale = previewW / tex.width;
          }
          previewImg.setScale(scale);
          imgContainer.add(previewImg);
          const maskGfx = this.make.graphics({ x: actX, y: previewY }, false);
          maskGfx.fillStyle(0xffffff, 1);
          maskGfx.fillRect(-previewW / 2, -previewH / 2, previewW, previewH);
          const mask = maskGfx.createGeometryMask();
          imgContainer.setMask(mask);
          c.add(imgContainer);
          if (!area.unlocked) {
            previewImg.setAlpha(0.2);
            previewImg.setTint(0x303030);
          } else if (area.isCurrent) {
            previewImg.setTint(0x99ddff);
          }
          // Gradient overlay
          const gradient = this.add.rectangle(actX, previewY + previewH / 2 - 10, previewW, 20, 0x05080c, 0.7);
          gradient.setDepth(2.7);
          c.add(gradient);
        }

        // Preview border
        const previewBorder = this.add.rectangle(actX, previewY, previewW, previewH, 0x000000, 0);
        previewBorder.setStrokeStyle(1, 0x1a3040, 0.8);
        previewBorder.setDepth(2.8);
        c.add(previewBorder);

        // Area name
        const nameY = previewY + previewH / 2 + 18;
        c.add(this.add.text(actX, nameY, area.unlocked ? t(area.nameKey) : '🔒 ' + L('LOCKED', 'قفل'), fixTextStyle({
          fontFamily: 'monospace', fontSize: '12px',
          color: area.isCurrent ? '#66f0ff' : area.unlocked ? '#e0e8f0' : '#3a4350',
          stroke: '#000', strokeThickness: 3, wordWrap: { width: cardW - 10 }, align: 'center', letterSpacing: 1,
        })).setOrigin(0.5).setDepth(3));

        // Status
        let status = '';
        let statusColor = '#3a4350';
        if (area.isCurrent) { status = '◆ ' + L('CURRENT', 'فعلی'); statusColor = '#39d0d8'; }
        else if (area.bossDefeated) { status = '★ ' + L('CLEARED', 'تکمیل'); statusColor = '#ffc040'; }
        else if (area.hasBoss && area.unlocked) { status = '⚔ ' + L('BOSS', 'باس'); statusColor = '#ff6060'; }
        c.add(this.add.text(actX, nameY + 18, status, fixTextStyle({
          fontFamily: 'monospace', fontSize: '8px', color: statusColor, letterSpacing: 1,
        })).setOrigin(0.5).setDepth(3));

        // Enter / locked
        if (area.unlocked) {
          const btnBg = this.add.rectangle(actX, nameY + 38, 90, 22, 0x0a1018, 0.9);
          btnBg.setStrokeStyle(1, area.isCurrent ? 0x39d0d8 : 0x1a3040, 0.7);
          const btnText = this.add.text(actX, nameY + 38, '▶ ' + L('ENTER', 'ورود'), fixTextStyle({
            fontFamily: 'monospace', fontSize: '9px', color: '#cfd6e0', letterSpacing: 1,
          })).setOrigin(0.5);
          c.add([btnBg, btnText]);
          btnBg.setInteractive({ useHandCursor: true });
          btnBg.on('pointerover', () => { btnBg.setFillStyle(0x0d1820, 1); AudioSystem.play('uiHover'); });
          btnBg.on('pointerout', () => { btnBg.setFillStyle(0x0a1018, 0.9); });
          btnBg.on('pointerdown', () => {
            AudioSystem.play('uiClick');
            if (area.areaId !== WorldSystem.getCurrent().areaId) {
              WorldSystem.travelTo(area.areaId, 1);
            }
            this.setState('play');
          });
        } else {
          c.add(this.add.text(actX, nameY + 38, L('LOCKED', 'قفل'), fixTextStyle({
            fontFamily: 'monospace', fontSize: '9px', color: '#2a3040',
          })).setOrigin(0.5).setDepth(3));
        }
      });
    });

    // === Bottom bar: Navigation icons (improved UI) ===
    const navBarBg = this.add.rectangle(w / 2, h - 55, w - 80, 56, 0x0a0d14, 0.85);
    navBarBg.setStrokeStyle(1, 0x1a3040, 0.5);
    navBarBg.setDepth(1.5);
    c.add(navBarBg);

    const navY = h - 55;
    const navItems: { icon: string; label: string; action: () => void }[] = [
      { icon: '⚙', label: L('HANGAR', 'هانگر'), action: () => this.openOverlay('hangar') },
      { icon: '⚔', label: L('SKILLS', 'مهارت‌ها'), action: () => this.openOverlay('skills') },
      { icon: '◈', label: L('INVENTORY', 'کیف'), action: () => this.openOverlay('inventory') },
      { icon: '▤', label: L('QUESTS', 'ماموریت‌ها'), action: () => this.openOverlay('quests') },
      { icon: '⌂', label: L('SETTINGS', 'تنظیمات'), action: () => this.openOverlay('settings') },
      { icon: '←', label: t('menu.back'), action: () => this.setState('menu') },
    ];
    const navGap = 115;
    const navStartX = w / 2 - (navItems.length - 1) * navGap / 2;

    navItems.forEach((item) => {
      const nx = navStartX + navItems.indexOf(item) * navGap;
      this.makeHubNavBtn(nx, navY, item.icon, item.label, item.action);
    });

    this.setupMenuNav();
  }

  private showHowToPlay(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    c.removeAll(true);
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.92).setDepth(250);
    c.add(overlay);

    // Dynamic: pull labels from InputSchemeManager (auto-adapts to KB / Xbox / PS)
    const scheme = InputSchemeManager.getActiveScheme();
    const schemeName = scheme === 'keyboard' ? 'KEYBOARD'
      : scheme === 'playstation' ? 'PLAYSTATION'
      : scheme === 'xbox' ? 'XBOX'
      : 'GAMEPAD';
    const L = (a: 'move'|'jump'|'dash'|'fire'|'melee'|'interact'|'pause'|'back'|'weaponNext'|'weaponPrev') => InputSchemeManager.getLabel(a);

    const lines = [
      `HOW TO PLAY  ·  ${schemeName}`, '',
      `${L('move').padEnd(16)} →   MOVE`,
      `${L('jump').padEnd(16)} →   JUMP`,
      `${L('dash').padEnd(16)} →   DASH`,
      `${L('fire').padEnd(16)} →   FIRE`,
      `${L('melee').padEnd(16)} →   MELEE`,
      `${L('weaponPrev')} / ${L('weaponNext').padEnd(10)} →   SWITCH WEAPONS`,
      `${L('interact').padEnd(16)} →   INTERACT`,
      `${L('pause').padEnd(16)} →   PAUSE`,
      '', `Press ${L('jump')} to go back`,
    ];

    c.add(this.add.text(w / 2, h / 2 - 24, lines, fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0', align: 'center', lineSpacing: 6,
    })).setOrigin(0.5).setDepth(251));
    c.add(this.add.text(w / 2, h * 0.18, 'Switch input device — button labels update automatically', {
      fontFamily: 'monospace', fontSize: '10px', color: '#5a6470', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(251));

    const backHandler = () => { this.setState('menu'); window.removeEventListener('keydown', backHandler); };
    setTimeout(() => window.addEventListener('keydown', backHandler), 100);
  }

  // ================ PLAY ================

  private buildPlay(): void {
    const area = WorldSystem.getCurrentArea();
    if (!area) return;
    AudioSystem.resume();
    AudioSystem.startAmbient('factory');
    this.cameras.main.setBackgroundColor(area.bgColor);
    // Phaser 4 camera fade in
    this.cameras.main.fadeIn(600, 5, 7, 13);
    // Note: vignette removed per user feedback — was over-darkening the world.
    // Atmosphere is now provided by ParallaxBackground + AtmosphereSystem only.
    this.physicsSys.setWorldBounds(area.totalWidth, GAME.HEIGHT);
    this.physicsSys.setGravity(0, 0.9);
    this.projectiles = [];
    this.enemies = [];
    this.boss = null;
    this.bossArenaActive = false;
    this.miniBossSpawned = false;
    this.sequenceTimers = [];
    resetEnemyIds();
    this.stageStartTime = this.time.now;

    // ── Parallax background (themed per region) ──
    const theme = (area.regionId === 'forest') ? 'forest' : 'factory';
    this.parallax = new ParallaxBackground(this, theme as 'factory' | 'forest', area.totalWidth);
    this.parallax.build();

    // ── Atmosphere system (Phase 2: fog, god rays, particles) ──
    this.atmosphere = new AtmosphereSystem(this, theme as 'factory' | 'forest', area.totalWidth);
    this.atmosphere.build();

    // ── Forest environment system (grass, trees, vines, water, rain) ──
    if (theme === 'forest') {
      this.forestEnv = new ForestEnvironmentSystem(this, area.totalWidth);
      this.forestEnv.build();
    }

    // Build world from data
    this.areaLoader = new AreaLoader(this, this.physicsSys);
    this.loadedArea = this.areaLoader.load(area);

    // ── FIX Bug 4: Hide collectibles that were already collected (persisted) ──
    this.hidePreCollectedItems();
    // ── FIX Bug 1: Pre-open shortcuts that were already opened (persisted) ──
    this.preOpenShortcuts();

    // Render system (darkness + lights)
    this.render = new RenderSystem(this);

    // Combat system
    this.combat = new CombatSystem(this);

    // Create player
    const cp = CheckpointSystem.getRespawnPosition(area.id);
    const startX = cp.x;
    const startY = cp.y;
    this.currentSection = cp.section;
    this.player = new PlayerEntity(this, this.physicsSys, this.particles, this.combat, startX, startY, this.projectiles);

    this.camera.follow(this.player.sprite, 0.1);
    this.camera.setDeadzone(160, 100);
    this.camera.setBounds(0, 0, area.totalWidth, GAME.HEIGHT);

    // Note: circle light around player removed per user feedback — was making
    // the player look like a walking lamp. Player visibility is now provided
    // by the mech's own core reactor + visor glow.

    // HUD (only in play — NOT in hub)
    this.hud = new HUDUI(this, this.player);

    // ── Spawn NPC sprites + interaction prompts (previously invisible!) ──
    this.spawnNPCs(area.id);

    // ── Control hints (gamepad-aware) — only visible on section 1 ──
    this.controlHints = new ControlHintsUI(this);
    // Only show on section 1, hide on all other sections
    if (this.currentSection !== 1) {
      this.controlHints.setVisible(false);
    }

    // ── Spawn companion (Protocol Echo) — follows player ──
    this.companion = new CompanionEntity(this, startX + 30, startY - 40);

    // Collision handler
    this.matter.world.on('collisionstart', this.onCollisionStart, this);

    // Spawn enemies for current section
    this.spawnEnemiesForSection(this.currentSection);

    // ── Set player external refs (enemies + grapple anchor positions) for abilities ──
    this.updatePlayerExternalRefs();

    // Emit section info
    const sec = area.sections.find(s => s.id === this.currentSection);
    if (sec) EventBus.emit('GAME_STATE', { sectionId: sec.id, sectionName: sec.nameKey });
  }

  /** Update player's external references — enemies array + grapple anchor positions. */
  private updatePlayerExternalRefs(): void {
    if (!this.player || !this.loadedArea) return;
    // Extract grapple anchor positions from loaded area containers
    const anchorPositions: Phaser.Math.Vector2[] = [];
    for (const anchor of this.loadedArea.grappleAnchors) {
      if (anchor && anchor.active) {
        anchorPositions.push(new Phaser.Math.Vector2(anchor.x, anchor.y));
      }
    }
    this.player.setExternalRefs(this.enemies, anchorPositions);
  }

  // ================ METROIDVANIA: COLLECTIBLES + SHORTCUTS ================

  /** ── FIX Bug 4: Hide collectibles that were already collected (persisted). ── */
  private hidePreCollectedItems(): void {
    if (!this.loadedArea) return;
    for (const col of this.loadedArea.collectibles) {
      if (!col || !col.active) continue;
      const id = col.getData('collectibleId') as string;
      if (SaveSystem.isCollectibleCollected(id)) {
        col.setData('collected', true);
        col.setVisible(false);
        col.setActive(false);
      }
    }
  }

  /** ── FIX Bug 1: Pre-open shortcuts that were already opened (persisted). ── */
  private preOpenShortcuts(): void {
    if (!this.loadedArea) return;
    for (const sc of this.loadedArea.shortcuts) {
      if (!sc || !sc.active) continue;
      const id = sc.getData('shortcutId') as string;
      if (SaveSystem.isShortcutOpened(id)) {
        // Silently open (remove physics + hide visual) without toast
        sc.setData('shortcutOpen', true);
        const physicsBody = sc.getData('physicsBody') as Phaser.Physics.Matter.Image | null;
        if (physicsBody && physicsBody.active) {
          try { this.matter.world.remove(physicsBody.body as MatterJS.Body); } catch { /* */ }
          physicsBody.destroy();
        }
        sc.setAlpha(0.3);
        sc.setScale(1, 0);
        sc.setVisible(false);
      }
    }
  }

  /** Check if player is near any collectible → pick it up. */
  private checkCollectiblePickups(): void {
    if (!this.loadedArea || !this.player?.sprite?.active) return;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    for (const col of this.loadedArea.collectibles) {
      if (!col || !col.active) continue;
      if (col.getData('collected')) continue;
      const cx = col.x;
      const cy = col.y;
      const dist = Phaser.Math.Distance.Between(px, py, cx, cy);
      if (dist < 35) {
        // ── FIX Bug 5: Check requiredAbility before allowing pickup ──
        const requiredAbility = col.getData('requiredAbility') as string | null;
        if (requiredAbility && !this.player.hasAbility(requiredAbility)) {
          // Player doesn't have the required ability — show locked toast (throttled)
          if (this.time.now - (this._lastLockedToastAt || 0) > 1000) {
            this._lastLockedToastAt = this.time.now;
            const abilityName = getLocale() === 'fa' ? requiredAbility : requiredAbility.toUpperCase();
            this.hud?.toast(getLocale() === 'fa'
              ? `🔒 نیاز به ${abilityName}`
              : `🔒 REQUIRES ${abilityName}`);
          }
          continue;  // skip pickup
        }
        this.pickupCollectible(col);
      }
    }
  }

  /** Pick up a collectible — grant reward, mark as collected, visual burst. */
  private pickupCollectible(col: Phaser.GameObjects.Container): void {
    const id = col.getData('collectibleId') as string;
    const type = col.getData('collectibleType') as string;
    // Persist collection
    const isNew = SaveSystem.markCollectibleCollected(id);
    if (!isNew) return;  // already collected (shouldn't happen, but guard)
    col.setData('collected', true);

    // Grant reward based on type
    let toastMsg = '';
    let toastColor = 0xffffff;
    switch (type) {
      case 'health_fragment':
        // Increase max health by 10
        this.player.health.max += 10;
        this.player.health.current += 10;
        toastMsg = getLocale() === 'fa' ? '◆ +10 حداکثر سلامتی' : '◆ +10 MAX HEALTH';
        toastColor = 0x40d070;
        break;
      case 'energy_fragment':
        // Increase max energy by 10
        this.player.energy.max += 10;
        this.player.energy.current += 10;
        toastMsg = getLocale() === 'fa' ? '◆ +10 حداکثر انرژی' : '◆ +10 MAX ENERGY';
        toastColor = 0x4090ff;
        break;
      case 'skill_point':
        // Grant a skill point
        SaveSystem.grantSkillPoint();
        toastMsg = getLocale() === 'fa' ? '◆ +1 امتیاز مهارت' : '◆ +1 SKILL POINT';
        toastColor = 0xffc040;
        break;
      case 'weapon_part':
        // Grant a weapon part (for future weapon upgrade system)
        SaveSystem.addItem('weapon_part', 1);
        toastMsg = getLocale() === 'fa' ? '◆ قطعه سلاح' : '◆ WEAPON PART';
        toastColor = 0xff80ff;
        break;
    }

    // Visual: spark burst + fade out
    this.particles.sparks(col.x, col.y, toastColor, 12);
    this.particles.screenFlash(toastColor, 0.15, 250);
    this.tweens.add({
      targets: col, alpha: 0, scale: 2, duration: 300, ease: 'Cubic.out',
      onComplete: () => { col.setVisible(false); },
    });
    // Sound
    AudioSystem.play('skillUnlock');
    // Toast
    this.hud?.toast(toastMsg);
  }

  /** Check if player is approaching a shortcut from the correct side → open it. */
  private checkShortcutActivations(): void {
    if (!this.loadedArea || !this.player?.sprite?.active) return;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    for (const sc of this.loadedArea.shortcuts) {
      if (!sc || !sc.active) continue;
      if (sc.getData('shortcutOpen')) continue;
      const id = sc.getData('shortcutId') as string;
      // Skip if already opened in save data
      if (SaveSystem.isShortcutOpened(id)) {
        this.openShortcut(sc, id, false);  // silently open (already persisted)
        continue;
      }
      // Check if player is close enough + on the correct side
      const sx = sc.x;
      const sy = sc.y;
      const opensFrom = sc.getData('opensFrom') as string;
      const dist = Phaser.Math.Distance.Between(px, py, sx, sy);
      if (dist > 60) continue;
      // Check side
      let onCorrectSide = false;
      switch (opensFrom) {
        case 'left':   onCorrectSide = px < sx; break;
        case 'right':  onCorrectSide = px > sx; break;
        case 'top':    onCorrectSide = py < sy; break;
        case 'bottom': onCorrectSide = py > sy; break;
      }
      if (onCorrectSide) {
        this.openShortcut(sc, id, true);
      }
    }
  }

  /** Open a shortcut door — visual animation + persist + remove physics body. */
  private openShortcut(sc: Phaser.GameObjects.Container, id: string, withToast: boolean): void {
    sc.setData('shortcutOpen', true);
    SaveSystem.markShortcutOpened(id);
    // ── FIX Bug 1: Remove the physics body so player can pass through ──
    const physicsBody = sc.getData('physicsBody') as Phaser.Physics.Matter.Image | null;
    if (physicsBody && physicsBody.active) {
      this.matter.world.remove(physicsBody.body as MatterJS.Body);
      physicsBody.destroy();
    }
    // Visual: door slides open
    this.tweens.add({
      targets: sc, alpha: { from: 1, to: 0.3 }, scaleY: 0, duration: 500, ease: 'Cubic.out',
    });
    this.particles.sparks(sc.x, sc.y, 0xffc040, 8);
    AudioSystem.play('skillUnlock');
    if (withToast) {
      this.hud?.toast(getLocale() === 'fa' ? '⇌ میان‌بر باز شد' : '⇌ SHORTCUT OPENED');
    }
  }

  /** Spawn NPC sprites in the current area — previously NPCs were invisible. */
  private spawnNPCs(areaId: string): void {
    const npcs = NPCSystem.getNPCsInArea(areaId);
    for (const npc of npcs) {
      let visual: MechVisualHandle;
      if (npc.id === 'engineer_kara') {
        visual = MechaSpriteFactory.buildNPC_Kara(this);
      } else if (npc.id === 'ghost_operator') {
        visual = MechaSpriteFactory.buildNPC_GhostOperator(this);
      } else {
        visual = MechaSpriteFactory.buildNPC_Kara(this);
      }
      visual.container.setPosition(npc.x, npc.y);
      this.npcVisuals.set(npc.id, visual);

      // Name label above NPC (faded amber, only visible when near)
      const label = this.add.text(npc.x, npc.y - 40, t(`npc.${npc.id}.name`), fixTextStyle({
        fontFamily: 'monospace', fontSize: '11px', color: '#ffc040',
        stroke: '#000', strokeThickness: 3, letterSpacing: 2,
      })).setOrigin(0.5).setAlpha(0).setDepth(15);
      this.npcLabels.set(npc.id, label);
      this.tweens.add({ targets: label, alpha: { from: 0.3, to: 0.7 }, duration: 1500, yoyo: true, repeat: -1 });
      // Note: NPC circle light removed per user feedback — NPCs are now visible
      // via their own mech glow (Kara's hover thruster + Ghost Operator's hologram).
    }
  }

  /** Show a floating "Press E to interact" prompt above the nearest NPC OR lore object. */
  private updateNpcInteractionPrompt(): void {
    if (!this.player || !this.player.sprite || !this.player.sprite.active) return;
    const area = WorldSystem.getCurrentArea();
    if (!area) return;

    // Find nearest interactable — NPCs first, then lore objects
    let nearestX = 0, nearestY = 0, nearestKind: 'npc' | 'lore' | null = null;
    let nearestDist = 80;  // interaction radius

    // NPCs
    const npcs = NPCSystem.getNPCsInArea(area.id);
    for (const npc of npcs) {
      const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, npc.x, npc.y);
      if (dist < nearestDist) {
        nearestDist = dist; nearestX = npc.x; nearestY = npc.y - 60; nearestKind = 'npc';
      }
    }

    // Lore objects (terminals / corpses / echoes)
    if (this.loadedArea) {
      for (const loreObj of this.loadedArea.loreObjects) {
        if (!loreObj || !loreObj.active) continue;
        const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, loreObj.x, loreObj.y);
        if (dist < 70) {
          if (dist < nearestDist) {
            nearestDist = dist; nearestX = loreObj.x; nearestY = loreObj.y - 50; nearestKind = 'lore';
          }
        }
      }
    }

    if (nearestKind) {
      // Show / move interaction prompt
      if (!this.npcInteractionPrompt) {
        this.npcInteractionPrompt = this.createInteractionPrompt();
      }
      this.npcInteractionPrompt.setPosition(nearestX, nearestY);
      this.npcInteractionPrompt.setVisible(true);
      // Update label text based on kind + active input scheme
      const txt = this.npcInteractionPrompt.getAt(1) as Phaser.GameObjects.Text;
      if (txt && txt.active) {
        const key = InputSchemeManager.getLabel('interact');
        const action = nearestKind === 'npc'
          ? (getLocale() === 'fa' ? 'صحبت' : 'TALK')
          : (getLocale() === 'fa' ? 'بررسی' : 'EXAMINE');
        txt.setText(`[${key}] ${action}`);
      }
    } else if (this.npcInteractionPrompt) {
      this.npcInteractionPrompt.setVisible(false);
    }
  }

  /** Create a floating interaction prompt (dynamic scheme, Persian-aware). */
  private createInteractionPrompt(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(16);
    const bg = this.add.rectangle(0, 0, 90, 22, 0x0a0d14, 0.92);
    bg.setStrokeStyle(1, 0xffc040, 0.8);
    c.add(bg);
    const key = InputSchemeManager.getLabel('interact');
    const action = getLocale() === 'fa' ? 'صحبت' : 'TALK';
    const txt = this.add.text(0, 0, `[${key}] ${action}`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: '#ffc040', stroke: '#000', strokeThickness: 2,
    })).setOrigin(0.5);
    c.add(txt);
    this.tweens.add({ targets: c, y: '-=4', duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return c;
  }

  /** Per-frame: keep NPC name labels positioned above their (potentially bobbing) visuals. */
  private updateNpcLabels(): void {
    for (const [id, visual] of this.npcVisuals) {
      const label = this.npcLabels.get(id);
      if (!label || !label.active) continue;
      if (visual && visual.container.active) {
        label.setPosition(visual.container.x, visual.container.y - 40);
      }
    }
  }

  private spawnEnemiesForSection(sectionId: number): void {
    const area = WorldSystem.getCurrentArea();
    if (!area) return;
    const section = area.sections.find(s => s.id === sectionId);
    if (!section) return;
    for (const type of section.enemies) {
      if (type === 'boss' || type.startsWith('boss')) continue;
      const x = section.x + 400 + Math.random() * 400;
      const et = type as EnemyTypeId;
      const y = et === 'drone' || et === 'flying_ai' ? GAME.HEIGHT - 100 : GAME.HEIGHT - 200;
      const e = new EnemyEntity(this, this.physicsSys, this.particles, x, y, et, this.projectiles);
      this.enemies.push(e);
      // Mini Boss: spawn an elite in Section 4 as a tougher challenge
      if (sectionId === 4 && !this.miniBossSpawned) {
        this.miniBossSpawned = true;
        const mbX = section.x + 600;
        const mbY = GAME.HEIGHT - 200;
        const miniBoss = new EnemyEntity(this, this.physicsSys, this.particles, mbX, mbY, 'elite', this.projectiles);
        this.enemies.push(miniBoss);
        // Note: circle light around elite removed per user feedback.
        this.hud?.toast('⚠ ELITE DETECTED');
      }
      // Note: circle light around enemies removed per user feedback — was making
      // every enemy look like a glowing orb. Enemies are visible via their own
      // visor/eye glow from MechaSpriteFactory.
    }
  }

  private onCollisionStart = (event: MatterJS.IEventCollision<MatterJS.Body>): void => {
    for (const pair of event.pairs) {
      const aGo = (pair.bodyA as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      const bGo = (pair.bodyB as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      if (!aGo || !bGo) continue;
      const aIsPlayer = aGo.getData('entityType') === 'player';
      const bIsPlayer = bGo.getData('entityType') === 'player';
      const aSection = aGo.getData('sectionId') as number | undefined;
      const bSection = bGo.getData('sectionId') as number | undefined;
      if (aIsPlayer && bSection) { this.enterSection(bSection); }
      else if (bIsPlayer && aSection) { this.enterSection(aSection); }
      else if (aIsPlayer && bGo.getData('isCheckpoint')) { this.activateCheckpoint(); }
      else if (bIsPlayer && aGo.getData('isCheckpoint')) { this.activateCheckpoint(); }
      else if (aIsPlayer && bGo.getData('isBossEntry')) { this.enterBossArena(); }
      else if (bIsPlayer && aGo.getData('isBossEntry')) { this.enterBossArena(); }
      if (aIsPlayer && bGo.getData('entityType') === 'enemy') { this.handleEnemyContact(bGo); }
      else if (bIsPlayer && aGo.getData('entityType') === 'enemy') { this.handleEnemyContact(aGo); }
      if (aIsPlayer && bGo.getData('entityType') === 'boss' && this.boss) { this.player.takeDamage(this.boss.getContactDamage()); }
      else if (bIsPlayer && aGo.getData('entityType') === 'boss' && this.boss) { this.player.takeDamage(this.boss.getContactDamage()); }
      // Hazard collision (spikes, lava, etc.)
      if (aIsPlayer && bGo.getData('hazardDamage')) { this.handleHazard(bGo); }
      else if (bIsPlayer && aGo.getData('hazardDamage')) { this.handleHazard(aGo); }
    }
  };

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
    this.destroyBossHealthBar();
    const w = GAME.WIDTH;
    const barW = 600, barH = 16;
    const x = w / 2, y = 30;
    const container = this.add.container(0, 0).setDepth(210).setScrollFactor(0);
    // BG
    const bg = this.add.rectangle(x, y, barW + 4, barH + 4, 0x0a0d14, 0.9);
    bg.setStrokeStyle(1, 0xff4060, 0.5);
    container.add(bg);
    // Fill
    this.bossHealthFill = this.add.rectangle(x - barW / 2, y, barW, barH, 0xff4060, 0.9);
    this.bossHealthFill.setOrigin(0, 0.5);
    container.add(this.bossHealthFill);
    // Name
    const bossData = BossEntity.getBossData ? BossEntity.getBossData(bossId) : null;
    const bossName = bossData ? t(bossData.nameKey) : 'BOSS';
    this.bossNameText = this.add.text(x, y - 18, bossName, fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: '#ff6080', stroke: '#000', strokeThickness: 3, letterSpacing: 3,
    })).setOrigin(0.5);
    container.add(this.bossNameText);
    // Fade in
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 600, delay: 400 });
    this.bossHealthBar = container;
  }

  private updateBossHealthBar(): void {
    if (!this.boss || !this.boss.isAlive || !this.bossHealthFill) return;
    const pct = this.boss.getHealthPct();
    this.bossHealthFill.setDisplaySize(600 * pct, 16);
    // Color shift: red → amber as HP drops
    if (pct < 0.3) this.bossHealthFill.setFillStyle(0xff2030, 0.9);
    else if (pct < 0.6) this.bossHealthFill.setFillStyle(0xff8030, 0.9);
  }

  private destroyBossHealthBar(): void {
    if (this.bossHealthBar) { this.bossHealthBar.destroy(); this.bossHealthBar = null; }
    this.bossHealthFill = null;
    this.bossNameText = null;
  }

  private enterSection(id: number): void {
    if (id === this.currentSection) return;
    this.currentSection = id;
    WorldSystem.setSection(id);
    this.spawnEnemiesForSection(id);
    // Refresh player external refs (new enemies spawned)
    this.updatePlayerExternalRefs();
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
    // Close lore panel if open
    if (this.lorePanel) {
      this.lorePanel.destroy();
      this.lorePanel = null;
      return;
    }
    const area = WorldSystem.getCurrentArea();
    if (!area) return;
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
    // Check nearby Lore Objects
    if (this.loadedArea) {
      for (const loreObj of this.loadedArea.loreObjects) {
        if (!loreObj || !loreObj.active) continue;
        const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, loreObj.x, loreObj.y);
        if (dist < 70) {
          this.showLorePanel(loreObj.getData('loreTitle') as string, loreObj.getData('loreText') as string);
          return;
        }
      }
    }
  }

  private showLorePanel(titleKey: string, textKey: string): void {
    if (this.lorePanel) { this.lorePanel.destroy(); this.lorePanel = null; }
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    // Depth 285 — above atmosphere (95) + HUD (200), below dialogue (290)
    const panel = this.add.container(0, 0).setDepth(285).setScrollFactor(0);
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x05080c, 0.9);
    overlay.setInteractive();
    panel.add(overlay);
    const px = w / 2, py = h / 2;
    const pw = 600, ph = 300;
    const bg = this.add.rectangle(px, py, pw, ph, 0x0a0d14, 0.97);
    bg.setStrokeStyle(2, 0xffc040, 0.7);
    panel.add(bg);
    // Corner accents
    const cs = 12;
    panel.add(this.add.polygon(px - pw / 2, py - ph / 2, [0, 0, cs, 0, 0, cs], 0xffc040, 0.7));
    panel.add(this.add.polygon(px + pw / 2, py - ph / 2, [0, 0, -cs, 0, 0, cs], 0xffc040, 0.7));
    panel.add(this.add.polygon(px - pw / 2, py + ph / 2, [0, 0, cs, 0, 0, -cs], 0xffc040, 0.7));
    panel.add(this.add.polygon(px + pw / 2, py + ph / 2, [0, 0, -cs, 0, 0, -cs], 0xffc040, 0.7));
    // Title — Persian-aware (fixTextStyle forces letterSpacing 0 + DejaVu Sans for fa)
    panel.add(this.add.text(px, py - ph / 2 + 30, t(titleKey), fixTextStyle({
      fontFamily: 'monospace', fontSize: '16px', color: '#ffc040', stroke: '#000', strokeThickness: 4, letterSpacing: 2,
    })).setOrigin(0.5));
    panel.add(this.add.rectangle(px, py - ph / 2 + 55, pw - 40, 1, 0x3a3040, 0.7));
    // Body text — Persian-aware
    panel.add(this.add.text(px, py + 10, t(textKey), fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0', lineSpacing: 6,
      wordWrap: { width: pw - 60 }, align: 'center',
    })).setOrigin(0.5));
    // Close hint — Persian-aware
    const closeHint = getLocale() === 'fa' ? '▲ برای بستن E یا کلیک کنید' : '▲ PRESS E OR CLICK TO CLOSE';
    panel.add(this.add.text(px, py + ph / 2 - 25, closeHint, fixTextStyle({
      fontFamily: 'monospace', fontSize: '10px', color: '#5a6470', letterSpacing: 2,
    })).setOrigin(0.5));
    const closePanel = () => {
      if (this.lorePanel) { this.lorePanel.destroy(); this.lorePanel = null; }
    };
    overlay.on('pointerdown', closePanel);
    this.time.delayedCall(10000, closePanel);
    this.lorePanel = panel;
    AudioSystem.play('uiClick');
  }

  private updatePlay(deltaMs: number): void {
    if (!this.player) return;
    this.player.update(deltaMs);
    this.render.update(this.time.now);
    this.hud?.update();
    this.controlHints?.update();
    // Atmosphere (Phase 2: fog drift, particle motion, god ray breathing)
    this.atmosphere?.update(deltaMs);
    // NPC interaction prompt + label follow
    this.updateNpcInteractionPrompt();
    this.updateNpcLabels();
    // ── Metroidvania: check collectible pickups + shortcut activations ──
    this.checkCollectiblePickups();
    this.checkShortcutActivations();
    // ── Companion update — follows player ──
    this.companion?.update(deltaMs, this.player.position);
    // ── Forest environment update (grass, trees, vines, water, rain) ──
    this.forestEnv?.update(deltaMs, this.player.sprite.x, this.player.sprite.y);
    // Ambient dust motes — atmospheric particles around player (per particles skill)
    if (this.time.now % 200 < 16) {
      this.particles.ambientDust(this.player.sprite.x, this.player.sprite.y - 40, 2);
    }
    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update();
      if (!this.projectiles[i].isAlive) this.projectiles.splice(i, 1);
    }
    // Enemies
    const playerPos = this.player.position;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.isAlive || !e.sprite || !e.sprite.active) { this.enemies.splice(i, 1); continue; }
      try { e.update(deltaMs, playerPos); } catch { this.enemies.splice(i, 1); continue; }
    }
    // Boss
    if (this.boss && this.boss.isAlive && this.boss.sprite && this.boss.sprite.active) {
      try { this.boss.update(deltaMs); } catch { /* */ }
      this.updateBossHealthBar();
    }
    // Out of bounds
    if (this.player.sprite.y > GAME.HEIGHT + 80) {
      this.player.takeDamage(25);
      const area = WorldSystem.getCurrentArea();
      if (area) {
        const sec = area.sections.find(s => s.id === this.currentSection);
        if (sec) {
          this.player.sprite.setPosition(sec.x + 200, GAME.HEIGHT - 300);
          this.player.sprite.setVelocity(0, 0);
        }
      }
    }
    // Boss arena zoom — smooth zoom using Phaser 4 zoomTo (per cameras skill)
    if (this.bossArenaActive && this.boss && this.boss.isAlive) {
      if (this.cameras.main.zoom > 0.86) {
        this.cameras.main.zoomTo(0.85, 800, 'Sine.easeOut');
      }
    } else if (!this.bossArenaActive && this.cameras.main.zoom < 0.99) {
      this.cameras.main.zoomTo(1.0, 600, 'Sine.easeOut');
    }
  }

  private cleanupPlay(): void {
    this.matter.world.off('collisionstart', this.onCollisionStart, this);
    if (this.lorePanel) { this.lorePanel.destroy(); this.lorePanel = null; }
    this.destroyBossHealthBar();
    AudioSystem.stopAmbient();
    this.projectiles.forEach(p => p.kill());
    this.projectiles = [];
    this.player?.destroy();
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.boss?.destroy();
    this.boss = null;
    if (this.loadedArea && this.areaLoader) this.areaLoader.unload(this.loadedArea);
    this.loadedArea = null;
    // ── Destroy PLAY-only systems (effect separation: never leak into hub/menu) ──
    this.parallax?.destroy();
    this.parallax = null;
    this.atmosphere?.destroy();
    this.atmosphere = null;
    // Destroy NPC visuals + labels
    this.npcVisuals.forEach(v => v?.destroy());
    this.npcVisuals.clear();
    this.npcLabels.forEach(l => { if (l && l.active) l.destroy(); });
    this.npcLabels.clear();
    if (this.npcInteractionPrompt) { this.npcInteractionPrompt.destroy(); this.npcInteractionPrompt = null; }
    // Destroy control hints
    this.controlHints?.destroy();
    this.controlHints = null;
    // Destroy companion
    this.companion?.destroy();
    this.companion = null;
    // Destroy forest environment
    this.forestEnv?.destroy();
    this.forestEnv = null;
    this.tweens.killAll();
    this.sequenceTimers.forEach(t => t.remove());
    this.sequenceTimers = [];
    // *** Destroy HUD — hub is a separate environment, no game HUD ***
    this.hud?.destroy();
    this.hud = null;
    this.render?.destroy();
    // ── Reset camera filters (vignette leak fix: clear all external filters so
    // they don't persist into hub/menu/gameover/victory screens) ──
    try {
      const cam = this.cameras.main as unknown as { filters?: { external?: { list?: unknown[]; clear?: () => void } } };
      if (cam.filters?.external?.list) cam.filters.external.list = [];
    } catch { /* camera filters API varies */ }
    this.camera.resetZoom();
    this.camera.stopFollow();
    this.camera.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT);
    this.physicsSys.setWorldBounds(GAME.WIDTH, GAME.HEIGHT);
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
    this.makeMenuBtn(w / 2, h * 0.55, t('gameover.retry'), () => {
      AudioSystem.play('uiClick');
      CheckpointSystem.clear();
      this.setState('play');
    });
    // Quit button — back to main menu (user: "if defeated → game over with retry/restart")
    this.makeMenuBtn(w / 2, h * 0.65, t('gameover.quit'), () => {
      AudioSystem.play('uiClick');
      this.setState('menu');
    });
    this.setupMenuNav();
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
    this.makeMenuBtn(w / 2, h * 0.82, returnLabel, () => {
      AudioSystem.play('uiClick');
      this.setState('hub');
    });
    this.setupMenuNav();
  }

  // ================ GAMEPAD / KEYBOARD NAVIGATION ================

  private menuNavCooldown = 0;

  /** Gamepad + keyboard navigation for menu/hub/gameover/victory. */
  private handleMenuGamepadNav(input: import('../../systems/InputSystem').InputState): void {
    if (this.menuButtons.length === 0) return;
    this.menuNavCooldown -= 16;
    if (this.menuNavCooldown > 0) return;

    if (input.leftStickY < -0.3 || input.heldUp) {
      this.menuFocusIndex = (this.menuFocusIndex - 1 + this.menuButtons.length) % this.menuButtons.length;
      this.updateMenuFocus(); AudioSystem.play('uiHover');
      this.menuNavCooldown = 110;  // freer — was 180
    } else if (input.leftStickY > 0.3 || input.heldDown) {
      this.menuFocusIndex = (this.menuFocusIndex + 1) % this.menuButtons.length;
      this.updateMenuFocus(); AudioSystem.play('uiHover');
      this.menuNavCooldown = 110;
    }
    if (input.jumpPressed || input.firePressed) {
      AudioSystem.play('uiClick');
      const btn = this.menuButtons[this.menuFocusIndex];
      if (btn) btn.onSelect();
      this.menuNavCooldown = 300;
    }
  }

  // ================ MENU HELPERS ================

  /** Create a standard rectangular menu button (focusable + clickable). */
  private makeMenuBtn(x: number, y: number, label: string, onClick: () => void, disabled: boolean = false, width: number = 240): void {
    const bg = this.add.rectangle(x, y, width, 38, disabled ? 0x05080c : 0x0a1018, 0.9);
    bg.setStrokeStyle(1, disabled ? 0x05080c : 0x1a3040, 0.8);
    if (!disabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { this.menuFocusIndex = this.menuButtons.findIndex(b => b.bg === bg); this.updateMenuFocus(); AudioSystem.play('uiHover'); });
      bg.on('pointerout', () => this.updateMenuFocus());
      bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    }
    const textEl = this.add.text(x, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '15px', color: disabled ? '#0a1018' : '#5a6470',
    })).setOrigin(0.5);
    this.stateContainer!.add([bg, textEl]);
    if (!disabled) {
      this.menuButtons.push({ bg, text: textEl, onSelect: onClick });
    }
  }

  /** Create a hub area-card enter button (smaller, focusable + clickable). */
  private makeHubCardBtn(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 100, 28, 0x0a1018, 0.9);
    bg.setStrokeStyle(1, 0x1a3040, 0.8);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { this.menuFocusIndex = this.menuButtons.findIndex(b => b.bg === bg); this.updateMenuFocus(); AudioSystem.play('uiHover'); });
    bg.on('pointerout', () => this.updateMenuFocus());
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    const textEl = this.add.text(x, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: '#39d0d8',
    })).setOrigin(0.5);
    this.stateContainer!.add([bg, textEl]);
    this.menuButtons.push({ bg, text: textEl, onSelect: onClick });
  }

  /** Create a hub bottom-nav icon button (circle, focusable + clickable). */
  private makeHubNavBtn(x: number, y: number, icon: string, label: string, onClick: () => void): void {
    const radius = 26;
    const bg = this.add.circle(x, y, radius, 0x0a1018, 0.95);
    bg.setStrokeStyle(1, 0x1a3040, 0.7);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      this.menuFocusIndex = this.menuButtons.findIndex(b => b.bg === bg);
      this.updateMenuFocus();
      AudioSystem.play('uiHover');
      bg.setScale(1.1);
    });
    bg.on('pointerout', () => { this.updateMenuFocus(); bg.setScale(1); });
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    const iconText = this.add.text(x, y - 2, icon, fixTextStyle({
      fontFamily: 'monospace', fontSize: '18px', color: '#5a6470',
    })).setOrigin(0.5);
    const labelText = this.add.text(x, y + 34, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: '#3a4350', letterSpacing: 1,
    })).setOrigin(0.5);
    this.stateContainer!.add([bg, iconText, labelText]);
    this.menuButtons.push({ bg, text: iconText, onSelect: onClick });
  }

  private setupMenuNav(): void {
    this.menuNavHandler = (e: KeyboardEvent) => {
      if (this.menuButtons.length === 0) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.menuFocusIndex = (this.menuFocusIndex - 1 + this.menuButtons.length) % this.menuButtons.length;
        this.updateMenuFocus(); AudioSystem.play('uiHover');
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.menuFocusIndex = (this.menuFocusIndex + 1) % this.menuButtons.length;
        this.updateMenuFocus(); AudioSystem.play('uiHover');
      } else if (e.code === 'Enter' || e.code === 'Space') {
        AudioSystem.play('uiClick');
        this.menuButtons[this.menuFocusIndex]?.onSelect();
      }
    };
    window.addEventListener('keydown', this.menuNavHandler);
    this.updateMenuFocus();
  }

  private updateMenuFocus(): void {
    this.menuButtons.forEach((btn, i) => {
      // Guard against destroyed objects (prevents drawImage null crash)
      if (!btn.bg || !btn.bg.active || !btn.text || !btn.text.active) return;
      try {
        if (i === this.menuFocusIndex) {
          btn.bg.setFillStyle(0x0d1820, 1);
          btn.bg.setStrokeStyle(2, 0x39d0d8, 0.9);
          btn.bg.setScale(1.05);
          btn.text.setColor('#66f0ff');
        } else {
          btn.bg.setFillStyle(0x0a1018, 0.9);
          btn.bg.setStrokeStyle(1, 0x1a3040, 0.8);
          btn.bg.setScale(1);
          btn.text.setColor('#5a6470');
        }
      } catch { /* text canvas not ready — skip */ }
    });
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
