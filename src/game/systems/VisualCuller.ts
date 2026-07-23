/**
 * MECHA: LAST PROTOCOL — Visual Culler v1.0
 *
 * Per Phaser 4.2.1 sprites-and-images skill: Phaser does NOT automatically
 * cull game objects outside the camera viewport. Every GameObject on the
 * display list is processed each frame:
 *   1. Added to camera renderList
 *   2. Matrix transform computed
 *   3. Submitted to WebGL batch (even if off-screen)
 *
 * For large worlds (Act II = 15360px wide), this means hundreds of
 * off-screen GameObjects are processed every frame — the root cause of
 * FPS drops in large Acts.
 *
 * Solution: setVisible(false) on objects outside the camera viewport
 * (with a margin). When visible=false, Phaser skips the object entirely
 * in the render pipeline — no matrix, no batch, no draw call.
 *
 * Per sprites-and-images skill: "invisible objects skip rendering but
 * still update" — so physics + game logic still run. This is correct
 * behavior: we want physics to keep working for culling decisions, but
 * we don't want to render objects the player can't see.
 *
 * Architecture:
 *   - Tracks all visual GameObject arrays from LoadedArea
 *   - Runs every ~250ms (4x/sec) — cheaper than every frame
 *   - Uses camera.worldView for accurate viewport bounds
 *   - 300px margin so objects wake before they scroll into view
 *   - Toggles .setVisible(false/true) — idempotent, cheap to repeat
 *
 * Note: physics bodies are culled separately in PlayController.runCulling()
 * via body.isSleeping. This VisualCuller handles ONLY visual GameObjects.
 */
import Phaser from 'phaser';
import type { LoadedArea } from '../world/AreaLoader';

export class VisualCuller {
  /** How often (in ms) to re-evaluate visibility. 250ms = 4x per second. */
  private static readonly CULL_INTERVAL_MS = 250;

  /** Margin (in pixels) beyond the camera viewport. Objects within this
   *  margin stay visible to prevent pop-in when scrolling. */
  private static readonly VIEWPORT_MARGIN = 300;

  private static accumulator = 0;

  /**
   * Update visibility of all visual GameObjects in the loaded area.
   * Call this once per frame from PlayController.update() — it self-throttles
   * via the accumulator.
   */
  static update(deltaMs: number, area: LoadedArea | null, scene: Phaser.Scene): void {
    if (!area) return;
    VisualCuller.accumulator += deltaMs;
    if (VisualCuller.accumulator < VisualCuller.CULL_INTERVAL_MS) return;
    VisualCuller.accumulator = 0;

    const cam = scene.cameras.main;
    // Use worldView for accurate bounds (accounts for zoom + scroll)
    const view = cam.worldView;
    const margin = VisualCuller.VIEWPORT_MARGIN;
    const viewLeft = view.x - margin;
    const viewRight = view.x + view.width + margin;
    const viewTop = view.y - margin;
    const viewBottom = view.y + view.height + margin;

    // ── Helper: check if a position is within the expanded viewport ──
    const inView = (x: number, y: number): boolean =>
      x >= viewLeft && x <= viewRight && y >= viewTop && y <= viewBottom;

    // ── Helper: cull a single GameObject by position ──
    // setVisible() is idempotent — Phaser tracks the current state and
    // skips the work if the value hasn't changed.
    //
    // BONUS: When visibility changes, also pause/resume any tweens targeting
    // this object AND its children (for Containers). Per Phaser 4 tweens
    // skill: TweenManager processes ALL active tweens every frame, even for
    // invisible objects. Pausing tweens on off-screen objects saves
    // significant CPU on large worlds with many decoration tweens
    // (fog wisps, glow pulses, drift animations).
    const cullByPos = (go: Phaser.GameObjects.GameObject | null, x: number, y: number): void => {
      if (!go || !go.active) return;
      const visible = go as unknown as { visible: boolean };
      const shouldShow = inView(x, y);
      if (visible.visible === shouldShow) return;  // no change → skip tween work
      visible.visible = shouldShow;
      // Pause/resume tweens targeting this object AND its descendants
      // (for Containers like loreObjects/collectibles, tweens are usually
      // on the child glow circles, not the container itself)
      const allTargets: Phaser.GameObjects.GameObject[] = [go];
      // Recursively gather children if this is a Container
      const containerLike = go as unknown as { list?: Phaser.GameObjects.GameObject[] };
      if (containerLike.list) {
        for (const child of containerLike.list) allTargets.push(child);
      }
      for (const target of allTargets) {
        const tweens = scene.tweens.getTweensOf(target);
        for (const tw of tweens) {
          if (shouldShow && tw.isPaused()) tw.resume();
          else if (!shouldShow && !tw.isPaused()) tw.pause();
        }
      }
    };

    // ── visualRects: platforms, decorations, hazards visuals ──
    // These are spread across the world. Check by position.
    // Also pause/resume tweens when visibility changes (same logic as cullByPos).
    for (const go of area.visualRects) {
      if (!go || !go.active) continue;
      const pos = go as unknown as { x: number; y: number; visible: boolean };
      const shouldShow = inView(pos.x, pos.y);
      if (pos.visible === shouldShow) continue;
      pos.visible = shouldShow;
      // visualRects are typically Graphics (no children), but check anyway
      const containerLike = go as unknown as { list?: Phaser.GameObjects.GameObject[] };
      const allTargets: Phaser.GameObjects.GameObject[] = [go as unknown as Phaser.GameObjects.GameObject];
      if (containerLike.list) {
        for (const child of containerLike.list) allTargets.push(child);
      }
      for (const target of allTargets) {
        const tweens = scene.tweens.getTweensOf(target);
        for (const tw of tweens) {
          if (shouldShow && tw.isPaused()) tw.resume();
          else if (!shouldShow && !tw.isPaused()) tw.pause();
        }
      }
    }

    // ── loreObjects: terminals, corpses, echoes (depth 8) ──
    for (const go of area.loreObjects) {
      cullByPos(go, go.x, go.y);
    }

    // ── landmarks: crashed_mech, tower, etc. (depth 3) ──
    for (const go of area.landmarks) {
      cullByPos(go, go.x, go.y);
    }

    // ── grappleAnchors (depth 6) ──
    for (const go of area.grappleAnchors) {
      cullByPos(go, go.x, go.y);
    }

    // ── empDoors (depth 7) ──
    for (const go of area.empDoors) {
      cullByPos(go, go.x, go.y);
    }

    // ── shortcuts (depth 6) ──
    for (const go of area.shortcuts) {
      cullByPos(go, go.x, go.y);
    }

    // ── collectibles (depth 8) ──
    for (const go of area.collectibles) {
      cullByPos(go, go.x, go.y);
    }

    // NOTE: We do NOT cull:
    //   - solids/sectionTriggers/checkpointTriggers/hazardTriggers — these
    //     are invisible (PhysicsSystem.addStaticRect/addSensor sets
    //     setVisible(false)) and handled by physics culling instead.
    //   - bossEntryTrigger — single object, always near boss arena.
  }
}

export default VisualCuller;
