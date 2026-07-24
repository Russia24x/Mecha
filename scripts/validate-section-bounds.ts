/**
 * Section Bounds Validator — lightweight standalone script.
 * Validates that no object in any Act II Wastes section has x-coordinate
 * beyond the WORLD width. Objects beyond their own section's x-range are
 * allowed (intentional distant silhouettes, lore references, etc.) but
 * flagged as INFO for review.
 *
 * Per Stage 1.6a of OPTIMIZATION_PLAN.md (T7 test).
 *
 * Run with: npx tsx scripts/validate-section-bounds.ts
 *
 * No Phaser dependency — reads acts.ts as a module.
 */
import { ACTS } from '../src/game/data/acts/acts';

interface ValidationIssue {
  section: number;
  field: string;
  objectId: string;
  x: number;
  severity: 'ERROR' | 'INFO';
  message: string;
}

const issues: ValidationIssue[] = [];
let checked = 0;

// Find the Wastes area in Act II
for (const act of ACTS) {
  if (act.id !== 2) continue;
  for (const region of act.regions) {
    if (region.id !== 'wastes') continue;
    for (const area of region.areas) {
      if (area.id !== 'drowned_wastes_1') continue;

      const worldWidth = area.totalWidth;
      const sectionWidth = area.sectionWidth;
      console.log(`\nValidating ${area.id}: worldWidth=${worldWidth}, sectionWidth=${sectionWidth}`);

      for (const section of area.sections) {
        const sectionLeft = section.x;
        const sectionRight = section.x + sectionWidth;

        const check = (x: number, field: string, id: string): void => {
          checked++;
          if (x < 0) {
            issues.push({
              section: section.id, field, objectId: id, x,
              severity: 'ERROR',
              message: `x < 0 (world left boundary)`
            });
          } else if (x > worldWidth) {
            issues.push({
              section: section.id, field, objectId: id, x,
              severity: 'ERROR',
              message: `x > ${worldWidth} (beyond world right boundary)`
            });
          } else if (x < sectionLeft || x > sectionRight) {
            // Object is in another section's x-range — flag as INFO
            // (could be intentional: distant silhouettes, cross-section barriers)
            issues.push({
              section: section.id, field, objectId: id, x,
              severity: 'INFO',
              message: `x outside section [${sectionLeft}, ${sectionRight}] — verify intentional`
            });
          }
        };

        // Check all object types
        for (const p of section.platforms || []) check(p.x, 'platform', `p_${p.x}_${p.y}`);
        for (const l of section.loreObjects || []) check(l.x, 'loreObject', l.id);
        for (const lm of section.landmarks || []) check(lm.x, 'landmark', lm.id);
        for (const c of section.collectibles || []) check(c.x, 'collectible', c.id);
        for (const s of section.shortcuts || []) check(s.x, 'shortcut', s.id);
        for (const g of section.grappleAnchors || []) check(g.x, 'grappleAnchor', g.id);
        for (const e of section.empDoors || []) check(e.x, 'empDoor', e.id);
        for (const h of section.hazards || []) check(h.x, 'hazard', `hazard_${h.type}_${h.x}`);
      }
    }
  }
}

console.log(`\nChecked ${checked} object positions.`);
console.log(`Issues: ${issues.filter(i => i.severity === 'ERROR').length} ERROR, ${issues.filter(i => i.severity === 'INFO').length} INFO\n`);

const errors = issues.filter(i => i.severity === 'ERROR');
const infos = issues.filter(i => i.severity === 'INFO');

if (errors.length > 0) {
  console.log('❌ ERRORS (objects beyond world bounds):');
  for (const e of errors) {
    console.log(`  Section ${e.section} | ${e.field} "${e.objectId}": x=${e.x}, ${e.message}`);
  }
}

if (infos.length > 0) {
  console.log('\nℹ️  INFO (objects outside their section — verify intentional):');
  for (const i of infos) {
    console.log(`  Section ${i.section} | ${i.field} "${i.objectId}": x=${i.x}, ${i.message}`);
  }
}

// Exit code: 0 = no errors, 1 = errors found
if (errors.length > 0) {
  console.log('\n❌ FAIL: Objects beyond world bounds found.');
  process.exit(1);
} else {
  console.log('\n✅ PASS: No objects beyond world bounds.');
  process.exit(0);
}

