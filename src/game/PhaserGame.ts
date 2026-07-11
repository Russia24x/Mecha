/**
 * MECHA: LAST PROTOCOL - Phaser Game bootstrap
 * Single entry point — UI imports PhaserGame.create() only.
 *
 * Renderer: Phaser.AUTO (WebGL 2.0 first, Canvas fallback).
 * Physics: Matter.js with variable delta (no fixedStep — removed in Phaser 4.2).
 */

import Phaser from 'phaser';
import { GAME } from './shared/Constants';
import { BootScene } from './features/scenes/BootScene';
import { GameScene } from './features/scenes/GameScene';
import { UIScene } from './features/scenes/UIScene';

export class PhaserGame {
  private static instance: Phaser.Game | null = null;
  private static f11Handler: ((e: KeyboardEvent) => void) | null = null;

  static create(parent: HTMLElement | string): Phaser.Game {
    if (this.instance) {
      this.instance.destroy(true);
      this.instance = null;
    }
    this.instance = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: GAME.WIDTH,
      height: GAME.HEIGHT,
      backgroundColor: GAME.BG_COLOR,
      pixelArt: false,
      render: {
        antialias: true,
        antialiasGL: true,
        powerPreference: 'high-performance',
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
      },
      contextCreation: {
        alpha: false,
        depth: true,
        stencil: true,
        antialias: true,
        premultipliedAlpha: true,
        desynchronized: false,
        failIfMajorPerformanceCaveat: false,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'matter',
        matter: {
          gravity: { x: 0, y: 0.9 },
          debug: false,
          timing: { timeScale: 1 },
        },
      },
      fps: {
        target: GAME.TARGET_FPS,
        forceSetTimeOut: false,
      },
      scene: [BootScene, GameScene, UIScene],
    });

    if (typeof window !== 'undefined') {
      (window as unknown as { __MECHA_GAME__: Phaser.Game }).__MECHA_GAME__ = this.instance;
      if (this.f11Handler) window.removeEventListener('keydown', this.f11Handler);
      this.f11Handler = (e: KeyboardEvent) => {
        if (e.code === 'F11') {
          e.preventDefault();
          this.toggleFullscreen(parent);
        }
      };
      window.addEventListener('keydown', this.f11Handler);
    }
    return this.instance;
  }

  static toggleFullscreen(parent: HTMLElement | string): void {
    if (typeof document === 'undefined') return;
    const el = typeof parent === 'string' ? document.getElementById(parent) : parent;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  static destroy(): void {
    if (typeof window !== 'undefined' && this.f11Handler) {
      window.removeEventListener('keydown', this.f11Handler);
      this.f11Handler = null;
    }
    if (this.instance) {
      this.instance.destroy(true);
      this.instance = null;
    }
  }
}

export default PhaserGame;
