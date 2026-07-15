# Task 005 — Refactor: Scenes (9 → 3)

## هدف

ادغام ۸ scene بازی → `BootScene` + `GameScene` + `UIScene`

## فایل‌هایی که اجازه داری تغییر بدهی

- `src/game/features/scenes/BootScene.ts` (نگه دار)
- `src/game/features/scenes/GameScene.ts` (جدید — جایگزین ۷ scene)
- `src/game/features/scenes/UIScene.ts` (جدید — pause menu)
- `src/game/features/scenes/MenuScene.ts` (حذف)
- `src/game/features/scenes/MapScene.ts` (حذف)
- `src/game/features/scenes/FactoryStage.ts` (حذف — محتوایش به GameScene)
- `src/game/features/scenes/VictoryScene.ts` (حذف)
- `src/game/features/scenes/ComingSoonScene.ts` (حذف)
- `src/game/features/scenes/SkillTreeScene.ts` (حذف)
- `src/game/features/scenes/SettingsScene.ts` (حذف)
- `src/game/features/ui/PauseMenu.ts` (حذف — به UIScene)
- `src/game/PhaserGame.ts` (به‌روزرسانی scene list)

## GameScene state machine

```typescript
type GameState = 'menu' | 'map' | 'play' | 'boss' | 'victory' | 'comingsoon' | 'skills' | 'settings'

class GameScene {
  state: GameState = 'menu'
  
  create() { this.setState('menu') }
  
  setState(next: GameState) {
    // پاکسازی state قبلی
    // ساخت UI state بعدی
  }
  
  update(time, delta) {
    switch (this.state) {
      case 'play': this.updatePlay(delta); break
      // ...
    }
  }
}
```

## تست قبولی

- [ ] Menu نمایش داده می‌شود با START دکمه
- [ ] کلیک روی START → Map نمایش داده می‌شود
- [ ] کلیک روی Stage 1 → gameplay شروع می‌شود
- [ ] ESC → pause menu (UIScene)
- [ ] RESUME → بازی ادامه می‌یابد
- [ ] Boss defeat → Victory
- [ ] Skills و Settings دسترسی‌پذیرند
- [ ] هیچ خطای console نیست
