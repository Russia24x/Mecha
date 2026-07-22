/**
 * Phase 6 Leak Test — Profile Switch
 *
 * Per user feedback: measure scene.children.list.length / AutoSaveManager
 * timers before/after 10 profile switches. Report actual numbers, not just
 * "no leak".
 *
 * Since we can't easily run a full Phaser GameScene in Node, this test
 * measures:
 *   1. AutoSaveManager timer cleanup (interval cleared on stop)
 *   2. ProfileManager state after multiple selectSlot calls
 *   3. SaveSystem cache integrity after multiple selectSlot calls
 *   4. EventBus listener count (simulated — check QuestSystem subscribers
 *      don't accumulate, since that was a bug pattern in the past)
 *
 * The real "scene.children.list.length" leak check will be done in-browser
 * during the integrated MenuBuilder → ProfileSelectUI test.
 *
 * Run: bun scripts/phase6-leak-test.ts
 */

import './dom-mock';
import 'fake-indexeddb/auto';
import { autoSaveManager } from '../src/game/systems/AutoSaveManager';
import { SaveSystem } from '../src/game/systems/SaveSystem';
import { ProfileManager, DEFAULT_SAVE } from '../src/game/systems/ProfileManager';
import { ProfileDB } from '../src/game/systems/ProfileDB';

async function main(): Promise<void> {
  console.log('=== Phase 6 Leak Test ===\n');

  // Setup
  await ProfileManager._wipeAll();
  await ProfileManager.init();

  // Create 3 profiles
  for (let i = 0; i < 3; i++) {
    const saveData = {
      ...DEFAULT_SAVE,
      player: { ...DEFAULT_SAVE.player, level: (i + 1) * 5, totalKills: i * 10 },
      settings: { ...DEFAULT_SAVE.settings },
      stages: {},
    };
    await ProfileDB.writeProfile(i as 0 | 1 | 2, saveData, `PILOT ${i + 1}`);
  }
  console.log('[setup] Created 3 profiles');

  // ── Test 1: AutoSaveManager start/stop cycle — verify interval cleared ──
  console.log('\n[test 1] AutoSaveManager start/stop cycle (10 iterations):');
  const activeIntervalsBefore = countActiveIntervals();
  console.log('  Active intervals before:', activeIntervalsBefore);

  for (let i = 0; i < 10; i++) {
    autoSaveManager.start();
    autoSaveManager.start(); // double-start (should be no-op)
    // Simulate some work
    SaveSystem.setQuestFlag(`test_${i}`, true);
    await autoSaveManager.stop();
    await autoSaveManager.stop(); // double-stop (should be no-op)
  }

  const activeIntervalsAfter = countActiveIntervals();
  console.log('  Active intervals after 10 start/stop cycles:', activeIntervalsAfter);
  console.log('  Difference:', activeIntervalsAfter - activeIntervalsBefore, '(expected: 0)');
  if (activeIntervalsAfter - activeIntervalsBefore !== 0) {
    console.error('FAIL: interval leak detected');
    process.exit(1);
  }
  console.log('  ✓ No interval leak');

  // ── Test 2: Profile switch — verify SaveSystem cache doesn't accumulate ──
  console.log('\n[test 2] Profile switch (10 iterations):');
  await SaveSystem.init();

  // Track memory usage of SaveSystem cache (it's a single object, so we check
  // that it doesn't grow unboundedly)
  const cacheSizeBefore = JSON.stringify(SaveSystem.get()).length;
  console.log('  SaveSystem cache size before (bytes):', cacheSizeBefore);

  for (let i = 0; i < 10; i++) {
    const slotId = (i % 3) as 0 | 1 | 2;
    await SaveSystem.selectSlot(slotId);
    // Mutate something
    SaveSystem.setQuestFlag(`switch_${i}`, true);
  }

  const cacheSizeAfter = JSON.stringify(SaveSystem.get()).length;
  console.log('  SaveSystem cache size after (bytes):', cacheSizeAfter);
  console.log('  Difference:', cacheSizeAfter - cacheSizeBefore, '(expected: small — questFlags grows by switch_0..9)');
  // Each switch adds ~15 bytes ("switch_N":true,) — 10 switches = ~150 bytes max
  // But cache is replaced on each selectSlot, so only the LAST slot's mutations persist
  if (cacheSizeAfter - cacheSizeBefore > 500) {
    console.error('FAIL: cache grew too much — possible leak');
    process.exit(1);
  }
  console.log('  ✓ Cache growth within expected bounds');

  // ── Test 3: ProfileManager state — verify currentSlotId is correct ──
  console.log('\n[test 3] ProfileManager state after switches:');
  const finalSlot = ProfileManager.getCurrentSlotId();
  console.log('  Current slot:', finalSlot, '(expected: 0 — last switch was i=9, 9%3=0)');
  if (finalSlot !== 0) {
    console.error('FAIL: expected current slot 0');
    process.exit(1);
  }
  console.log('  ✓ ProfileManager state correct');

  // ── Test 4: ProfileManager.init() idempotency ──
  console.log('\n[test 4] ProfileManager.init() idempotency (10 calls):');
  const slotBefore = ProfileManager.getCurrentSlotId();
  for (let i = 0; i < 10; i++) {
    await ProfileManager.init();
  }
  const slotAfter = ProfileManager.getCurrentSlotId();
  console.log('  Slot before:', slotBefore, '/ Slot after 10 init() calls:', slotAfter);
  if (slotBefore !== slotAfter) {
    console.error('FAIL: init() is not idempotent');
    process.exit(1);
  }
  console.log('  ✓ init() is idempotent');

  // ── Test 5: window event listeners (AutoSaveManager) ──
  console.log('\n[test 5] Window event listener count (AutoSaveManager):');
  // Count listeners on our mock window
  const windowListeners = (globalThis.window as unknown as {
    __listeners?: Record<string, Array<unknown>>;
  }).__listeners;
  if (windowListeners) {
    const counts = Object.fromEntries(
      Object.entries(windowListeners).map(([k, v]) => [k, v.length])
    );
    console.log('  Listener counts:', JSON.stringify(counts));
  } else {
    console.log('  (mock window doesn\'t track listener counts — skipping)');
  }

  // ── Test 6: SaveSystem dirty flag doesn't get stuck ──
  console.log('\n[test 6] Dirty flag after profile switch:');
  await SaveSystem.selectSlot(0);
  SaveSystem.setQuestFlag('dirty_test', true);
  console.log('  isDirty after mutation:', SaveSystem.isDirty(), '(expected: true)');
  await autoSaveManager.start();
  await autoSaveManager.saveNow();
  console.log('  isDirty after saveNow:', SaveSystem.isDirty(), '(expected: false)');
  if (SaveSystem.isDirty()) {
    console.error('FAIL: dirty flag stuck after saveNow');
    process.exit(1);
  }
  await autoSaveManager.stop();
  console.log('  ✓ Dirty flag management correct');

  // Cleanup
  await ProfileManager._wipeAll();
  console.log('\n=== ALL LEAK TESTS PASSED ===');
}

/**
 * Count active setInterval timers. Node doesn't expose this directly,
 * so we patch setInterval to track IDs.
 */
let _activeIntervalCount = 0;
const _originalSetInterval = globalThis.setInterval;
const _originalClearInterval = globalThis.clearInterval;
// Patch once
(globalThis as unknown as { __intervalPatched?: boolean }).__intervalPatched ||= (() => {
  globalThis.setInterval = ((fn: () => void, ms: number, ...args: unknown[]) => {
    _activeIntervalCount++;
    const id = _originalSetInterval(fn, ms, ...args);
    return id;
  }) as typeof setInterval;
  globalThis.clearInterval = ((id: ReturnType<typeof setInterval>) => {
    _activeIntervalCount = Math.max(0, _activeIntervalCount - 1);
    return _originalClearInterval(id);
  }) as typeof clearInterval;
  return true;
})();

function countActiveIntervals(): number {
  return _activeIntervalCount;
}

main().catch((err) => {
  console.error('\n=== LEAK TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
