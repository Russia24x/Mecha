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

/**
 * Persian text rendering helpers.
 *
 * PROBLEM: Phaser's canvas-based Text renders Arabic/Persian script with each
 * letter as a separate glyph when `letterSpacing > 0` is applied OR when the
 * font family falls back to a non-Arabic font. This breaks Arabic shaping
 * (letter joining) — Persian text appears as "س ل ا م" instead of "سلام".
 *
 * SOLUTION:
 *   1. When locale is `fa`, force letterSpacing: 0 (no per-letter spacing).
 *   2. Use a font family that has Arabic glyphs (DejaVu Sans / FreeSerif).
 *   3. Drop the 'monospace' family for Persian (monospace lacks Arabic shaping).
 */

/** Returns true if the current locale is a right-to-left script (Persian/Arabic). */
export function isRTL(): boolean {
  return currentLocale === 'fa';
}

/**
 * Returns a corrected font family string for the current locale.
 * - English: keeps the original monospace aesthetic.
 * - Persian: uses DejaVu Sans (which has Arabic shaping + canvas bidi support).
 */
export function localizedFont(preferredEn: string = 'monospace'): string {
  if (currentLocale === 'fa') {
    // DejaVu Sans has full Arabic shaping support and ships with the runtime.
    return 'DejaVu Sans, Tahoma, sans-serif';
  }
  return preferredEn;
}

/**
 * Returns letterSpacing appropriate for the current locale.
 * - English: returns the requested spacing (default 0).
 * - Persian: always returns 0 (spacing breaks Arabic letter joining).
 */
export function localizedLetterSpacing(requested: number = 0): number {
  if (currentLocale === 'fa') return 0;
  return requested;
}

/**
 * Returns a Text style object with Persian-aware overrides applied.
 * Pass the base style; this returns a new object with font + letterSpacing fixed.
 */
export function fixTextStyle(style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.Types.GameObjects.Text.TextStyle {
  const base = style as Record<string, unknown>;
  const fontFamily = (base.fontFamily as string) || 'monospace';
  const letterSpacing = (base.letterSpacing as number) || 0;
  return {
    ...style,
    fontFamily: localizedFont(fontFamily),
    letterSpacing: localizedLetterSpacing(letterSpacing),
    // RTL align for Persian
    align: currentLocale === 'fa' ? 'right' : (base.align as string) || 'left',
  } as Phaser.Types.GameObjects.Text.TextStyle;
}

export { TRANSLATIONS };
