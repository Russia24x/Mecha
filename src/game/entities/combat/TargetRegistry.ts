/**
 * MECHA: LAST PROTOCOL — Target Registry
 *
 * Typed registry of damageable targets for projectile hit detection.
 * Replaces the O(n²) `scene.children.list.forEach()` scan in Projectile.checkOverlaps()
 * with O(m) where m = number of relevant targets (typically 5–20).
 *
 * Owned by GameScene. Lifecycle:
 *   - buildPlay() → registry.clear() + register player
 *   - spawnEnemiesForSection() → registerEnemy(e)
 *   - updatePlay() → unregisterEnemy(e) when dead
 *   - enterBossArena() → registerBoss(b)
 *   - cleanupPlay() → registry.clear()
 *
 * Projectile reads the registry via `(this.scene as { targetRegistry?: TargetRegistry }).targetRegistry`.
 * If absent (e.g. test harness), Projectile falls back to the legacy scene-children scan.
 */

import type { PlayerEntity } from '../player/PlayerEntity';
import type { EnemyEntity } from '../enemies/EnemyEntity';
import type { BossEntity } from '../boss/BossEntity';

export class TargetRegistry {
  /** The player — target for enemy projectiles. */
  player: PlayerEntity | null = null;

  /** Active enemies — targets for player projectiles. */
  readonly enemies = new Set<EnemyEntity>();

  /** Active boss — target for player projectiles. */
  boss: BossEntity | null = null;

  registerPlayer(p: PlayerEntity): void {
    this.player = p;
  }

  unregisterPlayer(): void {
    this.player = null;
  }

  registerEnemy(e: EnemyEntity): void {
    this.enemies.add(e);
  }

  unregisterEnemy(e: EnemyEntity): void {
    this.enemies.delete(e);
  }

  registerBoss(b: BossEntity): void {
    this.boss = b;
  }

  unregisterBoss(): void {
    this.boss = null;
  }

  /** Clear all references — called on play state exit. */
  clear(): void {
    this.player = null;
    this.enemies.clear();
    this.boss = null;
  }
}

export default TargetRegistry;
