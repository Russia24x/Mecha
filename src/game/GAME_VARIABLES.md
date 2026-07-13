/**
 * MECHA: LAST PROTOCOL — Game Variables Reference
 *
 * This file is a REFERENCE DOCUMENT (not executable code).
 * It lists ALL tunable variables in the game, their location,
 * default value, what they do, and what depends on them.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * TABLE OF CONTENTS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 1. GAME CONSTANTS         — src/game/shared/Constants.ts
 * 2. PLAYER STATS           — src/game/shared/Constants.ts (PLAYER)
 * 3. COLORS                 — src/game/shared/Constants.ts (COLORS)
 * 4. PHYSICS                — src/game/shared/Constants.ts (PHYSICS)
 * 5. CHASSIS CONFIGS        — src/game/data/chassis/chassis.ts
 * 6. QUALITY CONFIGS        — src/game/systems/QualityManager.ts
 * 7. PAINT CONFIGS          — src/game/data/paints/paints.ts
 * 8. ENEMY STATS            — src/game/data/enemies/enemies.ts
 * 9. WEAPON STATS           — src/game/data/weapons/weapons.ts
 * 10. BOSS STATS            — src/game/data/bosses/bosses.ts
 * 11. SKILL EFFECTS         — src/game/data/skills/skills.ts
 * 12. RENDER SETTINGS       — src/game/systems/RenderSystem.ts
 * 13. AUDIO SETTINGS        — src/game/systems/AudioSystem.ts
 * 14. INPUT MAPPING         — src/game/systems/InputSystem.ts
 * 15. ATMOSPHERE            — src/game/world/atmosphere/AtmosphereSystem.ts
 * 16. FOREST ENVIRONMENT    — src/game/world/atmosphere/ForestEnvironmentSystem.ts
 * 17. PLAYER ABILITIES      — src/game/entities/player/PlayerEntity.ts
 * 18. COMPANION             — src/game/entities/companion/CompanionEntity.ts
 * 19. SAVE SYSTEM           — src/game/systems/SaveSystem.ts
 * 20. UI THEME              — src/game/ui/Theme.ts
 * 21. LOCALIZATION          — src/game/data/localization/{en,fa}.json
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 1. GAME CONSTANTS
 * File: src/game/shared/Constants.ts → export const GAME
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VARIABLE          DEFAULT   UNIT      WHAT IT DOES                          DEPENDENCIES
 * WIDTH             1280      px        Internal render width                All scenes, camera bounds, UI layout
 * HEIGHT            720       px        Internal render height               All scenes, camera bounds, UI layout
 * BG_COLOR          #0a0d14   hex       Default background color             BootScene, menu background
 * TARGET_FPS        60        fps       Target frame rate                    Game loop (overridden by QualityManager)
 * TITLE             string    —         Game title                           Menu screen
 * VERSION           string    —         Version string                       Menu footer
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 2. PLAYER STATS (base values — modified by skills + chassis)
 * File: src/game/shared/Constants.ts → export const PLAYER
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VARIABLE           DEFAULT  UNIT      WHAT IT DOES                         DEPENDENCIES
 * MAX_HEALTH         150      hp        Base max health                      PlayerEntity.health.max → HUD bar
 * MAX_ENERGY         100      en        Base max energy                      PlayerEntity.energy.max → HUD bar
 * ENERGY_REGEN       14       en/sec    Energy regeneration rate             PlayerEntity.update()
 * MOVE_SPEED         5.5      px/frame  Horizontal movement speed            PlayerEntity.updateMovement()
 * JUMP_VELOCITY      -11.5    px/frame  Jump force (negative = up)           PlayerEntity.tryJump()
 * DASH_SPEED         10       px/frame  Dash velocity                        PlayerEntity.tryDash()
 * DASH_DURATION_MS   220      ms        Dash duration                        PlayerEntity.tryDash()
 * DASH_COST          22       en        Energy cost per dash                 PlayerEntity.tryDash()
 * DASH_COOLDOWN_MS   600      ms        Dash cooldown                        PlayerEntity.tryDash()
 * MELEE_DAMAGE       35       dmg       Base melee damage                    PlayerEntity.tryMelee() → CombatSystem
 * MELEE_RANGE        60       px        Melee hitbox radius                  PlayerEntity.tryMelee()
 * MELEE_COOLDOWN_MS  360      ms        Melee cooldown                       PlayerEntity.tryMelee()
 * MELEE_COST         6        en        Energy cost per melee                PlayerEntity.tryMelee()
 * BULLET_DAMAGE      18       dmg       Base projectile damage               PlayerEntity.tryFire() → Projectile
 * BULLET_SPEED       13       px/frame  Projectile velocity                  PlayerEntity.tryFire() → Projectile
 * FIRE_COOLDOWN_MS   140      ms        Fire cooldown (assault rifle)        PlayerEntity.tryFire()
 * FIRE_COST          3        en        Energy cost per shot                 PlayerEntity.tryFire()
 * INVULN_MS          850      ms        Invulnerability after hit            PlayerEntity.takeDamage()
 * BODY_RADIUS        18       px        Physics body radius                  PlayerEntity physics body, wall detection
 * COYOTE_TIME_MS     120      ms        Grace period after leaving edge      PlayerEntity.tryJump()
 * JUMP_BUFFER_MS     120      ms        Jump input buffer before landing     PlayerEntity.tryJump()
 *
 * NOTE: These are BASE values. PlayerEntity.computeStats() applies:
 *   - Skill multipliers (from skills.ts)
 *   - Chassis multipliers (from chassis.ts) — NOT YET IMPLEMENTED
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 3. COLORS
 * File: src/game/shared/Constants.ts → export const COLORS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VARIABLE       VALUE     USED BY
 * PLAYER         0x39d0d8  Player visual accent color
 * PLAYER_GLOW    0x66f0ff  Player visor, thruster glow (was light source)
 * ENEMY_DRONE    0xff5a5a  Drone enemy color
 * ENEMY_SPIDER   0xff8a3d  Spider enemy color
 * ENEMY_HEAVY    0xb040ff  Heavy enemy color
 * BOSS           0xff3030  Boss entity color
 * BOSS_GLOW      0xff6060  Boss glow (was light source)
 * PROJECTILE     0xfff04a  Player projectile color
 * ENEMY_PROJ     0xff4a4a  Enemy projectile color
 * HEALTH         0x40d070  Health bar fill color
 * ENERGY         0x4090ff  Energy bar fill color
 * LIGHT          0xffe6b0  Ambient light color
 * METAL          0x4a5260  Platform metal color
 * METAL_DARK     0x2a3038  Platform dark metal color
 * RUST           0x8a4a2a  Rust stain color
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 4. PHYSICS
 * File: src/game/shared/Constants.ts → export const PHYSICS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VARIABLE     DEFAULT  WHAT IT DOES                          DEPENDENCIES
 * GRAVITY_Y    0.9      Gravity force (Y axis)                GameScene.buildPlay → physicsSys.setGravity
 * TILE_SIZE    32       Tile size (unused — no tilemap)       —
 * CATEGORY     0x0001+  Collision category bitmasks           PhysicsSystem (not actively used for filtering)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 5. CHASSIS CONFIGS
 * File: src/game/data/chassis/chassis.ts → export const CHASSIS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CHASSIS: scout (light)
 *   scale: 0.85          — visual size multiplier
 *   anim.walkSpeed: 1.4  — leg swing cycle speed
 *   anim.walkAmplitude: 0.10 — leg swing angle
 *   anim.bobAmount: 2    — vertical bob
 *   movement.speedMult: 1.15   — +15% move speed     (NOT YET APPLIED)
 *   movement.jumpMult: 1.10    — +10% jump           (NOT YET APPLIED)
 *   movement.dashMult: 1.20    — +20% dash           (NOT YET APPLIED)
 *   combat.meleeMult: 0.85     — -15% melee          (NOT YET APPLIED)
 *   combat.maxHealthMult: 0.85 — -15% health         (NOT YET APPLIED)
 *   combat.maxEnergyMult: 1.15 — +15% energy         (NOT YET APPLIED)
 *
 * CHASSIS: assault (balanced) — all 1.0
 *
 * CHASSIS: titan (heavy)
 *   scale: 1.15
 *   anim.walkSpeed: 0.7  — slow steps
 *   movement.speedMult: 0.85   — -15% move speed     (NOT YET APPLIED)
 *   combat.meleeMult: 1.30     — +30% melee          (NOT YET APPLIED)
 *   combat.maxHealthMult: 1.30 — +30% health         (NOT YET APPLIED)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 6. QUALITY CONFIGS
 * File: src/game/systems/QualityManager.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * LEVEL    FPS   PARTICLE   DARKNESS   ATMOS POOL   GRASS   RAIN
 * low      30    0.4x       0.15       20           OFF     OFF
 * medium   60    0.7x       0.10       40           ON(35)  30
 * high     60    1.0x       0.08       60           ON(25)  60
 *
 * Applied on: game start (GameScene.create) + settings change
 * QualityManager.setQuality() → RenderSystem.setMaxDarkness() + game.loop.targetFps
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 7. PAINT CONFIGS
 * File: src/game/data/paints/paints.ts → export const PAINTS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * PAINT            PRIMARY    ACCENT     UNLOCKED
 * factory_gray     0x2a3850   0x39d0d8   ✅ default
 * military_green   0x2a3a1a   0x80a040   ❌
 * protocol_white   0x808898   0xffc040   ❌
 * rust             0x4a2a1a   0x8a4a2a   ❌
 *
 * Applied in: PlayerEntity.buildVisual() → MechaSpriteFactory.buildPlayer()
 * Affects: body color + accent color on all mech parts
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 8. ENEMY STATS
 * File: src/game/data/enemies/enemies.ts → export const ENEMIES
 * ═══════════════════════════════════════════════════════════════════════
 *
 * TYPE        HP   SPEED  DMG  RANGE  ATTACK   FLYING  XP   HACKABLE
 * drone       24   1.4    8    220    shoot    ✅      15   ✅
 * spider      55   2.2    14   140    lunge    ❌      25   ❌
 * sniper      30   1.0    12   450    snipe    ❌      30   ❌
 * heavy       140  0.9    22   256    charge   ❌      50   ❌
 * flying_ai   40   2.5    10   300    shoot    ✅      35   ✅
 * elite       200  1.8    25   200    charge   ❌      80   ❌
 *
 * Posture: all enemies have maxPosture=100, STAGGER_DURATION_MS=1500
 * Stagger: +50% damage taken during stagger window
 * Posture decay: 15/sec when not hit
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 9. WEAPON STATS
 * File: src/game/data/weapons/weapons.ts → export const WEAPONS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * WEAPON           TIER       DAMAGE  FIRE RATE  ENERGY  BULLETS  SPEED
 * assault_rifle    projectile 18      140ms      3       1        13
 * shotgun          projectile 10      480ms      8       5(spread)10
 * railgun          hitscan    14      90ms       4       1        —
 * plasma_cannon    explosive  —       —          —       —        —
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 10. BOSS STATS
 * File: src/game/data/bosses/bosses.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * BOSS              HP    CONTACT DMG  PHASES  ATTACKS
 * guardian_ax09     1200  28           2       shoot, lunge, teleport
 * neural_overseer   1800  36           2       shoot, lunge, teleport, beam
 *
 * Phase 2 trigger: HP < 50% → speed +50%, fireRate -40%
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 11. SKILL EFFECTS
 * File: src/game/data/skills/skills.ts → export const SKILLS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 30 skills across 6 trees (Combat, Weapon, Movement, Energy, Defense, Protocol)
 * Each skill: { cost, tier, requires, effect: { stat, multiplier?, additive?, unlock? } }
 * Applied in: PlayerEntity.computeStats() — iterates unlockedSkills, applies multipliers
 *
 * Key ability unlocks:
 *   doubleJump    — movement tree, tier 1
 *   wallJump      — movement tree, tier 1 (also from mini-boss)
 *   grapple       — movement tree, tier 2
 *   hover         — energy tree, tier 1
 *   emp           — protocol tree, tier 0
 *   hack          — protocol tree, tier 1
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 12. RENDER SETTINGS
 * File: src/game/systems/RenderSystem.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VARIABLE      DEFAULT  WHAT IT DOES                    CHANGED BY
 * brightness    0.85     Player visibility (0-1)         Settings slider
 * maxDarkness   0.08     Max darkness overlay alpha      QualityManager (0.08-0.15)
 *
 * Darkness alpha = (1 - brightness) * maxDarkness
 * Applied as MULTIPLY blend rectangle over entire screen
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 13. AUDIO SETTINGS
 * File: src/game/systems/AudioSystem.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VARIABLE         DEFAULT  WHAT IT DOES
 * masterVolume     0.7      Overall volume (0-1)
 * sfxVolume        0.8      SFX volume (0-1)
 * musicVolume      0.4      Music volume (0-1) — no music yet
 * muted            false    Mute all audio
 *
 * 8 categories: Music, Ambient, Combat, Weapons, UI, NPC, Environment, Voice
 * SFX_REGISTRY: data-driven oscillator definitions (freq, dur, oscType, vol)
 * Ambient types: factory (industrial drone), boss (tense), silence
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 14. INPUT MAPPING
 * File: src/game/systems/InputSystem.ts + InputSchemeManager.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ACTION       KEYBOARD    XBOX        PLAYSTATION
 * move         WASD        L-STICK     L-STICK
 * jump         SPACE       A           CROSS
 * dash         SHIFT       LT          L2
 * fire         J           X           SQUARE
 * melee        K           Y           TRIANGLE
 * interact     E           B           CIRCLE
 * grapple      F           D-UP        D-UP
 * emp          G           D-DOWN      D-DOWN
 * weaponNext   Q           RB          R1
 * weaponPrev   E           LB          L1
 * pause        ESC         START       OPTIONS
 *
 * Auto-detection: InputSchemeManager polls navigator.getGamepads() every 200ms
 * Switch: emits INPUT_SCHEME_CHANGED → all UI updates labels in real-time
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 15. ATMOSPHERE
 * File: src/game/world/atmosphere/AtmosphereSystem.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VARIABLE          DEFAULT  WHAT IT DOES
 * fogLayers         4        Number of horizontal fog bands
 * godRayCount       3-5      Volumetric light shafts (region-dependent)
 * particlePoolSize  20-60    Ambient particles (QualityManager controlled)
 * depthHazeAlpha    0.15     Multiply blend overlay
 *
 * Region-specific:
 *   factory: amber fog, dim god rays, ember particles
 *   forest:  green fog, bright god rays, spore particles
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 16. FOREST ENVIRONMENT
 * File: src/game/world/atmosphere/ForestEnvironmentSystem.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VARIABLE          DEFAULT  WHAT IT DOES                    QUALITY AFFECT
 * grassSpacing      25px     Distance between grass blades   25/35/OFF
 * grassBendRadius   40px     Player proximity to bend grass
 * grassSpringiness  0.08-0.12 Return speed to upright
 * treeCount         worldW/400 Number of trees
 * treeSwayAmplitude 0.02-0.05 Rotation amount
 * vineCount         worldW/250 Number of hanging vines
 * vineSwayRadius    100px    Player proximity to sway vines
 * waterPointSpacing 15px     Distance between water surface points
 * waterSpread       0.15     Wave propagation coefficient
 * waterDamping      0.98     Wave decay per frame
 * rainCount         60       Number of rain drops            60/30/OFF
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 17. PLAYER ABILITIES
 * File: src/game/entities/player/PlayerEntity.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ABILITY   KEY       COST     COOLDOWN  RANGE   WHAT IT DOES
 * hover     hold jump 30 en/s  —         —       Slow descent in mid-air
 * grapple   F/D-Up    —        800ms     320px   Pull toward grapple anchor
 * emp       G/D-Down  40 en    3000ms    200px   Stun enemies + open EMP doors
 * hack      hold E    —        —         60px    Convert enemy to friendly (1.5s)
 *
 * Unlock: through skill tree (skill points) or mini-boss defeat (wallJump)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 18. COMPANION
 * File: src/game/entities/companion/CompanionEntity.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VARIABLE        DEFAULT  WHAT IT DOES
 * followOffsetX   30px     Offset from player (right)
 * followOffsetY   -40px    Offset from player (up)
 * followEase      0.08     Lerp factor for smooth follow
 * bobAmplitude    4px      Idle vertical bob
 * bobSpeed        600ms    Bob cycle duration
 * orbRadius       8px      Main orb size
 * glowRadius      18px     Outer glow size
 *
 * Future hooks (architecture-ready, not implemented):
 *   scan()  — detect hidden structures
 *   heal()  — restore HP on cooldown
 *   shield() — defensive barrier
 *   attack() — fire at nearest enemy
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 19. SAVE SYSTEM
 * File: src/game/systems/SaveSystem.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * STORAGE: localStorage key = 'mecha_last_protocol_save_v3'
 * VERSION: 3 (migration on load)
 *
 * PlayerState:
 *   level, xp, skillPoints, totalKills, bossesKilled
 *   unlockedSkills[], unlockedWeapons[], currentWeapon, weaponLevels{}
 *   inventory[], abilities[]
 *   collectedCollectibles[], openedShortcuts[]
 *   selectedChassis, selectedPaint, unlockedChassis[], unlockedPaints[]
 *   unlockedCompanions[], selectedCompanion
 *
 * GameSettings:
 *   locale, masterVolume, musicVolume, sfxVolume, muted, brightness
 *   quality ('low'|'medium'|'high'), fullscreen
 *
 * Other: checkpoint, bestBossTimes{}, questFlags{}, npcFlags{},
 *        unlockedAreas[], discoveredAreas[]
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 20. UI THEME
 * File: src/game/ui/Theme.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VARIABLE        VALUE      USED FOR
 * BG_VOID         0x05080c   Darkest background (overlay)
 * BG_PANEL        0x0a0d14   Panel background
 * BG_PANEL_HI     0x0d1218   Highlighted panel
 * STROKE_DIM      0x1a3040   Dim border
 * STROKE_MED      0x2a3040   Medium border
 * STROKE_BRIGHT   0x39d0d8   Bright accent (cyan)
 * TEXT_DIM        #3a4350    Dim text
 * TEXT_MED        #5a6470    Medium text
 * TEXT_BRIGHT     #cfd6e0    Bright text
 * TEXT_ACCENT     #66f0ff    Cyan accent text
 * TEXT_AMBER      #ffc040    Amber text
 * TEXT_GREEN      #40ff80    Green text
 * TEXT_RED        #ff4060    Red text
 * AMBER           0xffc040   Amber brand color
 * CYAN            0x39d0d8   Cyan brand color
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 21. LOCALIZATION
 * Files: src/game/data/localization/{en,fa}.json
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ~287 keys per language covering:
 *   menu.*, game.*, section.*, area.*, region.*, act.*
 *   enemy.*, weapon.*, skill.*, item.*, npc.*, dialogue.*
 *   lore.*, checkpoint.*, levelup.*, gameover.*, victory.*
 *   controls.*, paint.*, chassis.*, companion.*, hangar.*
 *
 * fixTextStyle() in LocalizationSystem:
 *   fa locale → DejaVu Sans + letterSpacing 0 (Arabic shaping)
 *   en locale → monospace + original letterSpacing
 */
