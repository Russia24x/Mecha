# Task 002 — Refactor: Graphics.ts

## هدف

ادغام `rendering/Lighting.ts` + `rendering/Shaders.ts` + `rendering/RenderInfo.ts` → `rendering/Graphics.ts`

## فایل‌هایی که اجازه داری تغییر بدهی

- `src/game/features/rendering/Graphics.ts` (جدید)
- `src/game/features/rendering/Lighting.ts` (حذف)
- `src/game/features/rendering/Shaders.ts` (حذف)
- `src/game/features/rendering/RenderInfo.ts` (حذف)
- فایل‌هایی که این‌ها را import کرده

## API نهایی

```typescript
class Graphics {
  // Lighting
  constructor(scene: Phaser.Scene)
  addLight(opts: { follow?, radius?, color?, intensity?, flicker? }): Light
  removeLight(l: Light): void
  update(timeMs: number): void
  
  // RenderInfo (toggle with F3)
  // داخلی — خودش keyboard listener می‌سازد
  
  // Shaders (اختیاری — اگر WebGL2 فعال بود)
  // داخلی
}
```

## تست قبولی

- [ ] نور پلیر دشمن و باس کار می‌کند
- [ ] F3 پنل اطلاعات رندر را نشان می‌دهد
- [ ] هیچ خطای console نیست
- [ ] هیچ import قدیمی باقی نمانده
