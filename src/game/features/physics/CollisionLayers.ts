/**
 * MECHA: LAST PROTOCOL - Collision Layers
 * Matter.js body config helpers.
 */

import type { MatterBodyConfig } from '../Types';

export function bodyConfig(label: string, extra?: MatterBodyConfig): MatterBodyConfig {
  return {
    label,
    ...extra,
  };
}

export type { MatterBodyConfig } from '../Types';
