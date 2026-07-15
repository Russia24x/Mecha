/**
 * MECHA: LAST PROTOCOL - I18n (Internationalization)
 * Two languages: English (en) and Persian (fa).
 * All game text is loaded from JSON files in i18n/ folder.
 * Language can be switched at runtime via Settings.
 */
import en from './en.json';
import fa from './fa.json';

export type Lang = 'en' | 'fa';

const translations: Record<Lang, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  fa: fa as Record<string, unknown>,
};

let currentLang: Lang = 'en';

/** Get current language. */
export function getLang(): Lang { return currentLang; }

/** Set current language. */
export function setLang(lang: Lang): void { currentLang = lang; }

/**
 * Get a translated string by dot-path key.
 * Example: t('menu.title') → "MECHA"
 * Example: t('stages.1.sections.2') → "Combat Room A"
 */
export function t(key: string): string {
  const parts = key.split('.');
  let val: unknown = translations[currentLang];
  for (const p of parts) {
    if (val && typeof val === 'object' && p in (val as Record<string, unknown>)) {
      val = (val as Record<string, unknown>)[p];
    } else {
      return key; // fallback: return the key itself
    }
  }
  return typeof val === 'string' ? val : key;
}

/**
 * Get a translated string array (for lore lines).
 * Example: tArray('bosses.guardian.lore') → ["The last sentinel...", ...]
 */
export function tArray(key: string): string[] {
  const parts = key.split('.');
  let val: unknown = translations[currentLang];
  for (const p of parts) {
    if (val && typeof val === 'object' && p in (val as Record<string, unknown>)) {
      val = (val as Record<string, unknown>)[p];
    } else {
      return [key];
    }
  }
  return Array.isArray(val) ? val.map(String) : [key];
}

/** Toggle between en and fa. */
export function toggleLang(): void {
  currentLang = currentLang === 'en' ? 'fa' : 'en';
}
