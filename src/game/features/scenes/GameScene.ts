/**
 * MECHA: LAST PROTOCOL — GameScene v3.0
 * Wires ALL systems, entities, and UIs together.
 * State machine: menu | play | gameover | victory
 * Overlay flags: paused | settings | skills | inventory | quests | map | dialogue
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
import { setLocale, t } from '../../systems/LocalizationSystem';
import { NPCSystem } from '../../systems/NPCSystem';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { LoreSystem } from '../../systems/LoreSystem';
import { QuestSystem } from '../../systems/QuestSystem';
import { InventorySystem } from '../../systems/InventorySystem';
import { WeaponUpgradeSystem } from '../../systems/WeaponUpgradeSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import { SkillTreeSystem } from '../../systems/SkillTreeSystem';
import { WorldSystem } from '../../world/WorldSystem';
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
import type { EnemyTypeId } from '../../data/types';

type GameState = 'menu' | 'play' | 'gameover' | 'victory';

export class GameScene extends Phaser.Scene {
  private state: GameState = 'menu';
  private stateContainer: Phaser.GameObjects.Container | null = null;
  private menuButtons: Phaser.GameObjects.Rectangle[] = [];
  private menuFocusIndex = 0;
  private menuNavHandler: ((e: KeyboardEvent) => void) | null = null;

  // Systems
  private physics!: PhysicsSystem;
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
  private hud!: HUDUI;
  private dialogueUI!: DialogueUI;
  private pauseMenuUI!: PauseMenuUI;
  private settingsUI!: SettingsUI;
  private skillTreeUI!: SkillTreeUI;
  private inventoryUI!: InventoryUI;
  private questUI!: QuestUI;
  private worldMapUI!: WorldMapUI;

  // Overlay flags
  private paused = false;
  private lastPauseToggleAt = 0;
  private inSettings = false;
  private inSkills = false;
  private inInventory = false;
  private inQuests = false;
  private inMap = false;

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    // Init audio
    AudioSystem.init();
    AudioSystem.resume();

    // Note: InputSystem.init() is called by PlayerEntity with real callbacks.
    // GameScene does NOT call init() to avoid overwriting PlayerEntity's callbacks.
    // Pause/interact are handled via InputSystem.getState() polling in update().

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
    this.physics = new PhysicsSystem(this);
    this.camera = new CameraSystem(this);
    this.particles = new ParticleSystem(this);

    // Build UIs (hidden by default, shown when needed)
    this.dialogueUI = new DialogueUI(this);
    this.pauseMenuUI = new PauseMenuUI(this, {
      onResume: () => this.togglePause(),
      onRestart: () => this.restartStage(),
      onSettings: () => { this.pauseMenuUI.hide(); this.inSettings = true; this.settingsUI.show(); },
      onSkills: () => { this.pauseMenuUI.hide(); this.inSkills = true; this.skillTreeUI.show(); },
      onInventory: () => { this.pauseMenuUI.hide(); this.inInventory = true; this.inventoryUI.show(); },
      onQuests: () => { this.pauseMenuUI.hide(); this.inQuests = true; this.questUI.show(); },
      onMap: () => { this.pauseMenuUI.hide(); this.inMap = true; this.worldMapUI.show(); },
      onQuit: () => this.quitToMenu(),
    });
    this.settingsUI = new SettingsUI(this, () => { this.settingsUI.hide(); this.inSettings = false; this.pauseMenuUI.show(); });
    this.skillTreeUI = new SkillTreeUI(this, () => { this.skillTreeUI.hide(); this.inSkills = false; this.pauseMenuUI.show(); });
    this.inventoryUI = new InventoryUI(this, () => { this.inventoryUI.hide(); this.inInventory = false; this.pauseMenuUI.show(); });
    this.questUI = new QuestUI(this, () => { this.questUI.hide(); this.inQuests = false; this.pauseMenuUI.show(); });
    this.worldMapUI = new WorldMapUI(this,
      () => { this.worldMapUI.hide(); this.inMap = false; this.pauseMenuUI.show(); },
      (areaId: string) => this.fastTravel(areaId),
    );

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
    this.cleanupState();
    this.state = next;
    if (next !== 'play') {
      this.stateContainer = this.add.container(0, 0).setDepth(50);
    } else {
      this.stateContainer = null;
    }
    this.menuButtons = [];
    this.menuFocusIndex = 0;
    switch (next) {
      case 'menu': this.buildMenu(); break;
      case 'play': this.buildPlay(); break;
      case 'gameover': this.buildGameOver(); break;
      case 'victory': this.buildVictory(); break;
    }
  }

  private cleanupState(): void {
    if (this.state === 'play') this.cleanupPlay();
    if (this.menuNavHandler) {
      window.removeEventListener('keydown', this.menuNavHandler);
      this.menuNavHandler = null;
    }
    if (this.stateContainer) { this.stateContainer.destroy(true); this.stateContainer = null; }
  }

  update(_time: number, deltaMs: number): void {
    InputSystem.update();
    const input = InputSystem.getState();

    if (this.state === 'play') {
      // Handle pause/interact via polling (InputSystem callbacks are owned by PlayerEntity)
      if (input.pausePressed) this.togglePause();
      if (input.interactPressed) this.tryInteract();

      if (!this.paused && !this.inSettings && !this.inSkills && !this.inInventory && !this.inQuests && !this.inMap) {
        this.updatePlay(deltaMs);
      } else if (this.paused) {
        // Gamepad navigation for pause menu + all sub-overlays
        if (this.inSettings) {
          // Settings uses drag-based sliders, no gamepad nav needed
        } else if (this.inSkills) {
          this.handleSkillTreeNav(input);
        } else if (this.inInventory) {
          this.handleInventoryNav(input);
        } else if (this.inQuests) {
          // Quest log is read-only, just allow back
          if (input.backPressed) { this.questUI.hide(); this.inQuests = false; this.pauseMenuUI.show(); }
          if (input.jumpPressed) { this.questUI.hide(); this.inQuests = false; this.pauseMenuUI.show(); }
        } else if (this.inMap) {
          // World map uses click, just allow back
          if (input.backPressed) { this.worldMapUI.hide(); this.inMap = false; this.pauseMenuUI.show(); }
          if (input.jumpPressed) { this.worldMapUI.hide(); this.inMap = false; this.pauseMenuUI.show(); }
        } else {
          this.pauseMenuUI.handleNavigation();
        }
      }
    } else if (this.state === 'menu' || this.state === 'gameover' || this.state === 'victory') {
      // Gamepad navigation for menu/gameover/victory screens
      this.handleMenuGamepadNav(input);
    }

    // Dialogue advance via gamepad (works in any state)
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

    // Animated background — scrolling grid lines
    const bgGfx = this.add.graphics();
    bgGfx.setDepth(0);
    bgGfx.fillStyle(0x05070d, 1);
    bgGfx.fillRect(0, 0, w, h);
    // Grid pattern
    bgGfx.lineStyle(1, 0x0a1a2a, 0.3);
    for (let x = 0; x < w; x += 40) { bgGfx.beginPath(); bgGfx.moveTo(x, 0); bgGfx.lineTo(x, h); bgGfx.strokePath(); }
    for (let y = 0; y < h; y += 40) { bgGfx.beginPath(); bgGfx.moveTo(0, y); bgGfx.lineTo(w, y); bgGfx.strokePath(); }
    c.add(bgGfx);

    // Glow behind title
    const titleGlow = this.add.circle(w / 2, h * 0.28, 200, 0x39d0d8, 0.05);
    titleGlow.setBlendMode(Phaser.BlendModes.ADD);
    titleGlow.setDepth(1);
    c.add(titleGlow);
    this.tweens.add({ targets: titleGlow, alpha: { from: 0.03, to: 0.08 }, duration: 2000, yoyo: true, repeat: -1 });

    // Title — large with gradient effect via two layers
    const titleShadow = this.add.text(w / 2 + 2, h * 0.25 + 2, t('game.title'), {
      fontFamily: 'monospace', fontSize: '52px', color: '#0a1a2a', stroke: '#0a1a2a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(2);
    c.add(titleShadow);
    const title = this.add.text(w / 2, h * 0.25, t('game.title'), {
      fontFamily: 'monospace', fontSize: '52px', color: '#39d0d8', stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(3);
    c.add(title);
    this.tweens.add({ targets: title, alpha: { from: 0.8, to: 1 }, duration: 1500, yoyo: true, repeat: -1 });

    // Subtitle
    c.add(this.add.text(w / 2, h * 0.33, t('game.version'), {
      fontFamily: 'monospace', fontSize: '13px', color: '#3a4350',
    }).setOrigin(0.5).setDepth(3));

    // Decorative line
    const line = this.add.rectangle(w / 2, h * 0.4, 400, 2, 0x1a3040, 1);
    c.add(line);
    this.tweens.add({ targets: line, scaleX: { from: 0, to: 1 }, duration: 800, ease: 'Quad.easeOut' });

    // Menu buttons — centered, larger, with better spacing
    const sy = h * 0.52;
    this.makeMenuBtn(w / 2, sy, t('menu.start'), () => { AudioSystem.play('uiClick'); this.setState('play'); });
    this.makeMenuBtn(w / 2, sy + 65, t('menu.settings'), () => { AudioSystem.play('uiClick'); this.openSettingsFromMenu(); });

    // Footer — tech stack
    c.add(this.add.text(w / 2, h - 40, 'PHASER 4.2 · MATTER.JS · WEBGL', {
      fontFamily: 'monospace', fontSize: '10px', color: '#1a2030',
    }).setOrigin(0.5).setDepth(3));

    // Corner decorations — cyberpunk style
    const cornerSize = 30;
    const cornerColor = 0x1a3040;
    const corners = [
      { x: 20, y: 20, dx: 1, dy: 1 },
      { x: w - 20, y: 20, dx: -1, dy: 1 },
      { x: 20, y: h - 20, dx: 1, dy: -1 },
      { x: w - 20, y: h - 20, dx: -1, dy: -1 },
    ];
    for (const corner of corners) {
      const cg = this.add.graphics();
      cg.lineStyle(2, cornerColor, 0.6);
      cg.beginPath();
      cg.moveTo(corner.x, corner.y + corner.dy * cornerSize);
      cg.lineTo(corner.x, corner.y);
      cg.lineTo(corner.x + corner.dx * cornerSize, corner.y);
      cg.strokePath();
      cg.setDepth(3);
      c.add(cg);
    }

    this.setupMenuNav();
  }

  private openSettingsFromMenu(): void {
    // Reuse SettingsUI but with menu-back callback
    this.settingsUI = new SettingsUI(this, () => { this.settingsUI.hide(); this.settingsUI.destroy(); this.setState('menu'); });
    this.settingsUI.show();
  }

  // ================ PLAY ================

  private buildPlay(): void {
    const area = WorldSystem.getCurrentArea();
    if (!area) return;
    AudioSystem.resume();
    this.cameras.main.setBackgroundColor(area.bgColor);
    this.physics.setWorldBounds(area.totalWidth, GAME.HEIGHT);
    this.physics.setGravity(0, 0.9);
    this.projectiles = [];
    this.enemies = [];
    this.boss = null;
    this.bossArenaActive = false;
    this.sequenceTimers = [];
    resetEnemyIds();
    this.stageStartTime = this.time.now;

    // Build world from data
    this.areaLoader = new AreaLoader(this, this.physics);
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
    this.player = new PlayerEntity(this, this.physics, this.particles, this.combat, startX, startY, this.projectiles);
    this.camera.follow(this.player.sprite, 0.1);
    this.camera.setDeadzone(160, 100);
    this.camera.setBounds(0, 0, area.totalWidth, GAME.HEIGHT);

    // Player light
    this.render.addLight({
      follow: () => this.player?.position ?? new Phaser.Math.Vector2(0, 0),
      radius: 140, color: COLORS.PLAYER_GLOW, intensity: 0.3, flicker: 0.05,
    });

    // HUD
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
      const e = new EnemyEntity(this, this.physics, this.particles, x, y, et, this.projectiles);
      this.enemies.push(e);
      this.render.addLight({
        follow: () => e.isAlive ? e.position : new Phaser.Math.Vector2(-9999, -9999),
        radius: 50, color: e.data.color, intensity: 0.2, flicker: 0.2,
      });
    }
  }

  private onCollisionStart = (event: MatterJS.Events.CollisionStartEvent): void => {
    for (const pair of event.pairs) {
      const aGo = (pair.bodyA as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      const bGo = (pair.bodyB as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      if (!aGo || !bGo) continue;
      const aIsPlayer = aGo.getData('entityType') === 'player';
      const bIsPlayer = bGo.getData('entityType') === 'player';
      // Section trigger
      const aSection = aGo.getData('sectionId') as number | undefined;
      const bSection = bGo.getData('sectionId') as number | undefined;
      if (aIsPlayer && bSection) { this.enterSection(bSection); }
      else if (bIsPlayer && aSection) { this.enterSection(aSection); }
      // Checkpoint
      else if (aIsPlayer && bGo.getData('isCheckpoint')) { this.activateCheckpoint(); }
      else if (bIsPlayer && aGo.getData('isCheckpoint')) { this.activateCheckpoint(); }
      // Boss entry
      else if (aIsPlayer && bGo.getData('isBossEntry')) { this.enterBossArena(); }
      else if (bIsPlayer && aGo.getData('isBossEntry')) { this.enterBossArena(); }
      // NPC interaction (handled via interact key, not collision)
      // Enemy contact
      if (aIsPlayer && bGo.getData('entityType') === 'enemy') { this.handleEnemyContact(bGo); }
      else if (bIsPlayer && aGo.getData('entityType') === 'enemy') { this.handleEnemyContact(aGo); }
      // Boss contact
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
    this.boss = new BossEntity(this, this.physics, this.particles, bossSection.bossId, x, y, this.projectiles, () => this.player.position);
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
    // Check nearby NPCs
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
    this.hud?.destroy();
    this.render?.destroy();
    this.camera.resetZoom();
    this.camera.stopFollow();
    this.camera.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT);
    this.physics.setWorldBounds(GAME.WIDTH, GAME.HEIGHT);
    // Note: InputSystem.destroy() only called in scene shutdown, not cleanupPlay.
    // PlayerEntity.destroy() handles its own input cleanup.
    this.paused = false;
  }

  // ================ PAUSE / OVERLAYS ================

  private togglePause(): void {
    if (this.state !== 'play') return;
    // Cooldown to prevent immediate re-pause from same button press
    const now = this.time.now;
    if (now - (this.lastPauseToggleAt ?? 0) < 300) return;
    this.lastPauseToggleAt = now;

    if (this.paused) {
      // Close any open sub-overlay first
      if (this.inSettings) { this.settingsUI.hide(); this.inSettings = false; this.pauseMenuUI.show(); return; }
      if (this.inSkills) { this.skillTreeUI.hide(); this.inSkills = false; this.pauseMenuUI.show(); return; }
      if (this.inInventory) { this.inventoryUI.hide(); this.inInventory = false; this.pauseMenuUI.show(); return; }
      if (this.inQuests) { this.questUI.hide(); this.inQuests = false; this.pauseMenuUI.show(); return; }
      if (this.inMap) { this.worldMapUI.hide(); this.inMap = false; this.pauseMenuUI.show(); return; }
      // Actually unpause
      this.paused = false;
      this.pauseMenuUI.hide();
      AudioSystem.play('uiClick');
    } else {
      this.paused = true;
      this.pauseMenuUI.show();
      AudioSystem.play('uiClick');
    }
  }

  private restartStage(): void {
    this.togglePause();
    CheckpointSystem.clear();
    this.cleanupPlay();
    this.setState('play');
  }

  private quitToMenu(): void {
    this.togglePause();
    this.cleanupPlay();
    this.setState('menu');
  }

  private fastTravel(areaId: string): void {
    WorldSystem.travelTo(areaId, 1);
    this.worldMapUI.hide();
    this.inMap = false;
    this.paused = false;
    this.pauseMenuUI.hide();
    this.cleanupPlay();
    this.setState('play');
  }

  private getNextWeapon(dir: number): import('../../data/types').WeaponId {
    const save = SaveSystem.getPlayer();
    const all = save.unlockedWeapons as import('../../data/types').WeaponId[];
    const idx = all.indexOf(save.currentWeapon as import('../../data/types').WeaponId);
    return all[(idx + dir + all.length) % all.length];
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
    // Explosion sequence
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
    // Show boss lore
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

  // ================ GAMEPAD NAVIGATION ================

  private menuNavCooldown = 0;

  /** Gamepad navigation for menu/gameover/victory screens. */
  private handleMenuGamepadNav(input: import('../../systems/InputSystem').InputState): void {
    this.menuNavCooldown -= 16;
    if (this.menuNavCooldown > 0) return;

    if (input.leftStickY < -0.3 || input.heldUp) {
      this.menuFocusIndex = (this.menuFocusIndex - 1 + this.menuButtons.length) % this.menuButtons.length;
      this.updateMenuFocus(); AudioSystem.play('uiHover');
      this.menuNavCooldown = 200;
    } else if (input.leftStickY > 0.3 || input.heldDown) {
      this.menuFocusIndex = (this.menuFocusIndex + 1) % this.menuButtons.length;
      this.updateMenuFocus(); AudioSystem.play('uiHover');
      this.menuNavCooldown = 200;
    }
    if (input.jumpPressed || input.firePressed) {
      AudioSystem.play('uiClick');
      this.menuButtons[this.menuFocusIndex]?.emit('pointerdown');
      this.menuNavCooldown = 300;
    }
  }

  /** Gamepad navigation for skill tree overlay. */
  private handleSkillTreeNav(input: import('../../systems/InputSystem').InputState): void {
    // Skill tree uses click — gamepad: B or Start to go back
    if (input.backPressed || input.pausePressed) {
      this.skillTreeUI.hide(); this.inSkills = false; this.pauseMenuUI.show();
    }
    // A/X = close skill tree (simplification — full gamepad nav would need tab+card focus)
    if (input.jumpPressed && input.interactPressed) {
      this.skillTreeUI.hide(); this.inSkills = false; this.pauseMenuUI.show();
    }
  }

  /** Gamepad navigation for inventory overlay. */
  private handleInventoryNav(input: import('../../systems/InputSystem').InputState): void {
    if (input.backPressed || input.pausePressed) {
      this.inventoryUI.hide(); this.inInventory = false; this.pauseMenuUI.show();
    }
  }

  // ================ MENU HELPERS ================

  private makeMenuBtn(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 320, 50, 0x0a1018, 0.9);
    bg.setStrokeStyle(1, 0x1a3040, 0.8);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { this.menuFocusIndex = this.menuButtons.indexOf(bg); this.updateMenuFocus(); AudioSystem.play('uiHover'); });
    bg.on('pointerdown', onClick);
    const textEl = this.add.text(x, y, label, { fontFamily: 'monospace', fontSize: '18px', color: '#5a6470' }).setOrigin(0.5);
    this.stateContainer!.add([bg, textEl]);
    this.menuButtons.push(bg);
  }

  private setupMenuNav(): void {
    this.menuNavHandler = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.menuFocusIndex = (this.menuFocusIndex - 1 + this.menuButtons.length) % this.menuButtons.length;
        this.updateMenuFocus(); AudioSystem.play('uiHover');
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.menuFocusIndex = (this.menuFocusIndex + 1) % this.menuButtons.length;
        this.updateMenuFocus(); AudioSystem.play('uiHover');
      } else if (e.code === 'Enter' || e.code === 'Space') {
        this.menuButtons[this.menuFocusIndex]?.emit('pointerdown');
      }
    };
    window.addEventListener('keydown', this.menuNavHandler);
    this.updateMenuFocus();
  }

  private updateMenuFocus(): void {
    this.menuButtons.forEach((bg, i) => {
      if (i === this.menuFocusIndex) {
        bg.setFillStyle(0x0d1820, 1);
        bg.setStrokeStyle(2, 0x39d0d8, 0.9);
        // Scale up slightly for focus
        bg.setScale(1.05);
        // Find the text child and update color
        const textEl = this.stateContainer?.list.find(c =>
          c instanceof Phaser.GameObjects.Text &&
          Math.abs((c as Phaser.GameObjects.Text).x - bg.x) < 1 &&
          Math.abs((c as Phaser.GameObjects.Text).y - bg.y) < 1
        ) as Phaser.GameObjects.Text | undefined;
        textEl?.setColor('#66f0ff');
      } else {
        bg.setFillStyle(0x0a1018, 0.9);
        bg.setStrokeStyle(1, 0x1a3040, 0.8);
        bg.setScale(1);
        const textEl = this.stateContainer?.list.find(c =>
          c instanceof Phaser.GameObjects.Text &&
          Math.abs((c as Phaser.GameObjects.Text).x - bg.x) < 1 &&
          Math.abs((c as Phaser.GameObjects.Text).y - bg.y) < 1
        ) as Phaser.GameObjects.Text | undefined;
        textEl?.setColor('#5a6470');
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
    InputSystem.destroy();
  }
}

export default GameScene;
