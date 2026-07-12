/**
 * MECHA: LAST PROTOCOL — Inventory UI v3.2
 * Tabbed view: Weapons, Materials, Consumables, Key Items.
 * Full gamepad navigation: up/down items, left/right tabs, A to use/upgrade.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { InventorySystem, type InventorySlot } from '../../systems/InventorySystem';
import { WeaponUpgradeSystem } from '../../systems/WeaponUpgradeSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { getWeapon } from '../../data/weapons/weapons';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import type { ItemType, WeaponId } from '../../data/types';

type TabId = 'weapon' | 'material' | 'consumable' | 'key_item';

/** Safely call setColor on a Text object (see SkillTreeUI for details). */
function safeSetColor(text: Phaser.GameObjects.Text | undefined, color: string): void {
  if (!text || !text.active) return;
  const t = text as unknown as { canvas?: HTMLCanvasElement | null };
  if (t.canvas === null) return;
  try { text.setColor(color); } catch { /* canvas not ready */ }
}

const TAB_LABELS: Record<TabId, string> = {
  weapon: '⚔ Weapons',
  material: '🔩 Materials',
  consumable: '💊 Consumables',
  key_item: '🔑 Key Items',
};

export class InventoryUI extends NavigableOverlay {
  private selectedTab: TabId = 'material';
  private itemSlots: Phaser.GameObjects.Container[] = [];
  private tabBgs: Phaser.GameObjects.Rectangle[] = [];
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private tabs: TabId[] = ['material', 'consumable', 'weapon', 'key_item'];
  private currentSlots: InventorySlot[] = [];
  private actionButtons: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; action: () => void }[] = [];

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.9);
    this.container.add(overlay);

    this.container.add(scene.add.text(w / 2, 40, 'INVENTORY', {
      fontFamily: 'monospace', fontSize: '28px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    // Tabs
    const tabW = 200, tabGap = 10;
    const startX = (w - this.tabs.length * tabW - (this.tabs.length - 1) * tabGap) / 2;
    this.tabs.forEach((tab, i) => {
      const x = startX + i * (tabW + tabGap) + tabW / 2;
      const bg = scene.add.rectangle(x, 100, tabW, 36, 0x1a2030, 0.95);
      bg.setStrokeStyle(1, 0x3a4350);
      const textEl = scene.add.text(x, 100, TAB_LABELS[tab], {
        fontFamily: 'monospace', fontSize: '11px', color: '#cfd6e0',
      }).setOrigin(0.5);
      this.container.add([bg, textEl]);
      this.tabBgs.push(bg);
      this.tabTexts.push(textEl);
      // Register tab for nav (but tab switching is handled by onNavLeft/onNavRight)
      this.registerNav(bg, textEl, () => { this.selectedTab = tab; this.refresh(); AudioSystem.play('uiClick'); });
    });

    this.refresh();

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 40, 280, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    const textEl = scene.add.text(w / 2, h - 40, t('menu.back'), {
      fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0',
    }).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); onBack(); });
  }

  private refresh(): void {
    // Remove old action button nav elements FIRST (keep tabs + back), then destroy.
    // Guards against double-destroy with itemSlots.
    const tabSet = new Set(this.tabBgs);
    this.navElements = this.navElements.filter((el, idx, arr) => {
      const isTab = tabSet.has(el.bg as Phaser.GameObjects.Rectangle);
      const isBack = idx === arr.length - 1;
      if (!isTab && !isBack) {
        if (el.bg && el.bg.active) el.bg.destroy();
        if (el.text && el.text.active) el.text.destroy();
        return false;
      }
      return true;
    });
    // Destroy old item slot containers (their children already destroyed above if they were nav elements)
    this.itemSlots.forEach(s => {
      if (s && s.active) s.destroy();
    });
    this.itemSlots = [];
    this.actionButtons = [];

    // Highlight selected tab — use safe setColor
    this.tabs.forEach((tab, i) => {
      if (!this.tabBgs[i] || !this.tabTexts[i]) return;
      if (tab === this.selectedTab) {
        this.tabBgs[i].setFillStyle(0x243040, 1);
        this.tabBgs[i].setStrokeStyle(2, 0x66f0ff, 1);
        safeSetColor(this.tabTexts[i], '#66f0ff');
      } else {
        this.tabBgs[i].setFillStyle(0x1a2030, 0.95);
        this.tabBgs[i].setStrokeStyle(1, 0x3a4350);
        safeSetColor(this.tabTexts[i], '#cfd6e0');
      }
    });

    // Get items for selected tab
    let slots: InventorySlot[] = [];
    if (this.selectedTab === 'weapon') {
      const save = SaveSystem.getPlayer();
      const mapped = save.unlockedWeapons.map((id: string) => {
        const weapon = getWeapon(id as WeaponId);
        if (!weapon) return null;
        const slot: InventorySlot = {
          item: { ...weapon, type: 'material' as ItemType, stackable: false, maxStack: 1, nameKey: weapon.nameKey, descriptionKey: '' },
          amount: save.weaponLevels[id] ?? 1,
        };
        return slot;
      }).filter((s: InventorySlot | null): s is InventorySlot => s !== null);
      slots = mapped;
    } else {
      slots = InventorySystem.getByType(this.selectedTab as ItemType);
    }
    this.currentSlots = slots;

    if (slots.length === 0) {
      this.container.add(this.scene.add.text(GAME.WIDTH / 2, 300, '— EMPTY —', {
        fontFamily: 'monospace', fontSize: '14px', color: '#3a4350',
      }).setOrigin(0.5));
      return;
    }

    // Render item cards
    const w = GAME.WIDTH;
    const startY = 160;
    const cardH = 60;
    const gap = 6;
    slots.forEach((slot, i) => {
      const y = startY + i * (cardH + gap);
      const slotContainer = this.scene.add.container(w / 2, y);
      const cardBg = this.scene.add.rectangle(0, 0, w - 120, cardH, 0x1a2030, 0.95);
      cardBg.setStrokeStyle(1, 0x3a4350, 0.5);
      slotContainer.add(cardBg);

      const name = this.selectedTab === 'weapon'
        ? `${t(slot.item.nameKey)} +${slot.amount}`
        : `${t(slot.item.nameKey)} ×${slot.amount}`;
      const nameText = this.scene.add.text(-w / 2 + 80, -16, name, {
        fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0',
      }).setOrigin(0, 0);
      slotContainer.add(nameText);

      if (slot.item.descriptionKey) {
        slotContainer.add(this.scene.add.text(-w / 2 + 80, 2, t(slot.item.descriptionKey), {
          fontFamily: 'monospace', fontSize: '10px', color: '#5a6470',
        }).setOrigin(0, 0));
      }

      this.container.add(slotContainer);
      this.itemSlots.push(slotContainer);

      // Action button (upgrade/use)
      if (this.selectedTab === 'weapon') {
        const weaponId = slot.item.id as WeaponId;
        const info = WeaponUpgradeSystem.getUpgradeInfo(weaponId);
        if (info.canUpgrade) {
          const btnBg = this.scene.add.rectangle(w / 2 - 100, y, 130, 28, 0x1a3020, 0.95);
          btnBg.setStrokeStyle(1, 0x40d070, 0.7);
          const btnText = this.scene.add.text(w / 2 - 100, y, `UPGRADE +${info.scrapNeeded}S`, {
            fontFamily: 'monospace', fontSize: '9px', color: '#40d070',
          }).setOrigin(0.5);
          this.container.add([btnBg, btnText]);
          const action = () => { if (WeaponUpgradeSystem.upgrade(weaponId)) { this.refresh(); } };
          this.actionButtons.push({ bg: btnBg, text: btnText, action });
          this.registerNav(btnBg, btnText, () => { AudioSystem.play('uiClick'); action(); });
        }
      } else if (this.selectedTab === 'consumable') {
        const btnBg = this.scene.add.rectangle(w / 2 - 80, y, 80, 28, 0x1a2030, 0.95);
        btnBg.setStrokeStyle(1, 0x39d0d8, 0.6);
        const btnText = this.scene.add.text(w / 2 - 80, y, 'USE', {
          fontFamily: 'monospace', fontSize: '10px', color: '#39d0d8',
        }).setOrigin(0.5);
        this.container.add([btnBg, btnText]);
        const action = () => { InventorySystem.useConsumable(slot.item.id); this.refresh(); };
        this.actionButtons.push({ bg: btnBg, text: btnText, action });
        this.registerNav(btnBg, btnText, () => { AudioSystem.play('uiClick'); action(); });
      }

      // Card itself is also focusable (for weapons without upgrade button, materials, key items)
      if (this.selectedTab === 'material' || this.selectedTab === 'key_item' ||
          (this.selectedTab === 'weapon' && !WeaponUpgradeSystem.getUpgradeInfo(slot.item.id as WeaponId).canUpgrade)) {
        this.registerNav(cardBg, nameText, () => { /* view only — no action */ });
      }
    });
  }

  /** Left/right switches tabs. */
  protected onNavLeft(): void {
    const idx = this.tabs.indexOf(this.selectedTab);
    this.selectedTab = this.tabs[(idx - 1 + this.tabs.length) % this.tabs.length];
    this.refresh();
    AudioSystem.play('uiClick');
    this.navFocusIdx = 0;
    // Defer to next frame — Text objects need a frame to init canvas
    this.scene.time.delayedCall(0, () => { if (this.isVisible) this.updateNavFocus(); });
  }

  protected onNavRight(): void {
    const idx = this.tabs.indexOf(this.selectedTab);
    this.selectedTab = this.tabs[(idx + 1) % this.tabs.length];
    this.refresh();
    AudioSystem.play('uiClick');
    this.navFocusIdx = 0;
    this.scene.time.delayedCall(0, () => { if (this.isVisible) this.updateNavFocus(); });
  }
}

export default InventoryUI;
