# طرح پیاده‌سازی: سیستم Save/Load با IndexedDB + پروفایل

> تاریخ: 2026-07-15
> وضعیت: طرح قبل از کد — نیاز به تأیید کاربر

---

## هدف

1. **IndexedDB** به‌جای localStorage — داده‌ها با پاک کردن کش مرورگر از بین نمی‌روند
2. **سیستم پروفایل** — ۳ اسلات، نام بازیکن
3. **Save/Load** — ذخیره‌ی خودکار + دستی

---

## معماری فعلی (آنچه باید تغییر کند)

### مشکل‌ها:
1. `localStorage` با پاک کردن کش از بین می‌رود
2. فقط ۱ اسلات سیو — New Game داده‌ی قبلی را پاک می‌کند
3. ۴ سیستم ذخیره‌سازی موازی (SaveSystem, shared/Save.ts, shared/SaveManager.ts, shared/SkillTree.ts) — باید یکپارچه شوند
4. نام بازیکن وجود ندارد
5. ذخیره‌ی خودکار (auto-save) وجود ندارد

### آنچه باید حفظ شود:
- تمام API‌های عمومی SaveSystem (۴۰+ متد)
- تمام callers (۱۱ نقطه برای get، صدها نقطه برای mutator‌ها)
- Cache pattern (load/persist)
- Migration (v3)
- DEFAULT_SAVE / DEFAULT_PLAYER / DEFAULT_SETTINGS

---

## معماری جدید

### ساختار IndexedDB

```
Database: mecha_last_protocol
Object Store: profiles (keyPath: "slot")
  ├── slot 0: { slot: 0, name: "", saveData: null, createdAt: 0, updatedAt: 0 }
  ├── slot 1: { slot: 1, name: "Atlas", saveData: SaveData, createdAt: ..., updatedAt: ... }
  └── slot 2: { slot: 2, name: "Guardian", saveData: SaveData, ... }

Object Store: settings (keyPath: "key")
  └── "global": { key: "global", settings: GameSettings }  ← تنظیمات سراسری (مستقل از پروفایل)
```

### ProfileData type

```ts
interface ProfileData {
  slot: number;           // 0, 1, 2
  name: string;            // نام بازیکن
  saveData: SaveData | null;  // null = empty slot
  createdAt: number;
  updatedAt: number;
  playTime: number;        // total play time in seconds
}
```

### لایه‌های معماری

```
┌─────────────────────────────────────────────┐
│           GameScene + UI                    │  ← callers (تغییر نمی‌کنند)
└──────────────────┬──────────────────────────┘
                   │ SaveSystem.get/setX/...
┌──────────────────▼──────────────────────────┐
│           SaveSystem (façade)               │  ← API یکسان، پیاده‌سازی جدید
│  - profile: ProfileData | null               │
│  - cache: SaveData | null                   │
│  - currentSlot: number                       │
└──────────┬──────────────┬───────────────────┘
           │              │
    ┌──────▼──────┐  ┌───▼───────────────┐
    │ ProfileDB   │  │ AutoSaveManager    │
    │ (IndexedDB) │  │ (per 30s + event)  │
    └─────────────┘  └────────────────────┘
```

### SaveSystem (façade) — API تغییر نمی‌کند

تمام ۴۰+ متد موجود همان‌طور باقی می‌مانند. فقط پیاده‌سازی داخلی تغییر می‌کند:
- `load()` → از IndexedDB می‌خواند (async)
- `persist()` → به IndexedDB می‌نویسد (async)
- `clear()` → saveData را null می‌کند + به IndexedDB می‌نویسد

**چالش:** IndexedDB async است، ولی SaveSystem sync است. دو راه‌حل:

**راه‌حل انتخابی:** SaveSystem همچنان sync با cache در memory کار می‌کند. IndexedDB فقط برای persistence است. `persist()` به IndexedDB می‌نویسد (fire-and-forget، async). `load()` در startup از IndexedDB می‌خواند و در cache ذخیره می‌کند. این یعنی:
- Startup: async load from IndexedDB → cache
- Gameplay: sync read/write cache
- Persist: async write to IndexedDB (fire-and-forget)

### متدهای جدید SaveSystem

```ts
// Profile management
static async initProfiles(): Promise<void>  // ایجاد DB + ۳ اسلات خالی
static async getProfiles(): Promise<ProfileData[]>  // لیست ۳ اسلات
static async selectProfile(slot: number): Promise<void>  // انتخاب + load
static async createProfile(slot: number, name: string): Promise<void>  // نام + DEFAULT_SAVE
static async deleteProfile(slot: number): Promise<void>  // پاک کردن اسلات
static getCurrentProfile(): ProfileData | null
static getCurrentSlot(): number
static getProfileName(): string

// Save/Load
static async saveToSlot(): Promise<void>  // نوشتن cache در IndexedDB
static async loadFromSlot(slot: number): Promise<void>  // خواندن از IndexedDB به cache
static isLoaded(): boolean  // آیا profile انتخاب و load شده؟

// Auto-save
static enableAutoSave(intervalMs: number): void
static disableAutoSave(): void
```

### autoSaveManager

```ts
class AutoSaveManager {
  private timer: Phaser.Time.TimerEvent | null = null;
  private dirty: boolean = false;

  static markDirty(): void  // هر بار که SaveSystem.persist صدا زده شد
  static start(scene: Phaser.Scene, intervalMs: number): void  // هر ۳۰ ثانیه اگر dirty
  static stop(): void
  static saveNow(): Promise<void>  // manual save
}
```

---

## مراحل پیاده‌سازی

### فاز ۱: ProfileDB (IndexedDB wrapper)
**فایل جدید:** `src/game/systems/ProfileDB.ts`

- ایجاد/باز کردن database
- Object store: profiles (۳ اسلات)
- Object store: settings (global)
- متدها: `getProfile(slot)`, `getAllProfiles()`, `putProfile(profile)`, `deleteProfile(slot)`, `getSettings()`, `putSettings(settings)`
- Migration از localStorage قدیمی (اگر `mecha_last_protocol_save_v3` وجود دارد، به slot ۰ منتقل کن)

### فاز ۲: ProfileManager (مدیریت اسلات‌ها)
**فایل جدید:** `src/game/systems/ProfileManager.ts`

- `initProfiles()` — ایجاد ۳ اسلات خالی در startup
- `getProfiles()` — لیست پروفایل‌ها برای UI
- `selectProfile(slot)` — انتخاب + load saveData به SaveSystem.cache
- `createProfile(slot, name)` — نام + DEFAULT_SAVE
- `deleteProfile(slot)` — پاک کردن
- UI: ProfileSelectScreen (قبل از منو)

### فاز ۳: SaveSystem rewrite (façade)
**فایل:** `src/game/systems/SaveSystem.ts`

- اضافه‌شدن `currentSlot`, `profileName`, `profile`
- `load()` → از `ProfileDB.getProfile(currentSlot)` (async در init، sync در runtime با cache)
- `persist()` → `ProfileDB.putProfile(...)` (fire-and-forget async)
- `clear()` → saveData = null + persist
- تمام ۴۰+ متد موجود بدون تغییر API
- `init()` در startup: `ProfileDB.init()` → اگر اولین بار، migrate از localStorage

### فاز ۴: AutoSaveManager
**فایل جدید:** `src/game/systems/AutoSaveManager.ts`

- هر ۳۰ ثانیه اگر dirty: `SaveSystem.saveToSlot()`
- `markDirty()` در هر `persist()` صدا زده می‌شود
- Manual save: `SaveNow()` (با toast "Game Saved")
- در checkpoint: `saveNow()` (فوری)

### فاز ۵: Profile UI
**فایل جدید:** `src/game/ui/profile/ProfileSelectUI.ts`

- نمایش ۳ اسلات (خالی/پر)
- اگر پر: نام، level، playtime، آخرین به‌روزرسانی
- دکمه‌ها: New Game (اسلات خالی) / Continue (اسلات پر) / Delete
- ورود نام: کیبورد on-screen یا prompt
- پس از انتخاب: وارد منوی اصلی

### فاز ۶: MenuBuilder update
- قبل از منو، ProfileSelectUI نمایش داده شود
- "NEW GAME" → انتخاب اسلات خالی + ورود نام
- "CONTINUE" → انتخاب اسلات پر

### فاز ۷: پاک‌سازی duplicate save systems
- حذف `shared/Save.ts`
- حذف `shared/SaveManager.ts`
- حذف `shared/SkillTree.ts` (migration به SaveSystem)
- بررسی `features/scenes/SettingsScene.ts` (احتمالاً dead code)

---

## مهاجرت داده

### از localStorage قدیمی به IndexedDB

در اولین بار که بازی با کد جدید اجرا می‌شود:
1. `localStorage.getItem('mecha_last_protocol_save_v3')` را بررسی کن
2. اگر وجود داشت: JSON parse → saveData → در slot ۰ ذخیره کن
3. `localStorage.removeItem('mecha_last_protocol_save_v3')` (پاک کردن قدیمی)
4. از این پس، بازی از IndexedDB می‌خواند

### Save version bump
- `SAVE_VERSION = 4` (افزودن پروفایل‌ها و playTime)
- `migrate()` v3 → v4: افزودن فیلدهای جدید (playTime = 0)

---

## ریسک‌ها و راه‌حل‌ها

### ریسک ۱: async/sync mismatch
- **مشکل:** IndexedDB async است، ولی SaveSystem sync است
- **راه‌حل:** Cache در memory نگه داشته می‌شود. `persist()` fire-and-forget async است. `load()` فقط در startup (init) async است.

### ریسک ۲: از دست رفتن داده
- **مشکل:** اگر بازی crash کند قبل از persist
- **راه‌حل:** Auto-save هر ۳۰ ثانیه + manual save در checkpoint

### ریسک ۳: browser compatibility
- **مشکل:** بعضی مرورگرها IndexedDB را محدود می‌کنند (private mode)
- **راه‌حل:** fallback به localStorage با هشدار

### ریسک ۴: backward compatibility
- **مشکل:** بازیکنانی که با localStorage قدیمی سیو کرده‌اند
- **راه‌حل:** Migration در اولین startup

---

## تست

1. ایجاد ۳ پروفایل با نام‌های مختلف
2. سیو در پروفایل ۱ → انتخاب پروفایل ۲ → داده‌ها متفاوت
3. پاک کردن کش مرورگر → داده‌ها باید باقی بمانند (IndexedDB)
4. ادامه از پروفایل ۱ → داده‌ها صحیح
5. New Game در پروفایل ۳ → پروفایل ۱ و ۲ دست‌نخورده
6. Auto-save هر ۳۰ ثانیه
7. Manual save → toast "Game Saved"
8. Migration از localStorage قدیمی

---

## زمان تخمینی

| فاز | زمان |
|------|------|
| ۱. ProfileDB | ۲ ساعت |
| ۲. ProfileManager | ۱ ساعت |
| ۳. SaveSystem rewrite | ۲ ساعت |
| ۴. AutoSaveManager | ۱ ساعت |
| ۵. Profile UI | ۲ ساعت |
| ۶. MenuBuilder update | ۳۰ دقیقه |
| ۷. پاک‌سازی | ۳۰ دقیقه |
| **مجموع** | **~۹ ساعت** |
