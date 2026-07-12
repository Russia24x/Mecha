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
                // Simple stepping platforms — learn jumping
                { x: 500, y: 540, w: 180, h: 20 },
                { x: 800, y: 440, w: 160, h: 20 },
                { x: 1050, y: 540, w: 140, h: 20 },
              ]},
              // Section 2: FIRST COMBAT — Moment 4: First drone encounter
              // Easy combat + checkpoint. Learn to shoot + dodge.
              { id: 2, nameKey: 'section.2.name', x: 1280, enemies: ['drone'], platforms: [
                // Cover platforms for combat
                { x: 1480, y: 520, w: 100, h: 20 },
                { x: 1700, y: 420, w: 140, h: 20 },
                { x: 2000, y: 520, w: 100, h: 20 },
                { x: 2300, y: 460, w: 120, h: 20 },
              ]},
              // Section 3: VERTICAL AREA + WALL JUMP TUTORIAL
              // Tall walls force wall jump. Hidden path at top.
              { id: 3, nameKey: 'section.3.name', x: 2560, enemies: ['drone'], platforms: [
                // Entry platform
                { x: 2660, y: 580, w: 200, h: 20 },
                // Vertical shaft — two facing walls for wall jump
                { x: 2800, y: 400, w: 40, h: 360 },   // left wall (tall)
                { x: 3100, y: 400, w: 40, h: 360 },   // right wall (tall) — gap between = 260px
                // Ledge at top of shaft (wall jump reward)
                { x: 2950, y: 240, w: 100, h: 20 },
                // Hidden path above (requires double jump from ledge)
                { x: 2750, y: 140, w: 80, h: 20 },
                // Spikes at bottom of shaft (hazard — don't fall)
                // Path continues right after shaft
                { x: 3300, y: 520, w: 140, h: 20 },
                { x: 3540, y: 440, w: 140, h: 20 },
              ], hazards: [
                { type: 'spike', x: 2850, y: 690, w: 240, h: 20, damage: 25 },
              ]},
              // Section 4: COMBAT ROOM B — pillars + elevated center
              // Moment 6: Emergency lights reveal assembly hall
              { id: 4, nameKey: 'section.4.name', x: 3840, enemies: ['spider', 'spider', 'heavy'], platforms: [
                // Tall pillars (also serve as wall jump surfaces)
                { x: 4240, y: 460, w: 40, h: 220 },
                { x: 4680, y: 460, w: 40, h: 220 },
                // Center platform
                { x: 4440, y: 400, w: 100, h: 20 },
                // Side ledges
                { x: 4040, y: 480, w: 80, h: 20 },
                { x: 4900, y: 480, w: 80, h: 20 },
                // Upper hidden ledge (wall jump from pillar)
                { x: 4360, y: 260, w: 60, h: 20 },
              ]},
              // Section 5: CHECKPOINT — safe room
              // Moment 7: Guardian guarding an open door to nothing
              { id: 5, nameKey: 'section.5.name', x: 5120, enemies: [], platforms: [
                // Safe platform
                { x: 5360, y: 560, w: 140, h: 20 },
                // Elevated platform (vantage point)
                { x: 5700, y: 420, w: 120, h: 20 },
                // Decorative pillar
                { x: 6000, y: 500, w: 40, h: 180 },
              ]},
              // Section 6: BOSS ARENA — Moment 9: Atlas kneels
              { id: 6, nameKey: 'section.6.name', x: 6400, enemies: [], bossId: 'guardian_ax09', platforms: [
                // Arena walls (prevent retreat + serve as wall jump surfaces)
                { x: 6480, y: 440, w: 40, h: 240 },
                { x: 7600, y: 440, w: 40, h: 240 },
                // Small cover platforms
                { x: 6800, y: 520, w: 80, h: 20 },
                { x: 7280, y: 520, w: 80, h: 20 },
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
