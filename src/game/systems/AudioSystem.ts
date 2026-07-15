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

// ═══ AUDIO REGISTRY (Data-Driven) ═══════════════════════════════════════
// Each SFX is defined here with its category, synthesis params, and volume.
// Adding a new sound = adding an entry here. No code changes needed.
interface SfxDef {
  category: SoundCategory;
  type: 'tone' | 'sweep' | 'noise' | 'noise+tone';
  oscType?: OscillatorType;
  freq?: number;
  freq2?: number;       // for sweep end
  dur: number;
  vol: number;
  // For multi-tone (like arpeggios)
  sequence?: { freq: number; delay: number; dur: number; vol: number }[];
}

const SFX_REGISTRY: Record<SfxName, SfxDef> = {
  // ── Weapons ──
  fire:         { category: 'weapons', type: 'tone', oscType: 'square', freq: 800, dur: 0.06, vol: 0.15 },
  melee:        { category: 'weapons', type: 'sweep', oscType: 'sawtooth', freq: 300, freq2: 80, dur: 0.12, vol: 0.2 },
  weaponSwitch: { category: 'weapons', type: 'tone', oscType: 'square', freq: 500, dur: 0.04, vol: 0.08 },

  // ── Combat: Player movement ──
  dash:         { category: 'combat', type: 'sweep', oscType: 'sine', freq: 200, freq2: 600, dur: 0.08, vol: 0.15 },
  jump:         { category: 'combat', type: 'sweep', oscType: 'square', freq: 200, freq2: 500, dur: 0.06, vol: 0.12 },
  doubleJump:   { category: 'combat', type: 'sweep', oscType: 'square', freq: 400, freq2: 800, dur: 0.06, vol: 0.12 },

  // ── Combat: Damage ──
  hit:          { category: 'combat', type: 'noise', dur: 0.08, vol: 0.2 },
  explosion:    { category: 'combat', type: 'noise+tone', oscType: 'sine', freq: 100, dur: 0.3, vol: 0.4 },
  enemyHit:     { category: 'combat', type: 'tone', oscType: 'square', freq: 400, dur: 0.05, vol: 0.1 },
  bossHit:      { category: 'combat', type: 'tone', oscType: 'square', freq: 200, dur: 0.08, vol: 0.15 },
  bossDeath:    { category: 'combat', type: 'sweep', oscType: 'sawtooth', freq: 200, freq2: 50, dur: 0.5, vol: 0.4 },
  playerDeath:  { category: 'combat', type: 'sweep', oscType: 'sawtooth', freq: 400, freq2: 50, dur: 0.5, vol: 0.4 },
  phaseChange:  { category: 'combat', type: 'sweep', oscType: 'sawtooth', freq: 100, freq2: 300, dur: 0.3, vol: 0.3 },

  // ── UI ──
  uiClick:      { category: 'ui', type: 'tone', oscType: 'square', freq: 600, dur: 0.04, vol: 0.1 },
  uiHover:      { category: 'ui', type: 'tone', oscType: 'square', freq: 400, dur: 0.03, vol: 0.05 },
  checkpoint:   { category: 'ui', type: 'tone', oscType: 'sine', freq: 800, dur: 0.1, vol: 0.2,
                  sequence: [{ freq: 1200, delay: 0.1, dur: 0.1, vol: 0.2 }] },
  levelUp:      { category: 'ui', type: 'tone', oscType: 'sine', freq: 523, dur: 0.15, vol: 0.25,
                  sequence: [{ freq: 659, delay: 0.1, dur: 0.15, vol: 0.25 }, { freq: 784, delay: 0.2, dur: 0.2, vol: 0.25 }] },
  skillUnlock:  { category: 'ui', type: 'tone', oscType: 'sine', freq: 880, dur: 0.1, vol: 0.2,
                  sequence: [{ freq: 1320, delay: 0.1, dur: 0.15, vol: 0.2 }] },
  victory:      { category: 'ui', type: 'tone', oscType: 'sine', freq: 523, dur: 0.2, vol: 0.3,
                  sequence: [{ freq: 659, delay: 0.15, dur: 0.2, vol: 0.3 }, { freq: 784, delay: 0.3, dur: 0.3, vol: 0.3 }] },
};

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

  static setMasterVolume(v: number): void {
    if (isNaN(v) || !isFinite(v)) return;  // S2 fix: guard against NaN from cursor mode
    this.masterVolume = Math.max(0, Math.min(1, v));
    this.updateAllVolumes();
  }
  static getMasterVolume(): number { return this.masterVolume; }

  static setCategoryVolume(cat: SoundCategory, v: number): void {
    if (isNaN(v) || !isFinite(v)) return;  // S2 fix: guard against NaN
    this.categoryVolumes.set(cat, Math.max(0, Math.min(1, v)));
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

  // ─── SFX Playback (Data-Driven via SFX_REGISTRY) ────────────────────

  static play(name: SfxName): void {
    if (!this.ctx) return;
    const def = SFX_REGISTRY[name];
    if (!def) return;
    const now = this.ctx.currentTime;
    const gain = this.categoryGains.get(def.category);
    if (!gain) return;

    switch (def.type) {
      case 'tone':
        this.tone(def.oscType ?? 'sine', def.freq ?? 440, def.dur, def.vol, now, gain);
        break;
      case 'sweep':
        this.sweep(def.oscType ?? 'sine', def.freq ?? 200, def.freq2 ?? 100, def.dur, def.vol, now, gain);
        break;
      case 'noise':
        this.noise(def.dur, def.vol, now, gain);
        break;
      case 'noise+tone':
        this.noise(def.dur, def.vol, now, gain);
        this.tone(def.oscType ?? 'sine', def.freq ?? 100, def.dur * 0.6, def.vol * 0.7, now, gain);
        break;
    }
    // Play sequence tones (arpeggios, chords)
    if (def.sequence) {
      for (const step of def.sequence) {
        this.tone(def.oscType ?? 'sine', step.freq, step.dur, step.vol, now + step.delay, gain);
      }
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
