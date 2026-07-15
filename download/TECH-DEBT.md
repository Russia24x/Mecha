# بدهی فنی — MECHA: LAST PROTOCOL

> این سند فقط مستندسازی است. هیچ‌کدام از این موارد فیکس نشده‌اند.
> هرکدام باید در یک نشست جدا، با تست کامل، فیکس شود.
> تاریخ ایجاد: 2026-07-15

---

## ۱. navCooldown فرض 60fps

**فایل:** `src/game/ui/UIController.ts` خط ۲۴۷
**شدت:** پایین

**توضیح:**
`navCooldown -= 16` در هر فریم فرض می‌کند که بازی با ۶۰fps اجرا می‌شود (۱۰۰۰/۶۰ ≈ ۱۶ms). در framerates دیگر (مثلاً ۱۴۴fps)، cooldown‌ها ۲.۴ برابر سریع‌تر منقضی می‌شوند، که باعث می‌شود ناوبری گیم‌پد/کیبورد خیلی سریع یا خیلی کند باشد.

**راه‌حل پیشنهادی:**
استفاده از `delta` (پارامتر دوم `update(time, delta)`) به‌جای hardcoded ۱۶:
```ts
this.navCooldown -= delta;  // به‌جای this.navCooldown -= 16;
```
نیاز به تغییر signature متد `update()` در `UIController` دارد.

---

## ۲. ctrl.focusables leak در NavigableOverlay subclasses

**فایل‌ها:** `SettingsUI.ts`، `InventoryUI.ts`، `SkillTreeUI.ts`
**شدت:** پایین (اما با گذشت زمان بدتر می‌شود)

**توضیح:**
این سه فایل هنگام tab/category switch، `navElements` محلی خود را فیلتر می‌کنند ولی **هرگز `ctrl.clearFocusables()` را صدا نمی‌زنند**. بقیه‌ی bgs قدیمی (destroyed) در `ctrl.focusables` باقی می‌مانند.

- `updateFocusVisual()` با `if (!f.bg || !f.bg.active) return` محافظت می‌کند — crash رخ نمی‌دهد
- ولی آرایه رشد می‌کند: هر tab switch N مورد اضافه می‌کند
- پس از ۲۰-۳۰ tab switch، `findNearest` و `updateFocusVisual` روی آرایه‌ای با ۱۰۰+ مورد iterate می‌کنند

**راه‌حل پیشنهادی:**
در `refresh()/refreshOptions()/refreshTree()`، قبل از rebuild:
```ts
// فقط content buttons را پاک کن (نه persistent مثل tabs/back)
const persistentCount = this.navElements.length - oldContentCount;
this.ctrl.clearFocusables();  // همه را پاک کن
// سپس persistent را دوباره ثبت کن
this.refreshCategories();  // یا refreshTabs
```
یا بهتر: متد `removeContentButtons(startIndex)` به `UIController` اضافه شود.

---

## ۳. Double show در OverlayManager.open

**فایل:** `src/game/ui/OverlayManager.ts` خطوط ۷۹ و ۸۴
**شدت:** پایین

**توضیح:**
```ts
static open(id, ui, parent): void {
  this.stack.push({ id, ui, parent });
  ui.show();           // ← show #1 (داخلش ctrl.show() صدا زده می‌شود)
  this.sharedController?.hide();
  const ctrl = ui.getController?.();
  ctrl?.show(280);     // ← show #2 (redundant)
  AudioSystem.play('uiClick');
}
```

`ui.show()` همیشه `ctrl.show()` را صدا می‌زند. سپس `open()` دوباره `ctrl.show(280)` را صدا می‌زند. `UIController.show()` idempotent است (keyHandler را remove + re-add می‌کند)، ولی `focusIndex = 0` و cursor position دوبار reset می‌شوند.

**راه‌حل پیشنهادی:**
حذف خط ۸۴ (`ctrl?.show(280)`) چون `ui.show()` آن را از قبل صدا می‌زند. ولی باید تست شود که همه‌ی UI‌ها `ctrl.show()` را در `show()` خود صدا می‌زنند (PauseMenuUI و HangarUI این کار را می‌کنند).

---

## ۴. Tab double-registration در NavigableOverlay subclasses

**فایل‌ها:** `SettingsUI.ts` (خطوط ۸۷+۹۵)، `InventoryUI.ts` (خطوط ۱۸۸+۱۹۲)، `SkillTreeUI.ts` (خطوط ۱۹۷+۲۰۱)
**شدت:** پایین

**توضیح:**
تب‌ها دو بار ثبت می‌شوند:
1. `registerNav(bg, ...)` — برای موس/Enter (افزودن به `ctrl.focusables`)
2. `ctrl.addTabs([...])` — برای L1/R1 (افزودن به `ctrl.tabs`)

این دو مسور جدا هستند. هر دو `refresh()/refreshOptions()/refreshTree()` را صدا می‌زنند، ولی از مسیرهای متفاوت. اگر منطق آن‌ها drift کند، رفتار متفاوتی برای موس vs گیم‌پد ایجاد می‌شود.

**راه‌حل پیشنهادی:**
یک‌سازی: یا `registerNav` برای تب‌ها حذف شود (فقط `addTabs` استفاده شود)، یا `addTabs` callback از همان `onSelect` استفاده کند که `registerNav` ثبت کرده.

---

## ۵. F3 keydown listener leak در GameScene

**فایل:** `src/game/features/scenes/GameScene.ts` خط ۲۴۷
**شدت:** پایین

**توضیح:**
```ts
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'F3') {
    e.preventDefault();
    this.perfOverlay?.toggle();
  }
});
```

این listener anonymous است و هرگز `removeEventListener` صدا زده نمی‌شود. اگر scene restart شود (مثلاً تغییر زبان در Settings)، listener جدید اضافه می‌شود بدون اینکه قدیمی حذف شود. پس از N restart، N listener فعال هستند.

**راه‌حل پیشنهادی:**
```ts
// ذخیره reference
this.f3Handler = (e: KeyboardEvent) => { ... };
window.addEventListener('keydown', this.f3Handler);

// در shutdown:
if (this.f3Handler) window.removeEventListener('keydown', this.f3Handler);
```

---

## ۶. processCursorHover از internals خصوصی Phaser استفاده می‌کند

**فایل:** `src/game/ui/UIController.ts` خطوط ۴۰۴-۴۰۸
**شدت:** متوسط (fragility)

**توضیح:**
```ts
const inputPlugin = this.scene.input as unknown as {
  _list: Phaser.GameObjects.GameObject[];
  manager: {
    hitTest: (pointer: ..., gameObjects: ..., camera: ..., output?: ...) => ...;
  };
};
```

`_list` و `manager.hitTest` خصوصی/غیرمستند در Phaser 4 هستند. اگر Phaser این internals را در نسخه‌ی بعدی تغییر دهد، cursor mode خاموش خراب می‌شود.

**راه‌حل پیشنهادی:**
استفاده از API عمومی Phaser برای hitTest (اگر وجود دارد)، یا پیاده‌سازی manual hit detection با `getBounds()` و `contains()`.

---

## ۷. Hangar bypass (در حال تحقیق)

**فایل:** `src/game/ui/hub/HubBuilder.ts`، `src/game/features/scenes/GameScene.ts`
**شدت:** متوسط

**توضیح:**
کلیک روی HANGAR nav button در Hub، `GameScene.openOverlay('hangar')` را صدا نمی‌زند (تأیید شده با console.log در `openOverlay`). ولی Hangar باز می‌شود. مسیر واقعی باز شدن ناشناخته است.

**وضعیت:** در حال ریشه‌یابی — جداگانه در این نشست.

---

## خلاصه

| # | مورد | شدت | فایل اصلی |
|---|------|------|-----------|
| ۱ | navCooldown فرض 60fps | پایین | UIController.ts:247 |
| ۲ | focusables leak | پایین | SettingsUI/InventoryUI/SkillTreeUI |
| ۳ | Double show در OverlayManager | پایین | OverlayManager.ts:79,84 |
| ۴ | Tab double-registration | پایین | SettingsUI/InventoryUI/SkillTreeUI |
| ۵ | F3 listener leak | پایین | GameScene.ts:247 |
| ۶ | processCursorHover internals خصوصی | متوسط | UIController.ts:404 |
| ۷ | Hangar bypass | متوسط | HubBuilder/GameScene |
