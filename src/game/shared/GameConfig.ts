/**
 * MECHA: LAST PROTOCOL - GameConfig
 * ═══════════════════════════════════════════════════════════
 * CENTRAL CONFIG FILE — all tunable game variables in one place.
 * Edit this file to balance the game. No need to touch gameplay code.
 *
 * In the future this could be loaded from a JSON file, database,
 * or server-side config for live balancing.
 *
 * Each variable has:
 *   - value
 *   - description (what it does)
 *   - dependencies (what it affects)
 * ═══════════════════════════════════════════════════════════
 */

export const GAME_CONFIG = {

  // ═══════════════════════════════════════════════════════════
  // PLAYER
  // Dependencies: Player.ts, SkillTree.ts
  // ═══════════════════════════════════════════════════════════
  PLAYER: {
    maxHealth:         { value: 150,   desc: 'Base max HP',                       affects: ['Player.health', 'HUD'] },
    maxEnergy:         { value: 100,   desc: 'Base max energy for fire/dash/melee', affects: ['Player.energy', 'HUD'] },
    energyRegen:       { value: 14,    desc: 'Energy regen per second',            affects: ['Player.energy'] },
    moveSpeed:         { value: 5.5,   desc: 'Horizontal move speed (px/frame)',    affects: ['Player movement'] },
    jumpVelocity:      { value: -11.5, desc: 'Jump force (negative = up)',         affects: ['Player jump height'] },
    dashSpeed:         { value: 10,    desc: 'Dash speed (px/frame)',              affects: ['Player dash'] },
    dashDurationMs:    { value: 220,   desc: 'Dash duration in ms',                affects: ['Player dash'] },
    dashCost:          { value: 22,    desc: 'Energy cost per dash',               affects: ['Player energy'] },
    dashCooldownMs:    { value: 600,   desc: 'Dash cooldown in ms',                affects: ['Player dash'] },
    fireCost:          { value: 3,     desc: 'Energy cost per plasma shot',         affects: ['Player energy'] },
    fireCooldownMs:    { value: 140,   desc: 'Plasma fire cooldown in ms',         affects: ['Player fire rate'] },
    bulletDamage:      { value: 18,    desc: 'Plasma bullet base damage',          affects: ['Combat damage'] },
    bulletSpeed:       { value: 13,    desc: 'Plasma bullet speed',               affects: ['Projectile'] },
    meleeDamage:       { value: 35,    desc: 'Melee slash damage',                affects: ['Combat damage'] },
    meleeRange:        { value: 60,    desc: 'Melee hit range in px',             affects: ['Combat range'] },
    meleeCooldownMs:   { value: 360,   desc: 'Melee cooldown in ms',              affects: ['Player melee'] },
    meleeCost:         { value: 6,     desc: 'Energy cost per melee',             affects: ['Player energy'] },
    invulnMs:          { value: 850,   desc: 'I-frames after taking damage (ms)',  affects: ['Player damage'] },
    bodyRadius:        { value: 18,    desc: 'Player physics body radius',        affects: ['Physics'] },
  },

  // ═══════════════════════════════════════════════════════════
  // ENEMIES
  // Dependencies: EnemyTypes.ts, Enemy.ts
  // ═══════════════════════════════════════════════════════════
  ENEMIES: {
    drone: {
      hp:              { value: 24,    desc: 'Drone health',                      affects: ['Enemy survival'] },
      speed:           { value: 1.4,   desc: 'Drone move speed',                  affects: ['Enemy movement'] },
      damage:          { value: 8,     desc: 'Drone contact damage',              affects: ['Player damage'] },
      detectionRange:  { value: 320,   desc: 'Drone detection range',             affects: ['Enemy AI'] },
      fireRateMs:      { value: 2200,  desc: 'Drone fire interval',               affects: ['Enemy attack'] },
      bulletSpeed:     { value: 5.5,   desc: 'Drone bullet speed',               affects: ['Enemy projectile'] },
      bulletDamage:    { value: 6,     desc: 'Drone bullet damage',              affects: ['Player damage'] },
      xpReward:        { value: 15,    desc: 'XP for killing a drone',           affects: ['Leveling'] },
    },
    spider: {
      hp:              { value: 55,    desc: 'Spider health',                     affects: ['Enemy survival'] },
      speed:           { value: 2.2,   desc: 'Spider move speed',                 affects: ['Enemy movement'] },
      damage:          { value: 14,    desc: 'Spider contact damage',             affects: ['Player damage'] },
      detectionRange:  { value: 280,   desc: 'Spider detection range',            affects: ['Enemy AI'] },
      lungeRange:      { value: 140,   desc: 'Spider lunge trigger range',        affects: ['Enemy attack'] },
      lungeSpeed:      { value: 7,     desc: 'Spider lunge speed',               affects: ['Enemy attack'] },
      xpReward:        { value: 25,    desc: 'XP for killing a spider',          affects: ['Leveling'] },
    },
    heavy: {
      hp:              { value: 140,   desc: 'Heavy health',                      affects: ['Enemy survival'] },
      speed:           { value: 0.9,   desc: 'Heavy move speed',                  affects: ['Enemy movement'] },
      damage:          { value: 22,    desc: 'Heavy contact damage',              affects: ['Player damage'] },
      detectionRange:  { value: 320,   desc: 'Heavy detection range',             affects: ['Enemy AI'] },
      chargeSpeed:     { value: 5,     desc: 'Heavy charge speed',               affects: ['Enemy attack'] },
      chargeCooldownMs:{ value: 2600,  desc: 'Heavy charge cooldown',            affects: ['Enemy attack'] },
      xpReward:        { value: 50,    desc: 'XP for killing a heavy',           affects: ['Leveling'] },
    },
  },

  // ═══════════════════════════════════════════════════════════
  // BOSS
  // Dependencies: Boss.ts
  // ═══════════════════════════════════════════════════════════
  BOSS: {
    stage1: {
      maxHealth:       { value: 1200,  desc: 'Stage 1 boss HP',                   affects: ['Boss survival'] },
      contactDamage:   { value: 28,    desc: 'Stage 1 boss contact damage',       affects: ['Player damage'] },
    },
    stage2: {
      maxHealth:       { value: 1800,  desc: 'Stage 2 (Enraged) boss HP',         affects: ['Boss survival'] },
      contactDamage:   { value: 36,    desc: 'Stage 2 boss contact damage',       affects: ['Player damage'] },
    },
    xpReward:          { value: 200,   desc: 'XP for killing boss (per stage)',  affects: ['Leveling'] },
  },

  // ═══════════════════════════════════════════════════════════
  // LEVELING / XP
  // Dependencies: SkillTree.ts
  // Balance: A full Stage 1 clear (~8 enemies + boss) gives ~270 XP.
  // Level 2 at 100 XP, Level 3 at ~283 XP, Level 4 at ~520 XP.
  // So a first clear should give ~2-3 levels = 2-3 skill points.
  // ═══════════════════════════════════════════════════════════
  LEVELING: {
    xpBase:            { value: 100,   desc: 'Base XP for level curve: 100 × level^1.5', affects: ['Level progression'] },
    xpExponent:        { value: 1.5,   desc: 'XP curve steepness (higher = slower leveling)', affects: ['Level progression'] },
    xpPerKill:         { value: 15,    desc: 'Default XP per enemy kill (overridden by enemy type)', affects: ['XP gain'] },
    xpPerBoss:         { value: 200,   desc: 'XP per boss kill',                  affects: ['XP gain'] },
    skillPointsPerLevel:{ value: 1,    desc: 'Skill points awarded per level up',  affects: ['Skill progression'] },
    startLevel:        { value: 1,     desc: 'Starting level',                    affects: ['New game'] },
    startSkillPoints:  { value: 0,     desc: 'Starting skill points (0 = must earn)', affects: ['New game'] },
  },

  // ═══════════════════════════════════════════════════════════
  // WEAPONS
  // Dependencies: Weapons.ts
  // ═══════════════════════════════════════════════════════════
  WEAPONS: {
    plasma: {
      damage:          { value: 18,    desc: 'Plasma bullet damage',              affects: ['Combat damage'] },
      cooldownMs:      { value: 140,   desc: 'Plasma fire cooldown',              affects: ['Fire rate'] },
      energyCost:      { value: 3,     desc: 'Plasma energy cost',               affects: ['Energy usage'] },
    },
    shotgun: {
      damage:          { value: 10,    desc: 'Per-pellet shotgun damage',         affects: ['Combat damage'] },
      cooldownMs:      { value: 480,   desc: 'Shotgun fire cooldown',             affects: ['Fire rate'] },
      energyCost:      { value: 8,     desc: 'Shotgun energy cost',              affects: ['Energy usage'] },
      pellets:         { value: 5,     desc: 'Pellets per shot',                 affects: ['Spread pattern'] },
      spread:          { value: 0.5,   desc: 'Spread angle in radians',          affects: ['Spread pattern'] },
    },
    laser: {
      damage:          { value: 14,    desc: 'Laser (hitscan) damage',           affects: ['Combat damage'] },
      cooldownMs:      { value: 90,    desc: 'Laser fire cooldown',              affects: ['Fire rate'] },
      energyCost:      { value: 4,     desc: 'Laser energy cost',               affects: ['Energy usage'] },
      range:           { value: 800,   desc: 'Laser range in px',               affects: ['Hit detection'] },
    },
    rocket: {
      damage:          { value: 60,    desc: 'Rocket direct damage',             affects: ['Combat damage'] },
      cooldownMs:      { value: 900,   desc: 'Rocket fire cooldown',             affects: ['Fire rate'] },
      energyCost:      { value: 18,    desc: 'Rocket energy cost',              affects: ['Energy usage'] },
      explosionRadius: { value: 90,    desc: 'Rocket explosion radius in px',    affects: ['AoE damage'] },
    },
  },

  // ═══════════════════════════════════════════════════════════
  // COMBAT FEEL
  // Dependencies: DamageSystem.ts
  // ═══════════════════════════════════════════════════════════
  COMBAT: {
    hitStopBaseMs:     { value: 40,    desc: 'Base hit-stop duration (ms)',       affects: ['Combat impact'] },
    hitStopPerDamage:  { value: 2,     desc: 'Additional hit-stop ms per damage', affects: ['Combat impact'] },
    hitStopMaxMs:      { value: 120,   desc: 'Max hit-stop duration',             affects: ['Combat impact'] },
    shakeBaseIntensity:{ value: 0.004, desc: 'Base screen shake intensity',       affects: ['Combat feel'] },
    shakePerDamage:    { value: 0.0008,desc: 'Additional shake per damage point', affects: ['Combat feel'] },
    shakeMaxIntensity: { value: 0.02,  desc: 'Max screen shake intensity',        affects: ['Combat feel'] },
    healthDropChance:  { value: 0.35,  desc: 'Chance (0-1) for enemy to drop health', affects: ['Pickups'] },
    healthDropAmount:  { value: 30,    desc: 'HP restored by health pickup',     affects: ['Pickups'] },
    healthDropTtl:     { value: 10000, desc: 'Health pickup despawn time (ms)',  affects: ['Pickups'] },
    spikeTrapDamage:   { value: 15,    desc: 'Damage from spike trap contact',   affects: ['Hazards'] },
  },

  // ═══════════════════════════════════════════════════════════
  // RAGDOLL
  // Dependencies: Ragdoll.ts
  // ═══════════════════════════════════════════════════════════
  RAGDOLL: {
    poolCap:           { value: 30,    desc: 'Max concurrent ragdolls',           affects: ['Performance'] },
    lifetimeMs:        { value: 6000,  desc: 'Ragdoll despawn time',             affects: ['Performance'] },
    pinStiffness:      { value: 0.4,   desc: 'Joint stiffness (lower = floppier)', affects: ['Ragdoll physics'] },
    pinDamping:        { value: 0.1,   desc: 'Joint damping',                    affects: ['Ragdoll physics'] },
  },

  // ═══════════════════════════════════════════════════════════
  // AUDIO
  // Dependencies: Effects.ts
  // ═══════════════════════════════════════════════════════════
  AUDIO: {
    masterVolume:      { value: 0.7,   desc: 'Master volume (0-1)',              affects: ['All audio'] },
    musicVolume:       { value: 0.4,   desc: 'Music volume (0-1)',               affects: ['Music'] },
    sfxVolume:         { value: 0.8,   desc: 'SFX volume (0-1)',                 affects: ['Sound effects'] },
  },

  // ═══════════════════════════════════════════════════════════
  // RENDERING
  // Dependencies: PhaserGame.ts, Graphics.ts
  // ═══════════════════════════════════════════════════════════
  RENDERING: {
    targetFps:         { value: 60,    desc: 'Target frame rate',                affects: ['Performance'] },
    antialias:         { value: true,  desc: 'MSAA on renderbuffers',            affects: ['Visual quality'] },
    darknessAlpha:     { value: 0.55,  desc: 'Darkness overlay alpha for lighting', affects: ['Lighting'] },
    parallaxLayers:    { value: 5,     desc: 'Number of parallax background layers', affects: ['Visual depth'] },
  },
};

// ═══════════════════════════════════════════════════════════
// HELPER: flatten config for display/editing
// ═══════════════════════════════════════════════════════════
export function getAllConfigVariables(): { path: string; value: number | boolean | string; desc: string; affects: string[] }[] {
  const result: { path: string; value: number | boolean | string; desc: string; affects: string[] }[] = [];
  function walk(obj: Record<string, unknown>, prefix: string) {
    for (const key in obj) {
      const val = obj[key];
      const path = prefix ? `${prefix}.${key}` : key;
      if (val && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
        const v = val as { value: unknown; desc: string; affects: string[] };
        result.push({ path, value: v.value as number | boolean | string, desc: v.desc, affects: v.affects });
      } else if (val && typeof val === 'object') {
        walk(val as Record<string, unknown>, path);
      }
    }
  }
  walk(GAME_CONFIG as unknown as Record<string, unknown>, '');
  return result;
}

export default GAME_CONFIG;
