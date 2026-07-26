/**
 * MECHA: LAST PROTOCOL — NPC Interaction Controller
 *
 * Manages NPC sprites, name labels, and interaction prompts.
 * Extracted from GameScene to reduce God Object size.
 *
 * Responsibilities:
 *   - spawnNPCs(areaId)              → create mech visuals + name labels
 *   - updatePrompt(player, area)     → show "Press E to interact" near NPCs/lore
 *   - updateLabels()                 → keep labels positioned above NPCs
 *   - cleanup()                      → destroy all visuals + labels + prompt
 *
 * Owns: npcVisuals, npcLabels, npcInteractionPrompt.
 * Dependencies: scene (for add/tweens), player + loadedArea passed per-call.
 */
import Phaser from 'phaser';
import { NPCSystem } from '../systems/NPCSystem';
import { WorldSystem } from './WorldSystem';
import { MechaSpriteFactory, type MechVisualHandle } from '../entities/sprites/MechaSpriteFactory';
import { InputSchemeManager } from '../systems/InputSchemeManager';
import { t, fixTextStyle, getLocale } from '../systems/LocalizationSystem';
import type { LoadedArea } from './AreaLoader';
import type { PlayerEntity } from '../entities/player/PlayerEntity';

export class NpcInteractionController {
  private npcVisuals: Map<string, MechVisualHandle> = new Map();
  private npcLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private interactionPrompt: Phaser.GameObjects.Container | null = null;

  constructor(private scene: Phaser.Scene) {}

  /** Spawn NPC sprites + name labels in the current area. */
  spawnNPCs(areaId: string): void {
    const npcs = NPCSystem.getNPCsInArea(areaId);
    for (const npc of npcs) {
      let visual: MechVisualHandle;
      if (npc.id === 'engineer_kara') {
        visual = MechaSpriteFactory.buildNPC_Kara(this.scene);
      } else if (npc.id === 'ghost_operator') {
        visual = MechaSpriteFactory.buildNPC_GhostOperator(this.scene);
      } else {
        visual = MechaSpriteFactory.buildNPC_Kara(this.scene);
      }
      visual.container.setPosition(npc.x, npc.y);
      this.npcVisuals.set(npc.id, visual);

      // Name label above NPC (faded amber, only visible when near)
      const label = this.scene.add.text(npc.x, npc.y - 40, t(`npc.${npc.id}.name`), fixTextStyle({
        fontFamily: 'monospace', fontSize: '11px', color: '#ffc040',
        stroke: '#000', strokeThickness: 3, letterSpacing: 2,
      })).setOrigin(0.5).setAlpha(0).setDepth(15);
      this.npcLabels.set(npc.id, label);
      this.scene.tweens.add({ targets: label, alpha: { from: 0.3, to: 0.7 }, duration: 1500, yoyo: true, repeat: -1 });
    }
  }

  /** Show a floating "Press E to interact" prompt above the nearest NPC, lore object, or bonfire.
   *
   * Per advisor (A3-final-decisions Point 1, Option A): unified nearest-check
   * across NPC + Lore + Bonfire in a single loop. Only ONE prompt is ever
   * shown at a time — whichever is closest wins. This guarantees that a
   * bonfire placed near an NPC or lore object never produces overlapping
   * floating prompts.
   *
   * Bonfire distance threshold matches BonfireController.BONFIRE_INTERACT_RADIUS (70px).
   */
  updatePrompt(player: PlayerEntity, loadedArea: LoadedArea | null): void {
    if (!player.sprite || !player.sprite.active) return;
    const area = WorldSystem.getCurrentArea();
    if (!area) return;

    // Find nearest interactable — NPCs, then lore objects, then bonfires
    let nearestX = 0, nearestY = 0, nearestKind: 'npc' | 'lore' | 'bonfire' | null = null;
    let nearestDist = 80;  // interaction radius (NPC = 80, Lore = 70, Bonfire = 70)

    // NPCs
    const npcs = NPCSystem.getNPCsInArea(area.id);
    for (const npc of npcs) {
      const dist = Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, npc.x, npc.y);
      if (dist < nearestDist) {
        nearestDist = dist; nearestX = npc.x; nearestY = npc.y - 60; nearestKind = 'npc';
      }
    }

    // Lore objects (terminals / corpses / echoes)
    if (loadedArea) {
      for (const loreObj of loadedArea.loreObjects) {
        if (!loreObj || !loreObj.active) continue;
        const dist = Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, loreObj.x, loreObj.y);
        if (dist < 70) {
          if (dist < nearestDist) {
            nearestDist = dist; nearestX = loreObj.x; nearestY = loreObj.y - 50; nearestKind = 'lore';
          }
        }
      }

      // Bonfires (Dark Souls-style save points) — only containers that are
      // active and marked isBonfire=true. Distance threshold matches
      // BonfireController.BONFIRE_INTERACT_RADIUS (70px).
      for (const bf of loadedArea.bonfires) {
        if (!bf || !bf.active) continue;
        if (bf.getData('isBonfire') !== true) continue;
        const dist = Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, bf.x, bf.y);
        if (dist < 70) {
          if (dist < nearestDist) {
            nearestDist = dist; nearestX = bf.x; nearestY = bf.y - 50; nearestKind = 'bonfire';
          }
        }
      }
    }

    if (nearestKind) {
      if (!this.interactionPrompt) {
        this.interactionPrompt = this.createInteractionPrompt();
      }
      this.interactionPrompt.setPosition(nearestX, nearestY);
      this.interactionPrompt.setVisible(true);
      const txt = this.interactionPrompt.getAt(1) as Phaser.GameObjects.Text;
      if (txt && txt.active) {
        const key = InputSchemeManager.getLabel('interact');
        // Action text per kind: localized via interaction.* keys
        // (added in en.json/fa.json as part of B4 sub-task).
        // Falls back to hardcoded English if key is missing.
        const actionKey = nearestKind === 'npc'
          ? 'interaction.talk'
          : nearestKind === 'lore'
            ? 'interaction.examine'
            : 'interaction.rest';
        const fallback = nearestKind === 'npc'
          ? 'TALK'
          : nearestKind === 'lore'
            ? 'EXAMINE'
            : 'REST';
        const action = t(actionKey) || fallback;
        txt.setText(`[${key}] ${action}`);
      }
    } else if (this.interactionPrompt) {
      this.interactionPrompt.setVisible(false);
    }
  }

  /** Per-frame: keep NPC name labels positioned above their (potentially bobbing) visuals. */
  updateLabels(): void {
    for (const [id, visual] of this.npcVisuals) {
      const label = this.npcLabels.get(id);
      if (!label || !label.active) continue;
      if (visual && visual.container.active) {
        label.setPosition(visual.container.x, visual.container.y - 40);
      }
    }
  }

  /** Destroy all NPC visuals, labels, and interaction prompt. */
  cleanup(): void {
    this.npcVisuals.forEach(v => v?.destroy());
    this.npcVisuals.clear();
    this.npcLabels.forEach(l => { if (l && l.active) l.destroy(); });
    this.npcLabels.clear();
    if (this.interactionPrompt) { this.interactionPrompt.destroy(); this.interactionPrompt = null; }
  }

  /** Create a floating interaction prompt (dynamic scheme, Persian-aware). */
  private createInteractionPrompt(): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0).setDepth(16);
    const bg = this.scene.add.rectangle(0, 0, 90, 22, 0x0a0d14, 0.92);
    bg.setStrokeStyle(1, 0xffc040, 0.8);
    c.add(bg);
    const key = InputSchemeManager.getLabel('interact');
    // Initial text uses interaction.talk key (matches NPC default); text is
    // re-set per-frame in updatePrompt based on nearest kind (npc/lore/bonfire).
    const action = t('interaction.talk') || (getLocale() === 'fa' ? 'صحبت' : 'TALK');
    const txt = this.scene.add.text(0, 0, `[${key}] ${action}`, fixTextStyle({
      fontFamily: 'monospace', fontSize: '11px', color: '#ffc040', stroke: '#000', strokeThickness: 2,
    })).setOrigin(0.5);
    c.add(txt);
    this.scene.tweens.add({ targets: c, y: '-=4', duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return c;
  }
}

export default NpcInteractionController;
