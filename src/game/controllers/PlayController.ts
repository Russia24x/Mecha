/**
 * MECHA: LAST PROTOCOL — Play Controller
 *
 * Manages the 'play' state lifecycle. Phase 9 Step 2: only destroy() is
 * extracted — build() and update() remain in GameScene for now.
 *
 * CRITICAL: cleanup order matters.
 *   1. collisionController.exit() FIRST — prevents collision events from
 *      firing during entity destruction (avoids callbacks to half-destroyed bodies)
 *   2. Entity destruction (lore, boss health, projectiles, player, enemies, boss)
 *   3. World unload (areaLoader)
 *   4. PLAY-only system destruction (parallax, atmosphere, npc, hints, companion, forest)
 *   5. Timer cleanup (tweens.killAll, sequenceTimers)
 *   6. HUD + render destruction
 *   7. Camera filter reset (vignette leak fix — clears external filters so they
 *      don't persist into hub/menu/gameover/victory screens)
 *   8. Camera + physics reset to default bounds
 *   9. paused = false
 *
 * The vignette leak fix (step 7) is a deliberate fix for a real bug —
 * red low-HP vignette was persisting across state transitions. Must be preserved.
 */
import Phaser from 'phaser';
import { GAME } from '../shared/Constants';
import { AudioSystem } from '../systems/AudioSystem';
import type { CollisionController } from './CollisionController';
import type { LoreController } from '../ui/lore/LoreController';
import type { BossHealthBarUI } from '../ui/boss/BossHealthBarUI';
import type { NpcInteractionController } from '../world/NpcInteractionController';
import type { MetroidvaniaController } from '../world/MetroidvaniaController';
import type { TargetRegistry } from '../entities/combat/TargetRegistry';
import type { PlayerEntity } from '../entities/player/PlayerEntity';
import type { EnemyEntity } from '../entities/enemies/EnemyEntity';
import type { BossEntity } from '../entities/boss/BossEntity';
import type { Projectile } from '../entities/combat/Projectile';
import type { AreaLoader, LoadedArea } from '../world/AreaLoader';
import type { ParallaxBackground } from '../world/atmosphere/ParallaxBackground';
import type { AtmosphereSystem } from '../world/atmosphere/AtmosphereSystem';
import type { ForestEnvironmentSystem } from '../world/atmosphere/ForestEnvironmentSystem';
import type { CompanionEntity } from '../entities/companion/CompanionEntity';
import type { ControlHintsUI } from '../ui/controls/ControlHintsUI';
import type { HUDUI } from '../ui/hud/HUDUI';
import type { RenderSystem } from '../systems/RenderSystem';
import type { CameraSystem } from '../systems/CameraSystem';
import type { PhysicsSystem } from '../systems/PhysicsSystem';

/**
 * All references PlayController needs to destroy the play state.
 * These are the GameScene's play-only fields, passed by reference.
 */
export interface PlayControllerRefs {
  collision: CollisionController | null;
  loreController: LoreController | null;
  bossHealthBar: BossHealthBarUI | null;
  npcInteraction: NpcInteractionController | null;
  metroidvania: MetroidvaniaController | null;
  targetRegistry: TargetRegistry;
  player: PlayerEntity;
  enemies: EnemyEntity[];
  boss: BossEntity | null;
  projectiles: Projectile[];
  loadedArea: LoadedArea | null;
  areaLoader: AreaLoader | null;
  parallax: ParallaxBackground | null;
  atmosphere: AtmosphereSystem | null;
  forestEnv: ForestEnvironmentSystem | null;
  companion: CompanionEntity | null;
  controlHints: ControlHintsUI | null;
  hud: HUDUI | null;
  render: RenderSystem | null;
  sequenceTimers: Phaser.Time.TimerEvent[];
  // Systems for camera/physics reset
  scene: Phaser.Scene;  // for tweens.killAll + cameras.main
  camera: CameraSystem;
  physicsSys: PhysicsSystem;
}

export class PlayController {
  constructor(private refs: PlayControllerRefs) {}

  /**
   * Destroy the play state — MUST be called in this exact order.
   * See class doc for rationale.
   *
   * NOTE: This method destroys the objects but does NOT null out GameScene's
   * field references (because `refs` is a snapshot, not a live binding).
   * GameScene.cleanupPlay() is responsible for nulling its own fields after
   * calling this method.
   */
  destroy(): void {
    const r = this.refs;

    // ── 1. Collision listener FIRST — prevents callbacks to half-destroyed bodies ──
    r.collision?.exit();

    // ── 2. Entity destruction ──
    r.loreController?.destroy();
    r.bossHealthBar?.hide();
    AudioSystem.stopAmbient();
    r.projectiles.forEach(p => p.kill());
    r.player?.destroy();
    r.enemies.forEach(e => e.destroy());
    r.boss?.destroy();
    r.targetRegistry.clear();

    // ── 3. World unload ──
    if (r.loadedArea && r.areaLoader) r.areaLoader.unload(r.loadedArea);

    // ── 4. PLAY-only system destruction ──
    r.parallax?.destroy();
    r.atmosphere?.destroy();
    r.npcInteraction?.cleanup();
    r.controlHints?.destroy();
    r.companion?.destroy();
    r.forestEnv?.destroy();

    // ── 5. Timer cleanup ──
    r.scene.tweens.killAll();
    r.sequenceTimers.forEach(t => t.remove());

    // ── 6. HUD + render destruction ──
    r.hud?.destroy();
    r.render?.destroy();

    // ── 7. Camera filter reset (vignette leak fix) ──
    // Clear all external filters so they don't persist into hub/menu/gameover/victory.
    // This is a deliberate fix for a real bug — low-HP red vignette was leaking.
    try {
      const cam = r.scene.cameras.main as unknown as { filters?: { external?: { list?: unknown[]; clear?: () => void } } };
      if (cam.filters?.external?.list) cam.filters.external.list = [];
    } catch { /* camera filters API varies */ }

    // ── 8. Camera + physics reset to default bounds ──
    r.camera.resetZoom();
    r.camera.stopFollow();
    r.camera.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT);
    r.physicsSys.setWorldBounds(GAME.WIDTH, GAME.HEIGHT);
  }
}

export default PlayController;
