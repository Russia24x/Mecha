/**
 * MECHA: LAST PROTOCOL — World Map System
 * Fog of war + unlocked areas + fast travel data.
 * Pure data queries — UI rendering is done separately.
 * Reads from SaveSystem for persistent state.
 */
import type { AreaData, RegionData, ActData } from '../data/types';
import { ACTS, getArea } from '../data/acts/acts';
import { SaveSystem } from '../systems/SaveSystem';
import { WorldSystem } from './WorldSystem';

export interface MapNode {
  area: AreaData;
  region: RegionData;
  act: ActData;
  unlocked: boolean;
  discovered: boolean;     // fog of war revealed
  isCurrent: boolean;
  completed: boolean;      // boss defeated in this area
  bossDefeated: boolean;
  hasBoss: boolean;
}

export interface MapRegion {
  region: RegionData;
  act: ActData;
  nodes: MapNode[];
}

export interface MapAct {
  act: ActData;
  regions: MapRegion[];
}

export class WorldMapSystem {
  /**
   * Get the full world map tree for UI rendering.
   * Each area is a MapNode with fog-of-war state.
   */
  static getMapTree(): MapAct[] {
    const currentLoc = WorldSystem.getCurrent();
    const save = SaveSystem.get();

    return ACTS.map(act => ({
      act,
      regions: act.regions.map(region => ({
        region,
        act,
        nodes: region.areas.map(area => {
          const unlocked = area.unlockedByDefault || save.unlockedAreas.includes(area.id);
          const discovered = save.discoveredAreas.includes(area.id);
          const hasBoss = area.sections.some(s => s.bossId);
          const bossDefeated = hasBoss && save.player.bossesKilled > 0 &&
            this.isBossInAreaDefeated(area, save.player.bossesKilled);
          return {
            area,
            region,
            act,
            unlocked,
            discovered,
            isCurrent: currentLoc.areaId === area.id,
            completed: bossDefeated,
            bossDefeated,
            hasBoss,
          } as MapNode;
        }),
      })),
    }));
  }

  /** Check if the boss in a specific area has been defeated. */
  private static isBossInAreaDefeated(area: AreaData, bossesKilled: number): boolean {
    // Simple heuristic: first area boss = 1st kill, second area boss = 2nd kill
    // Can be made more precise with bossId tracking in SaveSystem
    const bossSection = area.sections.find(s => s.bossId);
    if (!bossSection || !bossSection.bossId) return false;

    // Count how many areas with bosses come before this one
    let bossIndex = 0;
    for (const act of ACTS) {
      for (const region of act.regions) {
        for (const a of region.areas) {
          const hasBoss = a.sections.some(s => s.bossId);
          if (hasBoss) {
            if (a.id === area.id) {
              return bossesKilled > bossIndex;
            }
            bossIndex++;
          }
        }
      }
    }
    return false;
  }

  /** Get only areas available for fast travel (unlocked + discovered). */
  static getFastTravelDestinations(): MapNode[] {
    const tree = this.getMapTree();
    const destinations: MapNode[] = [];
    for (const act of tree) {
      for (const region of act.regions) {
        for (const node of region.nodes) {
          if (node.unlocked && node.discovered) {
            destinations.push(node);
          }
        }
      }
    }
    return destinations;
  }

  /** Get areas that are unlocked but not yet discovered (shown on map but fogged). */
  static getUndiscoveredAreas(): AreaData[] {
    return ACTS.flatMap(a => a.regions).flatMap(r => r.areas).filter(a => {
      const unlocked = a.unlockedByDefault || SaveSystem.get().unlockedAreas.includes(a.id);
      const discovered = SaveSystem.get().discoveredAreas.includes(a.id);
      return unlocked && !discovered;
    });
  }

  /** Get total fog-of-war percentage (0-100). */
  static getFogOfWarPercent(): number {
    const allAreas = ACTS.flatMap(a => a.regions).flatMap(r => r.areas);
    if (allAreas.length === 0) return 0;
    const discovered = allAreas.filter(a => SaveSystem.get().discoveredAreas.includes(a.id)).length;
    return Math.round((discovered / allAreas.length) * 100);
  }

  /** Check if fast travel is available (more than 1 discovered area). */
  static canFastTravel(): boolean {
    return this.getFastTravelDestinations().length > 1;
  }

  /** Get boss areas for map icons. */
  static getBossAreas(): MapNode[] {
    const tree = this.getMapTree();
    const bossAreas: MapNode[] = [];
    for (const act of tree) {
      for (const region of act.regions) {
        for (const node of region.nodes) {
          if (node.hasBoss) bossAreas.push(node);
        }
      }
    }
    return bossAreas;
  }
}

export default WorldMapSystem;
