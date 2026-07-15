/**
 * MECHA: LAST PROTOCOL - Raycast
 * Helper module for fast line-of-sight checks used by weapons + AI.
 */
import Phaser from 'phaser';

export interface RayHit {
  body: MatterJS.BodyType | null;
  point: Phaser.Math.Vector2;
  distance: number;
}

export function raycast(
  scene: Phaser.Scene,
  from: Phaser.Math.Vector2,
  direction: Phaser.Math.Vector2,
  maxDistance: number,
  maxBodies = 4
): RayHit {
  const to = new Phaser.Math.Vector2(
    from.x + direction.x * maxDistance,
    from.y + direction.y * maxDistance
  );
  const hits = scene.matter.intersectRay(
    from.x, from.y, to.x, to.y, maxBodies
  ) as MatterJS.BodyType[];

  if (hits.length === 0) {
    return { body: null, point: to, distance: maxDistance };
  }
  const body = hits[0];
  // Approximate hit point using the closest vertex
  const closestVertex = (body.vertices || []).reduce<{v: MatterJS.Vector, d: number} | null>(
    (best, v) => {
      const dx = v.x - from.x;
      const dy = v.y - from.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (!best || d < best.d) return { v, d };
      return best;
    },
    null
  );
  const point = closestVertex
    ? new Phaser.Math.Vector2(closestVertex.v.x, closestVertex.v.y)
    : to;
  const distance = Phaser.Math.Distance.Between(from.x, from.y, point.x, point.y);
  return { body, point, distance };
}

/** Convenience: line-of-sight boolean — true if `to` is visible from `from`. */
export function hasLineOfSight(
  scene: Phaser.Scene,
  from: Phaser.Math.Vector2,
  to: Phaser.Math.Vector2
): boolean {
  const hits = scene.matter.intersectRay(from.x, from.y, to.x, to.y, 1) as MatterJS.BodyType[];
  if (hits.length === 0) return true;
  // If the first hit body contains `to`, we have LoS
  const target = hits[0];
  const bounds = Phaser.Physics.Matter.Matter.Bounds.create(target.bounds);
  return Phaser.Physics.Matter.Matter.Bounds.contains(bounds, { x: to.x, y: to.y });
}
