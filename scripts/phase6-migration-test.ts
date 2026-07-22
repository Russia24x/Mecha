/**
 * Phase 6 Migration Test
 *
 * Per user feedback: real migration test with non-trivial data in all 3 old
 * localStorage keys, then field-by-field verification of slot 0 in IndexedDB.
 *
 * Setup:
 *   - Write realistic test data to all 3 old localStorage keys (v2, v2_skills_v2, v3)
 *   - Reset migration flag
 *   - Run migrateOldSaves()
 *   - Read slot 0 from IndexedDB
 *   - Verify every field matches expected merge result
 *
 * Run: bun scripts/phase6-migration-test.ts
 */

import './dom-mock';
import 'fake-indexeddb/auto';
import { migrateOldSaves } from '../src/game/systems/migrate';
import { ProfileManager } from '../src/game/systems/ProfileManager';
import { ProfileDB } from '../src/game/systems/ProfileDB';

// ── Test data: realistic saves with non-trivial differences ──

const V2_SAVE = {
  version: 2,
  lastCheckpoint: {
    actId: 1, regionId: 'factory_region', areaId: 'abandoned_factory',
    section: 3, x: 100, y: 200, timestamp: 1000000,
  },
  bestBossTimeMs: 45000,
  totalKills: 50,  // v2 has 50
  stages: {
    1: { completed: true, bestTimeMs: 120000 },
    2: { completed: false, bestTimeMs: null },
  },
  settings: {
    lang: 'en' as const,
    masterVolume: 0.6,
    musicVolume: 0.3,
    sfxVolume: 0.7,
    muted: false,
    brightness: 0.9,
  },
};

const V2_SKILLS_SAVE = {
  unlocked: [
    'combat.damage1',      // exists in both old and new
    'mobility.speed1',     // needs remapping to 'movement.speed1'
    'mobility.doubleJump', // needs remapping to 'movement.doubleJump'
    'survival.energy1',    // needs remapping to 'energy.max1'
    'combat.melee1',       // DROPPED (no equivalent in new tree)
  ],
  level: 8,
  xp: 350,
  skillPoints: 3,
  totalKills: 75,      // v2_skills_v2 has 75 (MAX)
  bossesKilled: 2,
};

const V3_SAVE = {
  version: 3,
  player: {
    level: 5,            // v3 has 5, but v2_skills_v2 has 8 (v2_skills_v2 wins)
    xp: 100,             // v3 has 100, but v2_skills_v2 has 350 (v2_skills_v2 wins)
    skillPoints: 1,      // v3 has 1, but v2_skills_v2 has 3 (v2_skills_v2 wins)
    totalKills: 60,      // v3 has 60, MAX(50, 60, 75) = 75
    bossesKilled: 1,     // v3 has 1, MAX(1, 2) = 2
    unlockedSkills: [
      'combat.damage1',     // duplicate with v2_skills_v2 — should NOT double-add
      'movement.speed2',    // new-format, only in v3
      'survival.health1',   // new-format, only in v3
    ],
    unlockedWeapons: ['assault_rifle', 'plasma_cannon'],
    currentWeapon: 'plasma_cannon',
    weaponLevels: { assault_rifle: 1, plasma_cannon: 2 },
    inventory: [{ itemId: 'weapon_part', amount: 5 }],
    abilities: ['wallJump'],
    collectedCollectibles: ['coll_001', 'coll_002'],
    openedShortcuts: ['shortcut_01'],
    selectedChassis: 'titan',
    selectedPaint: 'rust',
    unlockedChassis: ['scout', 'assault', 'titan'],
    unlockedPaints: ['factory_gray', 'rust'],
    unlockedCompanions: [],
    selectedCompanion: null,
  },
  checkpoint: {
    actId: 1, regionId: 'factory_region', areaId: 'abandoned_factory',
    section: 5, x: 300, y: 400, timestamp: 2000000,  // v3 checkpoint wins (newer)
  },
  bestBossTimes: {
    guardian_ax09: 30000,
    neural_overseer: 60000,
  },
  settings: {
    locale: 'fa' as const,
    masterVolume: 0.5,
    musicVolume: 0.4,
    sfxVolume: 0.8,
    muted: true,
    brightness: 0.7,
    quality: 'high' as const,
    fullscreen: false,
  },
  questFlags: { main_quest_1: true, side_quest_3: false },
  questProgress: { main_quest_1: [1, 0, 2] },
  npcFlags: { kara: { met: true, quest_done: false } },
  unlockedAreas: ['abandoned_factory', 'toxic_forest', 'neon_district'],
  discoveredAreas: ['abandoned_factory', 'neon_district'],
};

async function main(): Promise<void> {
  console.log('=== Phase 6 Migration Test ===\n');

  // Setup: wipe IndexedDB + localStorage
  await ProfileManager._wipeAll();
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear();
  }

  // Write test data to old localStorage keys
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.setItem('mecha_last_protocol_save_v2', JSON.stringify(V2_SAVE));
    globalThis.localStorage.setItem('mecha_last_protocol_save_v2_skills_v2', JSON.stringify(V2_SKILLS_SAVE));
    globalThis.localStorage.setItem('mecha_last_protocol_save_v3', JSON.stringify(V3_SAVE));
  }
  console.log('[setup] Wrote test data to all 3 old localStorage keys');

  // ── Run migration ──
  console.log('\n[step 1] Running migrateOldSaves()...');
  const migrated = await migrateOldSaves();
  console.log('  Migration performed:', migrated, '(expected: true)');
  if (!migrated) {
    console.error('FAIL: migration should have been performed');
    process.exit(1);
  }

  // ── Verify slot 0 in IndexedDB ──
  console.log('\n[step 2] Reading slot 0 from IndexedDB...');
  const profile = await ProfileDB.readProfile(0);
  if (!profile) {
    console.error('FAIL: slot 0 not found after migration');
    process.exit(1);
  }
  const data = profile.saveData as typeof V3_SAVE & { stages: Record<number, { completed: boolean; bestTimeMs: number | null }> };

  // ── Field-by-field verification ──
  console.log('\n[step 3] Field-by-field verification:');

  let pass = true;
  const checks: Array<{ name: string; actual: unknown; expected: unknown; ok: boolean }> = [];

  function check(name: string, actual: unknown, expected: unknown): void {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    checks.push({ name, actual, expected, ok });
    if (!ok) pass = false;
  }

  // version
  check('version', data.version, 4);

  // totalKills: MAX(50, 60, 75) = 75
  check('player.totalKills', data.player.totalKills, 75);

  // bossesKilled: MAX(1, 2) = 2
  check('player.bossesKilled', data.player.bossesKilled, 2);

  // level: v2_skills_v2 wins = 8
  check('player.level', data.player.level, 8);

  // xp: v2_skills_v2 wins = 350
  check('player.xp', data.player.xp, 350);

  // skillPoints: v2_skills_v2 wins = 3
  check('player.skillPoints', data.player.skillPoints, 3);

  // unlockedSkills: MERGE v3 + v2_skills_v2 (with remapping, no duplicates, combat.melee1 dropped)
  // Expected: combat.damage1 (from both, deduped), movement.speed2 (v3), survival.health1 (v3),
  //           movement.speed1 (remapped from mobility.speed1), movement.doubleJump (remapped),
  //           energy.max1 (remapped from survival.energy1)
  // combat.melee1 is DROPPED
  const expectedSkills = [
    'combat.damage1',
    'movement.speed2',
    'survival.health1',
    'movement.speed1',
    'movement.doubleJump',
    'energy.max1',
  ].sort();
  check('player.unlockedSkills (sorted)', [...data.player.unlockedSkills].sort(), expectedSkills);

  // checkpoint: v3 wins (newer)
  check('checkpoint', data.checkpoint, V3_SAVE.checkpoint);

  // bestBossTimes: v3 map wins
  check('bestBossTimes', data.bestBossTimes, V3_SAVE.bestBossTimes);

  // settings: v3 wins
  check('settings', data.settings, V3_SAVE.settings);

  // stages: v2 wins (unique data)
  check('stages', data.stages, V2_SAVE.stages);

  // questFlags: v3
  check('questFlags', data.questFlags, V3_SAVE.questFlags);

  // questProgress: v3
  check('questProgress', data.questProgress, V3_SAVE.questProgress);

  // npcFlags: v3
  check('npcFlags', data.npcFlags, V3_SAVE.npcFlags);

  // unlockedAreas: v3
  check('unlockedAreas', data.unlockedAreas, V3_SAVE.unlockedAreas);

  // discoveredAreas: v3
  check('discoveredAreas', data.discoveredAreas, V3_SAVE.discoveredAreas);

  // player fields that come from v3 (not overridden)
  check('player.unlockedWeapons', data.player.unlockedWeapons, V3_SAVE.player.unlockedWeapons);
  check('player.currentWeapon', data.player.currentWeapon, V3_SAVE.player.currentWeapon);
  check('player.weaponLevels', data.player.weaponLevels, V3_SAVE.player.weaponLevels);
  check('player.inventory', data.player.inventory, V3_SAVE.player.inventory);
  check('player.abilities', data.player.abilities, V3_SAVE.player.abilities);
  check('player.collectedCollectibles', data.player.collectedCollectibles, V3_SAVE.player.collectedCollectibles);
  check('player.openedShortcuts', data.player.openedShortcuts, V3_SAVE.player.openedShortcuts);
  check('player.selectedChassis', data.player.selectedChassis, V3_SAVE.player.selectedChassis);
  check('player.selectedPaint', data.player.selectedPaint, V3_SAVE.player.selectedPaint);
  check('player.unlockedChassis', data.player.unlockedChassis, V3_SAVE.player.unlockedChassis);
  check('player.unlockedPaints', data.player.unlockedPaints, V3_SAVE.player.unlockedPaints);

  // Print results
  for (const c of checks) {
    const status = c.ok ? '✓' : '✗';
    console.log(`  ${status} ${c.name}`);
    console.log(`      actual:   ${JSON.stringify(c.actual)}`);
    if (!c.ok) {
      console.log(`      expected: ${JSON.stringify(c.expected)}`);
    }
  }

  // ── Verify old keys deleted ──
  console.log('\n[step 4] Verifying old localStorage keys deleted:');
  if (typeof globalThis.localStorage !== 'undefined') {
    const keys = ['mecha_last_protocol_save_v2', 'mecha_last_protocol_save_v2_skills_v2', 'mecha_last_protocol_save_v3'];
    for (const key of keys) {
      const value = globalThis.localStorage.getItem(key);
      const ok = value === null;
      console.log(`  ${ok ? '✓' : '✗'} ${key}: ${ok ? 'deleted' : 'STILL PRESENT'}`);
      if (!ok) pass = false;
    }
  }

  // ── Verify migration flag set ──
  console.log('\n[step 5] Verifying migration flag:');
  const isDone = await ProfileManager.isMigrationDone();
  console.log(`  ${isDone ? '✓' : '✗'} isMigrationDone: ${isDone}`);
  if (!isDone) pass = false;

  // ── Verify idempotency: running again should be no-op ──
  console.log('\n[step 6] Verifying idempotency (re-run should skip):');
  const migratedAgain = await migrateOldSaves();
  console.log(`  ${!migratedAgain ? '✓' : '✗'} second run migrated: ${migratedAgain} (expected: false)`);
  if (migratedAgain) pass = false;

  // Cleanup
  await ProfileManager._wipeAll();
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear();
  }

  console.log('\n' + (pass ? '=== ALL MIGRATION TESTS PASSED ===' : '=== MIGRATION TEST FAILED ==='));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('\n=== MIGRATION TEST CRASHED ===');
  console.error(err);
  process.exit(1);
});
