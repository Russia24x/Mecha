/**
 * MECHA: LAST PROTOCOL - SettingsScene
 * Audio, graphics, and controls settings. Persists to localStorage.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { Effects } from '../../shared/Effects';
import { GamepadManager } from '../../shared/GamepadManager';
import { AssetGenerator } from '../../shared/AssetGenerator';

const SETTINGS_KEY = 'mecha_last_protocol_settings';

interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  gamepadEnabled: boolean;
  screenShake: boolean;
  particles: boolean;
}

const DEFAULTS: Settings = {
  masterVolume: 0.7,
  musicVolume: 0.4,
  sfxVolume: 0.8,
  muted: false,
  gamepadEnabled: true,
  screenShake: true,
  particles: true,
};

export class SettingsScene extends Phaser.Scene {
  private settings: Settings = { ...DEFAULTS };
  private valueTexts: Record<string, Phaser.GameObjects.Text> = {};

  constructor() {
    super({ key: 'SettingsScene' });
  }

  create(): void {
    this.loadSettings();
    Effects.playMusic('menuAmbient');
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;

    // Procedural background
    const bgUrl = AssetGenerator.get('settings-bg', w, h);
    this.textures.addBase64('settings-bg', bgUrl);
    this.time.delayedCall(50, () => {
      if (this.textures.exists('settings-bg')) {
        this.add.image(0, 0, 'settings-bg').setOrigin(0, 0).setDepth(-1);
      }
    });

    this.add.text(w / 2, 50, 'SETTINGS', {
      fontFamily: 'monospace', fontSize: '32px',
      color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);

    let y = 130;

    // ---- AUDIO section ----
    this.add.text(w / 2 - 280, y, 'AUDIO', {
      fontFamily: 'monospace', fontSize: '14px', color: '#7a8090',
    });
    y += 30;
    this.makeSlider(w / 2, y, 'masterVolume', 'Master Volume', 0, 1, 0.05, '%');
    y += 50;
    this.makeSlider(w / 2, y, 'musicVolume', 'Music Volume', 0, 1, 0.05, '%');
    y += 50;
    this.makeSlider(w / 2, y, 'sfxVolume', 'SFX Volume', 0, 1, 0.05, '%');
    y += 50;
    this.makeToggle(w / 2, y, 'muted', 'Mute All Audio');
    y += 70;

    // ---- GRAPHICS section ----
    this.add.text(w / 2 - 280, y, 'GRAPHICS', {
      fontFamily: 'monospace', fontSize: '14px', color: '#7a8090',
    });
    y += 30;
    this.makeToggle(w / 2, y, 'screenShake', 'Screen Shake');
    y += 40;
    this.makeToggle(w / 2, y, 'particles', 'Particle Effects');
    y += 70;

    // ---- CONTROLS section ----
    this.add.text(w / 2 - 280, y, 'CONTROLS', {
      fontFamily: 'monospace', fontSize: '14px', color: '#7a8090',
    });
    y += 30;
    this.makeToggle(w / 2, y, 'gamepadEnabled', 'Gamepad Support');
    y += 30;
    const gpStatus = GamepadManager.isAvailable()
      ? '✓ Gamepad detected' : '○ No gamepad connected';
    this.add.text(w / 2, y, gpStatus, {
      fontFamily: 'monospace', fontSize: '11px',
      color: GamepadManager.isAvailable() ? '#40d070' : '#7a8090',
    }).setOrigin(0.5);
    y += 30;

    // Controls hint
    this.add.text(w / 2, y, 'WASD/Arrows: Move  •  Space: Jump  •  Shift: Dash  •  J/LMB: Fire  •  K/RMB: Melee  •  1-4: Weapons  •  Q/E: Cycle  •  ESC: Pause', {
      fontFamily: 'monospace', fontSize: '10px', color: '#5a6470',
      align: 'center',
    }).setOrigin(0.5);

    // Bottom buttons
    this.makeButton(w / 2 - 130, h - 50, '↻  RESET', () => {
      Effects.play('uiClick');
      this.settings = { ...DEFAULTS };
      this.applySettings();
      this.saveSettings();
      this.scene.restart();
    });
    this.makeButton(w / 2 + 130, h - 50, '✓  SAVE & BACK', () => {
      Effects.play('uiClick');
      this.saveSettings();
      this.scene.start('MapScene');
    });
  }

  private makeSlider(x: number, y: number, key: keyof Settings, label: string, min: number, max: number, step: number, _suffix: string): void {
    this.add.text(x - 200, y, label, {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0',
    }).setOrigin(0, 0.5);

    // Slider track
    const trackW = 240;
    const trackH = 8;
    const trackX = x + 20;
    const track = this.add.rectangle(trackX + trackW / 2, y, trackW, trackH, 0x202830);
    track.setStrokeStyle(1, 0x3a4350);
    track.setOrigin(0.5);

    // Slider fill
    const value = this.settings[key] as number;
    const fillW = trackW * (value - min) / (max - min);
    const fill = this.add.rectangle(trackX, y, fillW, trackH, 0x39d0d8);
    fill.setOrigin(0, 0.5);

    // Slider handle (clickable)
    const handleX = trackX + fillW;
    const handle = this.add.circle(handleX, y, 10, 0x39d0d8);
    handle.setStrokeStyle(2, 0xffffff, 0.6);
    handle.setInteractive({ useHandCursor: true });
    this.input.setDraggable(handle);
    handle.on('drag', (pointer: Phaser.Input.Pointer, dragX: number) => {
      const clamped = Phaser.Math.Clamp(dragX, trackX, trackX + trackW);
      handle.x = clamped;
      const newVal = min + (clamped - trackX) / trackW * (max - min);
      const stepped = Math.round(newVal / step) * step;
      (this.settings[key] as number) = stepped;
      // Update fill
      const newFillW = trackW * (stepped - min) / (max - min);
      fill.width = newFillW;
      // Update value text
      if (this.valueTexts[key]) {
        this.valueTexts[key].setText(Math.round(stepped * 100) + '%');
      }
      this.applySettings();
    });

    // Value text
    const vt = this.add.text(trackX + trackW + 20, y, Math.round(value * 100) + '%', {
      fontFamily: 'monospace', fontSize: '13px', color: '#9be0b0',
    }).setOrigin(0, 0.5);
    this.valueTexts[key] = vt;
  }

  private makeToggle(x: number, y: number, key: keyof Settings, label: string): void {
    this.add.text(x - 200, y, label, {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0',
    }).setOrigin(0, 0.5);

    const value = this.settings[key] as boolean;
    const bg = this.add.rectangle(x + 120, y, 60, 24, value ? 0x1a3020 : 0x301820, 0.95);
    bg.setStrokeStyle(1, value ? 0x40d070 : 0x603030);
    bg.setInteractive({ useHandCursor: true });
    const dot = this.add.circle(value ? x + 140 : x + 100, y, 8, value ? 0x40d070 : 0x603030);
    bg.on('pointerup', () => {
      Effects.play('uiClick');
      (this.settings[key] as boolean) = !this.settings[key];
      this.scene.restart();
    });
  }

  private applySettings(): void {
    Effects.setMasterVolume(this.settings.masterVolume);
    Effects.setMusicVolume(this.settings.musicVolume);
    Effects.setSfxVolume(this.settings.sfxVolume);
    Effects.setMuted(this.settings.muted);
    GamepadManager.setEnabled(this.settings.gamepadEnabled);
  }

  private loadSettings(): void {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SETTINGS_KEY) : null;
      if (raw) this.settings = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    this.applySettings();
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { /* ignore */ }
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 200, 40, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x3a4350);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { bg.setFillStyle(0x243040, 1); Effects.play('uiHover'); });
    bg.on('pointerout',  () => bg.setFillStyle(0x1a2030, 0.95));
    bg.on('pointerup', onClick);
    const t = this.add.text(0, 0, label, {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0',
    }).setOrigin(0.5);
    c.add([bg, t]);
  }
}

export default SettingsScene;
