/**
 * MECHA: LAST PROTOCOL — Skill Tree Database
 * 6 trees, each with progressive skills. Data-driven.
 */
import type { SkillData } from '../types';

export const SKILLS: SkillData[] = [
  // ================ COMBAT ================
  { id: 'combat.damage1', tree: 'combat', nameKey: 'skill.combat.damage1.name', descriptionKey: 'skill.combat.damage1.desc', cost: 1, effect: { stat: 'meleeDamage', multiplier: 1.20 } },
  { id: 'combat.damage2', tree: 'combat', nameKey: 'skill.combat.damage2.name', descriptionKey: 'skill.combat.damage2.desc', cost: 2, requires: 'combat.damage1', effect: { stat: 'meleeDamage', multiplier: 1.20 } },
  { id: 'combat.fireRate1', tree: 'combat', nameKey: 'skill.combat.fireRate1.name', descriptionKey: 'skill.combat.fireRate1.desc', cost: 2, effect: { stat: 'fireCooldownMs', multiplier: 0.75 } },

  // ================ WEAPON ================
  { id: 'weapon.unlock_shotgun', tree: 'weapon', nameKey: 'skill.weapon.shotgun.name', descriptionKey: 'skill.weapon.shotgun.desc', cost: 1, effect: { stat: 'moveSpeed', unlock: 'shotgun' } },
  { id: 'weapon.unlock_railgun', tree: 'weapon', nameKey: 'skill.weapon.railgun.name', descriptionKey: 'skill.weapon.railgun.desc', cost: 2, effect: { stat: 'moveSpeed', unlock: 'railgun' } },
  { id: 'weapon.unlock_rocket', tree: 'weapon', nameKey: 'skill.weapon.rocket.name', descriptionKey: 'skill.weapon.rocket.desc', cost: 3, requires: 'weapon.unlock_shotgun', effect: { stat: 'moveSpeed', unlock: 'rocket' } },

  // ================ MOVEMENT ================
  { id: 'movement.speed1', tree: 'movement', nameKey: 'skill.movement.speed1.name', descriptionKey: 'skill.movement.speed1.desc', cost: 1, effect: { stat: 'moveSpeed', multiplier: 1.12 } },
  { id: 'movement.speed2', tree: 'movement', nameKey: 'skill.movement.speed2.name', descriptionKey: 'skill.movement.speed2.desc', cost: 2, requires: 'movement.speed1', effect: { stat: 'moveSpeed', multiplier: 1.12 } },
  { id: 'movement.dashCd1', tree: 'movement', nameKey: 'skill.movement.dashCd1.name', descriptionKey: 'skill.movement.dashCd1.desc', cost: 2, effect: { stat: 'dashCooldownMs', multiplier: 0.65 } },
  { id: 'movement.doubleJump', tree: 'movement', nameKey: 'skill.movement.doubleJump.name', descriptionKey: 'skill.movement.doubleJump.desc', cost: 3, effect: { stat: 'moveSpeed', unlock: 'doubleJump' } },
  { id: 'movement.wallJump', tree: 'movement', nameKey: 'skill.movement.wallJump.name', descriptionKey: 'skill.movement.wallJump.desc', cost: 3, requires: 'movement.doubleJump', effect: { stat: 'moveSpeed', unlock: 'wallJump' } },
  { id: 'movement.grapple', tree: 'movement', nameKey: 'skill.movement.grapple.name', descriptionKey: 'skill.movement.grapple.desc', cost: 5, requires: 'movement.wallJump', effect: { stat: 'moveSpeed', unlock: 'grapple' } },

  // ================ ENERGY ================
  { id: 'energy.max1', tree: 'energy', nameKey: 'skill.energy.max1.name', descriptionKey: 'skill.energy.max1.desc', cost: 1, effect: { stat: 'maxEnergy', additive: 30 } },
  { id: 'energy.max2', tree: 'energy', nameKey: 'skill.energy.max2.name', descriptionKey: 'skill.energy.max2.desc', cost: 2, requires: 'energy.max1', effect: { stat: 'maxEnergy', additive: 30 } },
  { id: 'energy.regen1', tree: 'energy', nameKey: 'skill.energy.regen1.name', descriptionKey: 'skill.energy.regen1.desc', cost: 2, effect: { stat: 'energyRegen', multiplier: 1.80 } },
  { id: 'energy.hover', tree: 'energy', nameKey: 'skill.energy.hover.name', descriptionKey: 'skill.energy.hover.desc', cost: 4, effect: { stat: 'maxEnergy', unlock: 'hover' } },

  // ================ PROTOCOL ================
  { id: 'protocol.emp', tree: 'protocol', nameKey: 'skill.protocol.emp.name', descriptionKey: 'skill.protocol.emp.desc', cost: 3, effect: { stat: 'moveSpeed', unlock: 'emp' } },
  { id: 'protocol.hack1', tree: 'protocol', nameKey: 'skill.protocol.hack1.name', descriptionKey: 'skill.protocol.hack1.desc', cost: 4, requires: 'protocol.emp', effect: { stat: 'moveSpeed', unlock: 'hack' } },

  // ================ SURVIVAL ================
  { id: 'survival.health1', tree: 'survival', nameKey: 'skill.survival.health1.name', descriptionKey: 'skill.survival.health1.desc', cost: 1, effect: { stat: 'maxHealth', additive: 30 } },
  { id: 'survival.health2', tree: 'survival', nameKey: 'skill.survival.health2.name', descriptionKey: 'skill.survival.health2.desc', cost: 2, requires: 'survival.health1', effect: { stat: 'maxHealth', additive: 30 } },
  { id: 'survival.invuln1', tree: 'survival', nameKey: 'skill.survival.invuln1.name', descriptionKey: 'skill.survival.invuln1.desc', cost: 2, effect: { stat: 'invulnMs', multiplier: 1.3 } },
];

export function getSkill(id: string): SkillData | undefined {
  return SKILLS.find(s => s.id === id);
}

export function getSkillsByTree(tree: string): SkillData[] {
  return SKILLS.filter(s => s.tree === tree);
}
