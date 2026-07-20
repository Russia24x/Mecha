/**
 * MECHA: LAST PROTOCOL — Skill Tree Database v2.0
 *
 * EXPANDED: More skills per tree, tiered (minor/notable/keystone),
 * category-tagged for icon selection, explicit positions for layout.
 *
 * Inspired by Path of Exile / Diablo / Last Epoch:
 *   - Minor nodes (tier 0): small stat boosts, cheap
 *   - Notable nodes (tier 1): significant bonuses, medium cost
 *   - Keystone nodes (tier 2): game-changing abilities, expensive
 *
 * Each tree has 6-8 skills arranged in a branching layout.
 */
import type { SkillData } from '../types';

export const SKILLS: SkillData[] = [
  // ================ COMBAT (⚔) — red ====================
  // Tier 0: minor damage upgrades
  { id: 'combat.damage1', tree: 'combat', nameKey: 'skill.combat.damage1.name', descriptionKey: 'skill.combat.damage1.desc',
    cost: 1, tier: 0, category: 'damage', pos: { x: 0, y: 0 },
    effect: { stat: 'meleeDamage', multiplier: 1.20 } },
  { id: 'combat.damage2', tree: 'combat', nameKey: 'skill.combat.damage2.name', descriptionKey: 'skill.combat.damage2.desc',
    cost: 2, tier: 0, category: 'damage', requires: 'combat.damage1', pos: { x: -1, y: 1 },
    effect: { stat: 'meleeDamage', multiplier: 1.20 } },
  { id: 'combat.fireRate1', tree: 'combat', nameKey: 'skill.combat.fireRate1.name', descriptionKey: 'skill.combat.fireRate1.desc',
    cost: 2, tier: 0, category: 'speed', pos: { x: 1, y: 1 },
    effect: { stat: 'fireCooldownMs', multiplier: 0.75 } },
  // Tier 1: notable
  { id: 'combat.arsenal', tree: 'combat', nameKey: 'skill.combat.arsenal.name', descriptionKey: 'skill.combat.arsenal.desc',
    cost: 3, tier: 1, category: 'damage', requires: 'combat.damage2', pos: { x: -1, y: 2 },
    effect: { stat: 'meleeDamage', multiplier: 1.35 } },
  { id: 'combat.rapid', tree: 'combat', nameKey: 'skill.combat.rapid.name', descriptionKey: 'skill.combat.rapid.desc',
    cost: 3, tier: 1, category: 'speed', requires: 'combat.fireRate1', pos: { x: 1, y: 2 },
    effect: { stat: 'fireCooldownMs', multiplier: 0.60 } },
  // Tier 2: keystone
  { id: 'combat.overload', tree: 'combat', nameKey: 'skill.combat.overload.name', descriptionKey: 'skill.combat.overload.desc',
    cost: 5, tier: 2, category: 'damage', requires: 'combat.arsenal', pos: { x: -1, y: 3 },
    effect: { stat: 'meleeDamage', multiplier: 1.50 } },

  // ================ WEAPON (🔫) — yellow ====================
  { id: 'weapon.unlock_shotgun', tree: 'weapon', nameKey: 'skill.weapon.shotgun.name', descriptionKey: 'skill.weapon.shotgun.desc',
    cost: 1, tier: 0, category: 'unlock', pos: { x: 0, y: 0 },
    effect: { stat: 'moveSpeed', unlock: 'shotgun' } },
  { id: 'weapon.unlock_railgun', tree: 'weapon', nameKey: 'skill.weapon.railgun.name', descriptionKey: 'skill.weapon.railgun.desc',
    cost: 2, tier: 0, category: 'unlock', requires: 'weapon.unlock_shotgun', pos: { x: -1, y: 1 },
    effect: { stat: 'moveSpeed', unlock: 'railgun' } },
  { id: 'weapon.unlock_laser', tree: 'weapon', nameKey: 'skill.weapon.laser.name', descriptionKey: 'skill.weapon.laser.desc',
    cost: 3, tier: 1, category: 'unlock', requires: 'weapon.unlock_railgun', pos: { x: -2, y: 2 },
    effect: { stat: 'moveSpeed', unlock: 'laser' } },
  { id: 'weapon.unlock_rocket', tree: 'weapon', nameKey: 'skill.weapon.rocket.name', descriptionKey: 'skill.weapon.rocket.desc',
    cost: 3, tier: 1, category: 'unlock', requires: 'weapon.unlock_shotgun', pos: { x: 1, y: 1 },
    effect: { stat: 'moveSpeed', unlock: 'rocket' } },
  // Tier 2: keystone — dual wield
  { id: 'weapon.dualwield', tree: 'weapon', nameKey: 'skill.weapon.dualwield.name', descriptionKey: 'skill.weapon.dualwield.desc',
    cost: 5, tier: 2, category: 'ability', requires: 'weapon.unlock_rocket', pos: { x: 1, y: 2 },
    effect: { stat: 'fireCooldownMs', multiplier: 0.70 } },

  // ================ MOVEMENT (➤) — blue ====================
  { id: 'movement.speed1', tree: 'movement', nameKey: 'skill.movement.speed1.name', descriptionKey: 'skill.movement.speed1.desc',
    cost: 1, tier: 0, category: 'speed', pos: { x: 0, y: 0 },
    effect: { stat: 'moveSpeed', multiplier: 1.12 } },
  { id: 'movement.speed2', tree: 'movement', nameKey: 'skill.movement.speed2.name', descriptionKey: 'skill.movement.speed2.desc',
    cost: 2, tier: 0, category: 'speed', requires: 'movement.speed1', pos: { x: -1, y: 1 },
    effect: { stat: 'moveSpeed', multiplier: 1.12 } },
  { id: 'movement.dashCd1', tree: 'movement', nameKey: 'skill.movement.dashCd1.name', descriptionKey: 'skill.movement.dashCd1.desc',
    cost: 2, tier: 0, category: 'speed', pos: { x: 1, y: 1 },
    effect: { stat: 'dashCooldownMs', multiplier: 0.65 } },
  // Tier 1: notable — abilities
  { id: 'movement.doubleJump', tree: 'movement', nameKey: 'skill.movement.doubleJump.name', descriptionKey: 'skill.movement.doubleJump.desc',
    cost: 3, tier: 1, category: 'ability', requires: 'movement.speed2', pos: { x: -1, y: 2 },
    effect: { stat: 'moveSpeed', unlock: 'doubleJump' } },
  { id: 'movement.wallJump', tree: 'movement', nameKey: 'skill.movement.wallJump.name', descriptionKey: 'skill.movement.wallJump.desc',
    cost: 3, tier: 1, category: 'ability', requires: 'movement.dashCd1', pos: { x: 1, y: 2 },
    effect: { stat: 'moveSpeed', unlock: 'wallJump' } },
  // Tier 2: keystone — grapple
  { id: 'movement.grapple', tree: 'movement', nameKey: 'skill.movement.grapple.name', descriptionKey: 'skill.movement.grapple.desc',
    cost: 5, tier: 2, category: 'ability', requires: 'movement.wallJump', pos: { x: 1, y: 3 },
    effect: { stat: 'moveSpeed', unlock: 'grapple' } },

  // ================ ENERGY (⚡) — green ====================
  { id: 'energy.max1', tree: 'energy', nameKey: 'skill.energy.max1.name', descriptionKey: 'skill.energy.max1.desc',
    cost: 1, tier: 0, category: 'utility', pos: { x: 0, y: 0 },
    effect: { stat: 'maxEnergy', additive: 30 } },
  { id: 'energy.max2', tree: 'energy', nameKey: 'skill.energy.max2.name', descriptionKey: 'skill.energy.max2.desc',
    cost: 2, tier: 0, category: 'utility', requires: 'energy.max1', pos: { x: -1, y: 1 },
    effect: { stat: 'maxEnergy', additive: 30 } },
  { id: 'energy.regen1', tree: 'energy', nameKey: 'skill.energy.regen1.name', descriptionKey: 'skill.energy.regen1.desc',
    cost: 2, tier: 0, category: 'utility', pos: { x: 1, y: 1 },
    effect: { stat: 'energyRegen', multiplier: 1.80 } },
  // Tier 1: notable — hover ability
  { id: 'energy.hover', tree: 'energy', nameKey: 'skill.energy.hover.name', descriptionKey: 'skill.energy.hover.desc',
    cost: 4, tier: 1, category: 'ability', requires: 'energy.regen1', pos: { x: 1, y: 2 },
    effect: { stat: 'maxEnergy', unlock: 'hover' } },
  // Tier 2: keystone — overcharge
  { id: 'energy.overcharge', tree: 'energy', nameKey: 'skill.energy.overcharge.name', descriptionKey: 'skill.energy.overcharge.desc',
    cost: 5, tier: 2, category: 'ability', requires: 'energy.hover', pos: { x: 1, y: 3 },
    effect: { stat: 'maxEnergy', additive: 80 } },

  // ================ PROTOCOL (◈) — purple ====================
  { id: 'protocol.emp', tree: 'protocol', nameKey: 'skill.protocol.emp.name', descriptionKey: 'skill.protocol.emp.desc',
    cost: 3, tier: 1, category: 'ability', pos: { x: 0, y: 0 },
    effect: { stat: 'moveSpeed', unlock: 'emp' } },
  { id: 'protocol.hack1', tree: 'protocol', nameKey: 'skill.protocol.hack1.name', descriptionKey: 'skill.protocol.hack1.desc',
    cost: 4, tier: 1, category: 'ability', requires: 'protocol.emp', pos: { x: 0, y: 1 },
    effect: { stat: 'moveSpeed', unlock: 'hack' } },
  // Tier 2: keystone — override
  { id: 'protocol.override', tree: 'protocol', nameKey: 'skill.protocol.override.name', descriptionKey: 'skill.protocol.override.desc',
    cost: 6, tier: 2, category: 'ability', requires: 'protocol.hack1', pos: { x: 0, y: 2 },
    effect: { stat: 'invulnMs', multiplier: 1.5 } },

  // ================ SURVIVAL (♥) — green ====================
  { id: 'survival.health1', tree: 'survival', nameKey: 'skill.survival.health1.name', descriptionKey: 'skill.survival.health1.desc',
    cost: 1, tier: 0, category: 'defense', pos: { x: 0, y: 0 },
    effect: { stat: 'maxHealth', additive: 30 } },
  { id: 'survival.health2', tree: 'survival', nameKey: 'skill.survival.health2.name', descriptionKey: 'skill.survival.health2.desc',
    cost: 2, tier: 0, category: 'defense', requires: 'survival.health1', pos: { x: -1, y: 1 },
    effect: { stat: 'maxHealth', additive: 30 } },
  { id: 'survival.invuln1', tree: 'survival', nameKey: 'skill.survival.invuln1.name', descriptionKey: 'skill.survival.invuln1.desc',
    cost: 2, tier: 0, category: 'defense', pos: { x: 1, y: 1 },
    effect: { stat: 'invulnMs', multiplier: 1.3 } },
  // Tier 1: notable
  { id: 'survival.armor', tree: 'survival', nameKey: 'skill.survival.armor.name', descriptionKey: 'skill.survival.armor.desc',
    cost: 3, tier: 1, category: 'defense', requires: 'survival.health2', pos: { x: -1, y: 2 },
    effect: { stat: 'maxHealth', additive: 60 } },
  // Tier 2: keystone — last stand
  { id: 'survival.laststand', tree: 'survival', nameKey: 'skill.survival.laststand.name', descriptionKey: 'skill.survival.laststand.desc',
    cost: 5, tier: 2, category: 'defense', requires: 'survival.armor', pos: { x: -1, y: 3 },
    effect: { stat: 'invulnMs', multiplier: 1.8 } },
];

export function getSkill(id: string): SkillData | undefined {
  return SKILLS.find(s => s.id === id);
}

export function getSkillsByTree(tree: string): SkillData[] {
  return SKILLS.filter(s => s.tree === tree);
}
