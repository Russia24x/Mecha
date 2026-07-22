/**
 * Phase 5 ProfileSelectUI Smoke Test
 *
 * Verifies the logic of ProfileSelectUI:
 *   1. show() lists 3 slots (empty + occupied mix)
 *   2. Create in empty slot works
 *   3. Select on occupied slot works
 *   4. Delete with confirmation works
 *   5. hide() cleans up
 *
 * Since ProfileSelectUI requires a Phaser.Scene (which we can't easily mock),
 * this test verifies the underlying ProfileManager logic that ProfileSelectUI
 * depends on. The UI itself will be visually verified in-browser via /profile-ui-test.
 *
 * Run: bun scripts/phase5-smoke-test.ts
 */

import 'fake-indexeddb/auto';
import { ProfileManager } from '../src/game/systems/ProfileManager';
import { ProfileDB } from '../src/game/systems/ProfileDB';

async function main(): Promise<void> {
  console.log('=== Phase 5 ProfileSelectUI Smoke Test ===\n');

  // Setup
  await ProfileManager._wipeAll();
  await ProfileManager.init();

  // ── Test 1: All slots empty initially ──
  console.log('[test 1] All slots empty initially...');
  let profiles = await ProfileManager.listProfiles();
  console.log('  Profile count:', profiles.length, '(expected: 0)');
  if (profiles.length !== 0) {
    console.error('FAIL: expected 0 profiles');
    process.exit(1);
  }

  // ── Test 2: Create profile in slot 0 ──
  console.log('\n[test 2] Create profile in slot 0...');
  // Simulate what ProfileSelectUI.handleCreate does
  const { DEFAULT_SAVE } = await import('../src/game/systems/ProfileManager');
  const saveData1 = {
    ...DEFAULT_SAVE,
    player: { ...DEFAULT_SAVE.player, level: 5, totalKills: 42 },
    settings: { ...DEFAULT_SAVE.settings },
    stages: {},
  };
  await ProfileDB.writeProfile(0, saveData1, 'ALPHA');
  profiles = await ProfileManager.listProfiles();
  console.log('  Profile count:', profiles.length, '(expected: 1)');
  console.log('  Slot 0 name:', profiles[0].displayName, '(expected: ALPHA)');
  console.log('  Slot 0 level:', profiles[0].level, '(expected: 5)');
  console.log('  Slot 0 kills:', profiles[0].totalKills, '(expected: 42)');
  console.log('  Slot 0 hasCheckpoint:', profiles[0].hasCheckpoint, '(expected: false)');
  if (profiles.length !== 1 || profiles[0].displayName !== 'ALPHA' || profiles[0].level !== 5) {
    console.error('FAIL: slot 0 data mismatch');
    process.exit(1);
  }

  // ── Test 3: Create profile in slot 2 (skip slot 1) ──
  console.log('\n[test 3] Create profile in slot 2 (skip slot 1)...');
  const saveData2 = {
    ...DEFAULT_SAVE,
    player: { ...DEFAULT_SAVE.player, level: 12, totalKills: 150 },
    settings: { ...DEFAULT_SAVE.settings },
    checkpoint: { actId: 1, regionId: 'r1', areaId: 'abandoned_factory', section: 3, x: 100, y: 200, timestamp: Date.now() },
    stages: {},
  };
  await ProfileDB.writeProfile(2, saveData2, 'GAMMA');
  profiles = await ProfileManager.listProfiles();
  console.log('  Profile count:', profiles.length, '(expected: 2)');
  console.log('  Slots:', profiles.map(p => p.slotId), '(expected: [0, 2])');
  console.log('  Slot 2 name:', profiles[1].displayName, '(expected: GAMMA)');
  console.log('  Slot 2 hasCheckpoint:', profiles[1].hasCheckpoint, '(expected: true)');
  if (profiles.length !== 2 || profiles[1].slotId !== 2 || profiles[1].hasCheckpoint !== true) {
    console.error('FAIL: slot 2 data mismatch');
    process.exit(1);
  }

  // ── Test 4: Select slot 2 ──
  console.log('\n[test 4] Select slot 2...');
  await ProfileManager.selectSlot(2);
  const current = ProfileManager.getCurrentSlotId();
  console.log('  Current slot:', current, '(expected: 2)');
  if (current !== 2) {
    console.error('FAIL: expected current slot 2');
    process.exit(1);
  }

  // ── Test 5: Delete slot 0 ──
  console.log('\n[test 5] Delete slot 0...');
  await ProfileManager.deleteProfile(0);
  profiles = await ProfileManager.listProfiles();
  console.log('  Profile count after delete:', profiles.length, '(expected: 1)');
  console.log('  Remaining slots:', profiles.map(p => p.slotId), '(expected: [2])');
  if (profiles.length !== 1 || profiles[0].slotId !== 2) {
    console.error('FAIL: delete did not work correctly');
    process.exit(1);
  }

  // ── Test 6: Current slot unchanged (was 2, not 0) ──
  console.log('\n[test 6] Current slot unchanged after deleting different slot...');
  const currentAfterDelete = ProfileManager.getCurrentSlotId();
  console.log('  Current slot:', currentAfterDelete, '(expected: 2)');
  if (currentAfterDelete !== 2) {
    console.error('FAIL: current slot should still be 2');
    process.exit(1);
  }

  // ── Test 7: Delete current slot clears selection ──
  console.log('\n[test 7] Delete current slot (2) clears selection...');
  await ProfileManager.deleteProfile(2);
  const currentAfterSelfDelete = ProfileManager.getCurrentSlotId();
  console.log('  Current slot:', currentAfterSelfDelete, '(expected: null)');
  if (currentAfterSelfDelete !== null) {
    console.error('FAIL: current slot should be null after deleting selected');
    process.exit(1);
  }
  profiles = await ProfileManager.listProfiles();
  console.log('  Profile count:', profiles.length, '(expected: 0)');
  if (profiles.length !== 0) {
    console.error('FAIL: expected 0 profiles after deleting all');
    process.exit(1);
  }

  // ── Test 8: ProfileSummary fields are correct ──
  console.log('\n[test 8] Verify ProfileSummary fields...');
  const saveData3 = {
    ...DEFAULT_SAVE,
    player: { ...DEFAULT_SAVE.player, level: 99, totalKills: 999 },
    settings: { ...DEFAULT_SAVE.settings },
    stages: { 1: { completed: true, bestTimeMs: 60000 } },
  };
  await ProfileDB.writeProfile(1, saveData3, 'TEST_SUMMARY');
  profiles = await ProfileManager.listProfiles();
  const p = profiles[0];
  console.log('  slotId:', p.slotId, '(expected: 1)');
  console.log('  displayName:', p.displayName, '(expected: TEST_SUMMARY)');
  console.log('  level:', p.level, '(expected: 99)');
  console.log('  totalKills:', p.totalKills, '(expected: 999)');
  console.log('  hasCheckpoint:', p.hasCheckpoint, '(expected: false)');
  console.log('  createdAt exists:', !!p.createdAt);
  console.log('  lastSavedAt exists:', !!p.lastSavedAt);
  if (p.slotId !== 1 || p.displayName !== 'TEST_SUMMARY' || p.level !== 99 || p.totalKills !== 999) {
    console.error('FAIL: ProfileSummary fields mismatch');
    process.exit(1);
  }

  // Cleanup
  await ProfileManager._wipeAll();
  console.log('\n[cleanup] Wiped all profile data.');
  console.log('\n=== ALL PHASE 5 SMOKE TESTS PASSED ===');
  console.log('\nNote: UI visual verification requires browser. Run /profile-ui-test');
  console.log('in a real browser to verify the overlay renders correctly.');
}

main().catch((err) => {
  console.error('\n=== PHASE 5 SMOKE TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
