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

/**
 * MECHA: LAST PROTOCOL — World Structure v3.0
 *
 * 5 Acts × 3 Areas = 15 total areas (per WORLD_BIBLE)
 *
 * Act I   — The Fallen Foundry   (کارخانه سقوط‌کرده)     → factory
 * Act II  — The Drowned Wastes   (باتلاق غرق‌شده)        → wastes (placeholder)
 * Act III — The Last City        (آخرین شهر)             → city (placeholder)
 * Act IV  — The Silent Canopy    (سایه‌آرام)              → forest
 * Act V   — Orbital Descent      (نزول مداری)             → orbital (placeholder)
 *
 * Architecture: data-driven, easily reorderable.
 * Moving an area to a different Act = moving one block in this file.
 * Adding a new Act = adding one ActData entry.
 */
export const ACTS: ActData[] = [
  // ═══════════════════════════════════════════════════════════════
  // Act I — THE FALLEN FOUNDRY (کارخانه سقوط‌کرده)
  // Theme: سقوط | Player Learns: دنیا مرده است | Boss: Guardian AX-09
  // ═══════════════════════════════════════════════════════════════
  {
    id: 1,
    nameKey: 'act.1.name',
    regions: [
            {
        id: 'factory',
        nameKey: 'region.factory.name',
        areas: [
          // ═══════════════════════════════════════════════════════════════
          // Area 1: factory_1 — Sections 1-2 (Awakening + First Combat)
          // bg: factory_bg_1
          // ═══════════════════════════════════════════════════════════════
          {
            id: 'factory_1',
            nameKey: 'area.factory_1.name',
            regionId: 'factory',
            totalWidth: 3072,
            sectionWidth: 1536,
            bgColor: 0x05070d,
            checkpointSections: [],
            unlockedByDefault: true,
            sections: [
              // S1: AWAKENING (0:00-0:05) — Memory: first mech corpse
              { id: 1, nameKey: 'section.1.name', x: 0, enemies: [], platforms: [
                { x: 300, y: 560, w: 180, h: 24 },
                { x: 620, y: 500, w: 120, h: 20 },
                { x: 860, y: 560, w: 160, h: 24 },
                { x: 520, y: 360, w: 200, h: 16 },
                { x: 900, y: 300, w: 140, h: 16 },
                { x: 1440, y: 380, w: 40, h: 180 },
                { x: 1440, y: 540, w: 40, h: 160 },
              ], loreObjects: [
                { id: 'lore_s1_corpse', type: 'corpse', x: 360, y: 660, titleKey: 'lore.s1.corpse.title', textKey: 'lore.s1.corpse.text' },
                { id: 'lore_s1_secret', type: 'terminal', x: 700, y: 260, titleKey: 'lore.s1.secret.title', textKey: 'lore.s1.secret.text' },
              ], landmarks: [
                { id: 'lm_s1_mech', type: 'crashed_mech', x: 180, y: 580, w: 140, h: 110, color: 0x2a3040 },
              ], collectibles: [
                { id: 'col_s1_health', type: 'health_fragment', x: 940, y: 150, requiredAbility: 'doubleJump' },
              ], bonfires: [
                { id: 'bf_factory1_1', x: 200, y: 540, section: 1, preLit: true, isEntryPoint: true },
              ], shortcuts: [
                { id: 'sc_s1_to_s2', x: 1440, y: 650, w: 40, h: 60, toSection: 2, opensFrom: 'left' },
              ]},

              // S2: FIRST COMBAT (0:05-0:12) — Memory: engineer terminal
              { id: 2, nameKey: 'section.2.name', x: 1536, enemies: ['drone', 'drone', 'drone', 'drone'], platforms: [
                { x: 1700, y: 540, w: 140, h: 20 },
                { x: 1960, y: 480, w: 100, h: 20 },
                { x: 2200, y: 540, w: 120, h: 20 },
                { x: 2480, y: 460, w: 140, h: 20 },
                { x: 2780, y: 520, w: 100, h: 20 },
                { x: 1900, y: 280, w: 200, h: 16 },
                { x: 2500, y: 260, w: 180, h: 16 },
              ], loreObjects: [
                { id: 'lore_s2_terminal', type: 'terminal', x: 2880, y: 580, titleKey: 'lore.s2.terminal.title', textKey: 'lore.s2.terminal.text' },
              ], collectibles: [
                { id: 'col_s2_energy', type: 'energy_fragment', x: 1920, y: 230, requiredAbility: 'doubleJump' },
              ], bonfires: [
                { id: 'bf_factory1_2', x: 2600, y: 580, section: 2 },
              ], exitGates: [
                { id: 'gate_factory1_to_2', x: 2850, y: 600, toAreaId: 'factory_2', toSection: 1, toX: 200, toY: 420, labelKey: 'gate.factory1_to_2.label' },
              ]},
            ],
          },

          // ═══════════════════════════════════════════════════════════════
          // Area 2: factory_2 — Sections 3-4 (Vertical Shaft + Assembly Hall)
          // bg: factory_bg_2
          // ═══════════════════════════════════════════════════════════════
          {
            id: 'factory_2',
            nameKey: 'area.factory_2.name',
            regionId: 'factory',
            totalWidth: 3072,
            sectionWidth: 1536,
            bgColor: 0x05070d,
            checkpointSections: [],
            unlockedByDefault: false,
            sections: [
              // S3: VERTICAL SHAFT (rebased from x:3072 to x:0)
              { id: 1, nameKey: 'section.3.name', x: 0, enemies: ['drone', 'drone', 'spider', 'sniper'], platforms: [
                { x: 164, y: 540, w: 140, h: 20 },
                { x: 424, y: 460, w: 100, h: 20 },
                { x: 664, y: 540, w: 120, h: 20 },
                { x: 944, y: 460, w: 140, h: 20 },
                { x: 1244, y: 520, w: 100, h: 20 },
                { x: 464, y: 280, w: 200, h: 16 },
                { x: 1064, y: 260, w: 180, h: 16 },
                { x: 364, y: 360, w: 30, h: 200 },
                { x: 764, y: 360, w: 30, h: 200 },
              ], loreObjects: [
                { id: 'lore_s3_echo', type: 'echo', x: 264, y: 80, titleKey: 'lore.s3.echo.title', textKey: 'lore.s3.echo.text' },
                { id: 'lore_s3_secret', type: 'terminal', x: 234, y: 80, titleKey: 'lore.s3.secret.title', textKey: 'lore.s3.secret.text' },
              ], collectibles: [
                { id: 'col_s3_skill', type: 'skill_point', x: 264, y: 40, requiredAbility: 'wallJump' },
              ], bonfires: [
                // bf_factory2_1: NOT preLit — lit dynamically when player crosses gate_factory1_to_2 (Phase C).
                // See BonfireData.preLit policy in types.ts.
                // isEntryPoint: true — this is the entry bonfire for factory_2 (auto-lit on gate crossing).
                { id: 'bf_factory2_1', x: 200, y: 540, section: 1, isEntryPoint: true },
              ]},

              // S4: ASSEMBLY HALL + MINI BOSS (rebased from x:4608 to x:1536)
              { id: 2, nameKey: 'section.4.name', x: 1536, enemies: ['spider', 'spider', 'heavy', 'heavy', 'drone', 'drone', 'sniper', 'flying_ai'], platforms: [
                { x: 1700, y: 540, w: 140, h: 20 },
                { x: 1960, y: 480, w: 100, h: 20 },
                { x: 2200, y: 540, w: 120, h: 20 },
                { x: 2480, y: 460, w: 140, h: 20 },
                { x: 2780, y: 520, w: 100, h: 20 },
                { x: 1900, y: 280, w: 200, h: 16 },
                { x: 2500, y: 260, w: 180, h: 16 },
              ], loreObjects: [
                { id: 'lore_s4_terminal', type: 'terminal', x: 1920, y: 250, titleKey: 'lore.s4.terminal.title', textKey: 'lore.s4.terminal.text' },
                { id: 'lore_s4_corpse', type: 'corpse', x: 2260, y: 230, titleKey: 'lore.s4.corpse.title', textKey: 'lore.s4.corpse.text' },
              ], collectibles: [
                { id: 'col_s4_health', type: 'health_fragment', x: 2260, y: 200 },
                { id: 'col_s4_weapon', type: 'weapon_part', x: 1960, y: 230 },
              ], bonfires: [
                { id: 'bf_factory2_2', x: 2600, y: 580, section: 2 },
              ], exitGates: [
                { id: 'gate_factory2_to_3', x: 2850, y: 600, toAreaId: 'factory_3', toSection: 1, toX: 200, toY: 420, labelKey: 'gate.factory2_to_3.label' },
              ]},
            ],
          },

          // ═══════════════════════════════════════════════════════════════
          // Area 3: factory_3 — Sections 5-6 (Checkpoint + Boss Arena)
          // bg: factory_bg_2
          // Boss: Guardian AX-09
          // ═══════════════════════════════════════════════════════════════
          {
            id: 'factory_3',
            nameKey: 'area.factory_3.name',
            regionId: 'factory',
            totalWidth: 3072,
            sectionWidth: 1536,
            bgColor: 0x05070d,
            checkpointSections: [],
            unlockedByDefault: false,
            sections: [
              // S5: CHECKPOINT — GUARDIAN AT THE DOOR (rebased from x:6144 to x:0)
              { id: 1, nameKey: 'section.5.name', x: 0, enemies: [], platforms: [
                { x: 256, y: 520, w: 300, h: 24 },
                { x: 656, y: 460, w: 200, h: 20 },
                { x: 956, y: 380, w: 160, h: 20 },
                { x: 512, y: 280, w: 200, h: 16 },
                { x: 1440, y: 360, w: 40, h: 200 },
                { x: 1440, y: 540, w: 40, h: 160 },
              ], loreObjects: [
                { id: 'lore_s5_echo', type: 'echo', x: 512, y: 260, titleKey: 'lore.s5.echo.title', textKey: 'lore.s5.echo.text' },
                { id: 'lore_s5_terminal', type: 'terminal', x: 956, y: 350, titleKey: 'lore.s5.terminal.title', textKey: 'lore.s5.terminal.text' },
              ], collectibles: [
                { id: 'col_s5_energy', type: 'energy_fragment', x: 956, y: 350 },
              ], bonfires: [
                // bf_factory3_1: NOT preLit — lit dynamically when player crosses gate_factory2_to_3 (Phase C).
                // See BonfireData.preLit policy in types.ts.
                // isEntryPoint: true — this is the entry bonfire for factory_3 (auto-lit on gate crossing).
                { id: 'bf_factory3_1', x: 200, y: 540, section: 1, isEntryPoint: true },
              ]},

              // S6: BOSS ARENA — GUARDIAN AX-09 (rebased from x:7680 to x:1536)
              // Shortcuts removed: sc_s6_to_s1 (was cross-area, replaced by bonfire fast-travel)
              { id: 2, nameKey: 'section.6.name', x: 1536, enemies: [], bossId: 'guardian_ax09', platforms: [
                { x: 1700, y: 560, w: 300, h: 24 },
                { x: 2100, y: 480, w: 200, h: 20 },
                { x: 2400, y: 400, w: 160, h: 20 },
                { x: 1900, y: 280, w: 200, h: 16 },
                { x: 2300, y: 220, w: 160, h: 16 },
                { x: 2788, y: 360, w: 40, h: 200 },
              ], loreObjects: [
                { id: 'lore_s6_corpse', type: 'corpse', x: 1900, y: 250, titleKey: 'lore.s6.corpse.title', textKey: 'lore.s6.corpse.text' },
                { id: 'lore_s6_terminal', type: 'terminal', x: 2300, y: 190, titleKey: 'lore.s6.terminal.title', textKey: 'lore.s6.terminal.text' },
              ], collectibles: [
                { id: 'col_s6_skill', type: 'skill_point', x: 2300, y: 180, requiredAbility: 'doubleJump' },
              ], bonfires: [
                { id: 'bf_factory3_2', x: 2600, y: 580, section: 2 },
              ]},
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Act II — THE DROWNED WASTES (باتلاق غرق‌شده)
  // Theme: فراموشی | Player Learns: حتی قهرمانان هم فراموش می‌شوند | Boss: Leviathan Hulk
  // ═══════════════════════════════════════════════════════════════
  {
    id: 2,
    nameKey: 'act.2.name',
    regions: [
      {
        id: 'wastes',
        nameKey: 'region.wastes.name',
        areas: [
          // ═══════════════════════════════════════════════════════════════
          // Area 1: wastes_1 — Sections 1-4 (The Shore → Wreckage)
          // labelKey: the_shore
          // ═══════════════════════════════════════════════════════════════
          {
            id: 'wastes_1',
            nameKey: 'area.wastes_1.name',
            regionId: 'wastes',
            totalWidth: 6144,
            sectionWidth: 1536,
            bgColor: 0x0a0e08,
            checkpointSections: [],
            unlockedByDefault: false,
            sections: [
              // Section 1: THE SHORE (entry) — no rebase (x starts at 0)
              { id: 1, nameKey: 'section.wastes.1.name', x: 0, enemies: [], platforms: [
                { x: 300, y: 560, w: 180, h: 24 },
                { x: 620, y: 500, w: 120, h: 20 },
                { x: 860, y: 560, w: 160, h: 24 },
                { x: 520, y: 360, w: 200, h: 16 },
                { x: 900, y: 300, w: 140, h: 16 },
                { x: 1440, y: 380, w: 40, h: 180 },
                { x: 1440, y: 540, w: 40, h: 160 },
              ], loreObjects: [
                { id: 'lore_w1_mech_head', type: 'terminal', x: 200, y: 580, titleKey: 'lore.w1.mech_head.title', textKey: 'lore.w1.mech_head.text' },
              ], landmarks: [
                { id: 'lm_w1_giant_mech', type: 'crashed_mech', x: 160, y: 560, w: 200, h: 160, color: 0x2a3a20 },
              ], collectibles: [
                { id: 'col_w1_energy', type: 'energy_fragment', x: 900, y: 270, requiredAbility: 'doubleJump' },
              ], bonfires: [
                { id: 'bf_wastes1_1', x: 200, y: 540, section: 1, isEntryPoint: true },
              ], shortcuts: [
                { id: 'sc_w1_to_s2', x: 1440, y: 650, w: 40, h: 60, toSection: 2, opensFrom: 'left' },
              ]},

              // Section 2: SHALLOW WATERS (first combat)
              { id: 2, nameKey: 'section.wastes.2.name', x: 1536, enemies: ['drowned_walker', 'drowned_walker', 'drowned_walker'], platforms: [
                { x: 1700, y: 540, w: 140, h: 20 },
                { x: 1960, y: 480, w: 100, h: 20 },
                { x: 2200, y: 540, w: 120, h: 20 },
                { x: 2480, y: 460, w: 140, h: 20 },
                { x: 2780, y: 520, w: 100, h: 20 },
                { x: 1900, y: 280, w: 200, h: 16 },
                { x: 2500, y: 260, w: 180, h: 16 },
              ], hazards: [
                { type: 'lava', x: 2600, y: 660, w: 100, h: 20, damage: 15 },
              ], loreObjects: [
                { id: 'lore_w2_log', type: 'terminal', x: 1900, y: 270, titleKey: 'lore.w2.log.title', textKey: 'lore.w2.log.text' },
              ], collectibles: [
                { id: 'col_w2_health', type: 'health_fragment', x: 2500, y: 230, requiredAbility: 'doubleJump' },
              ], bonfires: [
                { id: 'bf_wastes1_2', x: 2900, y: 580, section: 2 },
              ]},

              // Section 3: THE FOG (mosquito territory)
              { id: 3, nameKey: 'section.wastes.3.name', x: 3072, enemies: ['mosquito_drone', 'mosquito_drone', 'mosquito_drone', 'mosquito_drone'], platforms: [
                { x: 3220, y: 500, w: 80, h: 20 },
                { x: 3400, y: 420, w: 80, h: 20 },
                { x: 3580, y: 500, w: 80, h: 20 },
                { x: 3760, y: 380, w: 80, h: 20 },
                { x: 3940, y: 460, w: 80, h: 20 },
                { x: 4120, y: 360, w: 80, h: 20 },
                { x: 4300, y: 480, w: 100, h: 20 },
                { x: 3400, y: 220, w: 160, h: 16 },
                { x: 3800, y: 180, w: 120, h: 16 },
                { x: 4100, y: 220, w: 160, h: 16 },
              ], hazards: [
                { type: 'lava', x: 3200, y: 660, w: 200, h: 20, damage: 20 },
                { type: 'lava', x: 3500, y: 660, w: 160, h: 20, damage: 20 },
                { type: 'lava', x: 3800, y: 660, w: 200, h: 20, damage: 20 },
                { type: 'lava', x: 4100, y: 660, w: 180, h: 20, damage: 20 },
              ], loreObjects: [
                { id: 'lore_w3_names', type: 'corpse', x: 3400, y: 210, titleKey: 'lore.w3.names.title', textKey: 'lore.w3.names.text' },
              ], collectibles: [
                { id: 'col_w3_skill', type: 'skill_point', x: 3800, y: 150, requiredAbility: 'wallJump' },
              ]},

              // Section 4: THE WRECKAGE (mixed combat) + exit gate to wastes_2
              { id: 4, nameKey: 'section.wastes.4.name', x: 4608, enemies: ['drowned_walker', 'drowned_walker', 'mosquito_drone', 'mosquito_drone', 'drowned_walker'], platforms: [
                { x: 4780, y: 500, w: 120, h: 20 },
                { x: 5020, y: 400, w: 100, h: 20 },
                { x: 5240, y: 520, w: 80, h: 20 },
                { x: 5440, y: 380, w: 120, h: 20 },
                { x: 5680, y: 480, w: 100, h: 20 },
                { x: 5900, y: 400, w: 100, h: 20 },
                { x: 5100, y: 300, w: 30, h: 200 },
                { x: 5600, y: 280, w: 30, h: 220 },
                { x: 4800, y: 220, w: 200, h: 16 },
                { x: 5300, y: 180, w: 160, h: 16 },
                { x: 5800, y: 220, w: 180, h: 16 },
              ], hazards: [
                { type: 'spike', x: 5240, y: 640, w: 80, h: 20, damage: 12 },
                { type: 'spike', x: 5680, y: 640, w: 80, h: 20, damage: 12 },
              ], loreObjects: [
                { id: 'lore_w4_awaiting', type: 'terminal', x: 5300, y: 170, titleKey: 'lore.w4.awaiting.title', textKey: 'lore.w4.awaiting.text' },
              ], landmarks: [
                { id: 'lm_w4_standing_mech', type: 'control_room', x: 5050, y: 420, w: 80, h: 200, color: 0x3a4a30 },
              ], collectibles: [
                { id: 'col_w4_weapon', type: 'weapon_part', x: 5800, y: 190 },
              ], exitGates: [
                { id: 'gate_wastes1_to_2', x: 6000, y: 600, toAreaId: 'wastes_2', toSection: 1, toX: 200, toY: 420, labelKey: 'gate.wastes1_to_2.label' },
              ]},
            ],
          },

          // ═══════════════════════════════════════════════════════════════
          // Area 2: wastes_2 — Sections 5-7 (The Approach → Graveyard)
          // labelKey: the_mire
          // Rebased: all x coords - 6144
          // ═══════════════════════════════════════════════════════════════
          {
            id: 'wastes_2',
            nameKey: 'area.wastes_2.name',
            regionId: 'wastes',
            totalWidth: 4608,
            sectionWidth: 1536,
            bgColor: 0x0a0e08,
            checkpointSections: [],
            unlockedByDefault: false,
            sections: [
              // Section 1 (was 5): THE APPROACH — rebased: 6144→0
              { id: 1, nameKey: 'section.wastes.5.name', x: 0, enemies: [], platforms: [
                { x: 256, y: 520, w: 300, h: 24 },
                { x: 656, y: 460, w: 200, h: 20 },
                { x: 956, y: 380, w: 160, h: 20 },
                { x: 456, y: 280, w: 200, h: 16 },
                { x: 1436, y: 360, w: 40, h: 200 },
                { x: 1436, y: 540, w: 40, h: 160 },
              ], loreObjects: [
                { id: 'lore_w5_photo', type: 'corpse', x: 456, y: 270, titleKey: 'lore.w5.photo.title', textKey: 'lore.w5.photo.text' },
                { id: 'lore_w5_recording', type: 'terminal', x: 956, y: 350, titleKey: 'lore.w5.recording.title', textKey: 'lore.w5.recording.text' },
              ], collectibles: [
                { id: 'col_w5_health', type: 'health_fragment', x: 956, y: 350 },
              ], bonfires: [
                { id: 'bf_wastes2_1', x: 200, y: 540, section: 1, isEntryPoint: true },
              ], shortcuts: [
                { id: 'sc_w5_to_s6', x: 1436, y: 650, w: 40, h: 60, toSection: 2, opensFrom: 'left' },
              ]},

              // Section 2 (was 6): THE SUBMERGED HALL — rebased: 7680→1536
              { id: 2, nameKey: 'section.wastes.6.name', x: 1536, enemies: ['drowned_walker', 'drowned_walker', 'drowned_walker', 'drowned_walker'], platforms: [
                { x: 1756, y: 560, w: 200, h: 24 },
                { x: 2056, y: 480, w: 120, h: 20 },
                { x: 2316, y: 400, w: 100, h: 20 },
                { x: 2556, y: 480, w: 120, h: 20 },
                { x: 2816, y: 560, w: 200, h: 24 },
                { x: 2156, y: 300, w: 30, h: 200 },
                { x: 2456, y: 280, w: 30, h: 220 },
                { x: 1856, y: 220, w: 160, h: 16 },
                { x: 2356, y: 180, w: 140, h: 16 },
                { x: 2756, y: 220, w: 160, h: 16 },
              ], hazards: [
                { type: 'lava', x: 1756, y: 660, w: 300, h: 20, damage: 18 },
                { type: 'lava', x: 2656, y: 660, w: 300, h: 20, damage: 18 },
              ], loreObjects: [
                { id: 'lore_w6_nameplate', type: 'corpse', x: 2356, y: 170, titleKey: 'lore.w6.nameplate.title', textKey: 'lore.w6.nameplate.text' },
              ], collectibles: [
                { id: 'col_w6_energy', type: 'energy_fragment', x: 2156, y: 270, requiredAbility: 'wallJump' },
              ]},

              // Section 3 (was 7): THE GRAVEYARD + exit gate to wastes_3 — rebased: 9216→3072
              { id: 3, nameKey: 'section.wastes.7.name', x: 3072, enemies: ['drowned_walker', 'mosquito_drone', 'mosquito_drone', 'drowned_walker', 'drowned_walker'], platforms: [
                { x: 3256, y: 540, w: 140, h: 24 },
                { x: 3556, y: 480, w: 100, h: 20 },
                { x: 3816, y: 540, w: 120, h: 24 },
                { x: 4096, y: 460, w: 100, h: 20 },
                { x: 4356, y: 520, w: 140, h: 24 },
                { x: 3456, y: 340, w: 120, h: 16 },
                { x: 3856, y: 300, w: 100, h: 16 },
                { x: 4256, y: 340, w: 120, h: 16 },
              ], hazards: [
                { type: 'lava', x: 3456, y: 660, w: 200, h: 20, damage: 20 },
                { type: 'lava', x: 3856, y: 660, w: 160, h: 20, damage: 20 },
                { type: 'lava', x: 4156, y: 660, w: 200, h: 20, damage: 20 },
              ], loreObjects: [
                { id: 'lore_w7_hand', type: 'corpse', x: 3656, y: 620, titleKey: 'lore.w7.hand.title', textKey: 'lore.w7.hand.text' },
              ], landmarks: [
                { id: 'lm_w7_fallen_mech', type: 'crashed_mech', x: 3356, y: 540, w: 300, h: 140, color: 0x2a3a20 },
                { id: 'lm_w7_kneeling_mech', type: 'statue', x: 4256, y: 420, w: 120, h: 200, color: 0x3a4a30 },
              ], collectibles: [
                { id: 'col_w7_skill', type: 'skill_point', x: 3856, y: 270, requiredAbility: 'doubleJump' },
              ], bonfires: [
                { id: 'bf_wastes2_2', x: 4456, y: 580, section: 3 },
              ], exitGates: [
                { id: 'gate_wastes2_to_3', x: 4500, y: 600, toAreaId: 'wastes_3', toSection: 1, toX: 200, toY: 420, labelKey: 'gate.wastes2_to_3.label' },
              ]},
            ],
          },

          // ═══════════════════════════════════════════════════════════════
          // Area 3: wastes_3 — Sections 8-10 (The Shadow → Leviathan's Rest)
          // labelKey: leviathans_wake
          // Rebased: all x coords - 10752
          // Boss: Leviathan Hulk
          // ═══════════════════════════════════════════════════════════════
          {
            id: 'wastes_3',
            nameKey: 'area.wastes_3.name',
            regionId: 'wastes',
            totalWidth: 4608,
            sectionWidth: 1536,
            bgColor: 0x0a0e08,
            checkpointSections: [],
            unlockedByDefault: false,
            sections: [
              // Section 1 (was 8): THE SHADOW — rebased: 10752→0
              { id: 1, nameKey: 'section.wastes.8.name', x: 0, enemies: ['drowned_walker', 'drowned_walker', 'drowned_walker', 'drowned_walker'], platforms: [
                { x: 176, y: 540, w: 200, h: 24 },
                { x: 476, y: 480, w: 120, h: 20 },
                { x: 736, y: 420, w: 100, h: 20 },
                { x: 976, y: 480, w: 120, h: 20 },
                { x: 1236, y: 540, w: 200, h: 24 },
                { x: 576, y: 280, w: 160, h: 16 },
                { x: 1076, y: 260, w: 140, h: 16 },
              ], hazards: [
                { type: 'lava', x: 376, y: 660, w: 200, h: 20, damage: 20 },
                { type: 'lava', x: 876, y: 660, w: 200, h: 20, damage: 20 },
              ], loreObjects: [
                // INTENTIONAL cross-section placement preserved (per Stage 1.6a audit):
                // Original x=14400 → rebased 14400-10752=3648 (in section 3's range).
                // Player encounters this terminal while walking toward the Leviathan —
                // narrative timing preserved (sees her silhouette in the distance).
                { id: 'lore_w8_shadow', type: 'terminal', x: 3648, y: 270, titleKey: 'lore.w10.shadow.title', textKey: 'lore.w10.shadow.text' },
              ], landmarks: [
                // INTENTIONAL cross-section placement preserved:
                // Original x=12928 → rebased 12928-10752=2176 (in section 2's range).
                // Distant Leviathan silhouette — first sighting from section 1.
                { id: 'lm_w8_leviathan_silhouette', type: 'tower', x: 2176, y: 100, w: 300, h: 500, color: 0x1a2a18 },
              ], bonfires: [
                { id: 'bf_wastes3_1', x: 200, y: 540, section: 1, isEntryPoint: true },
              ]},

              // Section 2 (was 9): THE VIGIL — rebased: 12288→1536
              { id: 2, nameKey: 'section.wastes.9.name', x: 1536, enemies: [], platforms: [
                { x: 1776, y: 520, w: 400, h: 24 },
                { x: 2276, y: 460, w: 200, h: 20 },
                { x: 2576, y: 380, w: 160, h: 20 },
                { x: 1976, y: 280, w: 200, h: 16 },
                { x: 2376, y: 220, w: 160, h: 16 },
                { x: 3036, y: 360, w: 40, h: 200 },
              ], loreObjects: [
                { id: 'lore_w9_cockpit', type: 'terminal', x: 2376, y: 180, titleKey: 'lore.w11.cockpit.title', textKey: 'lore.w11.cockpit.text' },
                { id: 'lore_w9_names', type: 'corpse', x: 1976, y: 240, titleKey: 'lore.w11.names.title', textKey: 'lore.w11.names.text' },
              ], collectibles: [
                { id: 'col_w9_health', type: 'health_fragment', x: 2276, y: 420 },
              ], shortcuts: [
                { id: 'sc_w9_to_s10', x: 3036, y: 650, w: 40, h: 60, toSection: 3, opensFrom: 'left' },
              ]},

              // Section 3 (was 10): LEVIATHAN'S REST (boss arena) — rebased: 13824→3072
              { id: 3, nameKey: 'section.wastes.10.name', x: 3072, enemies: [], bossId: 'leviathan_hulk', platforms: [
                { x: 3276, y: 560, w: 600, h: 24 },
                { x: 3976, y: 560, w: 600, h: 24 },
                { x: 3116, y: 200, w: 60, h: 380 },
                { x: 4556, y: 200, w: 60, h: 380 },
                { x: 4176, y: 400, w: 200, h: 24 },
                { x: 3376, y: 460, w: 180, h: 24 },
                { x: 3726, y: 320, w: 150, h: 20 },
                { x: 3776, y: 200, w: 200, h: 16 },
              ], hazards: [
                { type: 'lava', x: 3276, y: 660, w: 100, h: 20, damage: 10 },
                { type: 'lava', x: 4476, y: 660, w: 100, h: 20, damage: 10 },
              ], landmarks: [
                { id: 'lm_w10_leviathan_body', type: 'tower', x: 3576, y: 100, w: 400, h: 500, color: 0x2a3a20 },
                { id: 'lm_w10_leviathan_head', type: 'control_room', x: 3676, y: 50, w: 200, h: 100, color: 0x3a4a30 },
              ], bonfires: [
                { id: 'bf_wastes3_2', x: 4200, y: 580, section: 3 },
              ]},
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Act III — THE LAST CITY (آخرین شهر)
  // Theme: مقاومت | Player Learns: هنوز کسانی می‌جنگند | Boss: Iron Magistrate
  // ═══════════════════════════════════════════════════════════════
  {
    id: 3,
    nameKey: 'act.3.name',
    regions: [
      {
        id: 'city',
        nameKey: 'region.city.name',
        areas: [
          // ═══════════════════════════════════════════════════════════════
          // Area 1: Outer Ward — city_bg_1 — 4 sections
          // ═══════════════════════════════════════════════════════════════
          {
            id: 'act3_ward_1',
            nameKey: 'area.act3_ward_1.name',
            regionId: 'city',
            totalWidth: 6144,
            sectionWidth: 1536,
            bgColor: 0x0d0505,
            checkpointSections: [2],
            unlockedByDefault: false,
            sections: [
              // S1: Barricade Line — Memory: sandbag with hand-written names
              { id: 1, nameKey: 'section.city.1.name', x: 0, enemies: ['sniper', 'spider'], platforms: [
                { x: 200, y: 560, w: 300, h: 24 },
                { x: 600, y: 560, w: 200, h: 24 },
                { x: 900, y: 560, w: 180, h: 24 },
                { x: 500, y: 480, w: 120, h: 16 },
                { x: 1100, y: 360, w: 160, h: 16 },
                { x: 1440, y: 360, w: 40, h: 240 },
              ], hazards: [
                { type: 'spike', x: 700, y: 640, w: 80, h: 20, damage: 12 },
              ], loreObjects: [
                { id: 'lore_c1_evac', type: 'terminal', x: 300, y: 540, titleKey: 'lore.c1.evac.title', textKey: 'lore.c1.evac.text' },
              ], landmarks: [
                { id: 'lm_c1_tank', type: 'crashed_mech', x: 800, y: 540, w: 200, h: 120, color: 0x3a2a1a },
              ], collectibles: [
                { id: 'col_c1_energy', type: 'energy_fragment', x: 1180, y: 320, requiredAbility: 'doubleJump' },
              ]},

              // S2: Burning Block — Memory: child's toy in 2nd-floor window
              { id: 2, nameKey: 'section.city.2.name', x: 1536, enemies: ['spider', 'spider', 'sniper', 'heavy'], platforms: [
                { x: 1700, y: 540, w: 140, h: 20 },
                { x: 1960, y: 540, w: 120, h: 20 },
                { x: 2200, y: 540, w: 100, h: 20 },
                { x: 2480, y: 540, w: 140, h: 20 },
                { x: 1850, y: 380, w: 120, h: 16 },
                { x: 2350, y: 360, w: 100, h: 16 },
                { x: 2600, y: 280, w: 160, h: 16 },
              ], hazards: [
                { type: 'lava', x: 2050, y: 660, w: 120, h: 20, damage: 18 },
                { type: 'spike', x: 2300, y: 640, w: 80, h: 20, damage: 12 },
              ], loreObjects: [
                { id: 'lore_c2_radio', type: 'terminal', x: 2350, y: 330, titleKey: 'lore.c2.radio.title', textKey: 'lore.c2.radio.text' },
              ], collectibles: [
                { id: 'col_c2_health', type: 'health_fragment', x: 2100, y: 620 },
              ]},

              // S3: Collapsed Street — Memory: bread line painted on bakery wall
              { id: 3, nameKey: 'section.city.3b.name', x: 3072, enemies: ['sniper', 'sniper', 'spider'], platforms: [
                { x: 3220, y: 540, w: 200, h: 24 },
                { x: 3500, y: 540, w: 160, h: 24 },
                { x: 3720, y: 540, w: 140, h: 24 },
                { x: 3950, y: 460, w: 200, h: 20 },
                { x: 3350, y: 400, w: 80, h: 16 },
                { x: 3680, y: 380, w: 100, h: 16 },
                { x: 4100, y: 300, w: 160, h: 16 },
              ], hazards: [
                { type: 'spike', x: 3400, y: 640, w: 100, h: 20, damage: 15 },
              ], loreObjects: [
                { id: 'lore_c3b_medic', type: 'terminal', x: 4000, y: 420, titleKey: 'lore.c3b.medic.title', textKey: 'lore.c3b.medic.text' },
              ]},

              // S4: Emergency Bridge — Memory: family photos on office walls
              // Border gate at end of this section → travel to Area 2
              { id: 4, nameKey: 'section.city.4b.name', x: 4608, enemies: ['sniper', 'spider'], platforms: [
                { x: 4780, y: 520, w: 100, h: 20 },
                { x: 4960, y: 420, w: 80, h: 20 },
                { x: 5140, y: 320, w: 80, h: 20 },
                { x: 4960, y: 220, w: 100, h: 16 },
                { x: 5310, y: 220, w: 120, h: 16 },
                { x: 5260, y: 300, w: 30, h: 200 },
                { x: 5510, y: 300, w: 30, h: 220 },
                { x: 5700, y: 460, w: 200, h: 20 },
              ], grappleAnchors: [
                { id: 'ga_c3_secret', x: 5460, y: 180 },
              ], loreObjects: [
                { id: 'lore_c4b_fortmap', type: 'terminal', x: 5010, y: 190, titleKey: 'lore.c4b.fortmap.title', textKey: 'lore.c4b.fortmap.text' },
              ], collectibles: [
                { id: 'col_c4b_skill', type: 'skill_point', x: 5460, y: 140, requiredAbility: 'grapple' },
              ]},
            ],
          },

          // ═══════════════════════════════════════════════════════════════
          // Area 2: Inner Ward — city_bg_2 — 4 sections
          // ═══════════════════════════════════════════════════════════════
          {
            id: 'act3_ward_2',
            nameKey: 'area.act3_ward_2.name',
            regionId: 'city',
            totalWidth: 6144,
            sectionWidth: 1536,
            bgColor: 0x0a0806,
            checkpointSections: [2],
            unlockedByDefault: false,
            sections: [
              // S1: Command Bunker — Memory: war room map pins never moved
              { id: 1, nameKey: 'section.city.5.name', x: 0, enemies: ['heavy', 'heavy', 'sniper', 'elite'], platforms: [
                { x: 200, y: 540, w: 160, h: 20 },
                { x: 440, y: 540, w: 120, h: 20 },
                { x: 660, y: 540, w: 100, h: 20 },
                { x: 370, y: 300, w: 30, h: 200 },
                { x: 870, y: 300, w: 30, h: 220 },
                { x: 520, y: 280, w: 160, h: 16 },
                { x: 770, y: 220, w: 100, h: 16 },
                { x: 970, y: 380, w: 140, h: 16 },
                { x: 1170, y: 380, w: 100, h: 16 },
              ], empDoors: [
                { id: 'emp_c4_warroom', x: 1100, y: 380, w: 40, h: 60 },
              ], loreObjects: [
                { id: 'lore_c4_court', type: 'terminal', x: 520, y: 250, titleKey: 'lore.c4.court.title', textKey: 'lore.c4.court.text' },
              ], collectibles: [
                { id: 'col_c4_health', type: 'health_fragment', x: 1120, y: 340 },
                { id: 'col_c4_weapon', type: 'weapon_part', x: 800, y: 180, requiredAbility: 'wallJump' },
              ]},

              // S2: Road to Courthouse — Memory: blind justice statue
              { id: 2, nameKey: 'section.city.6b.name', x: 1536, enemies: ['heavy', 'heavy', 'sniper'], platforms: [
                { x: 1700, y: 540, w: 200, h: 24 },
                { x: 1960, y: 540, w: 180, h: 24 },
                { x: 2220, y: 540, w: 160, h: 24 },
                { x: 2460, y: 540, w: 180, h: 24 },
                { x: 1900, y: 420, w: 100, h: 16 },
                { x: 2150, y: 360, w: 100, h: 16 },
                { x: 2400, y: 300, w: 120, h: 16 },
              ], hazards: [
                { type: 'spike', x: 2050, y: 640, w: 80, h: 20, damage: 12 },
              ], loreObjects: [
                { id: 'lore_c6b_statue', type: 'corpse', x: 2200, y: 540, titleKey: 'lore.c6b.statue.title', textKey: 'lore.c6b.statue.text' },
              ], collectibles: [
                { id: 'col_c6b_weapon', type: 'weapon_part', x: 2450, y: 260, requiredAbility: 'doubleJump' },
              ]},

              // S3: The Last Stand (breather, checkpoint) — Memory: radio still on
              { id: 3, nameKey: 'section.city.7.name', x: 3072, enemies: [], platforms: [
                { x: 3300, y: 540, w: 300, h: 24 },
                { x: 3700, y: 460, w: 200, h: 20 },
                { x: 4000, y: 380, w: 160, h: 20 },
                { x: 4480, y: 360, w: 40, h: 200 },
              ], loreObjects: [
                { id: 'lore_c5_letter', type: 'terminal', x: 3700, y: 420, titleKey: 'lore.c5.letter.title', textKey: 'lore.c5.letter.text' },
              ]},

              // S4: The Courthouse approach — combat section, NOT boss arena
              // (Boss is in act3_courthouse S4, not here — removed duplicate)
              { id: 4, nameKey: 'section.city.8.name', x: 4608, enemies: ['sniper', 'heavy'], platforms: [
                { x: 4780, y: 560, w: 500, h: 24 },
                { x: 5360, y: 560, w: 500, h: 24 },
                { x: 5000, y: 460, w: 120, h: 20 },
                { x: 5260, y: 380, w: 100, h: 20 },
                { x: 5520, y: 460, w: 120, h: 20 },
                { x: 5260, y: 220, w: 200, h: 16 },
              ], hazards: [
                { type: 'lava', x: 4780, y: 660, w: 100, h: 20, damage: 10 },
                { type: 'lava', x: 5780, y: 660, w: 100, h: 20, damage: 10 },
              ], landmarks: [
                { id: 'lm_c8_judge_chair', type: 'tower', x: 5260, y: 100, w: 200, h: 200, color: 0x2a2020 },
              ]},
            ],
          },

          // ═══════════════════════════════════════════════════════════════
          // Area 3: The Courthouse — city_bg_3 + city_bg_4 — 4 sections
          // Boss: Iron Magistrate at end of S4
          // ═══════════════════════════════════════════════════════════════
          {
            id: 'act3_courthouse',
            nameKey: 'area.act3_courthouse.name',
            regionId: 'city',
            totalWidth: 6144,
            sectionWidth: 1536,
            bgColor: 0x080404,
            checkpointSections: [2],
            unlockedByDefault: false,
            sections: [
              // S1: Ashfall Approach — Memory: fading propaganda poster
              { id: 1, nameKey: 'section.city.9.name', x: 0, enemies: ['sniper', 'heavy'], platforms: [
                { x: 200, y: 540, w: 300, h: 24 },
                { x: 600, y: 460, w: 200, h: 20 },
                { x: 900, y: 380, w: 160, h: 20 },
                { x: 1180, y: 300, w: 120, h: 16 },
                { x: 1440, y: 360, w: 40, h: 200 },
              ], loreObjects: [
                { id: 'lore_c7_poster', type: 'terminal', x: 600, y: 420, titleKey: 'lore.c7.poster.title', textKey: 'lore.c7.poster.text' },
              ]},

              // S2: The Courthouse Steps — Memory: blind justice statue
              { id: 2, nameKey: 'section.city.10.name', x: 1536, enemies: ['heavy', 'sniper'], platforms: [
                { x: 1700, y: 540, w: 200, h: 24 },
                { x: 1960, y: 460, w: 180, h: 20 },
                { x: 2220, y: 380, w: 160, h: 20 },
                { x: 2460, y: 300, w: 140, h: 16 },
                { x: 2750, y: 360, w: 40, h: 200 },
              ], loreObjects: [
                { id: 'lore_c10_statue', type: 'corpse', x: 2200, y: 460, titleKey: 'lore.c6b.statue.title', textKey: 'lore.c6b.statue.text' },
              ], collectibles: [
                { id: 'col_c10_skill', type: 'skill_point', x: 2500, y: 260, requiredAbility: 'doubleJump' },
              ]},

              // S3: Final Stand (breather, checkpoint) — Memory: radio still on
              { id: 3, nameKey: 'section.city.11.name', x: 3072, enemies: [], platforms: [
                { x: 3300, y: 540, w: 300, h: 24 },
                { x: 3700, y: 460, w: 200, h: 20 },
                { x: 4000, y: 380, w: 160, h: 20 },
                { x: 4480, y: 360, w: 40, h: 200 },
              ], loreObjects: [
                { id: 'lore_c11_letter', type: 'terminal', x: 3700, y: 420, titleKey: 'lore.c5.letter.title', textKey: 'lore.c5.letter.text' },
              ]},

              // S4: The Final Verdict (boss arena) — Memory: empty judge's chair
              { id: 4, nameKey: 'section.city.12.name', x: 4608, enemies: [], bossId: 'iron_magistrate', platforms: [
                { x: 4780, y: 560, w: 500, h: 24 },
                { x: 5360, y: 560, w: 500, h: 24 },
                { x: 5000, y: 460, w: 120, h: 20 },
                { x: 5260, y: 380, w: 100, h: 20 },
                { x: 5520, y: 460, w: 120, h: 20 },
                { x: 5260, y: 220, w: 200, h: 16 },
              ], hazards: [
                { type: 'lava', x: 4780, y: 660, w: 100, h: 20, damage: 10 },
                { type: 'lava', x: 5780, y: 660, w: 100, h: 20, damage: 10 },
              ], landmarks: [
                { id: 'lm_c12_judge_chair', type: 'tower', x: 5260, y: 100, w: 200, h: 200, color: 0x2a2020 },
              ]},
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Act IV — THE SILENT CANOPY (سایه‌آرام)
  // Theme: همزیستی | Player Learns: طبیعت و ماشین می‌توانند تغییر کنند | Boss: The Gardener
  // ═══════════════════════════════════════════════════════════════
  {
    id: 4,
    nameKey: 'act.4.name',
    regions: [
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
            unlockedByDefault: true,
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

  // ═══════════════════════════════════════════════════════════════
  // Act V — ORBITAL DESCENT (نزول مداری)
  // Theme: حقیقت | Player Learns: انسان‌ها هرگز نابود نشدند | Boss: The Architect
  // ═══════════════════════════════════════════════════════════════
  {
    id: 5,
    nameKey: 'act.5.name',
    regions: [
      {
        id: 'orbital',
        nameKey: 'region.orbital.name',
        areas: [
          {
            id: 'orbital_station_1',
            nameKey: 'area.orbital_station_1.name',
            regionId: 'orbital',
            totalWidth: 7680,
            sectionWidth: 1280,
            bgColor: 0x050510,
            checkpointSections: [2, 5],
            unlockedByDefault: false,
            sections: [
              { id: 1, nameKey: 'section.orbital.1.name', x: 0, enemies: [], platforms: [
                { x: 400, y: 560, w: 200, h: 20 },
              ]},
              { id: 2, nameKey: 'section.orbital.2.name', x: 1280, enemies: [], platforms: [
                { x: 1480, y: 520, w: 100, h: 20 },
              ]},
              { id: 3, nameKey: 'section.orbital.3.name', x: 2560, enemies: [], platforms: [
                { x: 2660, y: 580, w: 200, h: 20 },
              ]},
              { id: 4, nameKey: 'section.orbital.4.name', x: 3840, enemies: [], platforms: [
                { x: 4040, y: 480, w: 80, h: 20 },
              ]},
              { id: 5, nameKey: 'section.orbital.5.name', x: 5120, enemies: [], platforms: [
                { x: 5360, y: 560, w: 140, h: 20 },
              ]},
              { id: 6, nameKey: 'section.orbital.6.name', x: 6400, enemies: [], platforms: [
                { x: 6480, y: 440, w: 40, h: 240 },
                { x: 7600, y: 440, w: 40, h: 240 },
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
