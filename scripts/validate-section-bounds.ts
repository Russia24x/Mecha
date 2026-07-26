/**
 * Section Bounds Validator — validates ALL areas in ALL acts.
 * Validates that no object has x-coordinate beyond the world width.
 * Objects beyond their own section's x-range are flagged as INFO.
 *
 * Per Stage 1.6a of OPTIMIZATION_PLAN.md (T7 test).
 * Updated for Bonfire+Multi-Area refactor: checks all areas.
 *
 * Run with: npx tsx scripts/validate-section-bounds.ts
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

// Validate ALL areas in ALL acts
for (const act of ACTS) {
  for (const region of act.regions) {
    for (const area of region.areas) {
      const worldWidth = area.totalWidth;
      const sectionWidth = area.sectionWidth;
      console.log(`\nValidating ${area.id}: worldWidth=${worldWidth}, sectionWidth=${sectionWidth}`);

      for (const section of area.sections) {
        const sectionLeft = section.x;
        const sectionRight = section.x + sectionWidth;

        const check = (x: number, field: string, id: string): void => {
          checked++;
          if (x < 0) {
            issues.push({ section: section.id, field, objectId: id, x, severity: 'ERROR', message: `x < 0 (world left boundary)` });
          } else if (x > worldWidth) {
            issues.push({ section: section.id, field, objectId: id, x, severity: 'ERROR', message: `x > ${worldWidth} (beyond world right boundary)` });
          } else if (x < sectionLeft || x > sectionRight) {
            issues.push({ section: section.id, field, objectId: id, x, severity: 'INFO', message: `x outside section [${sectionLeft}, ${sectionRight}] — verify intentional` });
          }
        };

        for (const p of section.platforms || []) check(p.x, 'platform', `p_${p.x}_${p.y}`);
        for (const l of section.loreObjects || []) check(l.x, 'loreObject', l.id);
        for (const lm of section.landmarks || []) check(lm.x, 'landmark', lm.id);
        for (const c of section.collectibles || []) check(c.x, 'collectible', c.id);
        for (const s of section.shortcuts || []) check(s.x, 'shortcut', s.id);
        for (const g of section.grappleAnchors || []) check(g.x, 'grappleAnchor', g.id);
        for (const e of section.empDoors || []) check(e.x, 'empDoor', e.id);
        for (const h of section.hazards || []) check(h.x, 'hazard', `hazard_${h.type}_${h.x}`);
        for (const bf of section.bonfires || []) check(bf.x, 'bonfire', bf.id);
        for (const eg of section.exitGates || []) check(eg.x, 'exitGate', eg.id);
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
  for (const e of errors) console.log(`  Section ${e.section} | ${e.field} "${e.objectId}": x=${e.x}, ${e.message}`);
}

if (infos.length > 0) {
  console.log('\nℹ️  INFO (objects outside their section — verify intentional):');
  for (const i of infos) console.log(`  ${i.field} "${i.objectId}": x=${i.x}, ${i.message}`);
}

if (errors.length > 0) {
  console.log('\n❌ FAIL: Objects beyond world bounds found.');
  process.exit(1);
} else {
  console.log('\n✅ PASS: No objects beyond world bounds.');
  process.exit(0);
}
