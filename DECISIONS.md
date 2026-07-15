# DECISIONS

**چرا هر تصمیم گرفته شده.**

---

## ۱. Phaser 4.2 به جای Phaser 3

**تصمیم:** Phaser 4.2
**دلیل:** WebGL 2.0 support، VAO، instancing، بهبود performance. برای بازی اکشن با particle زیاد مهم است.
**جایگزین:** Phaser 3 (پایدارتر، مستندات بیشتر)

## ۲. Matter.js به جای Arcade Physics

**تصمیم:** Matter.js به‌عنوان physics اصلی
**دلیل:** Ragdoll، destructible structures، compound bodies نیاز به real physics دارند.
**مشکل:** tunneling برای گلوله‌های سریع → راه‌حل: overlap detection دستی
**جایگزین:** Hybrid (Arcade player + Matter world) — معلق به دلیل ریسک refactor

## ۳. Feature-Based Architecture (در حال تغییر)

**تصمیم قبلی:** هر feature در پوشه جدا با چند فایل
**دلیل تغییر:** بیش از حد پیچیده برای AI-driven dev. AI با context محدود نمی‌تواند ۴۴ فایل را نگه دارد.
**تصمیم جدید:** Consolidation به ~۲۰ فایل، هر مسئولیت در یک فایل

## ۴. ۹ Scene → ۳ Scene

**تصمیم:** BootScene + GameScene (با state machine داخلی) + UIScene
**دلیل:** کاهش boilerplate، context switch آسان‌تر برای AI
**trade-off:** کد GameScene بزرگ‌تر می‌شود اما همه gameplay در یک جاست

## ۵. EventBus به ۶ event

**تصمیم:** فقط PLAYER_DAMAGED, PLAYER_DEAD, ENEMY_DEAD, BOSS_PHASE, CHECKPOINT, GAME_STATE
**دلیل:** event‌های زیاد = coupling پنهان. ۶ event کافی است.
**trade-off:** برخی UI update‌ها باید polling شوند به جای event

## ۶. سلاح‌های سه‌سطحی

**تصمیم:** Hitscan (laser) / Kinematic (plasma, shotgun) / Matter (rocket)
**دلیل:** tunneling در Matter.js برای گلوله‌های سریع. Hitscan با intersectRay این مشکل را حل می‌کند.

## ۷. FSM دشمن با telegraph

**تصمیم:** patrol → aggro → attack (telegraph→window→recovery) → cover/stagger
**دلیل:** fairness rule — هر حمله باید telegraph شود تا بازیکن بتواند dodge کند
**منبع:** اسکیل `enemy-ai-boss-encounters`

## ۸. Ragdoll با state-swap

**تصمیم:** alive = sprite → dead = compound Matter body
**دلیل:** انیمیشن مرگ سینمایی بدون نیاز به skeleton animation
**منبع:** اسکیل `ragdoll-destruction-combat`

## ۹. گیم‌پلی فقط کیبورد/گیم‌پد (بدون موس)

**تصمیم:** موس فقط برای منوها
**دلیل:** بازیکن باید روی movement تمرکز کند، نه aim با موس. aim با W/S (۸ جهت) یا Right Stick (۳۶۰°)

## ۱۰. Procedural Audio (نه فایل صوتی)

**تصمیم:** Web Audio API با oscillator + noise buffer
**دلیل:** بدون نیاز به asset file، حجم صفر، انعطاف‌پذیر
**trade-off:** کیفیت پایین‌تر از فایل صوتی حرفه‌ای

## ۱۱. Save در localStorage

**تصمیم:** localStorage برای checkpoint + skill tree + settings
**دلیل:** ساده، بدون backend، کافی برای single-player

## ۱۲. مستندات ۳ فایلی (CURRENT_STATE + NEXT_TASK + DECISIONS)

**تصمیم:** حذف Worklog و Architecture طولانی
**دلیل:** AI به وضعیت فعلی علاقه دارد، نه تاریخچه. ۳ فایل زیر ۳۰۰۰ توکن کافی است برای شروع هر جلسه.

## ۱۳. ai/ folder با task files

**تصمیم:** هر task در فایل md جدا با: هدف، فایل‌های مجاز، تست قبولی
**دلیل:** AI می‌تواند task را مستقیم اجرا کند بدون خواندن کل پروژه
