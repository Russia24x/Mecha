/**
 * MECHA: LAST PROTOCOL — Particle System
 * Visual effects: sparks, explosions, dust, smoke.
 * Independent — called by any system that needs visual feedback.
 */
import Phaser from 'phaser';
import { AudioSystem } from './AudioSystem';

export class ParticleSystem {
  constructor(private scene: Phaser.Scene) {}

  /** Ambient dust motes — floating particles for atmosphere (per particles skill: continuous flow) */
  ambientDust(x: number, y: number, count = 3): void {
    // ⚠️ TEMPORARY: disabled for FPS testing.
    void x; void y; void count; return;
  }

  sparks(x: number, y: number, color: number, count = 6): void {
    // ⚠️ TEMPORARY: disabled for FPS testing.
    void x; void y; void color; void count; return;
  }

  explosion(x: number, y: number, color = 0xff6040, scale = 1.0): void {
    // ⚠️ TEMPORARY: disabled for FPS testing (still plays sound).
    AudioSystem.play('explosion');
    void x; void y; void color; void scale; return;
  }

  dust(x: number, y: number, count = 6): void {
    // ⚠️ TEMPORARY: disabled for FPS testing.
    void x; void y; void count; return;
  }

  screenFlash(color: number, intensity: number, duration: number): void {
    // ⚠️ TEMPORARY: disabled for FPS testing.
    void color; void intensity; void duration; return;
  }

  afterimage(x: number, y: number, w: number, h: number, color: number, facing: number): void {
    // ⚠️ TEMPORARY: disabled for FPS testing.
    void x; void y; void w; void h; void color; void facing; return;
  }
}

export default ParticleSystem;
