/**
 * MECHA: LAST PROTOCOL — NavigableOverlay v5.0
 *
 * Wrapper around UIController. All subclasses (Settings, Inventory,
 * SkillTree, Quests, WorldMap) work unchanged — registerNav() and
 * handleNavigation() now delegate to UIController internally.
 *
 * This is a compatibility layer — new UIs should use UIController directly.
 */
import Phaser from 'phaser';
import { InputSystem } from '../systems/InputSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { UIController } from './UIController';
import type { OverlayUI } from './OverlayManager';

export interface NavElement {
  bg: Phaser.GameObjects.Shape;
  text: Phaser.GameObjects.Text;
  onSelect: () => void;
  focusColor?: number;
  normalColor?: number;
}

export abstract class NavigableOverlay implements OverlayUI {
  protected container: Phaser.GameObjects.Container;
  protected scene: Phaser.Scene;
  protected navElements: NavElement[] = [];
  protected navFocusIdx = 0;
  protected navCooldown = 0;
  private visible = false;
  private ctrl: UIController;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(300).setVisible(false);
    this.container.scrollFactorX = 0;
    this.container.scrollFactorY = 0;
    this.ctrl = new UIController(scene, this.container);
    // NOTE: do NOT call setupKeyboard() here — show() will attach the keyHandler
    // only when overlay is actually open (A4 listener leak fix).
  }

  /** OverlayUI: return our controller. */
  getController(): UIController { return this.ctrl; }

  protected addFixed(...children: Phaser.GameObjects.GameObject[]): void {
    children.forEach(c => {
      const sf = c as unknown as { setScrollFactor?: (x: number, y?: number) => void };
      sf.setScrollFactor?.(0);
    });
    this.container.add(children);
  }

  protected registerNav(
    bg: Phaser.GameObjects.Shape,
    text: Phaser.GameObjects.Text,
    onSelect: () => void,
    opts?: { focusColor?: number; normalColor?: number; insertAt?: number },
  ): void {
    bg.setScrollFactor(0);
    text.setScrollFactor(0);
    // Register with UIController — it handles all input (setInteractive, pointerover, etc.)
    // No manual setInteractive needed — addButton does it.
    this.ctrl.addButton(
      (bg as unknown as { x: number }).x,
      (bg as unknown as { y: number }).y,
      bg, onSelect,
      { text, focusColor: opts?.focusColor, normalColor: opts?.normalColor },
    );
    // Also keep in navElements for backward compat (subclasses read it)
    const entry: NavElement = {
      bg, text, onSelect,
      focusColor: opts?.focusColor ?? 0x39d0d8,
      normalColor: opts?.normalColor ?? 0x1a3040,
    };
    if (opts?.insertAt !== undefined) {
      this.navElements.splice(opts.insertAt, 0, entry);
    } else {
      this.navElements.push(entry);
    }
  }

  protected clearNavElements(): void {
    this.navElements = [];
    this.navFocusIdx = 0;
    this.ctrl.clearFocusables();
  }

  handleNavigation(): void {
    // Delegate entirely to UIController
    this.ctrl.update();
  }

  protected onNavLeft(): void { /* override in subclass */ }
  protected onNavRight(): void { /* override in subclass */ }

  protected updateNavFocus(): void {
    // No-op: UIController manages all focus visual now.
    // Subclasses that call updateNavFocus() are safe — it does nothing.
  }

  show(): void {
    this.visible = true;
    this.container.setVisible(true);
    this.navFocusIdx = 0;
    this.ctrl.show(280);
    this.scene.time.delayedCall(0, () => {
      if (this.isVisible) this.updateNavFocus();
    });
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
    this.ctrl.hide();
  }

  get isVisible(): boolean { return this.visible; }

  destroy(): void {
    this.ctrl.destroy();
    this.container.destroy();
    this.navElements = [];
  }
}

export default NavigableOverlay;
