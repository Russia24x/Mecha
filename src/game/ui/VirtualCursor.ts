/**
 * MECHA: LAST PROTOCOL — Virtual Cursor
 *
 * A gamepad-controlled virtual cursor for navigating 2D UI overlays.
 * Controlled by the RIGHT analog stick. Works with any UI that uses
 * Phaser's setInteractive() — skill tree, hangar, inventory, settings, etc.
 *
 * How it works:
 *   1. Moves a visual cursor (cyan diamond + glow) with rightStickX/Y
 *   2. Each frame, uses scene.input.hitTest() to find interactive objects under cursor
 *   3. Fires 'pointerover' on hover (syncs focus with NavigableOverlay)
 *   4. Fires 'pointerdown' on A button press (triggers click)
 *
 * The cursor only interacts with overlay-depth objects (depth >= 290) to avoid
 * hitting play-state objects behind the overlay.
 *
 * Lifecycle:
 *   - OverlayManager shows cursor when an overlay opens
 *   - OverlayManager hides cursor when all overlays close
 *   - OverlayManager.update() calls cursor.update() each frame
 *
 * Speed is analog — stick magnitude controls cursor speed.
 */
import Phaser from 'phaser';
import { GAME } from '../shared/Constants';
import { InputSystem } from '../systems/InputSystem';
import { AudioSystem } from '../systems/AudioSystem';

export class VirtualCursor {
  private cursor: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Arc;
  private diamond: Phaser.GameObjects.Rectangle;
  private x: number;
  private y: number;
  private lastHovered: Phaser.GameObjects.GameObject | null = null;
  private visible = false;
  private clickCooldown = 0;
  /** Minimum depth for hit-testing. Set by show() based on context. */
  private minHitDepth = 280;

  constructor(private scene: Phaser.Scene) {
    this.x = GAME.WIDTH / 2;
    this.y = GAME.HEIGHT / 2;

    // Visual cursor: cyan diamond + glow
    this.cursor = scene.add.container(this.x, this.y).setDepth(450).setScrollFactor(0);
    this.cursor.setVisible(false);

    // Glow (pulsing)
    this.glow = scene.add.circle(0, 0, 14, 0x39d0d8, 0.15);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    this.cursor.add(this.glow);

    // Diamond (rotated square)
    this.diamond = scene.add.rectangle(0, 0, 10, 10, 0x39d0d8, 0.9);
    this.diamond.setAngle(45);
    this.diamond.setStrokeStyle(1.5, 0xffffff, 0.6);
    this.cursor.add(this.diamond);

    // Pulse animation
    scene.tweens.add({
      targets: this.glow,
      scale: { from: 0.8, to: 1.3 },
      alpha: { from: 0.08, to: 0.2 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  /**
   * Show the cursor.
   * @param minDepth Minimum depth for hit-testing (default 280 for overlays).
   *   - Overlays (skills/hangar/inventory/etc.): 280 (overlay depth range)
   *   - Menu/hub/gameover/victory: 40 (stateContainer depth is 50)
   */
  show(minDepth: number = 280): void {
    this.visible = true;
    this.minHitDepth = minDepth;
    this.cursor.setVisible(true);
    // Reset to center
    this.x = GAME.WIDTH / 2;
    this.y = GAME.HEIGHT / 2;
    this.cursor.setPosition(this.x, this.y);
    this.lastHovered = null;
  }

  /** Hide the cursor (called when all overlays close). */
  hide(): void {
    this.visible = false;
    this.cursor.setVisible(false);
    // Fire pointerout on last hovered
    if (this.lastHovered && this.lastHovered.active) {
      this.lastHovered.emit('pointerout');
    }
    this.lastHovered = null;
  }

  /**
   * Per-frame update — move cursor + check hover + handle click.
   * Called from OverlayManager.handleInput().
   */
  update(): void {
    if (!this.visible) return;

    const input = InputSystem.getState();
    this.clickCooldown -= 16;

    // ── Move cursor with right analog stick (analog speed) ──
    const speed = 7;  // pixels per frame at full stick deflection
    this.x += input.rightStickX * speed;
    this.y += input.rightStickY * speed;

    // Clamp to screen bounds
    this.x = Phaser.Math.Clamp(this.x, 5, GAME.WIDTH - 5);
    this.y = Phaser.Math.Clamp(this.y, 5, GAME.HEIGHT - 5);
    this.cursor.setPosition(this.x, this.y);

    // ── Find interactive object under cursor ──
    const hovered = this.findObjectUnderCursor();
    if (hovered !== this.lastHovered) {
      // Fire pointerout on previous
      if (this.lastHovered && this.lastHovered.active) {
        this.lastHovered.emit('pointerout');
      }
      // Fire pointerover on new
      if (hovered) {
        hovered.emit('pointerover');
        AudioSystem.play('uiHover');
      }
      this.lastHovered = hovered;
    }

    // ── Click with A button (jumpPressed) or RT (firePressed) ──
    if ((input.jumpPressed || input.firePressed) && hovered && this.clickCooldown <= 0) {
      AudioSystem.play('uiClick');
      hovered.emit('pointerdown');
      this.clickCooldown = 200;
    }
  }

  /**
   * Find the topmost interactive object under the cursor position.
   * Uses Phaser's InputManager.hitTest with a mock pointer.
   *
   * Depth filtering:
   *   - Overlay state (cursor shown by OverlayManager): depth >= 280
   *     (overlays = 300, dialogue = 290, lore = 285)
   *   - Menu/hub/gameover/victory state (cursor shown by GameScene):
   *     depth >= 40 (stateContainer = 50, so all menu buttons qualify)
   *
   * Prefers "button" objects (those with pointerover/pointerdown handlers)
   * over full-screen background blockers (which are just click-swallowers).
   */
  private findObjectUnderCursor(): Phaser.GameObjects.GameObject | null {
    // Access the internal list of interactive game objects
    const inputPlugin = this.scene.input as unknown as {
      _list: Phaser.GameObjects.GameObject[];
      manager: {
        hitTest: (pointer: { x: number; y: number }, gameObjects: Phaser.GameObjects.GameObject[], camera: Phaser.Cameras.Scene2D.Camera, output?: Phaser.GameObjects.GameObject[]) => Phaser.GameObjects.GameObject[];
      };
    };

    // Determine minimum depth based on context:
    // - If in play state (paused or overlay open), only hit overlay-depth objects
    //   to avoid hitting play-state objects behind the overlay
    // - If in menu/hub/gameover/victory, hit anything at stateContainer depth (50+)
    //   or higher
    const minDepth = this.minHitDepth;

    // Filter to interactive objects at or above minDepth
    const candidates = inputPlugin._list.filter(go => {
      const goInput = go as unknown as { input?: { enabled?: boolean } };
      if (!goInput.input || !goInput.input.enabled) return false;
      // Check visibility chain
      let obj: Phaser.GameObjects.GameObject | null = go;
      while (obj) {
        const components = obj as unknown as { visible?: boolean; parentContainer?: Phaser.GameObjects.Container | null };
        if (components.visible === false) return false;
        obj = components.parentContainer ?? null;
      }
      return this.getDepth(go) >= minDepth;
    });

    if (candidates.length === 0) return null;

    // Use Phaser's hitTest with a mock pointer (only needs x, y properties)
    const mockPointer = { x: this.x, y: this.y };
    const camera = this.scene.cameras.main;
    const hits = inputPlugin.manager.hitTest(mockPointer as Phaser.Input.Pointer, candidates, camera);
    if (!hits || hits.length === 0) return null;

    // Sort by depth (highest = topmost first), then prefer buttons over backgrounds
    hits.sort((a, b) => {
      const depthDiff = this.getDepth(b) - this.getDepth(a);
      if (depthDiff !== 0) return depthDiff;
      // Same depth — prefer objects with pointerover/pointerdown handlers (buttons)
      // over plain click-swallowers (background overlays)
      const aIsButton = this.hasPointerHandlers(a) ? 1 : 0;
      const bIsButton = this.hasPointerHandlers(b) ? 1 : 0;
      return bIsButton - aIsButton;
    });
    return hits[0];
  }

  /**
   * Check if a game object has pointerover or pointerdown event handlers.
   * Used to distinguish real buttons from full-screen click-swallowing backgrounds.
   */
  private hasPointerHandlers(go: Phaser.GameObjects.GameObject): boolean {
    const events = (go as unknown as { _events?: Record<string, unknown> })._events;
    if (!events) return false;
    return 'pointerover' in events || 'pointerdown' in events;
  }

  /** Get the effective depth of a game object (max of own depth + parent containers). */
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

  /** Destroy cursor visuals. */
  destroy(): void {
    this.cursor.destroy();
  }
}

export default VirtualCursor;
