/**
 * Phase 3 Baseline Runner — captures snapshot from CURRENT SaveSystem
 *
 * Runs the shared scenario against the existing localStorage-based SaveSystem
 * and writes the captured steps to scripts/phase3-baseline.json.
 *
 * This file is the SOURCE OF TRUTH for "behavior before rewrite".
 * After the Phase 3b rewrite, scripts/phase3-verify.ts will run the same
 * scenario and diff against this baseline.
 *
 * Run: bun scripts/phase3-baseline.ts
 */

import { writeFile } from 'node:fs/promises';
import { runSnapshotScenario } from './phase3-scenario';

async function main(): Promise<void> {
  console.log('=== Phase 3 Baseline Capture ===');
  console.log('Running scenario against CURRENT SaveSystem (localStorage-based)...\n');

  const steps = await runSnapshotScenario();

  // Write to file
  const outputPath = `${process.cwd()}/scripts/phase3-baseline.json`;
  const json = JSON.stringify(steps, null, 2);
  await writeFile(outputPath, json, 'utf8');

  console.log(`✓ Captured ${steps.length} steps`);
  console.log(`✓ Baseline written to: ${outputPath}`);
  console.log(`  File size: ${(json.length / 1024).toFixed(1)} KB\n`);

  // Print summary of return values for quick visual check
  console.log('=== Return Value Summary ===');
  for (const s of steps) {
    const rv = typeof s.returnValue === 'object' && s.returnValue !== null
      ? JSON.stringify(s.returnValue)
      : String(s.returnValue);
    const truncated = rv.length > 60 ? rv.slice(0, 57) + '...' : rv;
    console.log(`  step ${String(s.step).padStart(3, '0')}  ${s.method.padEnd(28, ' ')} → ${truncated}`);
  }

  // Print final state summary (key fields only, for human review)
  const finalState = steps[steps.length - 1].stateAfter as Record<string, unknown>;
  const player = finalState.player as Record<string, unknown>;
  console.log('\n=== Final State Summary (key fields) ===');
  console.log(`  version:           ${finalState.version}`);
  console.log(`  player.level:      ${player.level}`);
  console.log(`  player.xp:         ${player.xp}`);
  console.log(`  player.skillPoints: ${player.skillPoints}`);
  console.log(`  player.totalKills: ${player.totalKills}`);
  console.log(`  player.bossesKilled: ${player.bossesKilled}`);
  console.log(`  player.unlockedSkills: ${JSON.stringify(player.unlockedSkills)}`);
  console.log(`  player.unlockedWeapons: ${JSON.stringify(player.unlockedWeapons)}`);
  console.log(`  player.currentWeapon: ${player.currentWeapon}`);
  console.log(`  player.abilities: ${JSON.stringify(player.abilities)}`);
  console.log(`  player.collectedCollectibles: ${JSON.stringify(player.collectedCollectibles)}`);
  console.log(`  player.openedShortcuts: ${JSON.stringify(player.openedShortcuts)}`);
  console.log(`  player.inventory: ${JSON.stringify(player.inventory)}`);
  console.log(`  questFlags: ${JSON.stringify(finalState.questFlags)}`);
  console.log(`  questProgress: ${JSON.stringify(finalState.questProgress)}`);
  console.log(`  npcFlags: ${JSON.stringify(finalState.npcFlags)}`);
  console.log(`  bestBossTimes: ${JSON.stringify(finalState.bestBossTimes)}`);
  console.log(`  unlockedAreas: ${JSON.stringify(finalState.unlockedAreas)}`);
  console.log(`  discoveredAreas: ${JSON.stringify(finalState.discoveredAreas)}`);
  console.log(`  settings.brightness: ${(finalState.settings as Record<string, unknown>).brightness}`);
  console.log(`  settings.muted: ${(finalState.settings as Record<string, unknown>).muted}`);
  console.log(`  settings.masterVolume: ${(finalState.settings as Record<string, unknown>).masterVolume}`);
}

main().catch((err) => {
  console.error('=== BASELINE CAPTURE FAILED ===');
  console.error(err);
  process.exit(1);
});
