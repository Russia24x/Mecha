/**
 * MECHA: LAST PROTOCOL — Profile Select UI
 *
 * Overlay shown when the user picks NEW GAME or CONTINUE from the main menu.
 * Displays 3 save slots, lets the user:
 *   - Create a new profile in an empty slot
 *   - Select an existing profile to play
 *   - Delete a profile (with confirmation)
 *
 * Lifecycle:
 *   - show() — builds the overlay, lists profiles from ProfileManager
 *   - hide() — destroys the overlay
 *   - On select/create/delete → calls callbacks.onSelect(slotId)
 *
 * Visual style matches MenuBuilder (dark, monospace, cyan accent).
 *
 * Localization: labels adapt to current locale (en/fa).
 */

import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { fixTextStyle, getLocale } from '../../systems/LocalizationSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import { ProfileManager, DEFAULT_SAVE, type ProfileSummary } from '../../systems/ProfileManager';
import { ProfileDB, type SlotId } from '../../systems/ProfileDB';
import { MenuNavHelper } from '../shared/MenuNavHelper';

export interface ProfileSelectCallbacks {
  /** Called when a profile is selected (either existing or newly created). */
  onSelect: (slotId: SlotId) => void;
  /** Called when the user clicks Back. */
  onBack: () => void;
}

const SLOT_WIDTH = 320;
const SLOT_HEIGHT = 110;
const SLOT_GAP = 16;

export class ProfileSelectUI {
  private container: Phaser.GameObjects.Container | null = null;
  private profiles: ProfileSummary[] = [];
  private confirmDeleteSlot: SlotId | null = null;

  constructor(
    private scene: Phaser.Scene,
    private nav: MenuNavHelper,
    private callbacks: ProfileSelectCallbacks,
  ) {}

  /** Show the profile select overlay. Lists all profiles from IndexedDB. */
  async show(): Promise<void> {
    // Fetch profiles from IndexedDB
    this.profiles = await ProfileManager.listProfiles();

    const w = GAME.WIDTH, h = GAME.HEIGHT;
    // Use the nav's container (stateContainer) so buttons are in the same
    // display list that UIController manages. This ensures hit-testing works.
    // We set depth 300 on the container to be above menu content.
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(300);

    // Replace the nav's container reference so makeMenuBtn/addButton add to
    // our overlay container instead of the original stateContainer.
    // (MenuNavHelper stores container as a private field — we access via cast.)
    (this.nav as unknown as { container: Phaser.GameObjects.Container }).container = this.container;

    // === Background overlay ===
    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.92);
    this.container.add(overlay);

    // === Title ===
    const L = this.L;
    const titleY = 60;
    const title = this.scene.add.text(w / 2, titleY, L('SELECT PROFILE', 'انتخاب پروفایل'), fixTextStyle({
      fontFamily: 'monospace', fontSize: '24px', color: '#39d0d8',
      stroke: '#000', strokeThickness: 4, letterSpacing: 3,
    })).setOrigin(0.5);
    this.container.add(title);

    // === Slots ===
    const startY = 130;
    for (let i = 0; i < 3; i++) {
      const slotId = i as SlotId;
      const y = startY + i * (SLOT_HEIGHT + SLOT_GAP);
      const profile = this.profiles.find(p => p.slotId === slotId);
      this.buildSlot(slotId, y, profile);
    }

    // === Back button ===
    this.nav.makeMenuBtn(w / 2, h - 50, L('BACK', 'بازگشت'), () => {
      AudioSystem.play('uiClick');
      this.callbacks.onBack();
    });

    this.nav.setupNav();
  }

  /** Build a single slot card. Behavior depends on whether slot is empty or has data. */
  private buildSlot(slotId: SlotId, y: number, profile: ProfileSummary | undefined): void {
    const c = this.container!;
    const w = GAME.WIDTH;
    const x = w / 2;
    const L = this.L;

    // Slot card background
    const bg = this.scene.add.rectangle(x, y, SLOT_WIDTH, SLOT_HEIGHT, 0x0a1018, 0.95);
    bg.setStrokeStyle(1, 0x1a3040, 0.8);
    c.add(bg);

    // Slot number label (always shown)
    const slotLabel = this.scene.add.text(x - SLOT_WIDTH / 2 + 14, y - SLOT_HEIGHT / 2 + 12,
      L(`SLOT ${slotId + 1}`, `اسلات ${slotId + 1}`), fixTextStyle({
        fontFamily: 'monospace', fontSize: '10px', color: '#3a4350', letterSpacing: 1,
      })).setOrigin(0, 0);
    c.add(slotLabel);

    if (profile) {
      // === Slot has data — show profile info + Select + Delete ===
      this.buildOccupiedSlot(slotId, y, profile);
    } else {
      // === Empty slot — show Create button ===
      this.buildEmptySlot(slotId, y);
    }
  }

  /** Build an occupied slot with profile info + Select/Delete buttons. */
  private buildOccupiedSlot(slotId: SlotId, y: number, profile: ProfileSummary): void {
    const c = this.container!;
    const w = GAME.WIDTH;
    const x = w / 2;
    const L = this.L;

    // Profile name
    const nameText = this.scene.add.text(x - SLOT_WIDTH / 2 + 14, y - 20, profile.displayName, fixTextStyle({
      fontFamily: 'monospace', fontSize: '15px', color: '#cfd6e0', stroke: '#000', strokeThickness: 2,
    })).setOrigin(0, 0.5);
    c.add(nameText);

    // Stats line: Level / Kills / Checkpoint
    const statsParts: string[] = [
      `${L('LV', 'سطح')}.${profile.level}`,
      `${L('KILLS', 'کشته')}: ${profile.totalKills}`,
    ];
    if (profile.hasCheckpoint) {
      statsParts.push(L('CHECKPOINT', 'چک‌پوینت'));
    }
    const statsText = this.scene.add.text(x - SLOT_WIDTH / 2 + 14, y + 4, statsParts.join('  ·  '), fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: '#5a6470',
    })).setOrigin(0, 0.5);
    c.add(statsText);

    // Last saved time
    const lastSaved = new Date(profile.lastSavedAt);
    const timeStr = lastSaved.toLocaleDateString(getLocale() === 'fa' ? 'fa-IR' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const timeText = this.scene.add.text(x - SLOT_WIDTH / 2 + 14, y + 24, timeStr, fixTextStyle({
      fontFamily: 'monospace', fontSize: '9px', color: '#3a4350',
    })).setOrigin(0, 0.5);
    c.add(timeText);

    // === Action buttons (right side of card) ===
    const btnX = x + SLOT_WIDTH / 2 - 70;

    // If in confirm-delete mode for this slot, show Confirm/Cancel instead
    if (this.confirmDeleteSlot === slotId) {
      this.nav.makeMenuBtn(btnX, y - 12, L('CONFIRM?', 'تأیید؟'), () => {
        AudioSystem.play('uiClick');
        void this.handleDelete(slotId);
      }, false, 100);
      this.nav.makeMenuBtn(btnX, y + 14, L('CANCEL', 'لغو'), () => {
        AudioSystem.play('uiClick');
        this.confirmDeleteSlot = null;
        this.refresh();
      }, false, 100);
    } else {
      // Select button (cyan accent, brighter than makeMenuBtn default)
      this.makeAccentBtn(btnX, y - 12, L('SELECT', 'انتخاب'), 0x0a1820, 0x39d0d8, '#39d0d8', () => {
        AudioSystem.play('uiClick');
        void this.handleSelect(slotId);
      });
      // Delete button (red accent)
      this.makeAccentBtn(btnX, y + 14, L('DELETE', 'حذف'), 0x180808, 0x401010, '#ff6060', () => {
        AudioSystem.play('uiClick');
        this.confirmDeleteSlot = slotId;
        this.refresh();
      });
    }
  }

  /** Build an empty slot with a Create button. */
  private buildEmptySlot(slotId: SlotId, y: number): void {
    const c = this.container!;
    const w = GAME.WIDTH;
    const x = w / 2;
    const L = this.L;

    // "Empty" indicator
    const emptyText = this.scene.add.text(x, y - 10, L('— EMPTY —', '— خالی —'), fixTextStyle({
      fontFamily: 'monospace', fontSize: '13px', color: '#3a4350', letterSpacing: 2,
    })).setOrigin(0.5);
    c.add(emptyText);

    // Create button (bright cyan to stand out)
    this.makeAccentBtn(x, y + 22, L('+ CREATE NEW', '+ ساخت جدید'), 0x0a1820, 0x39d0d8, '#39d0d8', () => {
      AudioSystem.play('uiClick');
      void this.handleCreate(slotId);
    }, 160);
  }

  /** Helper: create a bright accent button (more visible than makeMenuBtn default). */
  private makeAccentBtn(
    x: number, y: number, label: string,
    bgColor: number, borderColor: number, textColor: string,
    onClick: () => void, width: number = 100,
  ): void {
    const c = this.container!;
    const bg = this.scene.add.rectangle(x, y, width, 28, bgColor, 0.95);
    bg.setStrokeStyle(1, borderColor, 0.9);
    const textEl = this.scene.add.text(x, y, label, fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: textColor, stroke: '#000', strokeThickness: 2,
    })).setOrigin(0.5);
    c.add([bg, textEl]);
    this.nav.addButton(bg, textEl, onClick, x, y);
  }

  /** Handle "Select" button click on an existing profile. */
  private async handleSelect(slotId: SlotId): Promise<void> {
    try {
      await ProfileManager.selectSlot(slotId);
      this.callbacks.onSelect(slotId);
    } catch (err) {
      console.error('[ProfileSelectUI] Failed to select slot:', err);
    }
  }

  /** Handle "Create New" button click on an empty slot. */
  private async handleCreate(slotId: SlotId): Promise<void> {
    try {
      // Create a default save in the specific slot the user clicked.
      const defaultName = `PILOT ${(slotId + 1).toString().padStart(2, '0')}`;
      const saveData = {
        ...DEFAULT_SAVE,
        player: { ...DEFAULT_SAVE.player },
        settings: { ...DEFAULT_SAVE.settings },
        bestBossTimes: {},
        questFlags: {},
        questProgress: {},
        npcFlags: {},
        unlockedAreas: [...DEFAULT_SAVE.unlockedAreas],
        discoveredAreas: [],
        stages: {},
      };
      await ProfileDB.writeProfile(slotId, saveData, defaultName);
      await ProfileManager.selectSlot(slotId);
      this.callbacks.onSelect(slotId);
    } catch (err) {
      console.error('[ProfileSelectUI] Failed to create profile:', err);
    }
  }

  /** Handle "Confirm Delete" button click. */
  private async handleDelete(slotId: SlotId): Promise<void> {
    try {
      await ProfileManager.deleteProfile(slotId);
      this.confirmDeleteSlot = null;
      this.refresh();
    } catch (err) {
      console.error('[ProfileSelectUI] Failed to delete profile:', err);
    }
  }

  /** Rebuild the overlay (after create/delete changes the slot list). */
  private async refresh(): Promise<void> {
    // Preserve confirmDeleteSlot across refresh — it's set when the user
    // clicks DELETE and needs to survive the rebuild so CONFIRM? shows.
    const savedConfirm = this.confirmDeleteSlot;
    this.hideInternal();
    this.confirmDeleteSlot = savedConfirm;
    await this.show();
  }

  /** Hide and destroy the overlay. Resets all state including confirmDeleteSlot. */
  hide(): void {
    this.hideInternal();
    this.confirmDeleteSlot = null;
  }

  /** Internal: destroy container + reset nav, but preserve confirmDeleteSlot. */
  private hideInternal(): void {
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
    this.nav.reset();
  }
  /** Localization helper. */
  private L(en: string, fa: string): string {
    return getLocale() === 'fa' ? fa : en;
  }
}

export default ProfileSelectUI;
