// Standalone one-liner to seed a Wastes profile in IndexedDB.
// Copy-paste this into the browser devtools console (after game loads).
// It creates a profile on slot 1 with Act II (Wastes) unlocked + checkpoint
// at section 1, so you can immediately enter Wastes via CONTINUE.

(() => {
  return new Promise((resolve) => {
    const req = indexedDB.open('mecha_last_protocol');
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(['profiles', 'global'], 'readwrite');
      const profStore = tx.objectStore('profiles');
      const globalStore = tx.objectStore('global');
      const profile = {
        slotId: 1,
        saveData: {
          version: 4,
          player: {
            x: 200, y: 420, facingRight: true,
            health: 150, maxHealth: 150, energy: 100, maxEnergy: 100,
            xp: 0, level: 1, skillPoints: 0, totalKills: 0,
            inventory: {}, equippedWeapon: 'assault_rifle',
            weaponUpgrades: { assault_rifle: 1 },
            unlockedAbilities: [], unlockedWeapons: ['assault_rifle'],
            activeQuests: [], completedQuests: [],
          },
          checkpoint: {
            actId: 2,
            regionId: 'wastes',
            areaId: 'drowned_wastes_1',
            section: 1,
            x: 200, y: 420,
            timestamp: Date.now(),
          },
          bestBossTimes: {},
          settings: { quality: 'high', locale: 'en', sfxVolume: 0.7, musicVolume: 0.5, gamepadCursorSpeed: 5 },
          questFlags: {},
          questProgress: {},
          npcFlags: {},
          unlockedAreas: ['abandoned_factory', 'toxic_forest', 'drowned_wastes_1'],
          discoveredAreas: ['abandoned_factory', 'toxic_forest', 'drowned_wastes_1'],
        },
        meta: {
          name: 'PILOT 01',
          createdAt: Date.now(),
          lastPlayedAt: Date.now(),
        },
      };
      profStore.put(profile);
      globalStore.put({ key: 'selectedSlot', value: 1 });
      tx.oncomplete = () => resolve('Profile seeded on slot 1. Reload page then click CONTINUE.');
      tx.onerror = () => resolve('Error: ' + tx.error?.message);
    };
    req.onerror = () => resolve('Open DB failed');
  });
})();
