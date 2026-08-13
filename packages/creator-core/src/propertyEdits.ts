import { isLocalizedText } from '@kajay/core';
import type { MetadataRegistry, PropertyValue, SurveyElement } from '@kajay/core';
import type { DesignSurface } from './DesignSurface.js';
import { renameThroughout } from './fragments.js';
import { renameMarkers } from './markerEdits.js';
import { nameRefusal } from './nameRefusal.js';
import { refuse } from './EditRefusal.js';
import type { EditRefusal } from './EditRefusal.js';
import { DEFAULT_LOCALE_KEY } from './propertyGrid.js';

/**
 * Writing a property from the grid — checklist L1.
 *
 * Two paths, and the split is not arbitrary. Every property but one is a value on the
 * model, so it is set in place through `change` and undo records it like any other edit.
 * `name` is the survey's own identity — what every expression, every piped `{who}` and the
 * response data all refer to — so changing it is a *structural* edit through `applyEdit`,
 * with the references rewritten to follow.
 */

/**
 * Sets a declared property. Says why it did not take, or `undefined` when it did.
 *
 * Refuses a property the element's type does not declare, rather than storing it: the grid
 * only ever offers declared ones, so anything else arriving here is a caller that has got
 * the element and the property from two different places — and a value written under an
 * unregistered name would round-trip as an unknown property and never be seen again.
 */
export function setPropertyOn(
  surface: DesignSurface,
  element: SurveyElement,
  name: string,
  value: PropertyValue,
  registry: MetadataRegistry,
): EditRefusal | undefined {
  const descriptor = registry
    .getProperties(element.type)
    .find((property) => property.name === name);
  if (descriptor === undefined) {
    return refuse('unknown-property', name);
  }
  if (name === 'name') {
    const current = element.getPropertyValue('name');
    // An element with no name is one the survey cannot refer to at all, so there is
    // nothing to rename *from* — reported as not-found rather than as a bad new name,
    // which would blame the designer's typing for the document's shape.
    return typeof current === 'string'
      ? renameIn(surface, current, String(value))
      : refuse('not-found', name);
  }
  const written = merged(element.getPropertyValue(name), value, descriptor.isLocalizable, surface);
  // Returned rather than discarded: `change` is where the read-only refusal is minted, and
  // dropping it here is exactly the silence ADR-0023 is about — one layer further in.
  return surface.change(() => {
    element.setPropertyValue(name, written);
  }, undoKeyFor(element, name));
}

/**
 * Every keystroke of one field is one undo entry — checklist K6's coalescing.
 *
 * Keyed on the element *and* the property, so moving from the title to the description
 * ends the run. Keying on the element alone would give a designer back a title and a
 * description together, which is not what either of them means by undoing.
 */
function undoKeyFor(element: SurveyElement, name: string): string {
  return `property:${String(element.getPropertyValue('name') ?? '')}:${name}`;
}

/**
 * A localized value is edited **in place**, never replaced.
 *
 * A title authored as `{ default: 'Name', fr: 'Nom' }` is written back with only the
 * current locale's entry changed. Overwriting it with a plain string would drop every
 * other language the moment somebody fixed a typo, and nothing about typing in a text box
 * suggests that is what happened. K3's inline title editor made this decision first; this
 * is the same rule generalized to every localizable property, which is what stops
 * `description` and `placeholder` quietly behaving differently from `title`.
 *
 * Only when the property is *already* localized. A plain string stays a plain string —
 * turning one into an object because somebody typed in the box would put a shape in the
 * definition nobody asked for.
 */
function merged(
  current: PropertyValue | undefined,
  value: PropertyValue,
  isLocalizable: boolean,
  surface: DesignSurface,
): PropertyValue {
  if (!isLocalizable || !isLocalizedText(current) || typeof value !== 'string') {
    return value;
  }
  const locale = surface.survey.locale;
  return { ...current, [locale.length > 0 ? locale : DEFAULT_LOCALE_KEY]: value };
}

/**
 * Writes one language of a localizable property — checklist L2.
 *
 * The grid's main field edits whichever language the survey is being read in;
 * this is what a translations panel calls to edit any of them, which is the whole of the
 * "localizable-string editor" the row asks for. Refused for a property the registry does
 * not call localizable, because storing `{ default: … }` in one that is not would produce
 * a shape every reader of it treats as an object rather than as words.
 *
 * **Clearing the last translation gives the plain string back.** `{ default: 'Name' }` and
 * `'Name'` mean the same thing, and leaving the object behind would make a survey that had
 * once been translated permanently different from one that never was — a diff nobody made
 * and a shape nobody wrote.
 */
export function setLocalizedOn(
  surface: DesignSurface,
  element: SurveyElement,
  name: string,
  locale: string,
  text: string,
  registry: MetadataRegistry,
): EditRefusal | undefined {
  const descriptor = registry
    .getProperties(element.type)
    .find((property) => property.name === name);
  if (descriptor === undefined) {
    return refuse('unknown-property', name);
  }
  // A blank locale is the same refusal as a property that does not translate: both mean
  // "there is no language this text belongs to", and splitting them would give a
  // translations panel two messages for one mistake nobody makes twice.
  if (!descriptor.isLocalizable || locale.length === 0) {
    return refuse('not-localizable', name);
  }
  const written = withLocale(element.getPropertyValue(name), locale, text);
  return surface.change(() => {
    element.setPropertyValue(name, written);
  }, `${undoKeyFor(element, name)}:${locale}`);
}

function withLocale(current: PropertyValue | undefined, locale: string, text: string): PropertyValue {
  const entries: Record<string, string | undefined> = isLocalizedText(current)
    ? { ...current }
    : plainEntries(current);
  if (text.length === 0) {
    delete entries[locale];
  } else {
    entries[locale] = text;
  }
  const keys = Object.keys(entries);
  if (keys.length === 0) {
    // The registered default for a string, which canonical form elides — so a property
    // whose every translation was removed serializes as absent rather than as `{}`.
    return '';
  }
  const only = keys[0];
  return keys.length === 1 && only === DEFAULT_LOCALE_KEY
    ? (entries[only] ?? '')
    : (entries as PropertyValue);
}

/** A plain string is the `default` language, which is what every reader falls back to. */
function plainEntries(current: PropertyValue | undefined): Record<string, string | undefined> {
  return typeof current === 'string' && current.length > 0
    ? { [DEFAULT_LOCALE_KEY]: current }
    : {};
}

/**
 * Renames an element or a page, and every reference to it — checklist L1.
 *
 * **The references have to follow, and that is the whole of this function.** A rename that
 * only changed the `name` key would leave `visibleIf: "{who} = 'yes'"` pointing at a
 * question that no longer exists — the survey would still parse, still render, and simply
 * stop working, which K5 already argued is worse than failing loudly. The rewrite is K5's
 * own, with a map of one.
 *
 * Refused when the name is blank or already spoken for. A collision is the exact failure
 * `uniqueName` exists to prevent: two questions answering to one name, with
 * `getQuestionByName` returning whichever the parser saw first.
 *
 * **The reason comes back, and the same predicate the field asks with decides it** —
 * [`nameRefusal`](./nameRefusal.ts). Before ADR-0023 this returned `false` and the field
 * silently put the old name back, which is indistinguishable from a text box that ate the
 * typing.
 */
export function renameIn(
  surface: DesignSurface,
  from: string,
  to: string,
): EditRefusal | undefined {
  const trimmed = to.trim();
  const before = surface.definition;
  const refusal = nameRefusal(before, trimmed);
  if (refusal !== undefined) {
    return refusal;
  }
  const page = surface.page?.name;
  const selected = surface.selection.name;
  // The markers follow too. A blank's name appears twice — in the collection and in the
  // prose that positions it — and a rename that moved only the first left `[[old]]`
  // naming a blank nobody declares, which is an error rather than a cosmetic drift.
  const renamed = renameThroughout(before, from, trimmed, surface.registry);
  surface.applyEdit(renameMarkers(renamed, surface.registry, from, trimmed), {
    // The renamed thing keeps the selection when it *was* the selection. Renaming a
    // matrix column from the collection editor is not a request to select the column —
    // and always selecting the renamed element would empty the grid the designer is
    // typing in, because a nested child is not something the selection can resolve to.
    select: selected === from ? trimmed : selected,
    // Renaming the page a designer is looking at must not navigate away from it. The
    // default — stay on the page of that name — is the one thing that cannot work here.
    goTo: page === from ? trimmed : page,
    from: before,
  });
  return undefined;
}
