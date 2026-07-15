# Task 004 — Refactor: Player.ts

## هدف

ادغام `player/Player.ts` + `PlayerController.ts` + `PlayerCombat.ts` → `player/Player.ts`

## فایل‌هایی که اجازه داری تغییر بدهی

- `src/game/features/player/Player.ts` (بازنویسی — همه ۳ فایل در یک فایل)
- `src/game/features/player/PlayerController.ts` (حذف)
- `src/game/features/player/PlayerCombat.ts` (حذف)
- `scenes/FactoryStage.ts` (به‌روزرسانی — فقط `new Player()` و `player.update()`)

## ساختار Player.ts

```typescript
class Player {
  sprite, health, energy, facing, alive
  
  constructor(scene, x, y)
  
  // هر فریم صدا زده می‌شود
  update(deltaMs) {
    this.updateMovement(deltaMs)
    this.updateCombat(deltaMs)
    this.updateAnimation(deltaMs)
  }
  
  private updateMovement(deltaMs) {
    // خواندن کیبورد + گیم‌پد
    // حرکت افقی با smooth acceleration
    // پرش + double jump
    // dash
  }
  
  private updateCombat(deltaMs) {
    // خواندن aim (W/S یا right stick)
    // شلیک (J یا X)
    // melee (K یا Y)
    // تغییر سلاح (1-4, Q/E, LB/RB)
  }
  
  private updateAnimation(deltaMs) {
    // Mecha visual parts (torso, head, legs, gun arm)
    // thruster particles
  }
  
  takeDamage(amount): boolean
  heal(amount): void
}
```

## تست قبولی

- [ ] حرکت با A/D کار می‌کند
- [ ] پرش با Space کار می‌کند
- [ ] dash با Shift کار می‌کند
- [ ] شلیک با J کار می‌کند (همه ۴ سلاح)
- [ ] aim با W/S کار می‌کند
- [ ] melee با K کار می‌کند
- [ ] Mecha visual نمایش داده می‌شود
- [ ] هیچ خطای console نیست
