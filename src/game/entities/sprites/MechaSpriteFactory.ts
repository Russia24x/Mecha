/**
 * MECHA: LAST PROTOCOL — MechaSpriteFactory v1.0
 *
 * Single source of truth for building detailed, multi-layered mech sprites
 * for the player, enemies, NPCs, and bosses. NO MORE FLAT GEOMETRIC SHAPES.
 *
 * Each sprite is a Phaser Container composed of many graphics parts:
 *   - Chassis (main body with plating, paneling, rivets)
 *   - Head/Cockpit (with visor, antenna)
 *   - Limbs (legs, arms, thrusters)
 *   - Core (glowing reactor with pulsing light)
 *   - Accents (warning stripes, decals, glow halos)
 *
 * Visual language:
 *   - Player (Atlas): cyan/amber, humanoid combat mech
 *   - Drone: quad-rotor scout, single red eye
 *   - Spider: quadruped salvage crawler, asymmetric arms
 *   - Sniper: bipedal railgunner, tall antenna, laser sight
 *   - Heavy: walking tank, bulky armor, magenta vents
 *   - Flying AI: swept-wing interceptor, dive-bomb claws
 *   - Elite: commando unit, dual shoulder cannons
 *
 * Per Phaser 4 skill (sprites-and-images, game-object-components):
 *   - Container for transform inheritance
 *   - Graphics for procedural shapes
 *   - Arc/Circle for glow lights (BlendMode.ADD)
 *   - Tweens for idle animation (pulse, hover)
 */
import Phaser from 'phaser';

export interface MechVisualHandle {
  container: Phaser.GameObjects.Container;
  /** Update facing direction (1 = right, -1 = left). */
  setFacing: (facing: 1 | -1) => void;
  /** Pulse core light brightness (0..1). */
  setCorePulse: (brightness: number) => void;
  /** Set thruster glow intensity (0..1). */
  setThrusterIntensity: (intensity: number) => void;
  /** Destroy all parts. */
  destroy: () => void;
}

export class MechaSpriteFactory {
  /**
   * Build the PLAYER mech — "Atlas", a humanoid combat frame.
   * Cyan visor, amber core reactor, dual leg thrusters, shoulder pauldrons.
   * Carries a rifle on right arm.
   */
  static buildPlayerAtlas(scene: Phaser.Scene): MechVisualHandle {
    const container = scene.add.container(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];

    // ── Shadow (ground projection) ──
    const shadow = scene.add.ellipse(0, 28, 50, 12, 0x000000, 0.5);
    shadow.setDepth(-1);
    parts.push(shadow);

    // ── Leg thruster glow (back layer, intensifies on jump/dash) ──
    const thrusterL = scene.add.circle(-9, 16, 6, 0xffc040, 0);
    thrusterL.setBlendMode(Phaser.BlendModes.ADD); thrusterL.setDepth(0);
    parts.push(thrusterL);
    const thrusterR = scene.add.circle(9, 16, 6, 0xffc040, 0);
    thrusterR.setBlendMode(Phaser.BlendModes.ADD); thrusterR.setDepth(0);
    parts.push(thrusterR);

    // ── Legs (armored, two-tone) ──
    const legL = scene.add.graphics();
    legL.setDepth(2);
    legL.fillStyle(0x2a3850, 1); legL.fillRect(-13, 4, 10, 18);
    legL.fillStyle(0x1a2030, 1); legL.fillRect(-13, 18, 10, 4);
    legL.fillStyle(0x39d0d8, 0.6); legL.fillRect(-12, 6, 8, 2);
    legL.lineStyle(1, 0x39d0d8, 0.5); legL.strokeRect(-13, 4, 10, 18);
    parts.push(legL);
    const legR = scene.add.graphics();
    legR.setDepth(2);
    legR.fillStyle(0x2a3850, 1); legR.fillRect(3, 4, 10, 18);
    legR.fillStyle(0x1a2030, 1); legR.fillRect(3, 18, 10, 4);
    legR.fillStyle(0x39d0d8, 0.6); legR.fillRect(4, 6, 8, 2);
    legR.lineStyle(1, 0x39d0d8, 0.5); legR.strokeRect(3, 4, 10, 18);
    parts.push(legR);

    // ── Torso (armored chest with core reactor) ──
    const torso = scene.add.graphics();
    torso.setDepth(5);
    torso.fillStyle(0x1a2840, 1); torso.fillRoundedRect(-16, -16, 32, 26, 4);
    torso.fillStyle(0x2a4060, 1); torso.fillRoundedRect(-14, -14, 28, 6, 2);
    torso.fillStyle(0x101820, 1); torso.fillRoundedRect(-12, 4, 24, 6, 2);
    torso.fillStyle(0x2a3850, 1); torso.fillRoundedRect(-20, -14, 6, 14, 2);
    torso.fillStyle(0x2a3850, 1); torso.fillRoundedRect(14, -14, 6, 14, 2);
    torso.lineStyle(2, 0x39d0d8, 0.8); torso.strokeRoundedRect(-16, -16, 32, 26, 4);
    torso.fillStyle(0x5a6a80, 0.7);
    torso.fillCircle(-12, -10, 1); torso.fillCircle(12, -10, 1);
    torso.fillCircle(-12, 6, 1); torso.fillCircle(12, 6, 1);
    parts.push(torso);

    // ── Core reactor (glowing amber, pulsing) ──
    const coreGlow = scene.add.circle(0, -4, 14, 0xffc040, 0.15);
    coreGlow.setBlendMode(Phaser.BlendModes.ADD); coreGlow.setDepth(6);
    parts.push(coreGlow);
    const core = scene.add.circle(0, -4, 4, 0xfff0a0, 0.95);
    core.setBlendMode(Phaser.BlendModes.ADD); core.setDepth(7);
    parts.push(core);
    const coreRing = scene.add.circle(0, -4, 6, 0xffc040, 0);
    coreRing.setStrokeStyle(1, 0xffc040, 0.8); coreRing.setDepth(7);
    parts.push(coreRing);

    // ── Head/cockpit (with cyan visor) ──
    const head = scene.add.graphics();
    head.setDepth(8);
    head.fillStyle(0x2a3850, 1); head.fillRoundedRect(-7, -28, 14, 14, 3);
    head.fillStyle(0x1a2030, 1); head.fillRoundedRect(-5, -26, 10, 4, 1);
    head.lineStyle(1, 0x39d0d8, 0.7); head.strokeRoundedRect(-7, -28, 14, 14, 3);
    head.lineStyle(1, 0x39d0d8, 0.6); head.beginPath();
    head.moveTo(5, -28); head.lineTo(7, -34); head.strokePath();
    head.fillStyle(0xffc040, 0.9); head.fillCircle(7, -34, 1.2);
    parts.push(head);

    // ── Visor (cyan glow, the "eyes") ──
    const visor = scene.add.rectangle(0, -24, 8, 2, 0x66f0ff, 0.95);
    visor.setBlendMode(Phaser.BlendModes.ADD); visor.setDepth(9);
    parts.push(visor);

    // ── Right arm — rifle (extended from origin) ──
    const gunArm = scene.add.container(0, -6);
    gunArm.setDepth(10);
    const gunGfx = scene.add.graphics();
    gunGfx.fillStyle(0x1a2030, 1); gunGfx.fillRect(0, -3, 26, 6);
    gunGfx.fillStyle(0x2a3850, 1); gunGfx.fillRect(20, -4, 8, 8);
    gunGfx.fillStyle(0x39d0d8, 0.5); gunGfx.fillRect(2, -2, 18, 1);
    gunGfx.lineStyle(1, 0x39d0d8, 0.6); gunGfx.strokeRect(0, -3, 26, 6);
    gunArm.add(gunGfx);
    const muzzle = scene.add.circle(28, 0, 3, 0xfff04a, 0);
    muzzle.setBlendMode(Phaser.BlendModes.ADD);
    gunArm.add(muzzle);
    parts.push(gunArm);

    // ── Left arm — armored (with pauldron) ──
    const leftArm = scene.add.graphics();
    leftArm.setDepth(4);
    leftArm.fillStyle(0x1a2840, 1); leftArm.fillRoundedRect(-22, -10, 8, 18, 2);
    leftArm.fillStyle(0x39d0d8, 0.5); leftArm.fillRect(-21, -8, 6, 1);
    leftArm.lineStyle(1, 0x39d0d8, 0.4); leftArm.strokeRoundedRect(-22, -10, 8, 18, 2);
    parts.push(leftArm);

    container.add(parts);
    container.setDepth(14);

    scene.tweens.add({ targets: coreGlow, alpha: { from: 0.1, to: 0.25 }, scale: { from: 0.9, to: 1.1 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    scene.tweens.add({ targets: visor, alpha: { from: 0.6, to: 1 }, duration: 800, yoyo: true, repeat: -1 });

    return {
      container,
      setFacing: (facing: 1 | -1) => { container.setScale(facing, 1); },
      setCorePulse: (brightness: number) => {
        core.setAlpha(0.6 + brightness * 0.4);
        coreGlow.setAlpha(0.1 + brightness * 0.2);
      },
      setThrusterIntensity: (intensity: number) => {
        thrusterL.setAlpha(intensity * 0.8);
        thrusterR.setAlpha(intensity * 0.8);
        const s = 0.5 + intensity * 1.5;
        thrusterL.setScale(s, s);
        thrusterR.setScale(s, s);
      },
      destroy: () => {
        parts.forEach(p => { if (p && p.active) p.destroy(); });
        if (container && container.active) container.destroy();
      },
    };
  }

  /**
   * Build a DRONE — quad-rotor scout. Single red eye, four rotors, hanging sensor pod.
   */
  static buildDrone(scene: Phaser.Scene, color: number): MechVisualHandle {
    const container = scene.add.container(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];

    const shadow = scene.add.ellipse(0, 18, 40, 8, 0x000000, 0.4);
    shadow.setDepth(-1);
    parts.push(shadow);

    const rotorPositions = [{ x: -14, y: -10 }, { x: 14, y: -10 }, { x: -14, y: 8 }, { x: 14, y: 8 }];
    for (const pos of rotorPositions) {
      const blade = scene.add.circle(pos.x, pos.y, 8, 0x2a3040, 0.25);
      blade.setStrokeStyle(1, color, 0.5); blade.setDepth(2);
      parts.push(blade);
      scene.tweens.add({ targets: blade, alpha: { from: 0.15, to: 0.35 }, duration: 60, yoyo: true, repeat: -1 });
      const hub = scene.add.circle(pos.x, pos.y, 2, color, 0.9);
      hub.setDepth(3); parts.push(hub);
    }

    const body = scene.add.graphics();
    body.setDepth(5);
    body.fillStyle(0x1a1a2a, 1); body.fillRoundedRect(-10, -8, 20, 16, 3);
    body.fillStyle(0x2a2a3a, 1); body.fillRoundedRect(-8, -6, 16, 4, 2);
    body.lineStyle(1, color, 0.6); body.strokeRoundedRect(-10, -8, 20, 16, 3);
    body.fillStyle(0x5a6a80, 0.6); body.fillCircle(-7, -5, 0.8); body.fillCircle(7, -5, 0.8);
    parts.push(body);

    const eyeGlow = scene.add.circle(0, 0, 8, 0xff0000, 0.2);
    eyeGlow.setBlendMode(Phaser.BlendModes.ADD); eyeGlow.setDepth(6);
    parts.push(eyeGlow);
    const eye = scene.add.circle(0, 0, 3, 0xff4040, 1);
    eye.setBlendMode(Phaser.BlendModes.ADD); eye.setDepth(7);
    parts.push(eye);
    scene.tweens.add({ targets: eyeGlow, alpha: { from: 0.1, to: 0.3 }, scale: { from: 0.8, to: 1.2 }, duration: 600, yoyo: true, repeat: -1 });

    const antenna = scene.add.graphics();
    antenna.setDepth(6);
    antenna.lineStyle(1, color, 0.6); antenna.beginPath();
    antenna.moveTo(0, -8); antenna.lineTo(0, -14); antenna.strokePath();
    antenna.fillStyle(0xff4040, 0.9); antenna.fillCircle(0, -14, 1);
    parts.push(antenna);

    container.add(parts);
    container.setDepth(14);

    return {
      container,
      setFacing: (facing: 1 | -1) => container.setScale(facing, 1),
      setCorePulse: (b: number) => eye.setAlpha(0.7 + b * 0.3),
      setThrusterIntensity: (_i: number) => { /* drones use rotors, not thrusters */ },
      destroy: () => { parts.forEach(p => { if (p && p.active) p.destroy(); }); if (container && container.active) container.destroy(); },
    };
  }

  /**
   * Build a SPIDER — quadruped salvage crawler. Asymmetric arm with cutting torch.
   */
  static buildSpider(scene: Phaser.Scene, color: number): MechVisualHandle {
    const container = scene.add.container(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];

    const shadow = scene.add.ellipse(0, 14, 50, 10, 0x000000, 0.5);
    shadow.setDepth(-1); parts.push(shadow);

    const legConfigs = [
      { x: -16, y: -4, ang: -0.4 },
      { x: -16, y: 6, ang: 0.4 },
      { x: 16, y: -4, ang: 0.4 },
      { x: 16, y: 6, ang: -0.4 },
    ];
    for (const cfg of legConfigs) {
      const leg = scene.add.graphics();
      leg.setDepth(2); leg.setRotation(cfg.ang);
      leg.fillStyle(0x2a1a0a, 1); leg.fillRect(0, -2, 16, 4);
      leg.fillStyle(0x3a2a1a, 1); leg.fillRect(12, -3, 4, 6);
      leg.lineStyle(1, color, 0.5); leg.strokeRect(0, -2, 16, 4);
      leg.setPosition(cfg.x, cfg.y);
      parts.push(leg);
      scene.tweens.add({ targets: leg, rotation: cfg.ang + 0.08, duration: 800, yoyo: true, repeat: -1, delay: Math.random() * 400 });
    }

    const body = scene.add.graphics();
    body.setDepth(5);
    body.fillStyle(0x2a1a0a, 1); body.fillEllipse(0, 0, 32, 22);
    body.fillStyle(0x3a2a1a, 1); body.fillEllipse(0, -2, 28, 10);
    body.lineStyle(1, color, 0.6); body.strokeEllipse(0, 0, 32, 22);
    body.fillStyle(0x5a4a3a, 0.7); body.fillCircle(-10, 0, 1); body.fillCircle(10, 0, 1);
    parts.push(body);

    const torchArm = scene.add.graphics();
    torchArm.setDepth(6);
    torchArm.fillStyle(0x1a1008, 1); torchArm.fillRect(10, -2, 14, 4);
    torchArm.fillStyle(0x3a2a1a, 1); torchArm.fillRect(22, -3, 4, 6);
    torchArm.lineStyle(1, color, 0.5); torchArm.strokeRect(10, -2, 14, 4);
    parts.push(torchArm);
    const flame = scene.add.circle(26, 0, 3, 0xff8a3d, 0.7);
    flame.setBlendMode(Phaser.BlendModes.ADD); flame.setDepth(7);
    parts.push(flame);
    scene.tweens.add({ targets: flame, alpha: { from: 0.3, to: 0.8 }, scale: { from: 0.7, to: 1.3 }, duration: 200, yoyo: true, repeat: -1 });

    const eye1 = scene.add.circle(8, -3, 1.5, 0xff0000, 0.9);
    eye1.setBlendMode(Phaser.BlendModes.ADD); eye1.setDepth(7); parts.push(eye1);
    const eye2 = scene.add.circle(12, -3, 1.5, 0xff0000, 0.9);
    eye2.setBlendMode(Phaser.BlendModes.ADD); eye2.setDepth(7); parts.push(eye2);

    container.add(parts);
    container.setDepth(14);

    return {
      container,
      setFacing: (facing: 1 | -1) => container.setScale(facing, 1),
      setCorePulse: (b: number) => { eye1.setAlpha(0.6 + b * 0.4); eye2.setAlpha(0.6 + b * 0.4); },
      setThrusterIntensity: (_i: number) => {},
      destroy: () => { parts.forEach(p => { if (p && p.active) p.destroy(); }); if (container && container.active) container.destroy(); },
    };
  }

  /**
   * Build a SNIPER — bipedal railgunner. Tall antenna, crouched pose, long barrel.
   */
  static buildSniper(scene: Phaser.Scene, color: number): MechVisualHandle {
    const container = scene.add.container(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];

    const shadow = scene.add.ellipse(0, 20, 36, 8, 0x000000, 0.5);
    shadow.setDepth(-1); parts.push(shadow);

    const legs = scene.add.graphics();
    legs.setDepth(2);
    legs.fillStyle(0x0a2a1a, 1); legs.fillRoundedRect(-10, 4, 8, 14, 2);
    legs.fillStyle(0x0a2a1a, 1); legs.fillRoundedRect(2, 4, 8, 14, 2);
    legs.lineStyle(1, color, 0.4); legs.strokeRoundedRect(-10, 4, 8, 14, 2);
    legs.strokeRoundedRect(2, 4, 8, 14, 2);
    parts.push(legs);

    const body = scene.add.graphics();
    body.setDepth(5);
    body.fillStyle(0x0a2a1a, 1); body.fillRoundedRect(-10, -14, 20, 22, 3);
    body.fillStyle(0x1a3a2a, 1); body.fillRoundedRect(-8, -12, 16, 4, 2);
    body.lineStyle(1, color, 0.6); body.strokeRoundedRect(-10, -14, 20, 22, 3);
    parts.push(body);

    const barrel = scene.add.graphics();
    barrel.setDepth(6);
    barrel.fillStyle(0x0a1a14, 1); barrel.fillRect(0, -8, 32, 4);
    barrel.fillStyle(0x1a2a24, 1); barrel.fillRect(28, -9, 6, 6);
    barrel.fillStyle(color, 0.5); barrel.fillRect(2, -7, 28, 1);
    barrel.lineStyle(1, color, 0.5); barrel.strokeRect(0, -8, 32, 4);
    parts.push(barrel);

    const antenna = scene.add.graphics();
    antenna.setDepth(7);
    antenna.lineStyle(1, color, 0.6); antenna.beginPath();
    antenna.moveTo(0, -14); antenna.lineTo(0, -28); antenna.strokePath();
    parts.push(antenna);
    const laserDot = scene.add.circle(0, -28, 2, 0xff0000, 1);
    laserDot.setBlendMode(Phaser.BlendModes.ADD); laserDot.setDepth(8); parts.push(laserDot);
    scene.tweens.add({ targets: laserDot, alpha: { from: 0.5, to: 1 }, duration: 300, yoyo: true, repeat: -1 });

    const halo = scene.add.circle(0, -4, 10, color, 0.08);
    halo.setBlendMode(Phaser.BlendModes.ADD); halo.setDepth(4); parts.push(halo);

    container.add(parts);
    container.setDepth(14);

    return {
      container,
      setFacing: (facing: 1 | -1) => container.setScale(facing, 1),
      setCorePulse: (b: number) => laserDot.setAlpha(0.6 + b * 0.4),
      setThrusterIntensity: (_i: number) => {},
      destroy: () => { parts.forEach(p => { if (p && p.active) p.destroy(); }); if (container && container.active) container.destroy(); },
    };
  }

  /**
   * Build a HEAVY — walking tank. Bulky armor, magenta vents, slow tread legs.
   */
  static buildHeavy(scene: Phaser.Scene, color: number): MechVisualHandle {
    const container = scene.add.container(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];

    const shadow = scene.add.ellipse(0, 26, 70, 14, 0x000000, 0.55);
    shadow.setDepth(-1); parts.push(shadow);

    const treadL = scene.add.graphics();
    treadL.setDepth(2);
    treadL.fillStyle(0x1a0a2a, 1); treadL.fillRoundedRect(-26, 8, 18, 16, 3);
    treadL.fillStyle(0x2a1a3a, 1);
    for (let i = 0; i < 4; i++) treadL.fillCircle(-23 + i * 4, 16, 2);
    treadL.lineStyle(1, color, 0.4); treadL.strokeRoundedRect(-26, 8, 18, 16, 3);
    parts.push(treadL);
    const treadR = scene.add.graphics();
    treadR.setDepth(2);
    treadR.fillStyle(0x1a0a2a, 1); treadR.fillRoundedRect(8, 8, 18, 16, 3);
    treadR.fillStyle(0x2a1a3a, 1);
    for (let i = 0; i < 4; i++) treadR.fillCircle(11 + i * 4, 16, 2);
    treadR.lineStyle(1, color, 0.4); treadR.strokeRoundedRect(8, 8, 18, 16, 3);
    parts.push(treadR);

    const body = scene.add.graphics();
    body.setDepth(5);
    body.fillStyle(0x1a0a2a, 1); body.fillRoundedRect(-22, -18, 44, 30, 4);
    body.fillStyle(0x2a1a3a, 1); body.fillRoundedRect(-20, -16, 40, 8, 3);
    body.fillStyle(0x0a0414, 1); body.fillRoundedRect(-16, 0, 32, 10, 2);
    body.lineStyle(2, color, 0.7); body.strokeRoundedRect(-22, -18, 44, 30, 4);
    body.fillStyle(color, 0.8); body.fillRect(-14, 2, 6, 6); body.fillRect(-3, 2, 6, 6); body.fillRect(8, 2, 6, 6);
    body.fillStyle(0x6a5a7a, 0.7);
    body.fillCircle(-18, -12, 1.2); body.fillCircle(18, -12, 1.2);
    body.fillCircle(-18, 8, 1.2); body.fillCircle(18, 8, 1.2);
    parts.push(body);

    for (const sx of [-1, 1]) {
      const cannon = scene.add.graphics();
      cannon.setDepth(7);
      cannon.fillStyle(0x2a1a3a, 1); cannon.fillRoundedRect(sx * 18 - 4, -22, 8, 12, 2);
      cannon.fillStyle(0x1a0a2a, 1); cannon.fillRect(sx * 18 - 2, -28, 4, 8);
      cannon.lineStyle(1, color, 0.5); cannon.strokeRoundedRect(sx * 18 - 4, -22, 8, 12, 2);
      parts.push(cannon);
    }

    const head = scene.add.graphics();
    head.setDepth(8);
    head.fillStyle(0x2a1a3a, 1); head.fillRoundedRect(-6, -24, 12, 8, 2);
    head.lineStyle(1, color, 0.5); head.strokeRoundedRect(-6, -24, 12, 8, 2);
    parts.push(head);
    const visor = scene.add.rectangle(0, -20, 8, 1.5, color, 0.95);
    visor.setBlendMode(Phaser.BlendModes.ADD); visor.setDepth(9); parts.push(visor);

    const ventGlow = scene.add.rectangle(0, 5, 30, 8, color, 0.15);
    ventGlow.setBlendMode(Phaser.BlendModes.ADD); ventGlow.setDepth(6); parts.push(ventGlow);
    scene.tweens.add({ targets: ventGlow, alpha: { from: 0.08, to: 0.22 }, duration: 700, yoyo: true, repeat: -1 });

    container.add(parts);
    container.setDepth(14);

    return {
      container,
      setFacing: (facing: 1 | -1) => container.setScale(facing, 1),
      setCorePulse: (b: number) => visor.setAlpha(0.7 + b * 0.3),
      setThrusterIntensity: (_i: number) => {},
      destroy: () => { parts.forEach(p => { if (p && p.active) p.destroy(); }); if (container && container.active) container.destroy(); },
    };
  }

  /**
   * Build a FLYING AI — swept-wing interceptor. Dive-bomb claws, blue thrusters.
   */
  static buildFlyingAi(scene: Phaser.Scene, color: number): MechVisualHandle {
    const container = scene.add.container(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];

    const wingThrusterL = scene.add.circle(-14, 0, 5, color, 0);
    wingThrusterL.setBlendMode(Phaser.BlendModes.ADD); wingThrusterL.setDepth(0); parts.push(wingThrusterL);
    const wingThrusterR = scene.add.circle(14, 0, 5, color, 0);
    wingThrusterR.setBlendMode(Phaser.BlendModes.ADD); wingThrusterR.setDepth(0); parts.push(wingThrusterR);

    const wings = scene.add.graphics();
    wings.setDepth(3);
    wings.fillStyle(0x101820, 1);
    wings.beginPath();
    wings.moveTo(-4, -2); wings.lineTo(-22, -8); wings.lineTo(-22, 4); wings.lineTo(-4, 6); wings.closePath(); wings.fillPath();
    wings.beginPath();
    wings.moveTo(4, -2); wings.lineTo(22, -8); wings.lineTo(22, 4); wings.lineTo(4, 6); wings.closePath(); wings.fillPath();
    wings.lineStyle(1, color, 0.5); wings.strokePath();
    parts.push(wings);

    const body = scene.add.graphics();
    body.setDepth(5);
    body.fillStyle(0x101820, 1);
    body.beginPath();
    body.moveTo(-12, 0); body.lineTo(-6, -6); body.lineTo(10, -4); body.lineTo(14, 0); body.lineTo(10, 4); body.lineTo(-6, 6); body.closePath();
    body.fillPath();
    body.lineStyle(1, color, 0.6); body.strokePath();
    parts.push(body);

    const canopy = scene.add.graphics();
    canopy.setDepth(6);
    canopy.fillStyle(color, 0.5); canopy.fillEllipse(2, 0, 12, 4);
    parts.push(canopy);

    const clawL = scene.add.graphics();
    clawL.setDepth(7);
    clawL.lineStyle(2, color, 0.7); clawL.beginPath();
    clawL.moveTo(-6, 4); clawL.lineTo(-10, 10); clawL.strokePath();
    clawL.moveTo(-10, 10); clawL.lineTo(-12, 8); clawL.moveTo(-10, 10); clawL.lineTo(-8, 12);
    clawL.strokePath();
    parts.push(clawL);
    const clawR = scene.add.graphics();
    clawR.setDepth(7);
    clawR.lineStyle(2, color, 0.7); clawR.beginPath();
    clawR.moveTo(6, 4); clawR.lineTo(10, 10); clawR.strokePath();
    clawR.moveTo(10, 10); clawR.lineTo(12, 8); clawR.moveTo(10, 10); clawR.lineTo(8, 12);
    clawR.strokePath();
    parts.push(clawR);

    const eye = scene.add.circle(8, 0, 1.5, 0xff4040, 1);
    eye.setBlendMode(Phaser.BlendModes.ADD); eye.setDepth(8); parts.push(eye);
    scene.tweens.add({ targets: eye, alpha: { from: 0.6, to: 1 }, duration: 400, yoyo: true, repeat: -1 });

    container.add(parts);
    container.setDepth(14);

    scene.tweens.add({ targets: [wingThrusterL, wingThrusterR], alpha: { from: 0.2, to: 0.5 }, scale: { from: 0.7, to: 1.1 }, duration: 150, yoyo: true, repeat: -1 });

    return {
      container,
      setFacing: (facing: 1 | -1) => container.setScale(facing, 1),
      setCorePulse: (b: number) => eye.setAlpha(0.6 + b * 0.4),
      setThrusterIntensity: (i: number) => {
        wingThrusterL.setAlpha(i * 0.7);
        wingThrusterR.setAlpha(i * 0.7);
      },
      destroy: () => { parts.forEach(p => { if (p && p.active) p.destroy(); }); if (container && container.active) container.destroy(); },
    };
  }

  /**
   * Build an ELITE — commando unit. Dual shoulder cannons, magenta chassis, intimidating.
   */
  static buildElite(scene: Phaser.Scene, color: number): MechVisualHandle {
    const container = scene.add.container(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];

    const shadow = scene.add.ellipse(0, 24, 60, 12, 0x000000, 0.55);
    shadow.setDepth(-1); parts.push(shadow);

    const footL = scene.add.circle(-12, 18, 5, color, 0);
    footL.setBlendMode(Phaser.BlendModes.ADD); footL.setDepth(0); parts.push(footL);
    const footR = scene.add.circle(12, 18, 5, color, 0);
    footR.setBlendMode(Phaser.BlendModes.ADD); footR.setDepth(0); parts.push(footR);
    scene.tweens.add({ targets: [footL, footR], alpha: { from: 0.3, to: 0.7 }, scale: { from: 0.8, to: 1.2 }, duration: 200, yoyo: true, repeat: -1 });

    const legs = scene.add.graphics();
    legs.setDepth(2);
    legs.fillStyle(0x2a0a1a, 1); legs.fillRoundedRect(-16, 0, 10, 18, 2);
    legs.fillStyle(0x2a0a1a, 1); legs.fillRoundedRect(6, 0, 10, 18, 2);
    legs.fillStyle(color, 0.6); legs.fillRect(-15, 2, 8, 1); legs.fillRect(7, 2, 8, 1);
    legs.lineStyle(1, color, 0.5);
    legs.strokeRoundedRect(-16, 0, 10, 18, 2); legs.strokeRoundedRect(6, 0, 10, 18, 2);
    parts.push(legs);

    const body = scene.add.graphics();
    body.setDepth(5);
    body.fillStyle(0x2a0a1a, 1); body.fillRoundedRect(-18, -16, 36, 22, 4);
    body.fillStyle(0x3a1a2a, 1); body.fillRoundedRect(-16, -14, 32, 6, 2);
    body.fillStyle(0x1a0410, 1); body.fillRoundedRect(-12, -2, 24, 6, 2);
    body.lineStyle(2, color, 0.9); body.strokeRoundedRect(-18, -16, 36, 22, 4);
    body.fillStyle(0x6a4a5a, 0.7); body.fillCircle(-14, -10, 1.2); body.fillCircle(14, -10, 1.2);
    parts.push(body);

    const coreGlow = scene.add.circle(0, -4, 12, color, 0.18);
    coreGlow.setBlendMode(Phaser.BlendModes.ADD); coreGlow.setDepth(6); parts.push(coreGlow);
    const core = scene.add.circle(0, -4, 4, 0xff80ff, 1);
    core.setBlendMode(Phaser.BlendModes.ADD); core.setDepth(7); parts.push(core);
    scene.tweens.add({ targets: coreGlow, alpha: { from: 0.12, to: 0.28 }, scale: { from: 0.9, to: 1.2 }, duration: 800, yoyo: true, repeat: -1 });

    const head = scene.add.graphics();
    head.setDepth(8);
    head.fillStyle(0x2a0a1a, 1); head.fillRoundedRect(-6, -26, 12, 12, 2);
    head.fillStyle(color, 0.5); head.fillTriangle(-4, -26, 4, -26, 0, -32);
    head.lineStyle(1, color, 0.7); head.strokeRoundedRect(-6, -26, 12, 12, 2);
    parts.push(head);
    const visor = scene.add.rectangle(0, -22, 8, 2, color, 0.95);
    visor.setBlendMode(Phaser.BlendModes.ADD); visor.setDepth(9); parts.push(visor);
    scene.tweens.add({ targets: visor, alpha: { from: 0.5, to: 1 }, duration: 600, yoyo: true, repeat: -1 });

    for (const sx of [-1, 1]) {
      const cannon = scene.add.graphics();
      cannon.setDepth(7);
      cannon.fillStyle(0x1a0410, 1); cannon.fillRoundedRect(sx * 20 - 5, -18, 10, 14, 2);
      cannon.fillStyle(0x2a0a1a, 1); cannon.fillRect(sx * 20 - 2, -24, 4, 10);
      cannon.fillStyle(color, 0.6); cannon.fillRect(sx * 20 - 4, -16, 8, 1);
      cannon.lineStyle(1, color, 0.6); cannon.strokeRoundedRect(sx * 20 - 5, -18, 10, 14, 2);
      parts.push(cannon);
    }

    container.add(parts);
    container.setDepth(14);

    return {
      container,
      setFacing: (facing: 1 | -1) => container.setScale(facing, 1),
      setCorePulse: (b: number) => { core.setAlpha(0.7 + b * 0.3); visor.setAlpha(0.7 + b * 0.3); },
      setThrusterIntensity: (i: number) => { footL.setAlpha(i * 0.7); footR.setAlpha(i * 0.7); },
      destroy: () => { parts.forEach(p => { if (p && p.active) p.destroy(); }); if (container && container.active) container.destroy(); },
    };
  }

  /**
   * Build an NPC — Engineer Kara (hovering mech with tool arm, friendly cyan).
   */
  static buildNPC_Kara(scene: Phaser.Scene): MechVisualHandle {
    const container = scene.add.container(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];

    const shadow = scene.add.ellipse(0, 26, 44, 10, 0x000000, 0.4);
    shadow.setDepth(-1); parts.push(shadow);

    const hover = scene.add.circle(0, 14, 8, 0x39d0d8, 0.3);
    hover.setBlendMode(Phaser.BlendModes.ADD); hover.setDepth(0); parts.push(hover);
    scene.tweens.add({ targets: hover, alpha: { from: 0.2, to: 0.45 }, scale: { from: 0.8, to: 1.2 }, duration: 400, yoyo: true, repeat: -1 });

    const body = scene.add.graphics();
    body.setDepth(5);
    body.fillStyle(0x2a2030, 1); body.fillRoundedRect(-14, -14, 28, 24, 4);
    body.fillStyle(0x3a3040, 1); body.fillRoundedRect(-12, -12, 24, 6, 2);
    body.fillStyle(0xffc040, 0.7); body.fillRoundedRect(-10, -2, 20, 4, 1);
    body.lineStyle(1, 0x39d0d8, 0.6); body.strokeRoundedRect(-14, -14, 28, 24, 4);
    parts.push(body);

    const head = scene.add.graphics();
    head.setDepth(8);
    head.fillStyle(0x3a3040, 1); head.fillRoundedRect(-7, -24, 14, 12, 2);
    head.lineStyle(1, 0x39d0d8, 0.5); head.strokeRoundedRect(-7, -24, 14, 12, 2);
    parts.push(head);
    const visor = scene.add.rectangle(0, -20, 10, 2.5, 0x66f0ff, 0.95);
    visor.setBlendMode(Phaser.BlendModes.ADD); visor.setDepth(9); parts.push(visor);
    scene.tweens.add({ targets: visor, alpha: { from: 0.6, to: 1 }, duration: 1000, yoyo: true, repeat: -1 });

    const arm = scene.add.graphics();
    arm.setDepth(7);
    arm.fillStyle(0x2a2030, 1); arm.fillRect(8, -8, 6, 14);
    arm.fillStyle(0xffc040, 0.8); arm.fillRect(8, -7, 6, 1);
    arm.fillStyle(0x3a3040, 1); arm.fillCircle(14, -10, 3);
    arm.lineStyle(1, 0x39d0d8, 0.5); arm.strokeRect(8, -8, 6, 14);
    parts.push(arm);
    const spark = scene.add.circle(14, -13, 2, 0xffc040, 0);
    spark.setBlendMode(Phaser.BlendModes.ADD); spark.setDepth(9); parts.push(spark);
    scene.tweens.add({ targets: spark, alpha: { from: 0, to: 0.9 }, duration: 100, yoyo: true, repeat: -1, delay: Math.random() * 1500 });

    scene.tweens.add({ targets: container, y: -3, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    container.add(parts);
    container.setDepth(14);

    return {
      container,
      setFacing: (facing: 1 | -1) => container.setScale(facing, 1),
      setCorePulse: (b: number) => visor.setAlpha(0.6 + b * 0.4),
      setThrusterIntensity: (i: number) => hover.setAlpha(0.2 + i * 0.3),
      destroy: () => { parts.forEach(p => { if (p && p.active) p.destroy(); }); if (container && container.active) container.destroy(); },
    };
  }

  /**
   * Build an NPC — Ghost Operator (holographic, faded, glitching).
   */
  static buildNPC_GhostOperator(scene: Phaser.Scene): MechVisualHandle {
    const container = scene.add.container(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];

    const baseGlow = scene.add.ellipse(0, 26, 50, 10, 0x66f0ff, 0.15);
    baseGlow.setBlendMode(Phaser.BlendModes.ADD); baseGlow.setDepth(-1); parts.push(baseGlow);

    const body = scene.add.graphics();
    body.setDepth(5); body.setAlpha(0.55);
    body.fillStyle(0x1a3040, 1); body.fillRoundedRect(-14, -16, 28, 28, 4);
    body.lineStyle(1, 0x66f0ff, 0.7); body.strokeRoundedRect(-14, -16, 28, 28, 4);
    parts.push(body);

    const head = scene.add.graphics();
    head.setDepth(8); head.setAlpha(0.6);
    head.fillStyle(0x2a4050, 1); head.fillRoundedRect(-7, -26, 14, 12, 2);
    head.lineStyle(1, 0x66f0ff, 0.7); head.strokeRoundedRect(-7, -26, 14, 12, 2);
    parts.push(head);

    const visor = scene.add.rectangle(0, -22, 10, 2, 0x66f0ff, 0.95);
    visor.setBlendMode(Phaser.BlendModes.ADD); visor.setDepth(9); parts.push(visor);

    for (let i = 0; i < 4; i++) {
      const scan = scene.add.rectangle(0, -20 + i * 10, 32, 0.5, 0x66f0ff, 0.3);
      scan.setBlendMode(Phaser.BlendModes.ADD); scan.setDepth(10); parts.push(scan);
    }

    scene.tweens.add({ targets: container, alpha: { from: 0.85, to: 1 }, duration: 200, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: visor, alpha: { from: 0.4, to: 1 }, duration: 600, yoyo: true, repeat: -1 });

    scene.time.addEvent({
      delay: 2000, loop: true,
      callback: () => {
        if (!container.active) return;
        scene.tweens.add({ targets: container, x: { from: container.x, to: container.x + 2 }, duration: 50, yoyo: true, repeat: 2 });
      },
    });

    container.add(parts);
    container.setDepth(14);

    return {
      container,
      setFacing: (facing: 1 | -1) => container.setScale(facing, 1),
      setCorePulse: (b: number) => visor.setAlpha(0.5 + b * 0.5),
      setThrusterIntensity: (_i: number) => {},
      destroy: () => { parts.forEach(p => { if (p && p.active) p.destroy(); }); if (container && container.active) container.destroy(); },
    };
  }
}

export default MechaSpriteFactory;
