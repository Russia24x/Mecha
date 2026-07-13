/**
 * MECHA: LAST PROTOCOL — World Structure v2.0
 *
 * CINEMATIC LEVEL DESIGN per Design Pillars + Player Experience Bible.
 *
 * Act I: The Fallen Foundry — redesigned with:
 * - Verticality (multi-level platforms, shafts, ledges)
 * - Branching paths (upper route + lower route)
 * - Ability-gated areas (wall jump shaft, double jump gap)
 * - Shortcuts (one-way drops from upper to lower)
 * - Environmental storytelling at every turn
 * - Dense world (lore, landmarks, hazards, secrets)
 *
 * Pacing (per Player Experience Bible):
 *   S1: Awakening (0:00) — silence, learning movement
 *   S2: First Combat (0:07) — single drone, cover platforms
 *   S3: Vertical Shaft (0:15) — wall jump tutorial, spikes, secret
 *   S4: Assembly Hall (0:25) — combat room + mini boss
 *   S5: Checkpoint (0:35) — safe room, guardian at door
 *   S6: Boss Arena (0:45) — Guardian AX-09
 */
import type { ActData, AreaData } from '../types';

export const ACTS: ActData[] = [
  {
    id: 1,
    nameKey: 'act.1.name',
    regions: [
      {
        id: 'factory',
        nameKey: 'region.factory.name',
        areas: [
          {
            id: 'abandoned_factory',
            nameKey: 'area.abandoned_factory.name',
            regionId: 'factory',
            totalWidth: 7680,
            sectionWidth: 1280,
            bgColor: 0x05070d,
            checkpointSections: [2, 5],
            unlockedByDefault: true,
            sections: [
              // ═══════════════════════════════════════════════════════════════
              // Section 1: AWAKENING (0:00-0:05)
              // Moment 1: Darkness. Moment 2: Dust. Moment 3: First corpse.
              // Design: Wide open, quiet. Player learns walk + jump.
              // Visual: Dark, single emergency light, dust motes.
              // ═══════════════════════════════════════════════════════════════
              { id: 1, nameKey: 'section.1.name', x: 0, enemies: [], platforms: [
                // Entry — flat ground, simple stepping stones
                { x: 400, y: 560, w: 200, h: 20 },
                { x: 700, y: 460, w: 160, h: 20 },
                { x: 980, y: 540, w: 140, h: 20 },
                // Upper ledge (double jump reachable — secret area)
                { x: 550, y: 280, w: 120, h: 20 },
                { x: 780, y: 180, w: 80, h: 20 },
                // ── FIX: Far wall has a GAP where the shortcut door sits ──
                // Wall TOP section (above shortcut gap)
                { x: 1200, y: 360, w: 40, h: 200 },   // y=260 to y=460
                // Wall BOTTOM section (below shortcut gap)
                { x: 1200, y: 600, w: 40, h: 120 },   // y=540 to y=660
                // GAP is at y=460 to y=540 — shortcut door fills this gap
                // When shortcut opens, player can walk through to S6
                // Platform on the S6 side (so player doesn't fall)
                { x: 1260, y: 500, w: 40, h: 20 },
              ], loreObjects: [
                { id: 'lore_s1_corpse', type: 'corpse', x: 300, y: 660, titleKey: 'lore.s1.corpse.title', textKey: 'lore.s1.corpse.text' },
                // Secret lore on upper ledge (requires double jump)
                { id: 'lore_s1_secret', type: 'terminal', x: 580, y: 260, titleKey: 'lore.s1.secret.title', textKey: 'lore.s1.secret.text' },
              ], landmarks: [
                { id: 'lm_s1_mech', type: 'crashed_mech', x: 150, y: 580, w: 140, h: 110, color: 0x2a3040 },
              ], collectibles: [
                // Health fragment on upper secret ledge (requires double jump)
                { id: 'col_s1_health', type: 'health_fragment', x: 780, y: 150, requiredAbility: 'doubleJump' },
              ], shortcuts: [
                // ── FIX: Shortcut sits in the GAP of the far wall (y=460-540) ──
                // When closed: blocks passage to S6. When opened: player walks through.
                // opensFrom 'right' = player must approach from the S6 side (post-boss) to open it.
                { id: 'sc_s6_to_s1', x: 1200, y: 500, w: 40, h: 80, toSection: 6, opensFrom: 'right' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 2: FIRST COMBAT (0:05-0:12)
              // Moment 4: First drone. Moment 5: Kara's terminal.
              // Design: Cover platforms, vertical combat space.
              // Visual: Flickering overhead lights, oil stains.
              // ═══════════════════════════════════════════════════════════════
              { id: 2, nameKey: 'section.2.name', x: 1280, enemies: ['drone'], platforms: [
                // Ground level cover
                { x: 1480, y: 520, w: 100, h: 20 },
                { x: 1700, y: 420, w: 140, h: 20 },
                { x: 2000, y: 520, w: 100, h: 20 },
                { x: 2300, y: 460, w: 120, h: 20 },
                // Upper catwalk (alternate route)
                { x: 1500, y: 260, w: 300, h: 16 },
                { x: 2100, y: 260, w: 200, h: 16 },
                // Connecting wall (wall jump surface)
                { x: 1820, y: 340, w: 40, h: 200 },
                // ── FIX: Right boundary wall with GAP for shortcut ──
                // Wall TOP (above shortcut gap)
                { x: 2540, y: 360, w: 40, h: 200 },   // y=260 to y=460
                // Wall BOTTOM (below shortcut gap)
                { x: 2540, y: 600, w: 40, h: 120 },   // y=540 to y=660
                // GAP at y=460-540 — shortcut door fills this
                // Upper catwalk extension (connects to S4 upper route)
                { x: 2400, y: 500, w: 140, h: 16 },
              ], loreObjects: [
                { id: 'lore_s2_terminal', type: 'terminal', x: 2400, y: 580, titleKey: 'lore.s2.terminal.title', textKey: 'lore.s2.terminal.text' },
              ], hazards: [
                // Small spike pit — teaches hazard awareness
                { type: 'spike', x: 1920, y: 690, w: 80, h: 20, damage: 20 },
                // Molten metal pit (graphical lava hazard)
                { type: 'lava', x: 2200, y: 690, w: 80, h: 20, damage: 35 },
              ], collectibles: [
                // Energy fragment on upper catwalk (alternate route reward)
                { id: 'col_s2_energy', type: 'energy_fragment', x: 1600, y: 230 },
              ], shortcuts: [
                // ── FIX: Shortcut in the GAP of the right wall (y=460-540) ──
                // When closed: blocks upper route to S4. When opened: player walks through.
                // opensFrom 'left' = player approaches from S2 side (after coming from S4) to open it.
                { id: 'sc_s4_to_s2', x: 2540, y: 500, w: 40, h: 80, toSection: 4, opensFrom: 'left' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 3: VERTICAL SHAFT — OPTIONAL SECRET (0:12-0:22)
              // ── FIX Bug 6: wallJump is NOT required for main progress ──
              // Main route: walk along the lower floor past the shaft to the right exit.
              // Optional secret: wall jump (or grapple) up the shaft for a skill point + lore.
              // The shaft is a reward for skilled players, not a gate.
              // ═══════════════════════════════════════════════════════════════
              { id: 3, nameKey: 'section.3.name', x: 2560, enemies: ['drone'], platforms: [
                // Entry platform (main route — walk along the floor)
                { x: 2660, y: 580, w: 200, h: 20 },
                // Shaft — two facing walls (wall jumpable, but OPTIONAL)
                { x: 2800, y: 380, w: 40, h: 280 },  // shorter walls — player can walk under
                { x: 3100, y: 380, w: 40, h: 280 },
                // Mid-shelf (resting point during wall jump — optional)
                { x: 2950, y: 320, w: 100, h: 16 },
                // Top ledge (wall jump reward — optional secret)
                { x: 2950, y: 200, w: 120, h: 16 },
                // Hidden platform (requires double jump from top ledge — optional)
                { x: 2750, y: 100, w: 80, h: 16 },
                // MAIN ROUTE exit (lower level — no wallJump needed)
                { x: 3300, y: 580, w: 200, h: 20 },
                { x: 3540, y: 540, w: 140, h: 20 },
                // Upper exit (optional — for those who wall-jumped up)
                { x: 3300, y: 380, w: 140, h: 20 },
              ], hazards: [
                // Spike pit ONLY at the bottom of the shaft (not blocking main route)
                { type: 'spike', x: 2850, y: 690, w: 240, h: 20, damage: 30 },
              ], loreObjects: [
                { id: 'lore_s3_echo', type: 'echo', x: 2780, y: 80, titleKey: 'lore.s3.echo.title', textKey: 'lore.s3.echo.text' },
                { id: 'lore_s3_secret', type: 'terminal', x: 2760, y: 80, titleKey: 'lore.s3.secret.title', textKey: 'lore.s3.secret.text' },
              ], grappleAnchors: [
                // Grapple anchors — placed high to enable grapple-reach to secret area
                { id: 'grapple_s3_1', x: 2950, y: 60 },
                { id: 'grapple_s3_2', x: 3400, y: 220 },
              ], collectibles: [
                // Skill point at the top of the shaft (OPTIONAL — requires wall jump or grapple)
                { id: 'col_s3_skill', type: 'skill_point', x: 2760, y: 50, requiredAbility: 'wallJump' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 4: ASSEMBLY HALL + MINI BOSS (0:22-0:35)
              // Moment 6: Emergency lights reveal assembly hall.
              // Design: Wide hall with pillars. Mini boss (Elite) center.
              // Upper ledge with secret corpse (wall jump from pillar).
              // ═══════════════════════════════════════════════════════════════
              { id: 4, nameKey: 'section.4.name', x: 3840, enemies: ['spider', 'heavy'], platforms: [
                // Tall pillars (wall jump surfaces + cover)
                { x: 4240, y: 440, w: 40, h: 260 },
                { x: 4680, y: 440, w: 40, h: 260 },
                // Center platform (elevated combat position)
                { x: 4440, y: 380, w: 100, h: 20 },
                // Side ledges
                { x: 4040, y: 480, w: 80, h: 20 },
                { x: 4900, y: 480, w: 80, h: 20 },
                // Upper hidden ledge (wall jump from pillar — secret)
                { x: 4360, y: 220, w: 80, h: 16 },
                // Upper catwalk (alternate route, connects to S5 upper)
                { x: 4100, y: 160, w: 200, h: 16 },
                { x: 4800, y: 160, w: 200, h: 16 },
                // ── FIX: EMP-gated secret room (right side, blocked by vertical door) ──
                // Secret room floor
                { x: 5000, y: 380, w: 120, h: 20 },
                // Secret room walls (TOP + BOTTOM of door gap)
                { x: 5000, y: 240, w: 20, h: 200 },  // left wall top (y=140-340)
                // GAP at y=340-380 — EMP door fills this
                // Secret room ceiling
                { x: 5000, y: 140, w: 120, h: 16 },
              ], loreObjects: [
                { id: 'lore_s4_terminal', type: 'terminal', x: 4100, y: 580, titleKey: 'lore.s4.terminal.title', textKey: 'lore.s4.terminal.text' },
                { id: 'lore_s4_corpse', type: 'corpse', x: 4380, y: 200, titleKey: 'lore.s4.corpse.title', textKey: 'lore.s4.corpse.text' },
              ], landmarks: [
                { id: 'lm_s4_assembly', type: 'assembly_line', x: 4460, y: 500, w: 240, h: 100, color: 0x2a3040 },
              ], hazards: [
                // Laser beam hazard (graphical energy beam)
                { type: 'laser', x: 4440, y: 340, w: 200, h: 4, damage: 25 },
              ], empDoors: [
                // ── FIX: EMP door is VERTICAL, blocks entry to secret room ──
                // When closed: blocks passage to secret room. When opened (EMP): player enters.
                { id: 'empdoor_s4_1', x: 5000, y: 360, w: 20, h: 40, },
              ], collectibles: [
                // Health fragment INSIDE the EMP-gated secret room
                { id: 'col_s4_health', type: 'health_fragment', x: 5060, y: 350, requiredAbility: 'emp' },
                // Weapon part on the upper catwalk (alternate route)
                { id: 'col_s4_weapon', type: 'weapon_part', x: 4900, y: 130, requiredAbility: 'wallJump' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 5: CHECKPOINT — GUARDIAN AT THE DOOR (0:35-0:42)
              // Moment 7: Guardian still standing at open door to nothing.
              // Moment 8: PA system looping.
              // Design: Quiet safe room. Guardian silhouette at far end.
              // ═══════════════════════════════════════════════════════════════
              { id: 5, nameKey: 'section.5.name', x: 5120, enemies: [], platforms: [
                // Safe ground
                { x: 5360, y: 560, w: 200, h: 20 },
                // Elevated vantage point
                { x: 5700, y: 400, w: 120, h: 20 },
                // Guardian pedestal (where it stands)
                { x: 6100, y: 540, w: 80, h: 60 },
                // Door frame walls (open doorway to nothing)
                { x: 6200, y: 300, w: 40, h: 300 },
                { x: 6360, y: 300, w: 40, h: 300 },
              ], loreObjects: [
                { id: 'lore_s5_echo', type: 'echo', x: 5600, y: 580, titleKey: 'lore.s5.echo.title', textKey: 'lore.s5.echo.text' },
                { id: 'lore_s5_terminal', type: 'terminal', x: 5900, y: 580, titleKey: 'lore.s5.terminal.title', textKey: 'lore.s5.terminal.text' },
              ], landmarks: [
                // Guardian silhouette — standing at the open door
                { id: 'lm_s5_guardian', type: 'tower', x: 6100, y: 400, w: 50, h: 200, color: 0x1a2030 },
              ], collectibles: [
                // Energy fragment on the elevated vantage point
                { id: 'col_s5_energy', type: 'energy_fragment', x: 5700, y: 370 },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 6: BOSS ARENA — GUARDIAN AX-09 (0:42-0:55)
              // Moment 9: Atlas kneels. Moment 10: Horizon view.
              // Design: Wide arena. Walls for wall jump. Cover platforms.
              // ═══════════════════════════════════════════════════════════════
              { id: 6, nameKey: 'section.6.name', x: 6400, enemies: [], bossId: 'guardian_ax09', platforms: [
                // Arena walls (prevent retreat + wall jump surfaces)
                { x: 6480, y: 420, w: 40, h: 260 },
                { x: 7600, y: 420, w: 40, h: 260 },
                // Cover platforms (symmetrical)
                { x: 6800, y: 520, w: 100, h: 20 },
                { x: 7280, y: 520, w: 100, h: 20 },
                // Upper platforms (wall jump → safe spot)
                { x: 6700, y: 320, w: 80, h: 16 },
                { x: 7380, y: 320, w: 80, h: 16 },
              ], loreObjects: [
                { id: 'lore_s6_corpse', type: 'corpse', x: 6550, y: 580, titleKey: 'lore.s6.corpse.title', textKey: 'lore.s6.corpse.text' },
                { id: 'lore_s6_terminal', type: 'terminal', x: 7450, y: 580, titleKey: 'lore.s6.terminal.title', textKey: 'lore.s6.terminal.text' },
              ], landmarks: [
                { id: 'lm_s6_door', type: 'tower', x: 6440, y: 280, w: 80, h: 440, color: 0x3a3040 },
              ], collectibles: [
                // Skill point reward on the upper safe spot (wall jump required)
                { id: 'col_s6_skill', type: 'skill_point', x: 6700, y: 290, requiredAbility: 'wallJump' },
              ]},
            ],
          },
        ],
      },
      // ═══════════════════════════════════════════════════════════════
      // TOXIC FOREST — v2.0: Full content (was empty desert)
      // Theme: Nature reclaiming the ruins. Silence. Green.
      // ═══════════════════════════════════════════════════════════════
      {
        id: 'forest',
        nameKey: 'region.forest.name',
        areas: [
          {
            id: 'toxic_forest',
            nameKey: 'area.toxic_forest.name',
            regionId: 'forest',
            totalWidth: 7680,
            sectionWidth: 1280,
            bgColor: 0x0a1208,
            checkpointSections: [2, 5],
            unlockedByDefault: false,
            sections: [
              // S1: Forest entrance — quiet, overgrown
              { id: 1, nameKey: 'section.forest.1.name', x: 0, enemies: ['flying_ai'], platforms: [
                { x: 300, y: 540, w: 160, h: 20 },
                { x: 600, y: 440, w: 140, h: 20 },
                { x: 900, y: 540, w: 160, h: 20 },
                { x: 500, y: 280, w: 100, h: 16 },
              ], loreObjects: [
                { id: 'lore_f1_corpse', type: 'corpse', x: 400, y: 660, titleKey: 'lore.f1.corpse.title', textKey: 'lore.f1.corpse.text' },
              ], landmarks: [
                { id: 'lm_f1_mech', type: 'crashed_mech', x: 150, y: 580, w: 120, h: 100, color: 0x1a2818 },
              ]},
              // S2: Overgrown combat
              { id: 2, nameKey: 'section.forest.2.name', x: 1280, enemies: ['flying_ai', 'flying_ai', 'spider'], platforms: [
                { x: 1480, y: 520, w: 100, h: 20 },
                { x: 1700, y: 420, w: 140, h: 20 },
                { x: 2000, y: 520, w: 100, h: 20 },
                { x: 2300, y: 460, w: 120, h: 20 },
              ], loreObjects: [
                { id: 'lore_f2_terminal', type: 'terminal', x: 2400, y: 580, titleKey: 'lore.f2.terminal.title', textKey: 'lore.f2.terminal.text' },
              ]},
              // S3: Root maze — vertical platforming
              { id: 3, nameKey: 'section.forest.3.name', x: 2560, enemies: ['spider'], platforms: [
                { x: 2660, y: 580, w: 200, h: 20 },
                { x: 2800, y: 400, w: 40, h: 360 },
                { x: 3100, y: 400, w: 40, h: 360 },
                { x: 2950, y: 240, w: 100, h: 16 },
                { x: 2750, y: 140, w: 80, h: 16 },
                { x: 3300, y: 520, w: 140, h: 20 },
                { x: 3540, y: 440, w: 140, h: 20 },
              ], hazards: [
                { type: 'spike', x: 2850, y: 690, w: 240, h: 20, damage: 25 },
              ], loreObjects: [
                { id: 'lore_f3_echo', type: 'echo', x: 2780, y: 120, titleKey: 'lore.f3.echo.title', textKey: 'lore.f3.echo.text' },
              ]},
              // S4: Mini boss
              { id: 4, nameKey: 'section.forest.4.name', x: 3840, enemies: ['spider', 'spider', 'heavy'], platforms: [
                { x: 4240, y: 460, w: 40, h: 220 },
                { x: 4680, y: 460, w: 40, h: 220 },
                { x: 4440, y: 400, w: 100, h: 20 },
                { x: 4040, y: 480, w: 80, h: 20 },
                { x: 4900, y: 480, w: 80, h: 20 },
                { x: 4360, y: 260, w: 60, h: 16 },
              ], landmarks: [
                { id: 'lm_f4_assembly', type: 'assembly_line', x: 4460, y: 500, w: 200, h: 80, color: 0x1a2818 },
              ]},
              // S5: Checkpoint
              { id: 5, nameKey: 'section.forest.5.name', x: 5120, enemies: [], platforms: [
                { x: 5360, y: 560, w: 140, h: 20 },
                { x: 5700, y: 420, w: 120, h: 20 },
              ], loreObjects: [
                { id: 'lore_f5_echo', type: 'echo', x: 5600, y: 580, titleKey: 'lore.f5.echo.title', textKey: 'lore.f5.echo.text' },
              ]},
              // S6: Boss arena — Neural Overseer
              { id: 6, nameKey: 'section.forest.6.name', x: 6400, enemies: [], bossId: 'neural_overseer', platforms: [
                { x: 6480, y: 440, w: 40, h: 240 },
                { x: 7600, y: 440, w: 40, h: 240 },
                { x: 6800, y: 520, w: 80, h: 20 },
                { x: 7280, y: 520, w: 80, h: 20 },
              ], landmarks: [
                { id: 'lm_f6_door', type: 'tower', x: 6440, y: 300, w: 60, h: 400, color: 0x2a3818 },
              ]},
            ],
          },
        ],
      },
    ],
  },
];

export function getAct(id: number): ActData | undefined {
  return ACTS.find(a => a.id === id);
}

export function getArea(areaId: string): AreaData | undefined {
  for (const act of ACTS) {
    for (const region of act.regions) {
      for (const area of region.areas) {
        if (area.id === areaId) return area;
      }
    }
  }
  return undefined;
}

export function getAllAreas(): AreaData[] {
  const areas: AreaData[] = [];
  for (const act of ACTS) {
    for (const region of act.regions) {
      areas.push(...region.areas);
    }
  }
  return areas;
}
