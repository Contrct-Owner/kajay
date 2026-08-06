import type { StringDictionary } from '../strings/StringDictionary.js';

/**
 * A string an author wrote once per language — checklist J1.
 *
 * `{ "default": "Name", "fr": "Nom" }`, and that object is what the definition holds:
 * a localizable property is stored exactly as authored and round-trips verbatim
 * ([ADR-0002](../../../docs/adr/0002-round-trip-fixed-point.md)). Resolving it is a
 * read, never a write — a survey that flattened its titles the first time somebody
 * looked at it in French would come back from a round trip monolingual.
 */
export interface LocalizedText {
  readonly default?: string;
  readonly [locale: string]: string | undefined;
}

/**
 * A mutable holder, shared by reference across every element in one survey.
 *
 * It carries the words as well as the language (J2). Every element already has one, so
 * hanging the dictionary here is what lets a validator deep inside a matrix cell say
 * something in the respondent's language without being handed the survey.
 */
export interface LocaleScope {
  locale: string;
  readonly strings: StringDictionary;
}

/**
 * Whether a value is the object form rather than a plain string.
 *
 * Every entry must be a string. A property whose object holds a number or a nested
 * object is not a localized string that happens to be odd — it is a different kind of
 * value, and accepting it here would put something no renderer can draw into a title.
 */
export function isLocalizedText(value: unknown): value is LocalizedText {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === 'string');
}

/**
 * The string to show, for one locale.
 *
 * ASCII-case-insensitive exact match, then the tag with its final BCP 47 subtag
 * removed, then `default`, then empty. The middle step is what makes `fr-CA` usable in
 * a survey translated into `fr`: without it a regional locale falls all the way back
 * to the default and a French-Canadian respondent reads English.
 *
 * Empty rather than a placeholder when nothing matches, because empty is what every
 * caller already treats as "nothing was authored" — a title falls back to the name, a
 * choice falls back to its value, and a description simply is not drawn.
 */
export function resolveLocalizedText(text: LocalizedText, locale: string): string {
  return (
    findLocale(text, locale) ??
    findLocale(text, parentLocale(locale)) ??
    findLocale(text, 'default') ??
    ''
  );
}

/** Locale tags use the contract's ASCII-only case-insensitive comparison. */
export function localeTagEquals(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (
      foldAscii(left.codePointAt(index) ?? -1) !== foldAscii(right.codePointAt(index) ?? -1)
    ) {
      return false;
    }
  }
  return true;
}

function findLocale(text: LocalizedText, locale: string): string | undefined {
  const key = Object.keys(text).find((candidate) => localeTagEquals(candidate, locale));
  return key === undefined ? undefined : text[key];
}

function parentLocale(locale: string): string {
  const separator = locale.lastIndexOf('-');
  return separator > 0 ? locale.slice(0, separator) : locale;
}

function foldAscii(value: number): number {
  return value >= 65 && value <= 90 ? value + 32 : value;
}
