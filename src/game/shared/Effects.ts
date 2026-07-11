/**
 * MECHA: LAST PROTOCOL - Effects (Audio + Visual)
 * Procedural SFX via Web Audio API. AudioContext created on first user gesture.
 */

import Phaser from 'phaser';
import { COLORS } from './Constants';

type SfxName =
  | 'fire' | 'melee' | 'dash' | 'jump' | 'hit'
  | 'explosion' | 'enemyHit' | 'bossHit' | 'bossDeath'
  | 'playerDeath' | 'checkpoint' | 'uiClick' | 'uiHover'
  | 'victory' | 'phaseChange' | 'doubleJump' | 'weaponSwitch';

export class Effects {
  private static ctx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static sfxGain: GainNode | null = null;
  private static noiseBuffer: AudioBuffer | null = null;
  private static initialized = false;
  private static gestureListenersAttached = false;
  private static masterVolume = 0.7;
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
      this.sfxGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
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
    if (!this.masterGain || !this.sfxGain) return;
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this.sfxGain.gain.value = this.sfxVolume;
  }

  static setMasterVolume(v: number): void { this.masterVolume = v; this.updateVolumes(); }
  static setSfxVolume(v: number): void { this.sfxVolume = v; this.updateVolumes(); }
  static setMuted(m: boolean): void { this.muted = m; this.updateVolumes(); }
  static getMasterVolume(): number { return this.masterVolume; }
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

  // ---- Visual effects ----

  static sparks(scene: Phaser.Scene, x: number, y: number, color: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      const p = scene.add.circle(x, y, 1 + Math.random() * 2, color, 0.9);
      p.setDepth(20);
      scene.tweens.add({
        targets: p,
        x: x + Math.cos(a) * speed,
        y: y + Math.sin(a) * speed,
        alpha: 0, scale: 0.3,
        duration: 200 + Math.random() * 200,
        onComplete: () => p.destroy(),
      });
    }
  }

  static explosion(scene: Phaser.Scene, x: number, y: number, color = 0xff6040, scale = 1.0): void {
    this.play('explosion');
    // Flash
    const flash = scene.add.circle(x, y, 10 * scale, 0xffffff, 0.9);
    flash.setDepth(25);
    scene.tweens.add({
      targets: flash, alpha: 0, scale: 3 * scale,
      duration: 150, onComplete: () => flash.destroy(),
    });
    // Ring
    const ring = scene.add.circle(x, y, 8 * scale, color, 0.8);
    ring.setStrokeStyle(3, 0xffffff, 0.9);
    ring.setDepth(24);
    scene.tweens.add({
      targets: ring, alpha: 0, scale: 4 * scale,
      duration: 300, onComplete: () => ring.destroy(),
    });
    // Sparks
    this.sparks(scene, x, y, color, 10 + Math.floor(scale * 6));
    // Smoke
    for (let i = 0; i < 4; i++) {
      const s = scene.add.circle(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 6 + Math.random() * 6, 0x333333, 0.4);
      s.setDepth(23);
      scene.tweens.add({
        targets: s,
        y: y - 30 - Math.random() * 20,
        alpha: 0, scale: 2,
        duration: 600 + Math.random() * 400,
        onComplete: () => s.destroy(),
      });
    }
  }

  static screenFlash(scene: Phaser.Scene, color: number, intensity: number, duration: number): void {
    const flash = scene.add.rectangle(0, 0, 2000, 2000, color, intensity);
    flash.setOrigin(0, 0).setScrollFactor(0).setDepth(150);
    scene.tweens.add({
      targets: flash, alpha: 0,
      duration, onComplete: () => flash.destroy(),
    });
  }

  static playMusic(_name: string): void {
    // Music stub — can be implemented later with oscillators or audio files.
  }

  static stopMusic(): void {
    // Stub
  }
}

export default Effects;
