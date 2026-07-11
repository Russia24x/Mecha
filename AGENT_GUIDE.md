# MECHA: LAST PROTOCOL — Agent Development Guide

> **Read this file FIRST before writing any code.**
> This is the authoritative design document for all AI agents working on this project.

---

## Project Identity

**MECHA: LAST PROTOCOL** is a 2D Side-Scrolling Action RPG inspired by:
- **Blasphemous** — dark atmosphere, precise combat, environmental storytelling
- **Child of Light** — beautiful art direction, poetic narrative
- **Armored Core VI** — mecha customization, weapon variety, tactical combat
- **Elden Ring** — open exploration, hidden lore, challenging bosses
- **Rayman** — fluid platforming, tight movement feel

---

## Architecture Principles

1. **Modular, data-driven architecture** — every system is independent
2. **Single responsibility per file** — no God Classes
3. **All gameplay data outside source code** — JSON/TypeScript data files only
4. **Long-term scalability** — design for years of expansion
5. **AI-assisted development** — agents must be able to add content without breaking code

---

## Core Systems

| System | Location | Responsibility |
|---|---|---|
| Runtime | `features/scenes/GameScene.ts` | Game loop, state machine, orchestration |
| World | `world/` | Act→Region→Area→Checkpoint, map, fog of war |
| Player | `entities/player/PlayerEntity.ts` | Movement, combat, stats, abilities |
| Combat | `systems/CombatSystem.ts` | Damage resolution, hit-stop, knockback |
| Weapons | `data/weapons/` + `systems/WeaponUpgradeSystem.ts` | 8 weapons, upgrades, data-driven stats |
| Inventory | `systems/InventorySystem.ts` | Weapons, materials, consumables, key items |
| Skills | `data/skills/` + `systems/SkillTreeSystem.ts` | 6 trees, 19 skills, stat computation |
| NPC | `data/npc/` + `systems/NPCSystem.ts` | Identity, flags, dialogue triggering |
| Dialogue | `data/dialogue/` + `systems/DialogueSystem.ts` | Branching, conditions, localization |
| Quest | `data/quests/` + `systems/QuestSystem.ts` | Objectives, tracking, rewards |
| Boss | `data/bosses/` + `entities/boss/BossEntity.ts` | Phases, lore, arena, drops |
| Loot | `data/items/` + drop tables in enemy/boss data | Materials, key items, consumables |
| Save | `systems/SaveSystem.ts` | Versioned, migrates, full game state |
| Localization | `data/localization/` + `systems/LocalizationSystem.ts` | EN + FA, t() function |
| Audio | `systems/AudioSystem.ts` | Procedural SFX, gesture-based AudioContext |
| Camera | `systems/CameraSystem.ts` | Follow, zoom, shake, flash, fade |
| UI | `ui/` | HUD, Dialogue, Pause, Settings, SkillTree, Inventory, Quest, Map |
| Input | `systems/InputSystem.ts` | Unified keyboard + gamepad |
| Physics | `systems/PhysicsSystem.ts` | Matter.js wrapper, raycast, LOS |
| Particles | `systems/ParticleSystem.ts` | Sparks, explosions, dust, afterimage |
| Render | `systems/RenderSystem.ts` | Darkness overlay, brightness, lights |

---

## Gameplay Features

### Level System
- Max level: **100**
- XP curve: `100 × level^1.5` (increasing cost)
- Each level: **exactly 1 Skill Point**
- XP sources: enemy kills, boss kills, quest completion

### Skill Tree
- **6 trees**: Combat, Weapon, Movement, Energy, Protocol, Survival
- 19 skills (expandable)
- Prerequisites enforced
- Skills modify `PlayerStats` via multipliers/additives
- Some skills unlock **abilities**: doubleJump, wallJump, grapple, hover, EMP, hack

### Weapons
- **8 weapons**: Assault Rifle, Shotgun, Railgun, Plasma Cannon, Laser, Rocket, Sword, Energy Blade
- Each weapon: damage, range, fireRate, energyCost, tier, color, size
- 4 tiers: hitscan, projectile, explosive, melee
- **Upgradable** to level 5 (each level +10% damage, -3% cooldown, -2% energy cost)
- Upgrade cost: scrap metal + circuit boards (from InventorySystem)

### Inventory
- 4 item types: material, key_item, consumable, ability
- Materials: scrap_metal, circuit_board, armor_plate, precision_lens, ai_chip, elite_core
- Key items: guardian_core, overseer_eye (boss drops)
- Consumables: health_pack, energy_cell (usable)
- Abilities: double_jump, wall_jump, grapple, emp, hover (unlock items)

### NPCs
- Each NPC: identity, dialogues, shop, quests, flags, lore
- NPC flags persisted in SaveSystem
- Active dialogue determined by priority + conditions

### Dialogue
- **Branching** with conditionFlag + setFlag
- 4 types: normal, quest, boss, hidden
- All text from localization files (EN/FA)
- RTL support for Persian

### Soulslike Lore
- Story NOT told directly
- Lore hidden in: bosses, weapons, NPCs, areas, items, memories
- Player discovers by: defeating bosses, talking to NPCs, collecting items, exploring
- `LoreSystem` tracks discovered entries with unlock conditions

### Boss System
- Each boss: unique AI, arena, music, cutscene, lore, drops
- Phased combat (2+ phases per boss)
- Phase transitions at health thresholds
- Boss death → lore display → rewards → world unlock

### World Structure
```
Act → Region → Area → Checkpoint
```
- Act I: Factory region (Abandoned Factory area) + Forest region (Toxic Forest area)
- Metroidvania: areas locked by abilities (dash, doubleJump, wallJump, grapple, EMP, hover)
- World Map: fog of war, fast travel, boss icons
- Checkpoints: auto-save on enter, respawn on death

### Metroidvania Progression
- Player unlocks abilities via Skill Tree
- Locked areas require specific abilities
- Backtracking to old areas with new abilities reveals secrets

### Localization
- **Persian (FA)** and **English (EN)** from day one
- All text via `t('key')` function
- RTL support for Persian dialogue
- No hardcoded strings in game code

### Save System
Tracks:
- Player: level, XP, skill points, unlocked skills, weapons, weapon levels, inventory, abilities
- Progress: checkpoint, best boss times, total kills, bosses killed
- World: unlocked areas, discovered areas
- Quests: quest flags
- NPCs: per-NPC flags
- Settings: locale, volumes, brightness, muted

---

## Development Rules

### MUST DO
1. **One file = one responsibility** — no 1000-line God Classes
2. **Avoid duplicated logic** — if logic appears twice, extract to a system
3. **Prefer composition over inheritance** — inject systems, don't extend bases
4. **Use EventBus for inter-system communication** — systems never import each other directly
5. **Keep code clean, typed, and documented** — JSDoc on every class
6. **Make every system extensible** — adding content = adding data, not changing code
7. **All text via localization** — never hardcode strings
8. **All gameplay data in data files** — weapons, enemies, bosses, skills, items, acts, NPC, dialogue, quests
9. **Use Phaser 4.2 API** — check docs at https://docs.phaser.io/api-documentation/4.0.0/api-documentation
10. **Test after changes** — verify dev server runs, no console errors
11. **Commit + push after each work session** — `bash scripts/auto-sync.sh "message"`
12. **Update STATUS.md** — mark completed/pending items

### MUST NOT DO
1. **NO hardcoded strings** — use `t('key')` with localization files
2. **NO hardcoded gameplay values** — use Constants.ts or data files
3. **NO Phaser 3 APIs** — `setPostPipeline`, `fixedStep`, `PostFXPipeline` are REMOVED in 4.2
4. **NO God Classes** — if a file exceeds 500 lines, split it
5. **NO direct system-to-system imports** — use EventBus
6. **NO `import type` for classes used at runtime** — use `import` instead
7. **NO scene.pause() for pause menu** — use internal `paused` flag
8. **NO window listeners without cleanup** — always store handlers and removeEventListener in destroy()
9. **NO duplicate input listeners** — InputSystem is the single source of truth
10. **NO `scene.launch('UIScene')`** — pause is handled within GameScene

---

## Phaser 4.2 Compliance

| Feature | ✅ Use | ❌ Don't Use (Phaser 3) |
|---|---|---|
| Post-processing | `camera.filters.external.addVignette()` | `setPostPipeline()` |
| Physics stepping | Variable delta (default) | `fixedStep: true` |
| Body access | `world.getAllBodies()` | `world.bodies` |
| Matter config | `gravity`, `timing.timeScale` | `fixedStep`, `correction` |
| intersectRay 5th arg | Ray width in pixels | Max body count |
| Gamepad | `navigator.getGamepads()` (HTML5 API) | `input.gamepad` (Phaser plugin) |
| Camera fade/flash | `camera.fadeOut()`, `camera.flash()` | Same (✅ compatible) |

**API Reference:** https://docs.phaser.io/api-documentation/4.0.0/api-documentation

---

## File Structure

```
src/game/
├── PhaserGame.ts              — Game config (WebGL 2.0, Matter.js, 3 scenes)
├── shared/
│   ├── Constants.ts           — GAME, PLAYER, PHYSICS, COLORS
│   └── Types.ts               — Shared types (re-exported from data/types)
├── data/                      — ALL gameplay data (no logic)
│   ├── types.ts               — All TypeScript interfaces
│   ├── weapons/weapons.ts     — 8 weapons
│   ├── enemies/enemies.ts     — 6 enemy types
│   ├── bosses/bosses.ts       — 2 bosses
│   ├── skills/skills.ts       — 19 skills in 6 trees
│   ├── items/items.ts         — 15 items
│   ├── acts/acts.ts           — World structure (Act I: Factory + Forest)
│   ├── npc/npcs.ts            — 2 NPCs
│   ├── dialogue/dialogues.ts  — 8 dialogues
│   ├── quests/quests.ts       — 1 quest
│   └── localization/
│       ├── en.json            — English strings
│       └── fa.json            — Persian strings
├── systems/                   — Independent game systems (no entity deps)
│   ├── EventBus.ts
│   ├── SaveSystem.ts
│   ├── InputSystem.ts
│   ├── AudioSystem.ts
│   ├── CombatSystem.ts
│   ├── PhysicsSystem.ts
│   ├── CameraSystem.ts
│   ├── ParticleSystem.ts
│   ├── RenderSystem.ts
│   ├── LocalizationSystem.ts
│   ├── NPCSystem.ts
│   ├── DialogueSystem.ts
│   ├── LoreSystem.ts
│   ├── QuestSystem.ts
│   ├── InventorySystem.ts
│   ├── WeaponUpgradeSystem.ts
│   ├── ExperienceSystem.ts
│   └── SkillTreeSystem.ts
├── world/                     — World management
│   ├── WorldSystem.ts
│   ├── AreaLoader.ts
│   ├── CheckpointSystem.ts
│   └── WorldMapSystem.ts
├── entities/                  — Game entities (use systems, don't import each other)
│   ├── player/PlayerEntity.ts
│   ├── enemies/EnemyEntity.ts
│   ├── boss/BossEntity.ts
│   └── combat/Projectile.ts
├── features/scenes/           — Phaser scenes
│   ├── BootScene.ts
│   ├── GameScene.ts           — Main orchestrator (state machine)
│   └── UIScene.ts             — Stub (pause handled in GameScene)
└── ui/                        — UI panels (depth 200-250)
    ├── hud/HUDUI.ts
    ├── dialogue/DialogueUI.ts
    ├── pause/PauseMenuUI.ts
    ├── settings/SettingsUI.ts
    ├── skilltree/SkillTreeUI.ts
    ├── inventory/InventoryUI.ts
    ├── quest/QuestUI.ts
    └── map/WorldMapUI.ts
```

---

## Communication Pattern

```
 ┌──────────┐     EventBus     ┌──────────┐
 │  System A │ ────emit()────→ │  System B │
 └──────────┘                  └──────────┘
       ↑                           ↑
       │ poll                      │ poll
       │                           │
 ┌──────────┐                ┌──────────┐
 │ GameScene │                │   UI     │
 └──────────┘                └──────────┘
```

- Systems **never** import each other
- Systems communicate via **EventBus.emit()** / **EventBus.on()**
- GameScene **polls** systems (not the other way around)
- UI **polls** systems for display data
- Entities **use** systems (inject via constructor)

---

## Adding New Content (Agent Guide)

### Add a new weapon
1. Add entry to `data/weapons/weapons.ts`
2. Add localization keys to `en.json` + `fa.json`
3. Done — no code changes needed

### Add a new enemy
1. Add entry to `data/enemies/enemies.ts`
2. Add to a section in `data/acts/acts.ts`
3. Add localization keys
4. Done

### Add a new boss
1. Add entry to `data/bosses/bosses.ts` (phases, lore, drops)
2. Add `bossId` to a section in `data/acts/acts.ts`
3. Add lore to `systems/LoreSystem.ts`
4. Add localization keys
5. Done

### Add a new skill
1. Add entry to `data/skills/skills.ts`
2. Add localization keys
3. Done — `SkillTreeSystem.computeStats()` auto-applies it

### Add a new NPC
1. Add entry to `data/npc/npcs.ts`
2. Add dialogues to `data/dialogue/dialogues.ts`
3. Add localization keys
4. Done

### Add a new area
1. Add to `data/acts/acts.ts` under appropriate region
2. Add platforms/hazards data
3. Add localization keys
4. Done — `AreaLoader` builds it automatically

### Add a new quest
1. Add entry to `data/quests/quests.ts`
2. Link to NPC via `questIds` in NPC data
3. Add localization keys
4. Done — `QuestSystem` tracks it automatically

---

## Future Compatibility

The architecture is ready for:
- **New Acts** — add to `acts.ts`, no code changes
- **New weapons/enemies/bosses** — add to data files
- **DLC-sized content** — all data-driven
- **Cloud saves** — `SaveSystem` abstracts storage
- **Achievements** — `EventBus` already emits all key events
- **Mod support** — data files are external, can be swapped
- **Online multiplayer** — `EventBus` can be bridged to network
- **Steam/console release** — Phaser runs everywhere

---

*This document is the single source of truth for project architecture. All agents MUST follow these rules.*
