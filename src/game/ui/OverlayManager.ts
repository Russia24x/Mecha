/**
 * MECHA: LAST PROTOCOL — Overlay Manager v3.1
 *
 * Manages overlay UIs (settings, skills, inventory, quests, map, dialogue)
 * as a STACK on top of the current main state (hub or play).
 *
 * ROOT CAUSE THIS FIXES:
 * Previously, overlays were treated as states in the GameScene state machine.
 * Closing an overlay called setState('play') which REBUILT THE ENTIRE GAME WORLD.
 * Now, overlays are managed independently — opening/closing never touches the
 * main state's build/cleanup lifecycle.
 *
 * USAGE:
 *   OverlayManager.open('inventory', 'hub');    // open inventory from hub
 *   OverlayManager.close();                      // close current overlay → return to 'hub'
 *   OverlayManager.close('pause');              // close overlay → reopen pause menu
 *
 * Each overlay UI must implement:
 *   show(): void
 *   hide(): void
 *   destroy(): void
 *   handleNavigation?(): void   // optional gamepad nav
 */

import type Phaser from 'phaser';
import { InputSystem } from '../systems/InputSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { VirtualCursor } from './VirtualCursor';

export type OverlayId = 'settings' | 'skills' | 'inventory' | 'quests' | 'map' | 'dialogue' | 'hangar';

export interface OverlayUI {
  show(): void;
  hide(): void;
  destroy(): void;
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
  private static cursor: VirtualCursor | null = null;

  /** Get the virtual cursor (for manual show/hide outside overlay stack). */
  static getCursor(): VirtualCursor | null {
    return this.cursor;
  }

  /** Bind to the active GameScene. Called in create(). */
  static bind(scene: Phaser.Scene): void {
    this.scene = scene;
    this.stack = [];
    this.cursor = new VirtualCursor(scene);
  }

  /**
   * Open an overlay on top of the current state.
   * @param id overlay identifier
   * @param ui the overlay UI instance (already constructed, hidden)
   * @param parent which main state opened this ('hub' or 'play' or 'menu')
   */
  static open(id: OverlayId, ui: OverlayUI, parent: OverlayParent): void {
    // If an overlay is already open and it's the same one, ignore
    if (this.stack.length > 0 && this.stack[this.stack.length - 1].id === id) return;
    this.stack.push({ id, ui, parent });
    ui.show();
    this.cursor?.show();
    AudioSystem.play('uiClick');
  }

  /**
   * Close the current overlay and return to its parent.
   * The onClose callback handles state transition (e.g., reopen pause menu).
   */
  static close(onClose?: (parent: OverlayParent) => void): void {
    const top = this.stack.pop();
    if (!top) {
      onClose?.('hub');
      return;
    }
    top.ui.hide();
    top.ui.destroy();
    // NOTE: Do NOT hide cursor here — let the onClose callback decide.
    // If returning to hub/menu, callback will show(40). If returning to play,
    // callback will show(280) for pause or not show at all.
    // This prevents cursor flicker (hide → show in same frame).
    AudioSystem.play('uiClick');
    onClose?.(top.parent);
  }

  /** Close ALL overlays (e.g., when leaving play state entirely). */
  static closeAll(): void {
    while (this.stack.length > 0) {
      const top = this.stack.pop()!;
      top.ui.hide();
      top.ui.destroy();
    }
    this.cursor?.hide();
  }

  /** Get the current top overlay, or null. */
  static current(): OpenOverlay | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  /** Is any overlay currently open? */
  static get hasOpen(): boolean {
    return this.stack.length > 0;
  }

  /**
   * Centralized input handler for overlays. Call from GameScene.update()
   * every frame. Handles B/ESC back navigation + delegates to overlay's
   * own handleNavigation() for D-pad/stick navigation.
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

    // Virtual cursor (right analog stick) — works with any overlay UI
    this.cursor?.update();

    // Delegate to overlay's own navigation (left stick / D-pad / A to confirm)
    top.ui.handleNavigation?.();
  }

  /** Destroy all overlays and unbind. Called in scene shutdown. */
  static destroy(): void {
    this.closeAll();
    this.cursor?.destroy();
    this.cursor = null;
    this.scene = null;
  }
}

export default OverlayManager;
