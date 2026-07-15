/**
 * MECHA: LAST PROTOCOL - PlayerController
 * Reads input (keyboard + gamepad) and drives the Player body.
 * Combat input is forwarded to PlayerCombat. Movement logic stays here.
 *
 * GAMEPLAY INPUT = KEYBOARD + GAMEPAD ONLY (no mouse).
 * Mouse is used only for menu navigation.
 *
 * Controls:
 *   - Move: A/D or Left/Right arrow or Left Stick
 *   - Aim: W/S or Up/Down arrow for 8-directional, or Right Stick for full 360°
 *   - Jump: Space or A button (double jump unlocked via skill)
 *   - Dash: Shift or B button
 *   - Fire: J or X button (hold for auto-fire)
 *   - Melee: K or Y button
 *   - Weapons: 1/2/3/4 or LB/RB or Q/E cycle
 *   - Pause: ESC or Start
 */
import Phaser from 'phaser';
import { PLAYER } from '../../shared/Constants';
import { SkillTree } from '../../shared/SkillTree';
import { AudioManager } from '../../shared/AudioManager';
import { GamepadManager } from '../../shared/GamepadManager';
import type { Player } from './Player';
import type { PlayerCombat } from './PlayerCombat';
import type { Direction } from '../../shared/Types';

export class PlayerController {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyDash!: Phaser.Input.Keyboard.Key;
  private keyMelee!: Phaser.Input.Keyboard.Key;
  private keyPause!: Phaser.Input.Keyboard.Key;
  private keyFire!: Phaser.Input.Keyboard.Key;
  private keyWeapon1!: Phaser.Input.Keyboard.Key;
  private keyWeapon2!: Phaser.Input.Keyboard.Key;
  private keyWeapon3!: Phaser.Input.Keyboard.Key;
  private keyWeapon4!: Phaser.Input.Keyboard.Key;
  private keyWeaponNext!: Phaser.Input.Keyboard.Key;
  private keyWeaponPrev!: Phaser.Input.Keyboard.Key;

  private isDashing = false;
  private dashUntil = 0;
  private dashAvailableAt = 0;
  private dashDir: Direction = 'right';

  private grounded = false;
  private jumpBufferUntil = 0;
  private coyoteUntil = 0;
  private jumpsRemaining = 1;

  // Window-listener fallback state
  private heldLeft = false;
  private heldRight = false;
  private heldUp = false;
  private heldDown = false;
  private heldFire = false;
  private windowKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private windowKeyupHandler: ((e: KeyboardEvent) => void) | null = null;

  private mods = SkillTree.getPlayerModifiers();

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private combat: PlayerCombat
  ) {
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyDash = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keyMelee = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyFire = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyPause = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyWeapon1 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.keyWeapon2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.keyWeapon3 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.keyWeapon4 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
    this.keyWeaponNext = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyWeaponPrev = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    const body = this.player.sprite.body as MatterJS.BodyType;
    body.label = 'player';

    // NOTE: no pointerdown handler — gameplay is keyboard/gamepad only.
    // The mouse is intentionally ignored during gameplay.

    // Phaser keyboard events
    scene.input.keyboard?.on('keydown-SPACE', () => this.tryJump());
    scene.input.keyboard?.on('keydown-J', () => this.combat.tryFire());
    scene.input.keyboard?.on('keydown-K', () => this.combat.tryMelee());
    scene.input.keyboard?.on('keydown-ESC', () => {
      if (scene.scene.isActive()) {
        AudioManager.play('uiClick');
        scene.scene.pause();
        scene.scene.launch('PauseMenuScene');
      }
    });
    scene.input.keyboard?.on('keydown-ONE', () => this.combat.setWeapon('plasma'));
    scene.input.keyboard?.on('keydown-TWO', () => this.combat.setWeapon('shotgun'));
    scene.input.keyboard?.on('keydown-THREE', () => this.combat.setWeapon('laser'));
    scene.input.keyboard?.on('keydown-FOUR', () => this.combat.setWeapon('rocket'));
    scene.input.keyboard?.on('keydown-E', () => this.combat.switchWeapon(1));
    scene.input.keyboard?.on('keydown-Q', () => this.combat.switchWeapon(-1));

    // Window-listener fallback (reliable across Phaser builds)
    if (typeof window !== 'undefined') {
      const handleKeydown = (e: KeyboardEvent) => {
        switch (e.code) {
          case 'Space': this.tryJump(); break;
          case 'KeyJ': this.combat.tryFire(); this.heldFire = true; break;
          case 'KeyK': this.combat.tryMelee(); break;
          case 'Escape':
            if (scene.scene.isActive()) {
              AudioManager.play('uiClick');
              scene.scene.pause();
              scene.scene.launch('PauseMenuScene');
            }
            break;
          case 'Digit1': this.combat.setWeapon('plasma'); break;
          case 'Digit2': this.combat.setWeapon('shotgun'); break;
          case 'Digit3': this.combat.setWeapon('laser'); break;
          case 'Digit4': this.combat.setWeapon('rocket'); break;
          case 'KeyE': this.combat.switchWeapon(1); break;
          case 'KeyQ': this.combat.switchWeapon(-1); break;
          case 'KeyA':
          case 'ArrowLeft':
            this.heldLeft = true;
            break;
          case 'KeyD':
          case 'ArrowRight':
            this.heldRight = true;
            break;
          case 'KeyW':
          case 'ArrowUp':
            this.heldUp = true;
            break;
          case 'KeyS':
          case 'ArrowDown':
            this.heldDown = true;
            break;
        }
      };
      const handleKeyup = (e: KeyboardEvent) => {
        switch (e.code) {
          case 'KeyA':
          case 'ArrowLeft':
            this.heldLeft = false;
            break;
          case 'KeyD':
          case 'ArrowRight':
            this.heldRight = false;
            break;
          case 'KeyW':
          case 'ArrowUp':
            this.heldUp = false;
            break;
          case 'KeyS':
          case 'ArrowDown':
            this.heldDown = false;
            break;
          case 'KeyJ':
            this.heldFire = false;
            break;
        }
      };
      window.addEventListener('keydown', handleKeydown);
      window.addEventListener('keyup', handleKeyup);
      this.windowKeydownHandler = handleKeydown;
      this.windowKeyupHandler = handleKeyup;
    }

    GamepadManager.init();
  }

  private tryJump(): void {
    this.jumpBufferUntil = this.scene.time.now + 120;
    if (this.jumpsRemaining > 0 && (this.grounded || this.scene.time.now < this.coyoteUntil || this.jumpsRemaining > 1)) {
      const isDouble = !this.grounded && this.jumpsRemaining === 1;
      this.player.sprite.setVelocityY(PLAYER.JUMP_VELOCITY);
      this.jumpBufferUntil = 0;
      this.grounded = false;
      this.coyoteUntil = 0;
      if (this.jumpsRemaining > 0) this.jumpsRemaining--;
      AudioManager.play(isDouble ? 'doubleJump' : 'jump');
    }
  }

  private tryDash(dir: Direction): void {
    const now = this.scene.time.now;
    if (this.isDashing || now < this.dashAvailableAt) return;
    if (!this.player.consumeEnergy(PLAYER.DASH_COST)) return;
    this.isDashing = true;
    this.dashDir = dir;
    this.dashUntil = now + PLAYER.DASH_DURATION_MS;
    this.dashAvailableAt = now + PLAYER.DASH_DURATION_MS + this.mods.dashCd;
    AudioManager.play('dash');
  }

  update(deltaMs: number): void {
    const now = this.scene.time.now;
    this.mods = SkillTree.getPlayerModifiers();
    const maxJumps = this.mods.canDoubleJump ? 2 : 1;

    // ----- Poll gamepad -----
    GamepadManager.update();
    const gp = GamepadManager.getState();

    // Gamepad buttons → combat
    if (gp.firePressed) this.combat.tryFire();
    if (gp.meleePressed) this.combat.tryMelee();
    if (gp.dashPressed && (this.heldLeft || this.heldRight || Math.abs(gp.leftStickX) > 0.3)) {
      const dir: Direction = (this.heldRight || gp.leftStickX > 0) ? 'right' : 'left';
      this.tryDash(dir);
    }
    if (gp.jumpPressed) this.tryJump();
    if (gp.weaponNextPressed) this.combat.switchWeapon(1);
    if (gp.weaponPrevPressed) this.combat.switchWeapon(-1);
    if (gp.pausePressed && this.scene.scene.isActive()) {
      AudioManager.play('uiClick');
      this.scene.scene.pause();
      this.scene.scene.launch('PauseMenuScene');
    }
    // Gamepad continuous fire (RT held)
    if (gp.fireHeld) this.combat.tryFire();

    // ----- Keyboard aim: W/S or Up/Down for 8-directional -----
    let aimY = 0;
    if (this.heldUp || this.keyW.isDown || this.cursors.up.isDown) aimY -= 1;
    if (this.heldDown || this.keyS.isDown || this.cursors.down.isDown) aimY += 1;
    this.combat.setKeyAimY(aimY);

    // ----- Keyboard continuous fire (J held) -----
    if (this.heldFire || this.keyFire.isDown) {
      this.combat.tryFire();
    }

    // ----- Ground check -----
    const feetX = this.player.sprite.x;
    const feetY = this.player.sprite.y + (PLAYER.BODY_RADIUS * 1.3);
    const hits = this.scene.matter.intersectPoint(feetX, feetY + 4) as MatterJS.BodyType[];
    this.grounded = hits.some(b => !b.isSensor && b.label.startsWith('solid'));
    if (this.grounded) {
      this.coyoteUntil = now + 100;
      this.jumpsRemaining = maxJumps;
      if (now < this.jumpBufferUntil) {
        this.player.sprite.setVelocityY(PLAYER.JUMP_VELOCITY);
        this.jumpBufferUntil = 0;
        this.grounded = false;
        this.jumpsRemaining--;
        AudioManager.play('jump');
      }
    }

    // ----- Horizontal movement -----
    let moveX = 0;
    if (this.heldLeft || this.keyA.isDown || this.cursors.left.isDown) moveX -= 1;
    if (this.heldRight || this.keyD.isDown || this.cursors.right.isDown) moveX += 1;
    if (moveX === 0 && Math.abs(gp.leftStickX) > 0.1) moveX = gp.leftStickX;

    const speed = this.mods.moveSpeed;

    if (this.isDashing) {
      const dirSign = this.dashDir === 'right' ? 1 : -1;
      this.player.sprite.setVelocityX(dirSign * PLAYER.DASH_SPEED);
      this.player.sprite.setVelocityY(this.player.sprite.body!.velocity.y * 0.4);
      if (now >= this.dashUntil) this.isDashing = false;
    } else {
      if (moveX !== 0) {
        const targetVx = moveX * speed;
        const currentVx = this.player.sprite.body!.velocity.x;
        const newVx = Phaser.Math.Linear(currentVx, targetVx, 0.35);
        this.player.sprite.setVelocityX(newVx);
        this.player.facing = moveX > 0 ? 'right' : 'left';
      } else {
        const vx = this.player.sprite.body!.velocity.x;
        this.player.sprite.setVelocityX(vx * 0.78);
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyDash) && moveX !== 0) {
        this.tryDash(moveX > 0 ? 'right' : 'left');
      }
    }

    // ----- Energy regen + visual updates -----
    this.player.tickEnergy(deltaMs);
    this.player.update(deltaMs);
    this.combat.updateAimVisual();
  }

  isDashActive(): boolean {
    return this.isDashing;
  }
}

export default PlayerController;
