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
              { id: 1, nameKey: 'section.1.name', x: 0, enemies: [] },
              { id: 2, nameKey: 'section.2.name', x: 1280, enemies: ['drone', 'drone'] },
              { id: 3, nameKey: 'section.3.name', x: 2560, enemies: ['drone'], platforms: [
                { x: 2760, y: 520, w: 180, h: 20 },
                { x: 3060, y: 400, w: 180, h: 20 },
                { x: 3360, y: 480, w: 180, h: 20 },
                { x: 3640, y: 580, w: 180, h: 80 },
              ]},
              { id: 4, nameKey: 'section.4.name', x: 3840, enemies: ['spider', 'spider', 'heavy'], platforms: [
                { x: 4240, y: 520, w: 40, h: 160 },
                { x: 4680, y: 520, w: 40, h: 160 },
                { x: 4440, y: 440, w: 100, h: 20 },
              ]},
              { id: 5, nameKey: 'section.5.name', x: 5120, enemies: [], platforms: [
                { x: 5760, y: 600, w: 80, h: 80 },
              ]},
              { id: 6, nameKey: 'section.6.name', x: 6400, enemies: [], bossId: 'guardian_ax09', platforms: [
                { x: 6480, y: 470, w: 40, h: 210 },
                { x: 7600, y: 470, w: 40, h: 210 },
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
