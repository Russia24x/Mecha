/**
 * MECHA: LAST PROTOCOL — Menu Navigation Helper v2.0
 *
 * Thin wrapper around UIController. Provides backward-compatible API
 * for MenuBuilder, HubBuilder, and GameScene's buildGameOver/buildVictory.
 *
 * All methods delegate to UIController — no duplicate logic.
 */
import Phaser from 'phaser';
import { fixTextStyle } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { OverlayManager } from '../OverlayManager';
import { UIController } from '../UIController';
import type { InputState } from '../../systems/InputSystem';

export interface Focusable {
  bg: Phaser.GameObjects.Shape;
  text: Phaser.GameObjects.Text;
  onSelect: () => void;
  x: number;
  y: number;
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

  addButton(bg: Phaser.GameObjects.Shape, text: Phaser.GameObjects.Text, onSelect: () => void, x: number, y: number): void {
    this.buttons.push({ bg, text, onSelect, x, y });
    // Register with shared UIController
    const ctrl = OverlayManager.getSharedController();
    ctrl?.addButton(x, y, bg, onSelect, { text });
  }

  get buttonCount(): number { return this.buttons.length; }

  makeMenuBtn(x: number, y: number, label: string, onClick: () => void, disabled: boolean = false, width: number = 240): void {
    const bg = this.scene.add.rectangle(x, y, width, 38, disabled ? 0x05080c : 0x0a1018, 0.9);
    bg.setStrokeStyle(1, disabled ? 0x05080c : 0x1a3040, 0.8);
    if (!disabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { AudioSystem.play('uiHover'); });
      bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    }
    const textEl = this.scene.add.text(x, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '15px', color: disabled ? '#0a1018' : '#5a6470',
    })).setOrigin(0.5);
    this.container.add([bg, textEl]);
    if (!disabled) {
      this.addButton(bg, textEl, onClick, x, y);
    }
  }

  makeHubCardBtn(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.scene.add.rectangle(x, y, 100, 28, 0x0a1018, 0.9);
    bg.setStrokeStyle(1, 0x1a3040, 0.8);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { AudioSystem.play('uiHover'); });
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    const textEl = this.scene.add.text(x, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: '#39d0d8',
    })).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.addButton(bg, textEl, onClick, x, y);
  }

  makeHubNavBtn(x: number, y: number, icon: string, label: string, onClick: () => void): void {
    const radius = 26;
    const bg = this.scene.add.circle(x, y, radius, 0x0a1018, 0.95);
    bg.setStrokeStyle(1, 0x1a3040, 0.7);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { AudioSystem.play('uiHover'); bg.setScale(1.1); });
    bg.on('pointerout', () => { bg.setScale(1); });
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onClick(); });
    const iconText = this.scene.add.text(x, y - 2, icon, fixTextStyle({
      fontFamily: 'monospace', fontSize: '18px', color: '#5a6470',
    })).setOrigin(0.5);
    const labelText = this.scene.add.text(x, y + 34, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: '#3a4350', letterSpacing: 1,
    })).setOrigin(0.5);
    this.container.add([bg, iconText, labelText]);
    this.addButton(bg, iconText, onClick, x, y);
  }

  handleGamepadNav(input: InputState): void {
    // UIController handles everything — this is a no-op for backward compat
    // (GameScene still calls this, but it does nothing)
  }

  setupNav(): void {
    // Keyboard handled by UIController.setupKeyboard() (called in createSharedController)
    // This is a no-op for backward compat
  }

  updateFocus(): void {
    // UIController handles focus visual — no-op
  }

  reset(): void {
    this.buttons = [];
    this.focusIndex = 0;
    this.navCooldown = 0;
    const ctrl = OverlayManager.getSharedController();
    ctrl?.clearFocusables();
  }

  destroy(): void {
    this.reset();
  }
}

export default MenuNavHelper;
