# ساختار منوها و صفحات بازی

## Game Flow

```
BootScene
  ↓ (loading bar)
GameScene (state machine)

  ┌─────────────────────────────────────────────────────┐
  │ MENU (state='menu')                                  │
  │   ▶ START → MAP                                      │
  │   ↻ CONTINUE → checkpoint or MAP                     │
  │   i HOW TO PLAY → overlay                            │
  └─────────────────────────────────────────────────────┘
          ↓
  ┌─────────────────────────────────────────────────────┐
  │ MAP (state='map')                                    │
  │   Stage 1: ABANDONED FACTORY → ENTER → play          │
  │   Stage 2: NEON DISTRICT → ENTER → play (if unlocked)│
  │   Stage 3: ORBITAL STATION → LOCKED                  │
  │   ⚙ SKILLS → skills state                            │
  │   ⚙ SETTINGS → settings state                        │
  │   ← BACK → menu                                      │
  └─────────────────────────────────────────────────────┘
          ↓
  ┌─────────────────────────────────────────────────────┐
  │ PLAY (state='play')                                  │
  │   6 sections per stage                               │
  │   Section triggers → spawn enemies                   │
  │   Checkpoint triggers → save                         │
  │   Boss arena trigger → spawn boss                    │
  │                                                      │
  │   ESC → UIScene (pause overlay)                      │
  │   Player dies → Game Over overlay                    │
  │   Boss dies → Lore → Rewards → Victory               │
  └─────────────────────────────────────────────────────┘
          ↓
  ┌─────────────────────────────────────────────────────┐
  │ GAME OVER (overlay on play)                          │
  │   ↻ RETRY → respawn at checkpoint                   │
  │   ⌂ QUIT TO MAP → map                               │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ PAUSE (UIScene overlay)                              │
  │   ▶ RESUME → back to play                            │
  │   ↻ RESTART → play from start                        │
  │   🗺 QUIT TO MAP → map                               │
  │   ⌂ QUIT TO MENU → menu                              │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ VICTORY (state='victory')                            │
  │   🗺 MAP → map                                       │
  │   ⚙ SKILLS → skills                                  │
  │   ⌂ MENU → menu                                      │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ SKILLS (state='skills')                              │
  │   3 trees: COMBAT / MOBILITY / SURVIVAL              │
  │   XP bar + Level + SP display                        │
  │   ← BACK → map                                       │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ SETTINGS (state='settings')                          │
  │   AUDIO: Master / Music / SFX sliders                │
  │   LANGUAGE: EN / فارسی buttons                       │
  │   CONTROLS: Gamepad status + key hints               │
  │   ✓ SAVE & BACK → map                                │
  └─────────────────────────────────────────────────────┘
```

## Navigation

| Input | Action |
|-------|--------|
| Mouse | Click buttons |
| W/S or Arrow Up/Down | Navigate between buttons |
| Enter / Space | Activate focused button |
| ESC | Go back (map→menu, skills→map, etc.) |
| Gamepad D-pad / Left Stick | Navigate |
| Gamepad A | Activate |
| Gamepad B / Back | Go back |
