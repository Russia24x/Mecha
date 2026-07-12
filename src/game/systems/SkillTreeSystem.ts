/**
 * MECHA: LAST PROTOCOL — Skill Tree System
 * 6 trees: Combat, Weapon, Movement, Energy, Protocol, Survival.
 * Each skill costs Skill Points. Prerequisites enforced.
 * Unlocked skills modify PlayerStats via computeStats().
 * Abilities (doubleJump, wallJump, etc.) are unlocked via skill effects.
 */
import { SKILLS, getSkill, getSkillsByTree } from '../data/skills/skills';
import type { SkillData, SkillTree, PlayerStats, SkillEffect } from '../data/types';
import { SaveSystem } from './SaveSystem';
import { ExperienceSystem } from './ExperienceSystem';
import { EventBus } from './EventBus';
import { AudioSystem } from './AudioSystem';
import { PLAYER } from '../shared/Constants';
import { t } from './LocalizationSystem';

export interface SkillNode {
  skill: SkillData;
  unlocked: boolean;
  canUnlock: boolean;
  prereqMet: boolean;
  hasSkillPoints: boolean;
  name: string;       // localized
  description: string; // localized
}

export class SkillTreeSystem {
  /**
   * Check if a skill can be unlocked:
   * 1. Not already unlocked
   * 2. Prerequisite (if any) is unlocked
   * 3. Player has enough skill points
   */
  static canUnlock(skillId: string): boolean {
    const skill = getSkill(skillId);
    if (!skill) return false;
    const unlocked = SaveSystem.getPlayer().unlockedSkills;
    if (unlocked.includes(skillId)) return false;
    if (skill.requires && !unlocked.includes(skill.requires)) return false;
    if (ExperienceSystem.getSkillPoints() < skill.cost) return false;
    return true;
  }

  /**
   * Unlock a skill. Consumes skill points.
   * If the skill grants an ability (unlock field), also unlocks that ability.
   * Returns true if successful.
   */
  static unlock(skillId: string): boolean {
    if (!this.canUnlock(skillId)) return false;
    const skill = getSkill(skillId);
    if (!skill) return false;

    // *** FIX: spend the skill's actual cost, not just 1 SP.
    // Previous code called spendSkillPoint() which only deducted 1 SP
    // regardless of skill.cost — a 3-cost skill was free for 1 SP.
    const sp = ExperienceSystem.getSkillPoints();
    if (sp < skill.cost) return false;
    for (let i = 0; i < skill.cost; i++) {
      if (!ExperienceSystem.spendSkillPoint()) return false;
    }

    // Unlock the skill
    SaveSystem.unlockSkill(skillId);

    // If skill grants an ability, unlock it (but NOT if it's a weapon ID —
    // weapon unlocks go through unlockWeapon instead, fixing the duplicate emit)
    if (skill.effect.unlock) {
      if (this.isWeaponId(skill.effect.unlock)) {
        SaveSystem.unlockWeapon(skill.effect.unlock);
        EventBus.emit('WEAPON_UNLOCKED', { weaponId: skill.effect.unlock });
      } else {
        SaveSystem.unlockAbility(skill.effect.unlock);
        EventBus.emit('ABILITY_UNLOCKED', { ability: skill.effect.unlock });
      }
    }

    AudioSystem.play('skillUnlock');
    EventBus.emit('SKILL_UNLOCKED', { skillId });
    return true;
  }

  /** Check if a skill is unlocked. */
  static isUnlocked(skillId: string): boolean {
    return SaveSystem.getPlayer().unlockedSkills.includes(skillId);
  }

  /**
   * Compute effective PlayerStats from base + all unlocked skills.
   * This is the core of the data-driven stat system.
   * Called by PlayerEntity.computeStats().
   */
  static computeStats(unlockedSkills: string[]): PlayerStats {
    const base: PlayerStats = {
      maxHealth: PLAYER.MAX_HEALTH,
      maxEnergy: PLAYER.MAX_ENERGY,
      energyRegen: PLAYER.ENERGY_REGEN,
      moveSpeed: PLAYER.MOVE_SPEED,
      jumpVelocity: PLAYER.JUMP_VELOCITY,
      dashSpeed: PLAYER.DASH_SPEED,
      dashDurationMs: PLAYER.DASH_DURATION_MS,
      dashCooldownMs: PLAYER.DASH_COOLDOWN_MS,
      meleeDamage: PLAYER.MELEE_DAMAGE,
      meleeRange: PLAYER.MELEE_RANGE,
      fireCooldownMs: PLAYER.FIRE_COOLDOWN_MS,
      invulnMs: PLAYER.INVULN_MS,
    };

    for (const skillId of unlockedSkills) {
      const skill = getSkill(skillId);
      if (!skill) continue;
      this.applyEffect(base, skill.effect);
    }

    return base;
  }

  /** Apply a single skill effect to a stats object. */
  private static applyEffect(stats: PlayerStats, effect: SkillEffect): void {
    const statKey = effect.stat as keyof PlayerStats;
    if (effect.multiplier && typeof stats[statKey] === 'number') {
      (stats[statKey] as number) = Math.round((stats[statKey] as number) * effect.multiplier);
    }
    if (effect.additive && typeof stats[statKey] === 'number') {
      (stats[statKey] as number) += effect.additive;
    }
  }

  /** Get all skills in a tree (for UI rendering). */
  static getTree(tree: SkillTree): SkillNode[] {
    return getSkillsByTree(tree).map(skill => {
      const unlocked = this.isUnlocked(skill.id);
      const prereqMet = !skill.requires || this.isUnlocked(skill.requires);
      const hasSP = ExperienceSystem.getSkillPoints() >= skill.cost;
      return {
        skill,
        unlocked,
        canUnlock: !unlocked && prereqMet && hasSP,
        prereqMet,
        hasSkillPoints: hasSP,
        name: t(skill.nameKey),
        description: t(skill.descriptionKey),
      };
    });
  }

  /** Get all 6 trees with their skills (for full skill tree UI). */
  static getAllTrees(): { tree: SkillTree; skills: SkillNode[] }[] {
    const trees: SkillTree[] = ['combat', 'weapon', 'movement', 'energy', 'protocol', 'survival'];
    return trees.map(tree => ({ tree, skills: this.getTree(tree) }));
  }

  /** Get number of unlocked skills. */
  static getUnlockedCount(): number {
    return SaveSystem.getPlayer().unlockedSkills.length;
  }

  /** Get total skill count. */
  static getTotalCount(): number {
    return SKILLS.length;
  }

  /** Get skill tree completion percentage. */
  static getCompletionPercent(): number {
    if (SKILLS.length === 0) return 0;
    return Math.round((this.getUnlockedCount() / SKILLS.length) * 100);
  }

  /** Check if a string is a valid weapon ID (for weapon-unlock skills). */
  private static isWeaponId(id: string): boolean {
    const weaponIds = ['assault_rifle', 'shotgun', 'railgun', 'plasma_cannon', 'laser', 'rocket', 'sword', 'energy_blade'];
    return weaponIds.includes(id);
  }

  /** Get localized skill name. */
  static getSkillName(skillId: string): string {
    const skill = getSkill(skillId);
    return skill ? t(skill.nameKey) : skillId;
  }

  /** Get localized skill description. */
  static getSkillDescription(skillId: string): string {
    const skill = getSkill(skillId);
    return skill ? t(skill.descriptionKey) : '';
  }
}

export default SkillTreeSystem;
