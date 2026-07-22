/**
 * Phase 3 Verify Runner — captures snapshot from REWRITTEN SaveSystem
 *
 * Runs the same shared scenario as scripts/phase3-baseline.ts, but against
 * the rewritten ProfileDB-backed SaveSystem. Requires ProfileManager
 * initialization + a fresh profile slot.
 *
 * Then diffs against baseline.json field-by-field and reports any
 * behavioral differences.
 *
 * Run: bun scripts/phase3-verify.ts
 */

import 'fake-indexeddb/auto';
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { runSnapshotScenario, type SnapshotStep } from './phase3-scenario';
import { ProfileManager } from '../src/game/systems/ProfileManager';
import { SaveSystem } from '../src/game/systems/SaveSystem';

interface DiffResult {
  step: number;
  method: string;
  field: string;
  baselineValue: unknown;
  afterValue: unknown;
}

async function main(): Promise<void> {
  console.log('=== Phase 3 Verify Capture ===');
  console.log('Running scenario against REWRITTEN SaveSystem (ProfileDB-backed)...\n');

  // Setup: init ProfileManager + create a profile slot + select it
  await ProfileManager._wipeAll();
  await ProfileManager.init();
  const slotId = await ProfileManager.createProfile('PHASE3_VERIFY');
  await ProfileManager.selectSlot(slotId);

  // Init SaveSystem (loads cache from the slot)
  await SaveSystem.init();

  // Run the scenario
  const steps = await runSnapshotScenario();

  // Write to file
  const outputPath = `${process.cwd()}/scripts/phase3-after.json`;
  const json = JSON.stringify(steps, null, 2);
  await writeFile(outputPath, json, 'utf8');
  console.log(`✓ Captured ${steps.length} steps`);
  console.log(`✓ After-rewrite snapshot written to: ${outputPath}\n`);

  // ── Diff against baseline ──
  const baselinePath = `${process.cwd()}/scripts/phase3-baseline.json`;
  if (!existsSync(baselinePath)) {
    console.error(`✗ Baseline not found at ${baselinePath}`);
    console.error('  Run `bun scripts/phase3-baseline.ts` first.');
    process.exit(1);
  }
  const baselineJson = await readFile(baselinePath, 'utf8');
  const baselineSteps = JSON.parse(baselineJson) as SnapshotStep[];

  if (baselineSteps.length !== steps.length) {
    console.error(`✗ Step count mismatch: baseline=${baselineSteps.length}, after=${steps.length}`);
    process.exit(1);
  }

  console.log('=== Field-by-Field Diff ===\n');

  const diffs: DiffResult[] = [];
  const expectedDiffs: DiffResult[] = []; // diffs we KNOW about (v4 additions)
  let identicalSteps = 0;

  for (let i = 0; i < steps.length; i++) {
    const baseline = baselineSteps[i];
    const after = steps[i];

    // Verify step metadata matches
    if (baseline.step !== after.step || baseline.method !== after.method) {
      console.error(`✗ Step ${i}: metadata mismatch.`);
      console.error(`  baseline: step=${baseline.step} method=${baseline.method}`);
      console.error(`  after:    step=${after.step} method=${after.method}`);
      process.exit(1);
    }

    // Compare return values
    if (!deepEqual(baseline.returnValue, after.returnValue)) {
      // Special case: stages methods return undefined in baseline (didn't exist),
      // but return real values in after (new v4 methods).
      const isStagesMethod = baseline.method === 'recordStageComplete' || baseline.method === 'isStageUnlocked';
      const baselineWasUndefined = baseline.returnValue === undefined || baseline.returnValue === null;
      if (isStagesMethod && baselineWasUndefined) {
        expectedDiffs.push({
          step: after.step,
          method: after.method,
          field: 'returnValue',
          baselineValue: baseline.returnValue,
          afterValue: after.returnValue,
        });
      } else {
        // Special case: full-state getters (get, getPlayer, getSettings)
        // The ONLY differences should be version (3→4) and stages (undefined→added).
        // Verify this by comparing the two objects field-by-field, treating
        // version and stages diffs as expected.
        if (baseline.method === 'get' || baseline.method === 'getPlayer' || baseline.method === 'getSettings') {
          const onlyExpectedDiffs = onlyHasVersionAndStagesDiffs(
            baseline.returnValue as Record<string, unknown>,
            after.returnValue as Record<string, unknown>,
          );
          if (onlyExpectedDiffs) {
            expectedDiffs.push({
              step: after.step,
              method: after.method,
              field: 'returnValue',
              baselineValue: '(version:3, no stages field)',
              afterValue: '(version:4, stages field added)',
            });
          } else {
            diffs.push({
              step: after.step,
              method: after.method,
              field: 'returnValue',
              baselineValue: baseline.returnValue,
              afterValue: after.returnValue,
            });
          }
        } else {
          diffs.push({
            step: after.step,
            method: after.method,
            field: 'returnValue',
            baselineValue: baseline.returnValue,
            afterValue: after.returnValue,
          });
        }
      }
    }

    // Compare stateAfter field-by-field (top-level keys)
    const baselineState = baseline.stateAfter as Record<string, unknown>;
    const afterState = after.stateAfter as Record<string, unknown>;

    // Get all unique keys from both states
    const allKeys = new Set([...Object.keys(baselineState), ...Object.keys(afterState)]);

    for (const key of allKeys) {
      const bv = baselineState[key];
      const av = afterState[key];

      if (!deepEqual(bv, av)) {
        // Expected diff #1: version 3 → 4 (v4 bump)
        if (key === 'version' && bv === 3 && av === 4) {
          expectedDiffs.push({
            step: after.step,
            method: after.method,
            field: `state.${key}`,
            baselineValue: bv,
            afterValue: av,
          });
          continue;
        }
        // Expected diff #2: stages field (NEW in v4).
        // Baseline (v3) has no stages field (undefined).
        // After (v4) has stages = {} by default, populated after recordStageComplete.
        if (key === 'stages' && bv === undefined) {
          expectedDiffs.push({
            step: after.step,
            method: after.method,
            field: `state.${key}`,
            baselineValue: bv,
            afterValue: av,
          });
          continue;
        }
        diffs.push({
          step: after.step,
          method: after.method,
          field: `state.${key}`,
          baselineValue: bv,
          afterValue: av,
        });
      }
    }

    // If no diffs for this step, count as identical
    const stepDiffs = diffs.filter(d => d.step === after.step);
    const stepExpected = expectedDiffs.filter(d => d.step === after.step);
    if (stepDiffs.length === 0 && stepExpected.length === 0) {
      identicalSteps++;
    }
  }

  // ── Report ──
  console.log(`Total steps compared:           ${steps.length}`);
  console.log(`Steps with zero diffs:          ${identicalSteps}`);
  console.log(`Steps with EXPECTED diffs only: ${steps.length - identicalSteps - diffs.length}`);
  console.log(`Steps with UNEXPECTED diffs:    ${diffs.length}`);
  console.log('');

  if (expectedDiffs.length > 0) {
    console.log('--- EXPECTED DiffS (v4 additions, OK) ---');
    // Show only unique expected diffs (not one per step)
    const seen = new Set<string>();
    for (const d of expectedDiffs) {
      const key = `${d.method}::${d.field}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  step ${String(d.step).padStart(3, '0')}  ${d.method.padEnd(28)} ${d.field}`);
      console.log(`           baseline: ${JSON.stringify(d.baselineValue)}`);
      console.log(`           after:    ${JSON.stringify(d.afterValue)}`);
    }
    console.log('');
  }

  if (diffs.length > 0) {
    console.log('--- UNEXPECTED DIFFS (REGRESSIONS — INVESTIGATE) ---');
    // Show only unique unexpected diffs
    const seen = new Set<string>();
    for (const d of diffs) {
      const key = `${d.method}::${d.field}::${JSON.stringify(d.baselineValue)}::${JSON.stringify(d.afterValue)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  step ${String(d.step).padStart(3, '0')}  ${d.method.padEnd(28)} ${d.field}`);
      console.log(`           baseline: ${JSON.stringify(d.baselineValue)}`);
      console.log(`           after:    ${JSON.stringify(d.afterValue)}`);
    }
    console.log('');
    console.log(`✗ ${diffs.length} unexpected diff(s) found — see above.`);
    console.log('  Do NOT commit until resolved.');
    process.exit(1);
  } else {
    console.log('✓ All steps match baseline (with only expected v4 additions).');
    console.log('  Safe to commit.');
  }

  // Cleanup
  await ProfileManager._wipeAll();
}

// ── Deep equal (handles arrays, objects, primitives) ──
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  // Both are objects
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) {
    // Special case: if one has `stages` and the other doesn't, but both are
    // otherwise empty/missing — treat as equal (v3 didn't have stages)
    const aWithoutStages = aKeys.filter(k => k !== 'stages');
    const bWithoutStages = bKeys.filter(k => k !== 'stages');
    if (aWithoutStages.length !== bWithoutStages.length) return false;
  }
  for (const key of aKeys) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

/**
 * Check whether the ONLY differences between two objects are:
 *   - `version`: 3 (baseline) → 4 (after)
 *   - `stages`: undefined/missing (baseline) → any value (after, new v4 field)
 *
 * Used to verify that full-state getters (get/getPlayer/getSettings) return
 * identical data EXCEPT for the expected v4 schema additions.
 *
 * Returns true if all non-version/stages fields are deeply equal.
 */
function onlyHasVersionAndStagesDiffs(
  baseline: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  const baselineKeys = Object.keys(baseline).filter(k => k !== 'version' && k !== 'stages');
  const afterKeys = Object.keys(after).filter(k => k !== 'version' && k !== 'stages');
  if (baselineKeys.length !== afterKeys.length) return false;
  for (const key of baselineKeys) {
    if (!afterKeys.includes(key)) return false;
    if (!deepEqual(baseline[key], after[key])) return false;
  }
  // All non-version/stages fields match. Verify version + stages are as expected.
  if (baseline.version !== 3 || after.version !== 4) return false;
  // stages: baseline should NOT have it (or undefined), after SHOULD have it
  if (baseline.stages !== undefined) return false;
  if (after.stages === undefined) return false;
  return true;
}

main().catch((err) => {
  console.error('=== VERIFY CAPTURE FAILED ===');
  console.error(err);
  process.exit(1);
});
