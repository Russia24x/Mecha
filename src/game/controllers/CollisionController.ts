/**
 * MECHA: LAST PROTOCOL — Collision Controller
 *
 * Central collision dispatch router. Extracts ONLY the routing mechanism
 * from GameScene.onCollisionStart — the actual handler logic (enterSection,
 * activateCheckpoint, enterBossArena, handleEnemyContact, handleHazard)
 * stays in GameScene as delegate methods.
 *
 * Design:
 *   - Registers a single 'collisionstart' listener on matter.world
 *   - For each collision pair, checks getData() attributes on both bodies
 *   - Dispatches to registered handlers based on entity types
 *   - Handlers are callbacks — no back-reference to GameScene
 *
 * Why data-attribute routing (not body.label):
 *   The existing codebase uses setData('entityType', 'player'/'enemy'/'boss')
 *   and setData('isCheckpoint'/'isBossEntry'/'hazardDamage'/'sectionId')
 *   rather than body.label matching. This controller preserves that pattern
 *   to avoid touching every entity's body creation code.
 *
 * Lifecycle:
 *   enter() — called in buildPlay() after entities exist
 *   exit()  — called in cleanupPlay() before entities destroyed
 *
 * Registration (in GameScene.buildPlay):
 *   this.collision = new CollisionController(this);
 *   this.collision.routes = {
 *     onSection: (sectionId) => this.enterSection(sectionId),
 *     onCheckpoint: () => this.activateCheckpoint(),
 *     onBossEntry: () => this.enterBossArena(),
 *     onEnemyContact: (enemyGo) => this.handleEnemyContact(enemyGo),
 *     onBossContact: () => this.handleBossContact(),
 *     onHazard: (hazardGo) => this.handleHazard(hazardGo),
 *   };
 *   this.collision.enter();
 */
import Phaser from 'phaser';

type GameObject = Phaser.GameObjects.GameObject;

export interface CollisionRoutes {
  onSection?: (sectionId: number) => void;
  onCheckpoint?: () => void;
  onBossEntry?: () => void;
  onEnemyContact?: (enemyGo: GameObject) => void;
  onBossContact?: () => void;
  onHazard?: (hazardGo: GameObject) => void;
}

export class CollisionController {
  routes: CollisionRoutes = {};

  constructor(private scene: Phaser.Scene) {}

  /** Register the collisionstart listener on matter.world. */
  enter(): void {
    this.scene.matter.world.on('collisionstart', this.dispatch);
  }

  /** Remove the collisionstart listener. Safe to call multiple times. */
  exit(): void {
    this.scene.matter.world.off('collisionstart', this.dispatch);
  }

  /**
   * Central dispatch — for each collision pair, check both bodies' getData()
   * attributes and route to the appropriate handler.
   *
   * Handles symmetric collisions (player↔enemy or enemy↔player) by checking
   * both orders. Only one handler fires per pair per category (player can only
   * be on one side).
   */
  private dispatch = (event: MatterJS.IEventCollision<MatterJS.Body>): void => {
    for (const pair of event.pairs) {
      const aGo = (pair.bodyA as unknown as { gameObject?: GameObject }).gameObject;
      const bGo = (pair.bodyB as unknown as { gameObject?: GameObject }).gameObject;
      if (!aGo || !bGo) continue;

      const aIsPlayer = aGo.getData('entityType') === 'player';
      const bIsPlayer = bGo.getData('entityType') === 'player';

      // ── Section triggers ──
      const aSection = aGo.getData('sectionId') as number | undefined;
      const bSection = bGo.getData('sectionId') as number | undefined;
      if (aIsPlayer && bSection !== undefined) {
        this.routes.onSection?.(bSection);
      } else if (bIsPlayer && aSection !== undefined) {
        this.routes.onSection?.(aSection);
      }
      // ── Checkpoint ──
      else if (aIsPlayer && bGo.getData('isCheckpoint')) {
        this.routes.onCheckpoint?.();
      } else if (bIsPlayer && aGo.getData('isCheckpoint')) {
        this.routes.onCheckpoint?.();
      }
      // ── Boss entry ──
      else if (aIsPlayer && bGo.getData('isBossEntry')) {
        this.routes.onBossEntry?.();
      } else if (bIsPlayer && aGo.getData('isBossEntry')) {
        this.routes.onBossEntry?.();
      }

      // ── Enemy contact (separate if — can fire alongside section trigger) ──
      if (aIsPlayer && bGo.getData('entityType') === 'enemy') {
        this.routes.onEnemyContact?.(bGo);
      } else if (bIsPlayer && aGo.getData('entityType') === 'enemy') {
        this.routes.onEnemyContact?.(aGo);
      }

      // ── Boss contact ──
      if (aIsPlayer && bGo.getData('entityType') === 'boss') {
        this.routes.onBossContact?.();
      } else if (bIsPlayer && aGo.getData('entityType') === 'boss') {
        this.routes.onBossContact?.();
      }

      // ── Hazard (spikes, lava, etc.) ──
      if (aIsPlayer && bGo.getData('hazardDamage')) {
        this.routes.onHazard?.(bGo);
      } else if (bIsPlayer && aGo.getData('hazardDamage')) {
        this.routes.onHazard?.(aGo);
      }
    }
  };
}

export default CollisionController;
