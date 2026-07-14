/**
 * MECHA: LAST PROTOCOL — Menu Navigation Helper
 *
 * Shared navigation logic for all menu-like screens:
 *   - Main menu (MenuBuilder)
 *   - Hub (HubBuilder)
 *   - Game Over screen
 *   - Victory screen
 *   - How To Play screen
 *
 * Owns:
 *   - menuButtons[] (focusable button list)
 *   - menuFocusIndex (currently focused button)
 *   - menuNavHandler (keyboard keydown listener)
 *   - menuNavCooldown (gamepad navigation throttle)
 *
 * Public API:
 *   - addButton(bg, text, onSelect) → register a focusable button
 *   - makeMenuBtn(x, y, label, onClick, disabled?, width?) → create + register
 *   - makeHubCardBtn(x, y, label, onClick) → create + register
 *   - makeHubNavBtn(x, y, icon, label, onClick) → create + register
 *   - handleGamepadNav(input) → per-frame gamepad navigation
 *   - setupNav() → register keyboard listener
 *   - updateFocus() → refresh visual focus state
 *   - reset() → clear all buttons + remove listener
 *   - destroy() → reset + permanent cleanup
 *
 * All created objects are added to the provided container (stateContainer).
 */
import Phaser from 'phaser';
import { fixTextStyle } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import type { InputState } from '../../systems/InputSystem';

export interface Focusable {
  bg: Phaser.GameObjects.Shape;   // Rectangle or Arc
  text: Phaser.GameObjects.Text;
  onSelect: () => void;
}

export class MenuNavHelper {
  private buttons: Focusable[] = [];
  private focusIndex = 0;
  private navHandler: ((e: KeyboardEvent) => void) | null = null;
  private navCooldown = 0;

  constructor(
    private scene: Phaser.Scene,
    private container: Phaser.GameObjects.Container,
  ) {}

  /** Register an existing button as focusable. */
  addButton(bg: Phaser.GameObjects.Shape, text: Phaser.GameObjects.Text, onSelect: () => void): void {
    this.buttons.push({ bg, text, onSelect });
  }

  /** Get the number of registered buttons. */
  get buttonCount(): number {
    return this.buttons.length;
  }

  /** Create a standard rectangular menu button (focusable + clickable). */
  makeMenuBtn(x: number, y: number, label: string, onClick: () => void, disabled: boolean = false, width: number = 240): void {
    const bg = this.scene.add.rectangle(x, y, width, 38, disabled ? 0x05080c : 0x0a1018, 0.9);
    bg.setStrokeStyle(1, disabled ? 0x05080c : 0x1a3040, 0.8);
    if (!disabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { this.focusIndex = this.buttons.findIndex(b => b.bg === bg); this.updateFocus(); AudioSystem.play('uiHover'); });
      bg.on('pointerout', () => this.updateFocus());
      bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    }
    const textEl = this.scene.add.text(x, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '15px', color: disabled ? '#0a1018' : '#5a6470',
    })).setOrigin(0.5);
    this.container.add([bg, textEl]);
    if (!disabled) {
      this.addButton(bg, textEl, onClick);
    }
  }

  /** Create a hub area-card enter button (smaller, focusable + clickable). */
  makeHubCardBtn(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.scene.add.rectangle(x, y, 100, 28, 0x0a1018, 0.9);
    bg.setStrokeStyle(1, 0x1a3040, 0.8);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { this.focusIndex = this.buttons.findIndex(b => b.bg === bg); this.updateFocus(); AudioSystem.play('uiHover'); });
    bg.on('pointerout', () => this.updateFocus());
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    const textEl = this.scene.add.text(x, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: '#39d0d8',
    })).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.addButton(bg, textEl, onClick);
  }

  /** Create a hub bottom-nav icon button (circle, focusable + clickable). */
  makeHubNavBtn(x: number, y: number, icon: string, label: string, onClick: () => void): void {
    const radius = 26;
    const bg = this.scene.add.circle(x, y, radius, 0x0a1018, 0.95);
    bg.setStrokeStyle(1, 0x1a3040, 0.7);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      this.focusIndex = this.buttons.findIndex(b => b.bg === bg);
      this.updateFocus();
      AudioSystem.play('uiHover');
      bg.setScale(1.1);
    });
    bg.on('pointerout', () => { this.updateFocus(); bg.setScale(1); });
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    const iconText = this.scene.add.text(x, y - 2, icon, fixTextStyle({
      fontFamily: 'monospace', fontSize: '18px', color: '#5a6470',
    })).setOrigin(0.5);
    const labelText = this.scene.add.text(x, y + 34, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: '#3a4350', letterSpacing: 1,
    })).setOrigin(0.5);
    this.container.add([bg, iconText, labelText]);
    this.addButton(bg, iconText, onClick);
  }

  /** Per-frame gamepad navigation — called from GameScene.update(). */
  handleGamepadNav(input: InputState): void {
    if (this.buttons.length === 0) return;
    this.navCooldown -= 16;
    if (this.navCooldown > 0) return;

    if (input.leftStickY < -0.3 || input.heldUp) {
      this.focusIndex = (this.focusIndex - 1 + this.buttons.length) % this.buttons.length;
      this.updateFocus(); AudioSystem.play('uiHover');
      this.navCooldown = 110;
    } else if (input.leftStickY > 0.3 || input.heldDown) {
      this.focusIndex = (this.focusIndex + 1) % this.buttons.length;
      this.updateFocus(); AudioSystem.play('uiHover');
      this.navCooldown = 110;
    }
    if (input.jumpPressed || input.firePressed) {
      AudioSystem.play('uiClick');
      const btn = this.buttons[this.focusIndex];
      if (btn) btn.onSelect();
      this.navCooldown = 300;
    }
  }

  /** Register keyboard navigation listener (Arrow keys + Enter/Space). */
  setupNav(): void {
    this.navHandler = (e: KeyboardEvent) => {
      if (this.buttons.length === 0) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.focusIndex = (this.focusIndex - 1 + this.buttons.length) % this.buttons.length;
        this.updateFocus(); AudioSystem.play('uiHover');
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.focusIndex = (this.focusIndex + 1) % this.buttons.length;
        this.updateFocus(); AudioSystem.play('uiHover');
      } else if (e.code === 'Enter' || e.code === 'Space') {
        AudioSystem.play('uiClick');
        this.buttons[this.focusIndex]?.onSelect();
      }
    };
    window.addEventListener('keydown', this.navHandler);
    this.updateFocus();
  }

  /** Refresh visual focus state on all buttons. */
  updateFocus(): void {
    this.buttons.forEach((btn, i) => {
      if (!btn.bg || !btn.bg.active || !btn.text || !btn.text.active) return;
      try {
        if (i === this.focusIndex) {
          btn.bg.setFillStyle(0x0d1820, 1);
          btn.bg.setStrokeStyle(2, 0x39d0d8, 0.9);
          btn.bg.setScale(1.05);
          btn.text.setColor('#66f0ff');
        } else {
          btn.bg.setFillStyle(0x0a1018, 0.9);
          btn.bg.setStrokeStyle(1, 0x1a3040, 0.8);
          btn.bg.setScale(1);
          btn.text.setColor('#5a6470');
        }
      } catch { /* text canvas not ready — skip */ }
    });
  }

  /** Clear all buttons + remove keyboard listener (keep helper alive). */
  reset(): void {
    if (this.navHandler) {
      window.removeEventListener('keydown', this.navHandler);
      this.navHandler = null;
    }
    this.buttons = [];
    this.focusIndex = 0;
    this.navCooldown = 0;
  }

  /** Permanent cleanup — call on scene shutdown. */
  destroy(): void {
    this.reset();
  }
}

export default MenuNavHelper;
