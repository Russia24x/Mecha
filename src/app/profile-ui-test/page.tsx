'use client';

import { useEffect, useRef } from 'react';

/**
 * Phase 5 ProfileSelectUI Visual Verification
 *
 * Creates a minimal Phaser scene that instantiates ProfileSelectUI and
 * shows the overlay. This lets us visually verify the UI renders correctly
 * and interactions (create/select/delete) work in a real browser.
 *
 * Temporary — will be deleted in Phase 7 cleanup.
 */

export default function ProfileUITestPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let game: any = null;

    (async () => {
      const Phaser = (await import('phaser')).default;
      const { MenuNavHelper } = await import('@/game/ui/shared/MenuNavHelper');
      const { ProfileSelectUI } = await import('@/game/ui/profile/ProfileSelectUI');
      const { ProfileManager } = await import('@/game/systems/ProfileManager');
      const { SaveSystem } = await import('@/game/systems/SaveSystem');
      const { OverlayManager } = await import('@/game/ui/OverlayManager');
      const { GAME } = await import('@/game/shared/Constants');

      if (destroyed || !containerRef.current) return;

      // Pre-populate with a test profile so we can see occupied + empty slots
      await ProfileManager._wipeAll();
      await ProfileManager.init();
      const { DEFAULT_SAVE } = await import('@/game/systems/ProfileManager');
      const { ProfileDB } = await import('@/game/systems/ProfileDB');
      const testSave = {
        ...DEFAULT_SAVE,
        player: { ...DEFAULT_SAVE.player, level: 7, totalKills: 53 },
        settings: { ...DEFAULT_SAVE.settings },
        checkpoint: { actId: 1, regionId: 'r1', areaId: 'abandoned_factory', section: 2, x: 100, y: 200, timestamp: Date.now() },
        stages: {},
      };
      await ProfileDB.writeProfile(0, testSave, 'ALPHA');
      await ProfileDB.writeProfile(2, { ...DEFAULT_SAVE, player: { ...DEFAULT_SAVE.player, level: 1, totalKills: 0 }, settings: { ...DEFAULT_SAVE.settings }, stages: {} }, 'GAMMA');

      class TestScene extends Phaser.Scene {
        private nav!: InstanceType<typeof MenuNavHelper>;
        private profileUI!: InstanceType<typeof ProfileSelectUI>;

        constructor() {
          super({ key: 'TestScene' });
        }

        create() {
          console.log('[TestScene] create() called');
          this.cameras.main.setBackgroundColor('#040814');
          const container = this.add.container(0, 0);

          // Create the shared UIController (required for MenuNavHelper to register buttons)
          OverlayManager.createSharedController(this, container);
          console.log('[TestScene] Shared UIController created');

          // Pass the SAME container to MenuNavHelper so buttons are in the
          // same display list that UIController manages.
          this.nav = new MenuNavHelper(this, container);
          console.log('[TestScene] MenuNavHelper created');

          this.profileUI = new ProfileSelectUI(this, this.nav, {
            onSelect: async (slotId) => {
              // eslint-disable-next-line no-console
              console.log('[TestScene] Selected slot:', slotId);
              await SaveSystem.init();
              this.profileUI.hide();
            },
            onBack: () => {
              console.log('[TestScene] Back clicked');
              this.profileUI.hide();
            },
          });
          console.log('[TestScene] ProfileSelectUI created, calling show()...');

          this.profileUI.show().then(() => {
            console.log('[TestScene] ProfileSelectUI.show() completed');
          }).catch((err) => {
            console.error('[TestScene] ProfileSelectUI.show() failed:', err);
          });
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: GAME.WIDTH,
        height: GAME.HEIGHT,
        parent: containerRef.current,
        backgroundColor: '#040814',
        scene: [TestScene],
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      });
    })();

    return () => {
      destroyed = true;
      game?.destroy();
    };
  }, []);

  return (
    <div style={{ padding: '20px', background: '#0a0e14', minHeight: '100vh' }}>
      <h1 style={{ color: '#39d0d8', fontFamily: 'monospace', marginBottom: '10px' }}>
        Phase 5 ProfileSelectUI Visual Test
      </h1>
      <p style={{ color: '#5a6470', fontFamily: 'monospace', fontSize: '12px', marginBottom: '15px' }}>
        Pre-populated: Slot 0 = ALPHA (LV.7, 53 kills, checkpoint), Slot 1 = empty, Slot 2 = GAMMA (LV.1, 0 kills)
        <br />
        Click SELECT / CREATE / DELETE to test interactions. Open console for logs.
      </p>
      <div
        ref={containerRef}
        style={{
          border: '1px solid #1a3040',
          background: '#040814',
          display: 'inline-block',
        }}
      />
    </div>
  );
}
