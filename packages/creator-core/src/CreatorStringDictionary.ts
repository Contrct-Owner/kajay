import { EN_CREATOR_STRINGS, formatCreatorString } from './creatorStrings.js';
import type { CreatorStringKey, CreatorStrings } from './creatorStrings.js';

/**
 * The Creator's own words, in whichever languages a host registers — checklist N3.
 *
 * **One per Creator, not one per process**, which is the decision J2 made for the runtime's
 * dictionary and for the same reason: a host running two tenants' Creators in one page
 * should be able to give them different words without either seeing the other's. White
 * labelling is exactly that case — one deployment says "Question", another says "Field".
 *
 * A host **registers over** the built-ins rather than replacing them, so renaming one
 * button does not silently blank the other eighty.
 */
export class CreatorStringDictionary {
  /** What hosts have registered. English is not in here — see {@link get}. */
  readonly #locales: Map<string, CreatorStrings> = new Map();

  /** Adds or overrides words for one locale. Absent keys keep what was there. */
  register(locale: string, strings: CreatorStrings): void {
    this.#locales.set(locale, { ...this.#locales.get(locale), ...strings });
  }

  /**
   * The word for a key, in a locale.
   *
   * Falls back exactly as the runtime's does — locale, then base language, then the
   * **registered** English rather than the shipped constant. That last step is J2's own
   * finding: a host who reworded a button in English expects to see it in a Creator that
   * names no locale at all, which is most of them, and falling through to the constant
   * quietly ignored every override on the commonest path there is.
   *
   * **Never empty, and total rather than guarded.** The shipped English is complete by
   * construction, so the last step always answers — there is no key it can be missing. An
   * untranslated button with no label is worse in every language than one labelled in the
   * wrong one, and this is how that is guaranteed rather than hoped for.
   */
  get(locale: string, key: CreatorStringKey, ...parameters: readonly (string | number)[]): string {
    const template =
      this.#locales.get(locale)?.[key] ??
      this.#locales.get(baseLanguage(locale))?.[key] ??
      this.#locales.get('en')?.[key] ??
      EN_CREATOR_STRINGS[key];
    return formatCreatorString(template, parameters);
  }
}

function baseLanguage(locale: string): string {
  const separator = locale.indexOf('-');
  return separator > 0 ? locale.slice(0, separator) : locale;
}
