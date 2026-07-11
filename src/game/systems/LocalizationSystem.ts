/**
 * MECHA: LAST PROTOCOL — Localization System
 * Loads translations from JSON files. No hardcoded text in game code.
 */
import type { Locale } from '../data/types';
import en from '../data/localization/en.json';
import fa from '../data/localization/fa.json';

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  fa: fa as Record<string, string>,
};

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Translate a localization key.
 * Usage: t('menu.start') → "START" (en) or "شروع" (fa)
 * Falls back to English if key missing in current locale.
 * Falls back to the key itself if missing in both.
 */
export function t(key: string): string {
  return TRANSLATIONS[currentLocale]?.[key]
    ?? TRANSLATIONS.en?.[key]
    ?? key;
}

/**
 * Translate with array interpolation.
 * Usage: tArray('dialogue.npc1.intro') → ["line1", "line2", ...]
 * For now, returns single-element array. Can be extended for multi-line.
 */
export function tArray(key: string): string[] {
  const val = t(key);
  return [val];
}

export { TRANSLATIONS };
