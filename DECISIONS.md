# DECISIONS

**چرا هر تصمیم گرفته شده.**
**آخرین به‌روزرسانی: 2026-07-15**

---

## ۱. Phaser 4.2 به جای Phaser 3
**تصمیم:** Phaser 4.2.1 ✅
**دلیل:** WebGL 2.0 support، VAO، instancing، بهبود performance.
**جایگزین:** Phaser 3 (پایدارتر، مستندات بیشتر)

## ۲. Matter.js به جای Arcade Physics
**تصمیم:** Matter.js ✅
**دلیل:** Ragdoll، destructible، compound bodies نیاز به real physics دارند.
**مشکل:** tunneling گلوله‌های سریع → حل: TargetRegistry + overlap detection دستی

## ۳. معماری فایل‌ها
**تصمیم قبلی:** Consolidation به ~۲۰ فایل
**تصمیم فعلی:** ~۶۰+ فایل در src/game/ — رشد طبیعی با اضافه‌شدن controllers، world systems، entities
**دلیل:** single-responsibility مهم‌تر از تعداد فایل‌هاست. AI با context بزرگ‌تر می‌تواند مدیریت کند.

## ۴. ۳ Scene
**تصمیم:** BootScene + GameScene + UIScene(stub) ✅
**دلیل:** کاهش boilerplate. state machine داخلی GameScene کافی است.

## ۵. EventBus
**تصمیم قبلی:** فقط ۶ event
**تصمیم فعلی:** ۲۰+ event — رشد طبیعی با اضافه‌شدن EMP_PULSE, HACK_COMPLETE, QUEST_UPDATED, WEAPON_UNLOCKED, etc.
**دلیل:** event‌های بیشتر coupling پنهان ایجاد نمی‌کنند اگر سیستم‌ها فقط emit/subscribe کنند (نه import همدیگر را).

## ۶. سلاح‌های سه‌سطحی ✅
**تصمیم:** Hitscan (laser/railgun) / Projectile (AR/shotgun/plasma) / Explosive (rocket)
**دلیل:** tunneling در Matter.js برای گلوله‌های سریع. Hitscan با raycast حل می‌کند.

## ۷. FSM دشمن با telegraph ✅
**تصمیم:** patrol → aggro → attack (telegraph→window→recovery) → stagger
**دلیل:** fairness rule — هر حمله باید telegraph شود.

## ۸. Ragdoll با state-swap
**تصمیم قبلی:** alive = sprite → dead = compound Matter body
**وضعیت فعلی:** پیاده‌سازی نشده. دشمن‌ها با particles می‌میرند (no ragdoll).
**دلیل:** اولویت پایین‌تر از سایر features.

## ۹. گیم‌پلی کیبورد/گیم‌پد + موس برای منوها ✅
**تصمیم:** موس فقط برای منوها. aim با W/S یا Right Stick.
**توضیح:** موس در UI کار می‌کند (UIController.addButton). در gameplay، کیبورد/گیم‌پد.

## ۱۰. Procedural Audio ✅
**تصمیم:** Web Audio API با oscillator + noise buffer
**وضعیت:** ۱۹ SFX procedural + ambient drone. موسیقی: ۰ track (آینده).

## ۱۱. Save در localStorage ✅
**تصمیم:** localStorage با key `mecha_last_protocol_save_v3`
**وضعیت:** v3 با migration، cache Sets، quest progress persistence (N2 fix).

## ۱۲. مستندات
**تصمیم قبلی:** ۳ فایل (CURRENT_STATE + NEXT_TASK + DECISIONS)
**تصمیم فعلی:** AGENT_GUIDE.md (canonical) + vision docs (WORLD_BIBLE, etc.) + audit docs (in download/)
**دلیل:** CURRENT_STATE, NEXT_TASK, STATUS حذف شدند (قدیمی و گمراه‌کننده).

## ۱۳. ai/ folder ✅
**تصمیم:** هر task در فایل md جدا.
**وضعیت:** هنوز استفاده می‌شود ولی اولویت پایین.

---

## تصمیمات جدید (بعد از vertical slice)

## ۱۴. سیستم Chassis
**تصمیم:** ۳ کلاس (scout/assault/titan) با multipliers سرعت/HP/melee/fireRate
**دلیل:** تنوع build بدون پیچیدگی کلاس جداگانه.
**وضعیت:** تعریف شده، multipliers در computeStats اعمال می‌شود.

## ۱۵. سیستم Paints
**تصمیم:** ۴ paint (cosmetic فقط)
**دلیل:** شخصی‌سازی بصری سبک.
**وضعیت:** ۱ باز، ۳ قفل (بدون مسیر unlock).

## ۱۶. Companions
**تصمیم:** ۷ companion تعریف شده
**وضعیت:** CompanionEntity وجود دارد ولی CompanionSystem غایب. همه قفل.

## ۱۷. UIController یکپارچه
**تصمیم:** یک سیستم navigation برای همه‌ی UIها
**دلیل:** حذف ۴ سیستم موازی (NavigableOverlay nav, MenuNavHelper, VirtualCursor, custom nav)
**وضعیت:** ✅ پیاده‌سازی شده با focus mode + cursor mode + keyboard handler.

## ۱۸. OverlayManager stack
**تصمیم:** مدیریت overlay به‌صورت LIFO stack با parent tracking
**دلیل:** overlay-روی-overlay (Settings از Pause) نیاز به stack دارد.

## ۱۹. gp* flags (B2 fix)
**تصمیم:** flags جداگانه برای gamepad (gpJumpPressed, gpFirePressed, etc.)
**دلیل:** جلوگیری از double-fire بین keyboard keyHandler و gamepad polling.

## ۲۰. حذف removeInteractive از clearFocusables (S1 fix)
**تصمیم:** clearFocusables فقط bg.off() صدا می‌زند، نه removeInteractive()
**دلیل:** removeInteractive() در Phaser 4 حالت داخلی InputPlugin را خراب می‌کند وقتی mid-event صدا زده شود.
