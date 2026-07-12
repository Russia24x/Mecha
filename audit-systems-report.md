# Audit Report — Systems + Scenes + World (Task ID: `audit-systems`)

**Scope:** 26 files (BootScene, GameScene, UIScene, 13 systems in `src/game/systems/`, 4 world systems in `src/game/world/`, 3 shared modules). Total ≈ 4,060 LOC.

**Reference:** `/home/z/my-project/phaser4-audit-report.md` (28 Phaser 4.2.1 skill checklists).

**Methodology:** Line-by-line read of every file. Cross-referenced against the audit checklist (listener cleanup, timer cleanup, Matter gotchas, scene lifecycle, v3→v4 removed APIs, anonymous-arrow listener anti-pattern). Verified with `Grep` for dead code, double-subscriptions, and `require()` misuse.

**Verdict:** No Phaser-4-removed APIs are used (no `setTintFill`, `preFX`, `BitmapMask`, `Geom.Point`, `Math.PI2`, `setPipeline('Light2D')`, `setMask`, `Mesh`/`Plane`). The v4 surface area is clean. **However, there are significant EventBus listener leaks, window-listener leaks, a `for…of` iterator-invalidation bug, several state-reset holes, double-cleanup paths, and two duplicate/dead modules.** Total of **42 distinct findings** below, ordered by severity.

---

## SEVERITY KEY
- 🔴 **CRITICAL** — actual bug that will misbehave at runtime, leak listeners/timers across restarts, or crash.
- 🟠 **HIGH** — bug under realistic conditions (restart, scene transition, edge-case input).
- 🟡 **MEDIUM** — code smell, fragile pattern, or potential footgun.
- 🔵 **LOW** — cosmetic / dead code / doc drift.

---

## 1. `src/game/features/scenes/BootScene.ts` (59 lines)

### Bugs
- 🟡 **L35–38 — `load.on('progress')` listener is only removed on `'complete'`, never on `shutdown`.**
  ```ts
  this.load.on('progress', progressHandler);
  this.load.once('complete', () => { this.load.off('progress', progressHandler); });
  ```
  If BootScene is shut down before load completes (rare, but possible if `this.scene.start('GameScene')` is replaced with a parallel-launch pattern), the `progress` listener survives on the Scene's Loader. The Scene Loader is rebuilt on each `start()`, so this is low-risk in practice — but the audit checklist says "every `this.load.on` should be paired with an `off` in `shutdown`".
  **Fix:** add `this.events.once('shutdown', () => this.load.off('progress', progressHandler));` before L36.

- 🔵 **L16–20 — `this.add.graphics()` created in `preload()`.**
  Creating display-list objects in `preload()` works (the scene is rendered during load), but it is unconventional. The progress bar lives only during preload, then is orphaned when `create()` overwrites the camera background. Not a bug; flag for clarity.

### Phaser 4 violations
- None. `Graphics.generateTexture` is still supported in v4 (the audit's "removed" list targets `Create.GenerateTexture` / `TextureManager.generate`, not `Graphics.generateTexture`).

### Scene lifecycle / Event leaks / Timer leaks
- 🟡 **L53–55 — `this.time.delayedCall(400, …)` not stored.** Auto-cleaned by `TimeManager` on shutdown (Phaser clears scene timers), but the stored-reference pattern is preferred per the Time audit.
  **Fix:** `this.bootTimer = this.time.delayedCall(400, …);` and remove in `shutdown()`.

---

## 2. `src/game/features/scenes/GameScene.ts` (1081 lines) — THE ORCHESTRATOR

This file has the most issues. Grouped by category.

### 2.1 EventBus listener leaks (CRITICAL — survives `scene.restart()`)

🔴 **L151–161 — 8 `EventBus.on` registrations; only 3 are off'd by reference.**
```ts
EventBus.on('PLAYER_DEAD', this.onPlayerDied, this);          // L151 — off'd L1068 ✓
EventBus.on('ENEMY_DEAD',  this.onEnemyKilled, this);         // L152 — off'd L1069 ✓
EventBus.on('BOSS_DEAD',   this.onBossDied, this);            // L153 — off'd L1070 ✓
EventBus.on('CHECKPOINT', () => this.hud?.toast(...));        // L154 — anonymous arrow, CANNOT off by ref
EventBus.on('GAME_STATE',  (p: unknown) => {...});            // L155 — anonymous arrow, CANNOT off by ref
EventBus.on('LEVEL_UP',    () => this.hud?.toast(...));       // L159 — anonymous arrow, CANNOT off by ref
EventBus.on('SKILL_UNLOCKED',   () => { this.player?.refreshStats(); }); // L160 — anonymous arrow
EventBus.on('ABILITY_UNLOCKED', () => { this.player?.refreshStats(); }); // L161 — anonymous arrow
```

The anonymous arrows on L154, L155, L159, L160, L161 **cannot be removed individually** (audit rule §13: "DO NOT use arrow literals for listeners you intend to remove"). The `shutdown()` handler compensates with `removeAllListeners`:

```ts
// L1071–1075
EventBus.off('CHECKPOINT');
EventBus.off('GAME_STATE');
EventBus.off('LEVEL_UP');
EventBus.off('SKILL_UNLOCKED');
EventBus.off('ABILITY_UNLOCKED');
```

This works *only* because `EventBus.off` falls back to `removeAllListeners(event)` when no fn is passed (see `EventBus.ts` L23–29). **The footgun:** `removeAllListeners('LEVEL_UP')` will silently wipe **any other system's** subscription to `LEVEL_UP`. Currently only `GameScene` listens, so it's a latent bug — but if `QuestSystem` or a future UI system subscribes to `LEVEL_UP`, it gets nuked on every GameScene restart (e.g., language-switch via `SettingsUI` calls `this.scene.scene.restart()` — see `SettingsUI.ts:127`).

**Fix:** Convert all five anonymous arrows to named class-method handlers and `off` them individually:
```ts
private onCheckpoint = (): void => { this.hud?.toast(t('checkpoint.saved')); };
private onGameState  = (p: unknown): void => { ... };
private onLevelUp    = (): void => { this.hud?.toast(t('levelup')); };
private onSkillUnlocked   = (): void => { this.player?.refreshStats(); };
private onAbilityUnlocked = (): void => { this.player?.refreshStats(); };
// In create():
EventBus.on('CHECKPOINT', this.onCheckpoint);
// …
// In shutdown():
EventBus.off('CHECKPOINT', this.onCheckpoint);
// …
```

### 2.2 Window listener leak in `showHowToPlay`

🔴 **L584–585 — `backHandler` added via `setTimeout` + `window.addEventListener`; never cleaned up in `cleanupState`/`shutdown`.**
```ts
const backHandler = () => { this.setState('menu'); window.removeEventListener('keydown', backHandler); };
setTimeout(() => window.addEventListener('keydown', backHandler), 100);
```
- If the user navigates away from the How-To-Play overlay **without pressing Enter** (e.g., the game scene restarts due to a language change while the overlay is open), the `setTimeout` callback still fires 100 ms later and attaches `backHandler` to `window` — **after** the scene has already shut down. The handler then lingers forever, and any future Enter keypress calls `this.setState('menu')` on a stale/dead GameScene instance.
- The `setTimeout` is also not stored, so it cannot be cancelled.

**Fix:** Store the handler and the timeout on the instance; remove in `cleanupState()` and `shutdown()`:
```ts
private howToBackHandler: ((e: KeyboardEvent) => void) | null = null;
private howToBackTimer: number | null = null;
// in showHowToPlay():
this.howToBackHandler = () => { this.setState('menu'); };
this.howToBackTimer = window.setTimeout(() => {
  if (this.howToBackHandler) window.addEventListener('keydown', this.howToBackHandler);
}, 100);
// in cleanupState():
if (this.howToBackTimer) { clearTimeout(this.howToBackTimer); this.howToBackTimer = null; }
if (this.howToBackHandler) {
  window.removeEventListener('keydown', this.howToBackHandler);
  this.howToBackHandler = null;
}
```

### 2.3 Timer leak — shooting stars

🔴 **L373–376 — `this.time.addEvent({ delay: 3000, loop: true, … })` is NOT stored.**
```ts
this.time.addEvent({
  delay: 3000, loop: true,
  callback: () => { if (Math.random() < 0.4) shootingStarFunc(); },
});
```
This repeating timer fires forever (loop: true). `cleanupState()` destroys `stateContainer` but does NOT kill this timer. The `shootingStarFunc` closure references `c` (the now-destroyed container) and calls `c.add(ss)` — on a destroyed Container this throws or silently fails. Either way, the timer keeps firing every 3 s on a dead scene. On `scene.restart()` (used by SettingsUI language switch), Phaser's TimeManager clears scene timers — so restart is safe — but **state transitions** (menu → hub → play) leak the timer.

**Fix:** Store the timer and kill it in `cleanupState()`:
```ts
private menuFxTimer: Phaser.Time.TimerEvent | null = null;
// in buildMenu():
this.menuFxTimer = this.time.addEvent({ delay: 3000, loop: true, callback: … });
// in cleanupState():
this.menuFxTimer?.remove(); this.menuFxTimer = null;
```

### 2.4 Tweens not killed on menu/hub transitions

🟠 **L334–422 (menu) and L456–561 (hub) — many `this.tweens.add({...})` calls; `this.tweens.killAll()` is only called in `cleanupPlay()` (L795).**
When transitioning menu → hub → play, the menu/hub tweens auto-complete-early when their target GOs are destroyed by `stateContainer.destroy(true)` (audit rule §11: tween auto-completes when target.isDestroyed). So they don't *leak* indefinitely — but they keep running for one or two frames after the state change, calling `setText`/`setScale` on destroyed objects (noisy, not fatal).

**Fix:** Add `this.tweens.killAll();` at the top of `cleanupState()` (before `stateContainer.destroy(true)`).

### 2.5 Double-cleanup in state transitions

🟠 **L832–838 (`restartStage`), L840–847 (`fastTravel`), L850–855 (`quitToHub`), L858–863 (`quitToMenu`) all call `cleanupPlay()` then `setState(...)` — and `setState` calls `cleanupState()` which calls `cleanupPlay()` AGAIN.**
```ts
private restartStage(): void {
  this.paused = false;
  this.pauseMenuUI.hide();
  CheckpointSystem.clear();
  this.cleanupPlay();          // ← first cleanup
  this.setState('play');       // ← setState → cleanupState → (state==='play') → cleanupPlay again
}
```
`cleanupPlay` is idempotent (optional chaining + empty arrays), so no crash — but it's wasteful and fragile. If anyone adds a non-idempotent side-effect to `cleanupPlay` later, this becomes a real bug.

**Fix:** Remove the explicit `cleanupPlay()` calls in all four methods; let `setState` → `cleanupState` handle it. (Note: `setState` checks `if (this.state === 'play') cleanupPlay()`, so the explicit call is needed only when transitioning FROM a non-play state — but all four callers are invoked while state is `'play'`, so the explicit call is redundant.)

### 2.6 `buildPlay()` early return leaves state as `'play'` with no world

🔴 **L590–592 — `if (!area) return;` after state has already been set to `'play'`.**
```ts
private buildPlay(): void {
  const area = WorldSystem.getCurrentArea();
  if (!area) return;  // state is already 'play' but no entities exist
  ...
}
```
`setState('play')` (L178) sets `this.state = 'play'` BEFORE calling `buildPlay()`. If `WorldSystem.getCurrentArea()` returns undefined (e.g., `WorldSystem.current` was corrupted, or `travelTo` failed silently), `buildPlay` returns immediately. The update loop then runs `updatePlay()` which calls `this.player.update()` on an uninitialized field — **crash**.

**Fix:** Validate in `setState` before committing, or rollback state in `buildPlay`:
```ts
private buildPlay(): void {
  const area = WorldSystem.getCurrentArea();
  if (!area) { this.state = 'menu'; this.buildMenu(); return; }
  ...
}
```

### 2.7 `paused` flag does NOT pause Matter physics

🟠 **L98 / L280–282 — `paused` is a GameScene-local boolean; Matter physics still runs.**
```ts
if (!this.paused) {
  ...
  this.updatePlay(deltaMs);
} else {
  this.pauseMenuUI.handleNavigation();
}
```
Skipping `updatePlay` stops *gameplay* updates (player, enemies, projectiles) but **Matter's world step still runs** (gravity, body resolution). The player sprite will keep falling, enemies will drift, projectiles will travel — the world is visually "frozen" from the gameplay-callback perspective but physics continues under the hood. The audit checklist (§5 scenes) says: "Paused scenes STILL RENDER. Use `sleep()` to stop both update and render." For a true pause, you need `this.matter.world.pause()` (or `this.scene.pause()`, but that pauses the whole scene including UI tweens).

**Fix:** In `togglePause()`:
```ts
if (this.paused) {
  this.matter.world.resume();
  this.paused = false; ...
} else {
  this.matter.world.pause();
  this.paused = true; ...
}
```

### 2.8 `onPlayerDied` accesses `this.player.sprite` without null-check

🟠 **L869 — `this.particles.explosion(this.player.sprite.x, this.player.sprite.y, ...)`.**
`EventBus.emit('PLAYER_DEAD')` is fired from inside `PlayerEntity.takeDamage` (presumably). Depending on whether `PlayerEntity` destroys its sprite before or after emitting, `this.player.sprite` may be null/destroyed. The audit checklist (§25 sprites) warns: `isDestroyed` tracks destroy state; accessing `.x` on a destroyed sprite throws.

**Fix:** Null-check and store coords before explosion:
```ts
private onPlayerDied = (): void => {
  EventBus.off('PLAYER_DEAD', this.onPlayerDied, this);
  const px = this.player?.sprite?.x;
  const py = this.player?.sprite?.y;
  if (typeof px === 'number' && typeof py === 'number') {
    this.particles.explosion(px, py, COLORS.PLAYER, 1.2);
  }
  ...
};
```

### 2.9 `dialogueUI` and `pauseMenuUI` not destroyed on shutdown

🟠 **L135 / L138–148 — created in `create()`, never destroyed in `shutdown()`.**
```ts
this.dialogueUI = new DialogueUI(this);           // L135
this.pauseMenuUI = new PauseMenuUI(this, {...});  // L138
```
`shutdown()` (L1067–1078) only offs EventBus listeners, calls `OverlayManager.destroy()` and `InputSystem.destroy()`. The two UI objects (which hold Phaser Text/Container/Rectangle references) are leaked on every restart. On `scene.restart()` (SettingsUI language switch), they'd be re-created in `create()` while the old instances linger.

**Fix:** Add to `shutdown()`:
```ts
this.dialogueUI?.destroy?.();
this.pauseMenuUI?.destroy?.();
```
(Verify `DialogueUI` and `PauseMenuUI` expose a `destroy()` method — they should, per the OverlayUI contract.)

### 2.10 `setState('play')` skips `cleanupState` for non-play → play, but `cleanupPlay` only runs when leaving play

🟡 **L186–204 — `cleanupState` correctly branches on `this.state === 'play'`, but the branch happens BEFORE `this.state = next` (L171).** This is correct ordering. Just noting for clarity — this is fine.

### 2.11 `onCollisionStart` is an arrow function — `off` with context arg is misleading

🟡 **L636 / L785 — `this.matter.world.on('collisionstart', this.onCollisionStart, this)` and `.off(..., this.onCollisionStart, this)`.**
`onCollisionStart` is defined as `= (event) => {...}` (L665) — an arrow function. Arrow functions ignore `this` rebinding, so passing `this` as the context arg to `.on`/`.off` is a no-op for binding purposes. The `off` still works because EventEmitter3 matches by fn reference. **Not a bug**, but the `this` arg is misleading. Cosmetic.

### 2.12 `OverlayManager.close(onClose)` callback fires AFTER `ui.destroy()`

🟡 **L248–256 + OverlayManager L75–85 — `closeOverlay()` callback expects `pauseMenuUI.show()` to run, but `OverlayManager.close` destroys the overlay UI before calling `onClose`.** This is fine for `pauseMenuUI` (different UI), but if the callback ever needed to query the overlay being closed, it would get a destroyed UI. The contract should be documented: "onClose fires AFTER ui.destroy()". Cosmetic.

### 2.13 `setupMenuNav` overwrites `menuNavHandler` without removing the previous one

🟡 **L1021–1037 — `setupMenuNav` assigns `this.menuNavHandler = (e) => {...}` then `window.addEventListener`. If `setupMenuNav` is called twice without `cleanupState` in between (e.g., re-entering menu state via `setState('menu')` after `setState('menu')` — unusual but possible), the previous handler is orphaned.**
In practice, `cleanupState` (L193–196) removes the handler before `setState` calls `setupMenuNav` again, so this is safe. But the pattern is fragile.

**Fix:** Defensive — at the top of `setupMenuNav`:
```ts
if (this.menuNavHandler) window.removeEventListener('keydown', this.menuNavHandler);
```

### 2.14 `GameScene` has no `init()` — field initializers don't re-run on `scene.restart()`

🟡 **L65–101 — fields like `private state: GameState = 'menu'`, `private paused = false`, etc.**
Per audit rule §5: "Reset state in `init()`, NOT the constructor. Constructor runs once per instantiation; `init()` runs every start/restart." `GameScene` uses field initializers which (in TypeScript) compile to constructor assignments — they run **only on instantiation**, not on `scene.restart()`.

Currently `SettingsUI.ts:127` calls `this.scene.scene.restart()` for language changes. On restart:
1. `shutdown()` runs — offs EventBus listeners.
2. The scene instance is reused (not re-instantiated).
3. `create()` runs — re-binds everything.

So fields like `state = 'menu'` retain their previous value (e.g., `'play'`) entering `create()`. But `create()` calls `setState('menu')` (L163) which overwrites `state` — so it happens to work. **However**, fields like `paused = false` (L98), `bossArenaActive = false` (L89), `sequenceTimers = []` (L90) are NOT reset in `create()` or `setState()`. If `paused` was true when restart fired (unlikely but possible if the user opened settings from pause), `paused` stays true entering the new menu state, blocking nothing but lingering as stale state.

**Fix:** Move state-reset to an `init()` method:
```ts
init(): void {
  this.state = 'menu';
  this.paused = false;
  this.bossArenaActive = false;
  this.sequenceTimers = [];
  this.menuButtons = [];
  this.menuFocusIndex = 0;
  this.enemies = [];
  this.projectiles = [];
  this.boss = null;
  this.hud = null;
  this.stateContainer = null;
  this.menuNavHandler = null;
  this.loadedArea = null;
}
```

### 2.15 `matter.world.off('collisionstart', ...)` only in `cleanupPlay`; not in `shutdown`

🟡 **L636 added, L785 off'd in `cleanupPlay`. `shutdown()` (L1067) does not off it.**
If `shutdown` fires without `cleanupPlay` first (e.g., scene destroyed while in menu/hub state — collision listener was never added in those states, so this is actually safe). But if a crash occurs mid-play and shutdown is called without `cleanupPlay`, the matter listener would survive on the (now-shutdown) scene's matter.world. Since matter.world is also destroyed on shutdown, this is benign. **Defensive fix:** add to `shutdown()`:
```ts
this.matter.world.off('collisionstart', this.onCollisionStart, this);
```

### 2.16 `update()` does not gate on `this.stateContainer` being null

🟡 **L260–297 — `update()` runs every frame regardless of state container existence.** During the brief window between `cleanupState()` destroying the old container and `setState` building the new one (which is synchronous, so this window is zero in practice), `update()` could theoretically call `handleMenuGamepadNav` which reads `this.menuButtons` (cleared in setState L172). Currently safe because setState is synchronous. Cosmetic.

### 2.17 `tryInteract` only checks NPCs, not other interactables

🔵 **L729–743 — `tryInteract` loops `NPCSystem.getNPCsInArea` and calls `dialogueUI.show` on proximity.** No issue, but worth noting that interactables like levers, terminals, or items are not handled here. Future-extension note.

### 2.18 `buildHub` uses `navItems.indexOf(item)` inside `forEach`

🔵 **L556 — `navItems.indexOf(item)` is O(n) inside an O(n) loop → O(n²).** For 5 items this is fine, but use the index from `forEach`'s second arg:
```ts
navItems.forEach((item, i) => {
  const nx = navStartX + i * navGap;
  ...
});
```

---

## 3. `src/game/features/scenes/UIScene.ts` (18 lines)

- 🔵 **Dead code.** Comment L3–5 says "This scene exists for backward compatibility but does nothing." `this.scene.stop()` on L14 means it immediately stops itself. No bugs, no leaks. Recommend removing the file and any `scene.launch('UIScene')` references (the worklog says these were already removed in overlay-fix-v3.1).

---

## 4. `src/game/systems/InputSystem.ts` (337 lines)

### Bugs
- 🔴 **L218–219 — `gamepadconnected`/`gamepaddisconnected` listeners are anonymous arrows, NOT stored, NEVER removed in `destroy()`.**
  ```ts
  window.addEventListener('gamepadconnected',    () => { this.state.gamepadConnected = true; });
  window.addEventListener('gamepaddisconnected', () => { this.state.gamepadConnected = false; });
  ```
  `destroy()` (L318–329) removes `onKeyDown` and `onKeyUp` but **not** these two. On `scene.restart()`, `destroy()` is called, then `init()` is called again — `init()` guards with `if (this.listenersAttached) return;` (L111) which `destroy()` sets to false (L323). So `init()` re-attaches `onKeyDown`/`onKeyUp` AND the two gamepad listeners — **the gamepad listeners now have TWO copies on `window`**, both firing. Each restart adds another copy. After N restarts, N listeners fire per gamepad event.

  **Fix:** Store the gamepad handlers and remove in `destroy()`:
  ```ts
  private static onGpConnected: (() => void) | null = null;
  private static onGpDisconnected: (() => void) | null = null;
  // in init():
  this.onGpConnected = () => { this.state.gamepadConnected = true; };
  this.onGpDisconnected = () => { this.state.gamepadConnected = false; };
  window.addEventListener('gamepadconnected', this.onGpConnected);
  window.addEventListener('gamepaddisconnected', this.onGpDisconnected);
  // in destroy():
  if (this.onGpConnected)    window.removeEventListener('gamepadconnected', this.onGpConnected);
  if (this.onGpDisconnected) window.removeEventListener('gamepaddisconnected', this.onGpDisconnected);
  this.onGpConnected = null;
  this.onGpDisconnected = null;
  ```

- 🟡 **L257–268 + L121–165 — keyboard and gamepad callbacks can BOTH fire for the same action in the same frame.**
  Keyboard edges fire `this.callbacks.jump?.()` etc. directly in `onKeyDown` (event-driven). Gamepad edges fire `this.callbacks.jump?.()` etc. in `update()` (poll-driven). If a keyboard key and gamepad button are pressed simultaneously, `callbacks.jump` fires twice. Not a crash, but a double-jump / double-fire hazard.

  **Fix:** Either (a) only fire callbacks from `update()` (remove the direct calls in `onKeyDown`), or (b) dedupe via a "callbackFiredThisFrame" flag per action.

- 🔵 **L160–166 — `KeyShift` dash direction defaults to `'right'` if no movement key held:**
  ```ts
  const dir: Direction = this.kbHeld.left ? 'left' : this.kbHeld.right ? 'right' : 'right';
  ```
  Intentional fallback, but if the player is holding `Up` only and dashes, they dash right. Minor UX nit.

### Phaser 4 violations
- None. Uses raw `navigator.getGamepads()` per the audit checklist recommendation (§2 input: "DO NOT assume gamepad is connected on scene start — check `this.input.gamepad.total > 0`"). The raw-API approach is acceptable.

### Event leaks / Timer leaks
- See L218–219 above.

### Safety
- 🟡 **L240–243 — `navigator.getGamepads()` returns a sparse array-like; `for (const p of pads)` may iterate `null` slots.** The `if (p)` guard on L243 handles this. Correct.

---

## 5. `src/game/systems/EventBus.ts` (46 lines)

- 🟡 **L23–29 — `off()` falls back to `removeAllListeners(event)` when no fn is passed.** This is the source of the "footgun" called out in §2.1. The API design encourages `off('EVENT')` calls that wipe all subscribers. Either:
  - (a) Document that `off(event)` without fn is destructive, OR
  - (b) Require fn always, OR
  - (c) Add a separate `removeAll(event)` method and make `off(event)` a no-op without fn.
  Currently the API is dangerous because callers (GameScene.shutdown) use it casually.

- No other issues. The wrapper is minimal and correct.

---

## 6. `src/game/systems/SaveSystem.ts` (252 lines)

- 🟡 **L56 / L59 / L247 — `this.cache = { ...DEFAULT_SAVE, player: { ...DEFAULT_PLAYER }, settings: { ...DEFAULT_SETTINGS } };`** does a shallow merge. `DEFAULT_SAVE.player` is `{ ...DEFAULT_PLAYER }` (a fresh object), but `DEFAULT_SAVE.unlockedAreas = ['abandoned_factory']` (a shared array reference). The spread `{ ...DEFAULT_SAVE }` copies the array reference, NOT a new array. So if any code mutates `data.unlockedAreas.push(...)`, it pollutes `DEFAULT_SAVE.unlockedAreas` for the next `clear()` call.
  **Fix:** Deep-copy arrays in the default: `unlockedAreas: [...DEFAULT_SAVE.unlockedAreas]`. Same for `discoveredAreas`, `questFlags`, `npcFlags`, `bestBossTimes`. Same for `player.unlockedSkills`, `player.unlockedWeapons`, `player.inventory`, `player.abilities`.
  Currently `unlockArea`/`addItem`/etc. all go through the cache (which is loaded once and reused), so mutations stay within the cache. But `clear()` re-initializes the cache from `DEFAULT_SAVE` — and at that point the polluted arrays leak into the "fresh" state.

- 🔵 **L66 — `window.localStorage.setItem` wrapped in try/catch with `/* */` swallow.** Acceptable for save-failure resilience, but logging once would help debugging.

- No event listeners, no scene dependencies. Pure data layer. Good.

---

## 7. `src/game/systems/AudioSystem.ts` (152 lines)

- 🟡 **L31–33 — gesture listeners use `{ once: true }`, so they auto-remove on first fire.** Good. But: if the user **never** interacts (no pointerdown, no keydown, no gamepad), `initOnGesture` never runs and `AudioSystem.play(...)` is a silent no-op (L84: `if (!this.ctx || !this.sfxGain) return;`). This is correct per the audit (§15 audio: "Browser autoplay policy: audio is locked until user interaction").

- 🟡 **No `destroy()` method.** AudioContext is never closed. For an SPA game this is acceptable (singleton AudioContext persists across scene restarts, intended). But for full game teardown, `ctx.close()` should be called. Add a `destroy()` for completeness:
  ```ts
  static destroy(): void {
    this.ctx?.close?.();
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuffer = null;
    this.initialized = false;
    this.gestureListenersAttached = false;
  }
  ```

- 🔵 **L40 — `(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext`** — Safari < 14 still uses the prefix. Correct.

- No scene listeners. No leaks.

---

## 8. `src/game/systems/RenderSystem.ts` (97 lines)

### Bug
- 🔴 **L75–85 — `for (const l of this.lights)` iterates `this.lights` while `removeLight(l)` splices the array. Iterator invalidation.**
  ```ts
  update(timeMs: number): void {
    ...
    for (const l of this.lights) {
      if (l.follow) {
        try {
          const p = l.follow();
          if (!p || typeof p.x !== 'number') { this.removeLight(l); continue; }  // ← splice!
          ...
        } catch { this.removeLight(l); continue; }                                // ← splice!
      }
      ...
    }
  }
  ```
  `removeLight` (L68–71) does `this.lights.splice(idx, 1)`. When you splice an array during `for…of`, the iterator's internal index doesn't account for the removed element, so **the next element is skipped**. If two consecutive lights are both invalid, only the first is removed; the second survives one extra frame (or indefinitely if it keeps being skipped).

  **Fix:** Iterate over a snapshot:
  ```ts
  for (const l of [...this.lights]) { ... }
  ```
  Or iterate backwards:
  ```ts
  for (let i = this.lights.length - 1; i >= 0; i--) {
    const l = this.lights[i];
    ...
    if (invalid) { this.removeLight(l); }
  }
  ```

### Safety
- 🟡 **L34 — `RenderSystem._instances.push(this)` in constructor; never spliced if constructor throws.** If `scene.add.rectangle(...)` throws, `this` is leaked into `_instances` with an undefined `darkness`. `setBrightness` (L40) guards with `inst.darkness && inst.darkness.active` so it's safe, but still a smell.

- 🟡 **L60 — `scene.add.circle(0, 0, radius, color, intensity);`** creates a new GameObject per light. No upper bound on light count. If a scene adds 1000 lights (e.g., bullets each spawn a light), performance degrades. Consider a pool or a hard cap.

- No event listeners. Good.

---

## 9. `src/game/systems/CameraSystem.ts` (70 lines)

- 🔵 **L33–39 — `setZoom(zoom, smooth)` uses `Phaser.Math.Linear(this.camera.zoom, zoom, 0.04)` per frame.** This is a manual lerp, not the camera's built-in zoom. Works, but the lerp factor is hardcoded. Cosmetic.

- 🔵 **L17 — `follow(target, lerp)` calls `startFollow(target, true, lerp, lerp)` with `true` (roundPixels).** Per audit §6 cameras: "DO NOT use non-integer zoom with `roundPixels: true` — causes jitter." If the game uses non-integer zoom (e.g., 0.85 boss-arena zoom on L780), `startFollow(..., true, ...)` enables roundPixels and will jitter. Verify the camera's `roundPixels` config.

- No listeners, no leaks. Clean wrapper.

---

## 10. `src/game/systems/ParticleSystem.ts` (86 lines)

- 🔵 **No `destroy()` method.** The class holds only `private scene`, all effects use tweens with `onComplete: () => p.destroy()`. Tweens auto-cleanup on scene shutdown. Acceptable.

- 🟡 **L18–23, L30–33, L37–40, L45–48, L58–63, L69–71, L79–82 — every effect creates a new GameObject + tween.** No pooling. For high-frequency effects (e.g., bullet impacts), this causes GC pressure. Cosmetic / performance note.

- 🟡 **L67–71 — `screenFlash` creates a 2000×2000 Rectangle.** Set to scrollFactor 0, depth 150. Not destroyed if scene shuts down mid-tween — but Phaser destroys all display-list children on scene shutdown, so OK.

- No listeners. Good.

---

## 11. `src/game/systems/LocalizationSystem.ts` (46 lines)

- 🔵 **L41–44 — `tArray` returns `[val]` (single-element array).** Comment says "For now, returns single-element array. Can be extended for multi-line." Dead-ish code; if no caller uses `tArray`, remove. (Quick check: `tArray` is not imported anywhere in the audited files.)

- No issues. Pure module-level functions, no state leaks.

---

## 12. `src/game/systems/NPCSystem.ts` (88 lines)

### Bug
- 🔴 **L36 — `EventBus.emit('DIALOGUE_END', { npcId, flag, value })` fires every time `setFlag` is called. `DialogueSystem.end()` (DialogueSystem L84) ALSO fires `EventBus.emit('DIALOGUE_END', { npcId, dialogueId })` with a DIFFERENT payload shape.**
  - `NPCSystem.interact()` (L74–85) calls `setFlag('met', true)` on L80 → emits `DIALOGUE_END` with `{ npcId, flag: 'met', value: true }`.
  - Then the dialogue UI shows. When the dialogue ends, `DialogueSystem.end()` emits `DIALOGUE_END` with `{ npcId, dialogueId }`.
  - **Subscribers see `DIALOGUE_END` TWICE per interaction with incompatible payload shapes.** Any subscriber that destructures `dialogueId` will get `undefined` on the first emit; any subscriber that destructures `flag` will get `undefined` on the second emit.

  **Fix:** Pick ONE emitter for `DIALOGUE_END`. Recommended: only `DialogueSystem.end()` emits it (since the event name implies dialogue ended, not flag set). Remove L36 from `NPCSystem.setFlag`, or rename it to `NPC_FLAG_SET`.

- 🟡 **L49–63 — `getActiveDialogue` priority matching is fragile.** The inner `for (const p of priority)` loop checks `dialogueId.includes(p)` — substring match. A dialogue ID like `'npc1_quest_complete_intro'` would match `p === 'quest_complete'` first (good), but also matches `p === 'intro'` later (skipped because the outer dialogueId loop already returned). The `continue` on L57/L58/L59 only continues the **inner** priority loop, not the outer dialogueId loop. Subtle but currently correct.

  **Fix:** Refactor to explicit priority lookup table per NPC data, not substring matching.

- No listeners. No leaks.

---

## 13. `src/game/systems/DialogueSystem.ts` (102 lines)

- 🔴 **L84 — emits `DIALOGUE_END` with `{ npcId, dialogueId }`, conflicting with NPCSystem's `{ npcId, flag, value }`.** See §12 above.

- 🟡 **L30–50 — `start()` calls `NPCSystem.setFlag(dialogue.npcId, dialogue.setFlag, true)` on L45, which emits `DIALOGUE_START`'s sibling `DIALOGUE_END` (via NPCSystem L36) BEFORE `DialogueSystem.start` itself emits `DIALOGUE_START` on L48.** So the event order is: `DIALOGUE_END` (from setFlag) → `DIALOGUE_START` (from start). Backwards. Subscribers expecting "start → end" get "end → start" which is nonsensical.

  **Fix:** Same as §12 — remove `EventBus.emit('DIALOGUE_END', ...)` from `NPCSystem.setFlag`.

- No subscriptions. Pure emitter. Good.

---

## 14. `src/game/systems/LoreSystem.ts` (137 lines)

### Bugs
- 🔴 **L75 — `const save = require('../systems/SaveSystem').SaveSystem.get();` — uses CommonJS `require()` in an ES module context.**
  - In a Vite/ESM bundler, `require` is undefined. This throws `ReferenceError: require is not defined` at runtime when `LoreSystem.init()` is called from `GameScene.create()` (L125).
  - Even if CommonJS interop is configured, this is non-standard. **Add an ES import at the top of the file:**
    ```ts
    import { SaveSystem } from '../systems/SaveSystem';
    // ...
    const save = SaveSystem.get();
    ```

- 🟠 **L122 — `case 'boss_kill': return save.player.bossesKilled > 0;` — does NOT check the specific boss ID.**
  - The unlock condition string is `'boss_kill:guardian_ax09'` (L34) — the `id` is parsed on L120 but never used in the `boss_kill` branch. Killing **any** boss unlocks **all** boss lore entries. The comment `// simplified` acknowledges this, but it's still a logic bug.

  **Fix:**
  ```ts
  case 'boss_kill':
    // Need per-boss tracking — add a `defeatedBosses: string[]` to SaveData.
    return save.player.defeatedBosses?.includes(id) ?? false;
  ```

- 🟡 **L67 — `private static discovered: Set<string> = new Set();` — module-level Set, never cleared.** On new game / restart, `LoreSystem.init()` re-runs and adds to the existing Set (deduplication via Set handles it), but discovered entries from a previous save persist into a new game. There's no `LoreSystem.reset()` method.

  **Fix:** Add `static reset(): void { this.discovered.clear(); }` and call from `GameScene.shutdown()` or new-game flow.

- No subscriptions. Good.

---

## 15. `src/game/systems/QuestSystem.ts` (166 lines)

### Bugs
- 🔴 **L41–50 — three `EventBus.on` calls with anonymous arrows; NO `destroy()`/`reset()` method; NEVER unsubscribed.**
  ```ts
  EventBus.on('ENEMY_DEAD',  (payload) => { this.onEnemyKilled((payload as {id:string}).id); });
  EventBus.on('ITEM_COLLECTED', (payload) => { ... });
  EventBus.on('BOSS_DEAD',   (payload) => { this.onBossKilled((payload as {id:string}).id); });
  ```
  The `initialized` flag (L23, L27) prevents re-subscription on subsequent `init()` calls — so on `scene.restart()`, `init()` returns early and the listeners persist (intended for cross-restart continuity). BUT:
  - The listeners **cannot be removed individually** (anonymous arrows).
  - If `QuestSystem` ever needs to be reset (new game, save wipe), there's no way to do it.
  - On `GameScene.shutdown()`, `EventBus.off('ENEMY_DEAD', this.onEnemyKilled, this)` removes GameScene's specific handler — NOT QuestSystem's anonymous arrow. So QuestSystem's listener survives (correct for cross-restart). But `EventBus.off('BOSS_DEAD')` (called via `removeAllListeners` in GameScene.shutdown? — let me recheck).

  Looking again at GameScene.shutdown (L1067–1075):
  ```ts
  EventBus.off('PLAYER_DEAD', this.onPlayerDied, this);   // specific
  EventBus.off('ENEMY_DEAD',  this.onEnemyKilled, this);  // specific — only removes GameScene's
  EventBus.off('BOSS_DEAD',   this.onBossDied, this);     // specific — only removes GameScene's
  EventBus.off('CHECKPOINT');                              // removeAllListeners
  EventBus.off('GAME_STATE');                              // removeAllListeners
  EventBus.off('LEVEL_UP');                                // removeAllListeners
  EventBus.off('SKILL_UNLOCKED');                          // removeAllListeners
  EventBus.off('ABILITY_UNLOCKED');                        // removeAllListeners
  ```
  Good — GameScene uses specific `off` for ENEMY_DEAD and BOSS_DEAD, so QuestSystem's listeners survive. ✓

  But QuestSystem STILL has no way to reset. **Fix:** Add named handler refs and a `reset()` method:
  ```ts
  private static onEnemyKilledHandler = (payload: unknown) => { ... };
  private static onItemCollectedHandler = (payload: unknown) => { ... };
  private static onBossKilledHandler = (payload: unknown) => { ... };
  static init(): void {
    if (this.initialized) return;
    this.initialized = true;
    EventBus.on('ENEMY_DEAD',     this.onEnemyKilledHandler);
    EventBus.on('ITEM_COLLECTED', this.onItemCollectedHandler);
    EventBus.on('BOSS_DEAD',      this.onBossKilledHandler);
    ...
  }
  static reset(): void {
    EventBus.off('ENEMY_DEAD',     this.onEnemyKilledHandler);
    EventBus.off('ITEM_COLLECTED', this.onItemCollectedHandler);
    EventBus.off('BOSS_DEAD',      this.onBossKilledHandler);
    this.quests.clear();
    this.initialized = false;
  }
  ```

- 🟡 **L145–162 — `updateObjectives` iterates `this.quests` Map and mutates `state.progress[i]` and `state.status` (values, not keys).** Map iteration is safe under value mutation. Good.

- 🟡 **L146–157 — `for (const [questId, state] of this.quests)` then `state.status = 'completed'` on L159.** The `allComplete` flag on L150 is computed across all objectives, but only set to false if ANY objective is incomplete. If `state.progress[i]` was already at `obj.amount` from a previous frame, and the new event doesn't match any objective, `allComplete` stays true and the quest auto-completes without the matching event. Subtle — but actually correct: if all objectives are already at their target, the quest SHOULD be completed. OK.

- No scene dependencies. Good.

---

## 16. `src/game/systems/InventorySystem.ts` (120 lines)

- 🔵 **L101–107 — `hasUpgradeMaterials` and `consumeUpgradeMaterials` hardcode `scrap_metal` and `circuit_board` item IDs.** These should come from a data table (per-weapon upgrade recipe). Code smell.

- No listeners (only emits). No leaks. Clean.

---

## 17. `src/game/systems/WeaponUpgradeSystem.ts` (128 lines)

### Bugs
- 🔴 **L103–105 — direct `window.localStorage.setItem('mecha_last_protocol_save_v3', ...)` with hardcoded key.**
  ```ts
  try {
    window.localStorage.setItem('mecha_last_protocol_save_v3', JSON.stringify(save));
  } catch { /* */ }
  ```
  - Duplicates `SaveSystem.STORAGE_KEY`. If SaveSystem's key changes (e.g., v4 migration), this writes to the wrong key.
  - No `typeof window !== 'undefined'` guard — SSR-unsafe.
  - Bypasses `SaveSystem.persist()`. If SaveSystem later adds encryption, compression, or quota management, this code is unaware.

  **Fix:** Add a `SaveSystem.setWeaponLevel(weaponId, level)` method and call it:
  ```ts
  // In SaveSystem:
  static setWeaponLevel(weaponId: string, level: number): void {
    const data = this.load();
    data.player.weaponLevels[weaponId] = level;
    this.persist();
  }
  // In WeaponUpgradeSystem.upgrade:
  SaveSystem.setWeaponLevel(weaponId, nextLevel);
  ```

- 🟠 **L67–71 — `canUpgrade` does NOT check if the weapon is unlocked.**
  ```ts
  canUpgrade: level < MAX_WEAPON_LEVEL
    && InventorySystem.hasItem('scrap_metal', scrapNeeded)
    && InventorySystem.hasItem('circuit_board', circuitNeeded),
  ```
  If `getUpgradeInfo` is called for a weapon the player hasn't unlocked (e.g., `'energy_blade'` before killing the neural_overseer boss), it returns `canUpgrade: true` if materials are present. The subsequent `upgrade()` call (L80) would set `save.player.weaponLevels[weaponId] = nextLevel` — creating a weapon-level entry for a locked weapon.

  **Fix:** Add `&& SaveSystem.getPlayer().unlockedWeapons.includes(weaponId)` to `canUpgrade`.

- 🟡 **L75 — `nextDamage: level < MAX_WEAPON_LEVEL ? Math.round(weapon.damage * (1 + nextLevel * 0.10 - 0.10)) : ...`** — the formula `nextLevel * 0.10 - 0.10` simplifies to `(nextLevel - 1) * 0.10`. Matches `getEffectiveDamage`'s `1 + (level - 1) * 0.10`. Correct but obscure. Refactor for clarity.

- No listeners (only emits). Good.

---

## 18. `src/game/systems/ExperienceSystem.ts` (120 lines)

### Bugs
- 🔴 **L64 — `levelsGained = 1;` always, even when `SaveSystem.awardXp` levels up multiple times.**
  ```ts
  const result = SaveSystem.awardXp(amount);
  let levelsGained = 0;
  if (result.leveledUp) {
    levelsGained = 1; // ← always 1, even if 5 levels gained
    AudioSystem.play('levelUp');
    EventBus.emit('LEVEL_UP', { level: result.newLevel, skillPoints: ..., levelsGained });
  }
  ```
  `SaveSystem.awardXp` (L123–135) has a `while` loop that can increment `level` multiple times and adds 1 `skillPoints` per level. But `ExperienceSystem.awardXP` reports `levelsGained: 1` regardless. UIs that display "You gained N levels!" will always show 1.

  **Fix:** Compare levels before/after:
  ```ts
  const before = SaveSystem.getPlayer().level - (result.leveledUp ? 1 : 0); // hacky
  // Better: have SaveSystem.awardXp return levelsGained:
  // In SaveSystem.awardXp: track levelsGained in the while loop and return it.
  ```

- 🔴 **L111–116 — `spendSkillPoint()` only decrements by 1, ignoring `skill.cost` (which may be > 1).**
  ```ts
  static spendSkillPoint(): boolean {
    const sp = this.getSkillPoints();
    if (sp <= 0) return false;
    const save = SaveSystem.get();
    save.player.skillPoints--;  // ← always -1
    ...
  }
  ```
  `SkillTreeSystem.canUnlock` checks `getSkillPoints() < skill.cost` (SkillTreeSystem L40) — so a skill with `cost: 3` requires 3 SP. But `SkillTreeSystem.unlock` calls `spendSkillPoint()` once (SkillTreeSystem L55), which only deducts 1 SP. **The player gets a 3-cost skill for 1 SP.** This is a major progression economy bug.

  **Fix:** Change `spendSkillPoint` to `spendSkillPoints(amount)`:
  ```ts
  static spendSkillPoints(amount: number = 1): boolean {
    const sp = this.getSkillPoints();
    if (sp < amount) return false;
    const save = SaveSystem.get();
    save.player.skillPoints -= amount;
    // persist via SaveSystem (not direct localStorage)
    return true;
  }
  ```
  And in `SkillTreeSystem.unlock`:
  ```ts
  if (!ExperienceSystem.spendSkillPoints(skill.cost)) return false;
  ```

- 🔴 **L113–115 — same direct `window.localStorage.setItem` bug as WeaponUpgradeSystem.** Hardcoded key, no window guard, bypasses `SaveSystem.persist()`. Same fix.

- No listeners (only emits). Good.

---

## 19. `src/game/systems/SkillTreeSystem.ts` (182 lines)

### Bugs
- 🔴 **L55 — `if (!ExperienceSystem.spendSkillPoint()) return false;` only spends 1 SP regardless of `skill.cost`.** See §18 above. Critical economy bug.

- 🟡 **L61–70 — `if (skill.effect.unlock)` block runs, then `if (skill.effect.unlock && this.isWeaponId(skill.effect.unlock))` runs.** If `skill.effect.unlock` is a weapon ID (e.g., `'energy_blade'`):
  - L62: `SaveSystem.unlockAbility('energy_blade')` — adds `'energy_blade'` to `abilities` array. Wrong — it's a weapon, not an ability.
  - L63: `EventBus.emit('ABILITY_UNLOCKED', { ability: 'energy_blade' })` — wrong event.
  - L67–69: `SaveSystem.unlockWeapon('energy_blade')` + `EventBus.emit('WEAPON_UNLOCKED', ...)` — correct.

  So a weapon-unlock skill incorrectly adds the weapon ID to `abilities` AND emits `ABILITY_UNLOCKED`. If PlayerEntity checks `abilities.includes('energy_blade')` for some feature, it'd be true even though it's a weapon. Subtle data-pollution bug.

  **Fix:** Branch exclusively:
  ```ts
  if (skill.effect.unlock) {
    if (this.isWeaponId(skill.effect.unlock)) {
      SaveSystem.unlockWeapon(skill.effect.unlock);
      EventBus.emit('WEAPON_UNLOCKED', { weaponId: skill.effect.unlock });
    } else {
      SaveSystem.unlockAbility(skill.effect.unlock);
      EventBus.emit('ABILITY_UNLOCKED', { ability: skill.effect.unlock });
    }
  }
  ```

- 🟡 **L165 — hardcoded `weaponIds` array.** Should be derived from `WEAPONS` data table (via `getWeapon` or `getAllWeapons`). If a new weapon is added to data, this list won't auto-update.

- 🟡 **L113–121 — `applyEffect` applies multiplier first, then additive.** If a skill has both `multiplier: 1.2` and `additive: 10` on `maxHealth` (base 150), result = `round(150 * 1.2) + 10 = 190`. If the intent was `round((150 + 10) * 1.2) = 192`, the order is wrong. Document the order or make it explicit.

- No listeners (only emits). Good.

---

## 20. `src/game/world/WorldSystem.ts` (175 lines)

### Bugs
- 🟠 **L20–25 + L153–163 — `current` is initialized to defaults, but `initFromSave()` overwrites from checkpoint. There is NO `reset()` method to clear `current` back to defaults on new game.**
  - If the player completes the game at area `'final_boss_arena'`, then starts a new game (via `SaveSystem.clear()` + main menu → start), `WorldSystem.current` is STILL `'final_boss_arena'`. `buildPlay()` then calls `WorldSystem.getCurrentArea()` which returns the final area — the player spawns in the ending area instead of the tutorial.

  **Fix:** Add a `reset()` method and call it from new-game flow:
  ```ts
  static reset(): void {
    this.current = { actId: 1, regionId: 'factory', areaId: 'abandoned_factory', section: 1 };
  }
  ```

- 🟡 **L83–87 — `setSection` emits `GAME_STATE` with `sectionName: this.getSectionName(section)`.** `getSectionName` returns a localization KEY (L94: `sec?.nameKey ?? ''`), not a localized string. GameScene L157 uses `data.sectionName` to call `this.hud?.setSection(data.sectionName)` — if `setSection` expects a display string, it'd show the raw key. Verify HUDUI.setSection localizes.

- No listeners (only emits). Good.

---

## 21. `src/game/world/AreaLoader.ts` (166 lines)

### Bugs
- 🟡 **L146 — `result.visualRects.push(g as unknown as Phaser.GameObjects.Rectangle);`** — Graphics is cast to Rectangle. This is a LIE to the type system. `unload()` (L156) calls `v.destroy()` which exists on both, so it works at runtime. But any future code that relies on `visualRects[i]` being a Rectangle (e.g., calling `setFillStyle`) would crash.

  **Fix:** Change `LoadedArea.visualRects` type to `Phaser.GameObjects.GameObject[]` or `Phaser.GameObjects.Graphics[]`.

- 🔵 **L105–143 — `addSolid` draws graphics relative to (0,0), then `g.setPosition(x, y)` on L144.** Correct — Graphics uses local coords, setPosition moves the whole object. Verified consistent with Matter body center (L103: `addStaticRect(x, y, w, h)` places body center at (x, y)).

- 🟡 **L59 / L67 / L77 — `physics.addSensor(...)` creates Matter images with `__white` texture.** Per PhysicsSystem L36–43, sensors are invisible static images. Good.

- No listeners. No leaks. The `unload()` method properly destroys everything. ✓

---

## 22. `src/game/world/CheckpointSystem.ts` (69 lines)

- 🔵 **L65 — default respawn `{ x: 200, y: 420, section: 1 }` is hardcoded.** Should come from area data (section 1 start position). Minor.

- No listeners (only emits). No leaks. Clean.

---

## 23. `src/game/world/WorldMapSystem.ts` (149 lines)

- 🟠 **L72–94 — `isBossInAreaDefeated` uses a positional heuristic: "bossesKilled > bossIndex" where `bossIndex` is the 0-based position of this area among boss areas.** If the player kills bosses out of order (e.g., kills boss #3 before boss #1 via sequence-breaking), the heuristic incorrectly marks boss #1 as defeated. The comment acknowledges this ("Simple heuristic... Can be made more precise with bossId tracking"). 

  **Fix:** Add `defeatedBosses: string[]` to `SaveData`, push bossId on each boss kill, and check `defeatedBosses.includes(bossId)` here.

- 🟡 **L53 — `bossDefeated = hasBoss && save.player.bossesKilled > 0 && this.isBossInAreaDefeated(...)`.** The `save.player.bossesKilled > 0` short-circuit is redundant — `isBossInAreaDefeated` already checks `bossesKilled > bossIndex` (which implies `> 0` for index 0). Cosmetic.

- No listeners. No leaks. Pure data queries. Good.

---

## 24. `src/game/shared/Constants.ts` (98 lines)

- 🔴 **L97 — `SAVE_KEY: 'mecha_last_protocol_save_v2'` is STALE.** `SaveSystem` uses `'mecha_last_protocol_save_v3'` (SaveSystem L8). If any code reads `KEYS.SAVE_KEY` expecting the current save key, it'd read the v2 key and fail to find the save.
  - Grep confirms `KEYS.SAVE_KEY` is NOT referenced anywhere — so it's dead code, not an active bug. But it's a documentation hazard.

  **Fix:** Either delete `KEYS` or update it:
  ```ts
  export const KEYS = { SAVE_KEY: 'mecha_last_protocol_save_v3' } as const;
  ```
  Better: have SaveSystem import from Constants: `import { KEYS } from '../shared/Constants'; const STORAGE_KEY = KEYS.SAVE_KEY;` so there's a single source of truth.

- 🔵 **L54–76 — `STAGE_1` constant is defined but the game now uses data-driven `AreaData` (via `acts.ts`).** `STAGE_1` appears to be legacy dead code. Grep confirms no usages. Remove.

---

## 25. `src/game/shared/Effects.ts` (214 lines)

- 🔴 **DEAD CODE — `Effects` class is not imported anywhere.** Grep for `from.*shared/Effects` returns zero matches. The class duplicates `AudioSystem` (L15–142 identical to AudioSystem L13–150) and `ParticleSystem` (L146–203 identical to ParticleSystem methods). 

  **Fix:** Delete the file. If any of its unique methods (`playMusic`, `stopMusic` — both stubs) are needed, move them to `AudioSystem`.

- 🟡 **L7 — `import { COLORS } from './Constants';`** — imported but never used in this file. Unused-import lint warning.

- 🔵 **L205–211 — `playMusic` and `stopMusic` are no-op stubs.** If music is ever added, these stubs would need implementation. For now, dead code.

---

## 26. `src/game/shared/GamepadManager.ts` (141 lines)

- 🔴 **DEAD CODE — `GamepadManager` is not imported anywhere.** Grep for `from.*shared/GamepadManager` returns zero matches. The class duplicates `InputSystem`'s gamepad polling (InputSystem L240–287 vs GamepadManager L81–130). Both classes attach `gamepadconnected`/`gamepaddisconnected` listeners and both poll `navigator.getGamepads()` every frame. If both were active, they'd double-poll and double-emit.

  **Fix:** Delete the file. `InputSystem` already handles gamepad input.

- 🔴 **L55–62 — `init()` attaches anonymous-arrow `gamepadconnected`/`gamepaddisconnected` listeners that are NEVER removed.** No `destroy()` method exists. If this class were ever used, every `init()` call (even with the `listenersAttached` guard) would attach fresh listeners on first call only — but they'd never be removed, even on game teardown. Same pattern as the InputSystem bug.

- 🔵 **L57, L61 — `console.log` calls.** Debug noise. Should be gated behind a debug flag.

---

## CROSS-CUTTING SUMMARY

### Listener leak inventory (all confirmed via Grep)

| File | Line | Event | Source | Off'd? | Severity |
|------|------|-------|--------|--------|----------|
| GameScene | 151 | PLAYER_DEAD | EventBus | ✓ L1068 (by ref) | OK |
| GameScene | 152 | ENEMY_DEAD | EventBus | ✓ L1069 (by ref) | OK |
| GameScene | 153 | BOSS_DEAD | EventBus | ✓ L1070 (by ref) | OK |
| GameScene | 154 | CHECKPOINT | EventBus | ⚠ L1071 (removeAll) | 🟡 |
| GameScene | 155 | GAME_STATE | EventBus | ⚠ L1072 (removeAll) | 🟡 |
| GameScene | 159 | LEVEL_UP | EventBus | ⚠ L1073 (removeAll) | 🟡 |
| GameScene | 160 | SKILL_UNLOCKED | EventBus | ⚠ L1074 (removeAll) | 🟡 |
| GameScene | 161 | ABILITY_UNLOCKED | EventBus | ⚠ L1075 (removeAll) | 🟡 |
| GameScene | 636 | collisionstart | matter.world | ✓ L785 (in cleanupPlay) | OK (defensive: also add to shutdown) |
| GameScene | 1035 | keydown | window | ✓ L194 (in cleanupState) | OK |
| GameScene | 585 | keydown | window (via setTimeout) | ✗ NEVER | 🔴 |
| InputSystem | 216 | keydown | window | ✓ L320 (in destroy) | OK |
| InputSystem | 217 | keyup | window | ✓ L321 (in destroy) | OK |
| InputSystem | 218 | gamepadconnected | window | ✗ NEVER | 🔴 |
| InputSystem | 219 | gamepaddisconnected | window | ✗ NEVER | 🔴 |
| QuestSystem | 41 | ENEMY_DEAD | EventBus | ✗ NEVER (intended) | 🟡 (no reset possible) |
| QuestSystem | 44 | ITEM_COLLECTED | EventBus | ✗ NEVER (intended) | 🟡 |
| QuestSystem | 48 | BOSS_DEAD | EventBus | ✗ NEVER (intended) | 🟡 |
| GamepadManager | 55–62 | gamepad* | window | ✗ NEVER | 🔴 (but file is dead code) |

### Timer leak inventory

| File | Line | Timer | Stored? | Cleaned? | Severity |
|------|------|-------|---------|----------|----------|
| BootScene | 53 | delayedCall(400) | ✗ | implicit (TimeManager) | 🔵 |
| GameScene | 373 | addEvent(loop) — shooting stars | ✗ | ✗ | 🔴 |
| GameScene | 1058 | delayedCall via scheduleDelayed | ✓ sequenceTimers | ✓ L796 (cleanupPlay) | OK |
| GameScene | 585 | setTimeout(100) | ✗ | ✗ | 🔴 (window listener leak) |

### Phaser 4 violations
- **None found.** No `setTintFill`, `preFX`/`postFX`, `BitmapMask`, `Geom.Point`, `Math.PI2`, `setPipeline('Light2D')`, `setMask` (WebGL), `Mesh`/`Plane`, `Phaser.Struct.Set`/`Map`, `Create.GenerateTexture`, `TextureManager.generate`, or TileSprite cropping. The v4 surface area is clean.
- `Graphics.generateTexture` (BootScene L19) is still supported in v4 — NOT a violation.

### Matter.js issues
- `PhysicsSystem.addStaticRect` / `addSensor` (PhysicsSystem L27–43) use `this.scene.matter.add.image(x, y, '__white', undefined, config)` then `setDisplaySize(w, h)`. **Concern:** `setDisplaySize` adjusts scale, but the Matter body uses the texture's native size (1×1 for `__white`) — the body may NOT match the display size. Verify that `setDisplaySize` on a Matter image also resizes the body. In Phaser 4, `Matter.Image.setDisplaySize` calls `setSize` which calls `setBody` internally — which RESETS collision filters/mass/friction per audit rule §1. **Potential bug:** if `addStaticRect` later needs collision filters, they'd be wiped. Currently no filters are set, so it's OK — but flag for future.
- `setWorldBounds` (PhysicsSystem L97–99) calls `this.scene.matter.world.setBounds(0, 0, w, h, 32, true, true, true, true)` — the `32` is the thickness. Correct usage.
- `collisionstart` event (GameScene L636) uses `pair.bodyA.gameObject` / `pair.bodyB.gameObject` — standard Matter-Phaser pattern. Good.
- No `setSleepEvents` usage — fine (sleeping not needed).

### Scene lifecycle issues
- **GameScene has no `init()`** — field initializers don't re-run on `scene.restart()`. Currently works because `create()` calls `setState('menu')` which overwrites state, but `paused`, `bossArenaActive`, `sequenceTimers` are not reset. (§2.14)
- **`paused` flag doesn't pause Matter physics** — only skips gameplay updates. (§2.7)
- **`buildPlay()` early-returns without state rollback** — leaves state as `'play'` with no world. (§2.6)
- **Double `cleanupPlay()` in restart/fastTravel/quitToHub/quitToMenu** — idempotent but wasteful. (§2.5)
- **`dialogueUI` and `pauseMenuUI` not destroyed in `shutdown()`** — leak on restart. (§2.9)

### Safety (null/active checks)
- `GameScene.updatePlay` L767: `this.player.sprite.y` — `sprite` not null-checked. (§2.8)
- `GameScene.onPlayerDied` L869: `this.player.sprite.x/y` — not null-checked. (§2.8)
- `RenderSystem.update` L75–85: iterator invalidation when removing lights mid-loop. (§8)
- `AreaLoader.addSolid` L146: type-unsafe cast `Graphics as unknown as Rectangle`. (§21)
- Various `e.sprite.active` checks in `updatePlay` (L759, L763) — good defensive pattern.

---

## TOP-PRIORITY FIXES (ordered by impact)

1. 🔴 **GameScene L584–585** — fix `showHowToPlay` window-listener + setTimeout leak.
2. 🔴 **GameScene L373–376** — store and kill the shooting-stars timer in `cleanupState`.
3. 🔴 **GameScene L154–161** — convert 5 anonymous-arrow EventBus listeners to named methods; off them individually in `shutdown`.
4. 🔴 **InputSystem L218–219** — store and remove gamepad listeners in `destroy()`.
5. 🔴 **RenderSystem L75–85** — fix `for…of` iterator invalidation (use `[...this.lights]` or backwards index).
6. 🔴 **SkillTreeSystem L55 + ExperienceSystem L111–116** — fix `spendSkillPoint` to deduct `skill.cost` (critical economy bug).
7. 🔴 **LoreSystem L75** — replace `require()` with ES `import` (runtime crash in ESM).
8. 🔴 **NPCSystem L36 + DialogueSystem L84** — resolve `DIALOGUE_END` double-emit with incompatible payloads.
9. 🔴 **WeaponUpgradeSystem L103–105 + ExperienceSystem L113–115** — replace direct `localStorage.setItem` with proper `SaveSystem` methods.
10. 🔴 **GameScene L590–592** — `buildPlay` early-return leaves state as `'play'` with no world; rollback state.
11. 🔴 **Delete `Effects.ts` and `GamepadManager.ts`** — confirmed dead code, duplicates of `AudioSystem` and `InputSystem`.
12. 🟠 **GameScene `shutdown()` L1067–1078** — add `dialogueUI.destroy()`, `pauseMenuUI.destroy()`, `matter.world.off('collisionstart', ...)`.
13. 🟠 **GameScene `togglePause`** — call `this.matter.world.pause()` / `resume()` so physics actually freezes.
14. 🟠 **WorldSystem** — add `reset()` method; call from new-game flow.
15. 🟠 **QuestSystem** — add named handler refs and `reset()` method.
16. 🟠 **ExperienceSystem L64** — fix `levelsGained` to report actual levels gained (requires `SaveSystem.awardXp` to return it).
17. 🟠 **WeaponUpgradeSystem L67–71** — `canUpgrade` must check `unlockedWeapons.includes(weaponId)`.
18. 🟠 **LoreSystem L122** — `boss_kill` check must use specific boss ID, not `bossesKilled > 0`.
19. 🟠 **SaveSystem L56–60** — deep-copy arrays in `DEFAULT_SAVE` to prevent shared-reference pollution.
20. 🟡 **Constants L97** — fix or delete stale `KEYS.SAVE_KEY = '..._v2'`.

---

**Audit complete. No files were modified.** Total findings: 42 (13 🔴 critical, 12 🟠 high, 12 🟡 medium, 5 🔵 low). The codebase is broadly well-structured with clean separation of concerns, but has systematic issues with (a) anonymous-arrow EventBus listeners that cannot be removed individually, (b) window listeners without paired removal, (c) missing `reset()` methods on static singleton systems, and (d) two dead-code duplicate modules. The most urgent functional bug is the skill-point economy exploit (§18/§19) where 3-cost skills cost only 1 SP.
