/**
 * MECHA: LAST PROTOCOL — World System
 * Top-level world manager. Tracks current Act/Region/Area.
 * Handles transitions between areas (Metroidvania fast travel).
 * Independent of entities — only manages world state + data queries.
 */
import type { ActData, RegionData, AreaData, BonfireData } from '../data/types';
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

  /**
   * Transition to a new area. Returns false if locked or invalid.
   *
   * Phase D extension: optional `bonfireId` parameter for fast-travel from
   * World Map. When provided, the player spawns at the bonfire's exact
   * position (bonfire.x, bonfire.y) instead of the section-start fallback.
   *
   * Per advisor round-9: this MUST use the bonfire's data-driven position
   * directly (NOT CheckpointSystem.getRespawnPosition which has a hardcoded
   * {x:200, y:420} fallback — see E1 task). The bonfire position is read
   * from AreaData via getBonfireById(), then saved as a checkpoint via
   * SaveSystem.saveCheckpoint so buildPlay's CheckpointSystem.getRespawnPosition
   * picks it up correctly.
   *
   * The bonfire must be:
   *  - In the destination area (else travel fails)
   *  - Already lit (SaveSystem.isBonfireLit) — only lit bonfires are
   *    selectable as fast-travel destinations (clause 4.2 of master plan)
   *
   * @param areaId destination area ID
   * @param section destination section (default 1)
   * @param bonfireId optional — if provided, spawn at this bonfire's exact position
   * @returns true if travel succeeded, false if area locked/invalid/bonfire invalid
   */
  static travelTo(areaId: string, section: number = 1, bonfireId?: string): boolean {
    const area = getArea(areaId);
    if (!area) return false;

    // Check if area is unlocked
    if (!this.isAreaUnlocked(areaId)) return false;

    // Check ability requirement
    if (area.requiredAbility && !SaveSystem.getPlayer().abilities.includes(area.requiredAbility)) {
      return false;
    }

    // If bonfireId provided, validate it's in the destination area AND already lit.
    // Per clause 4.2: only lit bonfires are fast-travel destinations.
    let spawnX: number | undefined;
    let spawnY: number | undefined;
    if (bonfireId) {
      const bonfire = this.getBonfireById(areaId, bonfireId);
      if (!bonfire) {
        console.warn(`[WorldSystem.travelTo] Bonfire ${bonfireId} not found in area ${areaId} — travel aborted`);
        return false;
      }
      if (!SaveSystem.isBonfireLit(bonfireId)) {
        console.warn(`[WorldSystem.travelTo] Bonfire ${bonfireId} is not lit — cannot fast-travel (clause 4.2)`);
        return false;
      }
      spawnX = bonfire.x;
      spawnY = bonfire.y;
      // Use the bonfire's section, not the passed section (more accurate).
      section = bonfire.section;
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

    // If bonfireId provided, save checkpoint at bonfire's exact position.
    // This ensures buildPlay's CheckpointSystem.getRespawnPosition returns
    // the bonfire position, NOT the hardcoded {x:200, y:420} fallback (E1 bug).
    if (bonfireId && spawnX !== undefined && spawnY !== undefined) {
      SaveSystem.saveCheckpoint({
        actId: this.current.actId,
        regionId: this.current.regionId,
        areaId,
        section,
        x: spawnX,
        y: spawnY,
        timestamp: Date.now(),
      });
      console.log(`[WorldSystem.travelTo] Fast-travel to ${areaId} at bonfire ${bonfireId} (${spawnX}, ${spawnY})`);
    }

    EventBus.emit('AREA_ENTER', {
      areaId,
      regionId: area.regionId,
      section,
      fromAreaId: oldAreaId,
    });

    return true;
  }

  /**
   * Find a bonfire by ID within a specific area.
   * Used by travelTo (Phase D) to get the bonfire's exact spawn position.
   * Returns undefined if bonfire not found in the area.
   */
  static getBonfireById(areaId: string, bonfireId: string): BonfireData | undefined {
    const area = getArea(areaId);
    if (!area) return undefined;
    for (const section of area.sections) {
      if (!section.bonfires) continue;
      for (const bf of section.bonfires) {
        if (bf.id === bonfireId) return bf;
      }
    }
    return undefined;
  }

  /**
   * Get all lit bonfires in a specific area (for World Map sub-nodes).
   * Per clause 4.2: only lit bonfires are selectable as fast-travel destinations.
   * Returns array of {bonfire, isLit} for UI rendering.
   */
  static getBonfiresForArea(areaId: string): Array<{ bonfire: BonfireData; isLit: boolean }> {
    const area = getArea(areaId);
    if (!area) return [];
    const result: Array<{ bonfire: BonfireData; isLit: boolean }> = [];
    for (const section of area.sections) {
      if (!section.bonfires) continue;
      for (const bf of section.bonfires) {
        result.push({ bonfire: bf, isLit: SaveSystem.isBonfireLit(bf.id) });
      }
    }
    return result;
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

  /**
   * Find the entry bonfire ID for a given area.
   * Per Phase C preLit policy (advisor round-4 Note 2): entry bonfire is
   * identified by the `isEntryPoint: true` flag on BonfireData (NOT by
   * naming convention `bf_X_1` or array index). Returns undefined if the
   * area has no entry bonfire (which is a data error — every area should
   * have exactly one).
   *
   * Used by GameScene.handleExitGate to auto-light the destination's entry
   * bonfire when the player crosses an exit gate (enforces preLit policy
   * as event-driven, single source of truth = gate crossing).
   */
  static getEntryBonfireId(areaId: string): string | undefined {
    const area = getArea(areaId);
    if (!area) return undefined;
    for (const section of area.sections) {
      if (!section.bonfires) continue;
      for (const bf of section.bonfires) {
        if (bf.isEntryPoint) return bf.id;
      }
    }
    return undefined;
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
