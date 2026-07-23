/**
 * MECHA: LAST PROTOCOL — Game Over UI v1.0
 *
 * Standalone component for the death screen. Extracted from GameScene
 * to keep GameScene lean and to make the Game Over UX easy to evolve
 * (branching on checkpoint availability, lore display, etc.).
 *
 * Behaviour:
 *   - RETRY: returns player to LAST CHECKPOINT (preserved), NOT area start.
 *     Per DESIGN_PILLARS "Punishing but fair": -50% unbanked XP is already
 *     the death penalty (applied in GameScene.onPlayerDied). Forcing the
 *     player to replay 5 minutes from area start on top of that is double
 *     jeopardy — and CheckpointSystem.getRespawnPosition() already falls
 *     back to area start when no checkpoint exists, so the behaviour is
 *     safe either way.
 *   - QUIT TO MENU: returns to main menu (full state cleanup).
 *
 * Architecture (per skills/groups-and-containers):
 *   - All elements are added to a single parent Container (stateContainer)
 *     that GameScene owns, so cleanup is automatic on state change.
 *   - MenuNavHelper registers RETRY/QUIT with the shared UIController so
 *     keyboard + gamepad navigation works out of the box.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale, fixTextStyle } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { ExperienceSystem } from '../../systems/ExperienceSystem';
import type { MenuNavHelper } from '../shared/MenuNavHelper';

export interface GameOverCallbacks {
  /** Called when player chooses RETRY. Returns to play at last checkpoint. */
  onRetry: () => void;
  /** Called when player chooses QUIT TO MENU. Returns to main menu. */
  onQuit: () => void;
}

export interface GameOverOptions {
  /** Container to add all UI elements to (typically GameScene.stateContainer). */
  container: Phaser.GameObjects.Container;
  /** Menu navigation helper for keyboard/gamepad/mouse. */
  menuNav: MenuNavHelper;
  /** Amount of XP lost to the death penalty (displayed in red). */
  lostXp: number;
  /** Whether a checkpoint is currently available. Drives the retry label. */
  hasCheckpoint: boolean;
  /** Callbacks for the two buttons. */
  callbacks: GameOverCallbacks;
}

export class GameOverUI {
  private scene: Phaser.Scene;
  private opts: GameOverOptions;

  constructor(scene: Phaser.Scene, opts: GameOverOptions) {
    this.scene = scene;
    this.opts = opts;
  }

  /** Build the full Game Over screen into the parent container. */
  build(): void {
    const c = this.opts.container;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    const isFa = getLocale() === 'fa';

    // ── Overlay — full-screen dim ──
    // depth 200 so it sits above play-layer sprites/HUD (depth <100).
    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.88)
      .setDepth(200);
    c.add(overlay);

    // ── Title — red, monospace, stroked ──
    const title = this.scene.add.text(w / 2, h * 0.3, t('gameover.title'), fixTextStyle({
      fontFamily: 'monospace', fontSize: '56px',
      color: '#ff4040', stroke: '#000', strokeThickness: 8,
    })).setOrigin(0.5).setDepth(201);
    c.add(title);

    // ── Stats line — level + total kills ──
    // Per PLAYER_EXPERIENCE_BIBLE: after death the player should see what
    // they accomplished, not just the failure.
    const statsLine = isFa
      ? `سطح ${ExperienceSystem.getLevel()}  |  ${SaveSystem.getPlayer().totalKills} کشته`
      : `LV.${ExperienceSystem.getLevel()}  |  ${SaveSystem.getPlayer().totalKills} kills`;
    const stats = this.scene.add.text(w / 2, h * 0.42, statsLine, fixTextStyle({
      fontFamily: 'monospace', fontSize: '14px', color: '#5a6470',
    })).setOrigin(0.5).setDepth(201);
    c.add(stats);

    // ── Death penalty — show lost XP in red ──
    // DESIGN_PILLARS Combat: Punishing — the player must FEEL the cost.
    if (this.opts.lostXp > 0) {
      const lostLine = isFa
        ? `جریمه مرگ: -${this.opts.lostXp} XP`
        : `DEATH PENALTY: -${this.opts.lostXp} XP`;
      const penalty = this.scene.add.text(w / 2, h * 0.48, lostLine, fixTextStyle({
        fontFamily: 'monospace', fontSize: '12px',
        color: '#ff4040', stroke: '#000', strokeThickness: 3,
      })).setOrigin(0.5).setDepth(201);
      c.add(penalty);
    }

    // ── Checkpoint status hint (small, muted) ──
    // Tells the player where RETRY will put them — no surprise respawns.
    // Implemented as a hint line, NOT a branching UI — simpler and honest.
    const hintKey = this.opts.hasCheckpoint
      ? (isFa ? 'از آخرین چک‌پوینت' : 'FROM LAST CHECKPOINT')
      : (isFa ? 'از شروع منطقه' : 'FROM AREA START');
    const hint = this.scene.add.text(w / 2, h * 0.515, hintKey, fixTextStyle({
      fontFamily: 'monospace', fontSize: '10px',
      color: '#3a4350', letterSpacing: 1,
    })).setOrigin(0.5).setDepth(201);
    c.add(hint);

    // ── RETRY button ──
    // CRITICAL: do NOT clear checkpoint. Player returns to last save.
    // If no checkpoint exists, CheckpointSystem.getRespawnPosition()
    // already falls back to area start (200, 420).
    this.opts.menuNav.makeMenuBtn(w / 2, h * 0.58, t('gameover.retry'), () => {
      AudioSystem.play('uiClick');
      this.opts.callbacks.onRetry();
    });

    // ── QUIT button ──
    this.opts.menuNav.makeMenuBtn(w / 2, h * 0.68, t('gameover.quit'), () => {
      AudioSystem.play('uiClick');
      this.opts.callbacks.onQuit();
    });
  }
}

export default GameOverUI;
