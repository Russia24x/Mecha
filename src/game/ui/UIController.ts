/**
 * MECHA: LAST PROTOCOL — Unified UI Controller
 *
 * ONE system for ALL UI navigation. Replaces:
 *   - NavigableOverlay (linear list for overlays)
 *   - MenuNavHelper (2D spatial for menu/hub)
 *   - VirtualCursor (right-stick pointer)
 *   - HangarUI's custom navItems
 *   - PauseMenuUI's custom handleNavigation
 *
 * Design principles:
 *   1. Every interactive element is a "focusable button" with (x, y, onSelect)
 *   2. Navigation is 2D spatial (find nearest in direction)
 *   3. Virtual cursor is always visible (syncs with D-pad/stick nav)
 *   4. Input: gamepad (all buttons), keyboard (arrows+WASD+Enter), mouse, touch
 *   5. Tab switching: L1/R1, Q/E keys, or left/right stick
 *   6. Mobile-ready: touch = pointer (same as mouse)
 *
 * Usage in any UI:
 *   const ctrl = new UIController(scene, container);
 *   ctrl.addButton(x, y, w, h, onSelect, { label, ... });
 *   ctrl.addTabs(['tab1', 'tab2'], (tab) => this.switchTab(tab));
 *   ctrl.update();  // call every frame
 *   ctrl.destroy();
 */

import Phaser from 'phaser';
import { GAME } from '../shared/Constants';
import { InputSystem, type InputState } from '../systems/InputSystem';
import { AudioSystem } from '../systems/AudioSystem';

export interface UIFocusable {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  onSelect: () => void;
  bg?: Phaser.GameObjects.Shape;
  text?: Phaser.GameObjects.Text;
  focusColor?: number;
  normalColor?: number;
  disabled?: boolean;
}

export interface UITab {
  id: string;
  label: string;
  onSelect: () => void;
}

export class UIController {
  private focusables: UIFocusable[] = [];
  private tabs: UITab[] = [];
  private currentTabIndex = 0;
  private focusIndex = -1; // -1 = no focus
  private navCooldown = 0;
  private cursorVisible = false;
  private cursorX = GAME.WIDTH / 2;
  private cursorY = GAME.HEIGHT / 2;
  private cursorContainer: Phaser.GameObjects.Container;
  private cursorGlow: Phaser.GameObjects.Arc;
  private cursorDiamond: Phaser.GameObjects.Rectangle;
  private lastHovered: Phaser.GameObjects.GameObject | null = null;
  private clickCooldown = 0;
  private minHitDepth = 40;
  private nextId = 0;

  constructor(
    private scene: Phaser.Scene,
    private container: Phaser.GameObjects.Container,
  ) {
    // Virtual cursor visual
    this.cursorContainer = scene.add.container(this.cursorX, this.cursorY).setDepth(450).setScrollFactor(0);
    this.cursorContainer.setVisible(false);
    this.cursorGlow = scene.add.circle(0, 0, 14, 0x39d0d8, 0.15);
    this.cursorGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.cursorContainer.add(this.cursorGlow);
    this.cursorDiamond = scene.add.rectangle(0, 0, 10, 10, 0x39d0d8, 0.9);
    this.cursorDiamond.setAngle(45);
    this.cursorDiamond.setStrokeStyle(1.5, 0xffffff, 0.6);
    this.cursorContainer.add(this.cursorDiamond);
    scene.tweens.add({
      targets: this.cursorGlow,
      scale: { from: 0.8, to: 1.3 },
      alpha: { from: 0.08, to: 0.2 },
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }

  // ================ Registration ================

  /**
   * Register a focusable button. Returns the button id.
   * Call clearAll() before rebuilding content (e.g., tab switch).
   */
  addButton(
    x: number, y: number,
    bg: Phaser.GameObjects.Shape,
    onSelect: () => void,
    opts?: { text?: Phaser.GameObjects.Text; focusColor?: number; normalColor?: number; disabled?: boolean },
  ): number {
    const id = this.nextId++;
    const w = (bg as unknown as { displayWidth?: number }).displayWidth ?? 100;
    const h = (bg as unknown as { displayHeight?: number }).displayHeight ?? 32;
    this.focusables.push({
      id, x, y, w, h, onSelect,
      bg, text: opts?.text,
      focusColor: opts?.focusColor ?? 0x39d0d8,
      normalColor: opts?.normalColor ?? 0x1a3040,
      disabled: opts?.disabled ?? false,
    });
    // Wire mouse/touch handlers
    if (!opts?.disabled) {
      // S1 fix: remove old listeners BEFORE setInteractive to prevent accumulation.
      // When re-registering the same bg (e.g. Hangar tab switch), old listeners
      // must be cleared first. clearFocusables() does this, but as a safety net
      // (and for cases where addButton is called without clearFocusables):
      bg.off('pointerover');
      bg.off('pointerout');
      bg.off('pointerdown');
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        this.focusIndex = this.focusables.findIndex(f => f.bg === bg);
        this.updateFocusVisual();
        AudioSystem.play('uiHover');
      });
      bg.on('pointerout', () => this.updateFocusVisual());
      bg.on('pointerdown', () => {
        AudioSystem.play('uiClick');
        onSelect();
      });
    }
    // Auto-focus first button
    if (this.focusIndex < 0) this.focusIndex = 0;
    return id;
  }

  /** Register tabs for L1/R1 switching. */
  addTabs(tabs: UITab[]): void {
    this.tabs = tabs;
  }

  /** Set current tab index (for sync when tab clicked via mouse). */
  setCurrentTab(index: number): void {
    this.currentTabIndex = index;
  }

  /** Clear all focusables (call before rebuilding tab content).
   *  Removes event listeners from bg objects to prevent accumulation. */
  clearFocusables(): void {
    // S1 fix: do NOT call removeInteractive() — it corrupts Phaser's InputPlugin
    // internal state when called on a bg that's being processed mid-event.
    // Data showed _list.length doesn't change with removeInteractive, but mouse
    // still dies after 2-3 clicks. Only bg.off() listeners; bgs that are
    // destroyed are cleaned up by Phaser automatically.
    for (const f of this.focusables) {
      if (f.bg && f.bg.active) {
        try {
          f.bg.off('pointerover');
          f.bg.off('pointerout');
          f.bg.off('pointerdown');
        } catch { /* bg already destroyed */ }
      }
    }
    this.focusables = [];
    this.focusIndex = -1;
  }

  /** Get the currently focused button's onSelect, or null. */
  getFocusedOnSelect(): (() => void) | null {
    const f = this.focusables[this.focusIndex];
    return f && !f.disabled ? f.onSelect : null;
  }

  /** Trigger the first focusable button's onSelect (for B/ESC = resume). */
  triggerFirst(): void {
    const f = this.focusables[0];
    if (f && !f.disabled) f.onSelect();
  }

  /**
   * B3 fix: Focus the first non-disabled button at or after `startIndex`.
   * Used by HangarUI.showTab() to move focus from EXIT (index 0) to the
   * first content button after tab switch, preventing accidental EXIT
   * activation on the next key press.
   */
  focusButtonFrom(startIndex: number): void {
    for (let i = startIndex; i < this.focusables.length; i++) {
      if (!this.focusables[i].disabled) {
        this.focusIndex = i;
        this.updateFocusVisual();
        return;
      }
    }
    // Fallback: keep current focusIndex if no non-disabled button found
  }

  // ================ Cursor ================

  show(minDepth: number = 40): void {
    this.minHitDepth = minDepth;
    // Cursor starts HIDDEN — only appears when right stick is moved
    this.cursorVisible = false;
    this.cursorContainer.setVisible(false);
    this.cursorX = GAME.WIDTH / 2;
    this.cursorY = GAME.HEIGHT / 2;
    this.cursorContainer.setPosition(this.cursorX, this.cursorY);
    this.lastHovered = null;
    // Re-attach keyboard listener (hide() removes it)
    if (!this.keyHandler) this.setupKeyboard();
    // Focus first button
    if (this.focusables.length > 0) {
      this.focusIndex = 0;
      this.updateFocusVisual();
    }
  }

  hide(): void {
    this.cursorVisible = false;
    this.cursorContainer.setVisible(false);
    if (this.lastHovered && this.lastHovered.active) {
      this.lastHovered.emit('pointerout');
    }
    this.lastHovered = null;
    // Remove keyboard listener to prevent double-input when another
    // UIController is active (e.g., overlay over pause menu)
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  get isVisible(): boolean { return this.cursorVisible; }
  get hasHover(): boolean { return this.lastHovered !== null; }
  /** Get cursor X position (for slider click-to-jump in cursor mode). */
  get cursorPositionX(): number { return this.cursorX; }

  setPosition(x: number, y: number): void {
    this.cursorX = Phaser.Math.Clamp(x, 5, GAME.WIDTH - 5);
    this.cursorY = Phaser.Math.Clamp(y, 5, GAME.HEIGHT - 5);
    this.cursorContainer.setPosition(this.cursorX, this.cursorY);
  }

  // ================ Per-frame update ================

  update(): void {
    // Wrap in try/finally to ensure _sliderAdjusting flag is always reset,
    // even if an exception occurs mid-update (prevents UI lockup).
    try {
      this._updateInternal();
    } finally {
      (this as unknown as { _sliderAdjusting?: boolean })._sliderAdjusting = false;
    }
  }

  private _updateInternal(): void {
    const input = InputSystem.getState();
    this.navCooldown -= 16;
    this.clickCooldown -= 16;

    // ── Detect input mode: right stick = cursor mode, D-pad/stick left = focus mode ──
    const rightStickActive = Math.abs(input.rightStickX) > 0.05 || Math.abs(input.rightStickY) > 0.05;
    const dpadActive = input.heldUp || input.heldDown || input.heldLeft || input.heldRight
      || Math.abs(input.leftStickX) > 0.3 || Math.abs(input.leftStickY) > 0.3;

    // Right stick → enter cursor mode (show cursor)
    if (rightStickActive && !this.cursorVisible) {
      this.cursorVisible = true;
      this.cursorContainer.setVisible(true);
      // Clear focus highlight when entering cursor mode
      this.clearFocusVisual();
    }

    // D-pad/stick left → exit cursor mode (hide cursor, use focus)
    if (dpadActive && this.cursorVisible) {
      this.cursorVisible = false;
      this.cursorContainer.setVisible(false);
      this.clearHover();
      // Restore focus visual on current focused button
      this.updateFocusVisual();
    }

    // ── Cursor mode: move + hover + click ──
    if (this.cursorVisible) {
      const speed = 7;
      if (rightStickActive) {
        this.cursorX = Phaser.Math.Clamp(this.cursorX + input.rightStickX * speed, 5, GAME.WIDTH - 5);
        this.cursorY = Phaser.Math.Clamp(this.cursorY + input.rightStickY * speed, 5, GAME.HEIGHT - 5);
        this.cursorContainer.setPosition(this.cursorX, this.cursorY);
        this.processCursorHover();
      }
      // Cursor click (A button / fire)
      // B2 fix: use gp* flags (gamepad-only) so keyboard activation (keyHandler)
      // doesn't double-fire with update() on the same key press.
      if ((input.gpJumpPressed || input.gpFirePressed) && this.clickCooldown <= 0) {
        if (this.lastHovered && this.lastHovered.active) {
          // emit('pointerdown') fires addButton's handler which plays uiClick
          this.lastHovered.emit('pointerdown');
          this.clickCooldown = 200;
          this.navCooldown = 300;
        }
      }
      // In cursor mode, don't process focus nav
      return;
    }

    // ── Focus mode: D-pad/stick + A button ──
    if (this.navCooldown > 0) return;

    // Slider adjustment flag: if a slider is being adjusted via left/right stick,
    // skip tab switching (set by SettingsUI's preUpdateHandler).
    const sliderAdjusting = (this as unknown as { _sliderAdjusting?: boolean })._sliderAdjusting;

    // Tab switching (L1/R1, stick left/right)
    if (this.tabs.length > 0 && !sliderAdjusting) {
      // B2 fix: use gpWeaponPrevPressed (gamepad-only) for tab switching.
      // Keyboard Q/E is handled by keyHandler (not here) to avoid double-fire.
      if (input.gpWeaponPrevPressed || input.leftStickX < -0.3) {
        this.currentTabIndex = (this.currentTabIndex - 1 + this.tabs.length) % this.tabs.length;
        this.tabs[this.currentTabIndex].onSelect();
        AudioSystem.play('uiClick');
        this.navCooldown = 200;
        return;
      }
      // B2 fix: use gpWeaponNextPressed (gamepad-only) for tab switching.
      if (input.gpWeaponNextPressed || input.leftStickX > 0.3) {
        this.currentTabIndex = (this.currentTabIndex + 1) % this.tabs.length;
        this.tabs[this.currentTabIndex].onSelect();
        AudioSystem.play('uiClick');
        this.navCooldown = 200;
        return;
      }
    }

    // Item navigation (D-pad/stick up/down/left/right)
    // Left/right only for focus navigation when NO tabs (tabs use L1/R1 above).
    // When tabs exist, left/right is consumed by tab switching (lines 271-286).
    const up = input.leftStickY < -0.3 || input.heldUp;
    const down = input.leftStickY > 0.3 || input.heldDown;
    const left = this.tabs.length === 0 && (input.heldLeft || input.leftStickX < -0.3);
    const right = this.tabs.length === 0 && (input.heldRight || input.leftStickX > 0.3);
    if (up || down || left || right) {
      if (this.focusables.length > 0) {
        if (up) this.focusIndex = this.findNearest('up');
        else if (down) this.focusIndex = this.findNearest('down');
        else if (left) this.focusIndex = this.findNearest('left');
        else this.focusIndex = this.findNearest('right');
        this.updateFocusVisual();
        AudioSystem.play('uiHover');
        this.navCooldown = 120;
      }
    }

    // Activate (A button / Enter / fire)
    // B2 fix: use gp* flags (gamepad-only) for focus activation.
    // Keyboard Enter/Space is handled by keyHandler (not here) to avoid double-fire.
    if (input.gpJumpPressed || input.gpFirePressed) {
      const f = this.focusables[this.focusIndex];
      if (f && !f.disabled) {
        AudioSystem.play('uiClick');
        f.onSelect();
        this.navCooldown = 300;
      }
    }
    // _sliderAdjusting flag is reset in update()'s finally block
  }

  /** Clear focus highlight on all buttons (when entering cursor mode). */
  private clearFocusVisual(): void {
    this.focusables.forEach(f => {
      if (!f.bg || !f.bg.active) return;
      try {
        f.bg.setStrokeStyle(1, f.normalColor ?? 0x1a3040, 0.7);
        f.bg.setScale(1);
        if (f.text) f.text.setColor('#cfd6e0');
      } catch { /* */ }
    });
  }

  // ================ Internal: spatial navigation ================

  private findNearest(direction: 'up' | 'down' | 'left' | 'right'): number {
    if (this.focusables.length === 0) return -1;
    if (this.focusIndex < 0) return 0;
    const current = this.focusables[this.focusIndex];
    if (!current) return 0;

    let bestIdx = -1;
    let bestScore = Infinity;
    for (let i = 0; i < this.focusables.length; i++) {
      if (i === this.focusIndex) continue;
      const f = this.focusables[i];
      if (f.disabled) continue;
      const dx = f.x - current.x;
      const dy = f.y - current.y;
      let inDir = false;
      let primary = 0;
      let secondary = 0;
      if (direction === 'up') { inDir = dy < -10; primary = Math.abs(dy); secondary = Math.abs(dx); }
      else if (direction === 'down') { inDir = dy > 10; primary = Math.abs(dy); secondary = Math.abs(dx); }
      else if (direction === 'left') { inDir = dx < -10; primary = Math.abs(dx); secondary = Math.abs(dy); }
      else { inDir = dx > 10; primary = Math.abs(dx); secondary = Math.abs(dy); }
      if (!inDir) continue;
      const score = primary + secondary * 0.4;
      if (score < bestScore) { bestScore = score; bestIdx = i; }
    }
    // Fallback: wrap around (only for up/down to preserve existing behavior;
    // left/right have no sensible wrap in 2D grids)
    if (bestIdx === -1) {
      if (direction === 'up') return (this.focusIndex - 1 + this.focusables.length) % this.focusables.length;
      if (direction === 'down') return (this.focusIndex + 1) % this.focusables.length;
      return this.focusIndex;  // no left/right neighbor — stay
    }
    return bestIdx;
  }

  // ================ Internal: cursor hover detection ================

  private processCursorHover(): void {
    const inputPlugin = this.scene.input as unknown as {
      _list: Phaser.GameObjects.GameObject[];
      manager: {
        hitTest: (pointer: { x: number; y: number }, gameObjects: Phaser.GameObjects.GameObject[], camera: Phaser.Cameras.Scene2D.Camera, output?: Phaser.GameObjects.GameObject[]) => Phaser.GameObjects.GameObject[];
      };
    };
    const candidates = inputPlugin._list.filter(go => {
      const goInput = go as unknown as { input?: { enabled?: boolean } };
      if (!goInput.input || !goInput.input.enabled) return false;
      let obj: Phaser.GameObjects.GameObject | null = go;
      while (obj) {
        const c = obj as unknown as { visible?: boolean; parentContainer?: Phaser.GameObjects.Container | null };
        if (c.visible === false) return false;
        obj = c.parentContainer ?? null;
      }
      return this.getDepth(go) >= this.minHitDepth;
    });
    if (candidates.length === 0) { this.clearHover(); return; }
    const mockPointer = { x: this.cursorX, y: this.cursorY };
    const hits = inputPlugin.manager.hitTest(mockPointer as Phaser.Input.Pointer, candidates, this.scene.cameras.main);
    if (!hits || hits.length === 0) { this.clearHover(); return; }
    // Sort: prefer focusable buttons (registered via addButton) over overlays/backgrounds
    hits.sort((a, b) => {
      // S2 fix: prioritize focusable buttons over non-focusable objects (like overlay rect)
      const aFocusable = this.focusables.some(f => f.bg === a) ? 1 : 0;
      const bFocusable = this.focusables.some(f => f.bg === b) ? 1 : 0;
      if (aFocusable !== bFocusable) return bFocusable - aFocusable;
      const depthDiff = this.getDepth(b) - this.getDepth(a);
      if (depthDiff !== 0) return depthDiff;
      const aBtn = this.hasHandlers(a) ? 1 : 0;
      const bBtn = this.hasHandlers(b) ? 1 : 0;
      return bBtn - aBtn;
    });
    const hovered = hits[0];
    if (hovered !== this.lastHovered) {
      this.clearHover();
      this.lastHovered = hovered;
      hovered.emit('pointerover');
      // Sync focus index to hovered button
      const idx = this.focusables.findIndex(f => f.bg === hovered);
      if (idx >= 0) { this.focusIndex = idx; this.updateFocusVisual(); }
    }
  }

  private clearHover(): void {
    if (this.lastHovered && this.lastHovered.active) {
      this.lastHovered.emit('pointerout');
    }
    this.lastHovered = null;
  }

  private hasHandlers(go: Phaser.GameObjects.GameObject): boolean {
    const events = (go as unknown as { _events?: Record<string, unknown> })._events;
    if (!events) return false;
    return 'pointerover' in events || 'pointerdown' in events;
  }

  private getDepth(go: Phaser.GameObjects.GameObject): number {
    let depth = (go as unknown as { depth?: number }).depth ?? 0;
    let parent = (go as unknown as { parentContainer?: Phaser.GameObjects.Container | null }).parentContainer;
    while (parent) {
      const pd = (parent as unknown as { depth?: number }).depth ?? 0;
      if (pd > depth) depth = pd;
      parent = (parent as unknown as { parentContainer?: Phaser.GameObjects.Container | null }).parentContainer ?? null;
    }
    return depth;
  }

  // ================ Internal: focus visual ================

  private updateFocusVisual(): void {
    this.focusables.forEach((f, i) => {
      if (!f.bg || !f.bg.active) return;
      try {
        if (i === this.focusIndex) {
          f.bg.setStrokeStyle(2, f.focusColor ?? 0x39d0d8, 0.9);
          f.bg.setScale(1.05);
          if (f.text) f.text.setColor('#66f0ff');
        } else {
          f.bg.setStrokeStyle(1, f.normalColor ?? 0x1a3040, 0.7);
          f.bg.setScale(1);
          if (f.text) f.text.setColor('#cfd6e0');
        }
      } catch { /* canvas not ready */ }
    });
  }

  // ================ Keyboard handler (separate from polling) ================

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  setupKeyboard(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = (e: KeyboardEvent) => {
      if (this.focusables.length === 0) return;
      // Enter/Space = activate focused button
      // NOTE: Space also sets jumpPressed in InputSystem (via kbEdge.jump).
      // To prevent double-fire (keyHandler + update()), we set navCooldown
      // so update() skips activation for this frame.
      // B2 fix: keyHandler does NOT play uiClick — onSelect callback is the
      // single source of activation sound (e.g. togglePause, openOverlay).
      // This prevents double-sound when both keyHandler and onSelect play.
      if (e.code === 'Enter' || e.code === 'Space') {
        const f = this.focusables[this.focusIndex];
        if (f && !f.disabled) {
          f.onSelect();
          this.navCooldown = 300;  // prevent update() from also activating
        }
        return;
      }
      // Arrow/WASD navigation — gated by navCooldown to prevent double-step
      if (this.navCooldown > 0) return;
      let moved = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.focusIndex = this.findNearest('up'); moved = true;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.focusIndex = this.findNearest('down'); moved = true;
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        if (this.tabs.length > 0) {
          // Tab switching (existing behavior for UIs with tabs)
          this.currentTabIndex = (this.currentTabIndex - 1 + this.tabs.length) % this.tabs.length;
          this.tabs[this.currentTabIndex].onSelect(); AudioSystem.play('uiClick');
          this.navCooldown = 200;
        } else {
          // Focus navigation left (new — for UIs without tabs, e.g. Pause Menu)
          this.focusIndex = this.findNearest('left'); moved = true;
        }
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        if (this.tabs.length > 0) {
          // Tab switching (existing behavior for UIs with tabs)
          this.currentTabIndex = (this.currentTabIndex + 1) % this.tabs.length;
          this.tabs[this.currentTabIndex].onSelect(); AudioSystem.play('uiClick');
          this.navCooldown = 200;
        } else {
          // Focus navigation right (new — for UIs without tabs, e.g. Pause Menu)
          this.focusIndex = this.findNearest('right'); moved = true;
        }
      }
      if (moved) {
        this.updateFocusVisual(); AudioSystem.play('uiHover');
        this.navCooldown = 120;
        const f = this.focusables[this.focusIndex];
        if (f) this.setPosition(f.x, f.y);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  // ================ Lifecycle ================

  destroy(): void {
    if (this.keyHandler) { window.removeEventListener('keydown', this.keyHandler); this.keyHandler = null; }
    this.cursorContainer.destroy();
    this.focusables = [];
    this.tabs = [];
  }
}

export default UIController;
