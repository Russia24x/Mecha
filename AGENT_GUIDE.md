# MECHA: LAST PROTOCOL — Complete Architecture v4.0

> **Read this file FIRST before writing any code.**
> This is the authoritative design document for ALL AI agents working on this project.
> Last updated: 2026-07-15

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
| Engine | Phaser 4.2.1 |
| Framework | Next.js 16 |
| Language | TypeScript (strict) |
| Physics | Matter.js |
| UI | React (wraps Phaser canvas) |

---

## Current State (2026-07-23)

### What's Working
- **Act I** (The Fallen Foundry) — fully designed, 6 sections, 9216px, ~15-20 min gameplay
- **Act IV** (The Silent Canopy) — partially designed, 6 sections, 7680px, enemies + boss but no collectibles/shortcuts
- **5 Abilities**: double jump, wall jump, grapple, hover, EMP, hack — all functional
- **6 Enemy types**: drone, spider, heavy, sniper, flying_ai, elite — all with FSM AI
- **2 Bosses**: Guardian AX-09 (Act I), Neural Overseer (Act IV) — phased combat
- **29 Skills** across 6 trees (combat/weapon/movement/energy/protocol/survival)
- **8 Weapons** (5 unlockable via skills/boss, 1 unobtainable: laser)
- **3 Chassis** (scout/assault/titan) with stat multipliers
- **4 Paints** (1 unlocked, 3 locked)
- **7 Companions** (defined but CompanionSystem not implemented)
- **1 Quest** (defined, wired to NPCSystem, working with toast notifications)
- **2 NPCs** (Engineer Kara, Ghost Operator — both in Act I)
- **Metroidvania**: 7 collectibles, 2 shortcuts, 1 EMP door, 2 grapple anchors (Act I only)
- **Save System**: v4, IndexedDB-backed, 3 profile slots, auto-save (30s + checkpoint + beforeunload), migration from old localStorage keys, ProfileSelectUI
- **Full UI**: HUD, Pause, Settings (gamepad+mouse sliders working), Inventory, SkillTree, Quest, Map, Hangar, Profile Select, Dialogue, Lore
- **Input**: keyboard + gamepad + mouse, all working with unified UIController
- **Audio**: procedural SFX (19 sounds), ambient drone, 8 categories — no music tracks
- **Localization**: ~287 keys, EN + FA
- **Menu**: CONTINUE (resume active profile), LOAD GAME (switch profile), NEW GAME (create profile), Settings, How To Play

### What's Missing
- **Acts II, III, V, Final** — empty stubs (1-2 platforms per section, no content). Final Act is a separate small act per design decision.
- **4 Bosses** — Leviathan Hulk (Act II), Iron Magistrate (Act III), The Architect (Act V), The Silent Protocol (Final Act) — referenced in WORLD_BIBLE but absent from code
- **Music** — 0 tracks (AUDIO_BIBLE specifies 10% of mix)
- **ShopSystem** — Kara has shopId but no ShopSystem exists
- **CompanionSystem** — 7 companions defined but no AI/behavior system
- **1 weapon unobtainable** — laser (no unlock path). plasma_cannon and energy_blade ARE obtainable (boss-gated: Guardian AX-09 → plasma_cannon, Neural Overseer → energy_blade)
- **3 paints unobtainable** — military_green, protocol_white, rust (no unlock path)
- **Elite enemy** — defined but only spawns as mini-boss, not in regular enemy lists
- **Ending** — no Act V content, no truth reveal, no binary choice
- **SkillTreeScene** (legacy, deleted) — old UI path was broken (skills unlocked via SkillTreeScene had no gameplay effect). New SkillTreeUI (Hangar overlay) works correctly.

---

## File Structure (src/game/)

```
src/game/
├── PhaserGame.ts              — Phaser.Game config (singleton)
├── GAME_VARIABLES.md          — All tunable variables reference
│
├── features/
│   └── scenes/
│       ├── BootScene.ts       — Preload + splash
│       ├── GameScene.ts       — Main scene, state machine (1269 lines)
│       └── UIScene.ts         — Stub (stops immediately)
│
├── controllers/
│   ├── PlayController.ts      — Play state builder
│   └── CollisionController.ts — Collision routing
│
├── systems/
│   ├── InputSystem.ts         — Keyboard + gamepad (421 lines)
│   ├── AudioSystem.ts         — Procedural SFX, 8 categories
│   ├── SaveSystem.ts          — IndexedDB v4 façade, cache, markDirty
│   ├── ProfileDB.ts           — IndexedDB wrapper (3 slots + global store)
│   ├── ProfileManager.ts      — Slot lifecycle (create/select/delete/list)
│   ├── AutoSaveManager.ts     — 30s timer + visibilitychange + beforeunload
│   ├── migrate.ts             — Migration from old localStorage keys (v2/v3 → v4)
│   ├── LocalizationSystem.ts  — EN/FA, ~287 keys
│   ├── RenderSystem.ts        — Brightness, lights, darkness overlay
│   ├── PhysicsSystem.ts       — Matter.js wrapper
│   ├── CombatSystem.ts        — Damage routing
│   ├── CameraSystem.ts        — Follow, shake, fade, zoom
│   ├── ParticleSystem.ts      — Sparks, explosions, dust, afterimage
│   ├── EventBus.ts            — 20+ game events
│   ├── ExperienceSystem.ts    — XP, levels, skill points
│   ├── SkillTreeSystem.ts     — Skill unlock, effect application
│   ├── InventorySystem.ts     — Items, materials, consumables
│   ├── WeaponUpgradeSystem.ts — Weapon level upgrades
│   ├── QuestSystem.ts         — Quest tracking (1 quest, wired)
│   ├── NPCSystem.ts           — NPC dialogue routing
│   ├── DialogueSystem.ts      — Dialogue tree state
│   ├── LoreSystem.ts          — Lore discovery (4 entries)
│   ├── WorldSystem.ts         — Area tracking, travel
│   ├── WorldMapSystem.ts      — Map tree, boss defeat tracking
│   ├── CheckpointSystem.ts    — Checkpoint save/respawn
│   ├── InputSchemeManager.ts  — KB/Xbox/PS auto-detect
│   ├── FullscreenManager.ts   — Browser fullscreen + canvas resize
│   └── QualityManager.ts      — Low/medium/high presets
│
├── ui/
│   ├── UIController.ts        — Unified nav (focusables, cursor, tabs, slider-aware)
│   ├── NavigableOverlay.ts    — Abstract base for overlay UIs
│   ├── OverlayManager.ts      — Overlay stack management
│   ├── shared/MenuNavHelper.ts — Thin wrapper for shared controller
│   ├── Theme.ts               — Colors, helpers (corner brackets, scanlines)
│   ├── hud/HUDUI.ts           — Health, energy, weapon, level
│   ├── pause/PauseMenuUI.ts   — 10-button grid
│   ├── settings/SettingsUI.ts — Audio/display/language tabs (gamepad+mouse sliders)
│   ├── inventory/InventoryUI.ts — 4-tab grid
│   ├── skilltree/SkillTreeUI.ts — 6-tree diamond nodes
│   ├── quest/QuestUI.ts       — Quest list (read-only)
│   ├── map/WorldMapUI.ts      — Hex-grid travel
│   ├── hangar/HangarUI.ts     — Chassis/loadout/companion/paint
│   ├── profile/ProfileSelectUI.ts — 3-slot profile select (create/select/delete)
│   ├── menu/MenuBuilder.ts    — Title screen (CONTINUE/LOAD GAME/NEW GAME/SETTINGS/HOW TO PLAY)
│   ├── hub/HubBuilder.ts      — Mission select + nav bar
│   ├── dialogue/DialogueUI.ts — Bottom box, RTL support
│   ├── lore/LoreController.ts — In-world lore panel
│   ├── boss/BossHealthBarUI.ts — Boss HP bar
│   ├── controls/ControlHintsUI.ts — On-screen control hints
│   ├── PerformanceOverlay.ts  — F3 FPS/stats
│   └── VirtualCursor.ts       — DELETED (merged into UIController)
│
├── entities/
│   ├── player/PlayerEntity.ts — Movement, combat, abilities (1089 lines)
│   ├── enemies/EnemyEntity.ts — 6 types, FSM, posture (532 lines)
│   ├── boss/BossEntity.ts     — 2 bosses, phased AI (300 lines)
│   ├── combat/Projectile.ts   — Projectile + hitscan + explosive
│   ├── combat/TargetRegistry.ts — O(m) hit detection registry
│   ├── companion/CompanionEntity.ts — Visual only, no AI
│   └── sprites/MechaSpriteFactory.ts — Mech sprite builder (973 lines)
│
├── world/
│   ├── AreaLoader.ts          — AreaData → Matter + visuals (1369 lines)
│   ├── MetroidvaniaController.ts — Collectibles, shortcuts, EMP doors
│   ├── NpcInteractionController.ts — NPC spawning + interaction prompt
│   ├── ParallaxBackground.ts  — 4-layer parallax
│   ├── AtmosphereSystem.ts    — Fog, god rays, particles
│   └── ForestEnvironmentSystem.ts — Grass, trees, vines, water, rain
│
├── data/
│   ├── acts/acts.ts           — 5 Acts (I full, IV partial, II/III/V stubs)
│   ├── chassis/chassis.ts     — 3 chassis (scout/assault/titan)
│   ├── weapons/weapons.ts     — 8 weapons
│   ├── skills/skills.ts       — 29 skills, 6 trees
│   ├── paints/paints.ts       — 4 paints
│   ├── companions/companions.ts — 7 companions (all locked)
│   ├── enemies/enemies.ts     — 6 enemy types
│   ├── bosses/bosses.ts       — 2 bosses
│   ├── quests/quests.ts       — 1 quest
│   ├── npc/npcs.ts            — 2 NPCs
│   ├── dialogues/             — Dialogue trees
│   ├── items/items.ts         — 7 materials + 2 consumables
│   ├── localization/en.json   — ~287 keys
│   ├── localization/fa.json   — ~287 keys
│   └── types.ts               — All TypeScript types
│
└── shared/
    ├── Constants.ts           — GAME, PLAYER, STAGE_1, etc.
    ├── Types.ts               — (legacy, use data/types.ts)
    ├── GamepadManager.ts      — DEAD CODE (use InputSystem instead)
    ├── Effects.ts             — DEAD CODE (legacy)
    └── Save.ts                — DEAD CODE (use systems/SaveSystem.ts)
```

---

## Content Counts

| Category | Count | Notes |
|---|---|---|
| Acts | 5 (1 full, 1 partial, 3 stubs) | WORLD_BIBLE describes 6 |
| Bosses | 2 | WORLD_BIBLE describes 6 |
| Enemy types | 6 | WORLD_BIBLE describes 15+ |
| Skills | 29 across 6 trees | 83 SP to clear all |
| Weapons | 8 | 3 unobtainable (unlock broken) |
| Chassis | 3 | All unlocked by default |
| Paints | 4 | 3 locked, no unlock path |
| Companions | 7 | All locked, no CompanionSystem |
| NPCs | 2 | Both in Act I |
| Quests | 1 | Not wired to NPCSystem |
| Lore entries | 4 (LoreSystem) + 15 (in-world) | |
| Collectibles | 7 (Act I only) | |
| Shortcuts | 2 (Act I only) | |
| Hazards | 4 (Act I) + 1 (Act IV) | |
| Localization keys | ~287 per language | EN + FA |

---

## Key Architecture Decisions

1. **Phaser 4.2.1 + Matter.js** — physics-based 2D platformer
2. **Next.js 16 + TypeScript** — React shell wraps Phaser canvas
3. **3 Scenes** — BootScene (preload), GameScene (everything), UIScene (stub)
4. **5-state machine** — menu ↔ hub ↔ play ↔ gameover ↔ victory
5. **Data-driven** — all content in `data/` files, systems read data
6. **Static systems + EventBus** — 18+ systems communicate via events, no circular deps
7. **Extracted controllers** — PlayController, CollisionController, MetroidvaniaController, etc.
8. **Unified UIController** — ONE navigation system for ALL UIs (focus mode + cursor mode)
9. **OverlayManager stack** — overlays managed as LIFO stack with parent tracking
10. **SaveSystem v3** — localStorage with migration, cache Sets for performance
11. **InputSystem** — keyboard edges (kbEdge buffer) + gamepad polling + gp* flags (B2 fix)
12. **TargetRegistry** — O(m) projectile hit detection via typed registry

---

## AI Development Rules

1. **Read WORLD_BIBLE, DESIGN_PILLARS, MOMENTS, AUDIO_BIBLE** before any content work
2. **Read GAME_VARIABLES.md** before tuning any value
3. **Read TECH-DEBT.md** (in download/) before touching systems
4. **Read ARCHITECTURE-AUDIT-FULL.md** (in download/) for full architecture
5. **Data-driven first** — add content to data files, not code
6. **Static system + EventBus** — no circular dependencies
7. **No new systems** without checking if existing ones can be extended
8. **TypeScript strict** — 0 errors in game code
9. **Test before push** — behavioral test, not just code reading
10. **Every commit tested in browser** — no "should work" assumptions

---

## MUST NOT DO

- Do NOT create new design documents (enough exist)
- Do NOT add new systems without architectural review
- Do NOT hardcode values that should be in data files
- Do NOT bypass SaveSystem.persist() with direct localStorage access
- Do NOT use `require()` in ESM context — use `import`
- Do NOT use Phaser private internals (`_list`, `manager.hitTest`) without try/catch
- Do NOT call `removeInteractive()` mid-pointerdown (corrupts InputPlugin — S1 fix)
- Do NOT create anonymous keydown listeners without storing reference for cleanup
- Do NOT force push to main (RULES.md)
- Do NOT skip SESSION-START-SYNC-CHECK (RULES.md)

---

## Reference Documents (Canonical)

### Vision (do NOT change — code must match these)
- `WORLD_BIBLE.md` — world, lore, 6 acts, bosses, NPCs, enemy families
- `PLAYER_EXPERIENCE_BIBLE.md` — emotional journey, pacing
- `GAME_DESIGN_DOCUMENT.md` — gameplay loops, progression, content pipeline
- `DESIGN_PILLARS.md` — 8 pillars with keywords
- `MOMENTS.md` — 10 cinematic moments in Act I
- `AUDIO_BIBLE.md` — audio philosophy, SFX list, mix ratios

### Reference (accurate, keep updated)
- `RULES.md` — git rules, quality gates
- `AGENT_GUIDE.md` — this file
- `DECISIONS.md` — architectural decisions log
- `src/game/GAME_VARIABLES.md` — all tunable variables
- `download/ARCHITECTURE-AUDIT-FULL.md` — full architecture audit
- `download/GAME-CONTENT-AUDIT.md` — content inventory + gaps
- `download/TECH-DEBT.md` — consolidated tech debt tracker
- `download/DESIGN-VS-CODE-AUDIT.md` — vision vs reality comparison

### Deleted (were stale and misleading)
- `docs/ARCHITECTURE.md` — described MVP 2.0 (20 files/3100 lines, now 60+/15000+)
- `PROJECT_AUDIT.md` — claimed abilities broken, 19 skills, 533-line PlayerEntity
- `GAME_DIRECTOR_REVIEW.md` — scored 3.8/10 based on stale state
- `STATUS.md` — stale metrics (skills=19, files=~45)
- `CURRENT_STATE.md` — stopped at v21 parallax fix
- `NEXT_TASK.md` — pointed to Stage 2 bg
- `VERTICAL_SLICE_REVIEW.md` — stopped at Sprint 3
- `VERTICAL_SLICE_MANIFEST.md` — freeze was broken
- `CREATIVE_DIRECTOR_REVIEW.md` — 8 of 10 contradictions now fixed
- `phaser4-audit-report.md` — old Phaser audit
- `audit-systems-report.md` — old systems audit
