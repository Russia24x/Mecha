/**
 * MECHA: LAST PROTOCOL — Weapon Upgrade System
 * Weapons can be upgraded with materials (scrap metal + circuit boards).
 * Each upgrade level increases damage and may improve other stats.
 * Max weapon level: 5. Cost scales with level.
 */
import { getWeapon } from '../data/weapons/weapons';
import type { WeaponId, WeaponData } from '../data/types';
import { SaveSystem } from './SaveSystem';
import { InventorySystem } from './InventorySystem';
import { EventBus } from './EventBus';
import { AudioSystem } from './AudioSystem';
import { t } from './LocalizationSystem';

const MAX_WEAPON_LEVEL = 5;

export interface WeaponUpgradeInfo {
  weaponId: WeaponId;
  currentLevel: number;
  maxLevel: number;
  canUpgrade: boolean;
  scrapNeeded: number;
  circuitNeeded: number;
  currentDamage: number;
  nextDamage: number;
}

export class WeaponUpgradeSystem {
  /** Get the current upgrade level of a weapon. */
  static getLevel(weaponId: WeaponId): number {
    return SaveSystem.getPlayer().weaponLevels[weaponId] ?? 1;
  }

  /** Get the effective damage of a weapon at its current upgrade level. */
  static getEffectiveDamage(weaponId: WeaponId): number {
    const weapon = getWeapon(weaponId);
    const level = this.getLevel(weaponId);
    // Each level adds +10% damage
    return Math.round(weapon.damage * (1 + (level - 1) * 0.10));
  }

  /** Get the effective fire rate (reduced by upgrade level). */
  static getEffectiveFireRate(weaponId: WeaponId): number {
    const weapon = getWeapon(weaponId);
    const level = this.getLevel(weaponId);
    // Each level reduces cooldown by 3% (min 85% of base)
    const multiplier = Math.max(0.85, 1 - (level - 1) * 0.03);
    return Math.round(weapon.fireRateMs * multiplier);
  }

  /** Get the effective energy cost (reduced by upgrade level). */
  static getEffectiveEnergyCost(weaponId: WeaponId): number {
    const weapon = getWeapon(weaponId);
    const level = this.getLevel(weaponId);
    // Each level reduces energy cost by 2% (min 90% of base)
    const multiplier = Math.max(0.90, 1 - (level - 1) * 0.02);
    return Math.round(weapon.energyCost * multiplier);
  }

  /** Get upgrade info for a weapon (for UI display). */
  static getUpgradeInfo(weaponId: WeaponId): WeaponUpgradeInfo {
    const weapon = getWeapon(weaponId);
    const level = this.getLevel(weaponId);
    const nextLevel = level + 1;
    const scrapNeeded = 5 * nextLevel;
    const circuitNeeded = 2 * nextLevel;
    return {
      weaponId,
      currentLevel: level,
      maxLevel: MAX_WEAPON_LEVEL,
      canUpgrade: level < MAX_WEAPON_LEVEL && InventorySystem.hasItem('scrap_metal', scrapNeeded) && InventorySystem.hasItem('circuit_board', circuitNeeded),
      scrapNeeded,
      circuitNeeded,
      currentDamage: this.getEffectiveDamage(weaponId),
      nextDamage: level < MAX_WEAPON_LEVEL ? Math.round(weapon.damage * (1 + nextLevel * 0.10 - 0.10)) : this.getEffectiveDamage(weaponId),
    };
  }

  /** Upgrade a weapon. Consumes materials. Returns true if successful. */
  static upgrade(weaponId: WeaponId): boolean {
    const level = this.getLevel(weaponId);
    if (level >= MAX_WEAPON_LEVEL) return false;

    const nextLevel = level + 1;
    const scrapNeeded = 5 * nextLevel;
    const circuitNeeded = 2 * nextLevel;

    if (!InventorySystem.hasItem('scrap_metal', scrapNeeded) || !InventorySystem.hasItem('circuit_board', circuitNeeded)) {
      return false;
    }

    // Consume materials
    InventorySystem.removeItem('scrap_metal', scrapNeeded);
    InventorySystem.removeItem('circuit_board', circuitNeeded);

    // Set new weapon level (N4 fix: use SaveSystem instead of direct localStorage)
    SaveSystem.setWeaponLevel(weaponId, nextLevel);

    AudioSystem.play('skillUnlock');
    EventBus.emit('WEAPON_UNLOCKED', { weaponId, upgraded: true, level: nextLevel });
    return true;
  }

  /** Get all weapons with their upgrade info (for upgrade UI). */
  static getAllWeaponUpgrades(): WeaponUpgradeInfo[] {
    const save = SaveSystem.getPlayer();
    return save.unlockedWeapons.map(id => this.getUpgradeInfo(id as WeaponId));
  }

  /** Get localized weapon name. */
  static getWeaponName(weaponId: WeaponId): string {
    const weapon = getWeapon(weaponId);
    return weapon ? t(weapon.nameKey) : weaponId;
  }

  /** Get max weapon level. */
  static getMaxLevel(): number { return MAX_WEAPON_LEVEL; }
}

export default WeaponUpgradeSystem;
