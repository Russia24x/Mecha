/**
 * MECHA: LAST PROTOCOL — World System
 * Top-level world manager. Tracks current Act/Region/Area.
 * Handles transitions between areas (Metroidvania fast travel).
 * Independent of entities — only manages world state + data queries.
 */
import type { ActData, RegionData, AreaData } from '../data/types';
import { ACTS, getAct, getArea, getAllAreas } from '../data/acts/acts';
import { SaveSystem } from '../systems/SaveSystem';
import { EventBus } from '../systems/EventBus';

export interface WorldLocation {
  actId: number;
  regionId: string;
  areaId: string;
  section: number;
}

export class WorldSystem {
  private static current: WorldLocation = {
    actId: 1,
    regionId: 'factory',
    areaId: 'abandoned_factory',
    section: 1,
  };

  /** Get current world location. */
  static getCurrent(): WorldLocation { return { ...this.current }; }

  /** Get current Act data. */
  static getCurrentAct(): ActData | undefined {
    return getAct(this.current.actId);
  }

  /** Get current Region data. */
  static getCurrentRegion(): RegionData | undefined {
    const act = this.getCurrentAct();
    return act?.regions.find(r => r.id === this.current.regionId);
  }

  /** Get current Area data. */
  static getCurrentArea(): AreaData | undefined {
    return getArea(this.current.areaId);
  }

  /** Transition to a new area. Returns false if locked or invalid. */
  static travelTo(areaId: string, section: number = 1): boolean {
    const area = getArea(areaId);
    if (!area) return false;

    // Check if area is unlocked
    if (!this.isAreaUnlocked(areaId)) return false;

    // Check ability requirement
    if (area.requiredAbility && !SaveSystem.getPlayer().abilities.includes(area.requiredAbility)) {
      return false;
    }

    const oldAreaId = this.current.areaId;
    this.current = {
      actId: this.findActForArea(areaId),
      regionId: area.regionId,
      areaId,
      section,
    };

    // Mark as discovered
    SaveSystem.discoverArea(areaId);

    EventBus.emit('AREA_ENTER', {
      areaId,
      regionId: area.regionId,
      section,
      fromAreaId: oldAreaId,
    });

    return true;
  }

  /** Set current section (when player crosses section trigger). */
  static setSection(section: number): void {
    this.current.section = section;
    EventBus.emit('GAME_STATE', {
      sectionId: section,
      sectionName: this.getSectionName(section),
    });
  }

  /** Get section name (localized) for current area. */
  static getSectionName(section: number): string {
    const area = this.getCurrentArea();
    if (!area) return '';
    const sec = area.sections.find(s => s.id === section);
    return sec?.nameKey ?? '';
  }

  /** Check if an area is unlocked (either by default or via save). */
  static isAreaUnlocked(areaId: string): boolean {
    const area = getArea(areaId);
    if (!area) return false;
    if (area.unlockedByDefault) return true;
    return SaveSystem.get().unlockedAreas.includes(areaId);
  }

  /** Unlock an area (e.g., after boss kill). */
  static unlockArea(areaId: string): void {
    SaveSystem.unlockArea(areaId);
    EventBus.emit('AREA_ENTER', { areaId, unlocked: true });
  }

  /** Check if area has been discovered (fog of war). */
  static isAreaDiscovered(areaId: string): boolean {
    return SaveSystem.get().discoveredAreas.includes(areaId);
  }

  /** Get all areas in the world. */
  static getAllAreas(): AreaData[] {
    return getAllAreas();
  }

  /** Get all areas grouped by act + region (for world map UI). */
  static getWorldTree(): { act: ActData; regions: { region: RegionData; areas: AreaData[] }[] }[] {
    return ACTS.map(act => ({
      act,
      regions: act.regions.map(region => ({
        region,
        areas: region.areas,
      })),
    }));
  }

  /** Find which act an area belongs to. */
  private static findActForArea(areaId: string): number {
    for (const act of ACTS) {
      for (const region of act.regions) {
        if (region.areas.some(a => a.id === areaId)) return act.id;
      }
    }
    return 1;
  }

  /** Get all areas that are currently unlocked (for fast travel). */
  static getUnlockedAreas(): AreaData[] {
    return getAllAreas().filter(a => this.isAreaUnlocked(a.id));
  }

  /** Get all areas that have been discovered (fog of war revealed). */
  static getDiscoveredAreas(): AreaData[] {
    return getAllAreas().filter(a => this.isAreaDiscovered(a.id));
  }

  /** Initialize world from save data (on game start). */
  static initFromSave(): void {
    const cp = SaveSystem.get().checkpoint;
    if (cp) {
      this.current = {
        actId: cp.actId,
        regionId: cp.regionId,
        areaId: cp.areaId,
        section: cp.section,
      };
    }
  }

  /** Get checkpoint position for current area section. */
  static getCheckpointForCurrentSection(): { x: number; y: number } | null {
    const cp = SaveSystem.get().checkpoint;
    if (cp && cp.areaId === this.current.areaId) {
      return { x: cp.x, y: cp.y };
    }
    return null;
  }
}

export default WorldSystem;
