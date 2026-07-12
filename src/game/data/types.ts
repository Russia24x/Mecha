/**
 * MECHA: LAST PROTOCOL — Core Type Definitions
 * All game data types. No implementation, just shapes.
 * Every entity in the game is described by these interfaces.
 */

// ================ DIRECTION ================
export type Direction = 'left' | 'right';

// ================ LOCALIZATION ================
export type Locale = 'en' | 'fa';

// ================ PLAYER ================
export interface PlayerStats {
  maxHealth: number;
  maxEnergy: number;
  energyRegen: number;
  moveSpeed: number;
  jumpVelocity: number;
  dashSpeed: number;
  dashDurationMs: number;
  dashCooldownMs: number;
  meleeDamage: number;
  meleeRange: number;
  fireCooldownMs: number;
  invulnMs: number;
}

export interface PlayerState {
  level: number;
  xp: number;
  skillPoints: number;
  totalKills: number;
  bossesKilled: number;
  unlockedSkills: string[];
  unlockedWeapons: string[];
  currentWeapon: string;
  weaponLevels: Record<string, number>;
  inventory: InventoryItem[];
  abilities: string[];
}

// ================ WEAPONS ================
export type WeaponId = 'assault_rifle' | 'shotgun' | 'railgun' | 'plasma_cannon' | 'laser' | 'rocket' | 'sword' | 'energy_blade';

export type WeaponTier = 'hitscan' | 'projectile' | 'explosive' | 'melee';

export interface WeaponData {
  id: WeaponId;
  nameKey: string;          // localization key
  tier: WeaponTier;
  damage: number;
  range: number;
  fireRateMs: number;
  energyCost: number;
  bulletSpeed?: number;
  bulletsPerShot?: number;
  spread?: number;
  explosionRadius?: number;
  color: number;
  size: number;
  passiveBonus?: PassiveBonus;
  unlockRequirement?: string;  // e.g. 'kill_drone_10' or 'boss_1'
}

export interface PassiveBonus {
  type: 'damage' | 'fireRate' | 'energyCost' | 'speed';
  value: number;
}

// ================ SKILLS ================
export type SkillTree = 'combat' | 'weapon' | 'movement' | 'energy' | 'protocol' | 'survival';

export interface SkillData {
  id: string;
  tree: SkillTree;
  nameKey: string;
  descriptionKey: string;
  cost: number;
  requires?: string;
  effect: SkillEffect;
  /** Visual tier: 0=minor, 1=notable, 2=keystone (bigger node, stronger effect) */
  tier?: 0 | 1 | 2;
  /** Optional explicit grid position override (x, y in grid units) */
  pos?: { x: number; y: number };
  /** Skill category for icon selection */
  category?: 'damage' | 'speed' | 'defense' | 'ability' | 'unlock' | 'utility';
}

export interface SkillEffect {
  stat: keyof PlayerStats;
  multiplier?: number;    // multiply base stat
  additive?: number;      // add to base stat
  unlock?: string;        // unlock ability (doubleJump, wallJump, etc.)
}

// ================ ENEMIES ================
export type EnemyTypeId = 'drone' | 'spider' | 'heavy' | 'sniper' | 'flying_ai' | 'elite';
export type EnemyState = 'patrol' | 'aggro' | 'attack' | 'stagger';

export type EnemyAttackType = 'shoot' | 'lunge' | 'charge' | 'snipe';

export interface EnemyData {
  id: EnemyTypeId;
  nameKey: string;
  hp: number;
  speed: number;
  damage: number;
  detectionRange: number;
  attackRange: number;
  attackType: EnemyAttackType;
  flying: boolean;
  score: number;
  xpReward: number;
  color: number;
  size: { w: number; h: number };
  bulletSpeed?: number;
  bulletDamage?: number;
  lungeSpeed?: number;
  chargeSpeed?: number;
  timings: { telegraphMs: number; windowMs: number; recoveryMs: number };
  drops?: DropTable[];
}

export interface DropTable {
  itemId: string;
  chance: number;
  minAmount: number;
  maxAmount: number;
}

// ================ BOSSES ================
export interface BossPhase {
  healthPct: number;
  speed: number;
  fireRateMs: number;
  attacks: string[];
}

export interface BossData {
  id: string;
  nameKey: string;
  maxHealth: number;
  contactDamage: number;
  phases: BossPhase[];
  lore: string[];           // localization keys
  arenaWidth: number;
  arenaHeight: number;
  musicTrack?: string;
  drops: DropTable[];
}

// ================ ITEMS ================
export type ItemType = 'material' | 'key_item' | 'quest_item' | 'consumable' | 'ability';

export interface ItemData {
  id: string;
  nameKey: string;
  descriptionKey: string;
  type: ItemType;
  icon?: string;
  stackable: boolean;
  maxStack: number;
  effect?: ItemEffect;
}

export interface ItemEffect {
  type: 'heal' | 'energy' | 'buff';
  value: number;
  durationMs?: number;
}

export interface InventoryItem {
  itemId: string;
  amount: number;
}

// ================ WORLD ================
export interface ActData {
  id: number;
  nameKey: string;
  regions: RegionData[];
}

export interface RegionData {
  id: string;
  nameKey: string;
  areas: AreaData[];
}

export interface AreaData {
  id: string;
  nameKey: string;
  regionId: string;
  totalWidth: number;
  sectionWidth: number;
  sections: SectionData[];
  bgColor: number;
  bgImage?: string;
  parallaxLayers?: ParallaxLayerData[];
  checkpointSections: number[];
  bossId?: string;
  unlockedByDefault: boolean;
  requiredAbility?: string;
}

export interface SectionData {
  id: number;
  nameKey: string;
  x: number;
  enemies: string[];
  bossId?: string;
  platforms?: PlatformData[];
  hazards?: HazardData[];
  loreObjects?: LoreObjectData[];
  landmarks?: LandmarkData[];
}

export interface LoreObjectData {
  id: string;
  type: 'terminal' | 'corpse' | 'echo';
  x: number;
  y: number;
  titleKey: string;
  textKey: string;
}

export interface LandmarkData {
  id: string;
  type: 'crashed_mech' | 'control_room' | 'assembly_line' | 'tower' | 'statue';
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

export interface PlatformData {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HazardData {
  type: 'spike' | 'lava' | 'laser';
  x: number;
  y: number;
  w: number;
  h: number;
  damage: number;
}

export interface ParallaxLayerData {
  texture?: string;
  scrollFactor: number;
  alpha: number;
  depth: number;
}

// ================ NPC ================
export interface NPCData {
  id: string;
  nameKey: string;
  areaId: string;
  x: number;
  y: number;
  dialogues: string[];     // dialogue IDs
  shopId?: string;
  questIds?: string[];
  flags: Record<string, boolean>;
}

export interface DialogueData {
  id: string;
  type: 'normal' | 'quest' | 'boss' | 'hidden';
  npcId: string;
  lines: string[];         // localization keys
  conditionFlag?: string;
  setFlag?: string;
}

// ================ QUESTS ================
export type QuestType = 'main' | 'side' | 'hidden' | 'npc';

export interface QuestData {
  id: string;
  nameKey: string;
  descriptionKey: string;
  type: QuestType;
  objectives: QuestObjective[];
  rewardXp: number;
  rewardItems?: InventoryItem[];
  prerequisiteQuestId?: string;
}

export interface QuestObjective {
  type: 'kill' | 'collect' | 'reach' | 'talk' | 'boss';
  target: string;
  amount: number;
}

// ================ SAVE ================
export interface CheckpointData {
  actId: number;
  regionId: string;
  areaId: string;
  section: number;
  x: number;
  y: number;
  timestamp: number;
}

export interface GameSettings {
  locale: Locale;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  brightness: number;
}

export interface SaveData {
  version: number;
  player: PlayerState;
  checkpoint: CheckpointData | null;
  bestBossTimes: Record<string, number>;
  settings: GameSettings;
  questFlags: Record<string, boolean>;
  npcFlags: Record<string, Record<string, boolean>>;
  unlockedAreas: string[];
  discoveredAreas: string[];
}

// ================ EVENTS ================
export type GameEvent =
  | 'PLAYER_DAMAGED'
  | 'PLAYER_DEAD'
  | 'ENEMY_DEAD'
  | 'BOSS_PHASE'
  | 'BOSS_DEAD'
  | 'CHECKPOINT'
  | 'GAME_STATE'
  | 'LEVEL_UP'
  | 'SKILL_UNLOCKED'
  | 'WEAPON_UNLOCKED'
  | 'ITEM_COLLECTED'
  | 'ITEM_USED'
  | 'QUEST_UPDATED'
  | 'QUEST_COMPLETE'
  | 'DIALOGUE_START'
  | 'DIALOGUE_END'
  | 'AREA_ENTER'
  | 'ABILITY_UNLOCKED';
