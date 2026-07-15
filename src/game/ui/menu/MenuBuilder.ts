/**
 * MECHA: LAST PROTOCOL — Menu Builder
 *
 * Builds the main menu screen (title + buttons: START, CONTINUE, SETTINGS, HOW TO PLAY).
 * Also builds the How To Play overlay.
 *
 * Extracted from GameScene to reduce God Object size.
 *
 * Design:
 *   - build() creates all visuals + registers buttons via MenuNavHelper
 *   - showHowToPlay() rebuilds the container with instructions
 *   - Uses callbacks for state transitions (no back-reference to GameScene)
 *   - MenuNavHelper is passed in (shared with HubBuilder + gameover/victory)
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, fixTextStyle, getLocale } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { InputSchemeManager } from '../../systems/InputSchemeManager';
import { SaveSystem } from '../../systems/SaveSystem';
import { MenuNavHelper } from '../shared/MenuNavHelper';

export interface MenuCallbacks {
  onStart: () => void;      // Continue current game → hub
  onNewGame: () => void;    // Fresh start — clear save, start from scratch
  onContinue: () => void;   // Resume directly at last checkpoint (skip hub)
  onOpenSettings: () => void;
}

export class MenuBuilder {
  private starfieldTimers: Phaser.Time.TimerEvent[] = [];

  constructor(
    private scene: Phaser.Scene,
    private container: Phaser.GameObjects.Container,
    private nav: MenuNavHelper,
    private callbacks: MenuCallbacks,
  ) {}

  /** Build the main menu screen. */
  build(): void {
    const c = this.container;
    const w = GAME.WIDTH, h = GAME.HEIGHT;

    // === Background: starry night sky ===
    const bg = this.scene.add.graphics();
    bg.setDepth(0);
    bg.fillStyle(0x040814, 1);
    bg.fillRect(0, 0, w, h);
    for (let r = 500; r > 0; r -= 30) {
      bg.fillStyle(0x0a1228, 0.02);
      bg.fillCircle(w / 2, h * 0.35, r);
    }
    c.add(bg);

    // Stars — 120 twinkling, drifting dots
    for (let i = 0; i < 120; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h * 0.75;
      const size = 0.5 + Math.random() * 2;
      const brightness = 0.2 + Math.random() * 0.8;
      const starColor = Math.random() < 0.15 ? 0xffe0a0 : Math.random() < 0.3 ? 0xa0c0ff : 0xc0e0ff;
      const star = this.scene.add.circle(sx, sy, size, starColor, brightness);
      star.setDepth(1);
      c.add(star);
      this.scene.tweens.add({
        targets: star,
        alpha: { from: brightness * 0.1, to: brightness },
        scale: { from: size * 0.5, to: size * 1.2 },
        duration: 600 + Math.random() * 2500,
        yoyo: true, repeat: -1,
        delay: Math.random() * 3000,
        ease: 'Sine.inOut',
      });
      this.scene.tweens.add({
        targets: star,
        x: sx + (Math.random() - 0.5) * 30,
        y: sy + (Math.random() - 0.5) * 20,
        duration: 5000 + Math.random() * 8000,
        yoyo: true, repeat: -1,
        ease: 'Sine.inOut',
      });
    }

    // Shooting stars (periodic)
    const shootingStarFunc = () => {
      const ss = this.scene.add.rectangle(0, 0, 40 + Math.random() * 30, 1.5, 0xffffff, 0.9);
      ss.setBlendMode(Phaser.BlendModes.ADD);
      ss.setDepth(1);
      ss.setOrigin(0, 0.5);
      ss.setRotation(0.3 + Math.random() * 0.2);
      c.add(ss);
      const startX = Math.random() * w * 0.7;
      const startY = Math.random() * h * 0.3;
      const endX = startX + 300 + Math.random() * 200;
      const endY = startY + 120 + Math.random() * 80;
      this.scene.tweens.add({
        targets: ss,
        x: endX, y: endY,
        alpha: { from: 0.9, to: 0 },
        duration: 600 + Math.random() * 400,
        onComplete: () => ss.destroy(),
      });
    };
    const shootingTimer = this.scene.time.addEvent({
      delay: 3000, loop: true,
      callback: () => { if (Math.random() < 0.4) shootingStarFunc(); },
    });
    this.starfieldTimers.push(shootingTimer);

    // Brighter "beacon" stars with pulsing glow
    for (let i = 0; i < 8; i++) {
      const bx = Math.random() * w;
      const by = Math.random() * h * 0.55;
      const beaconColor = [0xffffff, 0x80a0ff, 0xffd0a0, 0xa0ffff][Math.floor(Math.random() * 4)];
      const beacon = this.scene.add.circle(bx, by, 2 + Math.random(), beaconColor, 1);
      beacon.setDepth(1); beacon.setBlendMode(Phaser.BlendModes.ADD);
      c.add(beacon);
      const beaconGlow = this.scene.add.circle(bx, by, 10 + Math.random() * 6, beaconColor, 0.12);
      beaconGlow.setDepth(1); beaconGlow.setBlendMode(Phaser.BlendModes.ADD);
      c.add(beaconGlow);
      this.scene.tweens.add({
        targets: beaconGlow,
        alpha: { from: 0.05, to: 0.25 },
        scale: { from: 0.7, to: 1.3 },
        duration: 1200 + Math.random() * 2000,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
      this.scene.tweens.add({
        targets: beacon,
        alpha: { from: 0.6, to: 1 },
        duration: 800 + Math.random() * 1200,
        yoyo: true, repeat: -1,
      });
    }

    // === Title: MECHA (very large) ===
    const titleY = h * 0.3;
    const glow = this.scene.add.circle(w / 2, titleY, 250, 0x39d0d8, 0.05);
    glow.setBlendMode(Phaser.BlendModes.ADD); glow.setDepth(2);
    c.add(glow);
    this.scene.tweens.add({ targets: glow, alpha: { from: 0.03, to: 0.08 }, duration: 3000, yoyo: true, repeat: -1 });

    const mechaText = this.scene.add.text(w / 2, titleY, 'MECHA', {
      fontFamily: 'monospace', fontSize: '96px', color: '#39d0d8',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(3);
    c.add(mechaText);

    const protocolText = this.scene.add.text(w / 2, titleY + 65, 'LAST PROTOCOL', {
      fontFamily: 'monospace', fontSize: '22px', color: '#e0e8f0',
      stroke: '#000', strokeThickness: 3, letterSpacing: 4,
    }).setOrigin(0.5).setDepth(3);
    c.add(protocolText);
    this.scene.tweens.add({ targets: protocolText, alpha: { from: 0.6, to: 1 }, duration: 2500, yoyo: true, repeat: -1 });

    // === Small minimal buttons ===
    const btnY = h * 0.55;
    const btnGap = 44;
    // START = continue current game → hub
    this.nav.makeMenuBtn(w / 2, btnY, t('menu.start'), () => { AudioSystem.play('uiClick'); this.callbacks.onStart(); });
    // NEW GAME = clear save, start fresh
    this.nav.makeMenuBtn(w / 2, btnY + btnGap, (getLocale() === 'fa' ? 'بازی جدید' : 'NEW GAME'), () => { AudioSystem.play('uiClick'); this.callbacks.onNewGame(); });
    // CONTINUE = resume directly at last checkpoint (skip hub)
    this.nav.makeMenuBtn(w / 2, btnY + btnGap * 2, t('menu.continue'), () => {
      AudioSystem.play('uiClick');
      this.callbacks.onContinue();
    }, !this.hasCheckpoint());
    this.nav.makeMenuBtn(w / 2, btnY + btnGap * 3, t('menu.settings'), () => { AudioSystem.play('uiClick'); this.callbacks.onOpenSettings(); });
    this.nav.makeMenuBtn(w / 2, btnY + btnGap * 4, t('menu.how_to_play'), () => { AudioSystem.play('uiClick'); this.showHowToPlay(); });

    // === Footer ===
    c.add(this.scene.add.text(w / 2, h - 25, t('game.version') + '  ·  PHASER 4.2 · MATTER.JS', {
      fontFamily: 'monospace', fontSize: '9px', color: '#0a1220',
    }).setOrigin(0.5).setDepth(3));

    this.nav.setupNav();
  }

  /** Show the How To Play overlay (replaces menu content). */
  showHowToPlay(): void {
    const c = this.container;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    c.removeAll(true);
    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.92).setDepth(250);
    c.add(overlay);

    // Dynamic: pull labels from InputSchemeManager (auto-adapts to KB / Xbox / PS)
    const scheme = InputSchemeManager.getActiveScheme();
    const L = (en: string, fa: string) => getLocale() === 'fa' ? fa : en;

    c.add(this.scene.add.text(w / 2, 50, L('HOW TO PLAY', 'راهنما'), fixTextStyle({
      fontFamily: 'monospace', fontSize: '24px', color: '#39d0d8', stroke: '#000', strokeThickness: 4, letterSpacing: 3,
    })).setOrigin(0.5));

    const controls: [string, string][] = [
      [L('MOVE', 'حرکت'), InputSchemeManager.getLabel('move')],
      [L('JUMP', 'پرش'), InputSchemeManager.getLabel('jump')],
      [L('DASH', 'دش'), InputSchemeManager.getLabel('dash')],
      [L('FIRE', 'شلیک'), InputSchemeManager.getLabel('fire')],
      [L('MELEE', 'نبرد نزدیک'), InputSchemeManager.getLabel('melee')],
      [L('INTERACT', 'تعامل'), InputSchemeManager.getLabel('interact')],
      [L('PAUSE', 'توقف'), InputSchemeManager.getLabel('pause')],
      [L('WEAPONS 1-4', 'سلاح‌ها ۱-۴'), '1 2 3 4'],
    ];

    let yPos = 110;
    for (const [action, key] of controls) {
      c.add(this.scene.add.text(w / 2 - 200, yPos, action, fixTextStyle({
        fontFamily: 'monospace', fontSize: '14px', color: '#5a6470', letterSpacing: 1,
      })).setOrigin(0, 0.5));
      c.add(this.scene.add.text(w / 2 + 50, yPos, key, fixTextStyle({
        fontFamily: 'monospace', fontSize: '14px', color: '#cfd6e0', stroke: '#000', strokeThickness: 2,
      })).setOrigin(0, 0.5));
      yPos += 36;
    }

    // Abilities section
    yPos += 20;
    c.add(this.scene.add.text(w / 2, yPos, L('ABILITIES', 'توانایی‌ها'), fixTextStyle({
      fontFamily: 'monospace', fontSize: '16px', color: '#ffc040', stroke: '#000', strokeThickness: 3, letterSpacing: 2,
    })).setOrigin(0.5));
    yPos += 36;

    const abilities: [string, string][] = [
      [L('HOVER', 'هاور'), scheme === 'keyboard' ? 'SPACE (held in air)' : `${InputSchemeManager.getLabel('jump')} (held in air)`],
      [L('GRAPPLE', 'گرپل'), InputSchemeManager.getLabel('grapple') || 'F'],
      [L('EMP', 'EMP'), InputSchemeManager.getLabel('emp') || 'G'],
      [L('HACK', 'هک'), `${InputSchemeManager.getLabel('interact')} (held near enemy)`],
    ];
    for (const [action, key] of abilities) {
      c.add(this.scene.add.text(w / 2 - 200, yPos, action, fixTextStyle({
        fontFamily: 'monospace', fontSize: '13px', color: '#5a6470', letterSpacing: 1,
      })).setOrigin(0, 0.5));
      c.add(this.scene.add.text(w / 2 + 50, yPos, key, fixTextStyle({
        fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0', stroke: '#000', strokeThickness: 2,
      })).setOrigin(0, 0.5));
      yPos += 30;
    }

    // Back button
    this.nav.makeMenuBtn(w / 2, h - 60, L('BACK', 'بازگشت'), () => {
      AudioSystem.play('uiClick');
      // Rebuild main menu
      c.removeAll(true);
      this.nav.reset();
      this.build();
    });
    this.nav.setupNav();
  }

  /** Check if a checkpoint exists (for Continue button enabled state). */
  private hasCheckpoint(): boolean {
    return SaveSystem.hasCheckpoint();
  }

  /** Destroy — stop starfield timers. */
  destroy(): void {
    this.starfieldTimers.forEach(t => t.remove());
    this.starfieldTimers = [];
  }
}

export default MenuBuilder;
