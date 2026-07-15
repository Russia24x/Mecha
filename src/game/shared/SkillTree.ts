/**
 * MECHA: LAST PROTOCOL - SkillTree + Level System
 *
 * Level/XP system:
 *   - Kill enemy → XP reward (varies by enemy type)
 *   - Kill boss → big XP reward
 *   - Level up → +1 skill point
 *   - XP curve: xpForLevel(n) = 100 * n^1.5 (increasing cost)
 *   - Start: Level 1, 0 XP, 0 skill points (must earn first point)
 *
 * Skill costs are balanced so a full playthrough (Stage 1) gives ~6-8 points.
 * Skills should NOT make the game trivially easy — each is a ~15-25% boost.
 *
 * All tunable values are in GameConfig.ts for easy editing.
 */
import { KEYS, PLAYER } from './Constants';
import { GAME_CONFIG } from './GameConfig';

export type SkillId =
  | 'combat.damage1' | 'combat.damage2' | 'combat.fireRate1' | 'combat.melee1'
  | 'mobility.speed1' | 'mobility.speed2' | 'mobility.dashCd1' | 'mobility.doubleJump'
  | 'survival.health1' | 'survival.health2' | 'survival.energy1' | 'survival.regen1';

export interface SkillDef {
  id: SkillId;
  tree: 'combat' | 'mobility' | 'survival';
  name: string;
  description: string;
  cost: number;
  requires?: SkillId;
  // What it does (for documentation)
  effect: string;
}

export const SKILL_DEFS: SkillDef[] = [
  // COMBAT — damage + fire rate
  { id: 'combat.damage1',    tree: 'combat', name: 'Plasma Boost I',   description: '+20% bullet damage',  cost: 1, effect: 'bulletDamage × 1.20' },
  { id: 'combat.damage2',    tree: 'combat', name: 'Plasma Boost II',  description: '+40% bullet damage',  cost: 2, requires: 'combat.damage1', effect: 'bulletDamage × 1.20 (total ×1.40)' },
  { id: 'combat.fireRate1',  tree: 'combat', name: 'Rapid Fire',       description: '-25% fire cooldown',  cost: 2, effect: 'fireCooldown × 0.75' },
  { id: 'combat.melee1',     tree: 'combat', name: 'Heavy Blade',      description: '+40% melee damage + range', cost: 2, effect: 'meleeDamage × 1.40, meleeRange × 1.20' },
  // MOBILITY — speed + dash + jump
  { id: 'mobility.speed1',   tree: 'mobility', name: 'Servos I',       description: '+12% move speed',     cost: 1, effect: 'moveSpeed × 1.12' },
  { id: 'mobility.speed2',   tree: 'mobility', name: 'Servos II',      description: '+24% move speed',     cost: 2, requires: 'mobility.speed1', effect: 'moveSpeed × 1.12 (total ×1.24)' },
  { id: 'mobility.dashCd1',  tree: 'mobility', name: 'Cool Dash',      description: '-35% dash cooldown',  cost: 2, effect: 'dashCd × 0.65' },
  { id: 'mobility.doubleJump', tree: 'mobility', name: 'Thruster Pack', description: 'Unlock double jump',  cost: 3, effect: 'canDoubleJump = true' },
  // SURVIVAL — health + energy
  { id: 'survival.health1',  tree: 'survival', name: 'Armor Plating I', description: '+30 max HP',         cost: 1, effect: 'maxHealth += 30' },
  { id: 'survival.health2',  tree: 'survival', name: 'Armor Plating II', description: '+60 max HP',        cost: 2, requires: 'survival.health1', effect: 'maxHealth += 30 (total +60)' },
  { id: 'survival.energy1',  tree: 'survival', name: 'Capacitor I',    description: '+30 max energy',      cost: 1, effect: 'maxEnergy += 30' },
  { id: 'survival.regen1',   tree: 'survival', name: 'Coolant Flush',  description: '+80% energy regen',   cost: 2, effect: 'energyRegen × 1.80' },
];

interface SkillSaveData {
  unlocked: SkillId[];
  level: number;
  xp: number;
  skillPoints: number;
  totalKills: number;
  bossesKilled: number;
}

const DEFAULT_SAVE: SkillSaveData = {
  unlocked: [],
  level: 1,
  xp: 0,
  skillPoints: 0,   // must earn first point by leveling
  totalKills: 0,
  bossesKilled: 0,
};

export class SkillTree {
  private static cache: SkillSaveData | null = null;
  private static KEY = KEYS.SAVE_KEY + '_skills_v2';

  private static load(): SkillSaveData {
    if (this.cache) return this.cache;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(this.KEY) : null;
      this.cache = raw ? { ...DEFAULT_SAVE, ...JSON.parse(raw) } : { ...DEFAULT_SAVE };
    } catch { this.cache = { ...DEFAULT_SAVE }; }
    return this.cache;
  }

  private static persist(): void {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(this.KEY, JSON.stringify(this.cache)); } catch { /* */ }
  }

  static get(): Readonly<SkillSaveData> { return this.load(); }

  // ---- XP / Level ----

  /** XP required to reach the next level. Curve: 100 * level^1.5 */
  static xpForLevel(level: number): number {
    return Math.round(GAME_CONFIG.LEVELING.xpBase.value * Math.pow(level, GAME_CONFIG.LEVELING.xpExponent.value));
  }

  /** XP progress to next level (0-1). */
  static getLevelProgress(): number {
    const data = this.load();
    const needed = this.xpForLevel(data.level);
    return Math.min(1, data.xp / needed);
  }

  /** Award XP. Returns true if leveled up (may level up multiple times). */
  static awardXp(amount: number): { leveledUp: boolean; newLevel: number } {
    const data = this.load();
    // C11 fix: guard against corrupted save with level < 1 (would cause infinite loop).
    if (typeof data.level !== 'number' || data.level < 1) data.level = 1;
    data.xp += amount;
    let leveledUp = false;
    while (data.xp >= this.xpForLevel(data.level) && data.level < 999) {
      data.xp -= this.xpForLevel(data.level);
      data.level++;
      data.skillPoints += GAME_CONFIG.LEVELING.skillPointsPerLevel.value;
      leveledUp = true;
    }
    this.persist();
    return { leveledUp, newLevel: data.level };
  }

  // ---- Kill tracking ----

  static recordKill(xpReward: number = GAME_CONFIG.LEVELING.xpPerKill.value): { leveledUp: boolean } {
    const data = this.load();
    data.totalKills++;
    this.persist();
    const result = this.awardXp(xpReward);
    return { leveledUp: result.leveledUp };
  }

  static recordBossKill(xpReward: number = GAME_CONFIG.LEVELING.xpPerBoss.value): { leveledUp: boolean } {
    const data = this.load();
    data.bossesKilled++;
    this.persist();
    const result = this.awardXp(xpReward);
    return { leveledUp: result.leveledUp };
  }

  // ---- Skill unlock ----

  static isUnlocked(id: SkillId): boolean { return this.load().unlocked.includes(id); }

  static canUnlock(id: SkillId): boolean {
    const data = this.load();
    const def = SKILL_DEFS.find(d => d.id === id);
    if (!def) return false;
    if (data.unlocked.includes(id)) return false;
    if (data.skillPoints < def.cost) return false;
    if (def.requires && !data.unlocked.includes(def.requires)) return false;
    return true;
  }

  static unlock(id: SkillId): boolean {
    if (!this.canUnlock(id)) return false;
    const data = this.load();
    const def = SKILL_DEFS.find(d => d.id === id)!;
    data.unlocked.push(id);
    data.skillPoints -= def.cost;
    this.persist();
    return true;
  }

  static reset(): void {
    this.cache = { ...DEFAULT_SAVE };
    this.persist();
  }

  /** Compute effective player stats from unlocked skills. */
  static getPlayerModifiers() {
    const u = this.load().unlocked;
    let maxHealth = PLAYER.MAX_HEALTH;
    let maxEnergy = PLAYER.MAX_ENERGY;
    let energyRegen = PLAYER.ENERGY_REGEN;
    let moveSpeed = PLAYER.MOVE_SPEED;
    let dashCd = PLAYER.DASH_COOLDOWN_MS;
    let bulletDamage = PLAYER.BULLET_DAMAGE;
    let fireCooldown = PLAYER.FIRE_COOLDOWN_MS;
    let meleeDamage = PLAYER.MELEE_DAMAGE;
    let meleeRange = PLAYER.MELEE_RANGE;
    let canDoubleJump = false;

    if (u.includes('survival.health1')) maxHealth += 30;
    if (u.includes('survival.health2')) maxHealth += 30;
    if (u.includes('survival.energy1')) maxEnergy += 30;
    if (u.includes('survival.regen1')) energyRegen *= 1.8;
    if (u.includes('mobility.speed1')) moveSpeed *= 1.12;
    if (u.includes('mobility.speed2')) moveSpeed *= 1.12;
    if (u.includes('mobility.dashCd1')) dashCd = Math.round(dashCd * 0.65);
    if (u.includes('mobility.doubleJump')) canDoubleJump = true;
    if (u.includes('combat.damage1')) bulletDamage = Math.round(bulletDamage * 1.20);
    if (u.includes('combat.damage2')) bulletDamage = Math.round(bulletDamage * 1.20);
    if (u.includes('combat.fireRate1')) fireCooldown = Math.round(fireCooldown * 0.75);
    if (u.includes('combat.melee1')) {
      meleeDamage = Math.round(meleeDamage * 1.40);
      meleeRange = Math.round(meleeRange * 1.20);
    }

    return { maxHealth, maxEnergy, energyRegen, moveSpeed, dashCd, bulletDamage, fireCooldown, meleeDamage, meleeRange, canDoubleJump };
  }
}

export default SkillTree;
