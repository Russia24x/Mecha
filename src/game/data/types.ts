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
  collectedCollectibles: string[];
  openedShortcuts: string[];
  // ── Hangar customization ──
  selectedChassis: string;        // 'scout' | 'assault' | 'titan'
  selectedPaint: string;          // 'factory_gray' | 'military_green' | ...
  unlockedChassis: string[];      // unlocked chassis IDs
  unlockedPaints: string[];       // unlocked paint IDs
  unlockedCompanions: string[];   // unlocked companion IDs (future)
  selectedCompanion: string | null; // currently equipped companion (null = none)
}

// ================ CHASSIS ================
export type ChassisId = 'scout' | 'assault' | 'titan';

export interface ChassisAnimProfile {
  walkSpeed: number;       // leg swing cycle multiplier
  walkAmplitude: number;   // leg swing angle amplitude (radians)
  bobAmount: number;       // vertical bob amount (pixels)
  idleSway: number;        // idle body sway amount
}

export interface ChassisMovementFeel {
  speedMult: number;
  jumpMult: number;
  dashMult: number;
  dashCooldownMult: number;
}

export interface ChassisCombatFeel {
  meleeMult: number;
  fireRateMult: number;
  maxHealthMult: number;
  maxEnergyMult: number;
}

export interface ChassisData {
  id: ChassisId;
  nameKey: string;
  descKey: string;
  category: 'light' | 'balanced' | 'heavy';
  scale: number;           // visual scale multiplier
  anim: ChassisAnimProfile;
  movement: ChassisMovementFeel;
  combat: ChassisCombatFeel;
  color: number;           // accent color
  unlockedByDefault: boolean;
}

// ================ PAINT ================
export type PaintId = 'factory_gray' | 'military_green' | 'protocol_white' | 'rust';

export interface PaintData {
  id: PaintId;
  nameKey: string;
  descKey: string;
  primaryColor: number;    // main body color
  accentColor: number;     // accent/trim color
  unlockedByDefault: boolean;
}

// ================ COMPANION ================
export type CompanionId = 'protocol_echo' | 'scout_drone' | 'repair_drone' | 'scanner_drone' | 'shield_drone' | 'medic_drone' | 'cargo_drone';

export interface CompanionData {
  id: CompanionId;
  nameKey: string;
  descKey: string;
  category: 'combat' | 'support' | 'utility' | 'story';
  color: number;
  unlockedByDefault: boolean;
  // Future hooks (not implemented yet, but architecture-ready):
  // followBehavior: 'hover' | 'orbit' | 'trail';
  // abilities: string[];  // e.g. ['scan', 'heal', 'shield']
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
export type EnemyTypeId = 'drone' | 'spider' | 'heavy' | 'sniper' | 'flying_ai' | 'elite' | 'drowned_walker' | 'mosquito_drone';
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
  hackable?: boolean;  // Can be hacked with the Hack ability
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
  /** Attack selection mode:
   *  - 'random' (default): picks a random attack from the list each cycle
   *  - 'sequential': cycles through attacks in order (for fixed-pattern bosses)
   *  Used by Iron Magistrate for predictable "justice" pattern.
   */
  attackPattern?: 'random' | 'sequential';
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
  /** Boss-specific maxPosture (default 100 if not set).
   *  Iron Magistrate = 130 (harder to stagger — "justice is rigid") */
  maxPosture?: number;
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
  grappleAnchors?: GrappleAnchorData[];
  empDoors?: EmpDoorData[];
  shortcuts?: ShortcutData[];
  collectibles?: CollectibleData[];
  secretRooms?: SecretRoomData[];
  bonfires?: BonfireData[];
  exitGates?: ExitGateData[];
  /** Destructible explosive barrels — shootable objects that explode on hit. */
  barrels?: BarrelData[];
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

// ── Ability-gated content (Metroidvania) ──
export interface GrappleAnchorData {
  id: string;
  x: number;
  y: number;
}

export interface EmpDoorData {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Bonfire (Dark Souls-style save point) ──
/** A terminal/save point the player can rest at to heal + save + fast-travel.
 *  Visual: a mech terminal with amber glow that brightens when activated.
 *  Placement rule (per advisor):
 *    - Area with 2 sections: 2 bonfires (section 1 start + near boss/gate)
 *    - Area with 4 sections: 2-3 bonfires (start + mid + near boss/gate)
 *
 *  preLit policy (per advisor Point 2):
 *    - ONLY the very first bonfire of the game (bf_factory1_1) is `preLit: true`.
 *      This is the global anchor — the player has nowhere been before, so the
 *      entry bonfire must already be lit.
 *    - For every other area, the entry bonfire is NOT preLit in static data.
 *      Instead, it is lit dynamically via `SaveSystem.lightBonfire()` when the
 *      player crosses the destination area's entry exit gate (event-driven,
 *      single source of truth — the gate crossing).
 *    - This preserves the World Map gate (clause 4.2: only LIT bonfires are
 *      selectable as fast-travel destinations) — players cannot fast-travel to
 *      an area they have not yet entered on foot.
 *    - Implementation: see Phase C — ExitGateController.onAreaExit handler.
 */
export interface BonfireData {
  id: string;          // e.g. 'bf_factory1_1', 'bf_factory1_2'
  x: number;
  y: number;
  section: number;     // which section this bonfire is in
  /** If true, bonfire is already lit when player enters the area (no interact needed).
   *  RESERVED for the game-start anchor only (bf_factory1_1). See policy above. */
  preLit?: boolean;
  /** If true, this is the entry bonfire for the area — it gets auto-lit when the
   *  player crosses an exit gate INTO this area (Phase C3 enforcement of preLit
   *  policy). Exactly one bonfire per area should have this flag.
   *
   *  Per advisor Note 2: this is a STATIC field in data (not a naming convention
   *  like `bf_X_1` or array index) because:
   *  - Act II has the largest area (15360px) → 3 areas with multiple bonfires each.
   *  - Array order has been rebased multiple times in acts.ts history (S3-S6 rebase).
   *  - A naming convention would silently break if array is reordered.
   *  - This is the same class of bug as TOAST (silently does the wrong thing).
   *
   *  Phase C3 uses getEntryBonfireId(areaId) to find the bonfire with this flag. */
  isEntryPoint?: boolean;
}

// ── Exit Gate (inter-area transition portal) ──
/** A physical gate/portal at the edge of an area that transports the player
 *  to the next area when walked through. One-way (return via Hub/Map).
 *  Visual: large arch with amber lights, barbed wire, decorative guards.
 *  Mechanism: Matter sensor → WorldSystem.travelTo(toAreaId, toSection)
 */
export interface ExitGateData {
  id: string;          // e.g. 'gate_factory1_to_2'
  x: number;
  y: number;
  toAreaId: string;    // destination area ID
  toSection: number;   // destination section (usually 1)
  toX: number;         // spawn X in destination area
  toY: number;         // spawn Y in destination area
  /** Optional label shown above the gate (e.g. 'CHECKPOINT — INNER WARD') */
  labelKey?: string;
}

// ── Destructible barrel (explosive environmental hazard) ──
/** A shootable explosive barrel. Has 3 HP — destroyed on the 3rd projectile hit.
 *  On destruction: explodes, dealing damage to nearby enemies/player and
 *  leaving a temporary scorch mark on the ground.
 *
 *  Visual: red metal cylinder with an amber hazard stripe.
 *  Size: ~24px wide, 36px tall. Placed at y=640 (ground/platform level).
 *  No Matter physics body — projectile collision is per-frame distance check
 *  in PlayController.update (like checkCollectiblePickups). */
export interface BarrelData {
  id: string;          // e.g. 'barrel_factory1_s2_1'
  x: number;
  y: number;
}

// ── Metroidvania structure ──

/** One-way shortcut door — opens from one side, stays open forever. Dark Souls style. */
export interface ShortcutData {
  id: string;
  x: number;          // door position
  y: number;
  w: number;
  h: number;
  /** Section ID this shortcut leads TO (for display). */
  toSection: number;
  /** Direction the door opens from: 'left' | 'right' | 'top' | 'bottom' */
  opensFrom: 'left' | 'right' | 'top' | 'bottom';
}

/** Collectible pickup — grants health, energy, or skill point. */
export type CollectibleType = 'health_fragment' | 'energy_fragment' | 'skill_point' | 'weapon_part';
export interface CollectibleData {
  id: string;
  type: CollectibleType;
  x: number;
  y: number;
  /** Optional: ability required to reach this collectible. */
  requiredAbility?: string;
}

/** Secret room — hidden area with reward, optionally ability-gated. */
export interface SecretRoomData {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ability required to access (for display). */
  requiredAbility?: string;
  /** Lore text key shown when discovered. */
  discoveryTextKey?: string;
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
  quality: 'low' | 'medium' | 'high';
  fullscreen: boolean;
}

export interface SaveData {
  version: number;
  player: PlayerState;
  checkpoint: CheckpointData | null;
  bestBossTimes: Record<string, number>;
  settings: GameSettings;
  questFlags: Record<string, boolean>;
  questProgress: Record<string, number[]>;  // N2 fix: persist quest objective progress
  npcFlags: Record<string, Record<string, boolean>>;
  unlockedAreas: string[];
  discoveredAreas: string[];
  /** IDs of activated (lit) bonfires. Used for fast-travel destinations. */
  litBonfires: string[];
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
  | 'ABILITY_UNLOCKED'
  | 'INPUT_SCHEME_CHANGED'
  | 'EMP_PULSE'
  | 'EMP_HIT'
  | 'HACK_COMPLETE'
  | 'PAINT_UNLOCKED'
  | 'BONFIRE_LIT';
