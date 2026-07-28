/**
 * A4: Split Act II (drowned_wastes_1) into 3 areas: wastes_1, wastes_2, wastes_3.
 *
 * Split plan (per advisor approval, 4-4-3 sections):
 *   wastes_1: sections 1-4 (6144px) — The Shore → Shallow Waters → The Fog → The Wreckage
 *   wastes_2: sections 5-7 (4608px) — The Approach → Submerged Hall → The Graveyard
 *   wastes_3: sections 8-10 (4608px) — The Shadow → The Vigil → Leviathan's Rest (boss)
 *
 * Coordinate rebasing:
 *   wastes_1: sections 1-4 keep x as-is (0, 1536, 3072, 4608) — already starts at 0
 *   wastes_2: sections 5-7 rebase by -6144 (6144→0, 7680→1536, 9216→3072)
 *   wastes_3: sections 8-10 rebase by -10752 (10752→0, 12288→1536, 13824→3072)
 *
 * All object coordinates (platforms, lore, landmarks, collectibles, hazards, shortcuts)
 * are rebased by the same offset.
 *
 * Per advisor round-12:
 *   - checkpointSections: [2,5,8] → [] (cleared, replaced by bonfires)
 *   - bonfires added (2 per area, isEntryPoint on first)
 *   - exitGates added (gate_wastes1_to_2, gate_wastes2_to_3)
 *   - dual naming: mechanical ID (wastes_1/2/3) + labelKey (the_shore, the_mire, leviathans_wake)
 *
 * NOTE: The lore_w8_shadow terminal (x=14400, in section 10's range) and
 * lm_w8_leviathan_silhouette (x=12928, in section 9's range) are INTENTIONAL
 * cross-section placements (per Stage 1.6a audit). After rebase:
 *   - lore_w8_shadow: 14400 - 10752 = 3648 (in wastes_3's section 3, which is original section 10)
 *   - lm_w8_leviathan_silhouette: 12928 - 10752 = 2176 (in wastes_3's section 2, which is original section 9)
 * Both remain in the SAME relative position within wastes_3 — the cross-section
 * narrative timing is preserved (they're just in different "section" numbers now,
 * but still visually appear at the same world position relative to the player's path).
 */

import * as fs from 'fs';

const ACTS_FILE = '/home/z/my-project/src/game/data/acts/acts.ts';
const content = fs.readFileSync(ACTS_FILE, 'utf8');

// Find the Act II block (from "id: 'drowned_wastes_1'" to the closing of its area object)
// We need to replace the entire area object with 3 new area objects.

const startMarker = "            id: 'drowned_wastes_1',";
const endMarker = "            ],\n          },\n        ],\n      },\n    ],\n  },\n\n  // ═══════════════════════════════════════════════════════════════\n  // Act III";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find Act II markers');
  process.exit(1);
}

// The area block starts a few lines before startMarker (the opening brace + id)
// Let's find the opening brace
const areaStart = content.lastIndexOf('{\n', startIdx);
const areaEnd = endIdx + "            ],\n          },".length;

const oldAreaBlock = content.substring(areaStart, areaEnd);
console.log('Old area block length:', oldAreaBlock.length);
console.log('First 100 chars:', oldAreaBlock.substring(0, 100));
console.log('Last 100 chars:', oldAreaBlock.substring(oldAreaBlock.length - 100));

// Now build the 3 new areas
// We need to rebase coordinates for each area

// Helper: rebase a coordinate by subtracting offset
function rebase(x: number, offset: number): number {
  return x - offset;
}

// wastes_1: sections 1-4, offset = 0 (no rebase needed, starts at 0)
// wastes_2: sections 5-7, offset = 6144
// wastes_3: sections 8-10, offset = 10752

// For now, just output the plan — actual rebase will be done via direct file editing
// since the data is too complex for string manipulation in a script.

console.log('\n=== Split Plan ===');
console.log('wastes_1: sections 1-4, totalWidth=6144, sectionWidth=1536');
console.log('wastes_2: sections 5-7, totalWidth=4608, sectionWidth=1536');
console.log('wastes_3: sections 8-10, totalWidth=4608, sectionWidth=1536');
console.log('\nRebase offsets:');
console.log('wastes_1: 0 (no rebase)');
console.log('wastes_2: 6144');
console.log('wastes_3: 10752');
