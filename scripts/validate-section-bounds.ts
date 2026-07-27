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

// ── C6: Exit Gate reference validation ──
// Per advisor round-5 Note 4 (preventive): check that every exitGate.toAreaId
// actually exists in ACTS data, and toSection is within valid range of that area.
// Prevents "gate to nowhere" bugs that only manifest when player physically
// reaches the gate and tries to cross (same class as TOAST — silent failure).
console.log('\n── Exit Gate Reference Validation (C6) ──');
import { getArea } from '../src/game/data/acts/acts';

interface GateRefIssue {
  sourceArea: string;
  gateId: string;
  toAreaId: string;
  toSection: number;
  severity: 'ERROR' | 'WARN';
  message: string;
}

const gateRefIssues: GateRefIssue[] = [];
let gatesChecked = 0;

for (const act of ACTS) {
  for (const region of act.regions) {
    for (const area of region.areas) {
      for (const section of area.sections) {
        if (!section.exitGates) continue;
        for (const gate of section.exitGates) {
          gatesChecked++;
          const destArea = getArea(gate.toAreaId);
          if (!destArea) {
            gateRefIssues.push({
              sourceArea: area.id,
              gateId: gate.id,
              toAreaId: gate.toAreaId,
              toSection: gate.toSection,
              severity: 'ERROR',
              message: `toAreaId "${gate.toAreaId}" does not exist in ACTS data`,
            });
            continue;
          }
          // Check toSection is within valid range [1, destArea.sections.length]
          const maxSection = destArea.sections.length;
          if (gate.toSection < 1 || gate.toSection > maxSection) {
            gateRefIssues.push({
              sourceArea: area.id,
              gateId: gate.id,
              toAreaId: gate.toAreaId,
              toSection: gate.toSection,
              severity: 'ERROR',
              message: `toSection ${gate.toSection} out of range [1, ${maxSection}] for area "${gate.toAreaId}"`,
            });
          }
          // Check toX/toY are within destination area bounds
          if (gate.toX < 0 || gate.toX > destArea.totalWidth) {
            gateRefIssues.push({
              sourceArea: area.id,
              gateId: gate.id,
              toAreaId: gate.toAreaId,
              toSection: gate.toSection,
              severity: 'ERROR',
              message: `toX ${gate.toX} out of range [0, ${destArea.totalWidth}] for area "${gate.toAreaId}"`,
            });
          }
          if (gate.toY < 0 || gate.toY > 720) {  // GAME.HEIGHT = 720
            gateRefIssues.push({
              sourceArea: area.id,
              gateId: gate.id,
              toAreaId: gate.toAreaId,
              toSection: gate.toSection,
              severity: 'WARN',
              message: `toY ${gate.toY} out of range [0, 720] for area "${gate.toAreaId}" — may spawn off-screen`,
            });
          }
        }
      }
    }
  }
}

console.log(`Checked ${gatesChecked} exit gate references.`);
console.log(`Gate ref issues: ${gateRefIssues.filter(i => i.severity === 'ERROR').length} ERROR, ${gateRefIssues.filter(i => i.severity === 'WARN').length} WARN\n`);

const gateErrors = gateRefIssues.filter(i => i.severity === 'ERROR');
const gateWarns = gateRefIssues.filter(i => i.severity === 'WARN');

if (gateErrors.length > 0) {
  console.log('❌ GATE ERRORS (broken exit gate references):');
  for (const e of gateErrors) {
    console.log(`  ${e.sourceArea} → gate "${e.gateId}": ${e.message}`);
  }
}

if (gateWarns.length > 0) {
  console.log('\n⚠️  GATE WARNINGS (suspicious but not fatal):');
  for (const w of gateWarns) {
    console.log(`  ${w.sourceArea} → gate "${w.gateId}": ${w.message}`);
  }
}

if (gateErrors.length === 0) {
  console.log('✅ PASS: All exit gate references valid.');
}

// ── Final exit code ──
const totalErrors = errors.length + gateErrors.length;
if (totalErrors > 0) {
  console.log(`\n❌ FAIL: ${totalErrors} total errors found.`);
  process.exit(1);
} else {
  console.log('\n✅ PASS: All validations passed.');
  process.exit(0);
}
