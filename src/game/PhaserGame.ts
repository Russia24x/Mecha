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
import { FullscreenManager } from './systems/FullscreenManager';

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
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'matter',
        matter: {
          gravity: { x: 0, y: 0.9 },
          debug: false,
        },
      },
      fps: {
        target: GAME.TARGET_FPS,
        forceSetTimeOut: false,
      },
      scene: [BootScene, GameScene, UIScene],
    });

    // Initialize FullscreenManager with Phaser's ScaleManager so it can:
    // 1. Request browser fullscreen on the game's parent container
    // 2. Call scale.refresh() after entering/exiting so canvas recalculates
    // 3. Listen for fullscreenchange events (ESC exit detection)
    FullscreenManager.init(this.instance.scale);

    if (typeof window !== 'undefined') {
      (window as unknown as { __MECHA_GAME__: Phaser.Game }).__MECHA_GAME__ = this.instance;
      if (this.f11Handler) window.removeEventListener('keydown', this.f11Handler);
      this.f11Handler = (e: KeyboardEvent) => {
        if (e.code === 'F11') {
          e.preventDefault();
          FullscreenManager.toggle();
        }
      };
      window.addEventListener('keydown', this.f11Handler);
    }
    return this.instance;
  }

  /**
   * Toggle browser fullscreen on the game's parent container.
   * Delegates to FullscreenManager which handles:
   *   - Browser fullscreen request (requestFullscreen API)
   *   - Canvas resize via :fullscreen CSS + scale.refresh()
   *   - State sync with settings UI toggle
   */
  static toggleFullscreen(_parent?: HTMLElement | string): void {
    FullscreenManager.toggle();
  }

  static destroy(): void {
    if (typeof window !== 'undefined' && this.f11Handler) {
      window.removeEventListener('keydown', this.f11Handler);
      this.f11Handler = null;
    }
    FullscreenManager.cleanup();
    if (this.instance) {
      this.instance.destroy(true);
      this.instance = null;
    }
  }
}

export default PhaserGame;
