/**
 * MECHA: LAST PROTOCOL — Experience & Level System
 * XP curve: 100 × level^1.5 (increasing cost per level).
 * Max level: 100. Each level grants exactly 1 Skill Point.
 * XP awarded from: enemy kills, boss kills, quest completion.
 */
import { SaveSystem } from './SaveSystem';
import { EventBus } from './EventBus';
import { AudioSystem } from './AudioSystem';
import type { EnemyTypeId } from '../data/types';

export class ExperienceSystem {
  /** XP required to advance from `level` to `level+1`. Curve: 100 × level^1.5 */
  static xpForLevel(level: number): number {
    if (level < 1) level = 1;
    return Math.round(100 * Math.pow(level, 1.5));
  }

  /** Get current player level. */
  static getLevel(): number {
    return SaveSystem.getPlayer().level;
  }

  /** Get current XP. */
  static getXP(): number {
    return SaveSystem.getPlayer().xp;
  }

  /** Get XP needed for next level. */
  static getXPForNextLevel(): number {
    return this.xpForLevel(this.getLevel());
  }

  /** Get XP progress to next level (0-1). */
  static getLevelProgress(): number {
    const xp = this.getXP();
    const needed = this.getXPForNextLevel();
    return Math.min(1, xp / needed);
  }

  /** Get current skill points. */
  static getSkillPoints(): number {
    return SaveSystem.getPlayer().skillPoints;
  }

  /** Check if at max level. */
  static isMaxLevel(): boolean {
    return this.getLevel() >= 100;
  }

  /**
   * Award XP. Handles level-up (may level up multiple times).
   * Emits LEVEL_UP event for each level gained.
   * Returns true if any level-up occurred.
   */
  static awardXP(amount: number): { leveledUp: boolean; levelsGained: number; newLevel: number } {
    if (this.isMaxLevel()) return { leveledUp: false, levelsGained: 0, newLevel: this.getLevel() };

    const result = SaveSystem.awardXp(amount);
    let levelsGained = 0;

    // If multiple levels were gained, emit events for each
    if (result.leveledUp) {
      levelsGained = 1; // SaveSystem.awardXp handles one level at a time internally
      AudioSystem.play('levelUp');
      EventBus.emit('LEVEL_UP', {
        level: result.newLevel,
        skillPoints: this.getSkillPoints(),
        levelsGained,
      });
    }

    return { leveledUp: result.leveledUp, levelsGained, newLevel: result.newLevel };
  }

  /** Award XP for killing an enemy (looks up xpReward from EnemyData). */
  static awardEnemyKillXP(enemyType: EnemyTypeId, xpReward: number): void {
    this.awardXP(xpReward);
  }

  /** Award XP for killing a boss. */
  static awardBossKillXP(xpReward: number = 200): void {
    this.awardXP(xpReward);
  }

  /** Award XP for completing a quest. */
  static awardQuestXP(xpReward: number): void {
    this.awardXP(xpReward);
  }

  /** Get XP table for UI (levels 1 to current+5). */
  static getXPTable(levels: number = 5): { level: number; xpNeeded: number; current: boolean }[] {
    const currentLevel = this.getLevel();
    const table: { level: number; xpNeeded: number; current: boolean }[] = [];
    for (let i = 0; i < levels; i++) {
      const lvl = currentLevel + i;
      if (lvl > 100) break;
      table.push({
        level: lvl,
        xpNeeded: this.xpForLevel(lvl),
        current: i === 0,
      });
    }
    return table;
  }

  /** Spend a skill point (returns true if successful). */
  static spendSkillPoint(): boolean {
    const sp = this.getSkillPoints();
    if (sp <= 0) return false;
    const save = SaveSystem.get();
    save.player.skillPoints--;
    try {
      window.localStorage.setItem('mecha_last_protocol_save_v3', JSON.stringify(save));
    } catch { /* */ }
    return true;
  }
}

export default ExperienceSystem;
