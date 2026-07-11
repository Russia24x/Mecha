/**
 * MECHA: LAST PROTOCOL — Save System v3
 * Versioned, migrates old saves. Stores full game state.
 */
import type { SaveData, GameSettings, CheckpointData, PlayerState, InventoryItem } from '../data/types';

const SAVE_VERSION = 3;
const STORAGE_KEY = 'mecha_last_protocol_save_v3';

const DEFAULT_SETTINGS: GameSettings = {
  locale: 'en',
  masterVolume: 0.7,
  musicVolume: 0.4,
  sfxVolume: 0.8,
  muted: false,
  brightness: 0.7,
};

const DEFAULT_PLAYER: PlayerState = {
  level: 1,
  xp: 0,
  skillPoints: 0,
  totalKills: 0,
  bossesKilled: 0,
  unlockedSkills: [],
  unlockedWeapons: ['assault_rifle'],
  currentWeapon: 'assault_rifle',
  weaponLevels: { assault_rifle: 1 },
  inventory: [],
  abilities: [],
};

const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  player: { ...DEFAULT_PLAYER },
  checkpoint: null,
  bestBossTimes: {},
  settings: { ...DEFAULT_SETTINGS },
  questFlags: {},
  npcFlags: {},
  unlockedAreas: ['abandoned_factory'],
  discoveredAreas: [],
};

export class SaveSystem {
  private static cache: SaveData | null = null;

  private static load(): SaveData {
    if (this.cache) return this.cache;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        this.cache = this.migrate(parsed);
      } else {
        this.cache = { ...DEFAULT_SAVE, player: { ...DEFAULT_PLAYER }, settings: { ...DEFAULT_SETTINGS } };
      }
    } catch {
      this.cache = { ...DEFAULT_SAVE, player: { ...DEFAULT_PLAYER }, settings: { ...DEFAULT_SETTINGS } };
    }
    return this.cache;
  }

  private static persist(): void {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache)); } catch { /* */ }
  }

  private static migrate(old: Partial<SaveData>): SaveData {
    const migrated: SaveData = {
      ...DEFAULT_SAVE,
      ...old,
      player: { ...DEFAULT_PLAYER, ...old.player },
      settings: { ...DEFAULT_SETTINGS, ...old.settings },
    };
    if (!migrated.bestBossTimes) migrated.bestBossTimes = {};
    if (!migrated.questFlags) migrated.questFlags = {};
    if (!migrated.npcFlags) migrated.npcFlags = {};
    if (!migrated.unlockedAreas) migrated.unlockedAreas = ['abandoned_factory'];
    if (!migrated.discoveredAreas) migrated.discoveredAreas = [];
    if (!migrated.player.inventory) migrated.player.inventory = [];
    if (!migrated.player.abilities) migrated.player.abilities = [];
    if (!migrated.player.unlockedSkills) migrated.player.unlockedSkills = [];
    if (!migrated.player.unlockedWeapons) migrated.player.unlockedWeapons = ['assault_rifle'];
    if (!migrated.player.weaponLevels) migrated.player.weaponLevels = { assault_rifle: 1 };
    migrated.version = SAVE_VERSION;
    return migrated;
  }

  static get(): Readonly<SaveData> { return this.load(); }
  static getPlayer(): Readonly<PlayerState> { return this.load().player; }
  static getSettings(): GameSettings { return this.load().settings; }

  static hasCheckpoint(): boolean { return this.load().checkpoint !== null; }

  static saveCheckpoint(cp: CheckpointData): void {
    const data = this.load();
    data.checkpoint = cp;
    this.persist();
  }

  static clearCheckpoint(): void {
    const data = this.load();
    data.checkpoint = null;
    this.persist();
  }

  static recordKill(): void {
    const data = this.load();
    data.player.totalKills++;
    this.persist();
  }

  static recordBossKill(bossId: string, timeMs: number): void {
    const data = this.load();
    data.player.bossesKilled++;
    if (!data.bestBossTimes[bossId] || timeMs < data.bestBossTimes[bossId]) {
      data.bestBossTimes[bossId] = timeMs;
    }
    this.persist();
  }

  static awardXp(amount: number): { leveledUp: boolean; newLevel: number } {
    const data = this.load();
    data.player.xp += amount;
    let leveledUp = false;
    while (data.player.xp >= this.xpForLevel(data.player.level) && data.player.level < 100) {
      data.player.xp -= this.xpForLevel(data.player.level);
      data.player.level++;
      data.player.skillPoints++;
      leveledUp = true;
    }
    this.persist();
    return { leveledUp, newLevel: data.player.level };
  }

  static xpForLevel(level: number): number {
    return Math.round(100 * Math.pow(level, 1.5));
  }

  static unlockSkill(skillId: string): boolean {
    const data = this.load();
    if (data.player.unlockedSkills.includes(skillId)) return false;
    data.player.unlockedSkills.push(skillId);
    this.persist();
    return true;
  }

  static unlockWeapon(weaponId: string): void {
    const data = this.load();
    if (!data.player.unlockedWeapons.includes(weaponId)) {
      data.player.unlockedWeapons.push(weaponId);
      if (!data.player.weaponLevels[weaponId]) {
        data.player.weaponLevels[weaponId] = 1;
      }
    }
    this.persist();
  }

  static unlockAbility(ability: string): void {
    const data = this.load();
    if (!data.player.abilities.includes(ability)) {
      data.player.abilities.push(ability);
    }
    this.persist();
  }

  static addItem(itemId: string, amount: number = 1): void {
    const data = this.load();
    const existing = data.player.inventory.find(i => i.itemId === itemId);
    if (existing) {
      existing.amount += amount;
    } else {
      data.player.inventory.push({ itemId, amount });
    }
    this.persist();
  }

  static removeItem(itemId: string, amount: number = 1): boolean {
    const data = this.load();
    const existing = data.player.inventory.find(i => i.itemId === itemId);
    if (!existing || existing.amount < amount) return false;
    existing.amount -= amount;
    if (existing.amount <= 0) {
      data.player.inventory = data.player.inventory.filter(i => i.itemId !== itemId);
    }
    this.persist();
    return true;
  }

  static hasItem(itemId: string, amount: number = 1): boolean {
    const data = this.load();
    const existing = data.player.inventory.find(i => i.itemId === itemId);
    return !!existing && existing.amount >= amount;
  }

  static setWeapon(weaponId: string): void {
    const data = this.load();
    data.player.currentWeapon = weaponId;
    this.persist();
  }

  static unlockArea(areaId: string): void {
    const data = this.load();
    if (!data.unlockedAreas.includes(areaId)) {
      data.unlockedAreas.push(areaId);
    }
    this.persist();
  }

  static discoverArea(areaId: string): void {
    const data = this.load();
    if (!data.discoveredAreas.includes(areaId)) {
      data.discoveredAreas.push(areaId);
    }
    this.persist();
  }

  static setQuestFlag(questId: string, flag: boolean): void {
    const data = this.load();
    data.questFlags[questId] = flag;
    this.persist();
  }

  static getQuestFlag(questId: string): boolean {
    return this.load().questFlags[questId] ?? false;
  }

  static setNpcFlag(npcId: string, flag: string, value: boolean): void {
    const data = this.load();
    if (!data.npcFlags[npcId]) data.npcFlags[npcId] = {};
    data.npcFlags[npcId][flag] = value;
    this.persist();
  }

  static getNpcFlag(npcId: string, flag: string): boolean {
    return this.load().npcFlags[npcId]?.[flag] ?? false;
  }

  static saveSettings(s: Partial<GameSettings>): void {
    const data = this.load();
    data.settings = { ...data.settings, ...s };
    this.persist();
  }

  static clear(): void {
    this.cache = { ...DEFAULT_SAVE, player: { ...DEFAULT_PLAYER }, settings: { ...DEFAULT_SETTINGS } };
    this.persist();
  }
}

export default SaveSystem;
