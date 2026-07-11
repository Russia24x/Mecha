/**
 * MECHA: LAST PROTOCOL — Audio System
 * Procedural SFX via Web Audio API. AudioContext created on first gesture.
 * Independent of any entity.
 */
type SfxName =
  | 'fire' | 'melee' | 'dash' | 'jump' | 'hit'
  | 'explosion' | 'enemyHit' | 'bossHit' | 'bossDeath'
  | 'playerDeath' | 'checkpoint' | 'uiClick' | 'uiHover'
  | 'victory' | 'phaseChange' | 'doubleJump' | 'weaponSwitch'
  | 'levelUp' | 'skillUnlock';

export class AudioSystem {
  private static ctx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static musicGain: GainNode | null = null;
  private static sfxGain: GainNode | null = null;
  private static noiseBuffer: AudioBuffer | null = null;
  private static initialized = false;
  private static gestureListenersAttached = false;
  private static masterVolume = 0.7;
  private static musicVolume = 0.4;
  private static sfxVolume = 0.8;
  private static muted = false;

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
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.updateVolumes();
      this.noiseBuffer = this.makeNoiseBuffer(1.0);
    } catch { this.ctx = null; }
  }

  static resume(): void {
    if (!this.initialized) { this.initOnGesture(); return; }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
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
    if (!this.masterGain || !this.sfxGain || !this.musicGain) return;
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this.sfxGain.gain.value = this.sfxVolume;
    this.musicGain.gain.value = this.musicVolume;
  }

  static setMasterVolume(v: number): void { this.masterVolume = v; this.updateVolumes(); }
  static setMusicVolume(v: number): void { this.musicVolume = v; this.updateVolumes(); }
  static setSfxVolume(v: number): void { this.sfxVolume = v; this.updateVolumes(); }
  static setMuted(m: boolean): void { this.muted = m; this.updateVolumes(); }
  static getMasterVolume(): number { return this.masterVolume; }
  static getMusicVolume(): number { return this.musicVolume; }
  static getSfxVolume(): number { return this.sfxVolume; }
  static isMuted(): boolean { return this.muted; }

  static play(name: SfxName): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case 'fire': this.tone('square', 800, 0.06, 0.15, now); break;
      case 'melee': this.sweep('sawtooth', 300, 80, 0.12, 0.2, now); break;
      case 'dash': this.sweep('sine', 200, 600, 0.08, 0.15, now); break;
      case 'jump': this.sweep('square', 200, 500, 0.06, 0.12, now); break;
      case 'doubleJump': this.sweep('square', 400, 800, 0.06, 0.12, now); break;
      case 'hit': this.noise(0.08, 0.2, now); break;
      case 'explosion': this.noise(0.3, 0.4, now); this.tone('sine', 100, 0.2, 0.3, now); break;
      case 'enemyHit': this.tone('square', 400, 0.05, 0.1, now); break;
      case 'bossHit': this.tone('square', 200, 0.08, 0.15, now); break;
      case 'bossDeath': this.sweep('sawtooth', 200, 50, 0.5, 0.4, now); break;
      case 'playerDeath': this.sweep('sawtooth', 400, 50, 0.5, 0.4, now); break;
      case 'checkpoint': this.tone('sine', 800, 0.1, 0.2, now); this.tone('sine', 1200, 0.1, 0.2, now + 0.1); break;
      case 'uiClick': this.tone('square', 600, 0.04, 0.1, now); break;
      case 'uiHover': this.tone('square', 400, 0.03, 0.05, now); break;
      case 'victory': this.tone('sine', 523, 0.2, 0.3, now); this.tone('sine', 659, 0.2, 0.3, now + 0.15); this.tone('sine', 784, 0.3, 0.3, now + 0.3); break;
      case 'phaseChange': this.sweep('sawtooth', 100, 300, 0.3, 0.3, now); break;
      case 'weaponSwitch': this.tone('square', 500, 0.04, 0.08, now); break;
      case 'levelUp': this.tone('sine', 523, 0.15, 0.25, now); this.tone('sine', 659, 0.15, 0.25, now + 0.1); this.tone('sine', 784, 0.2, 0.25, now + 0.2); break;
      case 'skillUnlock': this.tone('sine', 880, 0.1, 0.2, now); this.tone('sine', 1320, 0.15, 0.2, now + 0.1); break;
    }
  }

  private static tone(type: OscillatorType, freq: number, dur: number, vol: number, start: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(start);
    osc.stop(start + dur);
  }

  private static sweep(type: OscillatorType, f1: number, f2: number, dur: number, vol: number, start: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), start + dur);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(start);
    osc.stop(start + dur);
  }

  private static noise(dur: number, vol: number, start: number): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(gain);
    gain.connect(this.sfxGain);
    src.start(start);
    src.stop(start + dur);
  }
}

export default AudioSystem;
