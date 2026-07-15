# CURRENT_STATE

**آخرین به‌روزرسانی:** 2026-07-11 v21
**وضعیت:** Parallax crash fix + Fullscreen + Real-time render monitor

---

## چه چیزی کار می‌کند

- ✅ **خطای "Cannot read properties of undefined (reading 'update')" حل شد**
  - علت: `this.parallax` در Stage 2 تعریف نمی‌شد ولی `update()` صدا زده می‌شد
  - راه‌حل: `this.parallax?.update(deltaMs)` (optional chaining)
- ✅ **فول‌اسکرین** — F11 برای toggle fullscreen
  - `document.documentElement.requestFullscreen()` / `exitFullscreen()`
- ✅ **نمایشگر real-time رندر (F3)** — پنل کامل با:
  - **RENDERER:** Type (WebGL/Canvas), GL version (1.0/2.0), GLSL version
  - **PERFORMANCE:** Real-time FPS (محاسبه شده از frame count), Delta time, Object count
  - **SYSTEMS:** Scene count, Physics (Matter.js), Audio status, Texture count
  - GL info cached یک‌بار (performance)
  - FPS real-time (هر 500ms به‌روز می‌شود)
  - MSAA, Max Texture Size, Extensions count
- ✅ **بکگراند Stage 2** — VLM تایید: "dark green cyberpunk background covering the screen"
- ✅ **سیستم ذخیره‌سازی استاندارد** — Save.ts با versioning + migration + stage progress
- ✅ **i18n** EN/FA + language selector
- ✅ **HUD compact** — no "object" text
- ✅ **Pause fix** — no "Cannot pause non-running Scene" error
- ✅ **Level/XP system**, GameConfig, F2 test suite
- ✅ **دشمن‌ها و باس‌های گرافیکی**
- ✅ **Stage 1 + Stage 2** playable

## کلیدهای میانبر

| کلید | عملکرد |
|------|--------|
| F2 | Test suite (۲۷ تست) |
| F3 | Render info panel (real-time) |
| F11 | Fullscreen toggle |
| ESC | Pause / Back in menus |

## ساختار (۳۵ فایل، ~۸۰۰۰ خط)
