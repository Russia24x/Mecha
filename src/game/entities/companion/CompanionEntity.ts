/**
 * MECHA: LAST PROTOCOL — Companion Entity (Protocol Echo)
 *
 * An AI companion that follows the player. Currently visual-only (hovering orb).
 * Architecture is ready for future abilities: scan, heal, shield, attack.
 *
 * Per user vision:
 *   "Protocol Echo starts as a dormant orb → grows with story → revealed as
 *    the last fragment of the Last Protocol that silently guided the player."
 *
 * The companion is NOT an NPC — it's an independent AI system:
 *   Player → Companion AI → Follow / Hover / Assist / Interact / Scan / Heal / Attack
 *
 * Current behavior:
 *   - Follows player at a fixed offset (hovers above-right)
 *   - Smooth follow with easing
 *   - Pulsing glow
 *   - Idle bob animation
 *
 * Future hooks (architecture-ready, not implemented):
 *   - scan(): detect hidden structures near player
 *   - heal(): restore HP on cooldown
 *   - shield(): project defensive barrier on damage
 *   - attack(): fire at nearest enemy
 */
import Phaser from 'phaser';
import { COLORS } from '../../shared/Constants';

export class CompanionEntity {
  public container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private followOffset: Phaser.Math.Vector2;
  private targetPos: Phaser.Math.Vector2;
  private currentPos: Phaser.Math.Vector2;
  private animTime = 0;

  // Visual parts
  private orb: Phaser.GameObjects.Arc;
  private orbGlow: Phaser.GameObjects.Arc;
  private ring: Phaser.GameObjects.Arc;
  private innerCore: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.container = scene.add.container(x, y);
    this.followOffset = new Phaser.Math.Vector2(30, -40);  // hover above-right of player
    this.targetPos = new Phaser.Math.Vector2(x, y);
    this.currentPos = new Phaser.Math.Vector2(x, y);

    // ── Outer glow (large, soft, pulsing) ──
    this.orbGlow = scene.add.circle(0, 0, 18, 0x66f0ff, 0.1);
    this.orbGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(this.orbGlow);

    // ── Main orb (cyan, semi-transparent) ──
    this.orb = scene.add.circle(0, 0, 8, 0x66f0ff, 0.4);
    this.orb.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(this.orb);

    // ── Ring (rotating) ──
    this.ring = scene.add.circle(0, 0, 12, 0x000000, 0);
    this.ring.setStrokeStyle(1, 0x66f0ff, 0.6);
    this.container.add(this.ring);

    // ── Inner core (bright white) ──
    this.innerCore = scene.add.circle(0, 0, 3, 0xffffff, 0.8);
    this.innerCore.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(this.innerCore);

    this.container.setDepth(12);

    // Idle animations
    scene.tweens.add({
      targets: this.orbGlow,
      alpha: { from: 0.05, to: 0.15 },
      scale: { from: 0.9, to: 1.2 },
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
    scene.tweens.add({
      targets: this.ring,
      rotation: Math.PI * 2,
      duration: 4000, repeat: -1, ease: 'Linear',
    });
  }

  /** Per-frame update — smooth follow player + idle bob. */
  update(deltaMs: number, playerPos: Phaser.Math.Vector2): void {
    this.animTime += deltaMs;

    // Target = player position + offset
    this.targetPos.set(playerPos.x + this.followOffset.x, playerPos.y + this.followOffset.y);

    // Idle bob (sine wave)
    const bob = Math.sin(this.animTime / 600) * 4;
    this.targetPos.y += bob;

    // Smooth follow (ease toward target)
    this.currentPos.x = Phaser.Math.Linear(this.currentPos.x, this.targetPos.x, 0.08);
    this.currentPos.y = Phaser.Math.Linear(this.currentPos.y, this.targetPos.y, 0.08);

    this.container.setPosition(this.currentPos.x, this.currentPos.y);

    // Inner core pulse
    const pulse = 0.6 + Math.sin(this.animTime / 300) * 0.3;
    this.innerCore.setAlpha(pulse);
    this.innerCore.setRadius(2 + pulse * 2);

    // Orb pulse
    const orbPulse = 0.3 + Math.sin(this.animTime / 500) * 0.15;
    this.orb.setAlpha(orbPulse);
  }

  // ── Future ability hooks (architecture-ready) ──

  /** Future: scan for hidden structures near player. */
  scan(): void { /* TODO: emit SCAN_COMPLETE event with nearby hidden objects */ }

  /** Future: heal player on cooldown. */
  heal(): void { /* TODO: emit COMPANION_HEAL event */ }

  /** Future: project defensive shield. */
  shield(): void { /* TODO: create shield visual around player */ }

  /** Future: fire at nearest enemy. */
  attack(): void { /* TODO: spawn projectile toward nearest enemy */ }

  destroy(): void {
    this.container.destroy();
  }
}

export default CompanionEntity;
