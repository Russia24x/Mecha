# Phase 0 Audit — Parallel Save Systems

**Date**: 2026-07-22
**Goal**: Determine whether `shared/Save.ts`, `shared/SaveManager.ts`, and `shared/SkillTree.ts` are alive BEFORE the IndexedDB refactor. If alive, the migration must cover their data and Phase 7 is no longer 30 minutes.

---

## TL;DR

| File | Status | Imports | localStorage Key | Data Shape |
|------|--------|---------|-------------------|------------|
| `shared/SaveManager.ts` | **DEAD** | 0 | `mecha_last_protocol_save_v2` | `{ version: '1.0', lastCheckpoint, bestBossTimeMs, totalKills, unlocked }` |
| `shared/Save.ts` | **ALIVE** | 5 | `mecha_last_protocol_save_v2` | `{ version: 2, lastCheckpoint, bestBossTimeMs, totalKills, stages, settings }` |
| `shared/SkillTree.ts` | **ALIVE** | 9 | `mecha_last_protocol_save_v2_skills_v2` | `{ unlocked: SkillId[], level, xp, skillPoints, totalKills, bossesKilled }` |
| `systems/SaveSystem.ts` | **ALIVE** | 40+ | `mecha_last_protocol_save_v3` | `{ version: 3, player, checkpoint, bestBossTimes, settings, questFlags, questProgress, npcFlags, unlockedAreas, discoveredAreas }` |
| `systems/SkillTreeSystem.ts` | **ALIVE** | 1 (SkillTreeUI) | (uses SaveSystem v3) | uses `player.unlockedSkills` |

**Three localStorage keys in play**, not one. **Two parallel skill systems** running simultaneously. Phase 7 is **NOT 30 minutes** — realistic estimate is 4–8 hours, and the migration script must read **all three keys**.

---

## 1. Save.ts — ALIVE, uses v2 key

### Callers (5)
| File | Calls |
|------|-------|
| `features/scenes/VictoryScene.ts:81` | `Save.get().totalKills` |
| `features/scenes/MenuScene.ts:81,87` | `Save.get().lastCheckpoint`, `Save.hasCheckpoint()` |
| `features/scenes/FactoryStage.ts:397,446,456,524` | `Save.saveCheckpoint`, `Save.get().lastCheckpoint`, `Save.recordKill`, `Save.recordBossTime` |
| `features/scenes/MapScene.ts:48` | `Save.get()` (lastCheckpoint, stages) |
| `features/ui/TestSuite.ts:232,242,243` | `Save.get()`, `Save.saveCheckpoint` (test) |

### What it stores (key: `mecha_last_protocol_save_v2`)
```ts
{
  version: 2,
  lastCheckpoint: { section, x, y, timestamp } | null,
  bestBossTimeMs: number | null,
  totalKills: number,
  stages: { 1: { completed, bestTimeMs }, 2: { ... } },
  settings: { lang, masterVolume, musicVolume, sfxVolume, muted, brightness }
}
```

### Data overlap with SaveSystem.ts (v3)
| Field | Save.ts (v2) | SaveSystem.ts (v3) | Dual-writer? |
|-------|--------------|---------------------|--------------|
| checkpoint | `lastCheckpoint` | `checkpoint` | **YES** — `CheckpointSystem` writes to v3, `FactoryStage.saveCheckpoint` writes to v2 |
| totalKills | `totalKills` | `player.totalKills` | **YES** — `EnemyEntity.recordKill` writes to v3, `FactoryStage.recordKill` writes to v2 |
| bestBossTime | `bestBossTimeMs` (single number) | `bestBossTimes: { [bossId]: number }` (per-boss map) | **YES** — different shapes, both written |
| settings | `settings` | `settings` (different shape — has `quality`, `fullscreen`, `locale` instead of `lang`) | **DUAL** — `Save.saveSettings` is never called (SettingsUI uses SaveSystem), so v2 settings stays at default |
| stages | `stages: Record<number, {completed, bestTimeMs}>` | **MISSING** — no equivalent in v3 | **UNIQUE to v2** — must be migrated |

---

## 2. SaveManager.ts — DEAD, safe to delete

Zero imports across the entire `src/` tree. The file uses `KEYS.SAVE_KEY` (= `mecha_last_protocol_save_v2`), the **same key** as `Save.ts`, but with a different shape (`version: '1.0'`, has `unlocked: boolean` field). If it were ever called alongside `Save.ts`, both would corrupt each other. Currently dead — safe to delete in Phase 7.

---

## 3. SkillTree.ts — ALIVE, uses v2_skills_v2 key

### Callers (9)
| File | Calls |
|------|-------|
| `features/scenes/VictoryScene.ts:82` | `SkillTree.get().bossesKilled` |
| `features/scenes/FactoryStage.ts:457,525` | `SkillTree.recordKill()`, `SkillTree.recordBossKill()` |
| `features/scenes/MapScene.ts:49` | `SkillTree.get()` (level, skillPoints) |
| `features/scenes/SkillTreeScene.ts:8,37,88,89,90,101` | `SkillTree.get()`, `isUnlocked`, `canUnlock`, `unlock` — full UI |
| `features/ui/TestSuite.ts:253,276` | `SkillTree.get()`, `getPlayerModifiers()` |
| `features/ui/HUD.ts:111,112,117` | `SkillTree.get()`, `xpForLevel`, `getLevelProgress` |
| `features/player/PlayerController.ts:64,208` | `SkillTree.getPlayerModifiers()` |
| `features/player/Player.ts:71,235` | `SkillTree.getPlayerModifiers()` |
| `features/player/PlayerCombat.ts:166,255` | `SkillTree.getPlayerModifiers()` |

### What it stores (key: `mecha_last_protocol_save_v2_skills_v2`)
```ts
{
  unlocked: SkillId[],  // 12 hardcoded IDs: 'combat.damage1', 'mobility.doubleJump', etc.
  level: number,
  xp: number,
  skillPoints: number,
  totalKills: number,
  bossesKilled: number
}
```

### Critical overlap with SaveSystem.ts + SkillTreeSystem.ts

There are **two parallel skill systems** running simultaneously:

| Concern | Old (`shared/SkillTree.ts`) | New (`systems/SkillTreeSystem.ts`) |
|---------|------------------------------|-------------------------------------|
| Skill data source | Hardcoded `SKILL_DEFS` array (3 trees, 12 skills) | `data/skills/skills.ts` (6 trees, X skills) |
| Skill IDs | `'combat.damage1'`, `'mobility.doubleJump'`, ... | Different IDs from `skills.ts` |
| Persistence | Own localStorage key (`mecha_last_protocol_save_v2_skills_v2`) | `SaveSystem.player.unlockedSkills` (v3 key) |
| Used for stat computation | **YES** — `getPlayerModifiers()` called by Player/PlayerController/PlayerCombat | `computeStats()` exists but **never called by gameplay** — only used by SkillTreeUI display |
| Used for level/XP | **YES** — HUD calls `xpForLevel`, `getLevelProgress`, `awardXp` via SkillTree | SkillTreeSystem calls `ExperienceSystem` which calls `SaveSystem.awardXp` — same data field, **different code path** |
| Used for UI | `SkillTreeScene` (called from Victory/Map after stage clear) | `SkillTreeUI` (the new hangar-style overlay) |

### Dual-writer analysis on skill-related fields

When player kills an enemy:
1. `EnemyEntity.ts:196` → `SaveSystem.recordKill()` → writes `player.totalKills` (v3)
2. `FactoryStage.ts:456` → `Save.recordKill()` → writes `totalKills` (v2 Save.ts)
3. `FactoryStage.ts:457` → `SkillTree.recordKill()` → writes `totalKills` (v2_skills_v2 SkillTree.ts)

**Three parallel kill counters** — none consistent.

When player kills a boss:
1. `BossEntity.ts:244` → `SaveSystem.recordBossKill(bossId, timeMs)` → writes `player.bossesKilled` + `bestBossTimes[bossId]` (v3)
2. `FactoryStage.ts:525` → `SkillTree.recordBossKill()` → writes `bossesKilled` (v2_skills_v2)
3. `FactoryStage.ts:524` → `Save.recordBossTime(elapsed)` → writes `bestBossTimeMs` (v2, single number)

**Two kill-count writers + two best-time writers**.

When player unlocks a skill:
1. `SkillTreeScene.ts:101` → `SkillTree.unlock(skill.id)` → writes `unlocked` (v2_skills_v2) — old IDs like `combat.damage1`
2. `SkillTreeUI.ts:427` → `SkillTreeSystem.unlock(skill.id)` → writes `player.unlockedSkills` (v3) — new IDs from `skills.ts`

**Skill IDs are incompatible across the two systems.** Player stats are computed ONLY from the old system (`SkillTree.getPlayerModifiers`). The new `SkillTreeSystem.computeStats` is essentially dead code for gameplay purposes — only the UI consumes it.

---

## 4. Implications for the migration

### What must be migrated (3 source keys → 1 IndexedDB profile)

| Source Key | Reads From | Must Move To |
|------------|-----------|--------------|
| `mecha_last_protocol_save_v3` | SaveSystem.ts | Profile 0 (canonical — most complete) |
| `mecha_last_protocol_save_v2` | Save.ts | Merge into Profile 0 (only `stages` is unique; everything else is shadow data) |
| `mecha_last_protocol_save_v2_skills_v2` | SkillTree.ts | Merge into Profile 0 (`player.unlockedSkills`, `player.level`, `player.xp`, `player.skillPoints`) — but skill IDs may not match SkillTreeSystem's expected IDs |

### Conflict resolution rules for the migration

| Field | v2 source | v3 source | v2_skills_v2 source | Winner | Reason |
|-------|-----------|-----------|----------------------|--------|--------|
| `totalKills` | `Save.totalKills` | `SaveSystem.player.totalKills` | `SkillTree.totalKills` | **MAX of all three** | They've drifted; max is the most accurate lower bound |
| `bossesKilled` | (none) | `SaveSystem.player.bossesKilled` | `SkillTree.bossesKilled` | **MAX(v3, v2_skills_v2)** | Same |
| `bestBossTimeMs` | `Save.bestBossTimeMs` (single number) | `SaveSystem.bestBossTimes[bossId]` (map) | (none) | **Prefer v3 map; fall back to v2 single if v3 empty** | v3 is more granular |
| `level`, `xp`, `skillPoints` | (none) | `SaveSystem.player.{level,xp,skillPoints}` | `SkillTree.{level,xp,skillPoints}` | **v2_skills_v2 wins** | SkillTree is what HUD/gameplay uses |
| `unlockedSkills` | (none) | `SaveSystem.player.unlockedSkills` (new IDs) | `SkillTree.unlocked` (old IDs) | **MERGE both arrays** | Different skill trees; old drives stat computation, new drives SkillTreeUI display |
| `checkpoint` | `Save.lastCheckpoint` | `SaveSystem.checkpoint` | (none) | **v3 wins; fall back to v2 if v3 missing** | CheckpointSystem writes v3 |
| `stages` | `Save.stages` | (none) | (none) | **v2 wins, copy as new field** | Unique data — must add `stages` field to SaveData v4 |
| `settings` | `Save.settings` (no `quality`, `fullscreen`, `locale`) | `SaveSystem.settings` | (none) | **v3 wins** | v2 settings is never written by current code |

### Phase 7 revised scope & estimate

| Sub-task | Time |
|----------|------|
| Delete `shared/SaveManager.ts` | 5 min |
| Add `stages: Record<number, StageProgress>` to `SaveData` v4 + `migrate()` + `recordStageComplete`/`isStageUnlocked` (port from Save.ts) | 30 min |
| Migrate 5 `Save.ts` callers to `SaveSystem` (VictoryScene, MenuScene, FactoryStage, MapScene, TestSuite) | 1 h |
| Migrate 9 `SkillTree.ts` callers — DECISION NEEDED: keep old `SkillTree.ts` as a façade over `SaveSystem`, or rewrite all callers to use `SkillTreeSystem`? | 2–4 h |
| Decide what to do with two parallel skill ID systems (old `'combat.damage1'` vs new `skills.ts` IDs) | 1 h design decision |
| Delete `shared/Save.ts` and `shared/SkillTree.ts` (after callers migrated) | 5 min |
| Write migration script: read 3 localStorage keys, merge per above rules, write to IndexedDB Profile 0 | 1 h |
| Manual testing: profile switch leak test, kill counter parity, skill unlock parity, checkpoint parity | 1–2 h |
| **Total** | **6.5–9.5 h** |

Phase 7 is **not 30 minutes**. It's the largest single phase of the refactor.

---

## 5. persist()/dirty semantics — clarified

Per your request, here is the contract that will be implemented:

### `SaveSystem.persist()` (called from every mutator — ~40 call sites)
```ts
private static persist(): void {
  this.markDirty();   // sync, O(1)
}

private static markDirty(): void {
  this.dirty = true;
}
```

- **Does NOT touch IndexedDB**
- **Does NOT touch localStorage**
- Pure in-memory cache mutation + flag set
- Cost: ~0 µs

### `AutoSaveManager` (owned by GameScene)
```ts
class AutoSaveManager {
  private intervalId: number | null = null;
  private readonly FLUSH_INTERVAL_MS = 30_000;

  start(): void {
    if (this.intervalId) return;
    this.intervalId = window.setInterval(() => this.flushIfDirty(), this.FLUSH_INTERVAL_MS);
    // Also flush on tab close
    window.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  stop(): void {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    window.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  /** Explicit save — used at checkpoints. Always writes, regardless of dirty flag. */
  async saveNow(): Promise<void> {
    await ProfileDB.writeProfile(SaveSystem.getProfileId(), SaveSystem.serialize());
    SaveSystem.clearDirty();
  }

  private async flushIfDirty(): Promise<void> {
    if (!SaveSystem.isDirty()) return;
    await this.saveNow();
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      // Tab hidden — flush synchronously via localStorage fallback (IndexedDB may not commit in time)
      this.flushIfDirty();
    }
  };

  private onBeforeUnload = (): void => {
    // Best-effort synchronous flush
    if (SaveSystem.isDirty()) {
      // IndexedDB writes here may not complete — use sendBeacon or localStorage mirror
      // For now: write to localStorage mirror as safety net
      ProfileDB.emergencyMirrorToLocalStorage();
    }
  };
}
```

### When IndexedDB writes happen
- Every 30 seconds (if dirty)
- At every checkpoint (`CheckpointSystem.saveCheckpoint` → `AutoSaveManager.saveNow()`)
- On tab hide (`visibilitychange` → `hidden`)
- On tab close (`beforeunload` → emergency localStorage mirror; IndexedDB may not commit in time)

### When IndexedDB writes DON'T happen
- On every mutator call (this is the change vs. the original spec)
- During pause menu open/close
- During scene transitions (unless they trigger a checkpoint)

This resolves the "hundreds of writes per minute" concern from your review.

---

## 6. Profile switch leak test (your second ask)

Test plan for profile switching (will be added to Phase 6 verification):

```
1. Profile A: start game, kill 5 enemies, unlock 2 skills, save checkpoint.
2. Open menu, switch to Profile B.
3. Verify in Profile B:
   - totalKills = 0
   - skillPoints = 0
   - unlockedSkills = []
   - checkpoint = null
   - questFlags = {}
   - npcFlags = {}
   - EventBus listeners count == initial count
   - No "ghost" toast notifications from Profile A's quests
4. In Profile B: kill 1 enemy, save.
5. Switch back to Profile A.
6. Verify Profile A still has:
   - totalKills = 5
   - 2 unlocked skills
   - checkpoint intact
7. Re-verify EventBus listener count unchanged.
```

Critical things to test:
- EventBus subscribers from Profile A's QuestSystem don't fire when Profile B's enemies die
- HUD level/XP display updates to Profile B's values
- CheckpointSystem.currentCheckpoint resets to null on profile switch (not just the cached SaveSystem value)
- SkillTree.ts's static `cache` (if it survives Phase 7) is invalidated on profile switch

---

## 7. KEYS.SAVE_KEY v2/v3 inconsistency — resolution

Current state:
```ts
// Constants.ts:97
export const KEYS = {
  SAVE_KEY: 'mecha_last_protocol_save_v2',  // ← LITERAL V2
} as const;

// SaveSystem.ts:8
const STORAGE_KEY = 'mecha_last_protocol_save_v3';  // ← LITERAL V3, ignores KEYS.SAVE_KEY

// Save.ts:20
const STORAGE_KEY = KEYS.SAVE_KEY;  // ← Uses KEYS.SAVE_KEY (= v2)

// SaveManager.ts:33 (dead)
const raw = window.localStorage.getItem(KEYS.SAVE_KEY);  // ← Also v2

// SkillTree.ts:73
private static KEY = KEYS.SAVE_KEY + '_skills_v2';  // ← v2_skills_v2
```

### Resolution as part of SAVE_VERSION → 4

After the refactor:
- **`KEYS.SAVE_KEY` will be removed** from `Constants.ts`. There is no longer a single global storage key — IndexedDB uses per-profile records (`profile_0`, `profile_1`, `profile_2`).
- The global settings (selected profile, master settings) go under a separate IndexedDB store: `__global_settings`.
- Migration script reads ALL THREE old keys (`*_v2`, `*_v2_skills_v2`, `*_v3`) and merges them into `profile_0` in IndexedDB.
- After successful migration, all three old localStorage keys are deleted.
- A `__migration_done` flag in IndexedDB prevents re-migration on subsequent loads.

---

## 8. Open question: two parallel skill trees

The biggest design question surfaced by Phase 0 is: **what to do with the two skill systems**.

### Option A: Keep old SkillTree.ts as façade
- Keep `SkillTree.getPlayerModifiers()` (used by Player/PlayerController/PlayerCombat for stats)
- Refactor it to read from `SaveSystem.player.unlockedSkills` instead of own localStorage
- Old skill IDs (`'combat.damage1'` etc.) preserved
- `SkillTreeSystem` and `SkillTreeUI` continue to use new IDs from `skills.ts`
- **Result**: two skill ID systems still coexist, but only one localStorage location. Old IDs drive stats, new IDs drive the new UI.
- **Cost**: 2 h
- **Risk**: skill unlocked in old `SkillTreeScene` shows in old stat computation but not in new `SkillTreeUI` (and vice versa) — silent UX bug

### Option B: Delete old SkillTree.ts entirely
- Migrate `SkillTreeScene` to use `SkillTreeSystem` (rewrite the scene)
- Migrate `Player/PlayerController/PlayerCombat` to use `SkillTreeSystem.computeStats()` instead of `SkillTree.getPlayerModifiers()`
- Verify the stat modifiers in `data/skills/skills.ts` cover everything the old hardcoded `SKILL_DEFS` had
- **Result**: one skill system, one source of truth
- **Cost**: 4–6 h
- **Risk**: stats may behave differently; needs careful playtesting

### Recommendation
**Option B** is correct architecturally but exceeds the scope of a save system refactor. **Option A** is the pragmatic choice for this phase — get to one source of truth for persistence, defer the stat-system unification to a separate task. Add a TODO in `TECH-DEBT.md` to track the deferred work.

**Decision needed from you before Phase 3–4 starts.**

---

## 9. Updated phase plan

| Phase | Original | Revised |
|-------|----------|---------|
| 0 | (none) | **NEW**: Audit parallel save systems (this document) |
| 1 | ProfileDB.ts | Same |
| 2 | ProfileManager.ts | Same |
| 3 | SaveSystem.ts façade rewrite | **ADDED**: Add `stages` field to SaveData v4; port `recordStageComplete`/`isStageUnlocked` from Save.ts |
| 4 | AutoSaveManager.ts | **ADDED**: `visibilitychange` + `beforeunload` hooks |
| 5 | ProfileSelectUI.ts | Same |
| 6 | MenuBuilder.ts wiring + profile-switch leak test | Same, but leak test now covers SkillTree.ts static cache invalidation |
| 7 | Cleanup (30 min) | **REVISED**: Delete SaveManager.ts only (5 min). Save.ts and SkillTree.ts stay as façades over SaveSystem (Option A). 6.5–9.5 h total becomes ~2 h after refactor. |

---

## 10. Decision required before proceeding

1. **Skill tree decision**: Option A (façade, recommended) or Option B (full unification, deferred)?
2. **Migration conflict rules**: Approve the table in §4.2 (especially `MAX(totalKills)` across three sources)?
3. **`stages` field**: Add to SaveData v4? (Required — there is no other home for this data.)
4. **`SAVE_KEY` removal**: Approve removing `KEYS.SAVE_KEY` from Constants.ts entirely after migration?
