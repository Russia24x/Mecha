/**
 * Manual verification page for ProfileManager (Phase 2 browser check).
 *
 * Visiting /profile-test in a real browser executes the same 9 scenarios
 * as scripts/phase2-smoke-test.ts, but against the browser's real IndexedDB
 * (not fake-indexeddb). Results are appended to a <pre> element so the user
 * can verify persistence works end-to-end.
 *
 * IMPORTANT: This page is temporary — will be removed after Phase 6.
 */

'use client';

import { useEffect, useRef } from 'react';

export default function ProfileTestPage() {
  const logRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const log = (msg: string) => {
      if (logRef.current) {
        logRef.current.textContent += msg + '\n';
      }
      // eslint-disable-next-line no-console
      console.log(msg);
    };

    async function run() {
      try {
        log('=== Phase 2 Browser Verification (real IndexedDB) ===\n');

        // Dynamic import so this code is only loaded on this page
        const { ProfileManager } = await import('@/game/systems/ProfileManager');
        const { ProfileDB } = await import('@/game/systems/ProfileDB');

        // Check real IndexedDB availability
        log(`ProfileDB.isAvailable() = ${ProfileDB.isAvailable()} (expected: true)`);
        if (!ProfileDB.isAvailable()) {
          log('FAIL: IndexedDB not available in this browser');
          return;
        }

        // Wipe any leftover state
        await ProfileManager._wipeAll();
        log('[setup] Wiped all profile data.\n');

        // Init
        const initialSlot = await ProfileManager.init();
        log(`[init] currentSlotId = ${initialSlot} (expected: null)`);
        if (initialSlot !== null) {
          log('FAIL: initial slot should be null');
          return;
        }

        // Create 3 profiles
        log('\n[step 1] Creating 3 profiles...');
        const slot0 = await ProfileManager.createProfile('ALPHA');
        log(`  createProfile('ALPHA') -> slot ${slot0}`);
        const slot1 = await ProfileManager.createProfile('BETA');
        log(`  createProfile('BETA')  -> slot ${slot1}`);
        const slot2 = await ProfileManager.createProfile('GAMMA');
        log(`  createProfile('GAMMA') -> slot ${slot2}`);

        if (slot0 !== 0 || slot1 !== 1 || slot2 !== 2) {
          log(`FAIL: expected slots 0,1,2 but got ${slot0},${slot1},${slot2}`);
          return;
        }

        // List
        log('\n[step 2] Listing all profiles...');
        const list1 = await ProfileManager.listProfiles();
        log(`  Found ${list1.length} profiles:`);
        for (const p of list1) {
          log(`    slot ${p.slotId}: name="${p.displayName}" level=${p.level} kills=${p.totalKills} hasCheckpoint=${p.hasCheckpoint}`);
        }
        if (list1.length !== 3) {
          log(`FAIL: expected 3 profiles, got ${list1.length}`);
          return;
        }
        const nameById = new Map(list1.map(p => [p.slotId, p.displayName]));
        if (nameById.get(0) !== 'ALPHA' || nameById.get(1) !== 'BETA' || nameById.get(2) !== 'GAMMA') {
          log(`FAIL: names mismatch. Got: ${JSON.stringify(Object.fromEntries(nameById))}`);
          return;
        }
        log('  OK: All 3 profiles present with correct names');

        // Select slot 1
        log('\n[step 3] Selecting slot 1...');
        await ProfileManager.selectSlot(1);
        const currentAfterSelect = ProfileManager.getCurrentSlotId();
        log(`  getCurrentSlotId() = ${currentAfterSelect} (expected: 1)`);
        if (currentAfterSelect !== 1) {
          log(`FAIL: expected currentSlotId=1, got ${currentAfterSelect}`);
          return;
        }

        // Delete slot 1
        log('\n[step 4] Deleting slot 1 (currently selected)...');
        await ProfileManager.deleteProfile(1);
        const currentAfterDelete = ProfileManager.getCurrentSlotId();
        log(`  getCurrentSlotId() = ${currentAfterDelete} (expected: null)`);
        if (currentAfterDelete !== null) {
          log(`FAIL: expected null after deleting selected slot, got ${currentAfterDelete}`);
          return;
        }

        // List again
        log('\n[step 5] Listing profiles after delete...');
        const list2 = await ProfileManager.listProfiles();
        log(`  Found ${list2.length} profiles:`);
        for (const p of list2) {
          log(`    slot ${p.slotId}: name="${p.displayName}"`);
        }
        if (list2.length !== 2) {
          log(`FAIL: expected 2 profiles after delete, got ${list2.length}`);
          return;
        }
        log('  OK: Only slots 0 and 2 remain');

        // Verify SaveData v4 shape
        log('\n[step 6] Verifying SaveData v4 shape of slot 0...');
        const slot0Data = await ProfileManager.readProfileData(0);
        if (!slot0Data) {
          log('FAIL: readProfileData(0) returned null');
          return;
        }
        log(`  version: ${slot0Data.version} (expected: 4)`);
        log(`  stages field present: ${typeof slot0Data.stages} (expected: object)`);
        log(`  player.unlockedWeapons: ${JSON.stringify(slot0Data.player.unlockedWeapons)}`);
        log(`  unlockedAreas: ${JSON.stringify(slot0Data.unlockedAreas)}`);
        if (slot0Data.version !== 4) {
          log(`FAIL: version should be 4, got ${slot0Data.version}`);
          return;
        }
        if (typeof slot0Data.stages !== 'object' || slot0Data.stages === null) {
          log(`FAIL: stages field missing or wrong type`);
          return;
        }
        log('  OK: SaveData v4 shape correct');

        // PERSISTENCE CHECK: create a profile, select it, verify it's in IndexedDB
        log('\n[step 7] Persistence check: verify IndexedDB record exists after write...');
        const newSlot = await ProfileManager.createProfile('PERSIST_TEST');
        await ProfileManager.selectSlot(newSlot);
        log(`  Created + selected slot ${newSlot} (PERSIST_TEST)`);

        // Read raw from ProfileDB to verify it's in IndexedDB (not just in-memory cache)
        const persistedSlot = await ProfileDB.readGlobal<number>('selectedSlot');
        log(`  Persisted selectedSlot in global store = ${persistedSlot} (expected: ${newSlot})`);
        if (persistedSlot !== newSlot) {
          log(`FAIL: persisted slot should be ${newSlot}, got ${persistedSlot}`);
          return;
        }
        const profileRecord = await ProfileDB.readProfile(newSlot);
        log(`  IndexedDB profile record exists: ${profileRecord !== undefined} (expected: true)`);
        log(`  Record displayName: "${profileRecord?.displayName}" (expected: "PERSIST_TEST")`);
        log(`  Record lastSavedAt: ${profileRecord?.lastSavedAt}`);
        if (!profileRecord || profileRecord.displayName !== 'PERSIST_TEST') {
          log('FAIL: profile record missing or wrong name');
          return;
        }
        log('  OK: Persistence verified — IndexedDB record + global store both correct');

        // Cleanup
        await ProfileManager._wipeAll();
        log('\n[cleanup] Wiped all profile data.');
        log('\n=== ALL BROWSER VERIFICATION STEPS PASSED ===');
        log('\nTo verify manually: open DevTools -> Application -> IndexedDB -> mecha_last_protocol');
        log('(Data was wiped at end of test, so DB should now be empty.)');
      } catch (err) {
        log(`\n=== BROWSER VERIFICATION FAILED ===`);
        log(String(err));
        log(err instanceof Error ? err.stack ?? '' : '');
      }
    }

    run();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', background: '#0a0e14', color: '#39d0d8', minHeight: '100vh' }}>
      <h1 style={{ color: '#39d0d8', marginBottom: '20px' }}>Phase 2 Browser Verification</h1>
      <p style={{ color: '#5a6470', marginBottom: '20px' }}>
        Running ProfileManager scenarios against real browser IndexedDB.
        Open DevTools → Application → IndexedDB → mecha_last_protocol to inspect.
      </p>
      <pre
        ref={logRef}
        style={{
          background: '#000',
          color: '#39d0d8',
          padding: '15px',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          fontSize: '12px',
          lineHeight: '1.4',
          border: '1px solid #1a2028',
        }}
      />
    </div>
  );
}
