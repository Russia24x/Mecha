# Task 003 — Refactor: Enemy.ts + EnemyTypes.ts

## هدف

ادغام `enemies/Enemy.ts` + `Drone.ts` + `Spider.ts` + `Heavy.ts` → `enemies/Enemy.ts` + `enemies/EnemyTypes.ts`

## فایل‌هایی که اجازه داری تغییر بدهی

- `src/game/features/enemies/Enemy.ts` (بازنویسی)
- `src/game/features/enemies/EnemyTypes.ts` (جدید — فقط دیتا)
- `src/game/features/enemies/Drone.ts` (حذف)
- `src/game/features/enemies/Spider.ts` (حذف)
- `src/game/features/enemies/Heavy.ts` (حذف)
- `scenes/FactoryStage.ts` (به‌روزرسانی import)

## EnemyTypes.ts (فقط دیتا)

```typescript
export const ENEMY_TYPES = {
  drone: {
    hp: 24, speed: 1.4, detectionRange: 320,
    attack: 'shoot', attackRange: 220,
    fireRateMs: 2200, bulletSpeed: 5.5, bulletDamage: 6,
    score: 50, color: 0xff5a5a, size: { w: 26, h: 22 },
    flying: true,
    timings: { telegraphMs: 500, windowMs: 200, recoveryMs: 600 }
  },
  spider: {
    hp: 55, speed: 2.2, detectionRange: 280,
    attack: 'lunge', attackRange: 140, lungeSpeed: 7,
    score: 80, color: 0xff8a3d, size: { w: 36, h: 22 },
    flying: false,
    timings: { telegraphMs: 400, windowMs: 320, recoveryMs: 500 }
  },
  heavy: {
    hp: 140, speed: 0.9, detectionRange: 320,
    attack: 'charge', attackRange: 256, chargeSpeed: 5,
    score: 150, color: 0xb040ff, size: { w: 52, h: 44 },
    flying: false,
    timings: { telegraphMs: 600, windowMs: 700, recoveryMs: 900 }
  }
};
```

## Enemy.ts

یک کلاس با constructor `(scene, x, y, type: keyof typeof ENEMY_TYPES, projectiles)`.

داخل update با switch روی `this.type` رفتار متفاوت.

FSM نگه دار: patrol | aggro | attack | cover | stagger با telegraph→window→recovery.

## تست قبولی

- [ ] Drone شلیک می‌کند
- [ ] Spider lunge می‌کند
- [ ] Heavy charge می‌کند
- [ ] همه telegraph نشان می‌دهند
- [ ] Ragdoll روی مرگ spawn می‌شود
- [ ] هیچ خطای console نیست
