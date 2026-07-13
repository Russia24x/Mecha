/**
 * MECHA: LAST PROTOCOL — Chassis Database
 *
 * The Chassis system is the foundation of player customization.
 * Each chassis defines:
 *   - Visual: which sprite builder to use (Scout/Assault/Titan)
 *   - Animation Profile: walk cycle speed, leg swing amplitude, bob amount
 *   - Movement Feel: speed multiplier, jump multiplier, dash multiplier
 *   - Combat Feel: melee damage multiplier, fire rate multiplier
 *
 * Architecture (future-proof):
 *   Player → selectedChassis → ChassisData → AnimationProfile + MovementFeel
 *   ↓
 *   MechaSpriteFactory.buildPlayer(chassisId) → loads correct visual + animation set
 *   ↓
 *   Combat Scene applies movement feel to physics + combat stats
 *
 * Adding a new chassis = adding one entry here + one builder in MechaSpriteFactory.
 */
import type { ChassisId, ChassisData } from '../types';

export const CHASSIS: Record<ChassisId, ChassisData> = {
  scout: {
    id: 'scout',
    nameKey: 'chassis.scout.name',
    descKey: 'chassis.scout.desc',
    category: 'light',
    scale: 0.85,
    anim: {
      walkSpeed: 1.4,
      walkAmplitude: 0.10,
      bobAmount: 2,
      idleSway: 0.5,
    },
    movement: {
      speedMult: 1.15,
      jumpMult: 1.10,
      dashMult: 1.20,
      dashCooldownMult: 0.85,
    },
    combat: {
      meleeMult: 0.85,
      fireRateMult: 1.10,
      maxHealthMult: 0.85,
      maxEnergyMult: 1.15,
    },
    color: 0x39d0d8,
    unlockedByDefault: true,
  },
  assault: {
    id: 'assault',
    nameKey: 'chassis.assault.name',
    descKey: 'chassis.assault.desc',
    category: 'balanced',
    scale: 1.0,
    anim: {
      walkSpeed: 1.0,
      walkAmplitude: 0.12,
      bobAmount: 2,
      idleSway: 0.3,
    },
    movement: {
      speedMult: 1.0,
      jumpMult: 1.0,
      dashMult: 1.0,
      dashCooldownMult: 1.0,
    },
    combat: {
      meleeMult: 1.0,
      fireRateMult: 1.0,
      maxHealthMult: 1.0,
      maxEnergyMult: 1.0,
    },
    color: 0xffc040,
    unlockedByDefault: true,
  },
  titan: {
    id: 'titan',
    nameKey: 'chassis.titan.name',
    descKey: 'chassis.titan.desc',
    category: 'heavy',
    scale: 1.15,
    anim: {
      walkSpeed: 0.7,
      walkAmplitude: 0.16,
      bobAmount: 3,
      idleSway: 0.2,
    },
    movement: {
      speedMult: 0.85,
      jumpMult: 0.85,
      dashMult: 0.80,
      dashCooldownMult: 1.20,
    },
    combat: {
      meleeMult: 1.30,
      fireRateMult: 0.90,
      maxHealthMult: 1.30,
      maxEnergyMult: 0.85,
    },
    color: 0xff6040,
    unlockedByDefault: true,
  },
};

export function getChassis(id: ChassisId): ChassisData {
  return CHASSIS[id];
}

export function getAllChassis(): ChassisData[] {
  return Object.values(CHASSIS);
}
