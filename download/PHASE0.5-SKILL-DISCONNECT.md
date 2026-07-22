# Skill Disconnect Investigation — Phase 0.5

**Date**: 2026-07-22
**Trigger**: User's concern after Phase 0 — "If `computeStats()` reads from old SkillTree (12 hardcoded skills), then the entire new SkillTree UI (29 skills, 6 trees, 83 SP) might be decorative."
**Scope**: Verify the actual data path from "player unlocks skill in UI" → "player's stats change in gameplay".

---

## TL;DR

**The new SkillTree system IS connected to gameplay stats — the disconnect is narrower than feared.**

`PlayerEntity.computeStats()` reads `SaveSystem.getPlayer().unlockedSkills` (v3 key, new IDs) — NOT from old `SkillTree.getPlayerModifiers()` (v2_skills_v2 key, old IDs).

**BUT** there are still two real bugs:

1. **`SkillTreeScene` (old UI) unlocks skills that have NO gameplay effect.** Old scene uses old IDs (`combat.damage1`, `mobility.doubleJump`), writes to v2_skills_v2, but stat computation reads v3. If a player unlocks `combat.damage1` in `SkillTreeScene`, their damage doesn't change.
2. **`features/player/Player.ts`, `PlayerController.ts`, `PlayerCombat.ts` use the old `SkillTree.getPlayerModifiers()`** — these appear to be DEAD gameplay code paths (real entity is `entities/player/PlayerEntity.ts`). Needs verification but looks like leftover from the pre-refactor architecture.

**Severity**: MEDIUM. The new UI path (`SkillTreeUI` → `SkillTreeSystem.unlock` → `SaveSystem.unlockSkill` → `PlayerEntity.refreshStats` → `computeStats`) is correct and working. The old `SkillTreeScene` is the broken path — but it's only reachable from `VictoryScene` and `MapScene`, which are themselves probably legacy scenes.

---

## 1. The actual data path (verified line-by-line)

### Path A: New UI → gameplay (✓ working)

```
1. Player opens SkillTreeUI overlay (in Hangar)
2. Clicks unlock on a skill node
3. SkillTreeUI.ts:427 → SkillTreeSystem.unlock(skill.id)
   - skill.id is from data/skills/skills.ts (e.g. 'combat.overload', 'movement.grapple')
4. SkillTreeSystem.unlock:
   a. canUnlock() checks SaveSystem.getPlayer().unlockedSkills
   b. ExperienceSystem.spendSkillPoint() × cost
   c. SaveSystem.unlockSkill(skillId)  ← writes to v3 player.unlockedSkills
   d. If skill.effect.unlock → SaveSystem.unlockWeapon/unlockAbility  ← writes to v3
   e. EventBus.emit('SKILL_UNLOCKED')
5. PlayerEntity listens to SKILL_UNLOCKED → refreshStats()  (line 235)
6. refreshStats → SaveSystem.getPlayer().unlockedSkills → computeStats(unlockedSkills)
7. computeStats iterates unlockedSkills, looks up each via getSkill() from data/skills/skills.ts
8. Applies effect.multiplier or effect.additive to base stats
9. Stats updated → gameplay reflects change
```

**This path is correct.** Verified:
- `PlayerEntity.ts:142` → `this.stats = this.computeStats(save.unlockedSkills)` where `save = SaveSystem.getPlayer()`
- `PlayerEntity.ts:202-252` → `computeStats()` uses `getSkill()` from `data/skills/skills.ts`, applies `effect.multiplier`/`effect.additive`
- `PlayerEntity.ts:235,259` → `refreshStats()` re-reads from SaveSystem on skill unlock

### Path B: Old UI → gameplay (✗ broken)

```
1. Player clears stage → VictoryScene → "Skill Tree" button
2. VictoryScene.ts:100 → scene.start('SkillTreeScene')
3. SkillTreeScene.ts:101 → SkillTree.unlock(skill.id)
   - skill.id is from shared/SkillTree.ts SKILL_DEFS (e.g. 'combat.damage1', 'mobility.doubleJump')
4. SkillTree.unlock:
   a. canUnlock() checks SkillTree cache (v2_skills_v2 key)
   b. Writes to v2_skills_v2: data.unlocked.push(id), data.skillPoints -= cost
5. ✗ Nothing reads v2_skills_v2 for stat computation
6. ✗ SaveSystem.player.unlockedSkills (v3) is NOT updated
7. ✗ PlayerEntity.computeStats never sees these IDs
8. ✗ Stats do NOT change
9. ✗ EventBus.emit('SKILL_UNLOCKED') is NOT called → PlayerEntity.refreshStats not triggered
```

**Result**: Skills unlocked via `SkillTreeScene` are decorative. Player spends SP, sees the unlock in the old UI, but their damage/speed/health doesn't change.

### Path C: `features/player/Player.ts`, `PlayerController.ts`, `PlayerCombat.ts` (likely dead)

These three files import `SkillTree.getPlayerModifiers()` from the old `shared/SkillTree.ts`. But:

- The actual player entity used by the game is `entities/player/PlayerEntity.ts` (under `src/game/entities/player/`)
- The `features/player/` directory contains older code that may be unused
- `PlayerController.ts:64` initializes `private mods = SkillTree.getPlayerModifiers();` as a field — used where?
- `Player.ts:71` same pattern
- `PlayerCombat.ts:166,255` — `const mods = SkillTree.getPlayerModifiers();`

**Needs verification** — if these files are alive, they read stale stats from v2_skills_v2; if dead, they're just leftover code.

---

## 2. How to verify if `features/player/*` is dead

Run these greps:

```bash
# 1. Is Player (features/player/Player.ts) instantiated anywhere?
rg "new Player\b" src/ --type ts

# 2. Is PlayerController instantiated?
rg "new PlayerController\b" src/ --type ts

# 3. Is PlayerCombat instantiated?
rg "new PlayerCombat\b" src/ --type ts

# 4. Is features/player/Player.ts imported anywhere outside features/player/?
rg "from.*features/player/Player['\"]" src/ --type ts
```

If all four return nothing (or only intra-directory imports), the three files are dead and can be deleted. If any return hits, that's a leak that needs fixing.

---

## 3. Severity & impact assessment

### What's actually broken (if `features/player/*` is dead)

| Issue | Affected path | Severity |
|-------|---------------|----------|
| Skills unlocked in `SkillTreeScene` don't affect stats | VictoryScene → SkillTreeScene | HIGH if scene is reachable |
| `SkillTreeScene` reachable from `VictoryScene` and `MapScene` | Both are post-stage-clear screens | Need to verify these scenes are still in use |

### What's NOT broken (despite the scary Phase 0 framing)

| Concern from Phase 0 | Reality |
|----------------------|---------|
| "SkillTreeSystem.computeStats is dead code" | Actually it's not even called — `PlayerEntity.computeStats` is its own implementation, but uses the same data source (SaveSystem v3 + data/skills/skills.ts) |
| "New 29-skill UI is decorative" | NOT TRUE for `SkillTreeUI` (hangar overlay) — it correctly writes to v3 and triggers refreshStats |
| "Player has no idea their SP spending does nothing" | NOT TRUE for hangar-unlocked skills |

### The actual user-facing bug

If a player:
1. Plays through FactoryStage
2. Defeats boss → VictoryScene appears
3. Clicks "Skill Tree" → SkillTreeScene opens (old UI)
4. Unlocks `combat.damage1` for 1 SP
5. Returns to gameplay

Then their damage stat DID NOT change. The SP is gone, the skill shows as unlocked in the old UI, but gameplay is unaffected.

If the same player instead:
1. Returns to Hub
2. Opens Hangar → SkillTreeUI (new UI)
3. Unlocks `combat.overload` for 5 SP
4. Returns to gameplay

Then their damage stat DID change (×1.50 melee damage applied).

**This is a silent regression** — players who use the old path get nothing for their SP.

---

## 4. Recommended fix (after migration)

### Option A: Kill `SkillTreeScene` entirely (preferred)
- Remove the "Skill Tree" button from `VictoryScene` and `MapScene`
- Replace with "Return to Hub" (where the new SkillTreeUI is reachable)
- Delete `features/scenes/SkillTreeScene.ts`
- Delete `shared/SkillTree.ts` (its 9 callers include SkillTreeScene — once that's gone, only HUD, Player, PlayerController, PlayerCombat remain — verify they're dead first)

**Cost**: 1 h
**Risk**: Need to verify HUD's level/XP display reads from the right place (currently `SkillTree.xpForLevel`, `SkillTree.getLevelProgress` — these may need to be redirected to `ExperienceSystem`)

### Option B: Fix `SkillTreeScene` to use `SkillTreeSystem`
- Rewrite `SkillTreeScene.ts` to call `SkillTreeSystem.unlock` instead of `SkillTree.unlock`
- Update skill ID references from old `SKILL_DEFS` to new `data/skills/skills.ts`
- Update UI rendering to handle 6 trees instead of 3

**Cost**: 3–4 h
**Risk**: Higher — duplicate UI maintenance burden (two skill tree scenes for the same purpose)

### Option C: Redirect `SkillTree.unlock` to `SkillTreeSystem.unlock`
- In `shared/SkillTree.ts`, change `unlock(id)` to delegate to `SkillTreeSystem.unlock(id)` and `get()` to read from `SaveSystem`
- This makes `SkillTree.ts` a thin facade — old callers (HUD, Player, etc.) automatically work with the new system
- But old skill IDs (`combat.damage1` from SKILL_DEFS) won't match new IDs from `skills.ts` — so the old `SkillTreeScene` UI still won't be able to find skills to display

**Cost**: 2 h
**Risk**: Medium — UI mismatch (old scene shows old IDs but can't unlock anything because new system doesn't recognize them)

### Recommendation

**Option A** (kill SkillTreeScene) is the cleanest. Verify `features/player/*` is dead first; if so, deleting SkillTreeScene + SkillTree.ts together removes the entire broken path with no regressions.

This work should be done AFTER the save system migration to avoid disturbing two systems at once.

---

## 5. Action items (logged for post-migration)

| # | Action | Priority | Estimated time |
|---|--------|----------|----------------|
| 1 | Verify `features/player/Player.ts`, `PlayerController.ts`, `PlayerCombat.ts` are dead (grep `new Player`, etc.) | HIGH | 15 min |
| 2 | If alive: identify callers, decide whether to delete or migrate to PlayerEntity | HIGH | 1–2 h |
| 3 | If dead: delete the three files + their imports | MEDIUM | 30 min |
| 4 | Remove "Skill Tree" button from VictoryScene (replace with "Return to Hub") | MEDIUM | 30 min |
| 5 | Remove "Skill Tree" button from MapScene (replace with "Return to Hub") | MEDIUM | 30 min |
| 6 | Delete `features/scenes/SkillTreeScene.ts` | MEDIUM | 5 min |
| 7 | Delete `shared/SkillTree.ts` + `shared/SkillTree.ts`'s SKILL_DEFS export | MEDIUM | 30 min (after all callers migrated/deleted) |
| 8 | Update HUD's level/XP display to use `ExperienceSystem.getLevel()` and `ExperienceSystem.getLevelProgress()` instead of `SkillTree.xpForLevel`/`getLevelProgress` | MEDIUM | 30 min |
| 9 | Update VictoryScene's `bossesKilled` display from `SkillTree.get().bossesKilled` to `SaveSystem.getPlayer().bossesKilled` | LOW | 5 min |
| 10 | Update TestSuite.ts to use SaveSystem/ExperienceSystem instead of old SkillTree/Save | LOW | 30 min |

**Total estimated effort**: 3–4 h (after migration is complete)

---

## 6. Reassurance for the migration

This investigation confirms that the save system migration's `Option A` (keep `SkillTree.ts` as a façade) is **safe**:

- `SkillTree.ts` writes to v2_skills_v2, which is read by HUD (level/xp display), `features/player/*` (likely dead), and SkillTreeScene (broken path)
- Migration will copy v2_skills_v2 data into v3 `player.{level, xp, skillPoints, unlockedSkills}`
- After migration, the new SkillTreeUI will correctly display the migrated unlocked skills (as long as old IDs map to new IDs — see conflict resolution note below)

### ID mapping concern

Old `SKILL_DEFS` IDs: `combat.damage1`, `combat.damage2`, `combat.fireRate1`, `combat.melee1`, `mobility.speed1`, `mobility.speed2`, `mobility.dashCd1`, `mobility.doubleJump`, `survival.health1`, `survival.health2`, `survival.energy1`, `survival.regen1`

New `skills.ts` IDs that match: `combat.damage1`, `combat.damage2`, `combat.fireRate1`, `movement.speed1`, `movement.speed2`, `movement.dashCd1`, `movement.doubleJump`, `survival.health1`, `survival.health2`, `energy.max1`, `energy.regen1`

**Mismatches**:
- `combat.melee1` → no exact match in new tree (new tree has `combat.arsenal`, `combat.overload` instead)
- `mobility.*` → renamed to `movement.*` (prefix change)
- `survival.energy1` → renamed to `energy.max1`
- `survival.regen1` → renamed to `energy.regen1`

**Migration script must apply an ID remapping table**:

```ts
const SKILL_ID_MIGRATIONS: Record<string, string> = {
  'mobility.speed1':     'movement.speed1',
  'mobility.speed2':     'movement.speed2',
  'mobility.dashCd1':    'movement.dashCd1',
  'mobility.doubleJump': 'movement.doubleJump',
  'survival.energy1':    'energy.max1',
  'survival.regen1':     'energy.regen1',
  // 'combat.melee1' has no equivalent — drop it (player loses this unlock,
  // but it had no gameplay effect anyway since stat computation reads v3)
};
```

After remapping, the merged `player.unlockedSkills` array (v3) will contain only new-tree IDs that `computeStats()` can actually apply.

---

## 7. Conclusion

The user's concern was partially correct: there IS a disconnect, but it's between `SkillTreeScene` (old UI) and the stat system — NOT between `SkillTreeUI` (new UI) and the stat system.

**The new 29-skill / 6-tree / 83-SP system IS functional** — players who unlock skills via the Hangar see correct stat changes.

**The broken path is `VictoryScene → SkillTreeScene`** — players who use this path spend SP for nothing.

This is a real bug worth fixing, but it's separate from the save system migration. Migration can proceed with Option A (SkillTree.ts as façade) safely. Post-migration, run the 10 action items above to fully unify the skill systems.
