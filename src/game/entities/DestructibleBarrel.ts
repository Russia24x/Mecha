/**
 * MECHA: LAST PROTOCOL — Destructible Barrel Entity
 *
 * An explosive environmental hazard. Players (or enemies) can shoot it; on the
 * 3rd projectile hit, the barrel explodes:
 *   - Plays 'explosion' SFX (already in AudioSystem.SFX_REGISTRY)
 *   - Spawns 18 amber/orange particles radiating outward (ADD blend)
 *   - Camera shake (200ms, 0.008 intensity)
 *   - Damages enemies within 80px (25 dmg) and player within 80px (15 dmg)
 *   - Leaves a dark scorch mark on the ground (alpha 0.5, fades over 10s)
 *
 * Lifecycle:
 *   - Created by AreaLoader.createBarrel() during buildSection() iteration
 *   - Owned by AreaLoader (like solids) — destroyed in AreaLoader.unload()
 *   - No Matter physics body — projectile collision is a per-frame distance
 *     check in PlayController.update (like MetroidvaniaController.checkCollectiblePickups)
 *
 * Metadata (for projectile collision detection):
 *   - isBarrel: true
 *   - barrelId: barrelData.id
 *   - barrel: <this DestructibleBarrel instance>
 *
 * Pattern: extends Phaser.GameObjects.Container (per task spec "Each barrel is
 * a Phaser.GameObjects.Container"). Uses scene.add.existing(this) to register
 * with the scene display list. Graphics child drawn in local coordinates.
 */
import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { PlayerEntity } from './player/PlayerEntity';
import type { EnemyEntity } from './enemies/EnemyEntity';
import type { BossEntity } from './boss/BossEntity';
import type { BarrelData } from '../data/types';

// ─── Visual / gameplay constants ────────────────────────────────────────
const BARREL_W = 24;
const BARREL_H = 36;
const MAX_HEALTH = 3;
const EXPLOSION_RADIUS = 80;
const ENEMY_DAMAGE = 25;
const PLAYER_DAMAGE = 15;
const SCORCH_LIFETIME_MS = 10000;
const HIT_FLASH_MS = 80;
const PROJECTILE_HIT_RADIUS = 20;  // matches PlayController barrel-projectile check

/** Context required for explosion side-effects (damage + particles). */
export interface BarrelExplosionContext {
  player: PlayerEntity;
  enemies: EnemyEntity[];
  boss: BossEntity | null;
  particles: ParticleSystem;
}

/**
 * DestructibleBarrel — a Container with a Graphics child drawing the barrel
 * visual. The barrel is positioned at (x, y); the graphics are drawn in local
 * coordinates centered at the container's origin.
 *
 * Health management:
 *   - hit() decrements health by 1. Returns true if this hit destroyed the
 *     barrel (health now <= 0). Caller is responsible for calling explode()
 *     with the explosion context when hit() returns true.
 *   - explode() performs the explosion visual + audio + damage + scorch mark,
 *     then marks the barrel as destroyed (setVisible(false), setActive(false)).
 *     The Container itself is not destroyed — AreaLoader.unload() destroys it
 *     later, like all other LoadedArea entries.
 */
export class DestructibleBarrel extends Phaser.GameObjects.Container {
  public readonly id: string;
  private health: number = MAX_HEALTH;
  private destroyed = false;
  private gfx: Phaser.GameObjects.Graphics;
  private hitFlashUntil = 0;
  private wasFlashing = false;

  constructor(scene: Phaser.Scene, barrelData: BarrelData) {
    super(scene, barrelData.x, barrelData.y);
    this.id = barrelData.id;

    // Graphics child — drawn in local coords (origin = container's origin).
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this.draw();

    // Depth 6 — above platforms (5) and landmarks (3), below HUD/UI (100+).
    // Matches grappleAnchors (6) and shortcuts (6).
    this.setDepth(6);
    // setSize for VisualCuller bounding-box culling (if added later).
    this.setSize(BARREL_W, BARREL_H);

    // Register with scene display list (required for Container subclasses).
    scene.add.existing(this);

    // Metadata — PlayController barrel-projectile check reads `isBarrel`/`barrel`.
    this.setData('isBarrel', true);
    this.setData('barrelId', barrelData.id);
    this.setData('barrel', this);
  }

  /** Public read-only accessors for projectile collision logic. */
  get isExploded(): boolean { return this.destroyed; }
  get healthRemaining(): number { return this.health; }
  /** Hit radius used by PlayController for projectile-barrel distance check. */
  get hitRadius(): number { return PROJECTILE_HIT_RADIUS; }

  /**
   * Draw the barrel visual. Called once in constructor, and again after each
   * hit (to flash white briefly). The barrel is drawn in local coordinates
   * centered on the container origin:
   *
   *   ┌─────────┐  ← top cap (small rect, dark)
   *   │ ╔═════╗ │  ← body top edge
   *   │ ║     ║ │
   *   │ ║█████║ │  ← amber warning stripe (with hazard ticks)
   *   │ ║     ║ │
   *   │ ╚═════╝ │  ← body bottom edge
   *   └─────────┘  ← soft shadow ellipse under barrel
   */
  private draw(): void {
    const g = this.gfx;
    g.clear();

    // ── Hit flash: brief white tint on the body when struck ──
    const now = this.scene.time.now;
    const isFlashing = now < this.hitFlashUntil;
    const bodyColor     = isFlashing ? 0xffe0e0 : 0x8a1a1a;   // red base / flash white-red
    const bodyHighlight = isFlashing ? 0xffffff : 0xc04040;   // left highlight stripe
    const bodyShadow    = isFlashing ? 0xc06060 : 0x4a0808;   // right shadow

    // ── Soft shadow ellipse on ground (subtle depth) ──
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(0, BARREL_H / 2 + 2, BARREL_W * 1.3, 6);

    // ── Body — rounded rectangle (red metal) ──
    // Outer shadow (right edge + bottom — gives 3D feel)
    g.fillStyle(bodyShadow, 1);
    g.fillRoundedRect(-BARREL_W / 2, -BARREL_H / 2 + 4, BARREL_W, BARREL_H - 6, 4);
    // Main body
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-BARREL_W / 2 + 1, -BARREL_H / 2 + 4, BARREL_W - 3, BARREL_H - 8, 4);
    // Left highlight stripe (cylindrical highlight)
    g.fillStyle(bodyHighlight, 0.45);
    g.fillRect(-BARREL_W / 2 + 2, -BARREL_H / 2 + 6, 2, BARREL_H - 12);

    // ── Top cap — small rectangle (darker metal lid) ──
    g.fillStyle(0x1a1010, 1);
    g.fillRect(-BARREL_W / 2 + 2, -BARREL_H / 2 + 2, BARREL_W - 4, 5);
    g.fillStyle(0x4a2828, 1);
    g.fillRect(-BARREL_W / 2 + 3, -BARREL_H / 2 + 3, BARREL_W - 6, 2);
    // Tiny valve/bolt on the cap (centered)
    g.fillStyle(0x6a4848, 1);
    g.fillRect(-2, -BARREL_H / 2 + 3, 4, 2);

    // ── Amber warning stripe — horizontal band across the middle ──
    g.fillStyle(0xffaa00, 0.9);
    g.fillRect(-BARREL_W / 2, -3, BARREL_W, 5);
    // Hazard ticks (dark diagonal-ish stripes on the warning band)
    g.fillStyle(0x1a0a00, 0.7);
    for (let i = 0; i < BARREL_W; i += 5) {
      g.fillRect(-BARREL_W / 2 + i, -3, 2, 5);
    }

    // ── Bottom rim — thin dark line for grounding ──
    g.fillStyle(0x2a1010, 1);
    g.fillRect(-BARREL_W / 2 + 1, BARREL_H / 2 - 4, BARREL_W - 3, 2);
  }

  /**
   * Per-frame update — re-draw while the hit flash is active (so the flash
   * color shows), AND for one frame after the flash expires (to restore the
   * normal red color). Tracks `wasFlashing` to detect the transition.
   *
   * Called by PlayController.update() during the barrel-projectile loop.
   * Cheap when no flash is active (early-return after the boolean check).
   */
  update(): void {
    const isFlashing = this.scene.time.now < this.hitFlashUntil;
    if (isFlashing || this.wasFlashing) {
      this.draw();
    }
    this.wasFlashing = isFlashing;
  }

  /**
   * Decrement health by 1. Triggers a brief white hit-flash on the visual.
   *
   * @returns true if this hit destroyed the barrel (health now <= 0).
   *          Caller MUST call explode(ctx) when this returns true.
   *          Returns false if the barrel was already destroyed.
   */
  hit(): boolean {
    if (this.destroyed) return false;
    this.health--;
    this.hitFlashUntil = this.scene.time.now + HIT_FLASH_MS;
    this.wasFlashing = true;  // ensure next update() redraws (in case frame timing skips)
    this.draw();
    // Small spark feedback on hit (non-fatal hit) — gives the player visual
    // confirmation that the barrel took damage.
    this.spawnHitSparks();
    return this.health <= 0;
  }

  /** Tiny amber sparks when a non-fatal hit lands — feedback that the hit registered. */
  private spawnHitSparks(): void {
    const cx = this.x;
    const cy = this.y;
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 30;
      const p = this.scene.add.circle(cx, cy, 1 + Math.random(), 0xffaa30, 0.9);
      p.setDepth(20);
      p.setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: p,
        x: cx + Math.cos(a) * speed,
        y: cy + Math.sin(a) * speed,
        alpha: 0,
        duration: 200 + Math.random() * 100,
        ease: 'Cubic.out',
        onComplete: () => p.destroy(),
      });
    }
  }

  /**
   * Explode the barrel — visual + audio + damage + scorch mark.
   *
   * Per task spec:
   *   1. Play 'explosion' sound (already in AudioSystem.SFX_REGISTRY)
   *   2. Create 18 amber/orange particles radiating outward (ADD blend)
   *   3. Camera shake (200ms, 0.008 intensity)
   *   4. Damage enemies within 80px → 25 damage each
   *   5. Damage boss within 80px → 25 damage (treated like an enemy)
   *   6. Damage player within 80px → 15 damage
   *   7. Leave a scorch mark (dark circle, alpha 0.5, fades over 10s)
   *
   * After explode(): the barrel is marked destroyed (setVisible(false),
   * setActive(false)). The Container itself is NOT destroyed here —
   * AreaLoader.unload() destroys it during cleanup, like all LoadedArea entries.
   *
   * @param ctx  Player + enemies + boss + particles for damage + spark fx.
   */
  explode(ctx: BarrelExplosionContext): void {
    if (this.destroyed) return;
    this.destroyed = true;

    const cx = this.x;
    const cy = this.y;

    // ── 1. Play 'explosion' sound ──
    AudioSystem.play('explosion');

    // ── 2. Create 18 amber/orange particles radiating outward ──
    const particleCount = 18;
    const colors = [0xffaa00, 0xff8030, 0xffd040, 0xff6020];
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 80 + Math.random() * 80;
      const radius = 2 + Math.random() * 2;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const p = this.scene.add.circle(cx, cy, radius, color, 0.95);
      p.setDepth(25);
      p.setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: p,
        x: cx + Math.cos(angle) * speed,
        y: cy + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.3,
        duration: 400 + Math.random() * 200,
        ease: 'Cubic.out',
        onComplete: () => p.destroy(),
      });
    }

    // ── Bonus: bright flash + expanding ring (matches ParticleSystem.explosion style) ──
    const flash = this.scene.add.circle(cx, cy, 14, 0xffffff, 0.9);
    flash.setDepth(26);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 4,
      duration: 180,
      onComplete: () => flash.destroy(),
    });
    const ring = this.scene.add.circle(cx, cy, 10, 0xff8040, 0.8);
    ring.setStrokeStyle(3, 0xffffff, 0.9);
    ring.setDepth(25);
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 5,
      duration: 350,
      onComplete: () => ring.destroy(),
    });

    // ── 3. Camera shake (200ms, 0.008 intensity) ──
    this.scene.cameras.main.shake(200, 0.008);

    // ── 4. Damage enemies within explosion radius ──
    for (const e of ctx.enemies) {
      if (!e.isAlive || !e.sprite || !e.sprite.active) continue;
      const dx = e.sprite.x - cx;
      const dy = e.sprite.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= EXPLOSION_RADIUS) {
        e.takeDamage(ENEMY_DAMAGE);
      }
    }

    // ── 5. Damage boss within explosion radius (treated like an enemy) ──
    if (ctx.boss && ctx.boss.isAlive && ctx.boss.sprite && ctx.boss.sprite.active) {
      const dx = ctx.boss.sprite.x - cx;
      const dy = ctx.boss.sprite.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= EXPLOSION_RADIUS) {
        ctx.boss.takeDamage(ENEMY_DAMAGE);
      }
    }

    // ── 6. Damage player within explosion radius ──
    if (ctx.player && ctx.player.sprite && ctx.player.sprite.active) {
      const dx = ctx.player.sprite.x - cx;
      const dy = ctx.player.sprite.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= EXPLOSION_RADIUS) {
        ctx.player.takeDamage(PLAYER_DAMAGE);
      }
    }

    // ── 7. Scorch mark — dark circle, alpha 0.5, fades over 10s ──
    // Placed slightly below the barrel center (on the ground). Depth 4 → above
    // platform graphics (5)? No — depth 4 is BELOW platforms (5). We want the
    // scorch to appear ON the ground (above platform top surface). Platform
    // graphics are at depth 5, so scorch at depth 5.5 to render above platforms.
    const scorch = this.scene.add.circle(cx, cy + 12, 22, 0x000000, 0.5);
    scorch.setDepth(5.5);
    this.scene.tweens.add({
      targets: scorch,
      alpha: 0,
      duration: SCORCH_LIFETIME_MS,
      ease: 'Sine.out',
      onComplete: () => scorch.destroy(),
    });

    // ── Hide the barrel visual (Container is destroyed later by AreaLoader.unload) ──
    this.setVisible(false);
    this.setActive(false);
  }
}

export default DestructibleBarrel;
