/**
 * Hazard Cull Dimensions Validator — lightweight standalone script.
 * Verifies that every createHazardVisual() implementation in all 3 area
 * strategies (Wastes/Factory/Forest) calls container.setSize() so that
 * VisualCuller can use bounding-box culling.
 *
 * Per Stage 1.1a of OPTIMIZATION_PLAN.md (T3 test).
 *
 * Run with: npx tsx scripts/validate-hazard-cull-dims.ts
 *
 * No Phaser dependency — reads strategy source files as text and checks
 * for the setSize() call pattern within the createHazardVisual method.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface StrategyCheck {
  file: string;
  hasCreateHazardVisual: boolean;
  hasSetSizeInHazard: boolean;
  details: string;
}

const strategies: StrategyCheck[] = [
  { file: 'src/game/world/strategies/WastesAreaStrategy.ts', hasCreateHazardVisual: false, hasSetSizeInHazard: false, details: '' },
  { file: 'src/game/world/strategies/FactoryAreaStrategy.ts', hasCreateHazardVisual: false, hasSetSizeInHazard: false, details: '' },
  { file: 'src/game/world/strategies/ForestAreaStrategy.ts', hasCreateHazardVisual: false, hasSetSizeInHazard: false, details: '' },
];

let allPassed = true;

for (const strat of strategies) {
  const filePath = resolve(process.cwd(), strat.file);
  const src = readFileSync(filePath, 'utf8');

  // Check that createHazardVisual method exists
  strat.hasCreateHazardVisual = src.includes('createHazardVisual(');

  if (!strat.hasCreateHazardVisual) {
    strat.details = '❌ createHazardVisual method NOT FOUND';
    allPassed = false;
    continue;
  }

  // Find the createHazardVisual method body.
  // Strategy: find 'createHazardVisual(' then find the matching closing
  // brace by counting { and } from the method's opening brace.
  const methodStart = src.indexOf('createHazardVisual(');
  if (methodStart === -1) {
    strat.details = '❌ createHazardVisual method NOT FOUND';
    allPassed = false;
    continue;
  }

  // Find the opening brace of the method body
  const openBrace = src.indexOf('{', methodStart);
  if (openBrace === -1) {
    strat.details = '❌ createHazardVisual has no opening brace';
    allPassed = false;
    continue;
  }

  // Count braces to find the matching close
  let depth = 0;
  let methodEnd = -1;
  for (let i = openBrace; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        methodEnd = i;
        break;
      }
    }
  }

  if (methodEnd === -1) {
    strat.details = '❌ createHazardVisual has no matching close brace';
    allPassed = false;
    continue;
  }

  const methodBody = src.slice(openBrace, methodEnd);

  // Check that container.setSize(hazard.w, hazard.h) is called in the method body.
  // Allow for any whitespace pattern.
  const setSizePattern = /container\.setSize\s*\(\s*hazard\.w\s*,\s*hazard\.h\s*\)/;
  strat.hasSetSizeInHazard = setSizePattern.test(methodBody);

  if (!strat.hasSetSizeInHazard) {
    strat.details = '❌ createHazardVisual exists but does NOT call container.setSize(hazard.w, hazard.h)';
    allPassed = false;
  } else {
    strat.details = '✅ createHazardVisual calls container.setSize(hazard.w, hazard.h)';
  }
}

console.log('Hazard Cull Dimensions Validator (T3)\n');
console.log('Checking 3 area strategies for proper cull-dimension setup:\n');

for (const strat of strategies) {
  console.log(`  ${strat.file}`);
  console.log(`    ${strat.details}\n`);
}

if (allPassed) {
  console.log('✅ PASS: All 3 strategies set hazard cull dimensions correctly.');
  process.exit(0);
} else {
  console.log('❌ FAIL: Some strategies are missing setSize calls.');
  process.exit(1);
}

