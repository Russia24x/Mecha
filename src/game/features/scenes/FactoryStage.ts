/**
 * MECHA: LAST PROTOCOL - FactoryStage
 * The main gameplay scene. Builds all 6 sections of the Abandoned Factory,
 * wires up Player + Combat + Enemies + Boss + UI + Rendering.
 *
 * Each section is 1280px wide. The world scrolls horizontally.
 */
import Phaser from 'phaser';
import { COLORS, GAME, PLAYER, STAGE } from '../../shared/Constants';
import { EventBus } from '../../shared/EventBus';
import { Save } from '../../shared/Save';
import { SkillTree } from '../../shared/SkillTree';
import { Effects } from '../../shared/Effects';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Player } from '../player/Player';
import { DamageSystem } from '../combat/DamageSystem';
import { Projectile } from '../combat/Projectile';
import { Enemy } from '../enemies/Enemy';
import type { EnemyTypeId } from '../enemies/EnemyTypes';
import { Boss } from '../boss/Boss';
import { HUD } from '../ui/HUD';
import { BossBar } from '../ui/BossBar';
import { Parallax } from '../rendering/Parallax';
import { Graphics } from '../rendering/Graphics';
import { Ragdoll } from '../combat/Ragdoll';

interface InitData {
  section?: number;
  restoreX?: number;
  restoreY?: number;
}

export class FactoryStage extends Phaser.Scene {
  // Feature modules
  private physics!: PhysicsWorld;
  private player!: Player;
  private damageSystem!: DamageSystem;
  
  private hud!: HUD;
  private bossBar!: BossBar;
  private parallax!: Parallax;
  private graphics!: Graphics;
  

  // World entities
  private projectiles: Projectile[] = [];
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;

  // Stage state
  private currentSection = 1;
  private sectionTriggers: Phaser.Physics.Matter.Image[] = [];
  private checkpointTrigger: Phaser.Physics.Matter.Image | null = null;
  private bossArenaTrigger: Phaser.Physics.Matter.Image | null = null;
  private bossArenaActive = false;
  private stageStartTime = 0;

  // Solid bodies (for ground/walls)
  private solids: Phaser.Physics.Matter.Image[] = [];

  constructor() {
    super({ key: 'FactoryStage' });
  }

  init(data: InitData): void {
    this.currentSection = data.section ?? 1;
    this.projectiles = [];
    this.enemies = [];
    this.boss = null;
    this.solids = [];
    this.sectionTriggers = [];
    this.bossArenaActive = false;
    this.stageStartTime = this.time.now;
  }

  create(): void {
    Effects.init();
    Effects.resume();
    Effects.playMusic('factoryDrone');

    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);
    this.cameras.main.setBounds(0, 0, STAGE.TOTAL_WIDTH, GAME.HEIGHT);
    this.matter.world.setBounds(0, 0, STAGE.TOTAL_WIDTH, GAME.HEIGHT, true, true, true, true);
    this.matter.world.setGravity(0, 0.9);

    // ----- Background -----
    this.parallax = new Parallax(this);
    this.graphics = new Graphics(this);

    // ----- Build stage geometry -----
    this.buildStage();

    // ----- Player -----
    const startX = (this.currentSection - 1) * STAGE.SECTION_WIDTH + 200;
    const startY = GAME.HEIGHT - 220;
    this.player = new Player(this, startX, GAME.HEIGHT - 300, this.projectiles, this.damageSystem);
    this.damageSystem = new DamageSystem(this);
    
    
    // For MVP testing: unlock all weapons so player can switch between them.
    // In a full game, weapons would unlock progressively via onEnemyKilled.
    this.player.unlockWeapon('shotgun');
    this.player.unlockWeapon('laser');
    this.player.unlockWeapon('rocket');
    EventBus.emit('player:weapon-changed', { id: 'plasma', name: 'Plasma Rifle' });
    

    // Camera
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(160, 100);

    // Player light
    this.graphics.addLight({
      follow: () => {
        if (!this.player || !this.player.sprite || !this.player.sprite.active) return new Phaser.Math.Vector2(0, 0);
        return this.player.position;
      },
      radius: 180,
      color: COLORS.PLAYER_GLOW,
      intensity: 0.4,
      flicker: 0.05,
    });

    // ----- UI -----
    this.hud = new HUD(this);
    this.bossBar = new BossBar(this);
    

    // ----- Spawn enemies for current section only (initial) -----
    this.spawnEnemiesForSection(this.currentSection);

    // ----- Section triggers -----
    this.buildSectionTriggers();

    // ----- Event handlers -----
    EventBus.on('player:died', this.onPlayerDied, this);
    EventBus.on('enemy:killed', this.onEnemyKilled, this);
    EventBus.on('boss:dead', this.onBossDead, this);
    EventBus.on('boss:stage-defeated', this.onBossStageDefeated, this);

    // Initial section broadcast
    const sec = STAGE.SECTIONS[this.currentSection - 1];
    EventBus.emit('stage:section-changed', { id: sec.id, name: sec.name });
  }

  update(_time: number, deltaMs: number): void {
    if (!this.player) return;

    this.player.update(deltaMs);
    this.graphics.update(this.time.now);

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(this);
      if (!p.isAlive) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update enemies
    const playerPos = this.player.position;
    const cx = this.cameras.main.scrollX + GAME.WIDTH / 2;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      // Guard: sprite may have been destroyed by a kill() call this frame
      if (!e.isAlive || !e.sprite || !e.sprite.active) {
        this.enemies.splice(i, 1);
        continue;
      }
      // Only update enemies within ~1.5 screens of camera center for perf
      if (Math.abs(e.sprite.x - cx) > GAME.WIDTH * 1.2) continue;
      try {
        e.update(deltaMs, playerPos);
      } catch {
        // enemy sprite was destroyed mid-update — remove safely
        this.enemies.splice(i, 1);
        continue;
      }
      if (!e.isAlive) {
        this.enemies.splice(i, 1);
      }
    }

    // Update boss (guard against destroyed sprite)
    if (this.boss && this.boss.isAlive && this.boss.sprite && this.boss.sprite.active) {
      try {
        this.boss.update(deltaMs);
      } catch {
        // boss sprite destroyed mid-update — will be cleaned up by event handler
      }
    }

    // Update parallax (flicker hooks)
    this.parallax.update(deltaMs);
    
    // Update ragdolls (despawn old ones)
    Ragdoll.update(this);

    // Out-of-bounds respawn (fell into pit)
    if (this.player.sprite.y > GAME.HEIGHT + 80) {
      this.player.takeDamage(25);
      this.respawnPlayerAtSection();
    }

    // Boss arena camera zoom
    if (this.bossArenaActive && this.boss && this.boss.isAlive) {
      const targetZoom = 0.85;
      const cur = this.cameras.main.zoom;
      this.cameras.main.setZoom(Phaser.Math.Linear(cur, targetZoom, 0.04));
    }
  }

  // ---------------- Stage geometry ----------------

  private buildStage(): void {
    this.physics = new PhysicsWorld(this);

    // Floor: spans entire world
    const floorY = GAME.HEIGHT - 40;
    this.addSolid(STAGE.TOTAL_WIDTH / 2, floorY + 40, STAGE.TOTAL_WIDTH, 80, COLORS.METAL_DARK);
    // Top wall (invisible)
    this.addSolid(STAGE.TOTAL_WIDTH / 2, -20, STAGE.TOTAL_WIDTH, 40, 0x000000);

    // Section-specific geometry
    for (let i = 0; i < STAGE.SECTIONS.length; i++) {
      const sec = STAGE.SECTIONS[i];
      const baseX = sec.x;
      this.buildSectionGeometry(i + 1, baseX);
    }
  }

  private buildSectionGeometry(sectionId: number, baseX: number): void {
    switch (sectionId) {
      case 1: // Tutorial Zone: flat, no obstacles — focus on movement + dash
        // (intentionally empty: pure flat corridor)
        break;
      case 2: // Combat Room A: flat with two low crates (don't block bullets)
        this.addSolid(baseX + 400, GAME.HEIGHT - 80, 60, 40, COLORS.METAL_DARK);
        this.addSolid(baseX + 900, GAME.HEIGHT - 80, 60, 40, COLORS.METAL_DARK);
        break;
      case 3: // Platform Section: vertical platforms
        this.addSolid(baseX + 250, GAME.HEIGHT - 200, 200, 20, COLORS.METAL);
        this.addSolid(baseX + 550, GAME.HEIGHT - 320, 200, 20, COLORS.METAL);
        this.addSolid(baseX + 850, GAME.HEIGHT - 220, 200, 20, COLORS.METAL);
        this.addSolid(baseX + 1100, GAME.HEIGHT - 120, 180, 80, COLORS.METAL_DARK);
        break;
      case 4: // Combat Room B: pillars + ramps
        this.addSolid(baseX + 400, GAME.HEIGHT - 200, 40, 160, COLORS.METAL_DARK);
        this.addSolid(baseX + 840, GAME.HEIGHT - 200, 40, 160, COLORS.METAL_DARK);
        this.addSolid(baseX + 600, GAME.HEIGHT - 280, 100, 20, COLORS.METAL);
        break;
      case 5: // Checkpoint: open room
        this.addSolid(baseX + 640, GAME.HEIGHT - 120, 80, 80, COLORS.METAL);
        break;
      case 6: // Boss Arena: large open space with side walls
        this.addSolid(baseX + 80, GAME.HEIGHT - 250, 40, 210, COLORS.METAL_DARK);
        this.addSolid(baseX + STAGE.SECTION_WIDTH - 80, GAME.HEIGHT - 250, 40, 210, COLORS.METAL_DARK);
        break;
    }
  }

  private addSolid(x: number, y: number, w: number, h: number, color: number): Phaser.Physics.Matter.Image {
    const s = this.physics.addStaticRect(x, y, w, h);
    // Visible shell
    const vis = this.add.rectangle(x, y, w, h, color, 1);
    vis.setStrokeStyle(2, COLORS.RUST, 0.4);
    vis.setDepth(5);
    s.setData('visual', vis);
    this.solids.push(s);
    return s;
  }

  // ---------------- Section triggers ----------------

  private buildSectionTriggers(): void {
    for (let i = 1; i <= STAGE.SECTIONS.length; i++) {
      const x = (i - 1) * STAGE.SECTION_WIDTH + 80;
      const trigger = this.physics.addSensor(x, GAME.HEIGHT / 2, 40, GAME.HEIGHT, `section-${i}`);
      trigger.setData('sectionId', i);
      this.sectionTriggers.push(trigger);
    }
    this.matter.world.on('collisionstart', this.onCollisionStart, this);

    // Checkpoint trigger (section 5)
    const cpX = (5 - 1) * STAGE.SECTION_WIDTH + 640;
    this.checkpointTrigger = this.physics.addSensor(cpX, GAME.HEIGHT - 80, 60, 60, 'checkpoint');
    this.checkpointTrigger.setData('isCheckpoint', true);

    // Boss arena trigger (section 6 entry)
    const bossX = (6 - 1) * STAGE.SECTION_WIDTH + 200;
    this.bossArenaTrigger = this.physics.addSensor(bossX, GAME.HEIGHT / 2, 30, GAME.HEIGHT, 'boss-arena-entry');
    this.bossArenaTrigger.setData('isBossEntry', true);
  }

  private onCollisionStart = (event: MatterJS.Events.CollisionStartEvent) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA as MatterJS.BodyType;
      const b = pair.bodyB as MatterJS.BodyType;
      const aGo = (a as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      const bGo = (b as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject;
      if (!aGo || !bGo) continue;

      // Player ↔ section trigger
      const aIsPlayer = aGo.getData('entityType') === 'player';
      const bIsPlayer = bGo.getData('entityType') === 'player';
      const aSection = aGo.getData('sectionId') as number | undefined;
      const bSection = bGo.getData('sectionId') as number | undefined;
      const aCp = aGo.getData('isCheckpoint');
      const bCp = bGo.getData('isCheckpoint');
      const aBoss = aGo.getData('isBossEntry');
      const bBoss = bGo.getData('isBossEntry');

      if (aIsPlayer && bSection) this.enterSection(bSection);
      else if (bIsPlayer && aSection) this.enterSection(aSection);
      else if (aIsPlayer && bCp) this.activateCheckpoint();
      else if (bIsPlayer && aCp) this.activateCheckpoint();
      else if (aIsPlayer && bBoss) this.enterBossArena();
      else if (bIsPlayer && aBoss) this.enterBossArena();

      // Player ↔ enemy contact damage
      if (aIsPlayer && bGo.getData('entityType') === 'enemy') {
        this.handlePlayerEnemyContact(bGo);
      } else if (bIsPlayer && aGo.getData('entityType') === 'enemy') {
        this.handlePlayerEnemyContact(aGo);
      }
      // Player ↔ boss contact damage
      if (aIsPlayer && bGo.getData('entityType') === 'boss' && this.boss) {
        this.player.takeDamage(this.boss.getContactDamage());
      } else if (bIsPlayer && aGo.getData('entityType') === 'boss' && this.boss) {
        this.player.takeDamage(this.boss.getContactDamage());
      }
    }
  };

  private handlePlayerEnemyContact(enemyGo: Phaser.GameObjects.GameObject): void {
    const enemy = enemyGo.getData('entity') as { position?: Phaser.Math.Vector2; sprite?: Phaser.Physics.Matter.Image } | undefined;
    const dmg = this.lookupEnemyContactDamage(enemyGo);
    if (dmg <= 0) return;
    const ok = this.player.takeDamage(dmg);
    if (ok && enemy && enemy.sprite) {
      const dir = this.player.sprite.x < enemy.sprite.x ? -1 : 1;
      this.player.sprite.setVelocityX(dir * 4);
      this.player.sprite.setVelocityY(-4);
    }
  }

  private lookupEnemyContactDamage(go: Phaser.GameObjects.GameObject): number {
    const type = go.getData('entityType');
    const id = go.getData('id') as string | undefined;
    if (type !== 'enemy' || !id) return 0;
    if (id.startsWith('drone-')) return 8;
    if (id.startsWith('spider-')) return 14;
    if (id.startsWith('heavy-')) return 22;
    return 8;
  }

  private enterSection(sectionId: number): void {
    if (sectionId === this.currentSection) return;
    this.currentSection = sectionId;
    const sec = STAGE.SECTIONS[sectionId - 1];
    EventBus.emit('stage:section-changed', { id: sec.id, name: sec.name });
    this.spawnEnemiesForSection(sectionId);
  }

  private spawnEnemiesForSection(sectionId: number): void {
    const sec = STAGE.SECTIONS[sectionId - 1];
    const baseX = sec.x;
    for (const type of sec.enemies) {
      if (type === 'boss') continue; // spawned separately
      const x = baseX + 400 + Math.random() * 400;
      const y = GAME.HEIGHT - 200;
      const enemyType = type as EnemyTypeId;
      const spawnY = enemyType === 'drone' ? GAME.HEIGHT - 100 : y;
      const e = new Enemy(this, x, spawnY, enemyType, this.projectiles);
      this.enemies.push(e);

      // attach a light to enemy for atmosphere
      const enemyColor = enemyType === 'drone' ? COLORS.ENEMY_DRONE : enemyType === 'spider' ? COLORS.ENEMY_SPIDER : COLORS.ENEMY_HEAVY;
      const enemyRef = e;
      this.graphics.addLight({
        follow: () => {
          if (!enemyRef.isAlive || !enemyRef.sprite || !enemyRef.sprite.active) return new Phaser.Math.Vector2(-9999, -9999);
          return new Phaser.Math.Vector2(enemyRef.sprite.x, enemyRef.sprite.y);
        },
        radius: 60,
        color: enemyColor,
        intensity: 0.25,
        flicker: 0.2,
      });
    }
  }

  private activateCheckpoint(): void {
    const x = this.player.sprite.x;
    const y = this.player.sprite.y;
    Save.saveCheckpoint({
      section: this.currentSection,
      x, y,
      timestamp: Date.now(),
    });
    EventBus.emit('player:checkpoint', { section: this.currentSection });
    Effects.play('checkpoint');
    Effects.screenFlash(this, 0x40d070, 0.18, 300);
  }

  private enterBossArena(): void {
    if (this.bossArenaActive) return;
    this.bossArenaActive = true;
    Effects.playMusic('bossFight');
    // Spawn boss (Stage 1)
    const x = (6 - 1) * STAGE.SECTION_WIDTH + 800;
    const y = GAME.HEIGHT - 320;
    this.boss = new Boss(this, x, y, this.projectiles, () => {
      if (!this.player || !this.player.sprite || !this.player.sprite.active) return new Phaser.Math.Vector2(0, 0);
      return this.player.position;
    }, 1);
    const bossRef1 = this.boss;
    // Boss light
    this.graphics.addLight({
      follow: () => {
        if (!bossRef1.isAlive || !bossRef1.sprite || !bossRef1.sprite.active) return new Phaser.Math.Vector2(-9999, -9999);
        return bossRef1.position;
      },
      radius: 240,
      color: COLORS.BOSS_GLOW,
      intensity: 0.45,
      flicker: 0.08,
    });
    this.bossBar.show();
    Effects.screenFlash(this, 0xff3030, 0.35, 500);
    this.cameras.main.shake(400, 0.012);
    // Wall off the arena exit so the player can't run away
    this.addSolid(x - 280, GAME.HEIGHT - 200, 30, 200, COLORS.RUST);
  }

  // ---------------- Event handlers ----------------

  private onPlayerDied = (): void => {
    // Immediately unsubscribe to prevent duplicate death handling
    EventBus.off('player:died', this.onPlayerDied, this);
    Effects.explosion(this, this.player.sprite.x, this.player.sprite.y, COLORS.PLAYER, 1.2);
    this.cameras.main.shake(400, 0.012);
    this.cameras.main.fade(700, 0, 0, 0);
    this.time.delayedCall(1100, () => {
      const cp = Save.get().lastCheckpoint;
      if (cp) {
        this.scene.start('FactoryStage', { section: cp.section, restoreX: cp.x, restoreY: cp.y });
      } else {
        this.scene.start('FactoryStage', { section: 1 });
      }
    });
  };

  private onEnemyKilled = (payload: { id: string; score: number }): void => {
    Save.recordKill();
    SkillTree.recordKill();
    Effects.play('enemyHit');
    const enemy = this.enemies.find(e => e.id === payload.id);
    if (enemy) {
      Effects.explosion(this, enemy.sprite.x, enemy.sprite.y, COLORS.ENEMY_DRONE, 0.6);
    }
    // Unlock weapons based on enemy type killed
    if (payload.id.startsWith('spider-') && !this.player.hasWeapon('shotgun')) {
      this.player.unlockWeapon('shotgun');
      EventBus.emit('ui:toast', { msg: 'SHOTGUN UNLOCKED' });
      this.hud.toast('WEAPON UNLOCKED: SCATTER CANNON');
    } else if (payload.id.startsWith('heavy-') && !this.player.hasWeapon('rocket')) {
      this.player.unlockWeapon('rocket');
      this.hud.toast('WEAPON UNLOCKED: ROCKET LAUNCHER');
    } else if (payload.id.startsWith('drone-') && !this.player.hasWeapon('laser') && this.enemies.filter(e => e.id.startsWith('drone-')).length === 0) {
      this.player.unlockWeapon('laser');
      this.hud.toast('WEAPON UNLOCKED: LASER LANCE');
    }
  };

  private onBossStageDefeated = (payload: { stage: number; id: string }): void => {
    // Stage 1 boss defeated → spawn Stage 2 after a brief intermission
    if (payload.stage !== 1) return;
    const elapsed = this.time.now - this.stageStartTime;

    // Big explosion sequence
    Effects.explosion(this, this.boss!.position.x, this.boss!.position.y, COLORS.BOSS, 2.4);
    this.time.delayedCall(300, () => {
      if (this.boss) Effects.explosion(this, this.boss.position.x + 60, this.boss.position.y - 40, COLORS.BOSS, 1.8);
    });
    this.time.delayedCall(600, () => {
      if (this.boss) Effects.explosion(this, this.boss.position.x - 80, this.boss.position.y + 30, COLORS.BOSS, 1.6);
    });
    this.cameras.main.flash(500, 255, 255, 255);

    // Clear the boss reference + spawn Stage 2 after delay
    this.time.delayedCall(1800, () => {
      this.boss = null;
      this.spawnBossStage2();
    });
  };

  private spawnBossStage2(): void {
    const x = (6 - 1) * STAGE.SECTION_WIDTH + 800;
    const y = GAME.HEIGHT - 320;
    this.boss = new Boss(this, x, y, this.projectiles, () => {
      if (!this.player || !this.player.sprite || !this.player.sprite.active) return new Phaser.Math.Vector2(0, 0);
      return this.player.position;
    }, 2);
    const bossRef2 = this.boss;
    this.graphics.addLight({
      follow: () => {
        if (!bossRef2.isAlive || !bossRef2.sprite || !bossRef2.sprite.active) return new Phaser.Math.Vector2(-9999, -9999);
        return bossRef2.position;
      },
      radius: 280,
      color: 0xff2080,
      intensity: 0.55,
      flicker: 0.1,
    });
    Effects.screenFlash(this, 0xff2080, 0.45, 600);
    this.cameras.main.shake(600, 0.016);
    Effects.play('phaseChange');
  }

  private onBossDead = (): void => {
    const elapsed = this.time.now - this.stageStartTime;
    Save.recordBossTime(elapsed);
    SkillTree.recordBossKill();

    // Massive explosion sequence
    Effects.explosion(this, this.boss!.position.x, this.boss!.position.y, 0xff2080, 3.0);
    this.time.delayedCall(300, () => {
      if (this.boss) Effects.explosion(this, this.boss.position.x + 80, this.boss.position.y - 50, 0xff2080, 2.2);
    });
    this.time.delayedCall(600, () => {
      if (this.boss) Effects.explosion(this, this.boss.position.x - 100, this.boss.position.y + 40, 0xff2080, 2.0);
    });
    this.time.delayedCall(900, () => {
      if (this.boss) Effects.explosion(this, this.boss.position.x + 40, this.boss.position.y + 60, 0xff2080, 1.8);
    });
    this.cameras.main.flash(800, 255, 255, 255);

    this.time.delayedCall(2200, () => {
      EventBus.emit('game:victory', { timeMs: elapsed });
      Effects.stopMusic();
      this.scene.start('VictoryScene', { timeMs: elapsed });
    });
  };

  private respawnPlayerAtSection(): void {
    const sec = STAGE.SECTIONS[this.currentSection - 1];
    this.player.sprite.setPosition(sec.x + 200, GAME.HEIGHT - 300);
    this.player.sprite.setVelocity(0, 0);
  }

  shutdown(): void {
    EventBus.off('player:died', this.onPlayerDied, this);
    EventBus.off('enemy:killed', this.onEnemyKilled, this);
    EventBus.off('boss:dead', this.onBossDead, this);
    EventBus.off('boss:stage-defeated', this.onBossStageDefeated, this);
    this.matter.world.off('collisionstart', this.onCollisionStart);
    this.projectiles.forEach(p => p.kill());
    this.projectiles = [];
    this.hud?.destroy();
    this.bossBar?.destroy();
    
    this.parallax?.destroy();
    this.graphics?.destroy();
    Ragdoll.clear(this);
  }
}

export default FactoryStage;
