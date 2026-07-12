# Phaser 4.2.1 Audit Reference — Critical Rules, Pitfalls & v3→v4 Gotchas

> Compiled from all 28 Phaser skills (`/home/z/my-project/skills/*/SKILL.md` + `references/REFERENCE.md`).
> Use this as a checklist when auditing a Phaser 4.2.1 game. Each skill lists its top critical rules, common "DO NOT" patterns, and migration notes.

---

## 1. physics-matter ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **Matter body position = center of mass**, not top-left (unlike Arcade). `this.matter.add.sprite(x, y, 't')` places the body's center at `(x, y)`.
2. **`setBody` / `setRectangle` / `setCircle` / `setPolygon` RESET ALL PROPERTIES** — mass, friction, collision filters, callbacks are all wiped. Re-apply after any shape change.
3. **Force values are tiny** (`0.01`–`0.1`); velocity values are `1`–`15`. They are NOT pixel-based. `applyForce({x: 0.05, y: 0})` is correct; `applyForce({x: 50, y: 0})` will rocket the body.
4. **`collisionFilter.group` overrides category/mask.** Same positive group = always collide; same negative group = never collide; `0`/different = use category/mask. Sensors still require matching filters to fire events.
5. **Constraints must target the parent body**, never compound body `parts`. 32 collision categories max.

### Right way (compound body + collision callback)
```js
const compound = this.matter.body.create({ parts: [partA, partB] });
const player = this.matter.add.sprite(400, 200, 'hero');
player.setExistingBody(compound);          // re-apply mass/friction/etc. after this
player.setOnCollide((pair) => { /* pair.bodyA, pair.bodyB */ });

// Collision categories
const PLAYER = this.matter.world.nextCategory();  // 0x0002
const ENEMY  = this.matter.world.nextCategory();
player.setCollisionCategory(PLAYER);
player.setCollidesWith([ENEMY]);
```

### Pitfalls
- **DO NOT** call `setBody()` and assume collision filters persist — they're reset.
- **DO NOT** target `compound.parts[i]` in `add.constraint()` — use the parent.
- **DO NOT** forget `setSleepEvents(true, true)` if you want `sleepstart`/`sleepend` to fire.
- **DO NOT** call `convertTilemapLayer(layer)` before `layer.setCollisionByProperty(...)` — collision must be set first.
- **DO NOT** expect `restitution` to average — `Math.max(bodyA.restitution, bodyB.restitution)` wins.
- `body.ignorePointer = true` prevents the mouseSpring from dragging that body.

### v3→v4
- No major Matter API change; `MatterGameObject` injection via `this.matter.add.gameObject(go, opts)` still works.

---

## 2. input-keyboard-mouse-touch ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **`setInteractive()` MUST be called before listening for Game Object pointer events.** Without it, `sprite.on('pointerdown', ...)` will never fire.
2. **Pointer events fire at 3 levels** — Game Object (`pointerdown`), Scene per-object (`gameobjectdown`), Scene global (`pointerdown`). Higher handlers can `event.stopPropagation()`.
3. **`pointer.worldX/worldY` are only valid inside input handlers.** Outside, call `pointer.updateWorldPoint(camera)` first.
4. **`topOnly` defaults to `true`** — only the top-most interactive object receives events. Set `this.input.topOnly = false` to receive on all objects under the pointer.
5. **Gamepad callbacks differ between plugin and instance.** Plugin-level: `(pad, button, value)`. Per-pad: `(buttonIndex, value, button)`. Mixing these is a classic bug.

### Right way (interactive sprite + keyboard)
```js
sprite.setInteractive({ useHandCursor: true });
sprite.on('pointerdown', (pointer, localX, localY, event) => {
  // localX/localY are relative to the GO's top-left
  event.stopPropagation();
});

// Keyboard with capture (prevents browser scroll on arrow keys)
this.input.keyboard.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
const space = this.input.keyboard.addKey('SPACE');
// One-shot detection
if (Phaser.Input.Keyboard.JustDown(space)) { /* fire once */ }
```

### Pitfalls
- **DO NOT** use `pixelPerfect: true` for many objects — expensive (per-pixel alpha test). Prefer geometric hit areas.
- **DO NOT** forget `this.input.setDraggable(sprite)` (or `{draggable: true}` in `setInteractive`) — `setInteractive()` alone does NOT enable drag.
- **DO NOT** assume `pointer.x/y` are world coords — they are screen coords. Use `pointer.worldX/Y` or `cam.getWorldPoint()`.
- **DO NOT** assume gamepad is connected on scene start — check `this.input.gamepad.total > 0` and use `pad1`–`pad4`. `'connected'` only fires for NEW connections.
- **DO NOT** expect touch events during `preload()` — they are not dispatched until `create`.
- Browser extensions (Vimium) can intercept keys — verify when debugging.
- Gamepad API requires HTTPS in modern browsers.

### v3→v4
- No major changes; `Button` class accepts `isPressed` parameter for cross-scene-transition state correctness.

---

## 3. text-and-bitmaptext ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **Canvas `Text` re-renders the entire texture on every `setText`/`setStyle`/`setColor`/`setFontSize`.** Batch changes and call `updateText()` once. For frequently-updated text (scores, timers, damage numbers), use **BitmapText**.
2. **Text origin defaults to (0,0)** — top-left. Sprites default to (0.5, 0.5). Call `text.setOrigin(0.5)` to center.
3. **`setRTL(true)` MUST be called BEFORE `setText()`** — RTL changes how the canvas is constructed.
4. **BitmapText font must be in cache** — load via `this.load.bitmapFont(key, png, xml/json)`. Missing font = console warning + undefined behavior.
5. **`setCharacterTint`/`setWordTint`/`setDropShadow` are WebGL only** — no effect in Canvas renderer.

### Right way (frequently updated text)
```js
// BAD for score updates each frame:
scoreText.setText('Score: ' + score);  // re-creates canvas + re-uploads GPU texture

// GOOD: use BitmapText
this.load.bitmapFont('pixelFont', 'font.png', 'font.xml');
const scoreText = this.add.bitmapText(10, 10, 'pixelFont', 'Score: 0', 24);
scoreText.setText('Score: ' + score);  // only updates vertex data
```

### Pitfalls
- **DO NOT** call `setColor()` thinking it will only change color — it triggers a full canvas rebuild.
- **DO NOT** expect `align: 'center'` to center single-line text — it only affects multi-line. Use `setOrigin(0.5)` for single-line centering.
- **DO NOT** use non-zero `letterSpacing` on Text for large bodies of text — each character is rendered individually. Use BitmapText instead.
- **DO NOT** use `setDropShadow` on DynamicBitmapText or in Canvas renderer — no effect.
- **DO NOT** forget to quote font names with digits/special chars: `fontFamily: '"Press Start 2P"'`.
- `setFill()` and `setColor()` are equivalent aliases.

### v3→v4
- No breaking changes; BitmapText tinting now works correctly in v4.

---

## 4. groups-and-containers ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **Container is EXCLUSIVE by default** — adding a child to a new Container removes it from its previous one. Use `container.setExclusive(false)` to override.
2. **`Container.setScrollFactor(x, y, updateChildren)` does NOT propagate to children by default.** Pass `true` as the third arg: `container.setScrollFactor(0, 0, true)`.
3. **Group is NOT on the display list** — moving a Group does nothing visually. Use Container for transform inheritance.
4. **Container origin is always (0,0)** — position children relative to (0,0); the origin cannot be changed.
5. **Container needs `setSize(w, h)` before `setInteractive()` works** — containers have no implicit size. Pixel-perfect hit testing does NOT work on Containers.

### Right way (HUD pinned to camera)
```js
const hud = this.add.container(10, 10);
hud.setScrollFactor(0, 0, true);  // CRITICAL: third arg = true propagates to children
hud.add([healthBar, scoreText, livesIcon]);
```

### Pitfalls
- **DO NOT** put physics bodies on Container children unless the Container is at (0,0) — bodies will be offset.
- **DO NOT** mix `depth` and display-list reordering — `depth` takes priority after the next sort pass.
- **DO NOT** expect `group.add(child)` to put the child on the display list — only `group.create()` (with `true` second arg) or `this.add.existing()` does.
- **DO NOT** mask Container children individually in Canvas — only the Container itself can be masked (WebGL: masks stack).
- **DO NOT** put a Layer inside a Container — Layer cannot go in Container (reverse is OK).
- `killAndHide(obj)` does NOT remove from group — it only sets `active=false, visible=false` for reuse.
- Container has matrix-math per child per frame — deep nesting multiplies cost.

### v3→v4
- No major changes. Layer is the preferred render-bucketing primitive; Container for transform inheritance.

---

## 5. scenes ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **All `this.scene.*` operations are QUEUED, not immediate.** `this.scene.start('X')` happens on the next SceneManager update — do not rely on X's state in the same frame.
2. **`start()` SHUTS DOWN the calling scene.** Use `launch()` or `run()` if you want both running in parallel.
3. **`switch()` sleeps the current scene; `start()` shuts it down.** `switch()` preserves state; `start()` triggers full SHUTDOWN.
4. **Paused scenes STILL RENDER.** Use `sleep()` to stop both update and render.
5. **Reset state in `init()`, NOT the constructor.** Constructor runs once per instantiation; `init()` runs every start/restart.

### Right way (state reset + shutdown cleanup)
```js
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  init() { this.score = 0; this.gameOver = false; }  // resets every restart
  create() {
    // CRITICAL: clean up on shutdown to avoid stale refs on restart
    this.events.once('shutdown', () => { this.enemies = []; });
  }
}
```

### Pitfalls
- **DO NOT** overwrite `this.sys` — breaks everything.
- **DO NOT** assume `switch()` resumes a paused scene — it RESTARTS. Use `run()` for smart resume/wake/start.
- **DO NOT** expect sleeping scenes to be silent — they can still receive events from other scenes (e.g., global registry events).
- **DO NOT** rely on constructor state resets — they only run once.
- **DO NOT** forget that `pause()` keeps rendering; if you want a frozen scene, use `sleep()`.
- Scenes update in **reverse array order**, render in **forward array order** (last scene in array renders on top).
- `create` event fires AFTER `create()` returns.

### v3→v4
- No major changes; InjectionMap customization via `map` config still supported.

---

## 6. cameras ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **`this.cameras` is the CameraManager, NOT an array.** Array is `this.cameras.cameras`; main camera is `this.cameras.main`.
2. **Viewport vs Scroll are independent.** `setViewport/setPosition/setSize` = on-screen rectangle. `setScroll/scrollX/scrollY` = what world area the camera looks at.
3. **`cam.startFollow(target)` SNAPS on first call.** To avoid a visible snap, set scroll to the target's position first.
4. **Effects do NOT restart by default.** Calling `cam.fade()` while a fade is running does nothing unless you pass `force: true`.
5. **`pan()` OVERRIDES follow** while running — follow resumes after pan completes.

### Right way (HUD camera + main camera with bounds)
```js
const main = this.cameras.main;
main.setBounds(0, 0, 2048, 2048);
main.startFollow(player, false, 0.1, 0.1);  // lerp 0.1 = smooth

// HUD camera (does not scroll)
const hudCam = this.cameras.add(0, 0, 800, 600).setName('hud');
main.ignore(hudGroup);          // main cam doesn't draw HUD
hudCam.ignore(worldGroup);      // HUD cam doesn't draw world

// Convert pointer to world coords (essential with scroll/zoom)
const wp = main.getWorldPoint(pointer.x, pointer.y);
```

### Pitfalls
- **DO NOT** set zoom to 0 — clamped to 0.001 internally but breaks rendering.
- **DO NOT** use `setMask()` in WebGL — logs warning. Use `cam.filters.external.addMask()` instead. `setMask` is Canvas-only (GeometryMask).
- **DO NOT** use non-integer zoom with `roundPixels: true` — causes jitter.
- **DO NOT** forget to call `camControl.update(delta)` in `update()` for `FixedKeyControl`/`SmoothedKeyControl` — they do not auto-update.
- **DO NOT** rotate the viewport — it's always axis-aligned; rotation is render-only.
- **DO NOT** create more than 32 cameras if you need `ignore()` — cameras 33+ get ID 0 and cannot exclude objects.
- `setBounds` only restricts scrolling — objects can still be placed outside.

### v3→v4
- **Camera matrix rewritten.** `Camera#matrix` now = rotation + zoom + scroll (no position). `matrixExternal` = position only. `matrixCombined` = `matrix * matrixExternal`. If you accessed matrices directly, update code.
- Use `TransformMatrix.copyWithScrollFactorFrom(matrix, scrollX, scrollY, scrollFactorX, scrollFactorY)` instead of manually subtracting `camera.scrollX * src.scrollFactorX`.
- Cameras have `filters.internal`/`filters.external` by default — no `enableFilters()` needed.

---

## 7. game-object-components ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **`alpha = 0`, `scale = 0`, `visible = false` ALL clear a render flag** — the object is NOT drawn at all (not just transparent).
2. **`setTintFill()` is REMOVED in v4.** Use `sprite.setTint(color).setTintMode(Phaser.TintModes.FILL)`. Calling `setTintFill()` logs a console error.
3. **`z` is NOT depth** — `transform.z` is a generic coordinate. Use `depth` (Depth component) for render order.
4. **`Mask` component is Canvas-only in v4.** For WebGL masking, use `enableFilters()` then `filters.internal.addMask()`. `setMask()` logs a warning in WebGL.
5. **Flip does NOT affect physics bodies** — it's rendering-only. Track facing direction separately in collision code.

### Right way (v4 tint fill + WebGL mask)
```js
// v3: sprite.setTintFill(0xff0000);  // REMOVED in v4
sprite.setTint(0xff0000).setTintMode(Phaser.TintModes.FILL);  // v4 correct

// v4 WebGL mask (BitmapMask is removed)
sprite.enableFilters();
sprite.filters.internal.addMask(maskShape);
```

### Pitfalls
- **DO NOT** use `setSize()` thinking it changes visual size — it changes internal/native dimensions. Use `setDisplaySize()` for visual size (adjusts scale).
- **DO NOT** mix `depth` and `setToTop()`/`setAbove()` — `depth` wins after the next sort.
- **DO NOT** apply physics bodies to objects with `scrollFactor != 1` — physics uses world position, scroll factor offsets rendering only.
- **DO NOT** call `enableFilters()` lazily inside `update()` — call once in `create()`.
- **DO NOT** expect Shape game objects to support `setTint()` — they don't. Use `setFillStyle(color, alpha)` / `setStrokeStyle(lineWidth, color, alpha)`.
- Tint modes in v4: `MULTIPLY` (default), `FILL`, `ADD`, `SCREEN`, `OVERLAY`, `HARD_LIGHT`.

### v3→v4
- `setTintFill()` removed → `setTint(color).setTintMode(FILL)`.
- Tint color and tint mode are now separate (`tintMode` property + `setTintMode()` method).
- WebGL masking via filters; `setMask()` is Canvas-only.
- New components: `Lighting`, `RenderSteps`, `RenderNodes`, `Filters`, `FilterList`.

---

## 8. v3-to-v4-migration ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules (breaking changes)
1. **FX (`preFX`/`postFX`) → Filters.** `sprite.preFX.addGlow(...)` → `sprite.enableFilters(); sprite.filters.internal.addGlow(...)`.
2. **`BitmapMask` removed.** Use `filters.internal.addMask(maskObject)`. `GeometryMask` still exists (Canvas only).
3. **`setTintFill()` removed.** Use `setTint(color).setTintMode(Phaser.TintModes.FILL)`.
4. **`Geom.Point` removed.** Use `Phaser.Math.Vector2`. All geometry classes now return `Vector2` (Circle, Ellipse, Line, Polygon, Rectangle, Triangle).
5. **`Math.TAU` value changed.** v3: `PI/2` (incorrect). v4: `PI*2` (correct). `Math.PI2` removed → use `Math.TAU`. New: `Math.PI_OVER_2` for `PI/2`.
6. **`Phaser.Struct.Set` and `Phaser.Struct.Map` removed** → use native `Set` and `Map`. Methods like `iterateLocal`, `contains`, `setAll` are gone.
7. **`DynamicTexture`/`RenderTexture` now require explicit `.render()`** — drawing commands are buffered, not executed immediately.
8. **Pipelines → RenderNodes.** Custom WebGL pipelines must be rewritten as render nodes. Do NOT make direct `gl` calls — use an `Extern` game object if you need raw WebGL.
9. **`Mesh` and `Plane` game objects REMOVED.**
10. **`roundPixels` now defaults to `false`** (was `true` in v3). Per-object control via `gameObject.vertexRoundMode`.

### Right way (FX → Filters, BitmapMask → Mask filter)
```js
// v3 FX:
sprite.preFX.addGlow(0xff00ff, 4);
sprite.postFX.addBlur(0, 2, 2, 1);

// v4 Filters:
sprite.enableFilters();
sprite.filters.internal.addGlow(0xff00ff, 4, 0, 1);
sprite.filters.external.addBlur(0, 2, 2, 1);

// v3 BitmapMask:
const mask = new Phaser.Display.Masks.BitmapMask(scene, maskImage);
sprite.setMask(mask);
// v4:
sprite.enableFilters();
sprite.filters.internal.addMask(maskImage);

// v3 ColorMatrix:
colorMatrix.sepia();
// v4:
colorMatrix.colorMatrix.sepia();

// v3 lighting:
sprite.setPipeline('Light2D');
// v4:
sprite.setLighting(true);
```

### Pitfalls / removed APIs
- `Create.GenerateTexture` and `TextureManager.generate` removed.
- `Math.SinCosTableGenerator` removed.
- All legacy polyfills removed (Array.forEach, Array.isArray, console, Math.trunc, performance.now, requestAnimationFrame, Uint32Array).
- Spine 3/4 bundled plugins no longer updated — use Esoteric Software's official plugin.
- `DOMElement` now throws if it has no container.
- `Shader#setTextures()` now REPLACES (not appends) — call once with the full array.
- Compressed textures must be re-compressed with Y=0 at bottom (GL orientation).
- Custom shaders: texture coordinates now use GL conventions (Y=0 at bottom).

### Migration checklist (key items)
- [ ] Replace `preFX`/`postFX` with `filters.internal`/`filters.external`
- [ ] Replace `BitmapMask` with `FilterMask`
- [ ] Replace `setTintFill()` with `setTint().setTintMode(FILL)`
- [ ] Replace `Geom.Point` with `Vector2`
- [ ] Replace `Math.PI2` with `Math.TAU`; `Math.TAU` (if expecting PI/2) with `Math.PI_OVER_2`
- [ ] Replace `Phaser.Struct.Set/Map` with native `Set/Map`
- [ ] Add `.render()` calls to `DynamicTexture`/`RenderTexture`
- [ ] Re-compress compressed textures for new Y-axis orientation
- [ ] Replace `sprite.setPipeline('Light2D')` with `sprite.setLighting(true)`
- [ ] Remove `Mesh`/`Plane` usage
- [ ] Replace derived FX (`Bloom`, `Shine`, `Circle`, `Gradient`) with Actions (`AddEffectBloom`, `AddEffectShine`, `AddMaskShape`) or GameObjects
- [ ] Remove `TileSprite` texture cropping (no longer supported)

---

## 9. v4-new-features ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **Filters are WebGL only.** `enableFilters()` returns early on Canvas. Game objects REQUIRE `enableFilters()` first; cameras have filters by default.
2. **Internal filters run BEFORE camera transform (object-local); External AFTER (screen space).** Internal is cheaper (object region only); External is full-screen.
3. **Filter order matters** — each filter receives the output of the previous one.
4. **`CaptureFrame` requires `camera.setForceComposite(true)`** — otherwise nothing is captured.
5. **`SpriteGPULayer` requires single texture + single image per layer.** Populate once; updating buffer is expensive. "Remove" members by setting `scaleX/scaleY/alpha = 0`.

### Right way (filters on sprite + camera)
```js
const sprite = this.add.sprite(400, 300, 'hero');
sprite.enableFilters();  // MUST call before accessing .filters
sprite.filters.internal.addGlow(0x00ff00, 4);  // object-local space

// Cameras have filters by default — no enableFilters() needed
this.cameras.main.filters.external.addBlur(1, 2, 2, 1);  // screen space
```

### Pitfalls
- **DO NOT** try to change Glow `quality` or `distance` after creation — they're immutable. Destroy and recreate.
- **DO NOT** expect a dedicated `Bloom` filter — use `ParallelFilters` (Threshold + Blur + ADD blend) or `Phaser.Actions.AddEffectBloom()`.
- **DO NOT** update `SpriteGPULayer` members every frame — buffer rebuilds are expensive. Populate once, mutate `alpha`/`scale` to hide.
- **DO NOT** use `TilemapGPULayer` for isometric/hex/staggered maps — orthographic only.
- **DO NOT** forget `generateLayerDataTexture()` after editing tiles on `TilemapGPULayer` — changes won't appear otherwise.
- Lighting changes the shader — breaks render batches. Group lit objects together.

### New v4-only APIs
- New GameObjects: `CaptureFrame`, `Gradient`, `Noise`, `NoiseCell2D/3D/4D`, `NoiseSimplex2D/3D`, `SpriteGPULayer`, `Stamp`, `TilemapGPULayer`.
- New components: `Lighting`, `RenderSteps`, `RenderNodes`.
- New tint modes: `MULTIPLY`, `FILL`, `ADD`, `SCREEN`, `OVERLAY`, `HARD_LIGHT`.
- New filters: `Blend`, `Blocky`, `CombineColorMatrix`, `GradientMap`, `ImageLight`, `Key`, `Mask`, `NormalTools`, `PanoramaBlur`, `ParallelFilters`, `Quantize`, `Sampler`, `Threshold`.
- `setRenderNodeRole(role, nodeName, data?)` to override render nodes per role (`'Submitter'`, `'Transformer'`, `'Texturer'`).

---

## 10. game-setup-and-config ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **Default dimensions changed in v4: width=1024, height=768** (was 800x600 in v3).
2. **`scale` sub-object takes priority over top-level** `width`/`height`/`zoom`/`parent`. Don't set both — leads to confusion.
3. **`Phaser.WEBGL` has NO fallback.** Unlike `AUTO`, if WebGL is unsupported the game fails silently. Use `Phaser.AUTO` for safety.
4. **`parent: null` vs `parent: undefined`.** `undefined` (or omitted) appends to `document.body`. `null` = no parent — you must add the canvas to the DOM yourself.
5. **`fps.target` is advisory only.** Use `fps.limit` to actually cap the frame rate. `fps.limit` can only SLOW DOWN, never speed up beyond the display refresh.

### Right way (Matter + scale + pixel art)
```js
const config = {
  type: Phaser.AUTO,             // WebGL with Canvas fallback
  scale: {
    parent: 'game-container',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1 },
      enableSleeping: true,
      debug: false,
      setBounds: true,           // walls around canvas edges
    },
  },
  input: { gamepad: true },      // enable gamepad
  scene: [BootScene, GameScene],
};
```

### Pitfalls
- **DO NOT** set `transparent: true` and expect `backgroundColor` to work — `transparent` forces `rgba(0,0,0,0)`.
- **DO NOT** use `Phaser.HEADLESS` for production — DOM still required; for unit tests only.
- **DO NOT** use `smoothPixelArt` with Canvas renderer — WebGL only.
- **DO NOT** forget `dom.createContainer: true` requires a `parent` element.
- `Game.destroy()` is ASYNCHRONOUS — flags for destruction on the next frame. Listen for `DESTROY` event.
- `window.FORCE_WEBGL` / `window.FORCE_CANVAS` globals override `config.type` (dev/test only).
- `MatterWorldConfig` does NOT have `timing` field — it's `timing.timeScale` under `matter.timing.timeScale`? Actually, the worklog notes "Removed PhaserGame matter.timing (not in MatterWorldConfig)". Use `matter.runner.fps` for fixed timestep. Fields that exist: `gravity`, `setBounds`, `enableSleeping`, `positionIterations`, `velocityIterations`, `constraintIterations`, `timing.timeScale`, `autoUpdate`, `debug`, `runner`.
- GameConfig does NOT have `contextCreation` (removed in v4) — pass your own context via `canvas` + `context` instead.

### v3→v4
- Default dimensions 1024x768 (was 800x600).
- New `Phaser.Scale.EXPAND` mode (value 6).
- New `smoothPixelArt` (WebGL only).
- New `render.renderNodes` config for custom node registration.
- New `skipUnreadyShaders` for parallel shader compilation.
- New `pathDetailThreshold` for Graphics WebGL path combining.

---

## 11. tweens ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **Tweens auto-destroy after completion** unless `persist: true`. Storing a reference and using it after completion = stale.
2. **`repeat` is per-property; `loop` restarts the entire tween.** `repeat: 1` = property plays twice total. `loop: -1` means `onComplete` NEVER fires.
3. **`onComplete` never fires for infinite tweens** — use `tween.completeAfterLoop(0)` to end gracefully.
4. **Seeking suppresses events by default.** `tween.seek(ms)` does not dispatch events unless you pass `true` as the third arg.
5. **Tweens skip properties starting with `_`** (underscore prefix). Use this to protect internal fields.

### Right way (chain + relative values + callbacks)
```js
this.tweens.chain({
  targets: this.player,
  tweens: [
    { x: 300, duration: 1000, ease: 'Power2' },
    { y: '+=100', duration: 800, ease: 'Bounce.easeOut' },  // relative
    { alpha: 0, duration: 400, onComplete: () => this.player.destroy() },
  ],
});

// Stagger across multiple targets
this.tweens.add({
  targets: [s1, s2, s3],
  alpha: 0,
  duration: 500,
  delay: this.tweens.stagger(100, { from: 'center' }),
});
```

### Pitfalls
- **DO NOT** use `this.tweens.stagger()` with a single target — no visible effect.
- **DO NOT** forget to destroy a `persist: true` tween when done — it stays in memory.
- **DO NOT** set `duration: 0` — internally clamped to 0.01ms minimum.
- **DO NOT** rely on `onComplete` for `loop: -1` tweens — never fires.
- **DO NOT** destroy a tween's target without stopping the tween first — tween auto-completes early if `target.isDestroyed === true`.
- `TweenManager.timeScale` multiplies with `Tween.timeScale` — setting either to 0 freezes.
- Callbacks receive `(tween, targets)` — not `(target)`.
- Easing string names are case-insensitive; `'Power2'` = `'Cubic.easeOut'`. Bare names default to `.Out` variant.

### v3→v4
- No major changes to the Tween API.

---

## 12. time-and-timers ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **`repeat: N` means N+1 total fires** (1 initial + N repeats). Off-by-one source.
2. **`delay: 0` with `repeat`/`loop` throws** `'TimerEvent infinite loop created via zero delay'`. Always use a non-zero delay.
3. **`this.time.delayedCall(delay, callback)` is the safe one-shot pattern.** For repeating, use `addEvent({delay, callback, repeat})`.
4. **Timelines start PAUSED.** You MUST call `timeline.play()` after `this.add.timeline([...])`.
5. **`timer.reset(config)` does NOT re-add to the Clock.** You must call `this.time.addEvent(timer)` again.

### Right way (delayed call + repeating timer + remove)
```js
// One-shot
this.time.delayedCall(1000, () => this.scene.start('GameOver'));

// Repeating (5 total fires: 1 initial + 4 repeats)
const timer = this.time.addEvent({
  delay: 500,
  callback: this.fireBullet,
  callbackScope: this,
  repeat: 4,
});

// Stop
timer.remove();          // silently
timer.remove(true);      // fires callback one last time

// Timeline (always starts paused)
const tl = this.add.timeline([
  { at: 0, run: () => this.title.setAlpha(1) },
  { at: 1000, tween: { targets: this.title, y: 100, duration: 500 } },
]);
tl.play();
```

### Pitfalls
- **DO NOT** omit `callbackScope` with a regular function — `this` defaults to the TimerEvent, not the scene. Use arrow functions or `callbackScope: this`.
- **DO NOT** expect `timeline.timeScale` to affect its spawned tweens — only the timeline's own elapsed counter. Set tween `timeScale` separately.
- **DO NOT** use `once: true` on a Timeline event and expect it to reappear on `reset()` or loop — it's spliced permanently.
- **DO NOT** assume `addEvent()` is immediate — pushed to a pending list, active next frame.
- **DO NOT** confuse `paused = true` with `timeScale = 0` — both freeze timers but `paused` skips the update loop entirely (prefer for full freeze).
- Scene pause also pauses the Timeline.

### v3→v4
- No major changes.

---

## 13. events-system ⚡ (HIGH-PRIORITY AUDIT TARGET)

### Critical rules
1. **`on()` does NOT auto-remove.** Every `scene.restart()` adds duplicate listeners — memory leak. Always clean up in `shutdown`:
   ```js
   this.events.once('shutdown', () => this.input.off('pointerdown', this.shoot, this));
   ```
2. **`off()` requires the EXACT same function reference AND context.** Anonymous arrow functions cannot be removed — store a reference or use class methods.
3. **`this.game.events` and `this.events` are DIFFERENT emitters.** Game events persist across scene restarts; scene events don't. Clean up game.events listeners on SHUTDOWN.
4. **`changedata-{key}` callback args differ from generic `changedata`.** Key-specific: `(parent, value, previousValue)`. Generic: `(parent, key, value, previousValue)`. Easy to miss.
5. **Sleeping scenes can still receive events** from other scenes (global registry). Be careful with active listeners on sleeping scenes.

### Right way (cleanup on shutdown + cross-scene communication)
```js
create() {
  this.events.on('update', this.onUpdate, this);     // named method, this context
  this.game.events.on('blur', this.onBlur, this);    // game-level persists!

  this.events.once('shutdown', () => {
    this.events.off('update', this.onUpdate, this);
    this.game.events.off('blur', this.onBlur, this);  // CRITICAL
  });
}

// Cross-scene via global registry (NOT scene events)
this.registry.set('score', 100);                          // Scene A
// Scene B:
this.registry.events.on('changedata-score', (game, val) => this.scoreText.setText(val));
// Cleanup registry listeners too:
this.events.once('shutdown', () => this.registry.events.off('changedata-score', handler));
```

### Pitfalls
- **DO NOT** use arrow literals for listeners you intend to remove: `this.input.on('pointerdown', () => this.shoot())` — cannot be removed.
- **DO NOT** use `removeAllListeners()` without an arg unless you want to nuke all events on that emitter.
- **DO NOT** confuse `shutdown` (scene stops, can restart) with `destroy` (permanent). Restart fires `SHUTDOWN` → `START` → `CREATE`, never `DESTROY`.
- **DO NOT** forget that input events fire in order: Game Object → `gameobjectdown` on `this.input` → `pointerdown` on `this.input`. `stopPropagation()` halts further levels.
- Named constants preferred: `Phaser.Scenes.Events.SHUTDOWN`, `Phaser.Input.Events.POINTER_DOWN`, etc.
- Key-suffix pattern: `'filecomplete-image-logo'`, `'animationcomplete-walk'`, `'changedata-score'`.

### v3→v4
- No major changes; eventemitter3 still underlying.

---

## 14. animations

### Critical rules
1. **Animations are GLOBAL by default.** `this.anims.create()` registers across all scenes. Do NOT recreate in every scene — it logs a warning and returns the existing one. Guard with `if (!this.anims.exists(key))`.
2. **`repeat: -1` NEVER fires `animationcomplete`.** Use `stop()` to end infinite animations — fires `animationstop` instead.
3. **`frameRate` BEATS `duration`.** If both are set, `frameRate` wins. Set only `duration` (leave `frameRate` null) to control total length.
4. **Local animations override global.** Same key on a sprite's local map takes priority.
5. **Mix delays only work with `play()`.** `playAfterDelay`/`playAfterRepeat` bypass mixes.

### Right way (global anims + chained playback)
```js
// In BootScene or PreloadScene (once):
if (!this.anims.exists('walk')) {
  this.anims.create({
    key: 'walk',
    frames: this.anims.generateFrameNames('player', { prefix: 'walk_', start: 1, end: 8, zeroPad: 2 }),
    frameRate: 12,
    repeat: -1,
  });
}

// In GameScene:
sprite.play('walk');
sprite.chain('idle');  // queued after walk stops
```

### Pitfalls
- **DO NOT** expect `animationcomplete` for `repeat: -1` — use `animationstop`.
- **DO NOT** set both `frameRate` and `duration` expecting duration to win — frameRate wins.
- **DO NOT** forget per-frame `duration` is ADDITIVE on top of base msPerFrame.
- **DO NOT** call `sprite.play(key)` thinking it queues — it STOPS the current anim (fires `animationstop`). Use `play(key, true)` to skip if already playing.
- **DO NOT** leave chained anims unintentionally — clear with `sprite.anims.chain()` (no args).
- Chained anims fire after `animationstop` too — clear queue before stopping if unwanted.
- `generateFrameNumbers` end=-1 means last frame; `__BASE` is excluded automatically.

### v3→v4
- No breaking changes.

---

## 15. audio-and-sound

### Critical rules
1. **Sounds are NOT auto-cleaned on scene shutdown.** Looping sounds continue across scene changes unless explicitly stopped. Stop them in `shutdown`.
2. **Browser autoplay policy: audio is locked until user interaction.** Phaser handles this automatically; listen for `UNLOCKED` event if you need to know when ready.
3. **Always provide multiple audio formats** — `this.load.audio('bgm', ['bgm.ogg', 'bgm.mp3'])`. MP3 broadest; OGG lacks Safari; AAC/M4A good for Safari/iOS.
4. **HTML5 Audio needs `instances` for simultaneous playback** — `this.load.audio('shot', 'shot.mp3', { instances: 4 })`. Default is 1. WebAudio has no such limit.
5. **Spatial audio is WebAudio only** — silently ignored on HTML5 Audio fallback.

### Right way (BGM + SFX + cleanup)
```js
preload() {
  this.load.audio('bgm', ['bgm.ogg', 'bgm.mp3']);
  this.load.audio('jump', ['jump.ogg', 'jump.mp3']);
}
create() {
  this.bgm = this.sound.add('bgm', { loop: true, volume: 0.4 });
  this.bgm.play();
  this.events.once('shutdown', () => this.bgm?.stop());   // CRITICAL
}
jump() { this.sound.play('jump'); }  // fire-and-forget (auto-destroys)
```

### Pitfalls
- **DO NOT** use `this.sound.play(key)` if you need to control the sound later — it auto-destroys. Use `this.sound.add(key)` for a retained reference.
- **DO NOT** rely on `pan` on iOS/Safari — `StereoPannerNode` not supported, events fire but no audible effect.
- **DO NOT** forget `pauseOnBlur` (default `true`) pauses all sounds when tab loses focus.
- **DO NOT** assume `seek` works on a stopped sound — no effect.
- SoundManager is shared/global — `this.sound` in every scene references the same manager.
- iOS 17/18+ can interrupt audio on background — Phaser handles via `context.suspend()`/`resume()` on `VISIBLE` game event.

### v3→v4
- No major changes.

---

## 16. data-manager

### Critical rules
1. **Mutating a stored object/array does NOT trigger `changedata`.** The reference must change. Re-set with a new reference: `sprite.setData('inv', [...inv, 'potion'])`.
2. **`values` proxy requires `set()` first.** Direct assignment `sprite.data.values.newKey = 1` does NOT create the event proxy — use `sprite.setData('newKey', 1)` first.
3. **Registry listeners PERSIST across scene restarts.** Always remove them on SHUTDOWN — they are on `game.registry.events`, not `scene.events`.
4. **Frozen DataManagers fail SILENTLY.** `set/remove/inc/toggle/pop/merge` all no-op without error or event. Easy to forget you froze the data.
5. **`reset()` emits NO events** — clears silently. Iterate and `remove()` individually if you need removal events.

### Right way (per-GO data + registry + cleanup)
```js
player.setData('hp', 100);
player.on('changedata-hp', (go, val, prev) => { if (val <= 0) go.destroy(); });

// Cross-scene via registry:
this.registry.set('score', 0);
// In another scene:
const handler = (game, val) => this.scoreText.setText(val);
this.registry.events.on('changedata-score', handler);
this.events.once('shutdown', () => this.registry.events.off('changedata-score', handler));
```

### Pitfalls
- **DO NOT** confuse `changedata` (4 args: parent, key, value, prev) with `changedata-{key}` (3 args: parent, value, prev) — key is omitted in the latter.
- **DO NOT** use `inc()` on non-numeric keys — `+` operator concatenates strings, coerces booleans.
- **DO NOT** expect scene data to reset on restart — `DataManagerPlugin` removes its shutdown listener but does NOT clear data. Manually `this.data.reset()` on shutdown if needed.
- **DO NOT** confuse `get()` (returns copy for primitives, reference for objects) with `values` (live proxy that emits events on assignment).
- Keys are case-sensitive — `'gold'` ≠ `'Gold'`.
- `getAll()` returns a shallow copy — primitive values are independent, but nested objects share references.

### v3→v4
- No major changes.

---

## 17. filters-and-postfx

### Critical rules
1. **Filters are WebGL only.** `enableFilters()` returns early if WebGL is unavailable.
2. **Game objects REQUIRE `enableFilters()` before accessing `filters`.** Cameras have filters by default.
3. **Internal = object-local space (cheaper, region-sized); External = screen space (full-screen, more expensive).** Use internal wherever possible.
4. **Filter order matters** — output of one feeds the next.
5. **Glow `quality` and `distance` are immutable** — destroy and recreate the filter to change them.

### Right way (filters on sprite + camera)
```js
const sprite = this.add.sprite(400, 300, 'enemy');
sprite.enableFilters();
const glow = sprite.filters.internal.addGlow(0x00ff00, 4);
glow.outerStrength = 8;        // mutable
glow.setActive(false);         // toggle without removing
sprite.filters.internal.remove(glow);

// Camera filters (no enableFilters() needed):
this.cameras.main.filters.external.addVignette(0.5, 0.5, 0.5, 0.8);

// Bloom via ParallelFilters (no dedicated Bloom filter):
const pf = this.cameras.main.filters.internal.addParallelFilters();
pf.top.addThreshold(0.5, 1);
pf.top.addBlur();
pf.blend.blendMode = Phaser.BlendModes.ADD;
pf.blend.amount = 0.5;
```

### Pitfalls
- **DO NOT** use `setMask()` in v4 WebGL — logs warning. Use `filters.internal.addMask()`.
- **DO NOT** forget `camera.setForceComposite(true)` for `CaptureFrame`.
- **DO NOT** expect `BitmapMask` — removed in v4. Use `FilterMask`.
- **DO NOT** leave many objects with active filters — each creates extra draw calls. Performance-test early.
- **DO NOT** forget to set `mask.autoUpdate = false` + `mask.needsUpdate = true` for static game-object masks (default re-renders each frame).
- `ignoreDestroy = true` on a controller lets it survive FilterList destruction for reuse — manage lifecycle manually.
- v3 derived FX (`Bloom`, `Shine`, `Circle`, `Gradient`) removed — use Actions or new GameObjects.

### v3→v4
- `preFX`/`postFX` → `filters.internal`/`filters.external`.
- `BitmapMask` removed → `FilterMask`.
- Glow `quality` semantics changed: now an integer (default 10), not 0-1 fraction.
- `enableFilters()` is a new explicit opt-in step for game objects (cameras have it by default).

---

## 18. geometry-and-math

### Critical rules
1. **`Geom.Point` is REMOVED in v4.** Use `Phaser.Math.Vector2` or plain `{x, y}`. The `GEOM_CONST.POINT` constant still exists but the class doesn't.
2. **Angles are in RADIANS throughout the math API.** Use `Phaser.Math.DegToRad()` / `RadToDeg()` for conversion. The `Phaser.Math.TAU` constant (2*PI) is new in v4.
3. **Vector2 methods MUTATE in place** and return `this`. Call `.clone()` first to preserve the original.
4. **EaseMap short names default to `.Out` variant.** `'Quad'` = `Quad.Out`, not `Quad.In`. Use full `'Quad.easeIn'`.
5. **Squared distance is faster** than Euclidean (avoids `Math.sqrt`). Use `Distance.Squared` or `vec.distanceSq()` for comparisons.

### Right way (vector math + intersection)
```js
const v = new Phaser.Math.Vector2(3, 4);
v.length();      // 5
const result = v.clone().normalize().scale(10);  // preserve v

const rect = new Phaser.Geom.Rectangle(10, 20, 200, 100);
rect.contains(50, 50);    // true
Phaser.Geom.Intersects.RectangleToRectangle(rectA, rectB);

const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);  // radians
const clamped = Phaser.Math.Clamp(value, 0, 100);
```

### Pitfalls
- **DO NOT** confuse `Phaser.Math.TAU` (v4 = 2*PI) with v3 (was PI/2 incorrectly). If migrating v3 code expecting PI/2, use `Phaser.Math.PI_OVER_2`.
- **DO NOT** use `Math.PI2` — removed. Use `Math.TAU`.
- **DO NOT** allocate Vector2 in hot loops — reuse output objects via `out` parameters.
- **DO NOT** use Geom objects as game objects — they're pure data. Render via Graphics or Shape game objects.
- **DO NOT** expect `Polygon.contains` to work on complex self-intersecting polygons — uses ray-casting (even/odd rule).
- Intersection `Get*` functions allocate arrays — pass a reusable `out` array.

### v3→v4
- `Geom.Point` removed → `Vector2`.
- All geometry classes return `Vector2` instead of `Point`.
- `Math.TAU` value changed from `PI/2` to `PI*2`. `Math.PI2` removed. New: `Math.PI_OVER_2`.
- `Phaser.Struct.Set`/`Map` → native `Set`/`Map`.

---

## 19. graphics-and-shapes

### Critical rules
1. **Graphics `arc()` uses RADIANS; `this.add.arc()` Shape factory uses DEGREES.** Mixing these up is the most common bug.
2. **Set style BEFORE drawing.** `fillStyle()` / `lineStyle()` must precede the corresponding `fill*` / `stroke*` call. They are NOT retroactive.
3. **Graphics has NO Origin or GetBounds component** — use `setPosition(x, y)` and `displayOriginX`/`displayOriginY`. Shape game objects DO have Origin and GetBounds.
4. **`generateTexture()` uses the Canvas API.** Gradient fills (`fillGradientStyle`) will NOT appear in generated textures.
5. **Shape objects do NOT support `setTint()`** — use `setFillStyle(color, alpha)` / `setStrokeStyle(lineWidth, color, alpha)`.

### Right way (imperative drawing vs Shape object)
```js
// Graphics (dynamic, multiple shapes, paths, gradients):
const gfx = this.add.graphics();
gfx.fillStyle(0xff0000, 1);
gfx.fillRect(50, 50, 200, 100);
gfx.lineStyle(3, 0x00ff00, 1);
gfx.strokeCircle(400, 150, 60);

// Shape object (single shape, full GO features, can be tweened/physics-enabled):
const rect = this.add.rectangle(150, 100, 200, 100, 0x00aa00);
rect.setStrokeStyle(3, 0xff0000);  // isStroked defaults to false — must call explicitly
```

### Pitfalls
- **DO NOT** expect `Shape` objects to support tint methods — they don't.
- **DO NOT** expect `Graphics` to have origin — it doesn't. Position via `setPosition`.
- **DO NOT** forget `setStrokeStyle()` on Shapes — `isStroked` defaults to `false`.
- **DO NOT** use `Graphics` for static shapes — `generateTexture()` + Sprite is faster. Graphics replays the command buffer and rebuilds geometry each frame.
- **DO NOT** use `IsoBox`/`IsoTriangle` with strokes — fill-only.
- **DO NOT** use `Line` shape with fill — stroke-only (constructor takes `strokeColor` not `fillColor`).
- v4: Grid uses `stroke` properties (renamed from `outline` in v3). Rectangle supports rounded corners.
- `pathDetailThreshold` (v4 new) skips nearby vertices in Graphics WebGL paths.

### v3→v4
- Grid shape: `outline` properties renamed to `stroke`.
- Rectangle now supports rounded corners.
- New `pathDetailThreshold` config for Graphics.

---

## 20. loading-assets

### Critical rules
1. **Keys are unique per type.** A second `this.load.image('bg', ...)` is silently ignored if `'bg'` already exists. Remove the old texture first to replace.
2. **Forgetting `this.load.start()` outside `preload`.** If you call load methods in `create()` or later, the Loader does NOT auto-start — call `this.load.start()` manually.
3. **`setPath` appends a trailing slash; setting `this.load.path` directly requires you to include it.**
4. **File keys include the prefix.** `this.load.setPrefix('MENU.')` + `this.load.image('bg', ...)` → cache key is `'MENU.bg'`. Use the full key when referencing.
5. **Sprite sheet ≠ atlas.** Use `spritesheet()` for fixed-size grids (referenced by index). Use `atlas()` for packed atlases with named frames.

### Right way (preload + outside-preload + chain-loading)
```js
preload() {
  this.load.image('sky', 'assets/sky.png');
  this.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });
  this.load.audio('jump', ['assets/jump.ogg', 'assets/jump.mp3']);
}

// Outside preload:
create() {
  this.load.image('extra', 'assets/extra.png');
  this.load.once('complete', () => this.add.image(400, 300, 'extra'));
  this.load.start();  // CRITICAL
}

// Chained loads:
preload() {
  this.load.json('level1', 'level1.json');
  this.load.on('filecomplete-json-level1', (key, type, data) => {
    this.load.image(data.images);  // batch-load from JSON
  });
}
```

### Pitfalls
- **DO NOT** expect `update()` to fire during `preload()` — it's paused. `preupdate`, `postupdate`, and `render` still fire.
- **DO NOT** expect progress to monotonically increase — adding files mid-load can decrease it.
- **DO NOT** forget `crossOrigin: 'anonymous'` when loading from another domain (especially for WebGL textures).
- **DO NOT** confuse `imageLoadType: 'XHR'` (default, blob) with `'HTMLImageElement'` — the latter helps with CORS in some environments.
- **DO NOT** expect "Collection of Images" tilesets to work — Tiled parser requires single image per tileset.
- The `maxRetries` property (default 2) is per-file at creation; adjusting after has no effect on existing files.
- Scene `pack` config loads files BEFORE `preload()` — good for progress bar assets.

### v3→v4
- Default dimensions changed (1024x768 from 800x600).
- `loader.maxRetries` default 2 (was 0 in early v3).

---

## 21. particles

### Critical rules
1. **No `ParticleEmitterManager`** — removed since v3.60. `this.add.particles()` returns a `ParticleEmitter` directly.
2. **`speed` vs `speedX`/`speedY`:** setting `speed` deactivates `speedY` (radial mode). Setting `speedX`/`speedY` switches to point mode (`radial: false`).
3. **`color` overrides `tint`** — mutually exclusive; `color` (array) takes priority.
4. **`frequency: 0` means emit every frame** (max rate), NOT "never." Use `emitting: false` to prevent emission.
5. **`frequency: -1` = explode mode** — won't flow automatically. Use `explode()` for bursts.

### Right way (flow + burst + zones)
```js
// Flow emitter
const emitter = this.add.particles(400, 300, 'spark', {
  speed: 100, lifespan: 2000,
  scale: { start: 1, end: 0, ease: 'cubic.out' },
  alpha: { start: 1, end: 0 },
  emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 50) },
});

// Burst
const burst = this.add.particles(400, 300, 'spark', {
  speed: { min: 100, max: 300 }, lifespan: 1000, emitting: false,
});
burst.explode(30);

// Death zone (kill particles leaving a circle)
emitter.addDeathZone({ type: 'onLeave', source: new Phaser.Geom.Circle(400, 300, 200) });

// Follow target
emitter.startFollow(player, 0, -20, true);  // x, y offset, trackVisible
```

### Pitfalls
- **DO NOT** set both `moveToX` and `moveToY` partially — both must be set to activate; overrides `angle` and `speed`.
- **DO NOT** confuse `emitting: false` (no new particles, alive ones update) with `active: false` (entire emitter frozen).
- **DO NOT** confuse `'stop'` event (emission stopped) with `'complete'` (last alive particle died).
- **DO NOT** expect `frequency: 0` to mean "never" — it means every frame.
- **DO NOT** set `maxParticles` thinking it limits alive count — it limits TOTAL objects. Use `maxAliveParticles` for visible limit.
- `hold` freezes a particle at end of life for N ms before dying.
- `advance` pre-warms the emitter so particles are visible on first frame.
- `reserve(count)` pre-allocates particles to avoid GC spikes.

### v3→v4
- No major API changes since 3.60.

---

## 22. physics-arcade

### Critical rules
1. **Static bodies do NOT auto-sync.** After changing position, scale, or origin of a static body's Game Object, call `body.reset()` or `gameObject.refreshBody()`.
2. **World events require opt-in.** `'collide'`, `'overlap'`, `'worldbounds'` only fire if `body.onCollide` / `body.onOverlap` / `body.onWorldBounds` is `true`.
3. **`collide` separates bodies; `overlap` only detects.** Use `overlap` for triggers/pickups.
4. **Persistent Colliders (`physics.add.collider`) checked every frame; one-shot `physics.collide()` must be called in `update()` each frame.**
5. **Collision categories: 32 max.** Default category `0x0001`, mask `1`. PhysicsGroup defaults to mask `2147483647`. After changing categories, call `resetCollisionCategory()` to set mask to all bits.

### Right way (static body + categories + collider)
```js
this.platforms = this.physics.add.staticGroup();
this.platforms.create(400, 568, 'ground').setScale(2).refreshBody();  // CRITICAL: refreshBody

const CAT_PLAYER = this.physics.nextCategory();
const CAT_ENEMY  = this.physics.nextCategory();
player.setCollisionCategory(CAT_PLAYER);
enemy.setCollisionCategory(CAT_ENEMY);
player.setCollidesWith([CAT_ENEMY]);

this.physics.add.collider(player, platforms);
this.physics.add.overlap(player, coins, collectCoin, null, this);

// World bounds event
player.body.onWorldBounds = true;
this.physics.world.on('worldbounds', (body, up, down, left, right) => { /* ... */ });
```

### Pitfalls
- **DO NOT** leave `debug: true` in production — expensive.
- **DO NOT** use `useDamping: true` with large drag values — drag becomes a multiplier (e.g., `0.05` = keeps 5%/sec).
- **DO NOT** confuse `immovable` (never moved by collisions) with `pushable = false` (reflects velocity to collider but still separates).
- **DO NOT** change PhysicsGroup `defaults` expecting existing members to update — defaults apply only at member creation.
- **DO NOT** use `overlapOnly` with TilemapLayer expecting per-tile collision settings — every tile is checked.
- **DO NOT** forget `customUpdate: true` requires manual `this.physics.world.update(time, delta)` calls.
- RTree (`useTree: true` default) becomes expensive to rebuild with 5000+ dynamic bodies — consider `useTree: false`.

### v3→v4
- No major changes.

---

## 23. render-textures

### Critical rules
1. **`render()` is REQUIRED.** v4 buffers all drawing commands; nothing appears until `render()` is called (unless `renderMode: 'all'` or `'redraw'`).
2. **Command buffer CLEARS after `render()` by default.** Call `preserve(true)` to keep commands for replay.
3. **`stamp()` ignores the internal camera** — only `draw()` and `capture()` respect the `.camera` property. Texture stamps are positioned absolutely.
4. **`resize()` erases content** — destroys and recreates the framebuffer.
5. **`saveTexture(key)` RENAMES, does not copy.** Calling again with a different key renames. Destroying the RenderTexture without saving first destroys the texture.

### Right way (RT + DynamicTexture + minimap)
```js
// RenderTexture (visible game object)
const rt = this.add.renderTexture(0, 0, 256, 256).setOrigin(0);
rt.clear();
rt.fill(0x000000, 0.5);
rt.draw(sprite, 128, 128);
rt.render();  // CRITICAL

// DynamicTexture (shared texture, cross-scene)
const dt = this.textures.addDynamicTexture('composite', 512, 512);
dt.stamp('coin', null, 64, 64, { scale: 2, angle: 45 });
dt.render();
this.add.image(400, 300, 'composite');

// Auto-render minimap
this.minimap = this.add.renderTexture(700, 50, 150, 100);
this.minimap.setScrollFactor(0).setRenderMode('all').preserve(true);
```

### Pitfalls
- **DO NOT** draw a DynamicTexture to itself — silently skips.
- **DO NOT** use `alpha`/`tint` params on `draw()` with game objects — they only apply to Texture Frames/strings. Game objects use their own alpha/tint.
- **DO NOT** snapshot every frame — `readPixels` blocks the GPU pipeline. Use `snapshotPixel` (cheaper) or cache.
- **DO NOT** expect anti-aliasing on WebGL1 framebuffers — jagged edges. Pre-render sprites instead.
- **DO NOT** forget to handle WebGL context loss — DynamicTexture contents are lost. Listen for `restorewebgl`.
- Default sizes differ: RenderTexture 32x32, DynamicTexture 256x256.
- `forceEven` rounds dimensions up by default — pass `false` for exact odd dimensions.

### v3→v4
- **BREAKING:** Drawing commands are now BUFFERED. Must call `.render()` explicitly. In v3, draw commands executed immediately.
- New: `preserve()`, `callback()`, `capture()`, `renderMode` ('render'/'redraw'/'all').
- `TextureManager.addDynamicTexture` now has `forceEven` parameter.

---

## 24. scale-and-responsive

### Critical rules
1. **Parent element must have calculable dimensions.** Unstyled `<div>` has zero height — breaks centering and scaling. Use `expandParent: true` (default) or set explicit CSS.
2. **Do NOT style the canvas directly.** ScaleManager controls `canvas.style.width/height/marginLeft/marginTop`. External CSS conflicts.
3. **Fullscreen MUST be triggered from `pointerup` (not `pointerdown`)** — touch devices block `pointerdown` requests.
4. **`resize()` is for NONE mode only; `setGameSize()` for FIT/ENVELOP/etc.** Mixing them up breaks scaling.
5. **RESIZE mode = 1:1 pixel mapping** — large displays cause GPU fill-rate pressure on low-end devices.

### Right way (FIT + center + fullscreen)
```js
const config = {
  scale: {
    parent: 'game-container',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280, height: 720,
    min: { width: 640, height: 360 },
    max: { width: 1920, height: 1080 },
  },
  scene: MyScene,
};

// In scene:
this.scale.on('resize', (gameSize, baseSize, displaySize) => {
  this.cameras.resize(gameSize.width, gameSize.height);
  // Reposition UI
});

// Fullscreen (pointerup, not pointerdown):
this.input.on('pointerup', () => this.scale.toggleFullscreen());
```

### Pitfalls
- **DO NOT** apply padding to the parent — ScaleManager doesn't account for it. Use a wrapper element.
- **DO NOT** use `resize()` in FIT mode — use `setGameSize()`.
- **DO NOT** expect fullscreen to work in iframes without `allowfullscreen` attribute.
- **DO NOT** set `width: '100%'` without a sized parent — falls back to `window.innerWidth/innerHeight`.
- `resizeInterval` (default 500ms) is a fallback poll on top of browser resize events.
- iOS Safari height quirks handled via `GetInnerHeight` workaround.

### v3→v4
- New `Phaser.Scale.EXPAND` mode (value 6) — hybrid of RESIZE + FIT.

---

## 25. sprites-and-images

### Critical rules
1. **Use `Image` instead of `Sprite` when you don't need animation.** Sprites are added to the update list and run `preUpdate` every frame. Images skip this overhead.
2. **`z` does NOT control render order.** Use `depth` (Depth component) or `setToTop()`/`setAbove()` etc.
3. **`scale` getter returns the AVERAGE of `scaleX` and `scaleY`.** Check `scaleX`/`scaleY` individually when non-uniform.
4. **`setFrame()` resets size and origin by default.** Pass `false, false` to prevent: `setFrame('f', false, false)`.
5. **Setting `alpha = 0` or `scale = 0` clears a render flag** — the object is NOT drawn at all. Use `setVisible(false)` if you want to explicitly hide without changing alpha.

### Right way (chained setup)
```js
const player = this.add.sprite(100, 200, 'player', 'idle-0')
  .setScale(2)
  .setOrigin(0.5, 1)        // bottom-center
  .setDepth(10)
  .setFlip(true, false)
  .setAlpha(0.8)
  .play('idle');

// Change frame without resetting size/origin:
player.setFrame('walk-1', false, false);
```

### Pitfalls
- **DO NOT** use `setTintFill()` — REMOVED in v4. Use `setTint(color).setTintMode(Phaser.TintModes.FILL)`.
- **DO NOT** expect flip to affect physics bodies — rendering-only.
- **DO NOT** set `scrollFactor` on physics-bodied objects expecting collisions to follow — physics uses world position; scroll factor offsets rendering only.
- **DO NOT** use Sprite for static decor — Image is cheaper.
- **DO NOT** assume `rotation` is in degrees — it's radians. Use `angle` for degrees.
- Rotation direction: right-hand clockwise (0=right, 90°=down, 180°=left, -90°=up).
- `ignoreDestroy = true` prevents destruction — you manage lifecycle.
- `isDestroyed` boolean tracks destroy() state.

### v3→v4
- `setTintFill()` removed.
- Tint color and tint mode are now separate properties.
- TileSprite supports atlas frames and `tileRotation` (new in v4).
- TileSprite no longer supports texture cropping.

---

## 26. tilemaps

### Critical rules
1. **Tileset name in `addTilesetImage` must match Tiled EXACTLY** — first arg is the Tiled tileset name, NOT the Phaser texture key. If they differ, you get `null` and a console warning.
2. **Layer name in `createLayer` must match Tiled EXACTLY.** Group layer children are prefixed `'GroupName/LayerName'`.
3. **Each layer can only be created ONCE.** Calling `createLayer` with the same layer ID twice returns `null`.
4. **`setCollision` MUST be called before physics colliders work.** Without marking tiles as collidable, `physics.add.collider()` passes through all tiles.
5. **TilemapGPULayer requires `generateLayerDataTexture()` after tile edits** — changes won't appear otherwise. Orthographic only; single tileset per layer.

### Right way (Tiled JSON + collision + physics)
```js
preload() {
  this.load.tilemapTiledJSON('map', 'assets/map.json');
  this.load.image('tiles', 'assets/tileset.png');
}
create() {
  const map = this.add.tilemap('map');
  const tileset = map.addTilesetImage('TilesetNameInTiled', 'tiles');  // CRITICAL: Tiled name first
  const ground = map.createLayer('Ground', tileset);                   // CRITICAL: layer name from Tiled
  ground.setCollisionByProperty({ collides: true });                    // CRITICAL: before physics
  this.physics.add.collider(player, ground);

  // Object layer → sprites
  const coins = map.createFromObjects('Items', { name: 'coin', key: 'coin-texture' });
}
```

### Pitfalls
- **DO NOT** use "Collection of Images" tilesets — Tiled parser requires single image per tileset. Embedded tilesets required.
- **DO NOT** expect `setTileIndexCallback` to fire without an active physics collider/overlap.
- **DO NOT** pass `x, y` to `createLayer` thinking they default to (0,0) — they default to the layer offset defined in Tiled.
- **DO NOT** use `TilemapGPULayer` for isometric/hex/staggered maps — orthographic only.
- **DO NOT** use multiple tilesets on a single `TilemapGPULayer` — single tileset only.
- Tile index `-1` means empty; methods return `null` by default. Pass `nonNull: true` to get a Tile with index -1.
- `insertNull: true` in tilemap factory stores `null` for empty cells (saves memory, prevents dynamic placement in empty cells).
- `TilemapGPULayer` max 4096x4096 tiles, up to 2^23 unique tile IDs.

### v3→v4
- New `TilemapGPULayer` (WebGL only, orthographic, single tileset, single quad render).
- Tilemap now supports animated tiles on both CPU and GPU layers.
- `createLayer` 5th arg `gpu: true` enables GPU layer.

---

## 27. curves-and-paths

### Critical rules
1. **`getPoint(t)` uses raw parameter; `getPointAt(u)` uses arc length (evenly spaced).** On a Path, `getPoint` already accounts for arc length across the whole path — but on individual curves, use `getPointAt` for even spacing.
2. **PathFollower uses a Tween internally.** All tween properties (`ease`, `delay`, `repeat`, `yoyo`, callbacks) work. The tween is `persist: true` automatically.
3. **`positionOnPath: false` (default)** — follower's current position becomes the offset from path start. With `true`, the follower snaps to path start and offset is zeroed.
4. **Ellipse curve angles are in DEGREES** — constructor and `startAngle`/`endAngle` accept degrees. Internally stored as radians. `rotation` is radians; `angle` is degrees.
5. **`cubicBezierTo` parameter order with numbers is (endX, endY, cp1X, cp1Y, cp2X, cp2Y)** — end point FIRST, not control points. With Vector2 objects, it's `(cp1, cp2, endPoint)`.

### Right way (path + follower)
```js
const path = this.add.path(100, 200);
path.lineTo(400, 400);
path.splineTo([new Phaser.Math.Vector2(600, 300), new Phaser.Math.Vector2(700, 200)]);

const enemy = this.add.follower(path, 100, 200, 'enemy');
enemy.startFollow({
  duration: 3000,
  positionOnPath: true,    // snap to path start
  rotateToPath: true,      // auto-rotate to face direction
  rotationOffset: 90,      // degrees
  repeat: -1,
  yoyo: true,
});

// Draw the path:
const gfx = this.add.graphics();
gfx.lineStyle(2, 0xffffff, 1);
path.draw(gfx, 64);  // 64 points per curve
```

### Pitfalls
- **DO NOT** expect `moveTo()` to draw — it creates an inactive pseudo-curve that only repositions the end point.
- **DO NOT** expect cached lengths to update when modifying curve control points — call `path.updateArcLengths()`.
- **DO NOT** confuse `closePath()` (adds an explicit Line curve) with `autoClose = true` (only affects `getPoints` output).
- **DO NOT** use Spline with fewer than 4 points — Catmull-Rom interpolation works best with 4+.
- Line curve overrides `arcLengthDivisions` to 1 (uniform by nature).

### v3→v4
- No major changes.

---

## 28. actions-and-utilities

### Critical rules
1. **Actions operate on PLAIN ARRAYS, not Groups directly.** Always call `group.getChildren()` first.
2. **`PlaceOn*`/`Random*` actions need `Phaser.Geom` objects**, not Game Object shapes. For a `Phaser.GameObjects.Circle`, pass `circle.geom`.
3. **`SetXY` defaults `y` to `x`** if `y` is `undefined` or `null`. Pass `0` explicitly if you want y=0 and x=something else.
4. **`step` is multiplied by iteration index, not added cumulatively.** Item 0 gets `value + 0*step`, item 1 gets `value + 1*step`, etc.
5. **`Spread` with a single item places it at the midpoint `(min+max)/2`, NOT at `min`.**

### Right way (grid align + scatter + wrap)
```js
const sprites = [];
for (let i = 0; i < 20; i++) sprites.push(this.add.sprite(0, 0, 'gem'));

Phaser.Actions.GridAlign(sprites, {
  width: 5, height: 4, cellWidth: 64, cellHeight: 64, x: 100, y: 100,
});

// With a Group:
const enemies = this.add.group({ key: 'enemy', repeat: 9 });
Phaser.Actions.PlaceOnCircle(enemies.getChildren(), new Phaser.Geom.Circle(400, 300, 200));

// Step parameter for staggered values:
Phaser.Actions.SetX(sprites, 100, 50);  // x: 100, 150, 200, 250...
```

### Pitfalls
- **DO NOT** pass a Group to Actions — they expect arrays. Use `group.getChildren()`.
- **DO NOT** pass a `Phaser.GameObjects.Circle` to `PlaceOnCircle` — pass `circle.geom` (a `Phaser.Geom.Circle`).
- **DO NOT** use `Shuffle` expecting a new array — it modifies in place and returns the same array.
- **DO NOT** use `GetFastValue` with a dot-path key — it's top-level only. Use `GetValue` for dot paths.
- `AddEffectBloom` / `AddEffectShine` / `AddMaskShape` are v4-only filter-based effects — they return arrays of created effects, not the input array.

### v3→v4
- New v4-only effect actions: `AddEffectBloom`, `AddEffectShine`, `AddMaskShape`.
- New `FitToRegion` action.

---

## Cross-Cutting Audit Checklist

Use this consolidated checklist when auditing any Phaser 4.2.1 game:

### Listener cleanup (most common leak)
- [ ] Every `this.events.on(...)` has a matching `off()` in a `shutdown` listener (or uses `once()`).
- [ ] Every `this.input.on(...)` has a matching `off()` in `shutdown`.
- [ ] Every `this.game.events.on(...)` has a matching `off()` in `shutdown` (persists across restarts!).
- [ ] Every `this.registry.events.on('changedata-*', handler)` has a matching `off()` in `shutdown`.
- [ ] No anonymous arrow function literals used as removable listeners — use named methods or stored refs.

### v3→v4 removed APIs (search for these)
- [ ] `setTintFill()` → `setTint(color).setTintMode(Phaser.TintModes.FILL)`
- [ ] `preFX` / `postFX` → `filters.internal` / `filters.external`
- [ ] `BitmapMask` → `filters.internal.addMask()`
- [ ] `setMask()` in WebGL → `filters.internal.addMask()` (Canvas still uses `setMask`)
- [ ] `Geom.Point` → `Vector2`
- [ ] `Math.PI2` → `Math.TAU`
- [ ] `Math.TAU` (if v3 code expecting PI/2) → `Math.PI_OVER_2`
- [ ] `Phaser.Struct.Set` / `Phaser.Struct.Map` → native `Set` / `Map`
- [ ] `Mesh` / `Plane` game objects → removed
- [ ] `setPipeline('Light2D')` → `setLighting(true)`
- [ ] `ColorMatrix.sepia()` → `colorMatrix.colorMatrix.sepia()`
- [ ] `DynamicTexture`/`RenderTexture` draw calls without `.render()` → add `.render()`
- [ ] `Create.GenerateTexture` / `TextureManager.generate` → removed
- [ ] `TileSprite` texture cropping → removed
- [ ] Bundled Spine plugin → use Esoteric Software's official plugin

### Physics gotchas
- [ ] Matter: re-apply mass/friction/collision filters after `setBody`/`setRectangle`/etc.
- [ ] Matter: constraints target parent body, not compound parts.
- [ ] Matter: collision `group` overrides `category`/`mask`.
- [ ] Arcade: static bodies need `body.reset()` / `refreshBody()` after transform changes.
- [ ] Arcade: `onCollide`/`onOverlap`/`onWorldBounds` must be `true` for events to fire.
- [ ] Arcade: `collide` separates; `overlap` only detects.

### Scene lifecycle
- [ ] State reset in `init()`, not constructor.
- [ ] `shutdown` listener clears arrays and external event listeners.
- [ ] `this.scene.start()` SHUTS DOWN the calling scene — use `launch()` for parallel.
- [ ] `switch()` sleeps; `start()` shuts down.
- [ ] `pause()` still renders; `sleep()` stops both.

### Input
- [ ] `setInteractive()` called before `on('pointerdown')`.
- [ ] `setDraggable()` called (or `{draggable: true}`) for drag — `setInteractive()` alone is not enough.
- [ ] `pointer.worldX/Y` only used inside input handlers (or after `updateWorldPoint`).
- [ ] Gamepad: check `total > 0` on scene start; don't rely on `'connected'` event for pre-existing pads.
- [ ] Gamepad callback signatures: plugin-level `(pad, button, value)` vs per-pad `(index, value, button)`.

### Text
- [ ] BitmapText used for frequently-updated text (scores, timers).
- [ ] `setColor`/`setStyle`/`setText` batched where possible.
- [ ] `setRTL(true)` called BEFORE `setText()`.

### Containers
- [ ] `setScrollFactor(0, 0, true)` — third arg `true` propagates to children.
- [ ] `setSize(w, h)` before `setInteractive()`.
- [ ] No physics bodies on children unless Container is at (0,0).

### Cameras
- [ ] `getWorldPoint(pointer.x, pointer.y)` used instead of raw `pointer.x/y` when camera scrolls/zooms.
- [ ] No `setMask()` in WebGL (use `filters.external.addMask()`).
- [ ] No zoom of 0 (clamped to 0.001 but breaks rendering).
- [ ] `camControl.update(delta)` called manually for keyboard camera controls.

### Time
- [ ] `delay: 0` with `repeat`/`loop` will throw — use non-zero delay.
- [ ] `callbackScope: this` (or arrow function) to preserve `this` in timer callbacks.
- [ ] `timeline.play()` called after `this.add.timeline([...])` (starts paused).
- [ ] `timer.reset()` does NOT re-add — must call `this.time.addEvent(timer)`.

### Game config
- [ ] `type: Phaser.AUTO` (not `WEBGL`) unless you're certain WebGL is supported.
- [ ] No `matter.timing` field (not in MatterWorldConfig — use `matter.runner.fps`).
- [ ] No `contextCreation` field (removed in v4).
- [ ] `parent: null` only if you'll add the canvas yourself; `undefined` = body.

### Filters / RenderTextures
- [ ] `enableFilters()` called before accessing `sprite.filters`.
- [ ] `.render()` called after `draw`/`stamp`/`fill` on RenderTexture/DynamicTexture.
- [ ] `preserve(true)` if you need commands to replay each frame.
- [ ] No more than 32 cameras if you need `ignore()`.

### Audio
- [ ] BGM stopped in `shutdown` (SoundManager is global, doesn't auto-clean).
- [ ] Multiple audio formats provided (OGG + MP3 minimum).
- [ ] HTML5 Audio: `instances` set for simultaneous playback.

### Animations
- [ ] Global anims created once (guard with `if (!this.anims.exists(key))`).
- [ ] No reliance on `animationcomplete` for `repeat: -1` (use `animationstop`).
- [ ] `frameRate` OR `duration` set, not both (frameRate wins).
