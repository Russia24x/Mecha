/**
 * MECHA: LAST PROTOCOL — Audio System v2.0
 *
 * ARCHITECTURE (per Technical Director decision):
 *   Assets → Phaser Loader → AudioSystem (Manager) → EventBus → Gameplay
 *
 * - Phaser: asset loading + playback backend (future, when asset files exist)
 * - AudioSystem: decision layer (what sound, when, what volume)
 * - GameCore: no direct Phaser dependency
 *
 * Categories (per Director spec):
 *   Master → Music, Ambient, Combat, Weapons, UI, NPC, Environment, Voice
 *
 * Sound mix (per Design Pillars):
 *   40% Ambient | 30% Drone | 20% Silence | 10% Music
 *
 * CURRENT STATE:
 *   Procedural SFX via Web Audio API (no asset files yet).
 *   Category-based gain nodes for future per-category volume control.
 *   pause/resume on page visibility changes.
 *   No spatial audio, no analyser, no advanced DSP (post-Vertical Slice).
 */

// ─── Sound categories ──────────────────────────────────────────────────
export type SoundCategory =
  | 'music' | 'ambient' | 'combat' | 'weapons'
  | 'ui' | 'npc' | 'environment' | 'voice';

// ─── SFX names (grouped by category) ───────────────────────────────────
export type SfxName =
  // Combat
  | 'hit' | 'explosion' | 'enemyHit' | 'bossHit' | 'bossDeath'
  | 'playerDeath' | 'phaseChange'
  // Weapons
  | 'fire' | 'melee' | 'weaponSwitch'
  // Player movement (combat category for volume purposes)
  | 'dash' | 'jump' | 'doubleJump'
  // UI
  | 'uiClick' | 'uiHover' | 'checkpoint' | 'levelUp' | 'skillUnlock' | 'victory';

// ─── Ambient types ─────────────────────────────────────────────────────
export type AmbientType = 'factory' | 'silence' | 'boss';

// ─── Category metadata ─────────────────────────────────────────────────
const CATEGORY_INFO: Record<SoundCategory, { defaultVolume: number }> = {
  music:      { defaultVolume: 0.4 },
  ambient:    { defaultVolume: 0.5 },
  combat:     { defaultVolume: 0.8 },
  weapons:    { defaultVolume: 0.8 },
  ui:         { defaultVolume: 0.6 },
  npc:        { defaultVolume: 0.7 },
  environment:{ defaultVolume: 0.4 },
  voice:      { defaultVolume: 0.9 },
};

// ─── SFX → Category mapping ────────────────────────────────────────────
const SFX_CATEGORY: Record<SfxName, SoundCategory> = {
  // Combat
  hit: 'combat', explosion: 'combat', enemyHit: 'combat', bossHit: 'combat',
  bossDeath: 'combat', playerDeath: 'combat', phaseChange: 'combat',
  // Weapons
  fire: 'weapons', melee: 'weapons', weaponSwitch: 'weapons',
  // Player movement
  dash: 'combat', jump: 'combat', doubleJump: 'combat',
  // UI
  uiClick: 'ui', uiHover: 'ui', checkpoint: 'ui', levelUp: 'ui', skillUnlock: 'ui', victory: 'ui',
};

export class AudioSystem {
  // ─── AudioContext ───────────────────────────────────────────────────
  private static ctx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static noiseBuffer: AudioBuffer | null = null;
  private static initialized = false;
  private static gestureListenersAttached = false;
  private static visibilityHandler: (() => void) | null = null;

  // ─── Per-category gain nodes ────────────────────────────────────────
  private static categoryGains: Map<SoundCategory, GainNode> = new Map();
  private static categoryVolumes: Map<SoundCategory, number> = new Map();
  private static masterVolume = 0.7;
  private static muted = false;
  private static paused = false;

  // ─── Ambient state ──────────────────────────────────────────────────
  private static ambientNodes: AudioNode[] = [];
  private static currentAmbient: AmbientType | null = null;

  // ═══ PUBLIC API ═════════════════════════════════════════════════════

  // ─── Lifecycle ──────────────────────────────────────────────────────

  static init(): void {
    if (this.gestureListenersAttached) return;
    if (typeof window === 'undefined') return;
    this.gestureListenersAttached = true;
    const handler = () => this.initOnGesture();
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    window.addEventListener('gamepadconnected', handler, { once: true });
  }

  private static initOnGesture(): void {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      // Create per-category gain nodes
      for (const cat of Object.keys(CATEGORY_INFO) as SoundCategory[]) {
        const gain = this.ctx.createGain();
        gain.connect(this.masterGain);
        this.categoryGains.set(cat, gain);
        this.categoryVolumes.set(cat, CATEGORY_INFO[cat].defaultVolume);
      }

      this.updateAllVolumes();
      this.noiseBuffer = this.makeNoiseBuffer(1.0);
      this.setupVisibilityHandler();
    } catch { this.ctx = null; }
  }

  static resume(): void {
    if (!this.initialized) { this.initOnGesture(); return; }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  // ─── Pause / Resume (page visibility) ───────────────────────────────

  private static setupVisibilityHandler(): void {
    if (typeof document === 'undefined') return;
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resumeAudio();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  static pause(): void {
    if (this.paused) return;
    this.paused = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  static resumeAudio(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  // ─── Volume Control ─────────────────────────────────────────────────

  static setMasterVolume(v: number): void { this.masterVolume = v; this.updateAllVolumes(); }
  static getMasterVolume(): number { return this.masterVolume; }

  static setCategoryVolume(cat: SoundCategory, v: number): void {
    this.categoryVolumes.set(cat, v);
    this.updateCategoryVolume(cat);
  }
  static getCategoryVolume(cat: SoundCategory): number {
    return this.categoryVolumes.get(cat) ?? CATEGORY_INFO[cat].defaultVolume;
  }

  // Legacy compatibility (used by SettingsUI)
  static setSfxVolume(v: number): void {
    this.setCategoryVolume('combat', v);
    this.setCategoryVolume('weapons', v);
    this.setCategoryVolume('ui', v);
  }
  static getSfxVolume(): number { return this.getCategoryVolume('combat'); }
  static setMusicVolume(v: number): void {
    this.setCategoryVolume('music', v);
    this.setCategoryVolume('ambient', v);
  }
  static getMusicVolume(): number { return this.getCategoryVolume('music'); }

  static setMuted(m: boolean): void { this.muted = m; this.updateAllVolumes(); }
  static isMuted(): boolean { return this.muted; }

  // ─── SFX Playback ───────────────────────────────────────────────────

  static play(name: SfxName): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const cat = SFX_CATEGORY[name] ?? 'combat';
    const gain = this.categoryGains.get(cat);
    if (!gain) return;

    switch (name) {
      // ── Weapons ──
      case 'fire': this.tone('square', 800, 0.06, 0.15, now, gain); break;
      case 'melee': this.sweep('sawtooth', 300, 80, 0.12, 0.2, now, gain); break;
      case 'weaponSwitch': this.tone('square', 500, 0.04, 0.08, now, gain); break;

      // ── Combat: Player movement ──
      case 'dash': this.sweep('sine', 200, 600, 0.08, 0.15, now, gain); break;
      case 'jump': this.sweep('square', 200, 500, 0.06, 0.12, now, gain); break;
      case 'doubleJump': this.sweep('square', 400, 800, 0.06, 0.12, now, gain); break;

      // ── Combat: Damage ──
      case 'hit': this.noise(0.08, 0.2, now, gain); break;
      case 'explosion': this.noise(0.3, 0.4, now, gain); this.tone('sine', 100, 0.2, 0.3, now, gain); break;
      case 'enemyHit': this.tone('square', 400, 0.05, 0.1, now, gain); break;
      case 'bossHit': this.tone('square', 200, 0.08, 0.15, now, gain); break;
      case 'bossDeath': this.sweep('sawtooth', 200, 50, 0.5, 0.4, now, gain); break;
      case 'playerDeath': this.sweep('sawtooth', 400, 50, 0.5, 0.4, now, gain); break;
      case 'phaseChange': this.sweep('sawtooth', 100, 300, 0.3, 0.3, now, gain); break;

      // ── UI ──
      case 'uiClick': this.tone('square', 600, 0.04, 0.1, now, gain); break;
      case 'uiHover': this.tone('square', 400, 0.03, 0.05, now, gain); break;
      case 'checkpoint': this.tone('sine', 800, 0.1, 0.2, now, gain); this.tone('sine', 1200, 0.1, 0.2, now + 0.1, gain); break;
      case 'levelUp': this.tone('sine', 523, 0.15, 0.25, now, gain); this.tone('sine', 659, 0.15, 0.25, now + 0.1, gain); this.tone('sine', 784, 0.2, 0.25, now + 0.2, gain); break;
      case 'skillUnlock': this.tone('sine', 880, 0.1, 0.2, now, gain); this.tone('sine', 1320, 0.15, 0.2, now + 0.1, gain); break;
      case 'victory': this.tone('sine', 523, 0.2, 0.3, now, gain); this.tone('sine', 659, 0.2, 0.3, now + 0.15, gain); this.tone('sine', 784, 0.3, 0.3, now + 0.3, gain); break;
    }
  }

  // ─── Ambient ────────────────────────────────────────────────────────

  static startAmbient(type: AmbientType): void {
    if (this.currentAmbient === type) return;
    this.stopAmbient();
    if (!this.ctx) return;
    const ambientGain = this.categoryGains.get('ambient');
    if (!ambientGain) return;
    this.currentAmbient = type;
    const now = this.ctx.currentTime;

    if (type === 'factory') {
      this.ambientNodes.push(this.createDrone(55, 0.04, now, ambientGain));
      this.ambientNodes.push(this.createDrone(82, 0.03, now, ambientGain));
    } else if (type === 'boss') {
      this.ambientNodes.push(this.createDrone(40, 0.06, now, ambientGain));
      this.ambientNodes.push(this.createDrone(58, 0.04, now, ambientGain));
      this.ambientNodes.push(this.createDrone(87, 0.02, now, ambientGain));
    }
  }

  static stopAmbient(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const node of this.ambientNodes) {
      try {
        if (node instanceof OscillatorNode) node.stop(now + 0.5);
        else if (node instanceof GainNode) node.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      } catch { /* already stopped */ }
    }
    this.ambientNodes = [];
    this.currentAmbient = null;
  }

  static getAmbient(): AmbientType | null { return this.currentAmbient; }

  // ═══ PRIVATE ═════════════════════════════════════════════════════════

  private static updateAllVolumes(): void {
    if (!this.masterGain) return;
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    for (const cat of this.categoryGains.keys()) {
      this.updateCategoryVolume(cat);
    }
  }

  private static updateCategoryVolume(cat: SoundCategory): void {
    const gain = this.categoryGains.get(cat);
    if (!gain) return;
    const vol = this.categoryVolumes.get(cat) ?? CATEGORY_INFO[cat].defaultVolume;
    gain.gain.value = this.muted ? 0 : vol;
  }

  private static makeNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private static createDrone(freq: number, vol: number, start: number, target: GainNode): OscillatorNode {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 2.0);
    osc.connect(gain);
    gain.connect(target);
    osc.start(start);
    this.ambientNodes.push(gain);
    return osc;
  }

  private static tone(type: OscillatorType, freq: number, dur: number, vol: number, start: number, target: GainNode): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(target);
    osc.start(start);
    osc.stop(start + dur);
  }

  private static sweep(type: OscillatorType, f1: number, f2: number, dur: number, vol: number, start: number, target: GainNode): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), start + dur);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(target);
    osc.start(start);
    osc.stop(start + dur);
  }

  private static noise(dur: number, vol: number, start: number, target: GainNode): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(gain);
    gain.connect(target);
    src.start(start);
    src.stop(start + dur);
  }

  // ─── Cleanup ────────────────────────────────────────────────────────

  static destroy(): void {
    this.stopAmbient();
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
    this.gestureListenersAttached = false;
    this.categoryGains.clear();
    this.categoryVolumes.clear();
  }
}

export default AudioSystem;
