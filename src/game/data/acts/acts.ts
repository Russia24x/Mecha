/**
 * MECHA: LAST PROTOCOL — World Structure (Acts → Regions → Areas)
 * Metroidvania world layout.
 */
import type { ActData } from '../types';

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
              // Section 1: AWAKENING — dark, quiet. Learn to walk + jump.
              // Moment 1: Biding in darkness. Moment 2: First steps in dust.
              { id: 1, nameKey: 'section.1.name', x: 0, enemies: [], platforms: [
                { x: 500, y: 540, w: 180, h: 20 },
                { x: 800, y: 440, w: 160, h: 20 },
                { x: 1050, y: 540, w: 140, h: 20 },
              ], loreObjects: [
                // Moment 3: First mech corpse — "AWAITING ORDER"
                { id: 'lore_s1_corpse', type: 'corpse', x: 350, y: 660, titleKey: 'lore.s1.corpse.title', textKey: 'lore.s1.corpse.text' },
              ], landmarks: [
                // Landmark 1: Crashed production mech at entrance
                { id: 'lm_s1_mech', type: 'crashed_mech', x: 150, y: 580, w: 120, h: 100, color: 0x2a3040 },
              ]},
              // Section 2: FIRST COMBAT — Moment 4: First drone encounter
              { id: 2, nameKey: 'section.2.name', x: 1280, enemies: ['drone'], platforms: [
                { x: 1480, y: 520, w: 100, h: 20 },
                { x: 1700, y: 420, w: 140, h: 20 },
                { x: 2000, y: 520, w: 100, h: 20 },
                { x: 2300, y: 460, w: 120, h: 20 },
              ], loreObjects: [
                // Moment 5: Engineer's terminal — Kara built Atlas
                { id: 'lore_s2_terminal', type: 'terminal', x: 2400, y: 580, titleKey: 'lore.s2.terminal.title', textKey: 'lore.s2.terminal.text' },
              ]},
              // Section 3: VERTICAL AREA + WALL JUMP TUTORIAL
              { id: 3, nameKey: 'section.3.name', x: 2560, enemies: ['drone'], platforms: [
                { x: 2660, y: 580, w: 200, h: 20 },
                { x: 2800, y: 400, w: 40, h: 360 },
                { x: 3100, y: 400, w: 40, h: 360 },
                { x: 2950, y: 240, w: 100, h: 20 },
                { x: 2750, y: 140, w: 80, h: 20 },
                { x: 3300, y: 520, w: 140, h: 20 },
                { x: 3540, y: 440, w: 140, h: 20 },
              ], hazards: [
                { type: 'spike', x: 2850, y: 690, w: 240, h: 20, damage: 25 },
              ], loreObjects: [
                // Hidden lore at top of shaft — reward for wall jump
                { id: 'lore_s3_echo', type: 'echo', x: 2780, y: 120, titleKey: 'lore.s3.echo.title', textKey: 'lore.s3.echo.text' },
                // Secret reward: hidden terminal with upgrade material info
                { id: 'lore_s3_secret', type: 'terminal', x: 2760, y: 100, titleKey: 'lore.s3.secret.title', textKey: 'lore.s3.secret.text' },
              ]},
              // Section 4: COMBAT ROOM B — pillars + elevated center
              // Moment 6: Emergency lights reveal assembly hall
              // Mini Boss: elite enemy as section guardian
              { id: 4, nameKey: 'section.4.name', x: 3840, enemies: ['spider', 'heavy'], platforms: [
                { x: 4240, y: 460, w: 40, h: 220 },
                { x: 4680, y: 460, w: 40, h: 220 },
                { x: 4440, y: 400, w: 100, h: 20 },
                { x: 4040, y: 480, w: 80, h: 20 },
                { x: 4900, y: 480, w: 80, h: 20 },
                { x: 4360, y: 260, w: 60, h: 20 },
              ], loreObjects: [
                // Terminal in the assembly hall — production logs
                { id: 'lore_s4_terminal', type: 'terminal', x: 4100, y: 580, titleKey: 'lore.s4.terminal.title', textKey: 'lore.s4.terminal.text' },
                // Corpse on upper hidden ledge — reward for wall jump
                { id: 'lore_s4_corpse', type: 'corpse', x: 4380, y: 240, titleKey: 'lore.s4.corpse.title', textKey: 'lore.s4.corpse.text' },
              ], landmarks: [
                // Landmark 2: Assembly line with half-built mechs
                { id: 'lm_s4_assembly', type: 'assembly_line', x: 4460, y: 500, w: 200, h: 80, color: 0x2a3040 },
              ]},
              // Section 5: CHECKPOINT — safe room
              // Moment 7: Guardian guarding an open door to nothing
              { id: 5, nameKey: 'section.5.name', x: 5120, enemies: [], platforms: [
                { x: 5360, y: 560, w: 140, h: 20 },
                { x: 5700, y: 420, w: 120, h: 20 },
                { x: 6000, y: 500, w: 40, h: 180 },
              ], loreObjects: [
                // Echo — PA system still looping after 1000 years
                { id: 'lore_s5_echo', type: 'echo', x: 5600, y: 580, titleKey: 'lore.s5.echo.title', textKey: 'lore.s5.echo.text' },
                // Terminal — last orders
                { id: 'lore_s5_terminal', type: 'terminal', x: 6100, y: 580, titleKey: 'lore.s5.terminal.title', textKey: 'lore.s5.terminal.text' },
              ]},
              // Section 6: BOSS ARENA — Moment 9: Atlas kneels
              { id: 6, nameKey: 'section.6.name', x: 6400, enemies: [], bossId: 'guardian_ax09', platforms: [
                { x: 6480, y: 440, w: 40, h: 240 },
                { x: 7600, y: 440, w: 40, h: 240 },
                { x: 6800, y: 520, w: 80, h: 20 },
                { x: 7280, y: 520, w: 80, h: 20 },
              ], loreObjects: [
                // Corpse near boss arena — last defender
                { id: 'lore_s6_corpse', type: 'corpse', x: 6550, y: 580, titleKey: 'lore.s6.corpse.title', textKey: 'lore.s6.corpse.text' },
                // Terminal — Atlas deployment log
                { id: 'lore_s6_terminal', type: 'terminal', x: 7450, y: 580, titleKey: 'lore.s6.terminal.title', textKey: 'lore.s6.terminal.text' },
              ], landmarks: [
                // Landmark 3: Boss arena door frame (massive)
                { id: 'lm_s6_door', type: 'tower', x: 6440, y: 300, w: 60, h: 400, color: 0x3a3040 },
              ]},
            ],
          },
        ],
      },
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
            bgColor: 0x0a1a0a,
            checkpointSections: [2, 5],
            unlockedByDefault: false,
            requiredAbility: 'boss_1',
            sections: [
              { id: 1, nameKey: 'section.forest.1.name', x: 0, enemies: ['flying_ai'] },
              { id: 2, nameKey: 'section.forest.2.name', x: 1280, enemies: ['flying_ai', 'flying_ai', 'spider'] },
              { id: 3, nameKey: 'section.forest.3.name', x: 2560, enemies: ['spider'] },
              { id: 4, nameKey: 'section.forest.4.name', x: 3840, enemies: ['spider', 'spider', 'heavy', 'flying_ai'] },
              { id: 5, nameKey: 'section.forest.5.name', x: 5120, enemies: [] },
              { id: 6, nameKey: 'section.forest.6.name', x: 6400, enemies: [], bossId: 'neural_overseer' },
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

export function getArea(areaId: string): import('../types').AreaData | undefined {
  for (const act of ACTS) {
    for (const region of act.regions) {
      for (const area of region.areas) {
        if (area.id === areaId) return area;
      }
    }
  }
  return undefined;
}

export function getAllAreas(): import('../types').AreaData[] {
  const areas: import('../types').AreaData[] = [];
  for (const act of ACTS) {
    for (const region of act.regions) {
      areas.push(...region.areas);
    }
  }
  return areas;
}
