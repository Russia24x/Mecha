/**
 * MECHA: LAST PROTOCOL - GameScene
 * Single scene with internal state machine.
 * States: menu | map | play | victory | gameover | settings
 *
 * Designed for Phaser 4.2.1 — uses camera.filters API (not setPostPipeline),
 * variable-delta Matter physics (no fixedStep), and proper cleanup.
 */

import Phaser from 'phaser';
import { COLORS, GAME, PLAYER, STAGE_1 } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';
import { Save } from '../../shared/Save';
import { Effects } from '../../shared/Effects';
import { GamepadManager } from '../../shared/GamepadManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Player } from '../player/Player';
import { DamageSystem } from '../combat/DamageSystem';
import { Projectile } from '../combat/Projectile';
import { Enemy } from '../enemies/Enemy';
import { Boss } from '../boss/Boss';
import { HUD } from '../ui/HUD';
import { BossBar } from '../ui/BossBar';
import { Graphics } from '../rendering/Graphics';

type GameState = 'menu' | 'map' | 'play' | 'victory' | 'gameover' | 'settings';

export class GameScene extends Phaser.Scene {
  private state: GameState = 'menu';
  private stateContainer: Phaser.GameObjects.Container | null = null;
  private menuButtons: Phaser.GameObjects.Rectangle[] = [];
  private menuFocusIndex = 0;
  private menuNavHandler: ((e: KeyboardEvent) => void) | null = null;

  // Play state
  private player!: Player;
  private damageSystem!: DamageSystem;
  private physics!: PhysicsWorld;
  private graphics!: Graphics;
  private hud!: HUD;
  private bossBar!: BossBar;
  private boss: Boss | null = null;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private solids: Phaser.Physics.Matter.Image[] = [];
  private sectionTriggers: Phaser.Physics.Matter.Image[] = [];
  private currentSection = 1;
  private currentStageId: 1 = 1;
  private stageStartTime = 0;
  private bossArenaActive = false;
  private bossArenaTrigger: Phaser.Physics.Matter.Image | null = null;
  private sequenceTimers: Phaser.Time.TimerEvent[] = [];
  private cinematicApplied = false;

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    Effects.init();
    Effects.resume();
    GamepadManager.init();
    const settings = Save.getSettings();
    Effects.setMasterVolume(settings.masterVolume);
    Effects.setSfxVolume(settings.sfxVolume);
    Effects.setMuted(settings.muted);
    Graphics.setBrightness(settings.brightness);
    this.setState('menu');
  }

  // ================ STATE MACHINE ================

  setState(next: GameState): void {
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
      case 'map': this.buildMap(); break;
      case 'play': this.buildPlay(); break;
      case 'victory': this.buildVictory(); break;
      case 'gameover': this.buildGameOver(); break;
      case 'settings': this.buildSettings(); break;
    }
  }

  private cleanupState(): void {
    if (this.state === 'play') this.cleanupPlay();
    if (this.menuNavHandler) {
      window.removeEventListener('keydown', this.menuNavHandler);
      this.menuNavHandler = null;
    }
    if (this.stateContainer) {
      this.stateContainer.destroy(true);
      this.stateContainer = null;
    }
  }

  update(_time: number, deltaMs: number): void {
    if (this.state === 'play') {
      this.updatePlay(deltaMs);
    } else {
      GamepadManager.update();
      this.updateMenuNavigation(deltaMs);
    }
  }

  private updateMenuNavigation(deltaMs: number): void {
    // Simple gamepad menu navigation
    const gp = GamepadManager.getState();
    if (gp.leftStickY < -0.3 || gp.leftStickY > 0.3) {
      // Navigate handled by keydown handler
    }
  }

  // ================ MENU STATE ================

  private buildMenu(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    Effects.playMusic('menuAmbient');

    c.add(this.add.text(w / 2, h * 0.3, 'MECHA: LAST PROTOCOL', {
      fontFamily: 'monospace', fontSize: '48px', color: '#39d0d8',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5));

    const sy = h * 0.55;
    this.makeMenuBtn(w / 2, sy, '▶  START', () => { Effects.play('uiClick'); this.setState('play'); });
    this.makeMenuBtn(w / 2, sy + 60, '⚙  SETTINGS', () => { Effects.play('uiClick'); this.setState('settings'); });

    c.add(this.add.text(w / 2, h - 30, 'MVP 2.0  •  PHASER 4.2  •  MATTER.JS', {
      fontFamily: 'monospace', fontSize: '11px', color: '#3a4350',
    }).setOrigin(0.5));

    this.setupMenuNav();
    this.focusButton(0);
  }

  private makeMenuBtn(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 280, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { this.menuFocusIndex = this.menuButtons.indexOf(bg); this.updateMenuFocus(); Effects.play('uiHover'); });
    bg.on('pointerdown', onClick);
    const t = this.add.text(x, y, label, { fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0' }).setOrigin(0.5);
    this.stateContainer!.add([bg, t]);
    this.menuButtons.push(bg);
  }

  private setupMenuNav(): void {
    this.menuNavHandler = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.menuFocusIndex = (this.menuFocusIndex - 1 + this.menuButtons.length) % this.menuButtons.length;
        this.updateMenuFocus();
        Effects.play('uiHover');
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.menuFocusIndex = (this.menuFocusIndex + 1) % this.menuButtons.length;
        this.updateMenuFocus();
        Effects.play('uiHover');
      } else if (e.code === 'Enter' || e.code === 'Space') {
        this.menuButtons[this.menuFocusIndex]?.emit('pointerdown');
      }
    };
    window.addEventListener('keydown', this.menuNavHandler);
  }

  private updateMenuFocus(): void {
    this.menuButtons.forEach((bg, i) => {
      if (i === this.menuFocusIndex) {
        bg.setFillStyle(0x243040, 1);
        bg.setStrokeStyle(2, 0x66f0ff, 1);
      } else {
        bg.setFillStyle(0x1a2030, 0.95);
        bg.setStrokeStyle(1, 0x39d0d8, 0.6);
      }
    });
  }

  private focusButton(idx: number): void {
    this.menuFocusIndex = idx;
    this.updateMenuFocus();
  }

  // ================ SETTINGS STATE ================

  private buildSettings(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    c.add(this.add.text(w / 2, 50, 'SETTINGS', {
      fontFamily: 'monospace', fontSize: '32px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));
    let y = 130;
    c.add(this.add.text(w / 2 - 280, y, 'AUDIO', { fontFamily: 'monospace', fontSize: '14px', color: '#7a8090' }));
    y += 40;
    this.makeSlider(w / 2, y, 'Master Volume', Effects.getMasterVolume()); y += 50;
    this.makeSlider(w / 2, y, 'SFX Volume', Effects.getSfxVolume()); y += 50;
    y += 30;
    c.add(this.add.text(w / 2 - 280, y, 'BRIGHTNESS', { fontFamily: 'monospace', fontSize: '14px', color: '#7a8090' }));
    y += 40;
    this.makeSlider(w / 2, y, 'Brightness', Graphics.getBrightness()); y += 50;
    this.makeMenuBtn(w / 2, h - 50, '✓  BACK', () => { Effects.play('uiClick'); this.setState('menu'); });
  }

  private makeSlider(x: number, y: number, label: string, value: number): void {
    const c = this.stateContainer!;
    c.add(this.add.text(x - 200, y, label, { fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0' }).setOrigin(0, 0.5));
    const track = this.add.rectangle(x + 20, y, 240, 8, 0x202830).setStrokeStyle(1, 0x3a4350);
    c.add(track);
    const fill = this.add.rectangle(x + 20, y, 240 * value, 8, 0x39d0d8).setOrigin(0, 0.5);
    c.add(fill);
    const handle = this.add.circle(x + 20 + 240 * value, y, 10, 0x39d0d8).setStrokeStyle(2, 0xffffff, 0.6);
    handle.setInteractive({ useHandCursor: true });
    this.input.setDraggable(handle);
    handle.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => {
      const clamped = Phaser.Math.Clamp(dragX, x + 20, x + 20 + 240);
      handle.x = clamped;
      const v = (clamped - x - 20) / 240;
      fill.width = 240 * v;
      if (label === 'Master Volume') { Effects.setMasterVolume(v); Save.saveSettings({ masterVolume: v }); }
      else if (label === 'SFX Volume') { Effects.setSfxVolume(v); Save.saveSettings({ sfxVolume: v }); }
      else if (label === 'Brightness') { Graphics.setBrightness(v); Save.saveSettings({ brightness: v }); }
    });
    c.add(handle);
  }

  // ================ MAP STATE ================

  private buildMap(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    c.add(this.add.text(w / 2, 60, 'MISSION SELECT', {
      fontFamily: 'monospace', fontSize: '32px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));
    const save = Save.get();
    c.add(this.add.text(w / 2, 120, `Kills: ${save.totalKills}  |  Bosses: ${save.bossesKilled}`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0',
    }).setOrigin(0.5));
    // Stage card
    const x = w / 2, y = h / 2;
    const card = this.add.rectangle(x, y, 280, 220, 0x1a2030, 0.95).setStrokeStyle(2, 0x39d0d8, 0.8);
    c.add(card);
    c.add(this.add.text(x, y - 70, '01', { fontFamily: 'monospace', fontSize: '36px', color: '#39d0d8' }).setOrigin(0.5));
    c.add(this.add.text(x, y - 20, 'ABANDONED FACTORY', { fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0' }).setOrigin(0.5));
    c.add(this.add.text(x, y + 10, 'Stage 1 — Industrial Complex', { fontFamily: 'monospace', fontSize: '10px', color: '#7a8090' }).setOrigin(0.5));
    this.makeMenuBtn(x, y + 70, '▶  ENTER', () => { Effects.play('uiClick'); this.currentSection = 1; this.setState('play'); });
    this.makeMenuBtn(w / 2, h - 60, '←  BACK', () => { Effects.play('uiClick'); this.setState('menu'); });
    this.setupMenuNav();
    this.focusButton(0);
  }

  // ================ PLAY STATE ================

  private get stageData() { return STAGE_1; }

  private buildPlay(): void {
    const sd = this.stageData;
    Effects.playMusic('menuAmbient');
    this.cameras.main.setBackgroundColor(sd.bgColor);
    this.cameras.main.setBounds(0, 0, sd.TOTAL_WIDTH, GAME.HEIGHT);
    this.matter.world.setBounds(0, 0, sd.TOTAL_WIDTH, GAME.HEIGHT, true, true, true, true);
    this.matter.world.setGravity(0, 0.9);
    this.projectiles = [];
    this.enemies = [];
    this.boss = null;
    this.solids = [];
    this.sectionTriggers = [];
    this.bossArenaActive = false;
    this.bossArenaTrigger = null;
    this.sequenceTimers = [];
    this.cinematicApplied = false;
    this.stageStartTime = this.time.now;

    this.graphics = new Graphics(this);
    this.buildStageGeometry();
    this.damageSystem = new DamageSystem(this);

    const startX = (this.currentSection - 1) * sd.SECTION_WIDTH + 200;
    this.player = new Player(this, startX, GAME.HEIGHT - 300, this.projectiles, this.damageSystem);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(160, 100);

    this.hud = new HUD(this, this.player);
    this.bossBar = new BossBar(this, this.boss);

    this.spawnEnemiesForSection(this.currentSection);
    this.buildSectionTriggers();

    EventBus.on('PLAYER_DEAD', this.onPlayerDied, this);
    EventBus.on('ENEMY_DEAD', this.onEnemyKilled, this);
    EventBus.on('PLAYER_DAMAGED', this.onPlayerDamaged, this);

    const sec = sd.SECTIONS[this.currentSection - 1];
    EventBus.emit('GAME_STATE', { sectionId: sec.id, sectionName: sec.name });
  }

  private buildStageGeometry(): void {
    this.physics = new PhysicsWorld(this);
    // Floor
    this.addSolid(this.stageData.TOTAL_WIDTH / 2, GAME.HEIGHT, this.stageData.TOTAL_WIDTH, 80);
    // Ceiling
    this.addSolid(this.stageData.TOTAL_WIDTH / 2, -20, this.stageData.TOTAL_WIDTH, 40);
    // Per-section platforms
    for (let i = 0; i < this.stageData.SECTIONS.length; i++) {
      this.buildSectionGeometry(i + 1, this.stageData.SECTIONS[i].x);
    }
  }

  private buildSectionGeometry(id: number, baseX: number): void {
    switch (id) {
      case 2:
        this.addSolid(baseX + 400, GAME.HEIGHT - 80, 60, 40);
        this.addSolid(baseX + 900, GAME.HEIGHT - 80, 60, 40);
        break;
      case 3:
        this.addSolid(baseX + 200, GAME.HEIGHT - 200, 180, 20);
        this.addSolid(baseX + 500, GAME.HEIGHT - 320, 180, 20);
        this.addSolid(baseX + 800, GAME.HEIGHT - 240, 180, 20);
        this.addSolid(baseX + 1080, GAME.HEIGHT - 140, 180, 80);
        break;
      case 4:
        this.addSolid(baseX + 400, GAME.HEIGHT - 200, 40, 160);
        this.addSolid(baseX + 840, GAME.HEIGHT - 200, 40, 160);
        this.addSolid(baseX + 600, GAME.HEIGHT - 280, 100, 20);
        break;
      case 5:
        this.addSolid(baseX + 640, GAME.HEIGHT - 120, 80, 80);
        break;
      case 6:
        this.addSolid(baseX + 80, GAME.HEIGHT - 250, 40, 210);
        this.addSolid(baseX + this.stageData.SECTION_WIDTH - 80, GAME.HEIGHT - 250, 40, 210);
        break;
    }
  }

  private addSolid(x: number, y: number, w: number, h: number): void {
    const s = this.physics.addStaticRect(x, y, w, h);
    const vis = this.add.rectangle(x, y, w, h, COLORS.METAL_DARK, 1);
    vis.setStrokeStyle(2, COLORS.RUST, 0.4);
    vis.setDepth(5);
    this.solids.push(s);
  }

  private buildSectionTriggers(): void {
    for (let i = 1; i <= this.stageData.SECTIONS.length; i++) {
      const x = (i - 1) * this.stageData.SECTION_WIDTH + 80;
      const trigger = this.physics.addSensor(x, GAME.HEIGHT / 2, 40, GAME.HEIGHT, `section-${i}`);
      trigger.setData('sectionId', i);
      this.sectionTriggers.push(trigger);
    }
    this.matter.world.on('collisionstart', this.onCollisionStart, this);
    // Checkpoint triggers
    for (const secId of this.stageData.CHECKPOINT_SECTIONS) {
      const cpX = (secId - 1) * this.stageData.SECTION_WIDTH + 640;
      const cp = this.physics.addSensor(cpX, GAME.HEIGHT - 80, 60, 60, `checkpoint-${secId}`);
      cp.setData('isCheckpoint', true);
      cp.setData('checkpointSection', secId);
    }
    // Boss entry trigger
    const bossX = (6 - 1) * this.stageData.SECTION_WIDTH + 400;
    this.bossArenaTrigger = this.physics.addSensor(bossX, GAME.HEIGHT - 100, 40, 200, 'boss-entry');
    this.bossArenaTrigger.setData('isBossEntry', true);
  }

  private spawnEnemiesForSection(id: number): void {
    const sec = this.stageData.SECTIONS[id - 1];
    for (const type of sec.enemies) {
      if (type === 'boss') continue;
      const x = sec.x + 400 + Math.random() * 400;
      const et = type as 'drone' | 'spider' | 'heavy';
      const y = et === 'drone' ? GAME.HEIGHT - 100 : GAME.HEIGHT - 200;
      const e = new Enemy(this, x, y, et, this.projectiles);
      this.enemies.push(e);
    }
  }

  private onCollisionStart = (event: MatterJS.Events.CollisionStartEvent): void => {
    for (const pair of event.pairs) {
      const aGo = (pair.bodyA as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      const bGo = (pair.bodyB as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      if (!aGo || !bGo) continue;
      const aIsPlayer = aGo.getData('entityType') === 'player';
      const bIsPlayer = bGo.getData('entityType') === 'player';
      const aSection = aGo.getData('sectionId') as number | undefined;
      const bSection = bGo.getData('sectionId') as number | undefined;
      if (aIsPlayer && bSection) this.enterSection(bSection);
      else if (bIsPlayer && aSection) this.enterSection(aSection);
      else if (aIsPlayer && bGo.getData('isCheckpoint')) this.activateCheckpoint();
      else if (bIsPlayer && aGo.getData('isCheckpoint')) this.activateCheckpoint();
      else if (aIsPlayer && bGo.getData('isBossEntry')) this.enterBossArena();
      else if (bIsPlayer && aGo.getData('isBossEntry')) this.enterBossArena();
      if (aIsPlayer && bGo.getData('entityType') === 'enemy') this.handleEnemyContact(bGo);
      else if (bIsPlayer && aGo.getData('entityType') === 'enemy') this.handleEnemyContact(aGo);
    }
  };

  private enterSection(id: number): void {
    if (id === this.currentSection) return;
    this.currentSection = id;
    const sec = this.stageData.SECTIONS[id - 1];
    EventBus.emit('GAME_STATE', { sectionId: sec.id, sectionName: sec.name });
    this.spawnEnemiesForSection(id);
  }

  private activateCheckpoint(): void {
    Save.saveCheckpoint({ section: this.currentSection, x: this.player.sprite.x, y: this.player.sprite.y, timestamp: Date.now() });
    EventBus.emit('CHECKPOINT', { section: this.currentSection });
    Effects.play('checkpoint');
    this.hud.toast('CHECKPOINT SAVED');
  }

  private enterBossArena(): void {
    if (this.bossArenaActive) return;
    this.bossArenaActive = true;
    Effects.playMusic('menuAmbient');
    const x = (6 - 1) * this.stageData.SECTION_WIDTH + 800;
    const y = GAME.HEIGHT - 320;
    this.boss = new Boss(this, x, y, this.projectiles, () => this.player.position);
    this.bossBar.boss = this.boss;
    this.bossBar.show();
    Effects.screenFlash(this, 0xff3030, 0.35, 500);
    this.cameras.main.shake(400, 0.012);
    this.addSolid(x - 280, GAME.HEIGHT - 200, 30, 200);
  }

  private handleEnemyContact(enemyGo: Phaser.GameObjects.GameObject): void {
    const id = enemyGo.getData('id') as string | undefined;
    const dmg = id?.startsWith('drone-') ? 8 : id?.startsWith('spider-') ? 14 : id?.startsWith('heavy-') ? 22 : 8;
    const ok = this.player.takeDamage(dmg);
    if (ok) {
      const enemyX = (enemyGo as unknown as { x?: number }).x;
      if (typeof enemyX === 'number' && this.player.sprite?.active) {
        const dir = this.player.sprite.x < enemyX ? -1 : 1;
        this.player.sprite.setVelocityX(dir * 4);
        this.player.sprite.setVelocityY(-4);
      }
    }
  }

  private updatePlay(deltaMs: number): void {
    if (!this.player) return;
    this.player.update(deltaMs);
    this.graphics.update(this.time.now, deltaMs);
    this.hud?.update();
    this.bossBar?.update();
    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(this);
      if (!p.isAlive) this.projectiles.splice(i, 1);
    }
    // Enemies
    const playerPos = this.player.position;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.isAlive || !e.sprite || !e.sprite.active) { this.enemies.splice(i, 1); continue; }
      try { e.update(deltaMs, playerPos); } catch { this.enemies.splice(i, 1); continue; }
      if (!e.isAlive) this.enemies.splice(i, 1);
    }
    // Boss
    if (this.boss && this.boss.isAlive && this.boss.sprite && this.boss.sprite.active) {
      try { this.boss.update(deltaMs); } catch { /* */ }
    }
    // Out of bounds
    if (this.player.sprite.y > GAME.HEIGHT + 80) {
      this.player.takeDamage(25);
      this.respawnPlayerAtSection();
    }
    // Boss arena zoom
    if (this.bossArenaActive && this.boss && this.boss.isAlive) {
      this.cameras.main.setZoom(Phaser.Math.Linear(this.cameras.main.zoom, 0.85, 0.04));
    }
  }

  private respawnPlayerAtSection(): void {
    const sec = this.stageData.SECTIONS[this.currentSection - 1];
    this.player.sprite.setPosition(sec.x + 200, GAME.HEIGHT - 300);
    this.player.sprite.setVelocity(0, 0);
  }

  private cleanupPlay(): void {
    EventBus.off('PLAYER_DEAD', this.onPlayerDied, this);
    EventBus.off('ENEMY_DEAD', this.onEnemyKilled, this);
    EventBus.off('PLAYER_DAMAGED', this.onPlayerDamaged, this);
    this.matter.world.off('collisionstart', this.onCollisionStart, this);
    this.projectiles.forEach(p => p.kill());
    this.projectiles = [];
    this.player?.destroy();
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.boss?.destroy();
    this.boss = null;
    this.solids.forEach(s => { if (s && s.active) s.destroy(); });
    this.solids = [];
    this.sectionTriggers.forEach(t => { if (t && t.active) t.destroy(); });
    this.sectionTriggers = [];
    this.bossArenaTrigger?.destroy();
    this.bossArenaTrigger = null;
    this.tweens.killAll();
    this.sequenceTimers.forEach(t => t.remove());
    this.sequenceTimers = [];
    this.hud?.destroy();
    this.bossBar?.destroy();
    this.graphics?.destroy();
    this.cameras.main.setZoom(1);
    this.cameras.main.stopFollow();
    this.cameras.main.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT);
    this.matter.world.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT, true, true, true, true);
  }

  // ================ EVENT HANDLERS ================

  private onPlayerDamaged = (_payload: unknown): void => {
    // HUD polls player state directly, no action needed here.
  };

  private onPlayerDied = (): void => {
    EventBus.off('PLAYER_DEAD', this.onPlayerDied, this);
    Effects.explosion(this, this.player.sprite.x, this.player.sprite.y, COLORS.PLAYER, 1.2);
    this.cameras.main.shake(400, 0.012);
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.scheduleDelayed(900, () => {
      this.cameras.main.fadeIn(300, 0, 0, 0);
      this.setState('gameover');
    });
  };

  private onEnemyKilled = (payload: { id: string; score: number; x?: number; y?: number }): void => {
    Save.recordKill();
    if (payload.x && payload.y) {
      Effects.explosion(this, payload.x, payload.y, COLORS.ENEMY_DRONE, 0.6);
    }
  };

  // ================ GAMEOVER STATE ================

  private buildGameOver(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85).setDepth(200);
    c.add(overlay);
    c.add(this.add.text(w / 2, h * 0.3, 'GAME OVER', {
      fontFamily: 'monospace', fontSize: '56px', color: '#ff4040',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(201));
    this.makeMenuBtn(w / 2, h * 0.55, '↻  RETRY', () => {
      Effects.play('uiClick');
      Save.clearCheckpoint();
      this.currentSection = 1;
      this.setState('play');
    });
    this.makeMenuBtn(w / 2, h * 0.65, '⌂  QUIT TO MENU', () => {
      Effects.play('uiClick');
      this.setState('menu');
    });
    this.setupMenuNav();
    this.focusButton(0);
  }

  // ================ VICTORY STATE ================

  private buildVictory(): void {
    const c = this.stateContainer!;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    c.add(this.add.text(w / 2, h * 0.35, 'VICTORY', {
      fontFamily: 'monospace', fontSize: '72px', color: '#ffe060',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5));
    c.add(this.add.text(w / 2, h * 0.5, '— GUARDIAN AX-09 DESTROYED —', {
      fontFamily: 'monospace', fontSize: '18px', color: '#cfd6e0',
    }).setOrigin(0.5));
    this.makeMenuBtn(w / 2, h * 0.7, '⌂  RETURN TO MENU', () => {
      Effects.play('uiClick');
      this.setState('menu');
    });
    this.setupMenuNav();
    this.focusButton(0);
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
}

export default GameScene;
