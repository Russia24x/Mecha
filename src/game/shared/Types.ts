/**
 * MECHA: LAST PROTOCOL - Types (supplement for physics)
 */

export interface MatterBodyConfig {
  label?: string;
  isStatic?: boolean;
  isSensor?: boolean;
  friction?: number;
  frictionAir?: number;
  density?: number;
  restitution?: number;
  fixedRotation?: boolean;
  ignoreGravity?: boolean;
  collisionFilter?: {
    category?: number;
    mask?: number;
    group?: number;
  };
}
