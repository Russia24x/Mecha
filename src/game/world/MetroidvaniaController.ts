/**
 * MECHA: LAST PROTOCOL — Metroidvania Controller
 *
 * Manages collectible pickups and shortcut activations.
 * Extracted from GameScene to reduce God Object size.
 *
 * Responsibilities:
 *   - hidePreCollectedItems()  → hide collectibles already in save data
 *   - preOpenShortcuts()       → open shortcuts already in save data
 *   - checkCollectiblePickups() → per-frame pickup detection
 *   - checkShortcutActivations() → per-frame shortcut opening
 *
 * Stateless except for lastLockedToastAt (toast throttle).
 * Dependencies passed per-call — no back-reference to GameScene.
 */
import Phaser from 'phaser';
import type { LoadedArea } from './AreaLoader';
import type { PlayerEntity } from '../entities/player/PlayerEntity';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { HUDUI } from '../ui/hud/HUDUI';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { getLocale } from '../systems/LocalizationSystem';

export class MetroidvaniaController {
  private lastLockedToastAt = 0;

  constructor(
    private scene: Phaser.Scene,
    private particles: ParticleSystem,
  ) {}

  /** Hide collectibles that were already collected (persisted in save data). */
  hidePreCollectedItems(loadedArea: LoadedArea): void {
    for (const col of loadedArea.collectibles) {
      if (!col || !col.active) continue;
      const id = col.getData('collectibleId') as string;
      if (SaveSystem.isCollectibleCollected(id)) {
        col.setData('collected', true);
        col.setVisible(false);
        col.setActive(false);
      }
    }
  }

  /** Pre-open shortcuts that were already opened (persisted in save data). */
  preOpenShortcuts(loadedArea: LoadedArea): void {
    for (const sc of loadedArea.shortcuts) {
      if (!sc || !sc.active) continue;
      const id = sc.getData('shortcutId') as string;
      if (SaveSystem.isShortcutOpened(id)) {
        sc.setData('shortcutOpen', true);
        const physicsBody = sc.getData('physicsBody') as Phaser.Physics.Matter.Image | null;
        if (physicsBody && physicsBody.active) {
          try { this.scene.matter.world.remove(physicsBody.body as MatterJS.Body); } catch { /* */ }
          physicsBody.destroy();
        }
        sc.setAlpha(0.3);
        sc.setScale(1, 0);
        sc.setVisible(false);
      }
    }
  }

  /** Check if player is near any collectible → pick it up. Called per-frame. */
  checkCollectiblePickups(loadedArea: LoadedArea, player: PlayerEntity, hud: HUDUI | null): void {
    if (!player.sprite?.active) return;
    const px = player.sprite.x;
    const py = player.sprite.y;
    for (const col of loadedArea.collectibles) {
      if (!col || !col.active) continue;
      if (col.getData('collected')) continue;
      const cx = col.x;
      const cy = col.y;
      const dist = Phaser.Math.Distance.Between(px, py, cx, cy);
      if (dist < 35) {
        const requiredAbility = col.getData('requiredAbility') as string | null;
        if (requiredAbility && !player.hasAbility(requiredAbility)) {
          if (this.scene.time.now - this.lastLockedToastAt > 1000) {
            this.lastLockedToastAt = this.scene.time.now;
            const abilityName = getLocale() === 'fa' ? requiredAbility : requiredAbility.toUpperCase();
            hud?.toast(getLocale() === 'fa'
              ? `🔒 نیاز به ${abilityName}`
              : `🔒 REQUIRES ${abilityName}`);
          }
          continue;
        }
        this.pickupCollectible(col, player, hud);
      }
    }
  }

  /** Check if player is approaching a shortcut from the correct side → open it. */
  checkShortcutActivations(loadedArea: LoadedArea, player: PlayerEntity, hud: HUDUI | null): void {
    if (!player.sprite?.active) return;
    const px = player.sprite.x;
    const py = player.sprite.y;
    for (const sc of loadedArea.shortcuts) {
      if (!sc || !sc.active) continue;
      if (sc.getData('shortcutOpen')) continue;
      const id = sc.getData('shortcutId') as string;
      if (SaveSystem.isShortcutOpened(id)) {
        this.openShortcut(sc, id, false);
        continue;
      }
      const sx = sc.x;
      const sy = sc.y;
      const opensFrom = sc.getData('opensFrom') as string;
      const dist = Phaser.Math.Distance.Between(px, py, sx, sy);
      if (dist > 60) continue;
      let onCorrectSide = false;
      switch (opensFrom) {
        case 'left':   onCorrectSide = px < sx; break;
        case 'right':  onCorrectSide = px > sx; break;
        case 'top':    onCorrectSide = py < sy; break;
        case 'bottom': onCorrectSide = py > sy; break;
      }
      if (onCorrectSide) {
        this.openShortcut(sc, id, true, hud);
      }
    }
  }

  /** Pick up a collectible — grant reward, mark as collected, visual burst. */
  private pickupCollectible(col: Phaser.GameObjects.Container, player: PlayerEntity, hud: HUDUI | null): void {
    const id = col.getData('collectibleId') as string;
    const type = col.getData('collectibleType') as string;
    const isNew = SaveSystem.markCollectibleCollected(id);
    if (!isNew) return;
    col.setData('collected', true);

    let toastMsg = '';
    let toastColor = 0xffffff;
    switch (type) {
      case 'health_fragment':
        player.health.max += 10;
        player.health.current += 10;
        toastMsg = getLocale() === 'fa' ? '◆ +10 حداکثر سلامتی' : '◆ +10 MAX HEALTH';
        toastColor = 0x40d070;
        break;
      case 'energy_fragment':
        player.energy.max += 10;
        player.energy.current += 10;
        toastMsg = getLocale() === 'fa' ? '◆ +10 حداکثر انرژی' : '◆ +10 MAX ENERGY';
        toastColor = 0x4090ff;
        break;
      case 'skill_point':
        SaveSystem.grantSkillPoint();
        toastMsg = getLocale() === 'fa' ? '◆ +1 امتیاز مهارت' : '◆ +1 SKILL POINT';
        toastColor = 0xffc040;
        break;
      case 'weapon_part':
        SaveSystem.addItem('weapon_part', 1);
        toastMsg = getLocale() === 'fa' ? '◆ قطعه سلاح' : '◆ WEAPON PART';
        toastColor = 0xff80ff;
        break;
    }

    this.particles.sparks(col.x, col.y, toastColor, 12);
    this.particles.screenFlash(toastColor, 0.15, 250);
    this.scene.tweens.add({
      targets: col, alpha: 0, scale: 2, duration: 300, ease: 'Cubic.out',
      onComplete: () => { col.setVisible(false); },
    });
    AudioSystem.play('skillUnlock');
    hud?.toast(toastMsg);
  }

  /** Open a shortcut door — visual animation + persist + remove physics body. */
  private openShortcut(sc: Phaser.GameObjects.Container, id: string, withToast: boolean, hud?: HUDUI | null): void {
    sc.setData('shortcutOpen', true);
    SaveSystem.markShortcutOpened(id);
    const physicsBody = sc.getData('physicsBody') as Phaser.Physics.Matter.Image | null;
    if (physicsBody && physicsBody.active) {
      this.scene.matter.world.remove(physicsBody.body as MatterJS.Body);
      physicsBody.destroy();
    }
    this.scene.tweens.add({
      targets: sc, alpha: { from: 1, to: 0.3 }, scaleY: 0, duration: 500, ease: 'Cubic.out',
    });
    this.particles.sparks(sc.x, sc.y, 0xffc040, 8);
    AudioSystem.play('skillUnlock');
    if (withToast && hud) {
      hud.toast(getLocale() === 'fa' ? '⇌ میان‌بر باز شد' : '⇌ SHORTCUT OPENED');
    }
  }
}

export default MetroidvaniaController;
