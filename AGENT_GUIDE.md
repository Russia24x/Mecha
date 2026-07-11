# MECHA: LAST PROTOCOL — Complete Architecture v3.0

> **Read this file FIRST before writing any code.**
> This is the authoritative design document for ALL AI agents working on this project.
> Last updated: 2026-07-11

---

## Core Vision

- **2D Side-Scrolling Action RPG**
- **Metroidvania Exploration**
- **Soulslike Combat**
- **Cinematic Storytelling**
- **Indie Scope**
- **AI-First Development**
- **Data Driven**
- **Future Expandable**

---

## Technology

| Layer | Technology |
|---|---|
| Engine | Phaser 4.x |
| Framework | Next.js |
| Language | TypeScript |
| Physics | Matter.js |
| UI | React (wraps Phaser canvas) |
| Audio | Web Audio API (procedural SFX) |
| Save | JSON Save System (localStorage) |
| Localization | Persian + English |

---

## High Level Architecture

```
Game
├── Runtime         — Game loop, scene manager, state machine
├── Systems         — 18+ independent systems (no entity dependencies)
├── World           — Act → Region → Area → Checkpoint
├── Entities        — Player, Enemy, Boss, Projectile
├── Data            — All gameplay data (weapons, enemies, bosses, skills, items, acts, NPC, dialogue, quests)
├── UI              — HUD, Inventory, Map, Skill Tree, Dialogue, Quest, Pause, Settings, Boss, Loading
├── Resources       — Localization (EN/FA), textures (procedural)
└── Save            — Versioned, migrates, full game state
```

### Runtime Flow
```
GameRuntime → Game Loop → Scene Manager → Update Systems → Render
```

### Systems (each independent, no direct Player dependency)
- Input System
- Combat System
- Damage System
- Physics System
- Animation System
- Camera System
- Audio System
- Particle System
- Weapon System
- Inventory System
- Skill System
- Quest System
- Dialogue System
- NPC System
- Loot System
- Save System
- Localization System
- World System
- Map System
- Checkpoint System
- Boss System
- UI System

---

## Player

Player is ONLY responsible for itself:
- Health
- Energy
- Level
- Experience
- Skill Points
- Inventory (via InventorySystem)
- Weapons (via WeaponUpgradeSystem)
- Animation
- Movement
- Stats (computed from skills via SkillTreeSystem)

---

## Level System

- **Max Level:** 100
- **Each Level:** +1 Skill Point
- **XP Formula:** `100 × level^1.5` (increasing curve)
  - Level 1→2: 100 XP
  - Level 2→3: ~283 XP
  - Level 3→4: ~520 XP
  - Harder as you progress

---

## Skill Tree

6 trees, player chooses their own build path:

1. **Combat** — damage boosts, fire rate
2. **Weapon** — unlock new weapons
3. **Movement** — speed, dash cooldown, double jump, wall jump, grapple
4. **Energy** — max energy, regen, hover
5. **Protocol** — EMP, hack abilities
6. **Survival** — health, invulnerability

Each level = exactly 1 Skill Point. Player is free to choose their build path.

---

## Weapons

8 weapons, each upgradeable:

| Weapon | Tier |
|---|---|
| Assault Rifle | Projectile |
| Shotgun | Projectile (spread) |
| Railgun | Hitscan |
| Plasma Cannon | Projectile (heavy) |
| Laser | Hitscan (rapid) |
| Rocket | Explosive (AoE) |
| Sword | Melee |
| Energy Blade | Melee (upgraded) |

Each weapon has: Level, Damage, Range, Fire Rate, Energy Cost, Passive Bonus. Upgradeable to level 5.

---

## Inventory

- Weapons
- Upgrade Materials (scrap metal, circuit boards, armor plates, etc.)
- Key Items (boss drops, quest items)
- Quest Items
- Consumables (health packs, energy cells)

Simple but extensible.

---

## NPC System

Each NPC has:
- Identity (name, location)
- Dialogue (branching, conditional)
- Shop (future)
- Quest (linked quests)
- Flags (met, quest_given, quest_done — persisted)
- Lore

NPCs get new dialogue as story progresses (flag-based).

---

## Dialogue

- Normal Dialogue
- Quest Dialogue
- Boss Dialogue
- Hidden Dialogue

All text from localization files (EN/FA). No hardcoded strings. Supports branching + conditions + RTL for Persian.

---

## Quest System

- Main Story
- Side Quest
- Hidden Quest
- NPC Quest

Objectives: kill, collect, reach, talk, boss. Auto-tracked via EventBus. Rewards: XP + items.

---

## Boss System

Each Boss has:
- Unique AI (phased, data-driven attacks)
- Arena (dedicated area section)
- Music (future: procedural boss themes)
- Cutscene (intro + death lore)
- Lore (Souls-style, revealed on death)
- Drops (guaranteed + chance-based)

---

## Lore System (Souls-style)

Story is NOT told directly. Lore is hidden inside:
- Bosses (defeat to reveal)
- Weapons (unlock to reveal)
- NPCs (talk to reveal)
- Environment (discover areas)
- Items (collect to reveal)
- Memories (future)

Player must discover the story themselves.

---

## World Structure

```
Act → Region → Area → Checkpoint
```

| Act | Regions | Areas |
|---|---|---|
| Act I | Factory, Forest | Abandoned Factory, Toxic Forest |
| Act II | Desert, Ruined City, Underground | (future) |
| Act III | Orbital Station, AI Core, Final Protocol | (future) |

---

## World Map

- **Fog of War** — only discovered areas visible
- **Unlocked Regions** — areas unlock progressively
- **Fast Travel** — travel between discovered areas
- **Boss Icons** — show defeated/undefeated bosses
- **NPC Icons** — show NPC locations (future)
- **Checkpoint Icons** — show save points

At game start, only a small portion is visible.

---

## Exploration (Metroidvania)

Player unlocks abilities to access new areas and revisit old ones:
- Dash
- Double Jump
- Wall Jump
- Grapple
- EMP
- Hover

---

## Enemies

All enemies are data-driven:

| Enemy | Type |
|---|---|
| Drone | Flying, ranged |
| Spider | Ground, lunge |
| Heavy | Ground, charge |
| Sniper | Ground, long-range |
| Flying AI | Flying, fast |
| Elite | Ground, multi-attack |
| Mini Boss | (future) |
| Boss | Unique per area |

---

## Save System

Tracks:
- Player: Level, XP, Skill Tree, Weapons, Inventory
- Bosses: defeated + best times
- NPC Flags: per-NPC dialogue/quest state
- Quest: completed/active flags
- Map: unlocked + discovered areas
- Checkpoint: last save position
- Settings: locale, volume, brightness

---

## Localization

- **fa** (Persian) — RTL
- **en** (English) — LTR

All text in JSON files. No hardcoded strings in code.

---

## UI

- HUD (health, energy, weapon, level/XP)
- Inventory (tabbed: weapons, materials, consumables, key items)
- Map (fog of war, fast travel)
- Skill Tree (6 trees, unlock buttons)
- Dialogue (branching, RTL support)
- Quest (active, complete, turned-in)
- Pause (resume, restart, settings, skills, inventory, quests, map)
- Settings (volume, brightness, language)
- Boss (health bar, phase indicator)
- Loading (boot screen)

---

## Data Driven

ALL gameplay data is outside source code:

| Data File | Content |
|---|---|
| `data/weapons/weapons.ts` | 8 weapons with all stats |
| `data/enemies/enemies.ts` | 6 enemy types with all stats + drops |
| `data/bosses/bosses.ts` | 2 bosses with phases + lore + drops |
| `data/skills/skills.ts` | 19 skills in 6 trees |
| `data/items/items.ts` | 15 items (materials, key items, consumables, abilities) |
| `data/acts/acts.ts` | World structure (Act I: Factory + Forest) |
| `data/npc/npcs.ts` | 2 NPCs with dialogue refs + flags |
| `data/dialogue/dialogues.ts` | 8 dialogues with conditions + branching |
| `data/quests/quests.ts` | 1 quest with objectives + rewards |
| `data/localization/en.json` | All English strings |
| `data/localization/fa.json` | All Persian strings |

---

## AI Development Rules

1. **One file = one responsibility.** No God Classes.
2. **No hardcoded text.** All strings via `t('key')` from localization.
3. **All content is data-driven.** Adding content = adding data, not changing code.
4. **All systems are independent.** No direct system-to-system imports.
5. **Communication only via EventBus or internal API.**
6. **Classes are small and testable.** If >500 lines, split.
7. **Prefer composition over inheritance.** Inject systems.
8. **Keep code clean, typed, and documented.** JSDoc on every class.
9. **Make every system extensible** without breaking existing code.
10. **Use Phaser 4.2 API only.** Check: https://docs.phaser.io/api-documentation/4.0.0/api-documentation

### MUST NOT DO
- NO `setPostPipeline()` — removed in Phaser 4.2
- NO `fixedStep` in Matter config — removed in Phaser 4.2
- NO `PostFXPipeline` — replaced by `Filters.Controller`
- NO `world.bodies` — use `world.getAllBodies()`
- NO `import type` for classes used at runtime — use `import`
- NO `scene.pause()` for pause menu — use internal `paused` flag
- NO `scene.launch('UIScene')` — pause is handled within GameScene
- NO window listeners without cleanup — always `removeEventListener` in `destroy()`
- NO duplicate input listeners — `InputSystem` is the single source of truth
- NO hardcoded gameplay values — use `Constants.ts` or data files

---

## File Structure

```
src/game/
├── PhaserGame.ts              — Game config
├── shared/Constants.ts        — GAME, PLAYER, PHYSICS, COLORS
├── data/                      — ALL gameplay data (no logic)
│   ├── types.ts               — All TypeScript interfaces
│   ├── weapons/               — 8 weapons
│   ├── enemies/               — 6 enemy types
│   ├── bosses/                — 2 bosses
│   ├── skills/                — 19 skills in 6 trees
│   ├── items/                 — 15 items
│   ├── acts/                  — World structure
│   ├── npc/                   — NPCs
│   ├── dialogue/              — Dialogues
│   ├── quests/                — Quests
│   └── localization/          — EN + FA JSON
├── systems/                   — 18 independent systems
├── world/                     — World, Area, Checkpoint, Map
├── entities/                  — Player, Enemy, Boss, Projectile
├── features/scenes/           — BootScene, GameScene, UIScene(stub)
└── ui/                        — 8 UI panels
```

---

## Adding New Content (Agent Guide)

| To add... | What to do |
|---|---|
| New weapon | Add to `data/weapons/weapons.ts` + localization keys |
| New enemy | Add to `data/enemies/enemies.ts` + add to section in `acts.ts` + localization |
| New boss | Add to `data/bosses/bosses.ts` + add `bossId` to section + lore in `LoreSystem` + localization |
| New skill | Add to `data/skills/skills.ts` + localization — `computeStats()` auto-applies |
| New NPC | Add to `data/npc/npcs.ts` + dialogues to `dialogues.ts` + localization |
| New area | Add to `data/acts/acts.ts` under region + localization — `AreaLoader` builds automatically |
| New quest | Add to `data/quests/quests.ts` + link to NPC + localization |
| New item | Add to `data/items/items.ts` + localization |
| New dialogue | Add to `data/dialogue/dialogues.ts` + localization keys in EN/FA JSON |
| New lore | Add entry to `LoreSystem.LORE_ENTRIES` + localization keys |

**No code changes needed for any of the above.** Just data + localization.

---

## Future Compatibility

The architecture is ready for future expansion WITHOUT major changes:

- **Cloud Save** — `SaveSystem` abstracts storage layer
- **Achievements** — `EventBus` already emits all key events (LEVEL_UP, BOSS_DEAD, QUEST_COMPLETE, etc.)
- **Mod Support** — Data files are external, can be swapped/added
- **New Acts** — Add to `acts.ts`, no code changes
- **Co-op** — `EventBus` can be bridged to network layer
- **PvP** — Entities use interface-based damage (takeDamage), swappable owners
- **Dedicated Server** — Systems are stateless, can run server-side
- **Online Events** — `EventBus` can emit to network
- **Seasonal Content** — Data files versioned, can be pushed as updates
- **Steam Release** — Phaser runs in Electron/desktop wrappers
- **Console Release** — Phaser supports gamepad API natively

---

## Architecture Philosophy

> This project is NOT designed as a small indie game. It is built as a **Game Platform** — a core engine whose first version is a standalone game, but whose architecture is ready for years of growth. AI agents can add new content, stages, bosses, NPCs, weapons, and even new Acts without changing the core engine. This approach is compatible with the current indie scope AND future features like online multiplayer, co-op, or content expansions.
