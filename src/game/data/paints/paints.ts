/**
 * MECHA: LAST PROTOCOL — Paint Database
 *
 * Paints are cosmetic color schemes for the player's mech.
 * Each paint defines a primary body color + accent trim color.
 *
 * Architecture: MechaSpriteFactory applies the paint tint when building the player visual.
 * Adding a new paint = adding one entry here + localization keys.
 */
import type { PaintId, PaintData } from '../types';

export const PAINTS: Record<PaintId, PaintData> = {
  factory_gray: {
    id: 'factory_gray',
    nameKey: 'paint.factory_gray.name',
    descKey: 'paint.factory_gray.desc',
    primaryColor: 0x2a3850,
    accentColor: 0x39d0d8,
    unlockedByDefault: true,
  },
  military_green: {
    id: 'military_green',
    nameKey: 'paint.military_green.name',
    descKey: 'paint.military_green.desc',
    primaryColor: 0x2a3a1a,
    accentColor: 0x80a040,
    unlockedByDefault: false,
  },
  protocol_white: {
    id: 'protocol_white',
    nameKey: 'paint.protocol_white.name',
    descKey: 'paint.protocol_white.desc',
    primaryColor: 0x808898,
    accentColor: 0xffc040,
    unlockedByDefault: false,
  },
  rust: {
    id: 'rust',
    nameKey: 'paint.rust.name',
    descKey: 'paint.rust.desc',
    primaryColor: 0x4a2a1a,
    accentColor: 0x8a4a2a,
    unlockedByDefault: false,
  },
};

export function getPaint(id: PaintId): PaintData {
  return PAINTS[id];
}

export function getAllPaints(): PaintData[] {
  return Object.values(PAINTS);
}
