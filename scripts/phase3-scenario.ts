/**
 * Phase 3 Snapshot Scenario — Shared Module
 *
 * Defines a comprehensive scenario that exercises ALL public methods of
 * SaveSystem with realistic data + edge cases (falsy values, array
 * reference semantics, duplicate operations, partial updates).
 *
 * Used by both:
 *   - scripts/phase3-baseline.ts (runs against CURRENT localStorage-based SaveSystem)
 *   - scripts/phase3-verify.ts   (runs against REWRITTEN ProfileDB-backed SaveSystem)
 *
 * The scenario MUST be identical between baseline and verify runs — any
 * difference in scenario invalidates the diff.
 *
 * Output: array of {step, method, args, returnValue, stateAfter}
 * The stateAfter is a deep clone of SaveSystem.get() captured AFTER each step.
 */

import { SaveSystem } from '../src/game/systems/SaveSystem';

export interface SnapshotStep {
  step: number;
  method: string;
  args: unknown[];
  returnValue: unknown;
  stateAfter: unknown; // deep clone of SaveSystem.get()
}

/**
 * Run the scenario against the current SaveSystem and return the captured
 * steps. Caller is responsible for any pre-setup (e.g. calling
 * ProfileManager.init() for the rewritten version).
 *
 * Pre-condition: SaveSystem cache must be in a fresh/default state.
 * The scenario starts by calling SaveSystem.clear() to ensure this.
 */
export async function runSnapshotScenario(): Promise<SnapshotStep[]> {
  const steps: SnapshotStep[] = [];
  let stepNum = 0;

  /** Run a method, capture return value + state, append to steps. */
  function capture<T>(method: string, args: unknown[], fn: () => T): T {
    stepNum++;
    const returnValue = fn();
    // Deep clone the state so later mutations don't affect earlier snapshots.
    const stateAfter = deepClone(SaveSystem.get());
    steps.push({ step: stepNum, method, args, returnValue, stateAfter });
    return returnValue;
  }

  /** Async variant — for methods that may return a Promise (rewritten version). */
  async function captureAsync<T>(method: string, args: unknown[], fn: () => Promise<T> | T): Promise<T> {
    stepNum++;
    const returnValue = await fn();
    const stateAfter = deepClone(SaveSystem.get());
    steps.push({ step: stepNum, method, args, returnValue, stateAfter });
    return returnValue;
  }

  // ─── STEP 0: Reset to fresh state ───
  capture('clear', [], () => { SaveSystem.clear(); });

  // ─── SECTION 1: Quest flags + progress (edge cases: false, 0, empty array) ───
  capture('setQuestFlag', ['main_quest_1', true], () => SaveSystem.setQuestFlag('main_quest_1', true));
  // Edge case: false value (must NOT be confused with "not set")
  capture('setQuestFlag', ['side_quest_3', false], () => SaveSystem.setQuestFlag('side_quest_3', false));
  capture('getQuestFlag', ['main_quest_1'], () => SaveSystem.getQuestFlag('main_quest_1')); // expect true
  capture('getQuestFlag', ['side_quest_3'], () => SaveSystem.getQuestFlag('side_quest_3')); // expect false (EDGE)
  capture('getQuestFlag', ['never_set_quest'], () => SaveSystem.getQuestFlag('never_set_quest')); // expect false (default)

  // Quest progress with array containing 0 values
  capture('setQuestProgress', ['main_quest_1', [1, 0, 2]], () => SaveSystem.setQuestProgress('main_quest_1', [1, 0, 2]));
  capture('getQuestProgress', ['main_quest_1'], () => SaveSystem.getQuestProgress('main_quest_1')); // expect [1,0,2] (EDGE: 0 preserved)
  // Empty array (edge case)
  capture('setQuestProgress', ['empty_quest', []], () => SaveSystem.setQuestProgress('empty_quest', []));
  capture('getQuestProgress', ['empty_quest'], () => SaveSystem.getQuestProgress('empty_quest')); // expect [] (EDGE)
  capture('getQuestProgress', ['never_set_progress'], () => SaveSystem.getQuestProgress('never_set_progress')); // expect null

  // ─── SECTION 2: Checkpoint (edge case: timestamp 0) ───
  capture('saveCheckpoint', [{
    actId: 1,
    regionId: 'factory_region',
    areaId: 'abandoned_factory',
    section: 3,
    x: 100,
    y: 200,
    timestamp: 0, // EDGE: falsy timestamp
  }], () => SaveSystem.saveCheckpoint({
    actId: 1, regionId: 'factory_region', areaId: 'abandoned_factory',
    section: 3, x: 100, y: 200, timestamp: 0,
  }));
  capture('hasCheckpoint', [], () => SaveSystem.hasCheckpoint()); // expect true
  capture('clearCheckpoint', [], () => SaveSystem.clearCheckpoint());
  capture('hasCheckpoint', [], () => SaveSystem.hasCheckpoint()); // expect false (EDGE)

  // ─── SECTION 3: Kills + boss times (accumulation, overwrite on lower time) ───
  capture('recordKill', [], () => SaveSystem.recordKill()); // totalKills: 1
  capture('recordKill', [], () => SaveSystem.recordKill()); // totalKills: 2
  capture('recordKill', [], () => SaveSystem.recordKill()); // totalKills: 3
  capture('recordBossKill', ['guardian_ax09', 45000], () => SaveSystem.recordBossKill('guardian_ax09', 45000));
  // Same boss, lower time — should overwrite
  capture('recordBossKill', ['guardian_ax09', 30000], () => SaveSystem.recordBossKill('guardian_ax09', 30000));
  // Same boss, HIGHER time — should NOT overwrite (EDGE)
  capture('recordBossKill', ['guardian_ax09', 60000], () => SaveSystem.recordBossKill('guardian_ax09', 60000));
  // Different boss
  capture('recordBossKill', ['neural_overseer', 60000], () => SaveSystem.recordBossKill('neural_overseer', 60000));

  // ─── SECTION 4: XP + level (multiple level-ups in one call) ───
  capture('awardXp', [150], () => SaveSystem.awardXp(150)); // may level up

  // ─── SECTION 5: Skills (duplicate unlock returns false) ───
  capture('unlockSkill', ['combat.damage1'], () => SaveSystem.unlockSkill('combat.damage1')); // expect true
  // EDGE: duplicate unlock — must return false, NOT mutate state
  capture('unlockSkill', ['combat.damage1'], () => SaveSystem.unlockSkill('combat.damage1')); // expect false
  capture('unlockSkill', ['movement.speed1'], () => SaveSystem.unlockSkill('movement.speed1')); // expect true

  // ─── SECTION 6: Weapons ───
  capture('unlockWeapon', ['plasma_cannon'], () => SaveSystem.unlockWeapon('plasma_cannon'));
  // EDGE: duplicate unlock weapon (should be no-op, not add duplicate to array)
  capture('unlockWeapon', ['plasma_cannon'], () => SaveSystem.unlockWeapon('plasma_cannon'));
  capture('isWeaponUnlocked', ['plasma_cannon'], () => SaveSystem.isWeaponUnlocked('plasma_cannon')); // expect true
  capture('isWeaponUnlocked', ['railgun'], () => SaveSystem.isWeaponUnlocked('railgun')); // expect false (EDGE)
  capture('setWeapon', ['shotgun'], () => SaveSystem.setWeapon('shotgun'));
  capture('setWeaponLevel', ['shotgun', 2], () => SaveSystem.setWeaponLevel('shotgun', 2));

  // ─── SECTION 7: Abilities ───
  capture('unlockAbility', ['wallJump'], () => SaveSystem.unlockAbility('wallJump'));
  capture('unlockAbility', ['wallJump'], () => SaveSystem.unlockAbility('wallJump')); // EDGE: duplicate

  // ─── SECTION 8: Skill points + setSkillPoints (explicit set, edge: 0) ───
  capture('grantSkillPoint', [], () => SaveSystem.grantSkillPoint()); // +1
  capture('grantSkillPoint', [], () => SaveSystem.grantSkillPoint()); // +1
  capture('setSkillPoints', [5], () => SaveSystem.setSkillPoints(5));
  // EDGE: set to 0 (must not be confused with "not set")
  capture('setSkillPoints', [0], () => SaveSystem.setSkillPoints(0));
  // EDGE: negative should clamp to 0
  capture('setSkillPoints', [-10], () => SaveSystem.setSkillPoints(-10));

  // ─── SECTION 9: Chassis + paints (duplicate unlock) ───
  capture('setSelectedChassis', ['titan'], () => SaveSystem.setSelectedChassis('titan'));
  // 'scout' is already in default unlockedChassis — unlock should be no-op
  capture('unlockChassis', ['scout'], () => SaveSystem.unlockChassis('scout'));
  capture('isChassisUnlocked', ['scout'], () => SaveSystem.isChassisUnlocked('scout')); // expect true
  capture('isChassisUnlocked', ['titan'], () => SaveSystem.isChassisUnlocked('titan')); // expect true (in default)
  capture('setSelectedPaint', ['military_green'], () => SaveSystem.setSelectedPaint('military_green'));
  capture('unlockPaint', ['rust'], () => SaveSystem.unlockPaint('rust'));
  capture('unlockPaint', ['rust'], () => SaveSystem.unlockPaint('rust')); // EDGE: duplicate
  capture('isPaintUnlocked', ['rust'], () => SaveSystem.isPaintUnlocked('rust')); // expect true
  capture('isPaintUnlocked', ['protocol_white'], () => SaveSystem.isPaintUnlocked('protocol_white')); // expect false (EDGE)

  // ─── SECTION 10: Collectibles (duplicate returns false) ───
  capture('markCollectibleCollected', ['coll_001'], () => SaveSystem.markCollectibleCollected('coll_001')); // expect true (new)
  // EDGE: duplicate — must return false AND not add duplicate to array
  capture('markCollectibleCollected', ['coll_001'], () => SaveSystem.markCollectibleCollected('coll_001')); // expect false
  capture('markCollectibleCollected', ['coll_002'], () => SaveSystem.markCollectibleCollected('coll_002')); // expect true
  capture('isCollectibleCollected', ['coll_001'], () => SaveSystem.isCollectibleCollected('coll_001')); // expect true
  // EDGE: never-collected ID
  capture('isCollectibleCollected', ['coll_999'], () => SaveSystem.isCollectibleCollected('coll_999')); // expect false

  // ─── SECTION 11: Shortcuts (same as collectibles) ───
  capture('markShortcutOpened', ['shortcut_01'], () => SaveSystem.markShortcutOpened('shortcut_01')); // expect true
  capture('markShortcutOpened', ['shortcut_01'], () => SaveSystem.markShortcutOpened('shortcut_01')); // expect false (EDGE)
  capture('isShortcutOpened', ['shortcut_01'], () => SaveSystem.isShortcutOpened('shortcut_01')); // expect true
  capture('isShortcutOpened', ['shortcut_99'], () => SaveSystem.isShortcutOpened('shortcut_99')); // expect false (EDGE)

  // ─── SECTION 12: Inventory (stack, partial remove, insufficient remove) ───
  capture('addItem', ['weapon_part', 5], () => SaveSystem.addItem('weapon_part', 5));
  // EDGE: stack onto existing — should be 8 total, NOT a duplicate entry
  capture('addItem', ['weapon_part', 3], () => SaveSystem.addItem('weapon_part', 3));
  // EDGE: ask for more than available — should return false, NOT mutate
  capture('hasItem', ['weapon_part', 10], () => SaveSystem.hasItem('weapon_part', 10)); // expect false
  capture('hasItem', ['weapon_part', 8], () => SaveSystem.hasItem('weapon_part', 8)); // expect true
  // EDGE: remove partial
  capture('removeItem', ['weapon_part', 3], () => SaveSystem.removeItem('weapon_part', 3)); // expect true, leaves 5
  // EDGE: remove more than available — should return false, NOT mutate
  capture('removeItem', ['weapon_part', 100], () => SaveSystem.removeItem('weapon_part', 100)); // expect false
  // Add a different item
  capture('addItem', ['key_card', 1], () => SaveSystem.addItem('key_card', 1));
  // Remove down to 0 — should delete the entry entirely
  capture('removeItem', ['key_card', 1], () => SaveSystem.removeItem('key_card', 1)); // expect true, entry removed

  // ─── SECTION 13: Areas (unlock + discover, duplicate no-op) ───
  capture('unlockArea', ['neon_district'], () => SaveSystem.unlockArea('neon_district'));
  capture('unlockArea', ['neon_district'], () => SaveSystem.unlockArea('neon_district')); // EDGE: duplicate
  capture('discoverArea', ['neon_district'], () => SaveSystem.discoverArea('neon_district'));
  capture('discoverArea', ['neon_district'], () => SaveSystem.discoverArea('neon_district')); // EDGE: duplicate

  // ─── SECTION 14: NPC flags (nested record, edge: false value) ───
  capture('setNpcFlag', ['kara', 'met', true], () => SaveSystem.setNpcFlag('kara', 'met', true));
  // EDGE: false value (must NOT be confused with "not set")
  capture('setNpcFlag', ['kara', 'quest_done', false], () => SaveSystem.setNpcFlag('kara', 'quest_done', false));
  capture('setNpcFlag', ['kara', 'shop_open', true], () => SaveSystem.setNpcFlag('kara', 'shop_open', true));
  capture('getNpcFlag', ['kara', 'met'], () => SaveSystem.getNpcFlag('kara', 'met')); // expect true
  capture('getNpcFlag', ['kara', 'quest_done'], () => SaveSystem.getNpcFlag('kara', 'quest_done')); // expect false (EDGE)
  // EDGE: unknown NPC + unknown flag
  capture('getNpcFlag', ['unknown_npc', 'anything'], () => SaveSystem.getNpcFlag('unknown_npc', 'anything')); // expect false
  // EDGE: known NPC, unknown flag
  capture('getNpcFlag', ['kara', 'never_set'], () => SaveSystem.getNpcFlag('kara', 'never_set')); // expect false

  // ─── SECTION 15: Settings (partial update with edge: muted=true) ───
  capture('saveSettings', [{ masterVolume: 0.5, muted: true }], () => SaveSystem.saveSettings({ masterVolume: 0.5, muted: true }));
  // EDGE: brightness 0 (falsy but valid)
  capture('saveSettings', [{ brightness: 0 }], () => SaveSystem.saveSettings({ brightness: 0 }));
  capture('getSettings', [], () => SaveSystem.getSettings());

  // ─── SECTION 16: Stages (NEW v4 methods — ported from old Save.ts) ───
  // These methods may or may not exist on the current SaveSystem (they're
  // being added in Phase 3). Use optional chaining + try/catch.
  // If they don't exist, return value is null and stateAfter is unchanged.
  try {
    capture('recordStageComplete', [1, 120000], () => (SaveSystem as unknown as {
      recordStageComplete?: (id: number, t: number) => void;
    }).recordStageComplete?.(1, 120000));
  } catch (e) {
    stepNum++;
    steps.push({ step: stepNum, method: 'recordStageComplete', args: [1, 120000], returnValue: null, stateAfter: deepClone(SaveSystem.get()) });
  }
  try {
    // EDGE: same stage, lower time — should overwrite
    capture('recordStageComplete', [1, 90000], () => (SaveSystem as unknown as {
      recordStageComplete?: (id: number, t: number) => void;
    }).recordStageComplete?.(1, 90000));
  } catch (e) {
    stepNum++;
    steps.push({ step: stepNum, method: 'recordStageComplete', args: [1, 90000], returnValue: null, stateAfter: deepClone(SaveSystem.get()) });
  }
  try {
    capture('isStageUnlocked', [2], () => (SaveSystem as unknown as {
      isStageUnlocked?: (id: number) => boolean;
    }).isStageUnlocked?.(2)); // expect true (stage 1 completed)
  } catch (e) {
    stepNum++;
    steps.push({ step: stepNum, method: 'isStageUnlocked', args: [2], returnValue: null, stateAfter: deepClone(SaveSystem.get()) });
  }
  try {
    capture('isStageUnlocked', [3], () => (SaveSystem as unknown as {
      isStageUnlocked?: (id: number) => boolean;
    }).isStageUnlocked?.(3)); // expect false (stage 2 not completed) (EDGE)
  } catch (e) {
    stepNum++;
    steps.push({ step: stepNum, method: 'isStageUnlocked', args: [3], returnValue: null, stateAfter: deepClone(SaveSystem.get()) });
  }

  // ─── SECTION 17: getPlayer + get (full state read) ───
  capture('getPlayer', [], () => SaveSystem.getPlayer());
  capture('get', [], () => SaveSystem.get());

  // ─── SECTION 18: Apply death penalty (XP loss) ───
  // Capture XP before, apply penalty, capture XP after
  const xpBefore = SaveSystem.getPlayer().xp;
  let lostXp: number | null = null;
  capture('applyDeathPenalty', [], () => {
    lostXp = SaveSystem.applyDeathPenalty();
    return lostXp;
  });

  return steps;
}

// ── Deep clone helper (stable across runs) ──

function deepClone<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(JSON.stringify(obj)) as T;
}
