/**
 * MECHA: LAST PROTOCOL — Inventory UI v5.0
 *
 * REDESIGNED: Grid-based inventory with detail panel.
 * Inspired by:
 *   - Armored Core 6: assembly grid, tactical stats panel
 *   - Blasphemous: dark intricate slots, relic display
 *   - Elden Ring: inventory grid with item details
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  ▮ DATA VAULT ▮                       ◆ PROTOCOL SP  │
 *   │  [ARSENAL] [COMPONENTS] [CONSUMABLES] [KEY DATA]     │
 *   │  ┌────────────────────────────┐  ┌────────────────┐ │
 *   │  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐       │  │ TARGET ITEM   │ │
 *   │  │ │  │ │  │ │  │ │  │       │  │ [TIER]        │ │
 *   │  │ └──┘ └──┘ └──┘ └──┘       │  │ Name          │ │
 *   │  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐       │  │ ──────────    │ │
 *   │  │ │  │ │  │ │  │ │  │       │  │ Description   │ │
 *   │  │ └──┘ └──┘ └──┘ └──┘       │  │               │ │
 *   │  │                            │  │ Count: ×5     │ │
 *   │  └────────────────────────────┘  │ [USE/UPGRADE] │ │
 *   │                                  └────────────────┘ │
 *   │              [DISENGAGE]                            │
 *   └──────────────────────────────────────────────────────┘
 */
import Phaser from 'phaser';
import { GAME } from '../../shared/Constants';
import { t, getLocale } from '../../systems/LocalizationSystem';
import { InventorySystem, type InventorySlot } from '../../systems/InventorySystem';
import { WeaponUpgradeSystem } from '../../systems/WeaponUpgradeSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import { getWeapon } from '../../data/weapons/weapons';
import { AudioSystem } from '../../systems/AudioSystem';
import { NavigableOverlay } from '../NavigableOverlay';
import { THEME, addCornerBrackets, addScanlines } from '../Theme';
import type { ItemType, WeaponId } from '../../data/types';

type TabId = 'weapon' | 'material' | 'consumable' | 'key_item';

/** Safely call setColor on a Text object. */
function safeSetColor(text: Phaser.GameObjects.Text | undefined, color: string): void {
  if (!text || !text.active) return;
  const t = text as unknown as { canvas?: HTMLCanvasElement | null };
  if (t.canvas === null) return;
  try { text.setColor(color); } catch { /* canvas not ready */ }
}

const TAB_LABELS: Record<TabId, { en: string; fa: string; icon: string }> = {
  weapon: { en: 'ARSENAL', fa: 'تسلیحات', icon: '▣' },
  material: { en: 'COMPONENTS', fa: 'قطعات', icon: '◆' },
  consumable: { en: 'CONSUMABLES', fa: 'مصرفی', icon: '◉' },
  key_item: { en: 'KEY DATA', fa: 'داده کلیدی', icon: '◈' },
};

// Rarity colors (for item backgrounds)
const RARITY_COLORS: Record<string, number> = {
  common: 0x2a3340,
  uncommon: 0x206040,
  rare: 0x204080,
  epic: 0x402080,
  legendary: 0x806020,
};

// Item icons by type/id (ASCII characters only — monospace safe)
function getItemIcon(slot: InventorySlot, tab: TabId): string {
  if (tab === 'weapon') {
    const weapon = getWeapon(slot.item.id as WeaponId);
    if (weapon) {
      const id = slot.item.id;
      if (id === 'assault_rifle') return '═';
      if (id === 'shotgun') return '▣';
      if (id === 'railgun') return '━';
      if (id === 'plasma_cannon') return '◉';
      if (id === 'laser') return '─';
      if (id === 'rocket') return '◈';
      if (id === 'sword') return '†';
      if (id === 'energy_blade') return '⚡';
    }
    return '▣';
  }
  if (tab === 'material') {
    const id = slot.item.id;
    if (id === 'scrap_metal') return '▣';
    if (id === 'circuit_board') return '⌬';
    if (id === 'armor_plate') return '▦';
    if (id === 'precision_lens') return '◎';
    if (id === 'ai_chip') return '◈';
    if (id === 'elite_core') return '◆';
    if (id === 'guardian_core') return '★';
    if (id === 'overseer_eye') return '◉';
    return '◆';
  }
  if (tab === 'consumable') {
    const id = slot.item.id;
    if (id === 'health_pack') return '♥';
    if (id === 'energy_cell') return '⚡';
    return '◉';
  }
  if (tab === 'key_item') return '◈';
  return '◆';
}

function getItemRarity(slot: InventorySlot, tab: TabId): string {
  if (tab === 'weapon') return 'rare';
  if (tab === 'material') {
    const id = slot.item.id;
    if (id === 'guardian_core' || id === 'overseer_eye') return 'legendary';
    if (id === 'elite_core' || id === 'ai_chip') return 'epic';
    if (id === 'precision_lens' || id === 'armor_plate') return 'rare';
    return 'common';
  }
  if (tab === 'consumable') return 'uncommon';
  if (tab === 'key_item') return 'epic';
  return 'common';
}

interface ItemSlotVisual {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Text;
  countBadge: Phaser.GameObjects.Text;
  rarityRing: Phaser.GameObjects.Polygon;
  slot: InventorySlot;
  allTexts: Phaser.GameObjects.Text[];
  allShapes: Phaser.GameObjects.Shape[];
}

export class InventoryUI extends NavigableOverlay {
  private selectedTab: TabId = 'material';
  private itemSlots: ItemSlotVisual[] = [];
  private tabBgs: Phaser.GameObjects.Rectangle[] = [];
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private tabs: TabId[] = ['material', 'consumable', 'weapon', 'key_item'];
  private isFa: boolean = false;
  private focusedSlotIdx: number = -1;

  // Detail panel
  private detail: {
    name: Phaser.GameObjects.Text;
    tier: Phaser.GameObjects.Text;
    desc: Phaser.GameObjects.Text;
    count: Phaser.GameObjects.Text;
    action: Phaser.GameObjects.Text;
    status: Phaser.GameObjects.Text;
  } | null = null;

  // Grid layout
  private readonly GRID_COLS = 5;
  private readonly SLOT_SIZE = 80;
  private readonly SLOT_GAP = 12;
  private readonly GRID_X = 30;
  private readonly GRID_Y = 170;

  constructor(scene: Phaser.Scene, onBack: () => void) {
    super(scene);
    const w = GAME.WIDTH, h = GAME.HEIGHT;
    this.isFa = getLocale() === 'fa';

    // Background
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, THEME.BG_VOID, 0.95);
    this.container.add(overlay);
    this.container.add(addScanlines(scene, w, h, 0.02));

    // Title
    const titleBg = scene.add.rectangle(w / 2, 45, 400, 44, THEME.BG_PANEL, 0.9);
    titleBg.setStrokeStyle(1, THEME.AMBER, 0.5);
    this.container.add(titleBg);
    this.container.add(addCornerBrackets(scene, w / 2, 45, 400, 44, THEME.AMBER, 8, 0.6));
    this.container.add(scene.add.text(w / 2, 45, this.isFa ? '▮ مخزن داده ▮' : '▮ DATA VAULT ▮', {
      fontFamily: 'monospace', fontSize: '20px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 5, letterSpacing: 3,
    }).setOrigin(0.5));

    // Tabs
    const tabW = 200, tabGap = 10;
    const startX = (w - this.tabs.length * tabW - (this.tabs.length - 1) * tabGap) / 2;
    this.tabs.forEach((tab, i) => {
      const x = startX + i * (tabW + tabGap) + tabW / 2;
      const bg = scene.add.rectangle(x, 105, tabW, 38, THEME.BG_PANEL, 0.92);
      bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
      const lbl = TAB_LABELS[tab];
      const textEl = scene.add.text(x, 105, `${lbl.icon} ${this.isFa ? lbl.fa : lbl.en}`, {
        fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_MED, letterSpacing: 1,
      }).setOrigin(0.5);
      this.container.add([bg, textEl]);
      this.tabBgs.push(bg);
      this.tabTexts.push(textEl);
      this.registerNav(bg, textEl, () => { this.selectedTab = tab; this.refresh(); AudioSystem.play('uiClick'); });
    });

    // Grid background panel
    const gridPanelW = this.GRID_COLS * (this.SLOT_SIZE + this.SLOT_GAP) + this.SLOT_GAP + 20;
    const gridPanelH = 400;
    const gridPanel = scene.add.rectangle(this.GRID_X + gridPanelW / 2 - 10, this.GRID_Y + gridPanelH / 2 - 20, gridPanelW, gridPanelH, THEME.BG_PANEL, 0.5);
    gridPanel.setStrokeStyle(1, THEME.CYAN, 0.4);
    this.container.add(gridPanel);
    this.container.add(addCornerBrackets(scene, this.GRID_X + gridPanelW / 2 - 10, this.GRID_Y + gridPanelH / 2 - 20, gridPanelW, gridPanelH, THEME.CYAN, 8, 0.6));

    // Empty grid scaffold — draw placeholder slots so the grid is visible even when empty
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        const sx = this.GRID_X + col * (this.SLOT_SIZE + this.SLOT_GAP) + this.SLOT_SIZE / 2;
        const sy = this.GRID_Y + row * (this.SLOT_SIZE + this.SLOT_GAP) + this.SLOT_SIZE / 2;
        const placeholder = scene.add.rectangle(sx, sy, this.SLOT_SIZE, this.SLOT_SIZE, THEME.BG_DARK, 0.3);
        placeholder.setStrokeStyle(1, THEME.STROKE_DIM, 0.2);
        this.container.add(placeholder);
      }
    }

    // Detail panel (right side)
    this.buildDetailPanel(scene);

    // Back button
    const bg = scene.add.rectangle(w / 2, h - 30, 220, 40, THEME.BG_PANEL, 0.95);
    bg.setStrokeStyle(1, THEME.CYAN, 0.5);
    this.container.add(addCornerBrackets(scene, w / 2, h - 30, 220, 40, THEME.CYAN, 6, 0.5));
    const textEl = scene.add.text(w / 2, h - 30, this.isFa ? '▲ خروج' : '▲ DISENGAGE', {
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, letterSpacing: 2,
    }).setOrigin(0.5);
    this.container.add([bg, textEl]);
    this.registerNav(bg, textEl, () => { AudioSystem.play('uiClick'); onBack(); });

    this.refresh();
    this.container.setScrollFactor(0, 0, true);
  }

  // ─── Build detail panel (right side) ───────────────────────────────────
  private buildDetailPanel(scene: Phaser.Scene): void {
    const x = GAME.WIDTH - 175;
    const y = 320;
    const w = 220, h = 320;
    const isFa = this.isFa;

    const bg = scene.add.rectangle(x, y, w, h, THEME.BG_PANEL, 0.92);
    bg.setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
    this.container.add(addCornerBrackets(scene, x, y, w, h, THEME.AMBER, 6, 0.5));

    // Title bar
    const titleBar = scene.add.rectangle(x, y - h / 2 + 14, w - 8, 24, THEME.BG_PANEL_HI, 0.9);
    this.container.add(titleBar);
    this.container.add(scene.add.text(x, y - h / 2 + 14, isFa ? 'آیتم هدف' : 'TARGET ITEM', {
      fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_AMBER, letterSpacing: 2,
    }).setOrigin(0.5));

    // Tier/rarity label
    const tier = scene.add.text(x, y - h / 2 + 45, '', {
      fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_MED, letterSpacing: 2,
    }).setOrigin(0.5);

    // Name
    const name = scene.add.text(x, y - h / 2 + 75, '', {
      fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_BRIGHT, stroke: '#000', strokeThickness: 3,
      wordWrap: { width: w - 20 }, align: 'center',
    }).setOrigin(0.5);

    // Divider
    this.container.add(scene.add.rectangle(x, y - 25, w - 30, 1, THEME.STROKE_MED, 0.7));

    // Description
    const desc = scene.add.text(x, y + 5, '', {
      fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_MED,
      wordWrap: { width: w - 20 }, align: 'center', lineSpacing: 3,
    }).setOrigin(0.5);

    // Count
    const count = scene.add.text(x, y + 60, '', {
      fontFamily: 'monospace', fontSize: '12px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    // Action button text
    const action = scene.add.text(x, y + 100, '', {
      fontFamily: 'monospace', fontSize: '11px', color: THEME.TEXT_ACCENT, letterSpacing: 1,
    }).setOrigin(0.5);

    // Status
    const status = scene.add.text(x, y + 130, '', {
      fontFamily: 'monospace', fontSize: '9px', color: THEME.TEXT_DIM, letterSpacing: 1,
    }).setOrigin(0.5);

    this.container.add([bg, titleBar, tier, name, desc, count, action, status]);
    this.detail = { name, tier, desc, count, action, status };
  }

  // ─── Refresh grid ──────────────────────────────────────────────────────
  private refresh(): void {
    // Cleanup old slots
    const oldBgSet = new Set(this.itemSlots.map(s => s.bg));
    this.navElements = this.navElements.filter(el => !oldBgSet.has(el.bg as unknown as Phaser.GameObjects.Rectangle));
    this.itemSlots.forEach(s => {
      s.allShapes.forEach(sh => { if (sh && sh.active) sh.destroy(); });
      s.allTexts.forEach(t => { if (t && t.active) t.destroy(); });
    });
    this.itemSlots = [];

    // Highlight selected tab
    this.tabs.forEach((tab, i) => {
      if (!this.tabBgs[i] || !this.tabTexts[i]) return;
      if (tab === this.selectedTab) {
        this.tabBgs[i].setFillStyle(THEME.BG_PANEL_HI, 1);
        this.tabBgs[i].setStrokeStyle(2, THEME.AMBER, 0.9);
        safeSetColor(this.tabTexts[i], THEME.TEXT_AMBER);
      } else {
        this.tabBgs[i].setFillStyle(THEME.BG_PANEL, 0.92);
        this.tabBgs[i].setStrokeStyle(1, THEME.STROKE_DIM, 0.5);
        safeSetColor(this.tabTexts[i], THEME.TEXT_MED);
      }
    });

    // Get items
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

    if (slots.length === 0) {
      this.container.add(this.scene.add.text(this.GRID_X + 200, 300, this.isFa ? '◇ خالی ◇' : '◇ NO DATA ◇', {
        fontFamily: 'monospace', fontSize: '14px', color: THEME.TEXT_DIM, letterSpacing: 3,
      }).setOrigin(0.5));
      this.updateDetailPanel(null);
      return;
    }

    // Render grid
    slots.forEach((slot, i) => {
      const col = i % this.GRID_COLS;
      const row = Math.floor(i / this.GRID_COLS);
      const x = this.GRID_X + col * (this.SLOT_SIZE + this.SLOT_GAP) + this.SLOT_SIZE / 2;
      const y = this.GRID_Y + row * (this.SLOT_SIZE + this.SLOT_GAP) + this.SLOT_SIZE / 2;

      this.createItemSlot(slot, x, y, i);
    });

    // Auto-focus first slot
    if (this.itemSlots.length > 0) {
      this.focusedSlotIdx = 0;
      this.updateDetailPanel(this.itemSlots[0].slot);
    }

    this.scene.time.delayedCall(0, () => { if (this.isVisible) this.updateNavFocus(); });
  }

  // ─── Create an item slot in the grid ───────────────────────────────────
  private createItemSlot(slot: InventorySlot, x: number, y: number, index: number): void {
    const rarity = getItemRarity(slot, this.selectedTab);
    const rarityColor = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
    const size = this.SLOT_SIZE;
    const allShapes: Phaser.GameObjects.Shape[] = [];
    const allTexts: Phaser.GameObjects.Text[] = [];

    const slotContainer = this.scene.add.container(x, y);

    // Background
    const bg = this.scene.add.rectangle(0, 0, size, size, rarityColor, 0.85);
    bg.setStrokeStyle(2, THEME.STROKE_DIM, 0.6);
    allShapes.push(bg);
    slotContainer.add(bg);

    // Corner accents (Blasphemous style)
    const cs = 6;
    const corners = [
      this.scene.add.polygon(-size / 2, -size / 2, [0, 0, cs, 0, 0, cs], THEME.AMBER, 0.4),
      this.scene.add.polygon(size / 2, -size / 2, [0, 0, -cs, 0, 0, cs], THEME.AMBER, 0.4),
      this.scene.add.polygon(-size / 2, size / 2, [0, 0, cs, 0, 0, -cs], THEME.AMBER, 0.4),
      this.scene.add.polygon(size / 2, size / 2, [0, 0, -cs, 0, 0, -cs], THEME.AMBER, 0.4),
    ];
    corners.forEach(c => allShapes.push(c));
    slotContainer.add(corners);

    // Item icon
    const iconChar = getItemIcon(slot, this.selectedTab);
    const icon = this.scene.add.text(0, -5, iconChar, {
      fontFamily: 'monospace', fontSize: '28px', color: THEME.TEXT_BRIGHT,
    }).setOrigin(0.5);
    allTexts.push(icon);
    slotContainer.add(icon);

    // Count badge (bottom-right)
    const countText = this.selectedTab === 'weapon'
      ? `+${slot.amount}`
      : `×${slot.amount}`;
    const countBadge = this.scene.add.text(size / 2 - 8, size / 2 - 8, countText, {
      fontFamily: 'monospace', fontSize: '10px', color: THEME.TEXT_AMBER, stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 1);
    allTexts.push(countBadge);
    slotContainer.add(countBadge);

    // Slot index (top-left, small)
    const idxText = this.scene.add.text(-size / 2 + 4, -size / 2 + 4, String(index + 1).padStart(2, '0'), {
      fontFamily: 'monospace', fontSize: '8px', color: THEME.TEXT_DIM,
    }).setOrigin(0, 0);
    allTexts.push(idxText);
    slotContainer.add(idxText);

    this.container.add(slotContainer);

    const visual: ItemSlotVisual = {
      container: slotContainer, bg, icon, countBadge,
      rarityRing: corners[0], // reference for nav
      slot, allTexts, allShapes,
    };
    this.itemSlots.push(visual);

    // Interactive
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      this.navFocusIdx = this.navElements.findIndex(e => e.bg === bg);
      if (this.navFocusIdx < 0) this.navFocusIdx = 0;
      this.focusedSlotIdx = index;
      this.updateNavFocus();
      this.updateDetailPanel(slot);
      AudioSystem.play('uiHover');
    });
    bg.on('pointerout', () => this.updateNavFocus());
    bg.on('pointerdown', () => { this.activateSlot(slot); });

    // Insert before back button
    const backIdx = this.navElements.length - 1;
    this.navElements.splice(backIdx, 0, {
      bg: bg as unknown as Phaser.GameObjects.Shape,
      text: icon,
      onSelect: () => this.activateSlot(slot),
      focusColor: THEME.AMBER,
      normalColor: THEME.STROKE_DIM,
    });
  }

  // ─── Activate slot (use/upgrade) ───────────────────────────────────────
  private activateSlot(slot: InventorySlot): void {
    if (this.selectedTab === 'weapon') {
      const weaponId = slot.item.id as WeaponId;
      const info = WeaponUpgradeSystem.getUpgradeInfo(weaponId);
      if (info.canUpgrade) {
        AudioSystem.play('uiClick');
        WeaponUpgradeSystem.upgrade(weaponId);
        this.refresh();
      }
    } else if (this.selectedTab === 'consumable') {
      AudioSystem.play('uiClick');
      InventorySystem.useConsumable(slot.item.id);
      this.refresh();
    }
  }

  // ─── Update detail panel ───────────────────────────────────────────────
  private updateDetailPanel(slot: InventorySlot | null): void {
    if (!this.detail) return;
    const isFa = this.isFa;
    if (!slot) {
      this.detail.name.setText('');
      this.detail.tier.setText('');
      this.detail.desc.setText(isFa ? '◇ آیتمی انتخاب نشده ◇' : '◇ NO ITEM SELECTED ◇');
      this.detail.count.setText('');
      this.detail.action.setText('');
      this.detail.status.setText('');
      return;
    }
    const rarity = getItemRarity(slot, this.selectedTab);
    const rarityLabel = isFa ? {
      common: 'معمولی', uncommon: 'غیرعادی', rare: 'کمیاب', epic: 'حماسی', legendary: 'افسانه‌ای',
    }[rarity] : rarity.toUpperCase();
    safeSetColor(this.detail.name, THEME.TEXT_BRIGHT);
    this.detail.name.setText(t(slot.item.nameKey));
    this.detail.tier.setText(`[ ${rarityLabel} ]`);
    safeSetColor(this.detail.tier, rarity === 'legendary' ? THEME.TEXT_AMBER : rarity === 'epic' ? '#c060ff' : rarity === 'rare' ? '#40c0ff' : THEME.TEXT_MED);
    this.detail.desc.setText(slot.item.descriptionKey ? t(slot.item.descriptionKey) : '');
    const countLabel = this.selectedTab === 'weapon' ? `+${slot.amount}` : `×${slot.amount}`;
    this.detail.count.setText(isFa ? `تعداد: ${countLabel}` : `COUNT: ${countLabel}`);

    // Action
    let actionText = '';
    if (this.selectedTab === 'weapon') {
      const weaponId = slot.item.id as WeaponId;
      const info = WeaponUpgradeSystem.getUpgradeInfo(weaponId);
      if (info.canUpgrade) {
        actionText = isFa ? `▲ ارتقا (${info.scrapNeeded}S)` : `▲ UPGRADE (${info.scrapNeeded}S)`;
      } else if (info.currentLevel < info.maxLevel) {
        actionText = isFa ? `◆ نیاز: ${info.scrapNeeded}S` : `◆ NEEDS: ${info.scrapNeeded}S`;
      } else {
        actionText = isFa ? '★ حداکثر' : '★ MAX LEVEL';
      }
    } else if (this.selectedTab === 'consumable') {
      actionText = isFa ? '▶ استفاده' : '▶ USE';
    }
    this.detail.action.setText(actionText);
    safeSetColor(this.detail.action, this.selectedTab === 'weapon' ? THEME.TEXT_GREEN : THEME.TEXT_ACCENT);

    // Status
    this.detail.status.setText(isFa ? '✓ ذخیره شد' : '✓ STORED');
    safeSetColor(this.detail.status, THEME.TEXT_GREEN);
  }
}

export default InventoryUI;
