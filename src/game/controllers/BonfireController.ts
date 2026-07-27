/**
 * MECHA: LAST PROTOCOL — Bonfire Controller
 *
 * Manages Bonfire (Dark Souls-style save point) GameObjects in the current area.
 * Architecture decision (per advisor): uses NPC/Lore pattern — distance check +
 * floating prompt (delegated to NpcInteractionController) + interact key (E).
 * NO Matter sensor, NO CollisionController route, NO physics body cleanup.
 *
 * Responsibilities:
 *   - spawnBonfires(areaId, loadedArea) → create bonfire GameObjects (amber
 *     terminal with glow container), store in loadedArea.bonfires
 *   - syncLitState(loadedArea)           → apply SaveSystem.isBonfireLit() to
 *     freshly spawned bonfires (mirrors MetroidvaniaController.hidePreCollectedItems)
 *   - tryInteract(loadedArea, player)   → if player near bonfire (< 70px),
 *     perform heal+save+light+toast (called from GameScene.tryInteract after
 *     NPC/Lore branches). Uses interactPressed (instant), NOT heldInteract.
 *   - cleanup()                          → destroy all bonfire visuals + tweens
 *
 * Owns: bonfireVisuals (Map<id, Container>), activeTweens (for pulsing glow).
 * Dependencies: scene (for add/tweens), player + loadedArea passed per-call.
 *
 * preLit policy (per A3-followup):
 *   - Only bf_factory1_1 (game-start anchor) has `preLit: true` in static data.
 *   - All other area-entry bonfires are lit dynamically via
 *     SaveSystem.lightBonfire() when player crosses an exit gate (Phase C3).
 *   - syncLitState() here reads SaveSystem.isBonfireLit() to apply visual state
 *     on area load — works for both preLit (already in save on new game) and
 *     gate-lit bonfires.
 *
 * Scope (per A3-final-decisions):
 *   - Phase B does NOT implement enemy respawn. First Bonfire version =
 *     heal + save + light + toast only. Respawn deferred to Phase F.
 *   - Phase B does NOT implement Continue/Fast Travel/Quit-to-Hub menu.
 *     Menu deferred to Phase D (opens WorldMapUI).
 */
import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { EventBus } from '../systems/EventBus';
import { CheckpointSystem } from '../world/CheckpointSystem';
import { WorldSystem } from '../world/WorldSystem';
import { t, getLocale } from '../systems/LocalizationSystem';
import type { LoadedArea } from '../world/AreaLoader';
import type { PlayerEntity } from '../entities/player/PlayerEntity';
import type { BonfireData } from '../data/types';

/** Interaction radius — must match NpcInteractionController bonfire loop. */
const BONFIRE_INTERACT_RADIUS = 70;

/** Visual constants — amber terminal aesthetic. */
const AMBER = 0xffc040;
const AMBER_DIM = 0x6a4a18;
const TERMINAL_W = 24;
const TERMINAL_H = 40;

export class BonfireController {
  private scene: Phaser.Scene;
  /** Map of bonfireId → Container, for proximity check + cleanup. */
  private bonfireVisuals: Map<string, Phaser.GameObjects.Container> = new Map();
  /** Tracked tweens (pulsing glow) — destroyed on cleanup. */
  private activeTweens: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Spawn bonfire GameObjects for the current area.
   * Called from PlayController.build after areaLoader.load() + hidePreCollectedItems.
   *
   * Visual: amber mech terminal with glow halo. Lit bonfires glow brighter;
   * unlit are dim. The actual lit/unlit state is applied separately by
   * syncLitState() — spawn only creates the GameObject shells here.
   *
   * NO Matter sensor is created (per architecture decision). Proximity
   * detection happens per-frame in NpcInteractionController.updatePrompt
   * via distance check; interact happens in tryInteract().
   */
  spawnBonfires(areaId: string, loadedArea: LoadedArea): void {
    const area = WorldSystem.getCurrentArea();
    if (!area) return;

    // Collect bonfires from all sections of the current area
    const bonfires: BonfireData[] = [];
    for (const section of area.sections) {
      if (section.bonfires) {
        bonfires.push(...section.bonfires);
      }
    }

    for (const bf of bonfires) {
      const container = this.createBonfireVisual(bf);
      loadedArea.bonfires.push(container);
      this.bonfireVisuals.set(bf.id, container);
    }
  }

  /**
   * Apply saved lit/unlit state to freshly spawned bonfire GameObjects.
   * Called from PlayController.build immediately after spawnBonfires.
   * Mirrors MetroidvaniaController.hidePreCollectedItems pattern.
   *
   * Reads SaveSystem.isBonfireLit(bonfireId) for each bonfire. If lit,
   * applies the "lit" visual (bright amber glow). If unlit, applies the
   * "unlit" visual (dim). preLit bonfires (bf_factory1_1 only) are
   * automatically lit via SaveSystem.lightBonfire() at game start.
   */
  syncLitState(loadedArea: LoadedArea): void {
    const area = WorldSystem.getCurrentArea();
    if (!area) return;

    // For each bonfire in the data, check save state + preLit flag
    for (const section of area.sections) {
      if (!section.bonfires) continue;
      for (const bf of section.bonfires) {
        const container = this.bonfireVisuals.get(bf.id);
        if (!container || !container.active) continue;

        // preLit + not yet in save → light it (game-start anchor only)
        if (bf.preLit && !SaveSystem.isBonfireLit(bf.id)) {
          SaveSystem.lightBonfire(bf.id);
        }

        const isLit = SaveSystem.isBonfireLit(bf.id);
        this.applyLitVisual(container, isLit);
        container.setData('isLit', isLit);
      }
    }
  }

  /**
   * Try to interact with a nearby bonfire.
   * Called from GameScene.tryInteract() AFTER NPC and Lore branches.
   *
   * Uses interactPressed (instant single press), NOT heldInteract —
   * bonfire has no progress-bar or duration channel in its design.
   *
   * Behavior when player is near (< BONFIRE_INTERACT_RADIUS):
   *   1. refillRepair() — heal HP + energy
   *   2. SaveSystem.saveCheckpoint() — bonfire becomes the respawn point
   *   3. SaveSystem.lightBonfire() — mark as lit (fast-travel destination)
   *   4. AudioSystem.play('checkpoint') + toast "✓ BONFIRE LIT"
   *   5. Apply lit visual (brighten glow)
   *
   * Returns true if interaction occurred (so GameScene can short-circuit).
   */
  tryInteract(loadedArea: LoadedArea, player: PlayerEntity): boolean {
    if (!player.sprite || !player.sprite.active) return false;

    const nearest = this.findNearestBonfire(player.sprite.x, player.sprite.y);
    if (!nearest) return false;

    const { id, container, data } = nearest;
    const wasAlreadyLit = container.getData('isLit') === true;

    // 1. Heal HP + energy
    player.refillRepair();

    // 2. Save checkpoint at bonfire position
    const loc = WorldSystem.getCurrent();
    CheckpointSystem.activate(data.section, data.x, data.y);
    // Also persist checkpoint with area context for respawn-after-restart
    SaveSystem.saveCheckpoint({
      actId: loc.actId,
      regionId: loc.regionId,
      areaId: loc.areaId,
      section: data.section,
      x: data.x,
      y: data.y,
      timestamp: Date.now(),
    });

    // 3. Light the bonfire (idempotent — SaveSystem.lightBonfire checks for dupes)
    SaveSystem.lightBonfire(id);

    // 4. Audio + toast (localized via bonfire.lit / bonfire.rested keys).
    // Use EventBus.emit('BONFIRE_LIT', ...) — GameScene.onBonfireLit handler
    // calls hud.toast() with the localized message. We do NOT call
    // scene.events.emit('TOAST', ...) directly because that event is not
    // handled anywhere in the codebase (verified via grep).
    AudioSystem.play('checkpoint');
    const toastMsg = wasAlreadyLit
      ? (t('bonfire.rested') || (getLocale() === 'fa' ? '✓ استراحت شد' : '✓ RESTED'))
      : (t('bonfire.lit') || (getLocale() === 'fa' ? '✓ بونفایر روشن شد' : '✓ BONFIRE LIT'));
    EventBus.emit('BONFIRE_LIT', { bonfireId: id, message: toastMsg, wasAlreadyLit });

    // 5. Apply lit visual (brighten glow)
    this.applyLitVisual(container, true);
    container.setData('isLit', true);

    return true;
  }

  /**
   * Destroy all bonfire visuals + tweens.
   * Called from GameScene.cleanupPlay.
   */
  cleanup(): void {
    this.activeTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
    this.activeTweens = [];
    this.bonfireVisuals.forEach(v => { if (v && v.active) v.destroy(); });
    this.bonfireVisuals.clear();
  }

  // ── Private helpers ──

  /**
   * Find the nearest bonfire within interaction radius.
   * Returns null if none in range.
   */
  private findNearestBonfire(
    px: number, py: number,
  ): { id: string; container: Phaser.GameObjects.Container; data: BonfireData } | null {
    const area = WorldSystem.getCurrentArea();
    if (!area) return null;

    let nearestDist = BONFIRE_INTERACT_RADIUS;
    let nearestId: string | null = null;

    for (const section of area.sections) {
      if (!section.bonfires) continue;
      for (const bf of section.bonfires) {
        const dist = Phaser.Math.Distance.Between(px, py, bf.x, bf.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = bf.id;
        }
      }
    }

    if (!nearestId) return null;
    const container = this.bonfireVisuals.get(nearestId);
    if (!container || !container.active) return null;

    // Find the BonfireData for the nearest bonfire
    for (const section of area.sections) {
      if (!section.bonfires) continue;
      for (const bf of section.bonfires) {
        if (bf.id === nearestId) {
          return { id: nearestId, container, data: bf };
        }
      }
    }
    return null;
  }

  /**
   * Create a bonfire visual: amber mech terminal with glow halo.
   * Container has setData('bonfireId', id) and setData('isLit', false) for
   * NpcInteractionController.updatePrompt bonfire loop.
   */
  private createBonfireVisual(bf: BonfireData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(bf.x, bf.y);

    // Base pedestal (dark metal)
    const base = this.scene.add.rectangle(0, TERMINAL_H / 2 + 4, TERMINAL_W + 12, 8, 0x1a1814, 0.9);
    base.setStrokeStyle(1, 0x3a3018, 0.6);
    container.add(base);

    // Terminal body (tall rectangle, dim by default)
    const body = this.scene.add.rectangle(0, 0, TERMINAL_W, TERMINAL_H, 0x2a2018, 0.85);
    body.setStrokeStyle(1, AMBER_DIM, 0.6);
    container.add(body);

    // Inner amber core (small rectangle — brightens when lit)
    const core = this.scene.add.rectangle(0, -4, TERMINAL_W - 8, TERMINAL_H - 16, AMBER_DIM, 0.5);
    core.setBlendMode(Phaser.BlendModes.ADD);
    container.add(core);
    container.setData('core', core);

    // Glow halo (radial pulse — brightens when lit)
    const glow = this.scene.add.circle(0, -4, TERMINAL_W * 1.5, AMBER, 0);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    container.add(glow);
    container.setData('glow', glow);

    // Pulse tween on glow (tracked for cleanup)
    const tween = this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.0, to: 0.0 },  // overridden by applyLitVisual
      scale: { from: 0.9, to: 1.1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.activeTweens.push(tween);

    // Metadata for NpcInteractionController bonfire loop + tryInteract
    container.setData('bonfireId', bf.id);
    container.setData('isLit', false);
    container.setData('isBonfire', true);
    container.setDepth(6);
    container.setSize(TERMINAL_W + 16, TERMINAL_H + 16);

    return container;
  }

  /**
   * Apply lit/unlit visual state to a bonfire container.
   * Lit: bright amber glow + bright core.
   * Unlit: dim amber core, no glow.
   */
  private applyLitVisual(container: Phaser.GameObjects.Container, isLit: boolean): void {
    const core = container.getData('core') as Phaser.GameObjects.Rectangle | null;
    const glow = container.getData('glow') as Phaser.GameObjects.Arc | null;
    const body = container.getAt(1) as Phaser.GameObjects.Rectangle | null;

    if (isLit) {
      // Lit: bright amber
      if (core) { core.setFillStyle(AMBER, 0.85); }
      if (glow) { glow.setFillStyle(AMBER, 0.18); }
      if (body) { body.setStrokeStyle(1, AMBER, 0.8); }
    } else {
      // Unlit: dim
      if (core) { core.setFillStyle(AMBER_DIM, 0.5); }
      if (glow) { glow.setFillStyle(AMBER, 0.0); }
      if (body) { body.setStrokeStyle(1, AMBER_DIM, 0.6); }
    }
  }
}

export default BonfireController;
