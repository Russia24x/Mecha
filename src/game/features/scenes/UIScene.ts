/**
 * MECHA: LAST PROTOCOL — UIScene
 * In v3.0, pause menu is handled within GameScene via overlay flags.
 * This scene exists for backward compatibility but does nothing.
 * Can be removed once all references to scene.launch('UIScene') are gone.
 */
import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene' }); }
  create(): void {
    // Pause is handled by GameScene's internal togglePause() method.
    // This scene immediately stops itself.
    this.scene.stop();
  }
}

export default UIScene;
