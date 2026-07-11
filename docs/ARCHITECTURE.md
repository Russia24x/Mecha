# MECHA: LAST PROTOCOL — Complete Architecture

> **Version:** MVP 2.0
> **Engine:** Phaser 4.2.1 + Matter.js
> **Framework:** Next.js 16 + TypeScript
> **Total:** 20 files, ~3100 lines

---

## FILE TREE

```
src/
├── app/
│   ├── layout.tsx              (53 lines)  — HTML root, fonts, metadata
│   ├── page.tsx                (65 lines)  — React page, loads PhaserGame dynamically
│   └── globals.css                         — Tailwind
│
└── game/
    ├── PhaserGame.ts           (101 lines) — Phaser.Game config + F11 fullscreen
    
    ├── shared/
    │   ├── Constants.ts        (98 lines)  — GAME, PLAYER, STAGE_1, COLORS, KEYS
    │   ├── Types.ts            (20 lines)  — Direction, CheckpointData, MatterBodyConfig
    │   ├── EventBus.ts         (47 lines)  — Global event emitter (6 events)
    │   ├── Effects.ts          (214 lines) — Audio (procedural SFX) + visual effects
    │   ├── GamepadManager.ts   (141 lines) — HTML5 Gamepad API wrapper
    │   └── Save.ts             (128 lines) — localStorage save (versioned + migration)
    │
    └── features/
        ├── scenes/
        │   ├── BootScene.ts    (59 lines)  — Asset loading + __white texture generation
        │   ├── GameScene.ts    (597 lines) — Main scene + state machine (6 states)
        │   └── UIScene.ts      (139 lines) — Pause menu overlay
        │
        ├── player/
        │   └── Player.ts       (469 lines) — Player entity (movement, combat, visual)
        │
        ├── enemies/
        │   └── Enemy.ts        (344 lines) — 3 enemy types + FSM AI
        │
        ├── boss/
        │   └── Boss.ts         (171 lines) — Boss entity (2 phases)
        │
        ├── combat/
        │   ├── Projectile.ts   (142 lines) — Projectile entity (overlap hit detection)
        │   └── DamageSystem.ts (91 lines)  — Damage resolution + hit-stop + shake
        │
        ├── physics/
        │   ├── PhysicsWorld.ts (52 lines)  — Matter.js wrapper
        │   └── CollisionLayers.ts (15 lines) — bodyConfig helper
        │
        ├── rendering/
        │   └── Graphics.ts     (100 lines) — Darkness overlay + brightness + lights
        │
        └── ui/
            ├── HUD.ts          (112 lines) — In-game HUD (depth 200)
            └── BossBar.ts      (61 lines)  — Boss health bar
```

---

## GAME LOOP (60 FPS)

```
Every frame (16.67ms target):

  ┌─────────────────────────────────────────────────────┐
  │  browser requestAnimationFrame                      │
  └─────────────────────┬───────────────────────────────┘
                        ▼
  ┌─────────────────────────────────────────────────────┐
  │  Phaser.Game.step(time, delta)                      │
  │  • update time.now                                  │
  │  • step Matter.js physics (autoUpdate=true)         │
  │  • step TweenManager                                │
  │  • step TimerEvents                                 │
  └─────────────────────┬───────────────────────────────┘
                        ▼
  ┌─────────────────────────────────────────────────────┐
  │  GameScene.update(time, deltaMs)                    │
  │                                                      │
  │  if state === 'play':                                │
  │    updatePlay(deltaMs):                              │
  │      1. player.update(deltaMs)                       │
  │         • poll GamepadManager                        │
  │         • ground check (matter.intersectPoint)       │
  │         • horizontal movement (lerp)                 │
  │         • dash (afterimage + i-frames)               │
  │         • fire/melee (cooldown check)                │
  │         • energy regen                               │
  │         • animation (torso/core/head/legs/gun)       │
  │      2. graphics.update(time, deltaMs)               │
  │         • darkness overlay alpha (brightness)        │
  │         • light follow (player + enemies)            │
  │         • ambient flicker                            │
  │      3. hud.update()                                 │
  │         • poll player.health → healthBarFg           │
  │         • poll player.energy → energyBarFg           │
  │         • poll player.weapon → weaponText            │
  │      4. bossBar.update()                             │
  │         • poll boss.health → barFg                   │
  │      5. projectiles.forEach(p.update)                │
  │         • move (velocity)                            │
  │         • trail position                             │
  │         • TTL check → kill if expired                │
  │         • bounds check → kill if out                 │
  │         • checkOverlaps (iterate scene.children)     │
  │           → hit solid → kill                         │
  │           → hit enemy/boss → takeDamage + kill       │
  │           → hit player → takeDamage + kill           │
  │      6. enemies.forEach(e.update)                    │
  │         • FSM: patrol / aggro / attack / stagger     │
  │         • LOS check (intersectRay, filter solids)    │
  │         • attack phases: telegraph → window → recovery│
  │         • fire bullets (drone)                       │
  │         • lunge (spider)                             │
  │         • charge (heavy)                             │
  │         • visual sync (visualGfx position)           │
  │      7. boss.update(deltaMs)                         │
  │         • phase check (50% HP → phase 2)             │
  │         • AI: shoot 3-spread / lunge / idle          │
  │         • visual sync (bossGfx + bossCore)           │
  │      8. out-of-bounds check                          │
  │         • if player.y > HEIGHT+80 → takeDamage(25)   │
  │         • respawn at section start                   │
  │      9. boss arena zoom                              │
  │         • lerp camera zoom to 0.85                   │
  │                                                      │
  │  else (menu/map/gameover/settings):                  │
  │    GamepadManager.update()                           │
  │    updateMenuNavigation()                            │
  └─────────────────────┬───────────────────────────────┘
                        ▼
  ┌─────────────────────────────────────────────────────┐
  │  Phaser render                                      │
  │  • render all GameObjects by depth                  │
  │  • depth -3: background image                        │
  │  • depth 5: platforms                                │
  │  • depth 13-16: player visual parts                  │
  │  • depth 20-25: particles + explosions               │
  │  • depth 90: darkness overlay (MULTIPLY)             │
  │  • depth 91: light circles (ADD)                     │
  │  • depth 200: HUD + BossBar                          │
  │  • depth 250: game-over overlay                      │
  └─────────────────────────────────────────────────────┘
```

---

## STATE MACHINE

```
                    ┌──────────┐
          create()  │  menu    │  ← game starts here
                ┌──→│          │
                │   └────┬─────┘
                │        │ START button (Enter/click)
                │        ▼
                │   ┌──────────┐
                │   │  play    │  ← buildPlay()
                │   │          │     • create physics world
                │   │          │     • create player
                │   │          │     • create HUD + BossBar
                │   │          │     • spawn enemies
                │   │          │     • build triggers
                │   │          │     • register EventBus listeners
                │   └──┬───┬───┘
                │      │   │ ESC
                │      │   ▼
                │      │  ┌──────────┐
                │      │  │ (paused) │  UIScene launches on top
                │      │  │          │  • RESUME → back to play
                │      │  │          │  • RESTART → cleanupPlay + buildPlay
                │      │  │          │  • QUIT TO MAP → setState('map')
                │      │  │          │  • QUIT TO MENU → setState('menu')
                │      │  └──────────┘
                │      │
                │      │ PLAYER_DEAD
                │      ▼
                │   ┌──────────┐
                │   │ gameover │
                │   │          │  • RETRY → setState('play')
                │   │          │  • QUIT TO MENU → setState('menu')
                │   └──┬───────┘
                │      │
                └──────┘  (loops back to menu)

    Also from menu:
      SETTINGS → settings slider (volume, brightness) → BACK → menu
```

---

## SCENE LIFECYCLE

### BootScene
```
preload():
  1. Generate __white texture (1×1 pixel) via Graphics.fillRect + generateTexture
  2. Show loading bar (320×8 px) + percentage text
  3. (No external assets to load yet)

create():
  1. Set background color
  2. Show "MECHA: LAST PROTOCOL" title (42px cyan)
  3. Show "SYSTEMS READY" subtitle (14px green)
  4. After 400ms → scene.start('GameScene')
```

### GameScene
```
create():
  1. Effects.init() — attach gesture listeners for AudioContext
  2. Effects.resume() — resume if already initialized
  3. GamepadManager.init() — attach gamepad connect/disconnect listeners
  4. Load settings from Save → apply volume + brightness
  5. setState('menu')

setState(next):
  1. cleanupState() — destroy previous state's container + handlers
  2. Set this.state = next
  3. Create stateContainer (depth 50) for non-play states
  4. Call build{Menu|Map|Play|Victory|Gameover|Settings}()

buildPlay():
  1. Set camera bounds (0, 0, 7680, 720)
  2. Set matter world bounds + gravity (0, 0.9)
  3. Reset all arrays (projectiles, enemies, boss, solids, triggers)
  4. Create Graphics (darkness overlay)
  5. buildStageGeometry() — floor, ceiling, per-section platforms
  6. Create DamageSystem
  7. Create Player at section start position
  8. Camera follow player (lerp 0.1, deadzone 160×100)
  9. Create HUD + BossBar
  10. spawnEnemiesForSection(currentSection)
  11. buildSectionTriggers() — 6 section sensors + 2 checkpoint sensors + 1 boss-entry sensor
  12. Register EventBus listeners: PLAYER_DEAD, ENEMY_DEAD, PLAYER_DAMAGED
  13. Register matter.world collisionstart listener
  14. Emit GAME_STATE event (section info)

cleanupPlay():
  1. EventBus.off() — remove 3 listeners
  2. matter.world.off('collisionstart') — with context
  3. projectiles.forEach(p.kill())
  4. player.destroy() — removes window listeners + destroys visuals + sprite
  5. enemies.forEach(e.destroy())
  6. boss?.destroy()
  7. solids.forEach(s.destroy())
  8. sectionTriggers.forEach(t.destroy())
  9. bossArenaTrigger?.destroy()
  10. tweens.killAll()
  11. sequenceTimers.forEach(t.remove())
  12. hud.destroy() + bossBar.destroy()
  13. graphics.destroy()
  14. Reset camera (zoom=1, stopFollow, bounds)
  15. Reset matter world bounds
```

---

## PLAYER ANATOMY

```
┌───────────────────────────────────────────────────────────┐
│  Player Class (469 lines)                                 │
│                                                            │
│  ┌─── Physics ───────────────────────────────────────┐    │
│  │  sprite: Matter.Image                             │    │
│  │  • texture: '__white' (1×1, tinted)               │    │
│  │  • displaySize: 40×47 px                          │    │
│  │  • alpha: 0 (invisible — visual is separate)      │    │
│  │  • fixedRotation: true                            │    │
│  │  • friction: 0.01, frictionAir: 0.02              │    │
│  │  • density: 0.004                                 │    │
│  │  • label: 'player'                                │    │
│  │  • data: entityType='player', entity=this         │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── Visual (7 GameObjects) ────────────────────────┐    │
│  │                                                   │    │
│  │   depth 13:  mechaLegL (9×18 rect, 0x2a3850)      │    │
│  │   depth 13:  mechaLegR (9×18 rect, 0x2a3850)      │    │
│  │   depth 14:  mechaTorso (36×30 rect, 0x1a2840)    │    │
│  │   depth 15:  core (circle r=4, 0x66f0ff, ADD)     │    │
│  │   depth 15:  mechaHead (16×14 rect, 0x2a3850)     │    │
│  │   depth 15:  gunArm (28×6 rect, 0x1a2030)         │    │
│  │   depth 16:  visor (10×3 rect, 0x66f0ff)          │    │
│  │                                                   │    │
│  │  Animation:                                        │    │
│  │  • Walking: torso bob (sin wave), legs swing      │    │
│  │  • Jumping: legs tuck (-20° / +20°)               │    │
│  │  • Idle: legs straight, core pulse                │    │
│  │  • Gun arm: rotates toward aim direction          │    │
│  │  • Core: pulsing alpha + radius (sin wave)        │    │
│  │  • Visor: flickering alpha                        │    │
│  │  • Invuln: sprite alpha flash (0.45 ↔ 0)         │    │
│  │  • Landing: dust particles + camera shake         │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── Movement ──────────────────────────────────────┐    │
│  │  Ground check:                                     │    │
│  │    matter.intersectPoint(x, y+27)                  │    │
│  │    filter: !isSensor && label.startsWith('solid') │    │
│  │                                                    │    │
│  │  Coyote time: 120ms after leaving platform        │    │
│  │  Jump buffer: 120ms before landing                │    │
│  │  Variable jump: keyup → vy *= 0.45                 │    │
│  │                                                    │    │
│  │  Horizontal:                                       │    │
│  │    target = moveX * MOVE_SPEED (5.5)              │    │
│  │    current = lerp(current, target, 0.35)          │    │
│  │    Friction: velocity.x * 0.78 (when no input)    │    │
│  │                                                    │    │
│  │  Dash:                                             │    │
│  │    Duration: 220ms at speed 10                     │    │
│  │    Cost: 22 energy                                 │    │
│  │    Cooldown: 600ms after dash ends                 │    │
│  │    i-frames: invulnUntil = dashUntil               │    │
│  │    Afterimage: every 35ms, ADD-blend ghost rect   │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── Combat ────────────────────────────────────────┐    │
│  │  Fire (Plasma Rifle):                              │    │
│  │    Cooldown: 140ms                                  │    │
│  │    Cost: 3 energy                                   │    │
│  │    Damage: 18                                       │    │
│  │    Speed: 13 px/frame                               │    │
│  │    TTL: 1500ms                                      │    │
│  │    Aim: keyboard (W/S) or right stick              │    │
│  │    Muzzle: 30px from player center                  │    │
│  │    Sparks: 4 particles at muzzle                    │    │
│  │                                                    │    │
│  │  Melee:                                            │    │
│  │    Cooldown: 360ms                                  │    │
│  │    Cost: 6 energy                                   │    │
│  │    Damage: 35                                       │    │
│  │    Range: 60px (circle query)                      │    │
│  │    Knockback: x=0.18, y=0.05                       │    │
│  │    Visual: slash arc (fades in 150ms)              │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── Input ─────────────────────────────────────────┐    │
│  │  Window keydown listener (single source):         │    │
│  │    Space → tryJump()                               │    │
│  │    KeyJ → tryFire() + heldFire=true               │    │
│  │    KeyK → tryMelee()                               │    │
│  │    Escape → pause + launch UIScene                │    │
│  │    Shift → tryDash(heldDir or facing)             │    │
│  │    WASD/Arrows → heldLeft/Right/Up/Down           │    │
│  │                                                    │    │
│  │  Window keyup listener:                            │    │
│  │    Space → cutJump()                               │    │
│  │    WASD → clear held flags                        │    │
│  │    KeyJ → heldFire=false                          │    │
│  │                                                    │    │
│  │  Gamepad (polled in update):                      │    │
│  │    A → jump, X → fire, Y → melee, B → dash       │    │
│  │    Start → pause                                   │    │
│  │    Left stick → movement                          │    │
│  │    Right stick → aim                              │    │
│  │                                                    │    │
│  │  ⚠️ Handlers stored as fields, removed in destroy │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── Health/Energy ─────────────────────────────────┐    │
│  │  HP: 150/150, i-frames 850ms after hit           │    │
│  │  Energy: 100/100, regen 14/sec                    │    │
│  │  takeDamage → emit PLAYER_DAMAGED                 │    │
│  │  HP=0 → emit PLAYER_DEAD                          │    │
│  └───────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

---

## ENEMY ANATOMY

```
┌───────────────────────────────────────────────────────────┐
│  Enemy Class (344 lines) — 3 types                        │
│                                                            │
│  ┌─── Types ────────────────────────────────────────┐    │
│  │  Drone:                                            │    │
│  │    HP 24, speed 1.4, flying, shoot bullets        │    │
│  │    Visual: hexagonal body + glowing eye           │    │
│  │    Hover: sin wave ±12px                          │    │
│  │    Attack: 3-bullet spread, 100ms cooldown        │    │
│  │    Detection: 320px range                          │    │
│  │                                                    │    │
│  │  Spider:                                           │    │
│  │    HP 55, speed 2.2, ground, lunge attack         │    │
│  │    Visual: ellipse body + red eyes + 6 legs      │    │
│  │    Attack: lunge at speed 7, squash telegraph     │    │
│  │    Detection: 280px range                          │    │
│  │                                                    │    │
│  │  Heavy:                                            │    │
│  │    HP 140, speed 0.9, ground, charge attack       │    │
│  │    Visual: armored box + turret + barrel          │    │
│  │    Attack: charge at speed 5, flash telegraph     │    │
│  │    Detection: 320px range                          │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── FSM (Finite State Machine) ────────────────────┐    │
│  │                                                   │    │
│  │  ┌─────────┐   inRange + LOS   ┌─────────┐        │    │
│  │  │ patrol  │─────────────────→│ aggro   │        │    │
│  │  │         │                  │         │        │    │
│  │  │ • hover │                  │ • chase │        │    │
│  │  │ • walk  │←─────────────────│ • strafe│        │    │
│  │  │ • idle  │   lost player    │         │        │    │
│  │  └─────────┘                  └────┬────┘        │    │
│  │                                     │ in attackRange│    │
│  │                                     ▼              │    │
│  │                               ┌─────────┐          │    │
│  │                               │ attack  │          │    │
│  │                               │         │          │    │
│  │                               │ Phase 1:│          │    │
│  │                               │telegraph│          │    │
│  │                               │(red circle│        │    │
│  │                               │ scales) │          │    │
│  │                               │         │          │    │
│  │                               │ Phase 2:│          │    │
│  │                               │ window  │          │    │
│  │                               │(fire/   │          │    │
│  │                               │ lunge/  │          │    │
│  │                               │ charge) │          │    │
│  │                               │         │          │    │
│  │                               │ Phase 3:│          │    │
│  │                               │recovery │          │    │
│  │                               │(friction│          │    │
│  │                               │ decel)  │          │    │
│  │                               └────┬────┘          │    │
│  │                                    │                │    │
│  │              hit during telegraph  │                │    │
│  │                    ┌───────────────┘                │    │
│  │                    ▼                                │    │
│  │               ┌─────────┐                           │    │
│  │               │ stagger │  400ms → back to aggro   │    │
│  │               └─────────┘                           │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── Line of Sight ─────────────────────────────────┐    │
│  │  hasLineOfSight(playerPos):                       │    │
│  │    1. Cast ray from enemy to player                │    │
│  │    2. Filter out self body                         │    │
│  │    3. Check if any remaining hit is a SOLID wall   │    │
│  │    4. If wall between → LOS = false                │    │
│  │    5. Otherwise → LOS = true                       │    │
│  │                                                    │    │
│  │  ⚠️ Only solids block LOS. Other enemies,         │    │
│  │    projectiles, player do NOT block.              │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── Visual ────────────────────────────────────────┐    │
│  │  visualGfx: Phaser.GameObjects.Graphics           │    │
│  │  • Drawn per-type (drone/spider/heavy)            │    │
│  │  • Synced to physics body position every frame    │    │
│  │  • Flash: scale 1.15 + alpha 0.8 on hit           │    │
│  │  • Telegraph squash (spider): scale 1→1.2/0.6    │    │
│  │  • Telegraph flash (heavy): alpha pulse           │    │
│  │  • Destroyed in die() and destroy()               │    │
│  └───────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

---

## BOSS ANATOMY

```
┌───────────────────────────────────────────────────────────┐
│  Boss Class (171 lines)                                   │
│                                                            │
│  ┌─── Stats ────────────────────────────────────────┐    │
│  │  HP: 1200                                          │    │
│  │  Contact damage: 28                                │    │
│  │  MAX_PHASES: 2 (NO 3rd phase!)                    │    │
│  │  Phase 1: 100% → 50% HP                           │    │
│  │  Phase 2: 50% → 0% HP                             │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── Visual ────────────────────────────────────────┐    │
│  │  bossGfx: Graphics                                 │    │
│  │  • Hexagonal body (6 vertices, radius 50/45)      │    │
│  │  • Fill: 0x2a0a0a (dark red)                      │    │
│  │  • Stroke: 0xff3030 (red), width 3                │    │
│  │  • Position synced to sprite every frame          │    │
│  │                                                    │    │
│  │  bossCore: Arc (circle)                            │    │
│  │  • Radius: 12, color: 0xff6060                    │    │
│  │  • Blend: ADD                                      │    │
│  │  • Pulsing: alpha + radius (sin wave)             │    │
│  │  • Position synced to sprite every frame          │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── AI ────────────────────────────────────────────┐    │
│  │  Random action selection every 800-1500ms:        │    │
│  │                                                    │    │
│  │  40% chance: SHOOT                                 │    │
│  │    • Fire 3 bullets in spread (±0.2 rad)          │    │
│  │    • Speed: 5, damage: 10, TTL: 3000ms            │    │
│  │    • Cooldown: 200ms between shots                │    │
│  │                                                    │    │
│  │  30% chance: LUNGE                                 │    │
│  │    • Set lungeVel toward player (×6)              │    │
│  │    • Velocity decays *0.92 per frame              │    │
│  │                                                    │    │
│  │  30% chance: IDLE                                  │    │
│  │    • Wait 800ms                                    │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── Phase Transition ──────────────────────────────┐    │
│  │  updatePhase():                                    │    │
│  │    pct = health / maxHealth                        │    │
│  │    newPhase = pct > 0.5 ? 1 : 2                   │    │
│  │    if newPhase !== phase && newPhase <= 2:        │    │
│  │      phase = newPhase                              │    │
│  │      emit BOSS_PHASE                               │    │
│  │      return true (phase changed)                   │    │
│  │                                                    │    │
│  │  On phase change:                                  │    │
│  │    • bossGfx alpha → 0.3 (flash)                  │    │
│  │    • After 200ms → alpha back to 1                │    │
│  │    • Camera flash (150ms, RGB 255,80,80)          │    │
│  │    • Play phaseChange sound                       │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─── Death ─────────────────────────────────────────┐    │
│  │  die():                                            │    │
│  │    • isAlive = false                               │    │
│  │    • emit BOSS_PHASE { dead: true }               │    │
│  │    • Destroy bossGfx + bossCore + sprite          │    │
│  └───────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

---

## COMBAT SYSTEM

```
┌───────────────────────────────────────────────────────────┐
│  Damage Flow                                              │
│                                                            │
│  Player.fire()                                             │
│    → new Projectile(owner='player', damage=18)            │
│    → projectiles[] array in GameScene                     │
│                                                            │
│  Projectile.update() (every frame)                        │
│    → move by velocity                                     │
│    → checkOverlaps():                                      │
│        iterate scene.children.list                        │
│        for each GameObject with entityType:               │
│          if distance < hitRadius:                         │
│            if solid → kill projectile                     │
│            if enemy/boss → entity.takeDamage(18)          │
│                              → Effects.sparks()           │
│                              → kill projectile            │
│                                                            │
│  Enemy.takeDamage(amount)                                 │
│    → health -= amount                                     │
│    → if hit during telegraph → stagger                    │
│    → if health <= 0 → die()                               │
│        → emit ENEMY_DEAD { id, score, x, y }             │
│        → destroy visualGfx + sprite                      │
│                                                            │
│  GameScene.onEnemyKilled (EventBus listener)              │
│    → Save.recordKill()                                    │
│    → Effects.explosion(x, y)                             │
│                                                            │
│  ────────────────────────────────────────────────          │
│                                                            │
│  Enemy.fire(playerPos)                                    │
│    → new Projectile(owner='enemy', damage=6)             │
│                                                            │
│  Projectile hits player:                                  │
│    → player.takeDamage(6)                                 │
│    → emit PLAYER_DAMAGED                                  │
│    → if HP=0 → emit PLAYER_DEAD                           │
│        → GameScene.onPlayerDied                           │
│        → camera fadeOut 700ms                             │
│        → scheduleDelayed(900ms) → setState('gameover')    │
│                                                            │
│  ────────────────────────────────────────────────          │
│                                                            │
│  DamageSystem.dealDamage(event)                           │
│    → find target body by ID                              │
│    → entity.takeDamage(amount)                           │
│    → spawn hit FX (5 sparks)                              │
│    → apply knockback (Matter.Body.applyForce)            │
│    → triggerHitStop:                                      │
│        engine.timing.timeScale = 0.05                     │
│        after 40-120ms → restore to 1                      │
│    → camera shake (80ms, scaled by damage)               │
│                                                            │
│  Hit-stop:                                                 │
│    Slows entire physics simulation to 5% speed            │
│    for 40-120ms on hit — gives "weight" to combat        │
│    Duration scales with damage amount                    │
└───────────────────────────────────────────────────────────┘
```

---

## PHYSICS SYSTEM

```
┌───────────────────────────────────────────────────────────┐
│  Matter.js World Config                                   │
│                                                            │
│  gravity: { x: 0, y: 0.9 }                                │
│  bounds: 0,0 → 7680,720 (STAGE_1.TOTAL_WIDTH)           │
│  autoUpdate: true (engine steps automatically)           │
│  No fixedStep (removed in Phaser 4.2)                    │
│                                                            │
│  Body Categories (bitmask):                               │
│  ┌────────────────────────────────────────────┐           │
│  │  SOLID       0x0001  platforms, walls      │           │
│  │  PLAYER      0x0002  player body           │           │
│  │  ENEMY       0x0004  enemy bodies          │           │
│  │  BOSS        0x0008  boss body             │           │
│  │  PROJ_PLAYER 0x0010  player bullets        │           │
│  │  PROJ_ENEMY  0x0020  enemy bullets         │           │
│  │  SENSOR      0x0040  triggers, checkpoints │           │
│  │  PICKUP      0x0080  health pickups (future)│          │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Collision Matrix (what collides with what):              │
│  ┌──────────┬───────┬───────┬──────┬──────┬──────┬──────┐ │
│  │          │ Solid │ Player│Enemy │ Boss │P-Proj│E-Proj│ │
│  ├──────────┼───────┼───────┼──────┼──────┼──────┼──────┤ │
│  │ Player   │  ✓    │   —   │  ✓   │  ✓   │  —   │  ✓   │ │
│  │ Enemy    │  ✓    │   ✓   │  —   │  —   │  ✓   │  —   │ │
│  │ Boss     │  ✓    │   ✓   │  —   │  —   │  ✓   │  —   │ │
│  │ P-Proj   │  ✓    │   —   │  ✓   │  ✓   │  —   │  —   │ │
│  │ E-Proj   │  ✓    │   ✓   │  —   │  —   │  —   │  —   │ │
│  └──────────┴───────┴───────┴──────┴──────┴──────┴──────┘ │
│                                                            │
│  Queries:                                                  │
│  • intersectPoint(x, y) — player ground check             │
│  • intersectRay(x1,y1,x2,y2, width=1) — enemy LOS        │
│  • query.region(circle) — melee hit detection             │
│                                                            │
│  Collision Events:                                        │
│  • matter.world.on('collisionstart', handler, context)    │
│  • Checks: section triggers, checkpoints, boss entry,     │
│    enemy contact damage                                   │
│  • Removed in cleanupPlay with context arg                │
└───────────────────────────────────────────────────────────┘
```

---

## RENDERING PIPELINE

```
Depth layers (Phaser renders low→high):

  -3   ┌─ Stage background image (future) ──────────────┐
       │                                                 │
  -1.5 │  Dark overlay (MULTIPLY blend, alpha 0.1-0.2)  │
       │                                                 │
   5   │  Platforms / solids (rectangle visuals)        │
       │  └─ stroke: RUST (0x8a4a2a), alpha 0.4        │
       │                                                 │
   8   │  Landing dust particles                        │
       │                                                 │
  12   │  Telegraph circles (enemy attack warning)      │
       │  └─ red circle, scales 0.5→1.5, alpha 0.7→0.2 │
       │                                                 │
  13   │  Player afterimage (ADD blend, fading)         │
       │  Enemy visualGfx (Graphics)                    │
       │                                                 │
  14   │  Player torso (rectangle)                      │
       │  Enemy body details                            │
       │                                                 │
  15   │  Player core (circle, ADD blend, pulsing)      │
       │  Player head (rectangle)                       │
       │  Player gunArm (rectangle, rotates)            │
       │                                                 │
  16   │  Player visor (rectangle, flickering)          │
       │                                                 │
  20   │  Sparks (hit feedback)                         │
       │                                                 │
  24   │  Explosion rings                               │
  25   │  Explosion flash                               │
       │                                                 │
  ─────┤  DARKNESS OVERLAY (depth 90) ──────────────── │
  90   │  Full-screen rectangle, MULTIPLY blend         │
       │  Alpha = (1 - brightness) * 0.2                │
       │  Color: 0x000010 (near-black blue)             │
       │  ⚠️ This darkens everything below depth 90    │
       │                                                 │
  91   │  Light circles (ADD blend)                     │
       │  • Player light: follows player, r=180         │
       │  • Enemy lights: follows enemies, r=60         │
       │  • Boss light: follows boss, r=240             │
       │  ⚠️ These "cut" holes in the darkness         │
       │                                                 │
  ─────┤  HUD LAYER (depth 200) ───────────────────── │
  200  │  HUD container (always visible, above all)    │
       │  • Panel (rectangle, 0x0a0d14, alpha 0.7)     │
       │  • Health bar (green, 320×14)                 │
       │  • Energy bar (blue, 320×10)                  │
       │  • Health text ("150/150")                    │
       │  • Energy text ("100/100")                    │
       │  • Section title ("SECTION 1 — TUTORIAL")    │
       │  • Weapon text ("PLASMA RIFLE")               │
       │  • Controls hint (bottom)                     │
       │  • Checkpoint toast (center, fading)          │
       │  ⚠️ NO shadow/box behind text (clean look)   │
       │                                                 │
       │  BossBar container (depth 200, visible in boss)│
       │  • Boss health bar (red, 580×14)              │
       │  • Boss name ("GUARDIAN AX-09")               │
       │  • Phase text ("PHASE 1")                     │
       │                                                 │
  250  │  Game-over overlay (full-screen black)        │
       │  Boss lore overlay                             │
       └─────────────────────────────────────────────────┘
```

---

## EVENT SYSTEM

```
EventBus (Phaser.Events.EventEmitter wrapper)
┌──────────────────────────────────────────────────────────┐
│                                                           │
│  6 Events:                                                │
│                                                           │
│  ┌─ PLAYER_DAMAGED ─────────────────────────────────┐    │
│  │  Emitted by: Player.takeDamage()                  │    │
│  │  Payload: { amount: number, x: number, y: number }│    │
│  │  Listeners: GameScene.onPlayerDamaged (no-op)     │    │
│  │  Future: floating damage numbers                  │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─ PLAYER_DEAD ────────────────────────────────────┐    │
│  │  Emitted by: Player.takeDamage() (when HP=0)      │    │
│  │  Payload: { id: string }                          │    │
│  │  Listeners: GameScene.onPlayerDied                │    │
│  │    → explosion at player position                 │    │
│  │    → camera shake + fadeOut                       │    │
│  │    → scheduleDelayed(900ms) → setState('gameover')│    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─ ENEMY_DEAD ─────────────────────────────────────┐    │
│  │  Emitted by: Enemy.die()                          │    │
│  │  Payload: { id, score, x, y }                     │    │
│  │  Listeners: GameScene.onEnemyKilled               │    │
│  │    → Save.recordKill()                            │    │
│  │    → Effects.explosion(x, y)                     │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─ BOSS_PHASE ─────────────────────────────────────┐    │
│  │  Emitted by: Boss.updatePhase() + Boss.die()      │    │
│  │  Payload: { phase, healthPct, dead? }             │    │
│  │  Listeners: BossBar                               │    │
│  │    → update phase text                            │    │
│  │    → hide bar if dead                             │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─ CHECKPOINT ─────────────────────────────────────┐    │
│  │  Emitted by: GameScene.activateCheckpoint()       │    │
│  │  Payload: { section: number }                     │    │
│  │  Listeners: HUD.flashCheckpoint()                 │    │
│  │    → show "CHECKPOINT SAVED" toast                │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─ GAME_STATE ─────────────────────────────────────┐    │
│  │  Emitted by: GameScene.enterSection() + buildPlay│     │
│  │  Payload: { sectionId, sectionName }              │    │
│  │  Listeners: HUD                                   │    │
│  │    → update section title text                    │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ⚠️ All listeners removed in cleanupPlay()               │
└──────────────────────────────────────────────────────────┘
```

---

## SAVE SYSTEM

```
┌──────────────────────────────────────────────────────────┐
│  Save System (localStorage)                              │
│                                                           │
│  Key: 'mecha_last_protocol_save_v2'                      │
│                                                           │
│  Data structure:                                          │
│  {                                                        │
│    version: 2,                                            │
│    lastCheckpoint: {                                      │
│      section: number,                                     │
│      x: number,                                           │
│      y: number,                                           │
│      timestamp: number                                    │
│    } | null,                                              │
│    bestBossTimeMs: number | null,                         │
│    totalKills: number,                                    │
│    bossesKilled: number,                                  │
│    settings: {                                            │
│      lang: 'en' | 'fa',                                  │
│      masterVolume: number,  // 0-1                       │
│      sfxVolume: number,     // 0-1                       │
│      muted: boolean,                                      │
│      brightness: number     // 0-1, default 0.7          │
│    }                                                      │
│  }                                                        │
│                                                           │
│  Migration:                                               │
│    If save exists with missing fields, auto-fills        │
│    from DEFAULT_SAVE.                                     │
│    bossesKilled and totalKills default to 0.             │
│    brightness defaults to 0.7.                           │
│                                                           │
│  API:                                                     │
│    Save.get() → Readonly<SaveData>                       │
│    Save.hasCheckpoint() → boolean                        │
│    Save.saveCheckpoint(cp) → void                        │
│    Save.clearCheckpoint() → void                         │
│    Save.recordKill() → void (totalKills++)               │
│    Save.recordBossKill() → void (bossesKilled++)         │
│    Save.recordBossTime(ms) → void (best time)            │
│    Save.getSettings() → GameSettings                     │
│    Save.saveSettings(partial) → void (merge)             │
│    Save.clear() → void (reset to default)                │
└──────────────────────────────────────────────────────────┘
```

---

## INPUT SYSTEM

```
┌──────────────────────────────────────────────────────────┐
│  Keyboard (window listeners — single source)             │
│                                                           │
│  keydown handler:                                         │
│  ┌──────────┬──────────────────────────────────────┐     │
│  │ Key      │ Action                                │     │
│  ├──────────┼──────────────────────────────────────┤     │
│  │ Space    │ tryJump() — edge triggered           │     │
│  │ KeyJ     │ tryFire() + heldFire=true            │     │
│  │ KeyK     │ tryMelee() — edge triggered          │     │
│  │ Escape   │ pause + launch UIScene               │     │
│  │ Shift    │ tryDash(heldDir or facing)           │     │
│  │ KeyA/←   │ heldLeft=true                       │     │
│  │ KeyD/→   │ heldRight=true                      │     │
│  │ KeyW/↑   │ heldUp=true                         │     │
│  │ KeyS/↓   │ heldDown=true                       │     │
│  └──────────┴──────────────────────────────────────┘     │
│                                                           │
│  keyup handler:                                           │
│  ┌──────────┬──────────────────────────────────────┐     │
│  │ Space    │ cutJump() — variable jump height     │     │
│  │ KeyA/←   │ heldLeft=false                      │     │
│  │ KeyD/→   │ heldRight=false                     │     │
│  │ KeyW/↑   │ heldUp=false                        │     │
│  │ KeyS/↓   │ heldDown=false                      │     │
│  │ KeyJ     │ heldFire=false                      │     │
│  └──────────┴──────────────────────────────────────┘     │
│                                                           │
│  ⚠️ Handlers stored as fields (onKeyDown, onKeyUp)      │
│  ⚠️ Removed in Player.destroy() via removeEventListener  │
│  ⚠️ NO Phaser keyboard plugin handlers (avoids dup)      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Gamepad (HTML5 Gamepad API, polled every frame)         │
│                                                           │
│  ┌──────┬──────┬──────────────────────────────────┐      │
│  │ Btn  │ Code │ Action                            │      │
│  ├──────┼──────┼──────────────────────────────────┤      │
│  │ A    │  0   │ Jump (edge)                       │      │
│  │ X    │  2   │ Fire (edge)                       │      │
│  │ RT   │  7   │ Fire (edge, alt)                  │      │
│  │ Y    │  3   │ Melee (edge)                      │      │
│  │ B    │  1   │ Dash (edge)                       │      │
│  │ LB   │  4   │ Weapon prev (edge)                │      │
│  │ RB   │  5   │ Weapon next (edge)                │      │
│  │ Start│  9   │ Pause (edge)                      │      │
│  │ Back │  8   │ Menu back (edge)                  │      │
│  ├──────┼──────┼──────────────────────────────────┤      │
│  │ D-Up │  12  │ leftStickY = -1 (overrides stick) │      │
│  │ D-Dn │  13  │ leftStickY = 1                    │      │
│  │ D-Lt │  14  │ leftStickX = -1                   │      │
│  │ D-Rt │  15  │ leftStickX = 1                    │      │
│  └──────┴──────┴──────────────────────────────────┘      │
│                                                           │
│  Analog sticks (deadzone 0.18):                           │
│  • Left stick: movement (axes 0,1)                       │
│  • Right stick: aim (axes 2,3)                           │
│                                                           │
│  Held buttons:                                            │
│  • A (0) → jumpHeld                                      │
│  • X/RT (2,7) → fireHeld                                 │
│                                                           │
│  ⚠️ Each button has EXACTLY ONE role (no conflicts)      │
│  ⚠️ Edge detection via prevButtons comparison            │
└──────────────────────────────────────────────────────────┘
```

---

## AUDIO SYSTEM

```
┌──────────────────────────────────────────────────────────┐
│  Effects Class (214 lines)                               │
│                                                           │
│  AudioContext lifecycle:                                  │
│  1. Effects.init() — attaches 3 gesture listeners:        │
│     • pointerdown (once)                                 │
│     • keydown (once)                                     │
│     • gamepadconnected (once)                            │
│                                                           │
│  2. First user gesture → initOnGesture():                │
│     • Create AudioContext                                │
│     • Create masterGain → destination                    │
│     • Create sfxGain → masterGain                        │
│     • Generate noiseBuffer (1 second of white noise)     │
│                                                           │
│  3. Effects.play(name):                                  │
│     • If ctx not ready → silently skip                   │
│     • Create oscillator + gain envelope                  │
│     • Connect to sfxGain                                 │
│     • Start + stop after duration                        │
│                                                           │
│  Sound types:                                             │
│  ┌─────────────┬──────────────────────────────────┐      │
│  │ Name        │ Synthesis                         │      │
│  ├─────────────┼──────────────────────────────────┤      │
│  │ fire        │ square 800Hz, 60ms, vol 0.15     │      │
│  │ melee       │ sawtooth 300→80Hz sweep, 120ms  │      │
│  │ dash        │ sine 200→600Hz sweep, 80ms      │      │
│  │ jump        │ square 200→500Hz sweep, 60ms    │      │
│  │ doubleJump  │ square 400→800Hz sweep, 60ms    │      │
│  │ hit         │ white noise 80ms, vol 0.2       │      │
│  │ explosion   │ noise 300ms + sine 100Hz        │      │
│  │ enemyHit    │ square 400Hz, 50ms              │      │
│  │ bossHit     │ square 200Hz, 80ms              │      │
│  │ bossDeath   │ sawtooth 200→50Hz sweep, 500ms │      │
│  │ playerDeath │ sawtooth 400→50Hz sweep, 500ms │      │
│  │ checkpoint  │ sine 800Hz + 1200Hz (2 tones)  │      │
│  │ uiClick     │ square 600Hz, 40ms              │      │
│  │ uiHover     │ square 400Hz, 30ms              │      │
│  │ victory     │ sine C5+E5+G5 arpeggio          │      │
│  │ phaseChange │ sawtooth 100→300Hz, 300ms      │      │
│  │ weaponSwitch│ square 500Hz, 40ms              │      │
│  └─────────────┴──────────────────────────────────┘      │
│                                                           │
│  Visual effects:                                          │
│  • sparks(x, y, color, count) — fading circles           │
│  • explosion(x, y, color, scale) — flash + ring + smoke  │
│  • screenFlash(scene, color, intensity, duration)        │
│                                                           │
│  Volume:                                                  │
│  • masterVolume (0-1, default 0.7)                       │
│  • sfxVolume (0-1, default 0.8)                          │
│  • muted (boolean)                                       │
│  • All saved in localStorage                             │
└──────────────────────────────────────────────────────────┘
```

---

## STAGE LAYOUT

```
Stage 1: ABANDONED FACTORY
Total width: 7680px (6 sections × 1280px each)

  Section 1          Section 2          Section 3
  x=0                x=1280             x=2560
  ┌──────────┐       ┌──────────┐       ┌──────────┐
  │ Tutorial │       │ Combat A │       │Platform  │
  │ Zone     │       │          │       │ Section  │
  │          │       │ 2 drones │       │ 1 drone  │
  │ No enemies│      │          │       │ + spikes │
  │          │       │  ┌──┐    │       │ platforms│
  │ ┌──┐     │       │  └──┘    │       │ at diff  │
  │ └──┘     │       │    ┌──┐  │       │ heights  │
  │ player   │       │    └──┘  │       │          │
  └──────────┘       └──────────┘       └──────────┘

  Section 4          Section 5          Section 6
  x=3840             x=5120             x=6400
  ┌──────────┐       ┌──────────┐       ┌──────────┐
  │ Combat B │       │Checkpoint│       │ Boss     │
  │          │       │          │       │ Arena    │
  │2 spiders │       │ No enemies│      │          │
  │1 heavy   │       │ Save point│      │ GUARDIAN │
  │          │       │          │       │ AX-09    │
  │ ┌─┐  ┌─┐│       │  ┌──┐    │       │          │
  │ └─┘  └─┘│       │  └──┘    │       │ 2 phases │
  │  ┌──┐   │       │          │       │          │
  │  └──┘   │       │          │       │          │
  └──────────┘       └──────────┘       └──────────┘

  Checkpoints: sections 2 and 5 (auto-save when entered)
  Camera: follows player, deadzone 160×100
  Bounds: x=0 to x=7680, y=0 to y=720
```

---

## CLEANUP STRATEGY

```
cleanupPlay() — runs when leaving play state:

  Step 1: Remove EventBus listeners
    EventBus.off('PLAYER_DEAD', onPlayerDied, this)
    EventBus.off('ENEMY_DEAD', onEnemyKilled, this)
    EventBus.off('PLAYER_DAMAGED', onPlayerDamaged, this)

  Step 2: Remove Matter collision listener
    matter.world.off('collisionstart', onCollisionStart, this)
    ⚠️ Must pass context arg for reliable removal

  Step 3: Kill all projectiles
    projectiles.forEach(p => p.kill())  // destroys sprite + trail
    projectiles = []

  Step 4: Destroy player
    player.destroy()
      → removeEventListener('keydown', onKeyDown)
      → removeEventListener('keyup', onKeyUp)
      → destroy gunArm, torso, head, legs, core, visor
      → destroy sprite (Matter body)

  Step 5: Destroy all enemies
    enemies.forEach(e => e.destroy())
      → destroy telegraphGfx
      → destroy visualGfx
      → destroy sprite
    enemies = []

  Step 6: Destroy boss
    boss?.destroy()
      → destroy bossGfx + bossCore + sprite
    boss = null

  Step 7: Destroy solids (platforms)
    solids.forEach(s => s.destroy())
    solids = []

  Step 8: Destroy section triggers
    sectionTriggers.forEach(t => t.destroy())
    sectionTriggers = []

  Step 9: Destroy boss arena trigger
    bossArenaTrigger?.destroy()
    bossArenaTrigger = null

  Step 10: Kill all tweens
    tweens.killAll()  // neon glows, spike glows, etc.

  Step 11: Cancel sequence timers
    sequenceTimers.forEach(t => t.remove())
    sequenceTimers = []

  Step 12: Destroy UI
    hud.destroy()   → EventBus.off('CHECKPOINT') + off('GAME_STATE')
    bossBar.destroy() → EventBus.off('BOSS_PHASE')

  Step 13: Destroy graphics
    graphics.destroy()
      → unregister from _instances
      → destroy all lights
      → destroy darkness overlay

  Step 14: Reset camera
    cameras.main.setZoom(1)
    cameras.main.stopFollow()
    cameras.main.setBounds(0, 0, 1280, 720)

  Step 15: Reset matter world bounds
    matter.world.setBounds(0, 0, 1280, 720)
```

---

## PHASER 4.2 COMPLIANCE

```
┌────────────────────────┬──────────────────────┬──────────────────────┐
│ Feature                │ Phaser 3 (old)       │ Phaser 4.2 (current) │
├────────────────────────┼──────────────────────┼──────────────────────┤
│ Post-processing        │ setPostPipeline()    │ camera.filters API   │
│                        │                      │ (not used — disabled)│
│ Physics stepping       │ fixedStep: true      │ Variable delta       │
│                        │ in matter config     │ (no fixedStep)       │
│ Shader syntax          │ GLSL 1.00            │ GLSL 3.00            │
│                        │ varying, gl_FragColor│ in, out              │
│ Pipeline class         │ PostFXPipeline       │ Filters.Controller   │
│ Body access            │ world.bodies         │ world.getAllBodies() │
│ Matter config          │ fixedStep, correction│ gravity, timeScale   │
│ intersectRay 5th arg   │ maxBodies count      │ ray width in pixels  │
│ Camera fade/flash      │ camera.fadeOut()     │ camera.fadeOut() ✓   │
│ Scene pause/resume     │ scene.pause()        │ scene.pause() ✓      │
│ Matter.add.image       │ ✓                    │ ✓                    │
│ setBlendMode           │ ✓                    │ ✓                    │
│ Tweens                 ✓                      │ ✓                    │
│ Gamepad API            │ input.gamepad        │ navigator.getGamepads│
└────────────────────────┴──────────────────────┴──────────────────────┘

⚠️ Current code uses NONE of the deprecated Phaser 3 APIs.
```

---

## BACKUP STRATEGY

```
scripts/auto-sync.sh:

  Step 1: git add -A
  Step 2: git commit -m "message"
  Step 3: git push origin main  →  GitHub (Russia24x/Mecha)
  Step 4: tar cf /home/sync/repo.tar  →  local backup

  Usage:
    bash scripts/auto-sync.sh "commit message"
    bash scripts/auto-sync.sh  (auto timestamp message)

  GitHub: https://github.com/Russia24x/Mecha (private)
  Local backup: /home/sync/repo.tar (~1.6MB)
```

---

*Document version 2.0 — 2026-07-11*
