/**
 * MECHA: LAST PROTOCOL — Lore System
 * Souls-style lore: story is NOT told directly.
 * Lore is hidden inside Bosses, Weapons, NPCs, Environment, Items.
 * Player discovers lore by defeating bosses, talking to NPCs,
 * examining items, and exploring areas.
 *
 * Each lore entry has:
 *   - category: boss | weapon | npc | area | item | memory
 *   - sourceId: which boss/weapon/npc/area/item it belongs to
 *   - lines: localization keys for the lore text
 *   - unlockCondition: how the player discovers it
 */

export type LoreCategory = 'boss' | 'weapon' | 'npc' | 'area' | 'item' | 'memory';

export interface LoreEntry {
  id: string;
  category: LoreCategory;
  sourceId: string;           // boss ID, weapon ID, NPC ID, area ID, item ID
  nameKey: string;            // localized name of the source
  lines: string[];            // localization keys
  unlockCondition: string;    // e.g., 'boss_kill:guardian_ax09', 'item_collect:guardian_core', 'area_discover:abandoned_factory'
}

export const LORE_ENTRIES: LoreEntry[] = [
  // ─── Boss Lore ───
  {
    id: 'lore_guardian_ax09',
    category: 'boss',
    sourceId: 'guardian_ax09',
    nameKey: 'boss.guardian_ax09.name',
    lines: ['lore.boss.guardian_ax09.1', 'lore.boss.guardian_ax09.2', 'lore.boss.guardian_ax09.3'],
    unlockCondition: 'boss_kill:guardian_ax09',
  },

  // ─── Weapon Lore ───
  {
    id: 'lore_assault_rifle',
    category: 'weapon',
    sourceId: 'assault_rifle',
    nameKey: 'weapon.assault_rifle.name',
    lines: ['lore.weapon.assault_rifle.1'],
    unlockCondition: 'weapon_unlock:assault_rifle',
  },
  {
    id: 'lore_energy_blade',
    category: 'weapon',
    sourceId: 'energy_blade',
    nameKey: 'weapon.energy_blade.name',
    lines: ['lore.weapon.energy_blade.1'],
    unlockCondition: 'boss_kill:neural_overseer',
  },

  // ─── Area Lore ───
  {
    id: 'lore_abandoned_factory',
    category: 'area',
    sourceId: 'abandoned_factory',
    nameKey: 'area.abandoned_factory.name',
    lines: ['lore.area.abandoned_factory.1', 'lore.area.abandoned_factory.2'],
    unlockCondition: 'area_discover:abandoned_factory',
  },
];

export class LoreSystem {
  private static discovered: Set<string> = new Set();

  /** Initialize from save — load discovered lore IDs. */
  static init(): void {
    // For now, lore discovery is derived from save state:
    // - Boss lore → bossesKilled
    // - Weapon lore → unlockedWeapons
    // - Area lore → discoveredAreas
    const save = require('../systems/SaveSystem').SaveSystem.get();
    for (const entry of LORE_ENTRIES) {
      if (this.checkCondition(entry.unlockCondition, save)) {
        this.discovered.add(entry.id);
      }
    }
  }

  /** Check if a lore entry has been discovered. */
  static isDiscovered(loreId: string): boolean {
    return this.discovered.has(loreId);
  }

  /** Discover a lore entry (e.g., after boss kill). */
  static discover(loreId: string): void {
    this.discovered.add(loreId);
  }

  /** Get all discovered lore entries. */
  static getDiscovered(): LoreEntry[] {
    return LORE_ENTRIES.filter(e => this.discovered.has(e.id));
  }

  /** Get lore entries by category. */
  static getByCategory(category: LoreCategory): LoreEntry[] {
    return LORE_ENTRIES.filter(e => e.category === category);
  }

  /** Get a specific lore entry. */
  static get(loreId: string): LoreEntry | undefined {
    return LORE_ENTRIES.find(e => e.id === loreId);
  }

  /** Get lore for a boss (used on death screen). */
  static getBossLore(bossId: string): LoreEntry | undefined {
    return LORE_ENTRIES.find(e => e.category === 'boss' && e.sourceId === bossId);
  }

  /** Get lore for a weapon (used in weapon description). */
  static getWeaponLore(weaponId: string): LoreEntry | undefined {
    return LORE_ENTRIES.find(e => e.category === 'weapon' && e.sourceId === weaponId);
  }

  /** Check an unlock condition string against save data. */
  private static checkCondition(condition: string, save: { player: { bossesKilled: number; unlockedWeapons: string[] }; discoveredAreas: string[] }): boolean {
    const [type, id] = condition.split(':');
    switch (type) {
      case 'boss_kill': return save.player.bossesKilled > 0; // simplified
      case 'weapon_unlock': return save.player.unlockedWeapons.includes(id);
      case 'area_discover': return save.discoveredAreas.includes(id);
      case 'item_collect': return save.player.inventory.some((i: { itemId: string }) => i.itemId === id);
      default: return false;
    }
  }

  /** Get total lore discovered / total (for completion percentage). */
  static getCompletionPercent(): number {
    if (LORE_ENTRIES.length === 0) return 0;
    return Math.round((this.discovered.size / LORE_ENTRIES.length) * 100);
  }
}

export default LoreSystem;
