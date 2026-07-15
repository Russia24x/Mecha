# Task 001 — Refactor: Effects.ts

## هدف

ادغام `shared/AudioManager.ts` + `combat/HitEffects.ts` → `shared/Effects.ts`

## فایل‌هایی که اجازه داری تغییر بدهی

- `src/game/shared/Effects.ts` (جدید)
- `src/game/shared/AudioManager.ts` (حذف)
- `src/game/combat/HitEffects.ts` (حذف)
- هر فایلی که این‌ها را import کرده (به‌روزرسانی import)

## API نهایی

```typescript
class Effects {
  // Audio
  static init(): void
  static play(name: SfxName): void
  static playMusic(name: string): void
  static stopMusic(): void
  static setMasterVolume(v: number): void
  static setMusicVolume(v: number): void
  static setSfxVolume(v: number): void
  static setMuted(m: boolean): void
  
  // Visual
  static explosion(scene, x, y, color?, scale?): void
  static smokePuff(scene, x, y): void
  static energyTrail(scene, x, y, color?): void
  static screenFlash(scene, color?, alpha?, duration?): void
}
```

## تست قبولی

- [ ] بازی بدون خطا اجرا می‌شود
- [ ] صدای شلیک پخش می‌شود (`Effects.play('fire')`)
- [ ] explosion روی مرگ دشمن کار می‌کند
- [ ] screen flash روی phase change کار می‌کند
- [ ] هیچ import قدیمی از AudioManager یا HitEffects باقی نمانده
