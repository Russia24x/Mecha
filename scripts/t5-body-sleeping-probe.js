// T5: Body Sleeping Behavior Probe
// Paste this into browser devtools console (F12) while in Wastes gameplay.
// It checks whether bodies actually stay asleep after PlayController.runCulling
// calls Body.set(body, 'isSleeping', true).
//
// What it does:
// 1. Finds the GameScene via window.__MECHA_GAME__
// 2. Reads loadedArea.solids (physics bodies)
// 3. Counts how many are currently isSleeping=true vs false
// 4. Reads camera position
// 5. Reads body.body fields (speed, motion, sleepCounter) to verify they
//    were properly reset by Sleeping.set (not stale from direct mutation)
//
// Run twice: once near section 1 (camera x=0), once after scrolling to
// section 5+ (camera x=6000+). The off-screen bodies should be sleeping
// with speed=0, motion=0, sleepCounter=sleepThreshold.

(() => {
  const g = window.__MECHA_GAME__;
  if (!g) return '❌ window.__MECHA_GAME__ not found — game not loaded';
  const scene = g.scene.keys['GameScene'] || g.scene.scenes[0];
  if (!scene) return '❌ No GameScene found';
  if (scene.state !== 'play') return `❌ Not in play state (current: ${scene.state}). Enter Wastes first.`;

  const la = scene.loadedArea;
  if (!la) return '❌ No loadedArea';

  const cam = scene.cameras.main;
  const camX = cam.scrollX;
  const camW = cam.width;
  const margin = 200;
  const viewLeft = camX - margin;
  const viewRight = camX + camW + margin;

  let sleeping = 0, awake = 0;
  let sleepingWithStaleSpeed = 0;  // bodies that are sleeping but speed != 0 (BUG indicator)
  let sleepingWithStaleMotion = 0;  // bodies that are sleeping but motion != 0 (BUG indicator)
  let sleepingWithZeroSleepCounter = 0;  // bodies sleeping but sleepCounter=0 (was direct mutation, not Sleeping.set)
  const samples = [];

  for (const body of la.solids) {
    if (!body || !body.active) continue;
    const mb = body.body;
    if (!mb) continue;
    const bx = body.x;
    const offscreen = bx < viewLeft || bx > viewRight;

    if (mb.isSleeping) {
      sleeping++;
      // Check if fields were properly reset by Sleeping.set
      // Sleeping.set sets: speed=0, angularSpeed=0, motion=0, sleepCounter=sleepThreshold
      if (mb.speed !== 0) {
        sleepingWithStaleSpeed++;
        if (samples.length < 3) samples.push({ x: bx, sleeping: true, speed: mb.speed, motion: mb.motion, sleepCounter: mb.sleepCounter, offscreen });
      }
      if (mb.motion !== 0) {
        sleepingWithStaleMotion++;
        if (samples.length < 3) samples.push({ x: bx, sleeping: true, speed: mb.speed, motion: mb.motion, sleepCounter: mb.sleepCounter, offscreen });
      }
      if (mb.sleepCounter === 0) {
        sleepingWithZeroSleepCounter++;
      }
    } else {
      awake++;
    }
  }

  // Also check hazard + section triggers
  let hazardsSleeping = 0, hazardsAwake = 0;
  for (const body of la.hazardTriggers) {
    if (!body || !body.active) continue;
    const mb = body.body;
    if (!mb) continue;
    if (mb.isSleeping) hazardsSleeping++; else hazardsAwake++;
  }
  let sectionsSleeping = 0, sectionsAwake = 0;
  for (const body of la.sectionTriggers) {
    if (!body || !body.active) continue;
    const mb = body.body;
    if (!mb) continue;
    if (mb.isSleeping) sectionsSleeping++; else sectionsAwake++;
  }

  const total = sleeping + awake;
  const result = {
    camera: { scrollX: camX.toFixed(0), width: camW, viewLeft: viewLeft.toFixed(0), viewRight: viewRight.toFixed(0) },
    solids: {
      total,
      sleeping,
      awake,
      sleepingPct: total > 0 ? `${(sleeping / total * 100).toFixed(1)}%` : '0%',
      // BUG indicators (should all be 0 if Body.set is working):
      sleepingWithStaleSpeed,        // non-zero = direct mutation happened (pre-fix bug)
      sleepingWithStaleMotion,       // non-zero = direct mutation happened
      sleepingWithZeroSleepCounter,  // non-zero = Sleeping.set not called properly
      samples,
    },
    hazards: { sleeping: hazardsSleeping, awake: hazardsAwake },
    sections: { sleeping: sectionsSleeping, awake: sectionsAwake },
    verdict: sleepingWithStaleSpeed === 0 && sleepingWithStaleMotion === 0 && sleepingWithZeroSleepCounter === 0
      ? '✅ PASS: All sleeping bodies have properly reset fields (Body.set is working correctly)'
      : '⚠️ INVESTIGATE: Some sleeping bodies have stale fields — Body.set may not be dispatching to Sleeping.set',
  };

  console.log('T5 Body Sleeping Probe:', JSON.stringify(result, null, 2));
  return result.verdict;
})();
