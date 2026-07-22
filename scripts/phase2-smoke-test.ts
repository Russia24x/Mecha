/**
 * Phase 2 Smoke Test — ProfileManager
 *
 * Gate: create 3 profiles with distinct names → list → verify all 3 with
 * correct names → delete one → list again → verify only 2 remain.
 *
 * Uses fake-indexeddb to simulate IndexedDB in Node.
 *
 * Run: npx tsx scripts/phase2-smoke-test.ts
 */

import 'fake-indexeddb/auto';
import { ProfileManager } from '../src/game/systems/ProfileManager';
import { ProfileDB } from '../src/game/systems/ProfileDB';

async function main(): Promise<void> {
  console.log('=== Phase 2 Smoke Test: ProfileManager ===\n');

  // Wipe any leftover state from previous runs
  await ProfileManager._wipeAll();
  console.log('[setup] Wiped all profile data.');

  // Init
  const initialSlot = await ProfileManager.init();
  console.log(`[init] currentSlotId = ${initialSlot} (expected: null)`);
  if (initialSlot !== null) {
    console.error('FAIL: initial slot should be null');
    process.exit(1);
  }

  // Create 3 profiles
  console.log('\n[step 1] Creating 3 profiles...');
  const slot0 = await ProfileManager.createProfile('ALPHA');
  console.log(`  createProfile('ALPHA') → slot ${slot0}`);

  const slot1 = await ProfileManager.createProfile('BETA');
  console.log(`  createProfile('BETA')  → slot ${slot1}`);

  const slot2 = await ProfileManager.createProfile('GAMMA');
  console.log(`  createProfile('GAMMA') → slot ${slot2}`);

  if (slot0 !== 0 || slot1 !== 1 || slot2 !== 2) {
    console.error(`FAIL: expected slots 0,1,2 but got ${slot0},${slot1},${slot2}`);
    process.exit(1);
  }

  // List
  console.log('\n[step 2] Listing all profiles...');
  const list1 = await ProfileManager.listProfiles();
  console.log(`  Found ${list1.length} profiles:`);
  for (const p of list1) {
    console.log(`    slot ${p.slotId}: name="${p.displayName}" level=${p.level} kills=${p.totalKills} hasCheckpoint=${p.hasCheckpoint}`);
  }

  if (list1.length !== 3) {
    console.error(`FAIL: expected 3 profiles, got ${list1.length}`);
    process.exit(1);
  }

  // Verify names match
  const nameById = new Map(list1.map(p => [p.slotId, p.displayName]));
  if (nameById.get(0) !== 'ALPHA' || nameById.get(1) !== 'BETA' || nameById.get(2) !== 'GAMMA') {
    console.error(`FAIL: names mismatch. Got: ${JSON.stringify(Object.fromEntries(nameById))}`);
    process.exit(1);
  }
  console.log('  ✓ All 3 profiles present with correct names');

  // Verify defaults
  const alpha = list1.find(p => p.slotId === 0)!;
  if (alpha.level !== 1 || alpha.totalKills !== 0 || alpha.hasCheckpoint !== false) {
    console.error(`FAIL: defaults mismatch for ALPHA. level=${alpha.level} kills=${alpha.totalKills} hasCheckpoint=${alpha.hasCheckpoint}`);
    process.exit(1);
  }
  console.log('  ✓ Defaults correct (level=1, kills=0, no checkpoint)');

  // Select slot 1
  console.log('\n[step 3] Selecting slot 1...');
  await ProfileManager.selectSlot(1);
  const currentAfterSelect = ProfileManager.getCurrentSlotId();
  console.log(`  getCurrentSlotId() = ${currentAfterSelect} (expected: 1)`);
  if (currentAfterSelect !== 1) {
    console.error(`FAIL: expected currentSlotId=1, got ${currentAfterSelect}`);
    process.exit(1);
  }

  // Verify selection persisted to global store
  const persistedSlot = await ProfileDB.readGlobal<number>('selectedSlot');
  console.log(`  Persisted selectedSlot in global store = ${persistedSlot} (expected: 1)`);
  if (persistedSlot !== 1) {
    console.error(`FAIL: persisted slot should be 1, got ${persistedSlot}`);
    process.exit(1);
  }

  // Delete slot 1 (the currently-selected one)
  console.log('\n[step 4] Deleting slot 1 (currently selected)...');
  await ProfileManager.deleteProfile(1);
  const currentAfterDelete = ProfileManager.getCurrentSlotId();
  console.log(`  getCurrentSlotId() = ${currentAfterDelete} (expected: null — selection cleared)`);
  if (currentAfterDelete !== null) {
    console.error(`FAIL: expected currentSlotId=null after deleting selected slot, got ${currentAfterDelete}`);
    process.exit(1);
  }

  // Verify persisted selection also cleared
  const persistedAfterDelete = await ProfileDB.readGlobal<number>('selectedSlot');
  console.log(`  Persisted selectedSlot after delete = ${persistedAfterDelete} (expected: undefined)`);
  if (persistedAfterDelete !== undefined) {
    console.error(`FAIL: persisted selectedSlot should be undefined, got ${persistedAfterDelete}`);
    process.exit(1);
  }

  // List again
  console.log('\n[step 5] Listing profiles after delete...');
  const list2 = await ProfileManager.listProfiles();
  console.log(`  Found ${list2.length} profiles:`);
  for (const p of list2) {
    console.log(`    slot ${p.slotId}: name="${p.displayName}"`);
  }

  if (list2.length !== 2) {
    console.error(`FAIL: expected 2 profiles after delete, got ${list2.length}`);
    process.exit(1);
  }
  const remainingIds = list2.map(p => p.slotId).sort();
  if (remainingIds[0] !== 0 || remainingIds[1] !== 2) {
    console.error(`FAIL: expected slots [0,2] to remain, got ${JSON.stringify(remainingIds)}`);
    process.exit(1);
  }
  console.log('  ✓ Only slots 0 and 2 remain, slot 1 deleted');

  // Try createProfile again — should reuse slot 1
  console.log('\n[step 6] Creating new profile (should reuse slot 1)...');
  const reusedSlot = await ProfileManager.createProfile('DELTA');
  console.log(`  createProfile('DELTA') → slot ${reusedSlot} (expected: 1)`);
  if (reusedSlot !== 1) {
    console.error(`FAIL: expected slot 1 to be reused, got ${reusedSlot}`);
    process.exit(1);
  }

  // Rename test
  console.log('\n[step 7] Renaming slot 0 from "ALPHA" to "OMEGA"...');
  await ProfileManager.renameProfile(0, 'OMEGA');
  const renamed = await ProfileManager.listProfiles();
  const slot0After = renamed.find(p => p.slotId === 0);
  console.log(`  slot 0 name after rename: "${slot0After?.displayName}" (expected: "OMEGA")`);
  if (slot0After?.displayName !== 'OMEGA') {
    console.error(`FAIL: rename failed. Got "${slot0After?.displayName}"`);
    process.exit(1);
  }

  // Fill all 3 slots and try to create a 4th
  console.log('\n[step 8] Attempting to create 4th profile (should fail)...');
  try {
    await ProfileManager.createProfile('EPSILON');
    console.error('FAIL: expected createProfile to throw when all slots full');
    process.exit(1);
  } catch (err) {
    console.log(`  ✓ Correctly threw: ${(err as Error).message}`);
  }

  // Read raw SaveData and verify v4 shape
  console.log('\n[step 9] Verifying SaveData v4 shape of slot 0...');
  const slot0Data = await ProfileManager.readProfileData(0);
  if (!slot0Data) {
    console.error('FAIL: readProfileData(0) returned null');
    process.exit(1);
  }
  console.log(`  version: ${slot0Data.version} (expected: 4)`);
  console.log(`  stages field present: ${typeof slot0Data.stages} (expected: object)`);
  console.log(`  player.unlockedWeapons: ${JSON.stringify(slot0Data.player.unlockedWeapons)}`);
  console.log(`  unlockedAreas: ${JSON.stringify(slot0Data.unlockedAreas)}`);
  if (slot0Data.version !== 4) {
    console.error(`FAIL: version should be 4, got ${slot0Data.version}`);
    process.exit(1);
  }
  if (typeof slot0Data.stages !== 'object' || slot0Data.stages === null) {
    console.error(`FAIL: stages field missing or wrong type: ${typeof slot0Data.stages}`);
    process.exit(1);
  }
  console.log('  ✓ SaveData v4 shape correct (version=4, stages field present)');

  // Cleanup
  await ProfileManager._wipeAll();
  console.log('\n[cleanup] Wiped all profile data.');

  console.log('\n=== ALL PHASE 2 SMOKE TESTS PASSED ===');
}

main().catch((err) => {
  console.error('\n=== PHASE 2 SMOKE TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
