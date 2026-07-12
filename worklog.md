---
Task ID: overlay-fix-v3.1
Agent: main
Task: Fix root causes of overlay navigation, gamepad in hub, mouse in pause, ESC in game, add Return to Hub, hide HUD in hub. Make code modular.

Work Log:
- Read full GameScene.ts (1084 lines), InputSystem.ts, all UI panels (Pause, Settings, SkillTree, Inventory, Quest, Map, HUD)
- Identified 6 ROOT CAUSES:
  1. InputSystem.init() only called by PlayerEntity during buildPlay() — keyboard listeners NOT attached in menu/hub
  2. Hub nav icons never registered in menuButtons[] — gamepad nav did 0%0=NaN
  3. closeOverlay() called setState('play') → buildPlay() → rebuilt entire game world
  4. Overlays were treated as states in state machine (settings/skills/inventory/quests/map)
  5. Overlay rectangles had setInteractive() blocking mouse on buttons
  6. HUD not explicitly destroyed when entering hub

- Created OverlayManager.ts — unified overlay stack management (open/close/back navigation)
- Rewrote InputSystem.ts: split init() (attaches listeners, called in GameScene.create) from setCallbacks() (called by PlayerEntity). ESC now sets both pausePressed AND backPressed.
- Rewrote GameScene.ts (1078 lines):
  - Main states only: menu | hub | play | gameover | victory
  - Overlays managed by OverlayManager (NOT states)
  - openOverlay(id) — creates UI on demand, tracks parent (hub/play)
  - closeOverlay() — destroys UI, returns to parent WITHOUT rebuilding play
  - Hub nav items registered as Focusable buttons (gamepad works)
  - makeHubNavBtn + makeHubCardBtn — both focusable + clickable
  - quitToHub() — cleans up play, destroys HUD, enters hub
  - quitToMenu() — separate from quitToHub
- Updated PauseMenuUI.ts:
  - Added "Return to Hub" button (pause.quit_hub)
  - Removed setInteractive() from overlay rect (was blocking mouse)
  - 9 buttons in grid (was 8)
- Updated all overlay UIs (Settings, SkillTree, Inventory, Quest, Map): removed setInteractive from overlay rectangles
- Updated PlayerEntity.ts: uses InputSystem.setCallbacks() instead of init(), clearCallbacks() in destroy()
- Updated EventBus.ts: off() now accepts optional fn (was required, caused 5 errors)
- Fixed 15+ pre-existing TypeScript errors:
  - Removed old v2.0 files (features/combat, features/physics, features/player, features/rendering, features/boss, features/enemies, features/ui, shared/Save.ts)
  - Renamed GameScene.physics → physicsSys (conflicted with Phaser.Scene.physics)
  - Added EnemyState type, bossId to SectionData, ITEM_USED to GameEvent
  - Fixed DialogueSystem duplicate isActive identifier (renamed field to _isActive)
  - Fixed PhysicsSystem.bodiesInCircle (Phaser 4 has no intersectCircle, used intersectRect)
  - Fixed PhysicsSystem.setBounds (thickness is number, not boolean)
  - Fixed CombatSystem Matter.Body reference (declared global)
  - Fixed PlayerEntity GameObject x/y cast
  - Fixed LoreSystem inventory type
  - Removed PhaserGame contextCreation (not in Phaser 4 GameConfig)
  - Removed PhaserGame matter.timing (not in MatterWorldConfig)
- Added localization keys: pause.quit_hub (EN: "RETURN TO HUB", FA: "بازگشت به هاب")
- TypeScript: 0 errors in game code (was 30+)

Stage Summary:
- ALL 6 root causes fixed at the architecture level (not patches)
- OverlayManager provides clean, modular overlay lifecycle
- InputSystem works from menu onward (not just in play)
- Hub gamepad navigation works (nav icons are focusable)
- Mouse works in pause menu (overlay no longer blocks)
- ESC works everywhere (sets both pausePressed + backPressed)
- "Return to Hub" button added to pause menu
- HUD destroyed when entering hub (hub is separate environment)
- 0 TypeScript errors in entire game codebase
- Old v2.0 dead code removed (8 files/dirs)

---

Task ID: skill-audit
Agent: general-purpose (sub-agent)
Task: Read all 28 Phaser 4 skill files (SKILL.md + references/REFERENCE.md) and extract a concise but complete list of critical rules, pitfalls, and best practices to audit a Phaser 4.2.1 game against.

Work Log:
- Read /home/z/my-project/worklog.md (overlay-fix-v3.1 context from prior task).
- Read all 28 SKILL.md files under /home/z/my-project/skills/*/:
  1. physics-matter, 2. input-keyboard-mouse-touch, 3. text-and-bitmaptext, 4. groups-and-containers,
  5. scenes, 6. cameras, 7. game-object-components, 8. v3-to-v4-migration, 9. v4-new-features,
  10. game-setup-and-config, 11. tweens, 12. time-and-timers, 13. events-system,
  14. animations, 15. audio-and-sound, 16. data-manager, 17. filters-and-postfx,
  18. geometry-and-math, 19. graphics-and-shapes, 20. loading-assets, 21. particles,
  22. physics-arcade, 23. render-textures, 24. scale-and-responsive, 25. sprites-and-images,
  26. tilemaps, 27. curves-and-paths, 28. actions-and-utilities.
- Read all 8 references/REFERENCE.md files (loading-assets, sprites-and-images, v4-new-features,
  game-object-components, cameras, input-keyboard-mouse-touch, scenes, particles).
- Wrote comprehensive markdown audit report to /home/z/my-project/phaser4-audit-report.md
  (covers each of the 28 skills with: top critical rules, "DO NOT" pitfalls, right-way code
  snippets, and v3->v4 migration notes; plus a cross-cutting audit checklist).

Stage Summary:
- Deliverable: /home/z/my-project/phaser4-audit-report.md (single markdown document, ~28 skill
  sections + consolidated checklist).
- Highlighted HIGH-PRIORITY audit targets: physics-matter, input, text, groups/containers,
  scenes, cameras, components, v3-to-v4 migration, v4 new features, game-config, tweens, time,
  events.
- Key recurring audit themes captured:
  * Listener cleanup on scene SHUTDOWN (game.events + registry.events persist across restarts).
  * v4 removed APIs: setTintFill, preFX/postFX, BitmapMask, Geom.Point, Math.PI2, Struct.Set/Map,
    Mesh/Plane, setPipeline('Light2D'), DynamicTexture.render() now required, TileSprite crop,
    Create.GenerateTexture.
  * v4 new systems: Filters (enableFilters() required on GOs), RenderNodes, Lighting component,
    new tint modes, TilemapGPULayer, SpriteGPULayer, CaptureFrame.
  * Physics: Matter setBody resets all props; Arcade static bodies need refreshBody(); events
    require opt-in (onCollide/onOverlap/onWorldBounds).
  * Scenes: operations are queued; start() shuts down caller; pause() still renders.
  * Containers: setScrollFactor(x, y, TRUE) to propagate; setSize before setInteractive.
  * Cameras: getWorldPoint() for pointer coords; no setMask() in WebGL (use filters).
  * Timers: delay:0 with repeat throws; timelines start paused; reset() does not re-add.
  * Game config: no matter.timing field; no contextCreation field; default 1024x768.

---

Task ID: audit-entities
Agent: general-purpose (sub-agent)
Task: Line-by-line audit of 6 entity/combat files against Phaser 4.2.1 rules.

Files audited:
1. src/game/entities/player/PlayerEntity.ts (533 lines)
2. src/game/entities/enemies/EnemyEntity.ts (332 lines)
3. src/game/entities/boss/BossEntity.ts (234 lines)
4. src/game/entities/combat/Projectile.ts (175 lines)
5. src/game/systems/CombatSystem.ts (96 lines)
6. src/game/systems/PhysicsSystem.ts (110 lines)

Work Log:
- Read /home/z/my-project/phaser4-audit-report.md (1273 lines, all 28 skill sections + checklist).
- Read all 6 target files in full.
- Verified against Phaser 4.2.1 source in node_modules/phaser/src/:
  * Confirmed __WHITE texture is 4x4 PNG (Config.js:672).
  * Confirmed MatterImage constructor calls setRectangle(this.width, this.height) from frame (MatterImage.js:138) — body size = texture frame size.
  * Confirmed ComputedSize.setDisplaySize only sets displayWidth/displayHeight (scale), does NOT call setBody/setRectangle (ComputedSize.js:141).
  * Confirmed MatterPhysics exposes intersectRay/Point/Rect but NOT intersectCircle (MatterPhysics.js:604-711).
  * Confirmed Matter is exposed ONLY as Phaser.Physics.Matter.Matter (index.js:17), NOT as window.Matter/global (grep found 0 hits in dist).
  * Confirmed World.setBounds signature: (x,y,w,h,thickness,left,right,top,bottom) (World.js:796).

Stage Summary (CRITICAL findings — full detail in agent response):
- [CRITICAL] CombatSystem.ts:49 — `Matter.Body.applyForce(...)` references a global `Matter` that is NEVER set at runtime (declare global is type-only). Will throw ReferenceError on every melee hit with knockback. Fix: use `Phaser.Physics.Matter.Matter.Body.applyForce(...)`.
- [CRITICAL] PhysicsSystem.ts:31,40,47 + PlayerEntity:105 + EnemyEntity:59 + BossEntity:57 + Projectile:63 — `setDisplaySize()` does NOT resize the Matter body. All bodies created from `__white` (4x4) texture remain 4x4. Static walls, player, enemies, boss, projectiles all have 4x4 collision bodies regardless of visual size. Fix: call `setRectangle(w, h, opts)` AFTER setDisplaySize, then re-apply mass/friction/filters (audit rule: setBody resets all props).
- [BUG] BossEntity.ts:142 `case 'beam': this.fire(pp); this.fire(pp);` — second fire() is no-op due to 200ms cooldown (line 159). Beam only fires 1 set of 3 bullets instead of 6.
- [BUG] BossEntity.ts:193 — `stageStartTime!` non-null assertion on optional property; if undefined → `now - undefined = NaN` passed to recordBossKill.
- [BUG] BossEntity.ts:186 — delayedCall doesn't check `this.isAlive` (unlike line 103); bossGfx may be destroyed when callback fires.
- [BUG] Projectile.ts:114 — `if (!sprite.x && !sprite.y) return;` only skips objects at EXACTLY (0,0); objects at (0, N) or (N, 0) bypass the guard. Logic error.
- [PERF] Projectile.ts:106 — `this.scene.children.list.forEach(...)` per projectile per frame = O(N*P). 50 projectiles × 200 children = 10k iterations/frame. Use Matter Query.point or spatial partitioning.
- [PERF] CombatSystem.ts:35 — `getAllBodies()` on every dealDamage call = O(N) per hit. Cache or use targeted lookup.
- [PERF] No projectile pooling — new Projectile() + 4 trail Arcs allocated per shot, GC pressure.
- [PERF] PlayerEntity position getter (line 203) + getAimDirection (line 362) allocate Vector2 every call; called multiple times per frame.
- [BUG] PlayerEntity.ts:330 — `if (input.heldFire) this.tryFire()` polls fire every frame AND InputSystem.fire callback fires tryFire on press → duplicate trigger (mitigated by cooldown but wasteful).
- [DEAD CODE] PlayerEntity.ts:257 — `const list = Object.keys(...)` computed but never used.
- [MEMORY] EnemyEntity.ts:17 — module-level `enemyCounter` grows unbounded across scene restarts unless resetEnemyIds() is called (verify caller).
- [SAFETY] PlayerEntity takeDamage(220)/heal(231) access `this.sprite.x/y` without `.active` check (alive flag guards, but defense-in-depth missing).
- [FORCE] CombatSystem.ts:49 knockback uses applyForce with values 0.05–0.18 on bodies of mass ~0.06 → Δv ~0.05/frame, barely noticeable. Likely should use setVelocity for snappy knockback.
- No event-listener leaks found (entities use EventBus.emit only, no .on). No scene.shutdown listeners needed within these classes (cleanup is via destroy() called by GameScene).
- No Phaser-3-removed APIs detected (no setTintFill, preFX, BitmapMask, Geom.Point, Math.PI2, Struct.Set/Map, Mesh/Plane, setPipeline('Light2D')).


---

Task ID: audit-ui
Agent: general-purpose (sub-agent)
Task: Line-by-line audit of 10 UI panel files against Phaser 4.2.1 rules.

Files audited:
1. src/game/ui/OverlayManager.ts (134 lines)
2. src/game/ui/NavigableOverlay.ts (185 lines)
3. src/game/ui/pause/PauseMenuUI.ts (155 lines)
4. src/game/ui/hud/HUDUI.ts (167 lines)
5. src/game/ui/dialogue/DialogueUI.ts (132 lines)
6. src/game/ui/settings/SettingsUI.ts (160 lines)
7. src/game/ui/skilltree/SkillTreeUI.ts (213 lines)
8. src/game/ui/inventory/InventoryUI.ts (229 lines)
9. src/game/ui/quest/QuestUI.ts (136 lines)
10. src/game/ui/map/WorldMapUI.ts (140 lines)

Work Log:
- Read /home/z/my-project/phaser4-audit-report.md (§2 input, §3 text, §4 containers, §5 scenes, §11 tweens, §12 timers, §13 events).
- Read all 10 target files in full.
- Cross-referenced GameScene.ts integration (OverlayManager.bind/closeAll/destroy, DialogueUI lifecycle, HUDUI lifecycle, PauseMenuUI lifecycle, InputSystem edge-detect semantics for backPressed/jumpPressed/firePressed).

Stage Summary (CRITICAL findings — full detail in agent response):
- [CRITICAL][MEMORY LEAK] DialogueUI.ts:74-75 — `show()` adds a window 'keydown' listener without first removing any existing one. Calling show() twice (or reopening dialogue after a prior show() that wasn't hidden) overwrites `this.advanceHandler` and LEAKS the old listener on window. Each leaked listener still calls advance() on every keydown (even non-Enter/Space keys — see next bug). GameScene.shutdown() does NOT call dialogueUI.destroy(), so if dialogue is visible at scene shutdown the listener survives the restart. Fix: remove existing listener before adding; call dialogueUI.destroy() in GameScene.shutdown().
- [CRITICAL][BUG] DialogueUI.ts:103-105 — `advance()` only checks `DialogueSystem.isActive`, NOT the key code. The comment says "Only respond to Enter/Space/click" but pressing WASD / arrows / any key advances the dialogue. Combined with the window-level listener (not Phaser input), this hijacks all keyboard input while dialogue is open. Fix: in advanceHandler, check `e.key === 'Enter' || e.key === ' '` before advancing.
- [CRITICAL][BUG] SkillTreeUI.ts:79 + 174-179 — `refreshTree()` is called in the constructor (line 79) BEFORE the back button is registered (line 88). At that point navElements = [tab1..tab6]. The skill-node splice at line 175 (`backIdx = length-1`) inserts skill nodes BEFORE the LAST TAB (survival), not before the back button. Result: first-render nav order is [tab1..tab5, skillNodes..., tab6, back] — gamepad Down from tab5 jumps into skill nodes, skipping tab6. Fix: move `this.refreshTree()` AFTER the back-button registerNav call.
- [CRITICAL][BUG] InventoryUI.ts:71 + 87-96 — Same pattern: `refresh()` is called in the constructor (line 71) before the back button is registered (line 80). The refresh filter at line 89 identifies "back" as `idx === arr.length-1` — but during the first refresh the last element is a TAB, not the back button. Any item registered via registerNav during the first refresh at the last position is misidentified as "back" and never destroyed on subsequent refreshes (orphaned nav element pointing to a destroyed bg). Fix: register the back button BEFORE calling refresh() the first time.
- [CRITICAL][BUG] SettingsUI.ts:141 & 153 — Gamepad slider adjust math is wrong: `slider.handle.x = (slider.bg.x - 120) + 240 * slider.value`. slider.bg is created at `x+20` (line 87), so slider.bg.x = x+20. For value=0.5 the handle should be at x+20+120 = x+140, but the code computes x+20-120+120 = x+20 (track start). The handle jumps 120px left of where it should be. Fix: `slider.handle.x = slider.bg.x + 240 * slider.value;`
- [HIGH][BUG] SettingsUI.ts:82, 92, 142, 153 — `fill.width = 240 * v` assigns to the Shape `.width` property directly. In Phaser 4 the Shape `width` setter updates the ComputedSize component but does NOT propagate to the underlying Geom.Rectangle geometry, so the fill rectangle may not visually resize. HUDUI correctly uses `setDisplaySize()` (line 127) for the same pattern. Fix: use `fill.setDisplaySize(240 * v, 8)` (or `fill.setSize(240 * v, 8)`).
- [HIGH][SCROLLFACTOR §4/§13] Pervasive across all NavigableOverlay subclasses (SettingsUI, SkillTreeUI, InventoryUI, QuestUI, WorldMapUI): children added via `this.container.add(...)` are NOT given individual `setScrollFactor(0)`. Only bg+text registered via `registerNav()` (NavigableOverlay.ts:68-69) get scrollFactor(0). All other children — overlay backdrops, titles, section labels, slider tracks/fills/handles, skill-node description/cost/status texts, quest entry texts, area-card texts — have scrollFactor=1 and DRIFT when the camera scrolls. The base NavigableOverlay.ts:40-41 sets `container.scrollFactorX/Y=0` directly which does NOT propagate (per audit §4 #2 and the developer's own comment). The `addFixed()` helper at NavigableOverlay.ts:48-54 was written to solve exactly this but is NEVER called by any subclass (dead code). Fix: either call `addFixed()` for every child, OR add `this.container.setScrollFactor(0,0,true)` at the end of each subclass constructor after all children are added, OR set `.setScrollFactor(0)` on each child at creation.
  - SettingsUI: lines 38 (overlay), 41 (title), 46/52/57 (section labels), 73-75 (track/fill/handle) — only sliderBg+labelEl get scrollFactor(0) via registerNav.
  - SkillTreeUI: lines 51 (overlay), 54 (title), 58 (statsText), 136-156 (skill node bg + 3 untracked text labels) — node bg uses manual setInteractive at 168 but NEVER calls setScrollFactor(0).
  - InventoryUI: lines 47 (overlay), 50 (title), 138 (empty text), 151-167 (slotContainer nested container + cardBg + nameText + descText) — nested containers compound the problem (see next finding).
  - QuestUI: lines 21 (overlay), 24 (title), 61/70/79 (section headers), 87 (empty text), 95-119 (nested entry container + bg + nameText + descText + objective texts).
  - WorldMapUI: lines 22 (overlay), 25 (title), 30 (fog text), 65/71 (act/region headers), 87-111 (nested card container + bg + nameText + statusText).
- [HIGH][NESTED CONTAINERS] InventoryUI.ts:151, QuestUI.ts:95, WorldMapUI.ts:87 — slot/quest/area cards are created as NESTED Containers (slotContainer/entry/card) inside `this.container`, then children (cardBg, nameText, …) are added to the nested container. Setting `setScrollFactor(0)` on the inner bg via registerNav (InventoryUI:203) does NOT pin the nested container itself; the nested container has scrollFactor=1 (default) and scrolls, while its scrollFactor=0 children render at fixed screen positions — producing visual desync (text slides off card when camera scrolls). setInteractive hit-areas on the inner bg also drift because the parent container's transform moves. Fix: set `setScrollFactor(0)` on the nested container AND all its children, or avoid nesting (add cardBg directly to this.container).
- [HIGH][INPUT/HIT-TEST] QuestUI.ts:126 & WorldMapUI.ts:123 — `bg.setInteractive({useHandCursor:true})` is called on a Rectangle that lives inside a NESTED container at (80, y) (QuestUI:95) or (80, y) (WorldMapUI:87). The bg is at local (w/2-80, cardH/2) inside that nested container. Combined with scrollFactor=1 on the nested container (see previous finding), the hit area drifts with the camera — clicks/taps miss the card when the camera has scrolled. registerNav is NOT used here (manual setInteractive), so the bg never gets scrollFactor(0). Fix: use registerNav (which sets scrollFactor(0)) OR set scrollFactor(0) on the nested container.
- [HIGH][MEMORY LEAK] SkillTreeUI.ts:144, 148, 152 — refreshTree() creates 4 Text objects per skill node (nameText line 140, cost text line 144, description text line 148, status text line 152) but only nameText is stored in `skillNodes` (line 158). The other 3 are added to the container but never tracked, so refreshTree()'s cleanup (lines 97-100 which only destroys `el.bg` and `el.text` from navElements) leaves them orphaned in the container. Each tab switch / skill unlock leaks 3*N text objects until the overlay closes. Fix: store all 4 texts (or all sub-objects) per skill node and destroy them in refreshTree cleanup.
- [MEDIUM][TEXT LIFECYCLE §3] NavigableOverlay.ts:134-158, SkillTreeUI.ts:28-37, InventoryUI.ts:20-25 — The `safeSetColor` / `canvas === null` guard is based on a misconception. In Phaser 4 `scene.add.text()` calls `CanvasPool.create()` synchronously in the constructor, so `text.canvas` is NEVER null for a live Text — only for a destroyed one (which the `!text.active` check already catches). The deferred `delayedCall(0, …)` pattern in NavigableOverlay.show() (line 169), SkillTreeUI.refreshTree() (line 188), and InventoryUI.onNavLeft/Right (lines 216, 225) is unnecessary and causes a 1-frame flicker where the container is visible but focus styling is not applied (PauseMenuUI.show() line 113 correctly calls updateFocus() immediately with no flicker). Not a crash bug — the try/catch makes it safe — but the comments are misleading and the deferral adds latency. Fix: call updateNavFocus() synchronously; remove the canvas-null check (keep the active check).
- [MEDIUM][TEXT PERF §3] NavigableOverlay.ts:130-160 — updateNavFocus() calls `el.text.setColor(...)` on EVERY nav element every time focus changes (including on every pointerover/pointerout — line 71-77 fires updateNavFocus). setColor triggers a full canvas rebuild per Text (audit §3 #1). For a 10-button menu, one hover = 10 canvas rebuilds. Fix: only setColor on the element whose focus state actually CHANGED (track previous focusIdx), or use BitmapText for nav labels.
- [MEDIUM][TEXT PERF §3] HUDUI.ts:128,130,135,143 — update() calls setText on healthText, energyText, weaponText, levelText every frame. Canvas Text.setText() rebuilds the canvas + re-uploads the GPU texture each call (audit §3 #1). For per-frame HUD updates this is expensive. Fix: use BitmapText for these 4 dynamic texts.
- [MEDIUM][TWEEN §11] DialogueUI.ts:53-56 — infinite tween (`repeat: -1`) on hintText. destroy() (line 126-129) does NOT call `this.scene.tweens.killTweensOf(this.hintText)`. Per audit §11, destroying a tween's target without stopping the tween first causes early auto-complete — Phaser handles it but it's fragile. Fix: add `this.scene.tweens.killTweensOf(this.hintText)` in destroy().
- [MEDIUM][TWEEN §11] HUDUI.ts:151-160 — toast() starts a yoyo tween on checkpointText but does NOT call `killTweensOf` before adding. Repeated toast() calls stack multiple tweens on the same target/property (alpha), all running simultaneously — wasteful and the last-one-wins alpha behavior is nondeterministic. destroy() also doesn't kill active tweens. Fix: `this.scene.tweens.killTweensOf(this.checkpointText)` at start of toast() and in destroy().
- [MEDIUM][SAFETY] NavigableOverlay.ts:169 — `show()` schedules `delayedCall(0, …)`. If destroy() is called before the timer fires, the timer still fires (it lives on the scene Clock, not the overlay). The `if (this.isVisible)` guard returns true even after destroy() because destroy() does NOT set `this.visible = false` (only `this.container.destroy()` which doesn't touch the local field). The callback then runs updateNavFocus() on an empty navElements array (cleared at line 183) — currently harmless but fragile. Fix: set `this.visible = false` in destroy(), and/or store the timer and `.remove()` it in destroy().
- [MEDIUM][SAFETY] OverlayManager.ts:88-94 — closeAll() calls `top.ui.hide()` and `top.ui.destroy()` in a loop with no try/catch. If one overlay's hide() or destroy() throws, the loop aborts and remaining overlays stay open (and the static `stack` is left half-populated). Fix: wrap each iteration in try/catch and always pop.
- [MEDIUM][BUG] PauseMenuUI.ts:141-145 — backPressed triggers `this.buttons[0]?.onClick()` (Resume). This is correct for pause (B = resume). But backPressed is also consumed by OverlayManager.handleInput (line 118) for overlays — however PauseMenuUI is NOT in the OverlayManager stack (OverlayId excludes 'pause'), so no double-consume. The cooldown is 250ms but backPressed is edge-triggered (one-frame pulse from InputSystem), so holding ESC won't repeat. No bug, but the duplicated backPressed-handling pattern between OverlayManager and PauseMenuUI is fragile — if pause is ever moved into OverlayManager, B would both resume AND close. Document the separation.
- [MEDIUM][DEAD CODE] NavigableOverlay.ts:48-54 — `addFixed()` method is defined but never called by any subclass (grep confirmed: only definition, zero call sites). It was intended to solve the scrollFactor drift problem (which still exists per the HIGH finding above). Either use it everywhere or remove it.
- [LOW][BUG] SkillTreeUI.ts:169-170 — Manual pointerover/pointerout handlers set `bg.setFillStyle(0x243040, 1)` on hover and restore `bgColor` on out, but do NOT sync with updateNavFocus(). When keyboard nav moves focus away from a mouse-hovered card, the card stays fill-colored 0x243040 (hover state) until pointerout fires. Inconsistent with NavigableOverlay's registerNav pattern which syncs hover→focus. Fix: use registerNav, or call updateNavFocus() in the pointerover handler.
- [LOW][BUG] SettingsUI.ts:139,151 — onNavLeft/onNavRight use hardcoded `0` and `1` as min/max instead of `slider.min` / `slider.max` (Slider interface fields at lines 22-23). Currently always 0–1 so no visible bug, but breaks if a slider is added with a different range. Fix: `Math.max(slider.min, slider.value - 0.05)` / `Math.min(slider.max, slider.value + 0.05)`.
- [LOW][BUG] SettingsUI.ts:127 — `this.scene.scene.restart()` on language toggle is aggressive: it shuts down and restarts the entire GameScene (per audit §5 #2-3 `start()`/`restart()` shut down the caller), tearing down the play state, player, enemies, etc. If the user toggles language mid-play, they lose progress to the last checkpoint. Consider a lighter approach (re-render only the overlay texts). Not a Phaser violation, but a UX bug.
- [LOW][SAFETY] PauseMenuUI.ts:148 — `get isVisible() { return this.container.visible; }` accesses `.visible` on the container. After destroy() (line 151), the container is destroyed; accessing `.visible` on a destroyed GameObject may return undefined. Callers must not check isVisible after destroy(). Defense-in-depth: track a local `visible` boolean (like NavigableOverlay does).
- [LOW][SAFETY] DialogueUI.ts:124 — Same pattern: `get isVisible() { return this.container.visible; }`. After destroy() (line 128), unsafe. Fix: local `visible` flag.
- [LOW][FPS ASSUMPTION] NavigableOverlay.ts:93, PauseMenuUI.ts:122 — `this.navCooldown -= 16` hardcodes 60 FPS. At 144 Hz the cooldown decrements too fast (nav feels too sensitive); at 30 Hz too slow (nav feels laggy). GameScene.update() receives `deltaMs` but doesn't pass it to handleNavigation. Fix: pass delta to handleNavigation and subtract actual delta.
- [LOW][PERF] NavigableOverlay.ts:130-160 — updateNavFocus() is O(N) over all navElements per call; called on every pointerover/pointerout/keydown-nav. For large overlays (skill tree with 20+ nodes) this is fine, but combined with the setColor-per-element issue (above) the constant factor is high.
- [INFO][SCROLLFACTOR] HUDUI.ts:31 + 120 — setScrollFactor(0,0,true) is called TWICE: once at line 31 (before children — no-op propagation) and once at line 120 (after children — correct). Line 31 is redundant but harmless. Net behavior is correct.
- [INFO][SCROLLFACTOR] PauseMenuUI.ts:42-43 + every child — PauseMenuUI correctly sets `.setScrollFactor(0)` on EVERY child individually (lines 46, 52, 74, 89). This is the gold-standard pattern. The container.scrollFactorX/Y=0 at lines 42-43 is redundant but harmless. No drift bug here.
- [INFO][SCROLLFACTOR] DialogueUI.ts:63 — Correctly calls `this.container.setScrollFactor(0, 0, true)` AFTER all children are added (lines 29-50). No drift bug.
- No Phaser-3-removed APIs detected in any of the 10 files (no setTintFill, preFX, BitmapMask, Geom.Point, Math.PI2, Struct.Set/Map, Mesh/Plane, setPipeline('Light2D'), Create.GenerateTexture).
- No `enableFilters()` / Filters usage (none needed for these UIs).
- No `delay: 0` with repeat/loop (the `delayedCall(0, …)` calls are one-shot, safe per audit §12 #2).
- EventBus usage is emit-only in these files (no .on that needs cleanup), except via GameScene which handles its own EventBus.off in shutdown.

Top-priority fixes (ordered):
1. DialogueUI: remove-existing-listener-before-add + filter key code + call destroy() in GameScene.shutdown() (CRITICAL leak + input hijack).
2. SkillTreeUI: move refreshTree() after back-button registration (CRITICAL nav-order bug).
3. InventoryUI: move refresh() after back-button registration (CRITICAL orphan-nav bug).
4. SettingsUI: fix gamepad slider handle.x math + use setDisplaySize for fill (CRITICAL slider bug).
5. SkillTreeUI: track all 4 texts per node + destroy on refresh (HIGH memory leak).
6. All NavigableOverlay subclasses: add scrollFactor(0) to non-nav children (overlay backdrops, titles, labels, slider tracks, skill/quest/map card texts) — either via addFixed() or end-of-constructor `setScrollFactor(0,0,true)`.
7. InventoryUI/QuestUI/WorldMapUI: set scrollFactor(0) on nested card containers (or avoid nesting).
8. HUDUI: switch per-frame setText targets to BitmapText; killTweensOf in toast() and destroy().
9. DialogueUI: killTweensOf(hintText) in destroy().


---
Task ID: audit-systems
Agent: general-purpose (systems auditor)
Task: Audit 26 files (3 scenes + 13 systems + 4 world systems + 3 shared + 3 misc) line-by-line against Phaser 4.2.1 audit reference. Output markdown report. Do NOT modify audited files.

Work Log:
- Read /home/z/my-project/phaser4-audit-report.md (1273 lines, 28 skill checklists) and worklog.md (prior UI audit context).
- Read all 26 target files line-by-line (≈4,060 LOC total). Cross-referenced against the audit checklist sections: §1 physics-matter, §2 input, §5 scenes, §11 tweens, §12 time, §13 events, §15 audio, §25 sprites, v3→v4 migration §8.
- Verified findings with Grep: confirmed Effects.ts and GamepadManager.ts are dead code (zero importers); confirmed LoreSystem uses `require()` (non-ESM); confirmed GameScene has 8 EventBus.on with only 3 off'd by reference; confirmed QuestSystem has 3 anonymous-arrow EventBus.on with no reset method; confirmed KEYS.SAVE_KEY is unused stale constant.
- Wrote comprehensive markdown report to /home/z/my-project/audit-systems-report.md (≈600 lines).

Findings Summary (42 total: 13 CRITICAL, 12 HIGH, 12 MEDIUM, 5 LOW):
- No Phaser-4-removed APIs detected anywhere (no setTintFill, preFX, BitmapMask, Geom.Point, Math.PI2, setPipeline('Light2D'), Mesh/Plane, Struct.Set/Map, Create.GenerateTexture).
- CRITICAL listener leaks:
  * GameScene L154-161 — 5 anonymous-arrow EventBus listeners (CHECKPOINT, GAME_STATE, LEVEL_UP, SKILL_UNLOCKED, ABILITY_UNLOCKED) cannot be off'd individually; shutdown uses removeAllListeners which is a footgun for future subscribers.
  * GameScene L584-585 — showHowToPlay adds window keydown listener via setTimeout; never cleaned up in cleanupState/shutdown.
  * InputSystem L218-219 — gamepadconnected/gamepaddisconnected window listeners are anonymous arrows, never removed in destroy(); duplicates accumulate across scene.restart().
- CRITICAL timer leaks:
  * GameScene L373-376 — shooting-stars `this.time.addEvent({loop:true})` not stored, not killed in cleanupState; fires forever on dead state container.
- CRITICAL iterator-invalidation bug:
  * RenderSystem L75-85 — `for (const l of this.lights)` calls `this.removeLight(l)` which splices the array mid-iteration; skips next element.
- CRITICAL economy bug:
  * SkillTreeSystem L55 + ExperienceSystem L111-116 — `spendSkillPoint()` only deducts 1 SP regardless of `skill.cost`; 3-cost skills cost 1 SP.
- CRITICAL runtime crash:
  * LoreSystem L75 — `require('../systems/SaveSystem')` in ESM context throws ReferenceError at runtime when LoreSystem.init() runs.
- CRITICAL event-contract conflict:
  * NPCSystem L36 + DialogueSystem L84 — both emit DIALOGUE_END with incompatible payload shapes ({npcId,flag,value} vs {npcId,dialogueId}); fires twice per interaction.
- CRITICAL direct-localStorage bypass:
  * WeaponUpgradeSystem L103-105 + ExperienceSystem L113-116 — direct `window.localStorage.setItem('mecha_last_protocol_save_v3', ...)` with hardcoded key, bypasses SaveSystem.persist, no window guard (SSR-unsafe).
- CRITICAL state-machine bug:
  * GameScene L590-592 — buildPlay() early-returns on missing area but state is already 'play'; update loop then crashes on uninitialized player.
- CRITICAL dead code:
  * Effects.ts (214 lines) and GamepadManager.ts (141 lines) — zero importers; duplicates of AudioSystem and InputSystem respectively. Recommend deletion.
- HIGH scene-lifecycle issues:
  * GameScene has no init() — field initializers don't re-run on scene.restart(); paused/bossArenaActive/sequenceTimers not reset.
  * GameScene togglePause doesn't call matter.world.pause() — physics still runs when "paused".
  * GameScene shutdown() doesn't destroy dialogueUI or pauseMenuUI — leak on restart.
  * GameScene restartStage/fastTravel/quitToHub/quitToMenu all call cleanupPlay() then setState() which calls cleanupPlay() again — double-cleanup (idempotent but fragile).
  * GameScene onPlayerDied L869 accesses this.player.sprite.x/y without null-check.
- HIGH logic bugs:
  * LoreSystem L122 — boss_kill check uses bossesKilled>0 instead of specific bossId; killing any boss unlocks all boss lore.
  * WeaponUpgradeSystem L67-71 — canUpgrade doesn't check if weapon is unlocked.
  * ExperienceSystem L64 — levelsGained always 1 even when multiple levels gained.
  * WorldSystem — no reset() method; current location persists into new game.
  * QuestSystem — 3 anonymous-arrow listeners, no reset() method.
  * SkillTreeSystem L61-70 — weapon-unlock skills incorrectly add weapon ID to abilities array AND emit ABILITY_UNLOCKED.
- MEDIUM issues:
  * SaveSystem L56-60 — shallow spread of DEFAULT_SAVE shares array references (unlockedAreas, etc.) across clear() calls.
  * Constants L97 — KEYS.SAVE_KEY = '..._v2' is stale (SaveSystem uses _v3); dead code but documentation hazard.
  * EventBus L23-29 — off() falls back to removeAllListeners(event) when no fn passed; dangerous API design.
  * AreaLoader L146 — type-unsafe cast `Graphics as unknown as Rectangle`.
  * CameraSystem L17 — startFollow(...,true,...) enables roundPixels which jitters with non-integer zoom (boss arena 0.85).
  * NPCSystem L49-63 — getActiveDialogue priority matching uses fragile substring includes().
- LOW issues:
  * UIScene.ts — dead code, immediately stops itself.
  * Constants STAGE_1 — legacy dead code, game uses data-driven AreaData now.
  * GamepadManager L57,61 — console.log debug noise (but file is dead anyway).
  * GameScene L556 — O(n²) navItems.indexOf inside forEach.
  * ParticleSystem — no destroy() method, no pooling (acceptable for current scope).
  * AudioSystem — no destroy() method (acceptable for singleton SPA).

Top-priority fixes (ordered by impact):
1. GameScene: fix showHowToPlay window-listener + setTimeout leak (L584-585).
2. GameScene: store and kill shooting-stars timer in cleanupState (L373-376).
3. GameScene: convert 5 anonymous-arrow EventBus listeners to named methods; off individually in shutdown (L154-161).
4. InputSystem: store and remove gamepad listeners in destroy() (L218-219).
5. RenderSystem: fix for...of iterator invalidation — use [...this.lights] or backwards index (L75-85).
6. SkillTreeSystem + ExperienceSystem: fix spendSkillPoint to deduct skill.cost (critical economy bug).
7. LoreSystem: replace require() with ES import (runtime crash).
8. NPCSystem + DialogueSystem: resolve DIALOGUE_END double-emit with incompatible payloads.
9. WeaponUpgradeSystem + ExperienceSystem: replace direct localStorage.setItem with SaveSystem methods.
10. GameScene buildPlay: rollback state on early-return when area is missing.
11. Delete Effects.ts and GamepadManager.ts (confirmed dead code).
12. GameScene shutdown: add dialogueUI.destroy(), pauseMenuUI.destroy(), matter.world.off(collisionstart).
13. GameScene togglePause: call matter.world.pause()/resume() so physics actually freezes.
14. WorldSystem: add reset() method; call from new-game flow.
15. QuestSystem: add named handler refs and reset() method.
16. ExperienceSystem: fix levelsGained to report actual levels gained.
17. WeaponUpgradeSystem: canUpgrade must check unlockedWeapons.includes(weaponId).
18. LoreSystem: boss_kill check must use specific boss ID.
19. SaveSystem: deep-copy arrays in DEFAULT_SAVE.
20. Constants: fix or delete stale KEYS.SAVE_KEY.

Files written:
- /home/z/my-project/audit-systems-report.md (full audit, ~600 lines)

No audited files were modified. Report is read-only reference for the next fix pass.
