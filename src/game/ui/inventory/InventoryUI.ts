/**
 * MECHA: LAST PROTOCOL — Inventory UI
 * Tabbed view: Weapons, Materials, Consumables, Key Items.
 * Shows item name, description, amount.
 * Weapons show upgrade level + upgrade button.
 * Depth 250.
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t } from '../../systems/LocalizationSystem';
import { InventorySystem, type InventorySlot } from '../../systems/InventorySystem';
import { WeaponUpgradeSystem } from '../../systems/WeaponUpgradeSystem';
import { AudioSystem } from '../../systems/AudioSystem';
import type { ItemType } from '../../data/types';

type TabId = 'weapon' | 'material' | 'consumable' | 'key_item';

const TAB_LABELS: Record<TabId, string> = {
  weapon: '⚔ Weapons',
  material: '🔩 Materials',
  consumable: '💊 Consumables',
  key_item: '🔑 Key Items',
};

export class InventoryUI {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private selectedTab: TabId = 'material';
  private itemSlots: Phaser.GameObjects.Container[] = [];
  private tabButtons: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, onBack: () => void) {
    this.scene = scene;
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.9);
    // NO setInteractive — was blocking mouse clicks on buttons underneath
    this.container.add(overlay);

    this.container.add(scene.add.text(w / 2, 40, 'INVENTORY', {
      fontFamily: 'monospace', fontSize: '28px', color: '#39d0d8', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    // Tabs
    const tabs: TabId[] = ['material', 'consumable', 'weapon', 'key_item'];
    const tabW = 200, tabGap = 10;
    const startX = (w - tabs.length * tabW - (tabs.length - 1) * tabGap) / 2;
    tabs.forEach((tab, i) => {
      const x = startX + i * (tabW + tabGap) + tabW / 2;
      const bg = scene.add.rectangle(x, 100, tabW, 36, 0x1a2030, 0.95);
      bg.setStrokeStyle(1, 0x3a4350);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => { this.selectedTab = tab; this.refresh(); AudioSystem.play('uiClick'); });
      const textEl = scene.add.text(x, 100, TAB_LABELS[tab], {
        fontFamily: 'monospace', fontSize: '11px', color: '#cfd6e0',
      }).setOrigin(0.5);
      this.container.add([bg, textEl]);
      this.tabButtons.push(bg);
    });

    this.refresh();

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 40, 280, 44, 0x1a2030, 0.95);
    bg.setStrokeStyle(1, 0x39d0d8, 0.6);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => { AudioSystem.play('uiClick'); onBack(); });
    this.container.add(bg);
    this.container.add(scene.add.text(w / 2, h - 40, t('menu.back'), { fontFamily: 'monospace', fontSize: '16px', color: '#cfd6e0' }).setOrigin(0.5));
  }

  private refresh(): void {
    // Destroy old slots
    this.itemSlots.forEach(s => s.destroy());
    this.itemSlots = [];

    // Highlight selected tab
    const tabs: TabId[] = ['material', 'consumable', 'weapon', 'key_item'];
    this.tabButtons.forEach((bg, i) => {
      if (tabs[i] === this.selectedTab) {
        bg.setFillStyle(0x243040, 1);
        bg.setStrokeStyle(2, 0x66f0ff, 1);
      } else {
        bg.setFillStyle(0x1a2030, 0.95);
        bg.setStrokeStyle(1, 0x3a4350);
      }
    });

    // Get items for selected tab
    let slots: InventorySlot[] = [];
    if (this.selectedTab === 'weapon') {
      // Weapons are special — show from save data
      const save = require('../../systems/SaveSystem').SaveSystem.getPlayer();
      const { getWeapon } = require('../../data/weapons/weapons');
      slots = save.unlockedWeapons.map((id: string) => {
        const weapon = getWeapon(id);
        return weapon ? { item: { ...weapon, type: 'material' as ItemType, stackable: false, maxStack: 1, nameKey: weapon.nameKey, descriptionKey: '' }, amount: save.weaponLevels[id] ?? 1 } : null;
      }).filter((s: InventorySlot | null): s is InventorySlot => s !== null);
    } else {
      slots = InventorySystem.getByType(this.selectedTab as ItemType);
    }

    if (slots.length === 0) {
      const empty = this.scene.add.text(GAME.WIDTH / 2, 300, '— EMPTY —', {
        fontFamily: 'monospace', fontSize: '14px', color: '#3a4350',
      }).setOrigin(0.5);
      this.container.add(empty);
      this.itemSlots.push(this.scene.add.container(0, 0)); // placeholder
      empty.destroy();
      return;
    }

    // Render item cards
    const w = GAME.WIDTH;
    const startY = 150;
    const cardH = 70;
    const gap = 8;
    slots.forEach((slot, i) => {
      const y = startY + i * (cardH + gap);
      const slotContainer = this.scene.add.container(w / 2, y);
      const bg = this.scene.add.rectangle(0, 0, w - 120, cardH, 0x1a2030, 0.95);
      bg.setStrokeStyle(1, 0x3a4350, 0.5);
      slotContainer.add(bg);

      // Name
      const name = this.selectedTab === 'weapon'
        ? `${t(slot.item.nameKey)} +${slot.amount}`
        : `${t(slot.item.nameKey)} ×${slot.amount}`;
      slotContainer.add(this.scene.add.text(-w / 2 + 80, -20, name, {
        fontFamily: 'monospace', fontSize: '13px', color: '#cfd6e0',
      }).setOrigin(0, 0));

      // Description
      if (slot.item.descriptionKey) {
        slotContainer.add(this.scene.add.text(-w / 2 + 80, 0, t(slot.item.descriptionKey), {
          fontFamily: 'monospace', fontSize: '10px', color: '#5a6470',
        }).setOrigin(0, 0));
      }

      // Upgrade button for weapons
      if (this.selectedTab === 'weapon') {
        const weaponId = slot.item.id as import('../../data/types').WeaponId;
        const info = WeaponUpgradeSystem.getUpgradeInfo(weaponId);
        if (info.canUpgrade) {
          const upgradeBtn = this.scene.add.rectangle(w / 2 - 100, 0, 120, 30, 0x1a3020, 0.95);
          upgradeBtn.setStrokeStyle(1, 0x40d070, 0.7);
          upgradeBtn.setInteractive({ useHandCursor: true });
          upgradeBtn.on('pointerdown', () => {
            if (WeaponUpgradeSystem.upgrade(weaponId)) { this.refresh(); }
          });
          slotContainer.add(upgradeBtn);
          slotContainer.add(this.scene.add.text(w / 2 - 100, 0, `UPGRADE +${info.scrapNeeded}S +${info.circuitNeeded}C`, {
            fontFamily: 'monospace', fontSize: '9px', color: '#40d070',
          }).setOrigin(0.5));
        } else if (info.currentLevel < info.maxLevel) {
          slotContainer.add(this.scene.add.text(w / 2 - 100, 0, `NEED +${info.scrapNeeded}S +${info.circuitNeeded}C`, {
            fontFamily: 'monospace', fontSize: '9px', color: '#3a4350',
          }).setOrigin(0.5));
        } else {
          slotContainer.add(this.scene.add.text(w / 2 - 100, 0, 'MAX LEVEL', {
            fontFamily: 'monospace', fontSize: '9px', color: '#ffe060',
          }).setOrigin(0.5));
        }
      }

      // Use button for consumables
      if (this.selectedTab === 'consumable') {
        const useBtn = this.scene.add.rectangle(w / 2 - 80, 0, 80, 30, 0x1a2030, 0.95);
        useBtn.setStrokeStyle(1, 0x39d0d8, 0.6);
        useBtn.setInteractive({ useHandCursor: true });
        useBtn.on('pointerdown', () => { InventorySystem.useConsumable(slot.item.id); this.refresh(); });
        slotContainer.add(useBtn);
        slotContainer.add(this.scene.add.text(w / 2 - 80, 0, 'USE', {
          fontFamily: 'monospace', fontSize: '10px', color: '#39d0d8',
        }).setOrigin(0.5));
      }

      this.container.add(slotContainer);
      this.itemSlots.push(slotContainer);
    });
  }

  show(): void { this.container.setVisible(true); this.refresh(); }
  hide(): void { this.container.setVisible(false); }
  get isVisible(): boolean { return this.container.visible; }

  destroy(): void { this.container.destroy(); }
}

export default InventoryUI;
