/**
 * MECHA: LAST PROTOCOL - AudioManager
 * Procedural Web Audio SFX + music. No asset files needed —
 * every sound is synthesized at runtime via oscillators + noise buffers.
 *
 * Sounds:
 *   - fire, melee, dash, jump, hit, explosion, enemyHit, bossHit
 *   - bossDeath, playerDeath, checkpoint, uiClick, uiHover, victory
 *   - phaseChange
 *
 * Music:
 *   - menuAmbient, factoryDrone, bossFight, victory
 */
type SfxName =
  | 'fire' | 'melee' | 'dash' | 'jump' | 'hit'
  | 'explosion' | 'enemyHit' | 'bossHit' | 'bossDeath'
  | 'playerDeath' | 'checkpoint' | 'uiClick' | 'uiHover'
  | 'victory' | 'phaseChange' | 'doubleJump' | 'weaponSwitch';

export class AudioManager {
  private static ctx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static musicGain: GainNode | null = null;
  private static sfxGain: GainNode | null = null;
  private static noiseBuffer: AudioBuffer | null = null;

  private static musicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private static currentMusic: string | null = null;

  private static masterVolume = 0.7;
  private static musicVolume = 0.4;
  private static sfxVolume = 0.8;
  private static muted = false;

  /** Initialize on first user gesture (browser autoplay policy). */
  static init(): void {
    if (this.ctx) return;
    try {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.updateVolumes();
      this.noiseBuffer = this.makeNoiseBuffer(1.0);
    } catch {
      this.ctx = null;
    }
  }

  static resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private static makeNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private static updateVolumes(): void {
    if (!this.masterGain || !this.musicGain || !this.sfxGain) return;
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this.musicGain.gain.value = this.musicVolume;
    this.sfxGain.gain.value = this.sfxVolume;
  }

  // ---------- Volume controls ----------
  static setMasterVolume(v: number): void { this.masterVolume = v; this.updateVolumes(); }
  static setMusicVolume(v: number): void { this.musicVolume = v; this.updateVolumes(); }
  static setSfxVolume(v: number): void { this.sfxVolume = v; this.updateVolumes(); }
  static setMuted(m: boolean): void { this.muted = m; this.updateVolumes(); }

  static getMasterVolume(): number { return this.masterVolume; }
  static getMusicVolume(): number { return this.musicVolume; }
  static getSfxVolume(): number { return this.sfxVolume; }
  static isMuted(): boolean { return this.muted; }

  // ---------- SFX ----------
  static play(name: SfxName): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    switch (name) {
      case 'fire': this.tone(now, 880, 220, 0.08, 'square', 0.18); break;
      case 'melee': this.sweep(now, 600, 100, 0.12, 'sawtooth', 0.22); break;
      case 'dash': this.sweep(now, 200, 800, 0.18, 'sine', 0.18); break;
      case 'jump': this.sweep(now, 300, 600, 0.10, 'square', 0.15); break;
      case 'doubleJump': this.sweep(now, 400, 900, 0.12, 'triangle', 0.18); break;
      case 'hit': this.noise(now, 0.08, 0.25, 800); break;
      case 'explosion': this.explosion(now); break;
      case 'enemyHit': this.tone(now, 440, 80, 0.06, 'square', 0.15); break;
      case 'bossHit': this.tone(now, 220, 60, 0.08, 'sawtooth', 0.20); break;
      case 'bossDeath': this.explosion(now, 1.4); this.tone(now, 110, 40, 1.2, 'sawtooth', 0.30); break;
      case 'playerDeath': this.sweep(now, 400, 40, 0.8, 'sawtooth', 0.30); this.noise(now, 0.5, 0.25, 400); break;
      case 'checkpoint': this.arpeggio(now, [523, 659, 784], 0.08, 'triangle', 0.22); break;
      case 'uiClick': this.tone(now, 880, 880, 0.04, 'square', 0.12); break;
      case 'uiHover': this.tone(now, 660, 660, 0.03, 'sine', 0.08); break;
      case 'victory': this.arpeggio(now, [523, 659, 784, 1047, 1319], 0.15, 'triangle', 0.30); break;
      case 'phaseChange': this.sweep(now, 200, 600, 0.4, 'sawtooth', 0.25); this.noise(now, 0.3, 0.2, 600); break;
      case 'weaponSwitch': this.tone(now, 700, 900, 0.05, 'square', 0.12); break;
    }
  }

  private static tone(start: number, fStart: number, fEnd: number, dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fStart, start);
    if (fEnd !== fStart) osc.frequency.exponentialRampToValueAtTime(Math.max(0.01, fEnd), start + dur);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private static sweep(start: number, fStart: number, fEnd: number, dur: number, type: OscillatorType, vol: number): void {
    this.tone(start, fStart, fEnd, dur, type, vol);
  }

  private static noise(start: number, dur: number, vol: number, lowpass: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer!;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpass, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(0.01, lowpass * 0.1), start + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  private static explosion(start: number, scale = 1): void {
    const ctx = this.ctx!;
    this.noise(start, 0.4 * scale, 0.35, 1200 / scale);
    this.tone(start, 80, 30, 0.5 * scale, 'sawtooth', 0.25);
    // delayed crackle
    this.noise(start + 0.05 * scale, 0.2 * scale, 0.18, 800);
  }

  private static arpeggio(start: number, freqs: number[], noteDur: number, type: OscillatorType, vol: number): void {
    freqs.forEach((f, i) => {
      this.tone(start + i * noteDur, f, f, noteDur * 0.9, type, vol);
    });
  }

  // ---------- Music (procedural ambient drones) ----------
  static playMusic(name: 'menuAmbient' | 'factoryDrone' | 'bossFight' | 'victory'): void {
    if (this.currentMusic === name) return;
    this.stopMusic();
    if (!this.ctx || !this.musicGain) return;
    this.currentMusic = name;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const baseFreqs: Record<string, number[]> = {
      menuAmbient: [55, 82.4, 110],          // A1, E2, A2 — soft
      factoryDrone: [49, 73.4, 98],          // G1, D2, G2 — industrial
      bossFight:   [41.2, 55, 82.4, 110],    // E1, A1, E2, A2 — tense
      victory:     [65.4, 98, 130.8, 196],   // C2, G2, C3, G3 — uplifting
    };
    const freqs = baseFreqs[name];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      // slow LFO on detune for movement
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.1 + i * 0.07;
      lfoGain.gain.value = 4;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15 / freqs.length, now + 2);
      osc.connect(gain);
      gain.connect(this.musicGain!);
      osc.start(now);
      lfo.start(now);
      this.musicNodes.push({ osc, gain });
      this.musicNodes.push({ osc: lfo, gain: lfoGain });
    });
  }

  static stopMusic(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicNodes.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.stop(now + 0.6);
      } catch { /* already stopped */ }
    });
    this.musicNodes = [];
    this.currentMusic = null;
  }
}

export default AudioManager;
