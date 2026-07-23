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
            // ⚠️ TEMPORARY: shortened to 1/3 for FPS testing (was 15360, now 6144).
            // Was 10 sections × 1536. Now 4 sections × 1536.
            // Re-enable by restoring the original 10-section layout.
            totalWidth: 6144,
            sectionWidth: 1536,
            bgColor: 0x0a0e08,
            checkpointSections: [2],  // was [2, 5, 8]
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
              // Section 4: LEVIATHAN'S REST (boss arena — moved here from old S10)
              // At the base of the 80-meter mech. She towers above.
              // Boss: THE LEVIATHAN HULK
              // ⚠️ TEMPORARY: arena x-coordinates shifted by -9216 (from old x:13824 to new x:4608)
              // to fit the shortened 4-section layout. All internal x values shifted accordingly.
              // ═══════════════════════════════════════════════════════════════
              { id: 4, nameKey: 'section.wastes.10.name', x: 4608, enemies: [], bossId: 'leviathan_hulk', platforms: [
                // Arena floor — wide, flat, at her feet
                { x: 4812, y: 560, w: 600, h: 24 },
                { x: 5512, y: 560, w: 600, h: 24 },
                // Leviathan's legs as side walls (tall, imposing)
                { x: 4652, y: 200, w: 60, h: 380 },   // left leg
                { x: 6092, y: 200, w: 60, h: 380 },   // right leg
                // Her fallen hand as a platform (right side, mid-height)
                { x: 5712, y: 400, w: 200, h: 24 },
                // Her other hand (left side, lower)
                { x: 4912, y: 460, w: 180, h: 24 },
                // Knee platform (center, high — for dodging beam)
                { x: 5262, y: 320, w: 150, h: 20 },
                // Shoulder ledge (highest — for collectible/lore after fight)
                { x: 5312, y: 200, w: 200, h: 16 },
              ], hazards: [
                // Shallow toxic water on arena floor edges
                { type: 'lava', x: 4812, y: 660, w: 100, h: 20, damage: 10 },
                { type: 'lava', x: 6012, y: 660, w: 100, h: 20, damage: 10 },
              ], landmarks: [
                // The Leviathan herself — massive tower silhouette
                { id: 'lm_w10_leviathan_body', type: 'tower', x: 5112, y: 100, w: 400, h: 500, color: 0x2a3a20 },
                // Her head — visible at the very top
                { id: 'lm_w10_leviathan_head', type: 'control_room', x: 5212, y: 50, w: 200, h: 100, color: 0x3a4a30 },
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
