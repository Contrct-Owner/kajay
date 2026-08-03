import { DE_STRINGS, ES_STRINGS, FR_STRINGS } from './seedLocales.js';
import { EN_STRINGS, formatUiString } from './uiStrings.js';
import type { UiStringKey, UiStrings } from './uiStrings.js';

const BUILT_IN: readonly (readonly [string, UiStrings])[] = [
  ['en', EN_STRINGS],
  ['fr', FR_STRINGS],
  ['de', DE_STRINGS],
  ['es', ES_STRINGS],
];

/**
 * The library's own words, in whichever languages are registered — checklist J2.
 *
 * **One per survey, not one per process.** The metadata registry is global by design and
 * the suite pays for it in care; there is no comparable reason here, and a host running
 * two tenants' surveys in one process should be able to give them different words
 * without either seeing the other's.
 *
 * A host registers over the built-ins rather than replacing them, so overriding one
 * string does not silently blank the other fifty.
 */
export class StringDictionary {
  readonly #locales: Map<string, UiStrings> = new Map(BUILT_IN);

  /** Adds or overrides strings for one locale. Absent keys keep what was there. */
  register(locale: string, strings: UiStrings): void {
    this.#locales.set(locale, { ...this.#locales.get(locale), ...strings });
  }

  /**
   * The string for a key, in a locale.
   *
   * Falls back exactly as a localizable property does — locale, then base language —
   * and then to English, which is the one table that cannot be missing an entry because
   * `register` merges rather than replaces. Never empty: an untranslated button with no
   * label is worse in every language than one labelled in the wrong one.
   */
  get(locale: string, key: UiStringKey, ...params: readonly (string | number)[]): string {
    const template =
      this.#locales.get(locale)?.[key] ??
      this.#locales.get(baseLanguage(locale))?.[key] ??
      // The **registered** English, not the shipped constant. A host that reworded a
      // button in English expects to see it on a survey that names no locale at all,
      // which is most of them; falling through to the constant here quietly ignored
      // every override on the commonest path there is.
      this.#locales.get('en')?.[key] ??
      key;
    return formatUiString(template, params);
  }
}

function baseLanguage(locale: string): string {
  const separator = locale.indexOf('-');
  return separator > 0 ? locale.slice(0, separator) : locale;
}
