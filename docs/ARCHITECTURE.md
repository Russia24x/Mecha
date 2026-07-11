# MECHA: LAST PROTOCOL — Architecture Documentation

> **Version:** MVP 2.0 (Rebuild)
> **Engine:** Phaser 4.2.1 + Matter.js
> **Framework:** Next.js 16 (App Router) + TypeScript
> **Total code:** ~3100 lines across 20 files

---

## 1. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16 |
| Language | TypeScript | 5 |
| Game Engine | Phaser | 4.2.1 |
| Physics | Matter.js (via Phaser) | Built-in |
| Renderer | WebGL 2.0 (auto-fallback Canvas) | — |
| Audio | Web Audio API (procedural) | Browser native |
| Input | Keyboard + HTML5 Gamepad API | Browser native |
| State | localStorage | Browser native |
| Package Manager | Bun | 1.3+ |

---

## 2. Directory Structure

```
/home/z/my-project/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx           # Root layout (metadata, fonts)
│   │   ├── page.tsx             # Game page (loads PhaserGame dynamically)
│   │   └── globals.css          # Tailwind + global styles
│   ├── game/                     # ← ALL game code lives here
│   │   ├── PhaserGame.ts        # Game bootstrap (config, scenes array)
│   │   ├── shared/              # Cross-cutting modules
│   │   │   ├── Constants.ts     # All tuning values (GAME, PLAYER, STAGE_1, COLORS)
│   │   │   ├── Types.ts         # Shared TypeScript types
│   │   │   ├── EventBus.ts      # Global event emitter (6 events)
│   │   │   ├── Effects.ts       # Audio (procedural SFX) + Visual effects
│   │   │   ├── GamepadManager.ts# HTML5 Gamepad API wrapper
│   │   │   └── Save.ts          # localStorage save system (versioned)
│   │   └── features/            # Feature-based modules
│   │       ├── scenes/          # Phaser scenes
│   │       │   ├── BootScene.ts # Asset loading + procedural textures
│   │       │   ├── GameScene.ts # Main scene (state machine)
│   │       │   └── UIScene.ts   # Pause menu overlay
│   │       ├── player/
│   │       │   └── Player.ts    # Player entity (movement, combat, visual)
│   │       ├── enemies/
│   │       │   └── Enemy.ts     # Enemy entity (3 types, FSM AI)
│   │       ├── boss/
│   │       │   └── Boss.ts      # Boss entity (2 phases)
│   │       ├── combat/
│   │       │   ├── Projectile.ts# Projectile entity (overlap detection)
│   │       │   └── DamageSystem.ts # Damage resolution + hit-stop + shake
│   │       ├── physics/
│   │       │   ├── PhysicsWorld.ts  # Matter.js wrapper (solids, sensors, raycast)
│   │       │   └── CollisionLayers.ts # Body config helper
│   │       ├── rendering/
│   │       │   └── Graphics.ts  # Darkness overlay + brightness + lights
│   │       └── ui/
│   │           ├── HUD.ts       # In-game HUD (health, energy, weapon)
│   │           └── BossBar.ts   # Boss health bar
│   └── components/ui/           # shadcn/ui components (not used by game)
├── public/                      # Static assets
├── scripts/
│   └── auto-sync.sh            # Git commit + push + tar backup
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## 3. Scene Architecture

```
┌─────────────────────────────────────────────────────┐
│                   PhaserGame.ts                     │
│   new Phaser.Game({                                 │
│     type: Phaser.AUTO,  // WebGL 2.0 first          │
│     physics: { matter: { gravity: {y: 0.9} } },    │
│     scene: [BootScene, GameScene, UIScene]          │
│   })                                                │
└─────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  BootScene  │ │  GameScene  │ │   UIScene   │
   │             │ │             │ │             │
   │ • Load      │→│ • State     │ │ • Pause     │
   │   textures  │ │   machine   │ │   menu      │
   │ • Loading   │ │ • Gameplay  │ │ • Resume    │
   │   bar       │ │ • HUD       │ │ • Restart   │
   │ • Start     │ │ • Enemies   │ │ • Quit      │
   │   GameScene │ │ • Boss      │ │             │
   └─────────────┘ └─────────────┘ └─────────────┘
```

### BootScene (`features/scenes/BootScene.ts`, 59 lines)
- **Purpose:** Preload shared assets + generate procedural textures
- **Generates:** `__white` texture (1×1 pixel, used for all tinted rectangles)
- **Shows:** Loading bar with percentage
- **Transitions to:** GameScene after 400ms delay

### GameScene (`features/scenes/GameScene.ts`, 597 lines)
- **Purpose:** Main game scene with internal state machine
- **States:** `menu` | `map` | `play` | `victory` | `gameover` | `settings`
- **Key responsibility:** Orchestrates all gameplay systems

#### State Machine
```
                    ┌─────────┐
                    │  menu   │ ← game starts here
                    └────┬────┘
                         │ START
                         ▼
                    ┌─────────┐
              ┌─────│   map   │─────┐
              │     └─────────┘     │
              │ ENTER               │ SETTINGS
              ▼                     ▼
         ┌─────────┐           ┌──────────┐
         │  play   │           │ settings │
         └────┬────┘           └──────────┘
              │ DEATH               ▲
              ▼                     │ BACK
         ┌──────────┐               │
         │ gameover │───────────────┘
         └────┬─────┘ RETRY → play
              │ QUIT
              ▼
         ┌─────────┐
         │  menu   │
         └─────────┘
```

### UIScene (`features/scenes/UIScene.ts`, 139 lines)
- **Purpose:** Pause menu overlay (runs on top of GameScene)
- **Triggered by:** ESC key during play
- **Buttons:** RESUME, RESTART STAGE, QUIT TO MAP, QUIT TO MENU
- **Input:** Keyboard + Gamepad (50ms poll timer)

---

## 4. Entity Architecture

### Player (`features/player/Player.ts`, 469 lines)

```
┌──────────────────────────────────────────────────┐
│                   Player                          │
│                                                   │
│  ┌─────────────┐  Physics body (Matter.Image)    │
│  │   sprite    │  • alpha=0 (invisible)          │
│  │ (invisible) │  • fixedRotation                │
│  └─────────────┘  • bodyRadius=18                │
│                                                   │
│  Visual parts (separate GameObjects):             │
│  ┌─────────────────────────────────────┐          │
│  │  mechaTorso (rectangle, depth 14)   │          │
│  │  core (circle, depth 15, ADD blend) │          │
│  │  mechaHead (rectangle, depth 15)    │          │
│  │  visor (rectangle, depth 16)        │          │
│  │  mechaLegL/R (rectangles, depth 13) │          │
│  │  gunArm (rectangle, depth 15)       │          │
│  └─────────────────────────────────────┘          │
│                                                   │
│  Combat:                                          │
│  • Plasma Rifle (default)                         │
│  • Melee slash (60px range, 35 damage)            │
│  • Dash (afterimage trail + i-frames)             │
│                                                   │
│  Movement:                                        │
│  • WASD/Arrows + Gamepad left stick               │
│  • Jump (coyote time 120ms + buffer 120ms)        │
│  • Variable jump height (cut on keyup)            │
│  • Dash (220ms, 10 speed, i-frames)               │
│                                                   │
│  Input:                                           │
│  • Window keydown/keyup (single source, no dup)   │
│  • Gamepad (A=jump, X=fire, Y=melee, B=dash)     │
│  • Handlers stored as fields → removed in destroy │
└──────────────────────────────────────────────────┘
```

### Enemy (`features/enemies/Enemy.ts`, 344 lines)

```
3 enemy types, each with FSM:

  ┌─────────┐  inRange + LOS  ┌─────────┐  in attackRange  ┌─────────┐
  │ patrol  │────────────────→│ aggro   │─────────────────→│ attack  │
  └─────────┘                 └─────────┘                  └────┬────┘
       ↑                           ↑                            │
       │  lost player              │  hit during telegraph       │
       └───────────────────────────┴───────┐                    │
                                           ▼                    │
                                      ┌─────────┐                │
                                      │ stagger │←───────────────┘
                                      └─────────┘  400ms → aggro
```

| Type | HP | Speed | Attack | Behavior |
|---|---|---|---|---|
| Drone | 24 | 1.4 | Shoot (bullet) | Flying, hovers, strafes, retreats at low HP |
| Spider | 55 | 2.2 | Lunge | Ground, chases, lunges with squash telegraph |
| Heavy | 140 | 0.9 | Charge | Ground, slow, charges with flash telegraph |

### Boss (`features/boss/Boss.ts`, 171 lines)

```
Phase 1 (100%–50% HP)     Phase 2 (50%–0% HP)
  • Shoot 3-bullet spread    • Faster attacks
  • Lunge toward player      • More aggressive
  • Idle between attacks     • Shorter cooldowns

⚠️ ONLY 2 PHASES — no 3rd phase (MAX_PHASES = 2)

Visual: Hexagonal body (Graphics) + glowing core (Arc, ADD blend)
```

### Projectile (`features/combat/Projectile.ts`, 142 lines)
- **Owner:** `player` or `enemy`
- **Hit detection:** Overlap-based (iterates scene.children.list, checks distance)
- **TTL:** 1500ms default (configurable via `opts.ttl`)
- **Trail:** 4 fading circles behind projectile
- **Bounds:** Kills if x < -100 or x > 20000 (generous, crash-free)

### DamageSystem (`features/combat/DamageSystem.ts`, 91 lines)
- **dealDamage(event):** Looks up target by ID, applies damage, spawns FX
- **Hit-stop:** Slows Matter engine to 0.05× for 40-120ms on hit
- **Screen shake:** 80ms shake scaled by damage
- **Knockback:** Applies force via `Matter.Body.applyForce`

---

## 5. Rendering Pipeline

```
Depth layers (lower = behind):

  -3   Stage background image (if any)
  -1.5 Dark overlay (MULTIPLY blend, alpha=0.15-0.2)
   5   Platforms / solids (visual rectangles)
   8   Landing dust particles
  12   Telegraph circles (enemy attack warning)
  13   Player afterimage, enemy visuals
  14   Player torso, enemy body
  15   Player core/head/visor/gun, enemy details
  16   Player visor glow
  20   Sparks, hit particles
  24-25 Explosions
  90   Darkness overlay (MULTIPLY blend, brightness-controlled)
  91   Light circles (ADD blend, follow entities)
 200   HUD + BossBar (ABOVE all overlays) ✓
 250   Game-over / boss-lore overlays
```

### Graphics (`features/rendering/Graphics.ts`, 100 lines)
- **Darkness overlay:** Full-screen rectangle at depth 90, MULTIPLY blend
- **Brightness:** 0 (darkest) → 1 (brightest), controls darkness alpha
- **Lights:** Follow-player + follow-enemy circles, ADD blend
- **NO ColorMatrix filters** (removed — were causing rendering issues)

---

## 6. Event System

```
EventBus (Phaser.Events.EventEmitter wrapper)

6 events:
┌─────────────────┬──────────────────────────────────────┐
│ Event           │ Payload                              │
├─────────────────┼──────────────────────────────────────┤
│ PLAYER_DAMAGED  │ { amount, x, y }                    │
│ PLAYER_DEAD     │ { id }                               │
│ ENEMY_DEAD      │ { id, score, x, y }                  │
│ BOSS_PHASE      │ { phase, healthPct, dead? }          │
│ CHECKPOINT      │ { section }                          │
│ GAME_STATE      │ { sectionId, sectionName }           │
└─────────────────┴──────────────────────────────────────┘

Listeners:
• GameScene: PLAYER_DEAD, ENEMY_DEAD, PLAYER_DAMAGED, collisionstart
• HUD: CHECKPOINT, GAME_STATE
• BossBar: BOSS_PHASE

⚠️ All listeners are removed in cleanupPlay() to prevent leaks.
```

---

## 7. Save System

```typescript
SaveData {
  version: 2,
  lastCheckpoint: { section, x, y, timestamp } | null,
  bestBossTimeMs: number | null,
  totalKills: number,
  bossesKilled: number,
  settings: {
    lang: 'en' | 'fa',
    masterVolume: number,   // 0-1
    sfxVolume: number,      // 0-1
    muted: boolean,
    brightness: number,     // 0-1, default 0.7
  }
}

Storage: localStorage['mecha_last_protocol_save_v2']
Migration: Auto-migrates old saves (adds missing fields)
```

---

## 8. Input System

### Keyboard (window listeners — single source of truth)
```
WASD / Arrows  → Move (held)
Space          → Jump (edge) + cut (keyup)
Shift          → Dash (edge, direction = held key or facing)
J              → Fire (edge + held for auto-fire)
K              → Melee (edge)
1-4            → Weapon select (future)
ESC            → Pause (toggle UIScene)
Enter          → Menu activate
```

### Gamepad (HTML5 Gamepad API, 50ms poll)
```
A (0)     → Jump
X (2)     → Fire  (also RT button 7)
Y (3)     → Melee
B (1)     → Dash
LB (4)    → Weapon prev
RB (5)    → Weapon next
Start (9) → Pause
Back (8)  → Menu back
D-pad     → Menu navigation (overrides left stick)
```

⚠️ **Each button has exactly ONE role** (no conflicts like RB=melee+weapon).

---

## 9. Physics (Matter.js)

```
World config:
  gravity: { x: 0, y: 0.9 }
  bounds: 0,0 to 7680×720 (STAGE_1.TOTAL_WIDTH)
  No fixedStep (removed in Phaser 4.2 — uses variable delta)

Body categories (bitmask):
  SOLID       0x0001   — platforms, walls
  PLAYER      0x0002
  ENEMY       0x0004
  BOSS        0x0008
  PROJ_PLAYER 0x0010
  PROJ_ENEMY  0x0020
  SENSOR      0x0040   — triggers, checkpoints
  PICKUP      0x0080

Collision pairs (what hits what):
  Player  ↔ Solid, Enemy, Boss, EnemyProj
  Enemy   ↔ Solid, PlayerProj
  Boss    ↔ Solid, PlayerProj
  PlayerProj ↔ Solid, Enemy, Boss
  EnemyProj   ↔ Solid, Player

Queries:
  intersectPoint(x, y)     — ground check (player feet)
  intersectRay(x1,y1,x2,y2) — LOS check (enemy AI, hitscan)
  query.region(circle)      — melee hit detection
```

---

## 10. Stage Layout (Stage 1)

```
Total width: 7680px (6 sections × 1280px)

Section 1 (x=0)     Tutorial Zone     — no enemies
Section 2 (x=1280)  Combat Room A     — 2 drones
Section 3 (x=2560)  Platform Section  — 1 drone + spike traps
Section 4 (x=3840)  Combat Room B     — 2 spiders + 1 heavy
Section 5 (x=5120)  Checkpoint         — no enemies, save point
Section 6 (x=6400)  Boss Arena        — Guardian AX-09 (2 phases)

Checkpoints: sections 2 and 5
Camera: follows player, deadzone 160×100, bounds 0-7680
```

---

## 11. Cleanup Strategy (prevents memory leaks)

```
cleanupPlay() runs when leaving play state:
  1. EventBus.off() — remove all 4 gameplay listeners
  2. matter.world.off('collisionstart') — with context arg
  3. projectiles.forEach(p.kill()) — destroy sprites
  4. player.destroy() — destroy sprite + visuals + window listeners
  5. enemies.forEach(e.destroy()) — destroy sprite + visualGfx + telegraphGfx
  6. boss.destroy() — destroy sprite + bossGfx + bossCore
  7. solids.forEach(s.destroy()) — destroy platform bodies
  8. sectionTriggers.forEach(t.destroy())
  9. bossArenaTrigger.destroy()
  10. tweens.killAll() — kill all active tweens
  11. sequenceTimers.forEach(t.remove()) — cancel pending delayed calls
  12. hud.destroy() + bossBar.destroy() — remove UI listeners
  13. graphics.destroy() — remove darkness + lights
  14. cameras.main reset (zoom, follow, bounds)
  15. matter.world reset bounds
```

---

## 12. Phaser 4.2 Compliance

| Feature | Phaser 3 (old) | Phaser 4.2 (current) |
|---|---|---|
| Post-processing | `setPostPipeline()` | `camera.filters.external.addVignette()` |
| Physics stepping | `fixedStep: true` in config | Variable delta (removed fixedStep) |
| Shader syntax | GLSL 1.00 (`varying`, `gl_FragColor`) | GLSL 3.00 (`in`, `out`) |
| Pipeline class | `PostFXPipeline` | `Filters.Controller` |
| Body access | `world.bodies` | `world.getAllBodies()` |
| Matter config | `fixedStep`, `correction` | `gravity`, `timing.timeScale` |

**Current code uses NONE of the deprecated Phaser 3 APIs.**

---

## 13. File Line Counts

| File | Lines | Purpose |
|---|---|---|
| `GameScene.ts` | 597 | Main scene + state machine |
| `Player.ts` | 469 | Player entity |
| `Enemy.ts` | 344 | Enemy entity (3 types) |
| `Effects.ts` | 214 | Audio + visual effects |
| `GamepadManager.ts` | 141 | Gamepad input |
| `UIScene.ts` | 139 | Pause menu |
| `Save.ts` | 128 | Save system |
| `Projectile.ts` | 142 | Projectile entity |
| `Boss.ts` | 171 | Boss entity |
| `HUD.ts` | 112 | In-game HUD |
| `Constants.ts` | 98 | All tuning values |
| `PhaserGame.ts` | 101 | Game bootstrap |
| `Graphics.ts` | 100 | Lighting + brightness |
| `BossBar.ts` | 61 | Boss health bar |
| `BootScene.ts` | 59 | Asset loading |
| `PhysicsWorld.ts` | 52 | Matter wrapper |
| `EventBus.ts` | 47 | Event system |
| `DamageSystem.ts` | 91 | Damage resolution |
| `Types.ts` | 20 | Shared types |
| `CollisionLayers.ts` | 15 | Body config |
| **Total** | **~3100** | |

---

## 14. Backup Strategy

```bash
# Manual sync (anytime):
bash scripts/auto-sync.sh "commit message"

# What it does:
1. git add -A && git commit
2. git push origin main  (→ GitHub: Russia24x/Mecha)
3. tar cf /home/sync/repo.tar (→ local backup)

# GitHub remote:
https://github.com/Russia24x/Mecha (private)
```

---

*Last updated: 2026-07-11*
