/**
 * MECHA: LAST PROTOCOL — Inventory System
 * Manages player inventory: weapons, materials, consumables, key items.
 * Uses SaveSystem for persistence. All items are data-driven (ItemData).
 */
import { getItem } from '../data/items/items';
import type { ItemData, InventoryItem, ItemType } from '../data/types';
import { SaveSystem } from './SaveSystem';
import { EventBus } from './EventBus';
import { AudioSystem } from './AudioSystem';
import { t } from './LocalizationSystem';

export interface InventorySlot {
  item: ItemData;
  amount: number;
}

export class InventorySystem {
  /** Get all inventory items (resolved with ItemData). */
  static getInventory(): InventorySlot[] {
    const raw = SaveSystem.getPlayer().inventory;
    return raw
      .map(i => {
        const item = getItem(i.itemId);
        return item ? { item, amount: i.amount } : null;
      })
      .filter((s): s is InventorySlot => s !== null);
  }

  /** Get items filtered by type. */
  static getByType(type: ItemType): InventorySlot[] {
    return this.getInventory().filter(s => s.item.type === type);
  }

  /** Get materials only. */
  static getMaterials(): InventorySlot[] { return this.getByType('material'); }

  /** Get key items only. */
  static getKeyItems(): InventorySlot[] { return this.getByType('key_item'); }

  /** Get consumables only. */
  static getConsumables(): InventorySlot[] { return this.getByType('consumable'); }

  /** Get abilities (unlock items). */
  static getAbilities(): InventorySlot[] { return this.getByType('ability'); }

  /** Add an item to inventory. */
  static addItem(itemId: string, amount: number = 1): void {
    SaveSystem.addItem(itemId, amount);
    const item = getItem(itemId);
    if (item) {
      EventBus.emit('ITEM_COLLECTED', { itemId, amount, nameKey: item.nameKey });
    }
  }

  /** Remove an item from inventory. Returns true if successful. */
  static removeItem(itemId: string, amount: number = 1): boolean {
    return SaveSystem.removeItem(itemId, amount);
  }

  /** Check if player has an item (at least `amount`). */
  static hasItem(itemId: string, amount: number = 1): boolean {
    return SaveSystem.hasItem(itemId, amount);
  }

  /** Get amount of a specific item. */
  static getItemCount(itemId: string): number {
    const inv = SaveSystem.getPlayer().inventory;
    return inv.find(i => i.itemId === itemId)?.amount ?? 0;
  }

  /** Use a consumable item (e.g., health pack). Returns true if used. */
  static useConsumable(itemId: string): boolean {
    const item = getItem(itemId);
    if (!item || item.type !== 'consumable' || !item.effect) return false;
    if (!this.removeItem(itemId, 1)) return false;

    // Apply effect via EventBus — Player listens and applies
    EventBus.emit('ITEM_USED', { itemId, effect: item.effect });
    AudioSystem.play('uiClick');
    return true;
  }

  /** Get localized item name. */
  static getItemName(itemId: string): string {
    const item = getItem(itemId);
    return item ? t(item.nameKey) : itemId;
  }

  /** Get localized item description. */
  static getItemDescription(itemId: string): string {
    const item = getItem(itemId);
    return item ? t(item.descriptionKey) : '';
  }

  /** Get total inventory slot count. */
  static getSlotCount(): number {
    return SaveSystem.getPlayer().inventory.length;
  }

  /** Check if player has enough upgrade materials for a weapon upgrade. */
  static hasUpgradeMaterials(weaponId: string, level: number): boolean {
    // Upgrade costs: level 2 = 5 scrap + 2 circuit, level 3 = 10 scrap + 5 circuit, etc.
    const scrapNeeded = 5 * level;
    const circuitNeeded = 2 * level;
    return this.hasItem('scrap_metal', scrapNeeded) && this.hasItem('circuit_board', circuitNeeded);
  }

  /** Consume upgrade materials for a weapon upgrade. */
  static consumeUpgradeMaterials(level: number): boolean {
    const scrapNeeded = 5 * level;
    const circuitNeeded = 2 * level;
    if (!this.hasItem('scrap_metal', scrapNeeded) || !this.hasItem('circuit_board', circuitNeeded)) return false;
    this.removeItem('scrap_metal', scrapNeeded);
    this.removeItem('circuit_board', circuitNeeded);
    return true;
  }
}

export default InventorySystem;
