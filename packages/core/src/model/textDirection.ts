/** Which way the survey reads. */
export type TextDirection = 'ltr' | 'rtl';

/** What a definition may say about it: derive from the locale, or state it outright. */
export type TextDirectionSetting = 'auto' | TextDirection;

/**
 * The languages written right to left — checklist J3.
 *
 * A list rather than a lookup, because there is no runtime API that answers this
 * everywhere the library runs: `Intl.Locale.prototype.getTextInfo` is not in every
 * engine the supported browsers include, and a feature test that silently guessed
 * left-to-right would lay out an Arabic survey backwards on exactly the engines least
 * likely to be tested. Base languages only — a region never changes the direction.
 */
// Arabic, Aramaic, Central Kurdish, Divehi, Persian, Hebrew, Kashmiri, Kurdish,
// Pashto, Sindhi, Uyghur, Urdu, Yiddish.
const RTL_LANGUAGES: ReadonlySet<string> = new Set([
  'ar',
  'arc',
  'ckb',
  'dv',
  'fa',
  'he',
  'ks',
  'ku',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
]);

export function toTextDirectionSetting(declared: string): TextDirectionSetting {
  return declared === 'rtl' || declared === 'ltr' ? declared : 'auto';
}

/**
 * Which way a survey reads, given its locale and what the definition says.
 *
 * **Derived from the language by default.** Direction is a fact about a script, not a
 * preference: an author who translates a survey into Hebrew should not also have to
 * remember to flip a switch, and one who forgets would ship a survey laid out
 * backwards. The setting exists for the cases the list cannot know — a private locale
 * tag, or a survey deliberately laid out against its language.
 */
export function resolveTextDirection(
  locale: string,
  setting: TextDirectionSetting,
): TextDirection {
  if (setting !== 'auto') {
    return setting;
  }
  const separator = locale.indexOf('-');
  const language = separator > 0 ? locale.slice(0, separator) : locale;
  return RTL_LANGUAGES.has(language.toLowerCase()) ? 'rtl' : 'ltr';
}
