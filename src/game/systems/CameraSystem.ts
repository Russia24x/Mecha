/**
 * MECHA: LAST PROTOCOL — Camera System
 * Manages camera follow, bounds, zoom, shake, flash, fade.
 * Independent of Player — accepts any target with x/y.
 */
import Phaser from 'phaser';

export class CameraSystem {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
  }

  follow(target: Phaser.GameObjects.GameObject | Phaser.Physics.Matter.Image, lerp = 0.1): void {
    this.camera.startFollow(target, true, lerp, lerp);
  }

  stopFollow(): void {
    this.camera.stopFollow();
  }

  setDeadzone(w: number, h: number): void {
    this.camera.setDeadzone(w, h);
  }

  setBounds(x: number, y: number, w: number, h: number): void {
    this.camera.setBounds(x, y, w, h);
  }

  setZoom(zoom: number, smooth = true): void {
    if (smooth) {
      this.camera.setZoom(Phaser.Math.Linear(this.camera.zoom, zoom, 0.04));
    } else {
      this.camera.setZoom(zoom);
    }
  }

  resetZoom(): void {
    this.camera.setZoom(1);
  }

  shake(duration: number, intensity: number): void {
    this.camera.shake(duration, intensity);
  }

  flash(duration: number, r: number, g: number, b: number): void {
    this.camera.flash(duration, r, g, b);
  }

  fadeIn(duration: number, r = 0, g = 0, b = 0): void {
    this.camera.fadeIn(duration, r, g, b);
  }

  fadeOut(duration: number, r = 0, g = 0, b = 0): void {
    this.camera.fadeOut(duration, r, g, b);
  }

  setBackgroundColor(color: number): void {
    this.camera.setBackgroundColor(color);
  }

  get scrollX(): number { return this.camera.scrollX; }
  get scrollY(): number { return this.camera.scrollY; }
  get zoom(): number { return this.camera.zoom; }
}

export default CameraSystem;
