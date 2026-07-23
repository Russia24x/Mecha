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
          {
            id: 'abandoned_factory',
            nameKey: 'area.abandoned_factory.name',
            regionId: 'factory',
            totalWidth: 9216,   // 20% larger: 7680 → 9216
            sectionWidth: 1536, // 20% larger: 1280 → 1536
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
                { x: 480, y: 560, w: 200, h: 20 },
                { x: 840, y: 460, w: 160, h: 20 },
                { x: 1180, y: 540, w: 140, h: 20 },
                // Upper ledge (double jump reachable — secret area)
                { x: 660, y: 280, w: 120, h: 20 },
                { x: 940, y: 180, w: 80, h: 20 },
                // Far wall blocks S1→S2. Shortcut at GROUND LEVEL.
                // Wall TOP (blocks upper air route)
                { x: 1440, y: 360, w: 40, h: 200 },   // y=260 to y=460
                // Wall MIDDLE (fills old gap, extends down to ground-level gap)
                { x: 1440, y: 540, w: 40, h: 160 },   // y=460 to y=620
                // GAP at y=620 to y=680 (60px tall, ground level) — shortcut fills this
              ], loreObjects: [
                { id: 'lore_s1_corpse', type: 'corpse', x: 360, y: 660, titleKey: 'lore.s1.corpse.title', textKey: 'lore.s1.corpse.text' },
                // Secret lore on upper ledge (requires double jump)
                { id: 'lore_s1_secret', type: 'terminal', x: 700, y: 260, titleKey: 'lore.s1.secret.title', textKey: 'lore.s1.secret.text' },
              ], landmarks: [
                { id: 'lm_s1_mech', type: 'crashed_mech', x: 180, y: 580, w: 140, h: 110, color: 0x2a3040 },
              ], collectibles: [
                // Health fragment on upper secret ledge (requires double jump)
                { id: 'col_s1_health', type: 'health_fragment', x: 940, y: 150, requiredAbility: 'doubleJump' },
              ], shortcuts: [
                // Shortcut at GROUND LEVEL (y=650, h=60 → y=620-680)
                { id: 'sc_s1_to_s2', x: 1440, y: 650, w: 40, h: 60, toSection: 2, opensFrom: 'left' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 2: FIRST COMBAT (0:05-0:12)
              // Moment 4: First drone. Moment 5: Kara's terminal.
              // Design: Cover platforms, vertical combat space.
              // 4x enemies: 1 → 4 drones
              // ═══════════════════════════════════════════════════════════════
              { id: 2, nameKey: 'section.2.name', x: 1536, enemies: ['drone', 'drone', 'drone', 'drone'], platforms: [
                // Ground level cover
                { x: 1780, y: 520, w: 100, h: 20 },
                { x: 2040, y: 420, w: 140, h: 20 },
                { x: 2400, y: 520, w: 100, h: 20 },
                { x: 2760, y: 460, w: 120, h: 20 },
                // Upper catwalk (alternate route)
                { x: 1800, y: 260, w: 360, h: 16 },
                { x: 2520, y: 260, w: 240, h: 16 },
                // Connecting wall (wall jump surface)
                { x: 2180, y: 340, w: 40, h: 200 },
                // Right boundary wall with GROUND-LEVEL GAP for shortcut
                { x: 3048, y: 360, w: 40, h: 200 },   // y=260 to y=460
                { x: 3048, y: 540, w: 40, h: 160 },   // y=460 to y=620
              ], loreObjects: [
                { id: 'lore_s2_terminal', type: 'terminal', x: 2880, y: 580, titleKey: 'lore.s2.terminal.title', textKey: 'lore.s2.terminal.text' },
              ], hazards: [
                // Small spike pit — teaches hazard awareness
                { type: 'spike', x: 2300, y: 690, w: 96, h: 20, damage: 20 },
                // Molten metal pit (graphical lava hazard)
                { type: 'lava', x: 2640, y: 690, w: 96, h: 20, damage: 35 },
              ], collectibles: [
                // Energy fragment on upper catwalk (alternate route reward)
                { id: 'col_s2_energy', type: 'energy_fragment', x: 1920, y: 230 },
              ], shortcuts: [
                // Shortcut at GROUND LEVEL
                { id: 'sc_s2_to_s3', x: 3048, y: 650, w: 40, h: 60, toSection: 3, opensFrom: 'left' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 3: VERTICAL SHAFT — OPTIONAL SECRET (0:12-0:22)
              // Main route: walk along the lower floor past the shaft to the right exit.
              // Optional secret: wall jump (or grapple) up the shaft for a skill point + lore.
              // 4x enemies: 1 → 4 (2 drones + 1 spider + 1 sniper for variety)
              // ═══════════════════════════════════════════════════════════════
              { id: 3, nameKey: 'section.3.name', x: 3072, enemies: ['drone', 'drone', 'spider', 'sniper'], platforms: [
                // Entry platform (main route — walk along the floor)
                { x: 3200, y: 580, w: 240, h: 20 },
                // Shaft — two facing walls (wall jumpable, but OPTIONAL)
                { x: 3360, y: 380, w: 40, h: 280 },
                { x: 3720, y: 380, w: 40, h: 280 },
                // Mid-shelf (resting point during wall jump — optional)
                { x: 3540, y: 320, w: 120, h: 16 },
                // Top ledge (wall jump reward — optional secret)
                { x: 3540, y: 200, w: 140, h: 16 },
                // Hidden platform (requires double jump from top ledge — optional)
                { x: 3300, y: 100, w: 96, h: 16 },
                // MAIN ROUTE exit (lower level — no wallJump needed)
                { x: 3960, y: 580, w: 240, h: 20 },
                { x: 4250, y: 540, w: 168, h: 20 },
                // Upper exit (optional — for those who wall-jumped up)
                { x: 3960, y: 380, w: 168, h: 20 },
              ], hazards: [
                // Spike pit ONLY at the bottom of the shaft (not blocking main route)
                { type: 'spike', x: 3420, y: 690, w: 288, h: 20, damage: 30 },
              ], loreObjects: [
                { id: 'lore_s3_echo', type: 'echo', x: 3340, y: 80, titleKey: 'lore.s3.echo.title', textKey: 'lore.s3.echo.text' },
                { id: 'lore_s3_secret', type: 'terminal', x: 3310, y: 80, titleKey: 'lore.s3.secret.title', textKey: 'lore.s3.secret.text' },
              ], grappleAnchors: [
                // Grapple anchors — placed high to enable grapple-reach to secret area
                { id: 'grapple_s3_1', x: 3540, y: 60 },
                { id: 'grapple_s3_2', x: 4080, y: 220 },
              ], collectibles: [
                // Skill point at the top of the shaft (OPTIONAL — requires wall jump or grapple)
                { id: 'col_s3_skill', type: 'skill_point', x: 3310, y: 50, requiredAbility: 'wallJump' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 4: ASSEMBLY HALL + MINI BOSS (0:22-0:35)
              // Moment 6: Emergency lights reveal assembly hall.
              // Design: Wide hall with pillars. Mini boss (Elite) center.
              // Upper ledge with secret corpse (wall jump from pillar).
              // 4x enemies: 2 → 8 (2 spider + 2 heavy + 2 drone + 1 sniper + 1 flying_ai) + elite miniboss
              // ═══════════════════════════════════════════════════════════════
              { id: 4, nameKey: 'section.4.name', x: 4608, enemies: ['spider', 'spider', 'heavy', 'heavy', 'drone', 'drone', 'sniper', 'flying_ai'], platforms: [
                // Tall pillars (wall jump surfaces + cover)
                { x: 5088, y: 440, w: 40, h: 260 },
                { x: 5616, y: 440, w: 40, h: 260 },
                // Center platform (elevated combat position)
                { x: 5328, y: 380, w: 120, h: 20 },
                // Side ledges
                { x: 4848, y: 480, w: 96, h: 20 },
                { x: 5880, y: 480, w: 96, h: 20 },
                // Upper hidden ledge (wall jump from pillar — secret)
                { x: 5232, y: 220, w: 96, h: 16 },
                // Upper catwalk (alternate route, connects to S5 upper)
                { x: 4920, y: 160, w: 240, h: 16 },
                { x: 5760, y: 160, w: 240, h: 16 },
                // EMP-gated secret room (right side, blocked by vertical door)
                { x: 6000, y: 380, w: 144, h: 20 },
                { x: 6000, y: 240, w: 20, h: 200 },
                { x: 6000, y: 140, w: 144, h: 16 },
              ], loreObjects: [
                { id: 'lore_s4_terminal', type: 'terminal', x: 4920, y: 580, titleKey: 'lore.s4.terminal.title', textKey: 'lore.s4.terminal.text' },
                { id: 'lore_s4_corpse', type: 'corpse', x: 5256, y: 200, titleKey: 'lore.s4.corpse.title', textKey: 'lore.s4.corpse.text' },
              ], landmarks: [
                { id: 'lm_s4_assembly', type: 'assembly_line', x: 5352, y: 500, w: 288, h: 100, color: 0x2a3040 },
              ], hazards: [
                // Laser beam hazard (graphical energy beam)
                { type: 'laser', x: 5328, y: 340, w: 240, h: 4, damage: 25 },
              ], empDoors: [
                // EMP door is VERTICAL, blocks entry to secret room
                { id: 'empdoor_s4_1', x: 6000, y: 360, w: 20, h: 40 },
              ], collectibles: [
                // Health fragment INSIDE the EMP-gated secret room
                { id: 'col_s4_health', type: 'health_fragment', x: 6072, y: 350, requiredAbility: 'emp' },
                // Weapon part on the upper catwalk (alternate route)
                { id: 'col_s4_weapon', type: 'weapon_part', x: 5880, y: 130, requiredAbility: 'wallJump' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 5: CHECKPOINT — GUARDIAN AT THE DOOR (0:35-0:42)
              // Moment 7: Guardian still standing at open door to nothing.
              // Moment 8: PA system looping.
              // Design: Quiet safe room. Guardian silhouette at far end.
              // ═══════════════════════════════════════════════════════════════
              { id: 5, nameKey: 'section.5.name', x: 6144, enemies: [], platforms: [
                // Safe ground
                { x: 6432, y: 560, w: 240, h: 20 },
                // Elevated vantage point
                { x: 6840, y: 400, w: 144, h: 20 },
                // Guardian pedestal (where it stands)
                { x: 7320, y: 540, w: 96, h: 60 },
                // Door frame walls (open doorway to nothing)
                { x: 7440, y: 300, w: 40, h: 300 },
                { x: 7632, y: 300, w: 40, h: 300 },
              ], loreObjects: [
                { id: 'lore_s5_echo', type: 'echo', x: 6720, y: 580, titleKey: 'lore.s5.echo.title', textKey: 'lore.s5.echo.text' },
                { id: 'lore_s5_terminal', type: 'terminal', x: 7080, y: 580, titleKey: 'lore.s5.terminal.title', textKey: 'lore.s5.terminal.text' },
              ], landmarks: [
                // Guardian silhouette — standing at the open door
                { id: 'lm_s5_guardian', type: 'tower', x: 7320, y: 400, w: 50, h: 200, color: 0x1a2030 },
              ], collectibles: [
                // Energy fragment on the elevated vantage point
                { id: 'col_s5_energy', type: 'energy_fragment', x: 6840, y: 370 },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 6: BOSS ARENA — GUARDIAN AX-09 (0:42-0:55)
              // Moment 9: Atlas kneels. Moment 10: Horizon view.
              // Design: Wide arena. Walls for wall jump. Cover platforms.
              // ═══════════════════════════════════════════════════════════════
              { id: 6, nameKey: 'section.6.name', x: 7680, enemies: [], bossId: 'guardian_ax09', platforms: [
                // Arena walls (prevent retreat + wall jump surfaces)
                { x: 7776, y: 420, w: 40, h: 260 },
                { x: 9120, y: 420, w: 40, h: 260 },
                // Cover platforms (symmetrical)
                { x: 8160, y: 520, w: 120, h: 20 },
                { x: 8736, y: 520, w: 120, h: 20 },
                // Upper platforms (wall jump → safe spot)
                { x: 8040, y: 320, w: 96, h: 16 },
                { x: 8856, y: 320, w: 96, h: 16 },
              ], loreObjects: [
                { id: 'lore_s6_corpse', type: 'corpse', x: 7860, y: 580, titleKey: 'lore.s6.corpse.title', textKey: 'lore.s6.corpse.text' },
                { id: 'lore_s6_terminal', type: 'terminal', x: 8940, y: 580, titleKey: 'lore.s6.terminal.title', textKey: 'lore.s6.terminal.text' },
              ], landmarks: [
                { id: 'lm_s6_door', type: 'tower', x: 7728, y: 280, w: 96, h: 440, color: 0x3a3040 },
              ], collectibles: [
                // Skill point reward on the upper safe spot (wall jump required)
                { id: 'col_s6_skill', type: 'skill_point', x: 8040, y: 290, requiredAbility: 'wallJump' },
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
          {
            id: 'drowned_wastes_1',
            nameKey: 'area.drowned_wastes_1.name',
            regionId: 'wastes',
            totalWidth: 18432,   // 12 sections × 1536 = doubled from 9216
            sectionWidth: 1536,
            bgColor: 0x0a0e08,
            checkpointSections: [2, 5, 8, 11],
            unlockedByDefault: false,
            sections: [
              // ═══════════════════════════════════════════════════════════════
              // Section 1: THE SHORE (entry)
              // Memory Layer: A 50-meter mech half-buried, only head visible.
              // ═══════════════════════════════════════════════════════════════
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
              ], shortcuts: [
                { id: 'sc_w1_to_s2', x: 1440, y: 650, w: 40, h: 60, toSection: 2, opensFrom: 'left' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 2: SHALLOW WATERS (first combat, checkpoint 1)
              // ═══════════════════════════════════════════════════════════════
              { id: 2, nameKey: 'section.wastes.2.name', x: 1536, enemies: ['drowned_walker', 'drowned_walker', 'drowned_walker'], platforms: [
                { x: 1700, y: 540, w: 140, h: 20 },
                { x: 1960, y: 480, w: 100, h: 20 },
                { x: 2200, y: 540, w: 120, h: 20 },
                { x: 2480, y: 460, w: 140, h: 20 },
                { x: 2780, y: 520, w: 100, h: 20 },
                { x: 1900, y: 280, w: 200, h: 16 },
                { x: 2500, y: 260, w: 180, h: 16 },
              ], hazards: [
                { type: 'lava', x: 2100, y: 660, w: 80, h: 20, damage: 15 },
                { type: 'lava', x: 2600, y: 660, w: 100, h: 20, damage: 15 },
              ], loreObjects: [
                { id: 'lore_w2_log', type: 'terminal', x: 1900, y: 270, titleKey: 'lore.w2.log.title', textKey: 'lore.w2.log.text' },
              ], collectibles: [
                { id: 'col_w2_health', type: 'health_fragment', x: 2500, y: 230, requiredAbility: 'doubleJump' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 3: THE FOG (mosquito territory)
              // Memory Layer: Names carved into a mech's hull by hand.
              // ═══════════════════════════════════════════════════════════════
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

              // ═══════════════════════════════════════════════════════════════
              // Section 4: THE WRECKAGE (mixed combat)
              // Memory Layer: A mech still standing, panel blinking "AWAITING ORDER".
              // ═══════════════════════════════════════════════════════════════
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
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 5: THE APPROACH (checkpoint 2, pre-midpoint)
              // Memory Layer: Family photo still in a cockpit.
              // ═══════════════════════════════════════════════════════════════
              { id: 5, nameKey: 'section.wastes.5.name', x: 6144, enemies: [], platforms: [
                { x: 6400, y: 520, w: 300, h: 24 },
                { x: 6800, y: 460, w: 200, h: 20 },
                { x: 7100, y: 380, w: 160, h: 20 },
                { x: 6600, y: 280, w: 200, h: 16 },
                { x: 7580, y: 360, w: 40, h: 200 },
                { x: 7580, y: 540, w: 40, h: 160 },
              ], loreObjects: [
                { id: 'lore_w5_photo', type: 'corpse', x: 6600, y: 270, titleKey: 'lore.w5.photo.title', textKey: 'lore.w5.photo.text' },
                { id: 'lore_w5_recording', type: 'terminal', x: 7100, y: 350, titleKey: 'lore.w5.recording.title', textKey: 'lore.w5.recording.text' },
              ], collectibles: [
                { id: 'col_w5_health', type: 'health_fragment', x: 7100, y: 350 },
              ], shortcuts: [
                { id: 'sc_w5_to_s6', x: 7580, y: 650, w: 40, h: 60, toSection: 6, opensFrom: 'left' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 6: THE SUBMERGED HALL (NEW — vertical platforming)
              // Deep water section, navigating through a flooded mech hangar.
              // 4x drowned_walkers in tight corridors.
              // Memory Layer: Rusted nameplate — "LEV-9 // CITY SHIELD"
              // ═══════════════════════════════════════════════════════════════
              { id: 6, nameKey: 'section.wastes.6.name', x: 7680, enemies: ['drowned_walker', 'drowned_walker', 'drowned_walker', 'drowned_walker'], platforms: [
                // Flooded hangar floor
                { x: 7900, y: 560, w: 200, h: 24 },
                { x: 8200, y: 480, w: 120, h: 20 },
                { x: 8460, y: 400, w: 100, h: 20 },
                { x: 8700, y: 480, w: 120, h: 20 },
                { x: 8960, y: 560, w: 200, h: 24 },
                // Vertical shaft (wall jump — flooded mech interior)
                { x: 8300, y: 300, w: 30, h: 200 },
                { x: 8600, y: 280, w: 30, h: 220 },
                // Upper catwalk (rusted, narrow)
                { x: 8000, y: 220, w: 160, h: 16 },
                { x: 8500, y: 180, w: 140, h: 16 },
                { x: 8900, y: 220, w: 160, h: 16 },
              ], hazards: [
                // Deep water flooding the hangar
                { type: 'lava', x: 7900, y: 660, w: 300, h: 20, damage: 18 },
                { type: 'lava', x: 8400, y: 660, w: 200, h: 20, damage: 18 },
                { type: 'lava', x: 8800, y: 660, w: 300, h: 20, damage: 18 },
              ], loreObjects: [
                { id: 'lore_w6_nameplate', type: 'corpse', x: 8500, y: 170, titleKey: 'lore.w6.nameplate.title', textKey: 'lore.w6.nameplate.text' },
              ], collectibles: [
                { id: 'col_w6_energy', type: 'energy_fragment', x: 8300, y: 270, requiredAbility: 'wallJump' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 7: THE GRAVEYARD (NEW — open swamp with giant corpses)
              // Wide open area with multiple fallen mechs as landmarks.
              // 5x enemies: mixed drowned + mosquito.
              // Memory Layer: A mech's hand, still reaching up from the water.
              // ═══════════════════════════════════════════════════════════════
              { id: 7, nameKey: 'section.wastes.7.name', x: 9216, enemies: ['drowned_walker', 'mosquito_drone', 'mosquito_drone', 'drowned_walker', 'drowned_walker'], platforms: [
                // Scattered mud islands
                { x: 9400, y: 540, w: 140, h: 24 },
                { x: 9700, y: 480, w: 100, h: 20 },
                { x: 9960, y: 540, w: 120, h: 24 },
                { x: 10240, y: 460, w: 100, h: 20 },
                { x: 10500, y: 520, w: 140, h: 24 },
                // Rusted bridge fragments (elevated, broken)
                { x: 9600, y: 340, w: 120, h: 16 },
                { x: 10000, y: 300, w: 100, h: 16 },
                { x: 10400, y: 340, w: 120, h: 16 },
              ], hazards: [
                { type: 'lava', x: 9600, y: 660, w: 200, h: 20, damage: 20 },
                { type: 'lava', x: 10000, y: 660, w: 160, h: 20, damage: 20 },
                { type: 'lava', x: 10300, y: 660, w: 200, h: 20, damage: 20 },
              ], loreObjects: [
                { id: 'lore_w7_hand', type: 'corpse', x: 9800, y: 620, titleKey: 'lore.w7.hand.title', textKey: 'lore.w7.hand.text' },
              ], landmarks: [
                // Fallen mech lying on its side
                { id: 'lm_w7_fallen_mech', type: 'crashed_mech', x: 9500, y: 540, w: 300, h: 140, color: 0x2a3a20 },
                // Another mech, kneeling
                { id: 'lm_w7_kneeling_mech', type: 'statue', x: 10400, y: 420, w: 120, h: 200, color: 0x3a4a30 },
              ], collectibles: [
                { id: 'col_w7_skill', type: 'skill_point', x: 10000, y: 270, requiredAbility: 'doubleJump' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 8: THE CONDUIT (NEW — checkpoint 3, puzzle platforming)
              // Rusted energy conduits, exposed wiring, intermittent sparks.
              // 3x mosquito_drones in tight space.
              // Checkpoint 3.
              // ═══════════════════════════════════════════════════════════════
              { id: 8, nameKey: 'section.wastes.8.name', x: 10752, enemies: ['mosquito_drone', 'mosquito_drone', 'mosquito_drone'], platforms: [
                // Tight platforming over exposed conduits
                { x: 10900, y: 520, w: 100, h: 20 },
                { x: 11120, y: 440, w: 80, h: 20 },
                { x: 11300, y: 360, w: 80, h: 20 },
                { x: 11480, y: 440, w: 80, h: 20 },
                { x: 11660, y: 520, w: 100, h: 20 },
                // Wall jump shafts (conduit pillars)
                { x: 11200, y: 280, w: 30, h: 180 },
                { x: 11500, y: 280, w: 30, h: 180 },
                // Upper route
                { x: 11000, y: 220, w: 200, h: 16 },
                { x: 11500, y: 200, w: 160, h: 16 },
              ], hazards: [
                // Exposed wire hazards (laser type = energy conduit)
                { type: 'laser', x: 11100, y: 480, w: 80, h: 6, damage: 14 },
                { type: 'laser', x: 11400, y: 400, w: 80, h: 6, damage: 14 },
                // Toxic water below
                { type: 'lava', x: 10900, y: 660, w: 400, h: 20, damage: 18 },
                { type: 'lava', x: 11400, y: 660, w: 300, h: 20, damage: 18 },
              ], collectibles: [
                { id: 'col_w8_health', type: 'health_fragment', x: 11500, y: 170, requiredAbility: 'wallJump' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 9: THE DEPTHS (NEW — darkest section, heavy atmosphere)
              // Descending into the deepest part of the swamp.
              // 6x enemies: all types, intense combat.
              // Memory Layer: A recording playing on loop from a submerged speaker.
              // ═══════════════════════════════════════════════════════════════
              { id: 9, nameKey: 'section.wastes.9.name', x: 12288, enemies: ['drowned_walker', 'drowned_walker', 'mosquito_drone', 'mosquito_drone', 'drowned_walker', 'mosquito_drone'], platforms: [
                // Descending platforms into darkness
                { x: 12460, y: 500, w: 120, h: 20 },
                { x: 12700, y: 540, w: 100, h: 20 },
                { x: 12920, y: 580, w: 120, h: 24 },
                { x: 13160, y: 540, w: 100, h: 20 },
                { x: 13400, y: 500, w: 120, h: 20 },
                { x: 13640, y: 540, w: 100, h: 20 },
                // Upper escape route
                { x: 12500, y: 300, w: 160, h: 16 },
                { x: 13000, y: 260, w: 140, h: 16 },
                { x: 13500, y: 300, w: 160, h: 16 },
              ], hazards: [
                { type: 'lava', x: 12400, y: 660, w: 300, h: 20, damage: 22 },
                { type: 'lava', x: 13000, y: 660, w: 300, h: 20, damage: 22 },
                { type: 'lava', x: 13500, y: 660, w: 200, h: 20, damage: 22 },
                { type: 'spike', x: 12920, y: 640, w: 60, h: 20, damage: 14 },
              ], loreObjects: [
                { id: 'lore_w9_speaker', type: 'terminal', x: 13000, y: 250, titleKey: 'lore.w9.speaker.title', textKey: 'lore.w9.speaker.text' },
              ], collectibles: [
                { id: 'col_w9_weapon', type: 'weapon_part', x: 13500, y: 270 },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 10: THE SHADOW (NEW — silhouette of the Leviathan)
              // First glimpse of the Leviathan Hulk in the distance.
              // 4x drowned_walkers, gauntlet before final approach.
              // Memory Layer: She is visible now. Still standing. Still waiting.
              // ═══════════════════════════════════════════════════════════════
              { id: 10, nameKey: 'section.wastes.10.name', x: 13824, enemies: ['drowned_walker', 'drowned_walker', 'drowned_walker', 'drowned_walker'], platforms: [
                // Long narrow pathway toward the Leviathan
                { x: 14000, y: 540, w: 200, h: 24 },
                { x: 14300, y: 480, w: 120, h: 20 },
                { x: 14560, y: 420, w: 100, h: 20 },
                { x: 14800, y: 480, w: 120, h: 20 },
                { x: 15060, y: 540, w: 200, h: 24 },
                // Elevated sniper perch
                { x: 14400, y: 280, w: 160, h: 16 },
                { x: 14900, y: 260, w: 140, h: 16 },
              ], hazards: [
                { type: 'lava', x: 14200, y: 660, w: 200, h: 20, damage: 20 },
                { type: 'lava', x: 14700, y: 660, w: 200, h: 20, damage: 20 },
              ], loreObjects: [
                { id: 'lore_w10_shadow', type: 'terminal', x: 14400, y: 270, titleKey: 'lore.w10.shadow.title', textKey: 'lore.w10.shadow.text' },
              ], landmarks: [
                // Distant Leviathan silhouette (first sighting)
                { id: 'lm_w10_leviathan_silhouette', type: 'tower', x: 16000, y: 100, w: 300, h: 500, color: 0x1a2a18 },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 11: THE VIGIL (checkpoint 4, final calm before boss)
              // At the feet of the Leviathan. Quiet. Overwhelming scale.
              // Memory Layer: The pilot's log — the last recording before the fight.
              // Checkpoint 4.
              // ═══════════════════════════════════════════════════════════════
              { id: 11, nameKey: 'section.wastes.11.name', x: 15360, enemies: [], platforms: [
                // Wide platform at the base of the Leviathan
                { x: 15600, y: 520, w: 400, h: 24 },
                { x: 16100, y: 460, w: 200, h: 20 },
                { x: 16400, y: 380, w: 160, h: 20 },
                // Upper ledge (lore access — the cockpit)
                { x: 15800, y: 280, w: 200, h: 16 },
                { x: 16200, y: 220, w: 160, h: 16 },
                // Walls blocking S11→S12 (boss arena entrance)
                { x: 16860, y: 360, w: 40, h: 200 },
                { x: 16860, y: 540, w: 40, h: 160 },
              ], loreObjects: [
                // The pilot's final log — in the cockpit
                { id: 'lore_w11_cockpit', type: 'terminal', x: 15800, y: 270, titleKey: 'lore.w11.cockpit.title', textKey: 'lore.w11.cockpit.text' },
                // Names list — all the pilots who served under her
                { id: 'lore_w11_names', type: 'corpse', x: 16200, y: 210, titleKey: 'lore.w11.names.title', textKey: 'lore.w11.names.text' },
              ], collectibles: [
                { id: 'col_w11_health', type: 'health_fragment', x: 16400, y: 350 },
              ], shortcuts: [
                { id: 'sc_w11_to_s12', x: 16860, y: 650, w: 40, h: 60, toSection: 12, opensFrom: 'left' },
              ]},

              // ═══════════════════════════════════════════════════════════════
              // Section 12: LEVIATHAN'S REST (boss arena — redesigned)
              // At the base of the 80-meter mech. She towers above.
              // The arena is surrounded by her body parts — legs like walls,
              // hands like platforms. Water pools at her feet.
              // Boss: THE LEVIATHAN HULK
              // Memory Layer: She is still standing. Still protecting.
              // ═══════════════════════════════════════════════════════════════
              { id: 12, nameKey: 'section.wastes.12.name', x: 16896, enemies: [], bossId: 'leviathan_hulk', platforms: [
                // Arena floor — wide, flat, at her feet
                { x: 17100, y: 560, w: 600, h: 24 },
                { x: 17800, y: 560, w: 600, h: 24 },
                // Leviathan's legs as side walls (tall, imposing)
                { x: 16940, y: 200, w: 60, h: 380 },   // left leg
                { x: 18380, y: 200, w: 60, h: 380 },   // right leg
                // Her fallen hand as a platform (right side, mid-height)
                { x: 18000, y: 400, w: 200, h: 24 },
                // Her other hand (left side, lower)
                { x: 17200, y: 460, w: 180, h: 24 },
                // Knee platform (center, high — for dodging beam)
                { x: 17550, y: 320, w: 150, h: 20 },
                // Shoulder ledge (highest — for collectible/lore after fight)
                { x: 17600, y: 200, w: 200, h: 16 },
                // Water pools at her feet (hazards)
              ], hazards: [
                // Shallow toxic water on arena floor edges
                { type: 'lava', x: 17100, y: 660, w: 100, h: 20, damage: 10 },
                { type: 'lava', x: 18300, y: 660, w: 100, h: 20, damage: 10 },
              ], landmarks: [
                // The Leviathan herself — massive tower silhouette
                { id: 'lm_w12_leviathan_body', type: 'tower', x: 17400, y: 100, w: 400, h: 500, color: 0x2a3a20 },
                // Her head — visible at the very top
                { id: 'lm_w12_leviathan_head', type: 'control_room', x: 17500, y: 50, w: 200, h: 100, color: 0x3a4a30 },
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
          {
            id: 'last_city_1',
            nameKey: 'area.last_city_1.name',
            regionId: 'city',
            totalWidth: 7680,
            sectionWidth: 1280,
            bgColor: 0x0d0505,
            checkpointSections: [2, 5],
            unlockedByDefault: false,
            sections: [
              { id: 1, nameKey: 'section.city.1.name', x: 0, enemies: [], platforms: [
                { x: 400, y: 560, w: 200, h: 20 },
              ]},
              { id: 2, nameKey: 'section.city.2.name', x: 1280, enemies: [], platforms: [
                { x: 1480, y: 520, w: 100, h: 20 },
              ]},
              { id: 3, nameKey: 'section.city.3.name', x: 2560, enemies: [], platforms: [
                { x: 2660, y: 580, w: 200, h: 20 },
              ]},
              { id: 4, nameKey: 'section.city.4.name', x: 3840, enemies: [], platforms: [
                { x: 4040, y: 480, w: 80, h: 20 },
              ]},
              { id: 5, nameKey: 'section.city.5.name', x: 5120, enemies: [], platforms: [
                { x: 5360, y: 560, w: 140, h: 20 },
              ]},
              { id: 6, nameKey: 'section.city.6.name', x: 6400, enemies: [], platforms: [
                { x: 6480, y: 440, w: 40, h: 240 },
                { x: 7600, y: 440, w: 40, h: 240 },
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
