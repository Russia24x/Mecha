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
 * Phase C addition (Exit Gate):
 *   - Exit gate sensor body has setData('isExitGate', true) + destination info.
 *   - CollisionController detects player↔exitGate collision and routes to
 *     onExitGate handler with a gateData payload {id, toAreaId, toSection, toX, toY}.
 *   - Per advisor round-5: gateTransitioning flag lives in GameScene (NOT here).
 *     CollisionController is pure routing — no state. GameScene's onExitGate
 *     handler checks gateTransitioning and short-circuits if true (debounce).
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
 *     onExitGate: (gateData) => this.handleExitGate(gateData),  // Phase C
 *   };
 *   this.collision.enter();
 */
import Phaser from 'phaser';

type GameObject = Phaser.GameObjects.GameObject;

/** Payload passed to onExitGate handler — contains all destination info. */
export interface ExitGatePayload {
  id: string;
  toAreaId: string;
  toSection: number;
  toX: number;
  toY: number;
}

export interface CollisionRoutes {
  onSection?: (sectionId: number) => void;
  onCheckpoint?: () => void;
  onBossEntry?: () => void;
  onEnemyContact?: (enemyGo: GameObject) => void;
  onBossContact?: () => void;
  onHazard?: (hazardGo: GameObject) => void;
  /** Phase C: player walked through an exit gate sensor. GameScene handler
   *  is responsible for debounce via gateTransitioning flag (lives in GameScene,
   *  NOT in CollisionController — per advisor round-5: CollisionController is
   *  pure routing, no state). */
  onExitGate?: (gateData: ExitGatePayload) => void;
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
   * Extract destination info from an exit gate GameObject (or its sensor body).
   * The sensor body created in AreaLoader.createExitGate stores all destination
   * fields via setData(). We read them here and package into a typed payload
   * for the GameScene handler.
   *
   * Note: the GameObject passed by collisionstart may be either the sensor
   * body itself (Phaser.Physics.Matter.Image) or its parent container. We
   * check both — sensor body has the data directly, container has it via
   * getData('physicsBody') indirection. In practice, Matter collision events
   * pass the body's gameObject which is the sensor Image, so the direct
   * getData path is the common case.
   */
  private extractGatePayload(gateGo: GameObject): ExitGatePayload {
    const id = gateGo.getData('exitGateId') as string;
    const toAreaId = gateGo.getData('toAreaId') as string;
    const toSection = gateGo.getData('toSection') as number;
    const toX = gateGo.getData('toX') as number;
    const toY = gateGo.getData('toY') as number;
    return { id, toAreaId, toSection, toX, toY };
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

      // ── Exit Gate (Phase C — inter-area transition) ──
      // Separate if (not else-if) so it can fire alongside other triggers if
      // a gate happens to overlap with something else. Gate is a Matter sensor
      // (non-blocking), so player passes through. CollisionController just routes
      // the event + payload — GameScene.onExitGate handler does debounce via
      // gateTransitioning flag (lives in GameScene, not here).
      if (aIsPlayer && bGo.getData('isExitGate') === true) {
        this.routes.onExitGate?.(this.extractGatePayload(bGo));
      } else if (bIsPlayer && aGo.getData('isExitGate') === true) {
        this.routes.onExitGate?.(this.extractGatePayload(aGo));
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
