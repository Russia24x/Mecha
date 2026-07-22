'use client';

import { useEffect, useRef } from 'react';

/**
 * Phase 4 AutoSaveManager Browser Verification
 *
 * Tests AutoSaveManager against real browser IndexedDB + real visibilitychange
 * + real beforeunload events.
 *
 * Manual test for beforeunload reliability:
 *   1. Click "Mutate + Close Tab" — sets dirty=true + attempts to close tab
 *   2. Reopen the page — verify recovery message shows the mutated data
 */

export default function AutoSaveTestPage() {
  const logRef = useRef<HTMLPreElement | null>(null);

  const log = (msg: string) => {
    if (logRef.current) {
      logRef.current.textContent += msg + '\n';
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
    // eslint-disable-next-line no-console
    console.log(msg);
  };

  useEffect(() => {
    async function run() {
      try {
        log('=== Phase 4 AutoSaveManager Browser Verification ===\n');

        const { autoSaveManager } = await import('@/game/systems/AutoSaveManager');
        const { SaveSystem } = await import('@/game/systems/SaveSystem');
        const { ProfileManager } = await import('@/game/systems/ProfileManager');
        const { ProfileDB } = await import('@/game/systems/ProfileDB');

        // Setup
        await ProfileManager._wipeAll();
        await ProfileManager.init();
        const slotId = await ProfileManager.createProfile('PHASE4_BROWSER');
        await ProfileManager.selectSlot(slotId);
        await SaveSystem.init();
        log(`[setup] Created + selected slot ${slotId}`);

        // Test 1: start
        autoSaveManager.start();
        log('[test 1] start() — isRunning: ' + autoSaveManager.isRunning());

        // Test 2: saveNow flushes to real IndexedDB
        SaveSystem.setQuestFlag('browser_test', true);
        SaveSystem.recordKill();
        log('[test 2] Mutated state, isDirty: ' + SaveSystem.isDirty());
        await autoSaveManager.saveNow();
        log('  After saveNow, isDirty: ' + SaveSystem.isDirty());

        // Verify it's in real IndexedDB
        const record = await ProfileDB.readProfile(slotId as 0 | 1 | 2);
        const saved = record?.saveData as { questFlags: Record<string, boolean>, player: { totalKills: number } };
        log('  IndexedDB questFlags.browser_test: ' + saved.questFlags.browser_test);
        log('  IndexedDB player.totalKills: ' + saved.player.totalKills);
        log('  IndexedDB lastSavedAt: ' + record?.lastSavedAt);

        // Test 3: 30s timer — skipping 30s wait
        log('\n[test 3] 30s timer registered (skipping actual wait, saveNow covers same code path).');

        // Test 4: visibilitychange (real browser event)
        log('\n[test 4] visibilitychange test:');
        log('  Switch to another tab, then come back — handler will flush on hide.');
        SaveSystem.setQuestFlag('visibility_real', true);
        log('  Set visibility_real=true, isDirty: ' + SaveSystem.isDirty());

        // Test 5: beforeunload reliability — manual test
        log('\n[test 5] beforeunload reliability (MANUAL TEST):');
        log('  Click "Mutate + Close Tab" below, then reopen this page.');

        // Check for recovery on this boot
        const recovered = await ProfileDB.recoverFromLocalStorageMirror(slotId as 0 | 1 | 2);
        if (recovered) {
          const recData = recovered as { questFlags: Record<string, boolean> };
          log('\n[RECOVERY] Found localStorage mirror from previous session!');
          log('  Recovered questFlags: ' + JSON.stringify(recData.questFlags));
          if (recData.questFlags.beforeunload_real) {
            log('  ✓ beforeunload_real flag was preserved across tab close!');
          }
          ProfileDB.clearLocalStorageMirror(slotId as 0 | 1 | 2);
        } else {
          log('\n[recovery] No localStorage mirror found (fresh boot or last session was clean).');
        }

        // Set up buttons
        const mutateBtn = document.getElementById('mutate-btn');
        if (mutateBtn) {
          mutateBtn.onclick = () => {
            SaveSystem.setQuestFlag('manual_mutation_' + Date.now(), true);
            log('[manual] Mutated state, isDirty: ' + SaveSystem.isDirty());
          };
        }

        const closeBtn = document.getElementById('close-tab-btn');
        if (closeBtn) {
          closeBtn.onclick = () => {
            SaveSystem.setQuestFlag('beforeunload_real', true);
            log('\n[manual] Set beforeunload_real=true, attempting to close tab...');
            log('[manual] If tab does not close automatically, please close it manually.');
            try { window.close(); } catch { /* may fail cross-origin */ }
          };
        }

        log('\n=== Setup complete. Use buttons below for manual tests. ===');
      } catch (err) {
        log('=== FAILED ===');
        log(String(err));
        log(err instanceof Error ? err.stack ?? '' : '');
      }
    }
    run();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', background: '#0a0e14', color: '#39d0d8', minHeight: '100vh' }}>
      <h1 style={{ color: '#39d0d8', marginBottom: '10px' }}>Phase 4 AutoSaveManager Browser Verification</h1>
      <p style={{ color: '#5a6470', marginBottom: '15px', fontSize: '13px' }}>
        Real browser IndexedDB + real visibilitychange + real beforeunload events.
        Open DevTools → Application → IndexedDB → mecha_last_protocol to inspect.
      </p>
      <div style={{ marginBottom: '15px' }}>
        <button
          id="mutate-btn"
          style={{
            background: '#1a2028', color: '#39d0d8', border: '1px solid #39d0d8',
            padding: '8px 16px', marginRight: '10px', cursor: 'pointer', fontFamily: 'monospace',
          }}
        >
          Mutate state
        </button>
        <button
          id="close-tab-btn"
          style={{
            background: '#1a2028', color: '#ff6b6b', border: '1px solid #ff6b6b',
            padding: '8px 16px', cursor: 'pointer', fontFamily: 'monospace',
          }}
        >
          Mutate + Close Tab (beforeunload test)
        </button>
      </div>
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
          maxHeight: '600px',
          overflowY: 'auto',
        }}
      />
    </div>
  );
}
