# MECHA: LAST PROTOCOL — Project Rules

---

## RULE 1: NEVER-FORCE-PUSH

`git push --force` (یا `--force-with-lease`) **مطلقاً ممنوع است**.

اگر `git push` عادی rejected شد (non-fast-forward):
1. **فوری STOP کن**
2. گزارش بده: "push rejected — needs investigation"
3. منتظر تصمیر کاربر بمون
4. **هرگز force push نزن**

---

## RULE 2: SESSION-START-SYNC-CHECK

در ابتدای هر session (و بعد از هر gap زمانی)، قبل از هر تغییر جدید:

```
a. git fetch origin
b. git status — بررسی behind/ahead
c. اگر behind یا diverged از origin/main: STOP فوری، گزارش بده
d. اگر clean/up-to-date بود: ادامه بده
```

### خروجی مورد انتظار:
```
git rev-list --left-right --count origin/main...HEAD
# باید خروجی: 0  0  (behind 0, ahead 0)
```

اگر هر عدد غیر از 0 باشد → STOP، گزارش بده.

---

## RULE 3: CODE QUALITY GATES

قبل از هر commit:
1. `npx tsc --noEmit --strict --skipLibCheck` — 0 خطا
2. سرور dev در حال اجرا و HTTP 200
3. تست در browser — بدون console error

---

## RULE 4: VERTICAL SLICE FOCUS

از این لحظه:
- **هیچ سند جدید** — مگر برای حل مشکل واقعی
- **هیچ سیستم جدید** — مگر برای vertical slice
- **فقط تجربه قابل بازی** — اولین ساعت
- قانون 80/20: 80% کد، 20% طراحی

---

## RULE 5: THREE-QUESTION GATE

هیچ محتوایی وارد بازی نمی‌شود مگر اینکه بتواند پاسخ دهد:
1. چه تجربه جدیدی برای بازیکن خلق می‌کند؟
2. چه چیزی درباره دنیای MECHA آشکار می‌کند؟
3. اگر حذفش کنیم، آیا بازی چیزی مهم را از دست می‌دهد؟

---

## RULE 6: PHASER AS PLATFORM, NOT ARCHITECTURE

Use Phaser as the rendering and platform layer, not as the game architecture.
Accept Phaser best practices when they improve rendering, input, audio,
loading, animation, physics, or performance.
Reject them when they introduce direct dependencies into GameCore,
gameplay logic, or progression systems.

### اسکیل‌های Phaser 4 — طبقه‌بندی:

هر recommendation از اسکیل‌های Phaser 4 باید در یکی از سه دسته قرار گیرد:

- **Adopt** — مستقیم استفاده کن (با معماری بازی همخوان است)
- **Adapt** — ایده را استفاده کن، اما از طریق سیستم‌های موجود (EventBus/AudioSystem/...)
- **Reject** — با معماری بازی تداخل دارد

### طبقه‌بندی ۲۸ اسکیل:

| # | Skill | Category | Reason |
|---|-------|----------|--------|
| 1 | physics-matter | **Adopt** | Matter.js از طریق PhysicsSystem wrapper استفاده می‌شود |
| 2 | input-keyboard-mouse-touch | **Adapt** | InputSystem مستقل است، اما بهترین شیوه‌های Phaser برای pointer events را采纳 کن |
| 3 | text-and-bitmaptext | **Adapt** | Text کار می‌کند اما برای محتوای پویا BitmapMap در نظر بگیر |
| 4 | groups-and-containers | **Adapt** | Container برای UI استفاده می‌شود. Group برای object pooling در آینده |
| 5 | scenes | **Adapt** | State machine سفارشی داریم، اما lifecycle best practices را رعایت کن |
| 6 | cameras | **Adopt** | camera.fadeIn/fadeOut/shake/zoomTo مستقیم استفاده می‌شود |
| 7 | game-object-components | **Adopt** | Depth, Alpha, ScrollFactor مستقیم استفاده می‌شود |
| 8 | v3-to-v4-migration | **Adopt** | اطمینان از عدم استفاده API حذف‌شده |
| 9 | v4-new-features | **Adapt** | Filters/RenderNodes بررسی شوند اما با احتیاط |
| 10 | game-setup-and-config | **Adopt** | GameConfig مستقیم استفاده می‌شود |
| 11 | tweens | **Adopt** | tweens مستقیم استفاده می‌شود |
| 12 | time-and-timers | **Adopt** | delayedCall/addEvent مستقیم استفاده می‌شود |
| 13 | events-system | **Adapt** | EventBus سفارشی داریم، اما pattern مشابه است |
| 14 | audio-and-sound | **Adapt** | AudioSystem سفارشی داریم. `pauseOnBlur` و spatial audio اضافه کن |
| 15 | particles | **Adapt** | Manual particles داریم. Phaser ParticleEmitter برای effects سنگین در نظر بگیر |
| 16 | graphics-and-shapes | **Adopt** | Graphics برای visual rects و circuit traces استفاده می‌شود |
| 17 | sprites-and-images | **Adopt** | Image/Sprite مستقیم استفاده می‌شود |
| 18 | animations | **Reject** | فعلاً procedural visuals داریم. Sprite animations بعد از asset pipeline |
| 19 | loading-assets | **Reject** | فعلاً procedural textures. بعد از asset pipeline اضافه شود |
| 20 | tilemaps | **Reject** | Area loader سفارشی داریم. Tilemap برای آینده |
| 21 | render-textures | **Reject** | نیاز به asset pipeline. فعلاً procedural کافی است |
| 22 | filters-and-postfx | **Reject** | WebGL filters برای آینده. فعلاً additive blend کافی است |
| 23 | curves-and-paths | **Adapt** | برای projectile trajectories و grapple path |
| 24 | geometry-and-math | **Adopt** | Vector2, Distance, Math.Linear مستقیم استفاده می‌شود |
| 25 | data-manager | **Reject** | SaveSystem سفارشی داریم |
| 26 | scale-and-responsive | **Adopt** | Scale.FIT + CENTER_BOTH استفاده می‌شود |
| 27 | actions-and-utilities | **Adapt** | برای batch operations روی groups در آینده |
| 28 | physics-arcade | **Reject** | Matter.js استفاده می‌شود، نه Arcade |

---

## شعار پروژه

> **Every step reveals a forgotten truth. Every battle asks a forgotten question.**
> **The world is not waiting to be saved. It is waiting to be understood.**
