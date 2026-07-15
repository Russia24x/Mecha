/**
 * MECHA: LAST PROTOCOL — Overlay Manager v4.0
 *
 * Manages overlay UIs as a STACK. Uses UIController for unified navigation.
 *
 * Each overlay UI must implement:
 *   show(): void
 *   hide(): void
 *   destroy(): void
 *   getController(): UIController | null   // returns its nav controller
 *   get isVisible(): boolean
 */

import type Phaser from 'phaser';
import { InputSystem } from '../systems/InputSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { UIController } from './UIController';

export type OverlayId = 'settings' | 'skills' | 'inventory' | 'quests' | 'map' | 'dialogue' | 'hangar';

export interface OverlayUI {
  show(): void;
  hide(): void;
  destroy(): void;
  /** Return the UI's controller for navigation, or null if it handles nav internally. */
  getController?(): UIController | null;
  /** Legacy: called if getController() returns null (backward compat). */
  handleNavigation?(): void;
  get isVisible(): boolean;
}

export type OverlayParent = 'hub' | 'play' | 'menu';

interface OpenOverlay {
  id: OverlayId;
  ui: OverlayUI;
  parent: OverlayParent;
}

export class OverlayManager {
  private static scene: Phaser.Scene | null = null;
  private static stack: OpenOverlay[] = [];
  /** Shared cursor controller for menu/hub/gameover/victory (non-overlay states). */
  private static sharedController: UIController | null = null;

  /** Get the shared UIController (for menu/hub states). */
  static getSharedController(): UIController | null {
    return this.sharedController;
  }

  /**
   * Legacy compat: returns shared controller (replaces old getCursor()).
   * UIController has same API: show, hide, update, setPosition,
   * isCursorVisible, cursorHasHover.
   */
  static getCursor(): UIController | null {
    // If an overlay is open, return its controller; otherwise return shared
    const top = this.current();
    if (top) {
      const ctrl = top.ui.getController?.();
      if (ctrl) return ctrl;
    }
    return this.sharedController;
  }

  /** Bind to the active GameScene. Called in create(). */
  static bind(scene: Phaser.Scene): void {
    this.scene = scene;
    this.stack = [];
    // Shared controller will be created per-state by GameScene.setState()
  }

  /**
   * Open an overlay on top of the current state.
   */
  static open(id: OverlayId, ui: OverlayUI, parent: OverlayParent): void {
    if (this.stack.length > 0 && this.stack[this.stack.length - 1].id === id) return;
    this.stack.push({ id, ui, parent });
    ui.show();
    // Hide shared controller cursor (overlay has its own controller)
    this.sharedController?.hide();
    // Show overlay's controller cursor
    const ctrl = ui.getController?.();
    ctrl?.show(280);
    AudioSystem.play('uiClick');
  }

  /**
   * Close the current overlay and return to its parent.
   */
  static close(onClose?: (parent: OverlayParent) => void): void {
    const top = this.stack.pop();
    if (!top) {
      onClose?.('hub');
      return;
    }
    // Hide overlay's controller cursor
    top.ui.getController?.()?.hide();
    top.ui.hide();
    top.ui.destroy();
    AudioSystem.play('uiClick');
    onClose?.(top.parent);
  }

  /** Close ALL overlays. */
  static closeAll(): void {
    while (this.stack.length > 0) {
      const top = this.stack.pop()!;
      top.ui.getController?.()?.hide();
      top.ui.hide();
      top.ui.destroy();
    }
    this.sharedController?.hide();
  }

  static current(): OpenOverlay | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  static get hasOpen(): boolean {
    return this.stack.length > 0;
  }

  /**
   * Centralized input handler. Call from GameScene.update() every frame.
   * Handles B/ESC back navigation + delegates to overlay's UIController.
   */
  static handleInput(onClose: (parent: OverlayParent) => void): void {
    const top = this.current();
    if (!top) return;

    const input = InputSystem.getState();

    // B button or ESC = close current overlay
    if (input.backPressed) {
      this.close(onClose);
      return;
    }

    // Use overlay's UIController if available
    const ctrl = top.ui.getController?.();
    if (ctrl) {
      ctrl.update();
    } else {
      // Legacy: fall back to handleNavigation
      top.ui.handleNavigation?.();
    }
  }

  /**
   * Create a shared UIController for menu/hub/gameover/victory states.
   * Called by GameScene.setState() when entering a non-play state.
   */
  static createSharedController(scene: Phaser.Scene, container: Phaser.GameObjects.Container): UIController {
    if (this.sharedController) {
      this.sharedController.destroy();
    }
    this.sharedController = new UIController(scene, container);
    return this.sharedController;
  }

  /** Destroy shared controller (called on state change). */
  static destroySharedController(): void {
    this.sharedController?.destroy();
    this.sharedController = null;
  }

  /** Destroy all overlays + shared controller. Called in scene shutdown. */
  static destroy(): void {
    this.closeAll();
    this.destroySharedController();
    this.scene = null;
  }
}

export default OverlayManager;
