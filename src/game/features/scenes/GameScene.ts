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
import { setLocale, t, getLocale } from '../../systems/LocalizationSystem';
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
import { OverlayManager, type OverlayId, type OverlayUI, type OverlayParent } from '../../ui/OverlayManager';
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

  // UI
  private hud: HUDUI | null = null;
  private dialogueUI!: DialogueUI;
  private pauseMenuUI!: PauseMenuUI;

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
        this.updatePlay(deltaMs);
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

    // === Top bar: Title + Player stats ===
    c.add(this.add.text(30, 20, isFa ? 'انتخاب ماموریت' : 'MISSION SELECT', {
      fontFamily: 'monospace', fontSize: '18px', color: '#39d0d8',
    }).setDepth(1));

    const save = SaveSystem.getPlayer();
    const xpNeeded = ExperienceSystem.xpForLevel(save.level);
    c.add(this.add.text(w - 30, 20, `LV.${save.level}  ${save.xp}/${xpNeeded} XP  |  SP: ${save.skillPoints}  |  Kills: ${save.totalKills}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#5a6470',
    }).setOrigin(1, 0).setDepth(1));

    c.add(this.add.rectangle(w / 2, 50, w - 60, 1, 0x1a2030, 0.6).setDepth(1));

    // === Area cards ===
    const tree = WorldMapSystem.getMapTree();
    const areas: { areaId: string; nameKey: string; unlocked: boolean; discovered: boolean; isCurrent: boolean; bossDefeated: boolean; hasBoss: boolean }[] = [];
    for (const actData of tree) {
      for (const regionData of actData.regions) {
        for (const node of regionData.nodes) {
          areas.push({
            areaId: node.area.id,
            nameKey: node.area.nameKey,
            unlocked: node.unlocked,
            discovered: node.discovered,
            isCurrent: node.isCurrent,
            bossDefeated: node.bossDefeated,
            hasBoss: node.hasBoss,
          });
        }
      }
    }

    const cardW = 280;
    const cardH = 200;
    const cardGap = 30;
    const totalW = areas.length * cardW + (areas.length - 1) * cardGap;
    const startX = (w - totalW) / 2 + cardW / 2;
    const cardY = h * 0.42;

    areas.forEach((area, i) => {
      const x = startX + i * (cardW + cardGap);
      const cardBg = this.add.rectangle(x, cardY, cardW, cardH, area.unlocked ? 0x0a1018 : 0x05080c, 0.9);
      cardBg.setStrokeStyle(1, area.isCurrent ? 0x39d0d8 : area.unlocked ? 0x1a3040 : 0x0a1018, area.isCurrent ? 0.9 : 0.5);
      cardBg.setDepth(2);
      c.add(cardBg);

      const previewBg = this.add.rectangle(x, cardY - 30, cardW - 20, 100, 0x05080c, 1);
      previewBg.setStrokeStyle(1, 0x0a1018, 0.5);
      previewBg.setDepth(2);
      c.add(previewBg);

      const nameText = this.add.text(x, cardY + 40, area.unlocked ? t(area.nameKey) : '🔒 ' + L('LOCKED', 'قفل'), {
        fontFamily: 'monospace', fontSize: '14px',
        color: area.isCurrent ? '#66f0ff' : area.unlocked ? '#cfd6e0' : '#2a3040',
      }).setOrigin(0.5).setDepth(3);
      c.add(nameText);

      let status = '';
      if (area.isCurrent) status = '◆ ' + L('CURRENT', 'فعلی');
      else if (area.bossDefeated) status = '★ ' + L('CLEARED', 'تکمیل شده');
      else if (area.hasBoss && area.unlocked) status = '⚔ ' + L('BOSS', 'باس');
      c.add(this.add.text(x, cardY + 62, status, {
        fontFamily: 'monospace', fontSize: '10px', color: '#3a4350',
      }).setOrigin(0.5).setDepth(3));

      // Enter button — registered as focusable for gamepad nav
      if (area.unlocked) {
        this.makeHubCardBtn(x, cardY + 82, '▶ ' + L('ENTER', 'ورود'), () => {
          AudioSystem.play('uiClick');
          if (area.areaId !== WorldSystem.getCurrent().areaId) {
            WorldSystem.travelTo(area.areaId, 1);
          }
          this.setState('play');
        });
      }
    });

    // === Bottom bar: Navigation icons (focusable for gamepad) ===
    const navY = h - 60;
    const navItems: { icon: string; label: string; action: () => void }[] = [
      { icon: '⚔', label: L('SKILLS', 'مهارت‌ها'), action: () => this.openOverlay('skills') },
      { icon: '🎒', label: L('INVENTORY', 'کیف'), action: () => this.openOverlay('inventory') },
      { icon: '📜', label: L('QUESTS', 'ماموریت‌ها'), action: () => this.openOverlay('quests') },
      { icon: '⚙', label: t('menu.settings'), action: () => this.openOverlay('settings') },
      { icon: '←', label: t('menu.back'), action: () => this.setState('menu') },
    ];
    const navGap = 130;
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
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.9).setDepth(250);
    c.add(overlay);
    const lines = [
      'HOW TO PLAY', '',
      'WASD / ARROWS    →   MOVE',
      'SPACE                   →   JUMP',
      'SHIFT                   →   DASH',
      'J                           →   FIRE',
      'K                           →   MELEE',
      '1-4 / Q-E              →   SWITCH WEAPONS',
      'E                           →   INTERACT',
      'ESC                       →   PAUSE',
      '', 'Press ENTER / A to go back',
    ];
    c.add(this.add.text(w / 2, h / 2, lines, {
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5).setDepth(251));
    const backHandler = () => { this.setState('menu'); window.removeEventListener('keydown', backHandler); };
    setTimeout(() => window.addEventListener('keydown', backHandler), 100);
  }

  // ================ PLAY ================

  private buildPlay(): void {
    const area = WorldSystem.getCurrentArea();
    if (!area) return;
    AudioSystem.resume();
    this.cameras.main.setBackgroundColor(area.bgColor);
    this.physicsSys.setWorldBounds(area.totalWidth, GAME.HEIGHT);
    this.physicsSys.setGravity(0, 0.9);
    this.projectiles = [];
    this.enemies = [];
    this.boss = null;
    this.bossArenaActive = false;
    this.sequenceTimers = [];
    resetEnemyIds();
    this.stageStartTime = this.time.now;

    // Build world from data
    this.areaLoader = new AreaLoader(this, this.physicsSys);
    this.loadedArea = this.areaLoader.load(area);

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

    // Player light
    this.render.addLight({
      follow: () => this.player?.position ?? new Phaser.Math.Vector2(0, 0),
      radius: 140, color: COLORS.PLAYER_GLOW, intensity: 0.3, flicker: 0.05,
    });

    // HUD (only in play — NOT in hub)
    this.hud = new HUDUI(this, this.player);

    // Collision handler
    this.matter.world.on('collisionstart', this.onCollisionStart, this);

    // Spawn enemies for current section
    this.spawnEnemiesForSection(this.currentSection);

    // Emit section info
    const sec = area.sections.find(s => s.id === this.currentSection);
    if (sec) EventBus.emit('GAME_STATE', { sectionId: sec.id, sectionName: sec.nameKey });
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
      this.render.addLight({
        follow: () => e.isAlive ? e.position : new Phaser.Math.Vector2(-9999, -9999),
        radius: 50, color: e.data.color, intensity: 0.2, flicker: 0.2,
      });
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
    }
  };

  private enterSection(id: number): void {
    if (id === this.currentSection) return;
    this.currentSection = id;
    WorldSystem.setSection(id);
    this.spawnEnemiesForSection(id);
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
    this.particles.screenFlash(0xff3030, 0.35, 500);
    this.camera.shake(400, 0.012);
    this.render.addLight({
      follow: () => this.boss?.isAlive ? this.boss.position : new Phaser.Math.Vector2(-9999, -9999),
      radius: 240, color: COLORS.BOSS_GLOW, intensity: 0.45, flicker: 0.08,
    });
  }

  private handleEnemyContact(enemyGo: Phaser.GameObjects.GameObject): void {
    const id = enemyGo.getData('id') as string | undefined;
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
  }

  private updatePlay(deltaMs: number): void {
    if (!this.player) return;
    this.player.update(deltaMs);
    this.render.update(this.time.now);
    this.hud?.update();
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
    // Boss arena zoom
    if (this.bossArenaActive && this.boss && this.boss.isAlive) {
      this.camera.setZoom(0.85);
    }
  }

  private cleanupPlay(): void {
    this.matter.world.off('collisionstart', this.onCollisionStart, this);
    this.projectiles.forEach(p => p.kill());
    this.projectiles = [];
    this.player?.destroy();
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.boss?.destroy();
    this.boss = null;
    if (this.loadedArea && this.areaLoader) this.areaLoader.unload(this.loadedArea);
    this.loadedArea = null;
    this.tweens.killAll();
    this.sequenceTimers.forEach(t => t.remove());
    this.sequenceTimers = [];
    // *** Destroy HUD — hub is a separate environment, no game HUD ***
    this.hud?.destroy();
    this.hud = null;
    this.render?.destroy();
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
      this.matter.world.resume();
      AudioSystem.play('uiClick');
    } else {
      this.paused = true;
      this.pauseMenuUI.show();
      this.matter.world.pause();
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
    EventBus.off('PLAYER_DEAD', this.onPlayerDied, this);
    this.particles.explosion(this.player.sprite.x, this.player.sprite.y, COLORS.PLAYER, 1.2);
    this.camera.shake(400, 0.012);
    this.camera.fadeOut(700, 0, 0, 0);
    this.scheduleDelayed(900, () => {
      this.camera.fadeIn(300, 0, 0, 0);
      this.setState('gameover');
    });
  };

  private onEnemyKilled = (payload: unknown): void => {
    const data = payload as { id: string; x: number; y: number };
    if (data.x && data.y) this.particles.explosion(data.x, data.y, COLORS.ENEMY_DRONE, 0.6);
  };

  private onBossDied = (payload: unknown): void => {
    const data = payload as { id: string; lore: string[] };
    if (this.boss) {
      this.particles.explosion(this.boss.position.x, this.boss.position.y, COLORS.BOSS, 3.0);
    }
    this.camera.flash(800, 255, 255, 255);
    this.scheduleDelayed(2200, () => {
      AudioSystem.play('victory');
      this.setState('victory');
    });
  };

  // ================ GAMEOVER / VICTORY ================

  private buildGameOver(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85).setDepth(200);
    c.add(overlay);
    c.add(this.add.text(w / 2, h * 0.3, t('gameover.title'), {
      fontFamily: 'monospace', fontSize: '56px', color: '#ff4040', stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(201));
    c.add(this.add.text(w / 2, h * 0.42, `LV.${ExperienceSystem.getLevel()}  |  ${SaveSystem.getPlayer().totalKills} kills`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#5a6470',
    }).setOrigin(0.5).setDepth(201));
    this.makeMenuBtn(w / 2, h * 0.55, t('gameover.retry'), () => {
      AudioSystem.play('uiClick');
      CheckpointSystem.clear();
      this.setState('play');
    });
    this.makeMenuBtn(w / 2, h * 0.65, t('gameover.quit'), () => {
      AudioSystem.play('uiClick');
      this.setState('menu');
    });
    this.setupMenuNav();
  }

  private buildVictory(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    c.add(this.add.text(w / 2, h * 0.35, t('victory.title'), {
      fontFamily: 'monospace', fontSize: '72px', color: '#ffe060', stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5));
    const lore = LoreSystem.getBossLore('guardian_ax09');
    if (lore) {
      const lines = lore.lines.map(key => t(key));
      c.add(this.add.text(w / 2, h * 0.5, lines, {
        fontFamily: 'monospace', fontSize: '14px', color: '#a0a0a0', align: 'center', lineSpacing: 6,
      }).setOrigin(0.5));
    }
    this.makeMenuBtn(w / 2, h * 0.75, t('victory.return'), () => {
      AudioSystem.play('uiClick');
      this.setState('menu');
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
    const textEl = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '15px', color: disabled ? '#0a1018' : '#5a6470',
    }).setOrigin(0.5);
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
    const textEl = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '11px', color: '#39d0d8',
    }).setOrigin(0.5);
    this.stateContainer!.add([bg, textEl]);
    this.menuButtons.push({ bg, text: textEl, onSelect: onClick });
  }

  /** Create a hub bottom-nav icon button (circle, focusable + clickable). */
  private makeHubNavBtn(x: number, y: number, icon: string, label: string, onClick: () => void): void {
    const bg = this.add.circle(x, y, 22, 0x0a1018, 0.9);
    bg.setStrokeStyle(1, 0x1a3040, 0.6);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { this.menuFocusIndex = this.menuButtons.findIndex(b => b.bg === bg); this.updateMenuFocus(); AudioSystem.play('uiHover'); });
    bg.on('pointerout', () => this.updateMenuFocus());
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    const iconText = this.add.text(x, y, icon, {
      fontFamily: 'monospace', fontSize: '16px', color: '#5a6470',
    }).setOrigin(0.5);
    const labelText = this.add.text(x, y + 32, label, {
      fontFamily: 'monospace', fontSize: '9px', color: '#3a4350',
    }).setOrigin(0.5);
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
    OverlayManager.destroy();
    InputSystem.destroy();
  }
}

export default GameScene;
