/**
 * MECHA: LAST PROTOCOL — Item Database
 */
import type { ItemData } from '../types';

export const ITEMS: Record<string, ItemData> = {
  // Materials
  scrap_metal: {
    id: 'scrap_metal', nameKey: 'item.scrap_metal.name', descriptionKey: 'item.scrap_metal.desc',
    type: 'material', stackable: true, maxStack: 99,
  },
  circuit_board: {
    id: 'circuit_board', nameKey: 'item.circuit_board.name', descriptionKey: 'item.circuit_board.desc',
    type: 'material', stackable: true, maxStack: 99,
  },
  armor_plate: {
    id: 'armor_plate', nameKey: 'item.armor_plate.name', descriptionKey: 'item.armor_plate.desc',
    type: 'material', stackable: true, maxStack: 99,
  },
  precision_lens: {
    id: 'precision_lens', nameKey: 'item.precision_lens.name', descriptionKey: 'item.precision_lens.desc',
    type: 'material', stackable: true, maxStack: 99,
  },
  ai_chip: {
    id: 'ai_chip', nameKey: 'item.ai_chip.name', descriptionKey: 'item.ai_chip.desc',
    type: 'material', stackable: true, maxStack: 99,
  },
  elite_core: {
    id: 'elite_core', nameKey: 'item.elite_core.name', descriptionKey: 'item.elite_core.desc',
    type: 'material', stackable: true, maxStack: 99,
  },
  weapon_part: {
    id: 'weapon_part', nameKey: 'item.weapon_part.name', descriptionKey: 'item.weapon_part.desc',
    type: 'material', stackable: true, maxStack: 99,
  },

  // Key Items (boss drops)
  guardian_core: {
    id: 'guardian_core', nameKey: 'item.guardian_core.name', descriptionKey: 'item.guardian_core.desc',
    type: 'key_item', stackable: false, maxStack: 1,
  },
  overseer_eye: {
    id: 'overseer_eye', nameKey: 'item.overseer_eye.name', descriptionKey: 'item.overseer_eye.desc',
    type: 'key_item', stackable: false, maxStack: 1,
  },

  // Consumables
  health_pack: {
    id: 'health_pack', nameKey: 'item.health_pack.name', descriptionKey: 'item.health_pack.desc',
    type: 'consumable', stackable: true, maxStack: 10,
    effect: { type: 'heal', value: 50 },
  },
  energy_cell: {
    id: 'energy_cell', nameKey: 'item.energy_cell.name', descriptionKey: 'item.energy_cell.desc',
    type: 'consumable', stackable: true, maxStack: 10,
    effect: { type: 'energy', value: 50 },
  },

  // Abilities (unlock items)
  ability_double_jump: {
    id: 'ability_double_jump', nameKey: 'ability.double_jump.name', descriptionKey: 'ability.double_jump.desc',
    type: 'ability', stackable: false, maxStack: 1,
  },
  ability_wall_jump: {
    id: 'ability_wall_jump', nameKey: 'ability.wall_jump.name', descriptionKey: 'ability.wall_jump.desc',
    type: 'ability', stackable: false, maxStack: 1,
  },
  ability_grapple: {
    id: 'ability_grapple', nameKey: 'ability.grapple.name', descriptionKey: 'ability.grapple.desc',
    type: 'ability', stackable: false, maxStack: 1,
  },
  ability_emp: {
    id: 'ability_emp', nameKey: 'ability.emp.name', descriptionKey: 'ability.emp.desc',
    type: 'ability', stackable: false, maxStack: 1,
  },
  ability_hover: {
    id: 'ability_hover', nameKey: 'ability.hover.name', descriptionKey: 'ability.hover.desc',
    type: 'ability', stackable: false, maxStack: 1,
  },
};

export function getItem(id: string): ItemData | undefined {
  return ITEMS[id];
}
