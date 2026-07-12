/**
 * MECHA: LAST PROTOCOL — NavigableOverlay Base Class v3.2
 *
 * Provides unified gamepad + keyboard navigation for all overlay UIs.
 * Each overlay registers its interactive elements via registerNav(),
 * and handleNavigation() cycles through them automatically.
 *
 * Navigation:
 *   Up/Down (stick or D-pad or WASD) → cycle focus
 *   Left/Right (stick or D-pad or WASD) → optional horizontal nav (override onNavLeft/onNavRight)
 *   A button / Enter / Space → activate focused element
 *   B button / ESC → handled by OverlayManager (back)
 *
 * Mouse + touch also work in parallel — pointerover auto-syncs focus.
 */
import Phaser from 'phaser';
import { InputSystem } from '../systems/InputSystem';
import { AudioSystem } from '../systems/AudioSystem';
import type { OverlayUI } from './OverlayManager';

export interface NavElement {
  bg: Phaser.GameObjects.Shape;       // Rectangle or Arc (the visual)
  text: Phaser.GameObjects.Text;      // Text label (for color change on focus)
  onSelect: () => void;               // Action when activated
  focusColor?: number;                // Optional custom focus stroke color
  normalColor?: number;
}

export abstract class NavigableOverlay implements OverlayUI {
  protected container: Phaser.GameObjects.Container;
  protected scene: Phaser.Scene;
  protected navElements: NavElement[] = [];
  protected navFocusIdx = 0;
  protected navCooldown = 0;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(300).setVisible(false);
    this.container.scrollFactorX = 0;
    this.container.scrollFactorY = 0;
  }

  /**
   * Add a child to the container with scrollFactor(0).
   * Use this instead of container.add() to ensure hit-test works when camera scrolls.
   */
  protected addFixed(...children: Phaser.GameObjects.GameObject[]): void {
    children.forEach(c => {
      const sf = c as unknown as { setScrollFactor?: (x: number, y?: number) => void };
      sf.setScrollFactor?.(0);
    });
    this.container.add(children);
  }

  /**
   * Register an interactive element for gamepad navigation.
   * Also wires mouse hover + click automatically.
   */
  protected registerNav(
    bg: Phaser.GameObjects.Shape,
    text: Phaser.GameObjects.Text,
    onSelect: () => void,
    opts?: { focusColor?: number; normalColor?: number },
  ): void {
    // *** ROOT FIX: each child must have scrollFactor(0) individually.
    // Container.setScrollFactor(0,0,true) doesn't work reliably in Phaser 4.2.1.
    bg.setScrollFactor(0);
    text.setScrollFactor(0);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      this.navFocusIdx = this.navElements.findIndex(e => e.bg === bg);
      if (this.navFocusIdx < 0) this.navFocusIdx = 0;
      this.updateNavFocus();
      AudioSystem.play('uiHover');
    });
    bg.on('pointerout', () => this.updateNavFocus());
    bg.on('pointerdown', () => {
      AudioSystem.play('uiClick');
      onSelect();
    });
    this.navElements.push({
      bg, text, onSelect,
      focusColor: opts?.focusColor ?? 0x39d0d8,
      normalColor: opts?.normalColor ?? 0x1a3040,
    });
  }

  /** Called by OverlayManager every frame. Handles gamepad/keyboard nav. */
  handleNavigation(): void {
    if (this.navElements.length === 0) return;
    const input = InputSystem.getState();
    this.navCooldown -= 16;
    if (this.navCooldown > 0) return;

    // Vertical navigation (up/down)
    if (input.leftStickY < -0.3 || input.heldUp) {
      this.navFocusIdx = (this.navFocusIdx - 1 + this.navElements.length) % this.navElements.length;
      this.updateNavFocus();
      AudioSystem.play('uiHover');
      this.navCooldown = 120;  // freer — was 180
    } else if (input.leftStickY > 0.3 || input.heldDown) {
      this.navFocusIdx = (this.navFocusIdx + 1) % this.navElements.length;
      this.updateNavFocus();
      AudioSystem.play('uiHover');
      this.navCooldown = 120;
    }

    // Horizontal navigation (left/right) — for tabs, sliders, etc.
    if (input.leftStickX < -0.3) {
      this.onNavLeft();
      this.navCooldown = 120;
    } else if (input.leftStickX > 0.3) {
      this.onNavRight();
      this.navCooldown = 120;
    }

    // Activate (A button / Enter / Space / fire)
    if (input.jumpPressed || input.firePressed) {
      AudioSystem.play('uiClick');
      this.navElements[this.navFocusIdx]?.onSelect();
      this.navCooldown = 250;
    }
  }

  /** Override for horizontal navigation (e.g., switching tabs, adjusting sliders). */
  protected onNavLeft(): void { /* override in subclass */ }
  protected onNavRight(): void { /* override in subclass */ }

  protected updateNavFocus(): void {
    this.navElements.forEach((el, i) => {
      // Guard against destroyed objects (prevents "Cannot read properties of null" crash)
      if (!el.bg || !el.bg.active || !el.text || !el.text.active) return;
      if (i === this.navFocusIdx) {
        el.bg.setStrokeStyle(2, el.focusColor ?? 0x39d0d8, 0.9);
        el.bg.setScale(1.03);
        el.text.setColor('#66f0ff');
      } else {
        el.bg.setStrokeStyle(1, el.normalColor ?? 0x1a3040, 0.7);
        el.bg.setScale(1);
        el.text.setColor('#cfd6e0');
      }
    });
  }

  show(): void {
    this.visible = true;
    this.container.setVisible(true);
    this.navFocusIdx = 0;
    this.updateNavFocus();
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
  }

  get isVisible(): boolean { return this.visible; }

  destroy(): void {
    this.container.destroy();
    this.navElements = [];
  }
}
