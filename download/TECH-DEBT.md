# بدهی فنی — MECHA: LAST PROTOCOL

> سند واحد بدهی فنی — ادغام TECH-DEBT.md قدیم + ARCHITECTURE-AUDIT-FULL.md
> تاریخ به‌روزرسانی: 2026-07-15
> هر مورد باید قبل از فیکس، با تست رفتاری تأیید شود (نه فقط خواندن کد).

---

## موارد فیکس‌شده ✅

| # | مورد | فایل | کامیت | روش تأیید |
|---|------|------|-------|-----------|
| N1 | SaveSystem.clear() cache Sets reset | SaveSystem.ts:374 | 136e3bc | خواندن کد |
| N3 | BossEntity.getBossData require() | BossEntity.ts:295 | 136e3bc | خواندن کد |
| N10 | EventBus.off بدون context | GameScene.ts:1090 | 136e3bc | خواندن کد |
| S1 | removeInteractive خراب کردن InputPlugin | UIController.ts | 878e3fc | تست دستی + _list.length |
| S2 | cursor click روی overlay به‌جای دکمه | UIController.ts | aea9e94 | تست گیم‌پد |
| B7 | gameplay در Pause با کیبورد | InputSystem.ts | 22eaaa7 | console.trace |
| B1 | کیبورد چپ/راست در Pause | UIController.ts | e2db393 | VLM |
| A4 | listener leak (setupKeyboard در constructor) | 3 فایل | 9b99300 | active count |
| B2 | صدای دوبل | InputSystem + UIController | f825f59 | call-site logging |
| B3 | focus روی EXIT بعد از tab switch | HangarUI.ts | a3e260b | VLM + Enter |
| B8 | ESC double-action | GameScene.ts | 59c183b | debug logging |
| D-pad | D-pad Up/Down ناوبری UI | InputSystem.ts | f217965 | تست گیم‌پد |
| NaN | slider volume NaN crash | SettingsUI + AudioSystem | aea9e94 | تست گیم‌پد |
| Start | Start button toggle pause | PauseMenuUI.ts | 3f584de | تست گیم‌پد |
| Phantom | kbEdge نشت بعد از unpause | InputSystem + GameScene | 46ba04c | خواندن کد |
| Selector | valueText destroyed crash | SettingsUI.ts | 332eb22 | تست گیم‌پد |
| Phaser | Phaser.Math.Clamp بدون import | AudioSystem.ts | 0b3261a | تست دستی |

---

## موارد نیاز به تأیید رفتاری (قبل از فیکس) ⚠️

### اولویت بالا — نیاز به تست دستی

| # | مورد | فایل | شدت | توضیح | وضعیت |
|---|------|------|------|--------|-------|
| **N2** | Quest progress ذخیره نمی‌شود | QuestSystem.ts:22 | بالا | پیشرفت quest (progress[]) فقط در memory، فقط turned_in ذخیره می‌شود. نیاز به schema migration. | نیاز به طرح migration |
| **N4** | ExperienceSystem/WeaponUpgradeSystem از SaveSystem.persist عبور می‌کنند | ExperienceSystem.ts:113, WeaponUpgradeSystem.ts:103 | بالا | مستقیماً localStorage.setItem با key hardcoded می‌زنند. در نسخه‌بندی آینده split-brain. | نیاز به تست: XP گم می‌شود؟ |

### اولویت متوسط — فیکس ایزوله

| # | مورد | فایل | شدت | توضیح | وضعیت |
|---|------|------|------|--------|-------|
| **N5** | FullscreenManager listener leak | SettingsUI.ts:179 | متوسط | onChange در refreshOptions صدا زده می‌شود، unsubscribe ذخیره نمی‌شود | تأیید نشده |
| **N6** | LoreSystem boss_kill ignores ID | LoreSystem.ts:121 | متوسط | همه‌ی boss loreها با هر boss kill باز می‌شوند | تأیید نشده |
| **N7** | Enemy contact damage hardcoded | GameScene.ts:654 | متوسط | بر اساس ID prefix، نه EnemyData.damage | تأیید نشده |
| **N8** | tryHover 1/60 delta | PlayerEntity.ts:699 | متوسط | فرض 60fps، در 144fps سریع‌تر | تأیید نشده |
| **N9** | EnemyEntity.updateFlash 16ms | EnemyEntity.ts:486 | پایین | فرض 60fps | تأیید نشده |
| **N14** | InputSystem.update array allocation | InputSystem.ts:328 | پایین | pad.buttons.map هر frame | تأیید نشده |
| **N15** | CombatSystem redundant body query | CombatSystem.ts:29 | پایین | dealDamage دومین body query | تأیید نشده |
| **N17** | Slider cursor fallback stale mouse | SettingsUI.ts:279 | متوسط | cursor mode از activePointer.x استفاده می‌کند | تأیید نشده |
| **N18** | InventoryUI weapons wrong type | InventoryUI.ts:326 | پایین | type:'material' به‌جای 'weapon' | تأیید نشده |

### اولویت پایین — بدهی فنی کم‌ریسک

| # | مورد | فایل | شدت | توضیح |
|---|------|------|------|--------|
| **N11** | GamepadManager dead code | shared/GamepadManager.ts | پایین | duplicate of InputSystem، unused |
| **N12** | Projectile.checkOverlapsLegacy dead | Projectile.ts:194 | پایین | هرگز اجرا نمی‌شود |
| **N13** | PlayerEntity.switchWeapon dead var | PlayerEntity.ts:367 | پایین | list variable unused |
| **N16** | MetroidvaniaController redundant check | MetroidvaniaController.ts:100 | پایین | defensive but redundant |
| **N19** | SaveSystem.awardXp no cap | SaveSystem.ts:147 | پایین | XP accumulates at max level |
| **N20** | BossEntity.fireBeam resets lastFireAt | BossEntity.ts:181 | پایین | may be intentional |
| **N21** | WorldMapSystem boss heuristic | WorldMapSystem.ts:72 | پایین | non-linear boss order |
| **N22** | enemyCounter module-level | EnemyEntity.ts:18 | پایین | IDs grow unbounded |
| **N23** | BossEntity.die no scene-active check | BossEntity.ts:262 | پایین | EventBus emit on shutdown |
| **N24** | PostureBar never destroyed on decay | EnemyEntity.ts:155 | پایین | minor memory per enemy |
| **N25** | No save data checksum | SaveSystem.ts:62 | پایین | trivial cheating |
| **N26** | Hardcoded values | Various | پایین | should be in data files |

---

## بدهی فنی ساختاری (از TECH-DEBT قدیم)

| # | مورد | فایل | شدت | وضعیت |
|---|------|------|------|-------|
| TD1 | navCooldown فرض 60fps | UIController.ts:247 | پایین | تأیید شده |
| TD2 | focusables leak در NavigableOverlay subclasses | Settings/Inventory/SkillTree | پایین | تأیید شده |
| TD3 | Double show در OverlayManager | OverlayManager.ts:79,84 | پایین | تأیید شده |
| TD4 | Tab double-registration | Settings/Inventory/SkillTree | پایین | تأیید شده |
| TD5 | F3 listener leak | GameScene.ts:247 | پایین | تأیید شده |
| TD6 | processCursorHover Phaser internals | UIController.ts:404 | متوسط | تأیید شده |

---

## God Classes (نیاز به refactoring در آینده)

| کلاس | خطوط | پیشنهاد split |
|------|-------|---------------|
| AreaLoader | 1370 | AreaLoader + AreaRenderer + AreaDecorationFactory |
| GameScene | 1104 | (قبلاً 1978 بود) — قابل قبول |
| PlayerEntity | 1090 | PlayerEntity + PlayerCombat + PlayerAbilities |
| MechaSpriteFactory | 973 | (pure drawing — قابل قبول) |

---

## پیشنهاد: تست خودکار برای SaveSystem

SaveSystem منطق خالص است (بدون Phaser/canvas). چند تست unit ساده می‌تواند:
- N1 (clear) — همیشه تأیید شود
- N2 (quest progress) — وقتی فیکس شد
- N4 (persist bypass) — وقتی فیکس شد
- N19 (XP cap)
- N25 (migration)

این تست‌ها در چند ثانیه، بدون مرورگر، اجرا می‌شوند و از رگرسیون جلوگیری می‌کنند.

---

## موارد فیکس‌شده (جلسه 2026-07-22 تا 2026-07-23) ✅

| # | مورد | فایل | کامیت | روش تأیید |
|---|------|------|-------|-----------|
| Save-v4 | Save System v4 — IndexedDB migration | ProfileDB, ProfileManager, SaveSystem, AutoSaveManager, migrate.ts | 6778496-4cc9eb7 | 86-step snapshot diff + migration test (28/28) + leak test + browser verification |
| Legacy-42 | حذف ۴۲ فایل dead code | features/ (全部), shared/Save.ts, shared/SkillTree.ts, shared/SaveManager.ts | 400680b | tsc 159→4, full build, runtime playthrough |
| Menu-LOAD | منو: LOAD GAME + CONTINUE fix | MenuBuilder.ts, GameScene.ts | c201a67 | browser test |
| Menu-BACK | باگ BACK از profile select (منو خالی) | GameScene.ts | c98edc1 | browser test |
| Slider-Null | اسلایدر null glTexture crash | SettingsUI.ts | ced9d2a | error reproduction + fix |
| Slider-Mouse | اسلایدر موس: click-to-jump + drag | SettingsUI.ts | dccaecb | browser test |
| Slider-Gamepad | اسلایدر گیم‌پد: تنظیم پیوسته | SettingsUI.ts, UIController.ts | 1fe03b4, 443d521, 4cc9eb7 | physical gamepad test (5/5 pass) |
| Slider-Nav | حذف categories از focusable list | SettingsUI.ts | 1fe03b4 | code analysis + gamepad test |
| Slider-Arch | isSliderFocused check مستقیم (حذف flag) | UIController.ts | 443d521 | gamepad test + code analysis |
| SkillTreeScene | حذف SkillTreeScene legacy (مسیر شکسته) | features/scenes/SkillTreeScene.ts | 400680b | Phase 0.5 investigation |
| Race-Cond | SaveSystem flushToIndexedDB race condition | SaveSystem.ts | 0fb5657 | debug logging + code analysis |
| Write-Fail | SaveSystem write failure recovery | SaveSystem.ts | 421eedb | monkey-patch test (test 9) |

---

## موارد باقی‌مانده (اولویت P0 — محتوا)

| # | مورد | توضیح | اولویت |
|---|------|--------|--------|
| Content-II | Act II (The Drowned Wastes) | empty stub — نیاز به level design، enemies، boss | P0 |
| Content-III | Act III (The Lost City) | empty stub | P0 |
| Content-V | Act V (Orbital Descent) | empty stub — truth reveal، The Architect | P0 |
| Content-Final | Final Act (The Last Protocol) | separate small act — The Silent Protocol، binary choice ending | P0 |
| Boss-3 | Leviathan Hulk (Act II) | referenced in WORLD_BIBLE، کد ندارد | P0 |
| Boss-4 | Iron Magistrate (Act III) | referenced in WORLD_BIBLE، کد ندارد | P0 |
| Boss-5 | The Architect (Act V) | referenced in WORLD_BIBLE، کد ندارد | P0 |
| Boss-6 | The Silent Protocol (Final Act) | referenced in WORLD_BIBLE، کد ندارد | P0 |
| Quest-2+ | Quest‌های بیشتر | فقط ۱ quest تعریف شده | P1 |
| ShopSystem | سیستم فروشگاه | Kara has shopId but no ShopSystem | P1 |
| CompanionAI | سیستم AI companion | ۷ companion تعریف شده، CompanionEntity فقط بصری | P1 |
| Music | موسیقی | 0 tracks (AUDIO_BIBLE specifies 10%) | P1 |
| Weapon-Unlock | 1 سلاح unobtainable | laser (no unlock path). plasma_cannon + energy_blade boss-gated ✓ | P1 |
| Paint-Unlock | 3 paint unobtainable | military_green, protocol_white, rust | P1 |

---

## موارد باقی‌مانده (اولویت P2 — polish)

| # | مورد | توضیح |
|---|------|--------|
| TD1 | navCooldown فرض 60fps | UIController.ts:247 |
| TD2 | focusables leak در NavigableOverlay subclasses | Settings/Inventory/SkillTree |
| TD3 | Double show در OverlayManager | OverlayManager.ts:79,84 |
| TD4 | Tab double-registration | Settings/Inventory/SkillTree (categories هم tab هم focusable — Settings fixed) |
| TD5 | F3 listener leak | GameScene.ts:247 |
| TD6 | processCursorHover Phaser internals | UIController.ts:404 |
| GodClass-GameScene | GameScene 1269 lines | قابل قبول ولی monitor |
| GodClass-PlayerEntity | PlayerEntity 1090 lines | نیاز به refactor در آینده |
