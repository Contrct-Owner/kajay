import { isLocalizedText, resolveLocalizedText } from '@kajay/core';
import type { LocalizedText, SurveyDefinition } from '@kajay/core';

/**
 * Editing a whole choice list as text — checklist L2's fast entry.
 *
 * One item per line, `value` or `value|text`. That is the shape everybody who has typed a
 * choice list before expects, and it is the only shape a **shorthand** collection can
 * round-trip: the registry says `choices: ["a"]` means `[{ value: "a" }]`, so the value is
 * the one field that must survive and the text is the one that usually differs from it.
 *
 * Offered **only where the registry declares a shorthand**, which is why this needs no list
 * of the collections it applies to. A validator has no scalar form, so there is nothing for
 * a line of text to be.
 */

/** Separates a value from the text shown for it. */
const SEPARATOR = '|';

/** The one place a localized entry is written, so the key it lands under is decided once. */
const DEFAULT_LOCALE_KEY = 'default';

/**
 * The collection as fast-entry text.
 *
 * A child whose text equals its value is written as the bare value, because that is what it
 * means and round-tripping it as `a|a` would teach a designer a distinction that is not
 * there. A localized text is shown **in the survey's own language**, the same decision L1's
 * grid makes about every localizable property.
 */
export function fastEntryText(
  children: readonly SurveyDefinition[],
  shorthand: string,
  locale = '',
): string {
  return children
    .map((child) => {
      const value = scalarText(child[shorthand]) ?? '';
      const text = readText(child['text'], locale);
      return text === undefined || text === value ? value : `${value}${SEPARATOR}${text}`;
    })
    .join('\n');
}

/**
 * The text read back into children — **keeping what a line cannot say**.
 *
 * An item whose value is unchanged keeps every other property it had: its `visibleIf`, its
 * `imageLink`, anything a host added. Rebuilding the list from the text alone would mean
 * that fixing a typo on one line silently deleted the conditional visibility on another — a
 * fast entry that is only safe on lists nobody has customized, which is not a useful thing
 * to have.
 *
 * A blank line is skipped rather than becoming an item with no value: pressing return at the
 * end of a list is how people type, not a request for an empty choice.
 */
export function fastEntryItems(
  text: string,
  shorthand: string,
  existing: readonly SurveyDefinition[],
  locale = '',
): readonly SurveyDefinition[] {
  const byValue = new Map(existing.map((child) => [scalarText(child[shorthand]), child]));
  const items: SurveyDefinition[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const at = trimmed.indexOf(SEPARATOR);
    const value = at < 0 ? trimmed : trimmed.slice(0, at).trim();
    const label = at < 0 ? '' : trimmed.slice(at + 1).trim();
    items.push(applied(byValue.get(value) ?? { [shorthand]: value }, shorthand, value, label, locale));
  }
  return items;
}

/**
 * One line applied to the item it names.
 *
 * The typed value replaces the stored one only when it **reads** differently, because a
 * value authored as the number `2` is the string `"2"` on a line and writing it back would
 * be this editor quietly changing the type of an answer key.
 */
function applied(
  child: SurveyDefinition,
  shorthand: string,
  value: string,
  label: string,
  locale: string,
): SurveyDefinition {
  const kept = child[shorthand];
  const output: SurveyDefinition = {
    ...child,
    [shorthand]: scalarText(kept) === value ? kept : value,
  };
  const text = writtenText(child['text'], label, locale);
  if (text === undefined) {
    delete output['text'];
  } else {
    output['text'] = text;
  }
  return output;
}

/**
 * The text a line asks for, against the text an item already has.
 *
 * **A localized text is edited in place**, exactly as L1 edits a localizable property: only
 * the current language's entry changes, so retyping one line of an English choice list does
 * not throw away its French. Clearing the label removes that one language rather than the
 * whole object — and removes the property outright once no language is left, because an
 * empty `{}` in a definition is a shape nobody wrote.
 */
function writtenText(
  current: unknown,
  label: string,
  locale: string,
): string | LocalizedText | undefined {
  if (!isLocalizedText(current)) {
    return label.length === 0 ? undefined : label;
  }
  const key = locale.length > 0 ? locale : DEFAULT_LOCALE_KEY;
  const written: Record<string, string | undefined> = { ...current };
  if (label.length === 0) {
    delete written[key];
  } else {
    written[key] = label;
  }
  return Object.keys(written).length === 0 ? undefined : (written as LocalizedText);
}

/** What a localized or plain text reads as on a line. */
function readText(value: unknown, locale: string): string | undefined {
  if (isLocalizedText(value)) {
    const resolved = resolveLocalizedText(value, locale);
    return resolved.length > 0 ? resolved : undefined;
  }
  return scalarText(value);
}

/** What a scalar reads as on a line. Anything else has no line form and is left out. */
function scalarText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
}
