/**
 * MECHA: LAST PROTOCOL — Settings UI
 * Volume sliders, brightness, language toggle (EN/FA).
 * All settings persist via SaveSystem.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, setLocale, getLocale } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { RenderSystem } from '../../systems/RenderSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import type { Locale } from '../../data/types';

export class SettingsUI {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private sliders: { handle: Phaser.GameObjects.Arc; fill: Phaser.GameObjects.Rectangle; label: string }[] = [];

  constructor(scene: Phaser.Scene, onBack: () => void) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85);
    this.container.add(overlay);

    this.container.add(scene.add.text(w / 2, 50, t('menu.settings'), {
      fontFamily: 'monospace', fontSize: '32px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    let y = 130;
    // Audio section
    this.container.add(scene.add.text(w / 2 - 280, y, t('settings.audio'), { fontFamily: 'monospace', fontSize: '14px', color: '#7a8090' }));
    y += 40;
    this.makeSlider(w / 2, y, t('settings.master_volume'), AudioSystem.getMasterVolume(), (v) => { AudioSystem.setMasterVolume(v); SaveSystem.saveSettings({ masterVolume: v }); }); y += 50;
    this.makeSlider(w / 2, y, t('settings.sfx_volume'), AudioSystem.getSfxVolume(), (v) => { AudioSystem.setSfxVolume(v); SaveSystem.saveSettings({ sfxVolume: v }); }); y += 50;
    y += 20;

    // Brightness
    this.container.add(scene.add.text(w / 2 - 280, y, t('settings.brightness'), { fontFamily: 'monospace', fontSize: '14px', color: '#7a8090' }));
    y += 40;
    this.makeSlider(w / 2, y, t('settings.brightness'), RenderSystem.getBrightness(), (v) => { RenderSystem.setBrightness(v); SaveSystem.saveSettings({ brightness: v }); }); y += 50;
    y += 20;

    // Language toggle
    this.container.add(scene.add.text(w / 2 - 280, y, t('settings.language'), { fontFamily: 'monospace', fontSize: '14px', color: '#7a8090' }));
    y += 40;
    this.makeLanguageToggle(w / 2, y); y += 50;

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 50, 280, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onBack(); });
    const btnText = scene.add.text(w / 2, h - 50, t('menu.back'), { fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0' }).setOrigin(0.5);
    this.container.add([bg, btnText]);
  }

  private makeSlider(x: number, y: number, label: string, value: number, onChange: (v: number) => void): void {
    this.container.add(this.scene.add.text(x - 200, y, label, { fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0' }).setOrigin(0, 0.5));
    const track = this.scene.add.rectangle(x + 20, y, 240, 8, 0x202830).setStrokeStyle(1, 0x3a4350);
    this.container.add(track);
    const fill = this.scene.add.rectangle(x + 20, y, 240 * value, 8, 0x39d0d8).setOrigin(0, 0.5);
    this.container.add(fill);
    const handle = this.scene.add.circle(x + 20 + 240 * value, y, 10, 0x39d0d8).setStrokeStyle(2, 0xffffff, 0.6);
    handle.setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(handle);
    handle.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => {
      const clamped = Phaser.Math.Clamp(dragX, x + 20, x + 20 + 240);
      handle.x = clamped;
      const v = (clamped - x - 20) / 240;
      fill.width = 240 * v;
      onChange(v);
    });
    this.container.add(handle);
    this.sliders.push({ handle, fill, label });
  }

  private makeLanguageToggle(x: number, y: number): void {
    const currentLang = getLocale();
    const enBtn = this.scene.add.rectangle(x - 60, y, 100, 32, currentLang === 'en' ? 0x243040 : 0x1a2030, 0.95)
      .setStrokeStyle(1, currentLang === 'en' ? 0x66f0ff : 0x3a4350);
    enBtn.setInteractive({ useHandCursor: true });
    enBtn.on('pointerdown', () => { setLocale('en'); SaveSystem.saveSettings({ locale: 'en' }); AudioSystem.play('uiClick'); this.scene.scene.restart(); });
    const enText = this.scene.add.text(x - 60, y, 'EN', { fontFamily: 'monospace', fontSize: '13px', color: currentLang === 'en' ? '#66f0ff' : '#cfd6e0' }).setOrigin(0.5);
    const faBtn = this.scene.add.rectangle(x + 60, y, 100, 32, currentLang === 'fa' ? 0x243040 : 0x1a2030, 0.95)
      .setStrokeStyle(1, currentLang === 'fa' ? 0x66f0ff : 0x3a4350);
    faBtn.setInteractive({ useHandCursor: true });
    faBtn.on('pointerdown', () => { setLocale('fa'); SaveSystem.saveSettings({ locale: 'fa' }); AudioSystem.play('uiClick'); this.scene.scene.restart(); });
    const faText = this.scene.add.text(x + 60, y, 'فارسی', { fontFamily: 'monospace', fontSize: '13px', color: currentLang === 'fa' ? '#66f0ff' : '#cfd6e0' }).setOrigin(0.5);
    this.container.add([enBtn, enText, faBtn, faText]);
  }

  show(): void { this.container.setVisible(true); }
  hide(): void { this.container.setVisible(false); }
  get isVisible(): boolean { return this.container.visible; }

  destroy(): void { this.container.destroy(); }
}

export default SettingsUI;
