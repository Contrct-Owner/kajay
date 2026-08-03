import { isLocalizedText } from '@kajay/core';
import type { MetadataRegistry, PropertyValue, SurveyElement } from '@kajay/core';
import type { DesignSurface } from './DesignSurface.js';
import { renameThroughout, takenNames } from './fragments.js';

/**
 * Writing a property from the grid — checklist L1.
 *
 * Two paths, and the split is not arbitrary. Every property but one is a value on the
 * model, so it is set in place through `change` and undo records it like any other edit.
 * `name` is the survey's own identity — what every expression, every piped `{who}` and the
 * response data all refer to — so changing it is a *structural* edit through `applyEdit`,
 * with the references rewritten to follow.
 */

/** The one place a localized property is written, so the key it lands under is decided once. */
const DEFAULT_LOCALE_KEY = 'default';

/**
 * Sets a declared property. Says whether it took.
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
): boolean {
  const descriptor = registry
    .getProperties(element.type)
    .find((property) => property.name === name);
  if (descriptor === undefined) {
    return false;
  }
  if (name === 'name') {
    const current = element.getPropertyValue('name');
    return typeof current === 'string' && renameIn(surface, current, String(value));
  }
  const written = merged(element.getPropertyValue(name), value, descriptor.isLocalizable, surface);
  surface.change(() => {
    element.setPropertyValue(name, written);
  }, undoKeyFor(element, name));
  return true;
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
 * `getQuestionByName` returning whichever the parser saw first. Refusing is reported
 * rather than announced, so the field a designer is typing in reverts and nothing else
 * moves.
 */
export function renameIn(surface: DesignSurface, from: string, to: string): boolean {
  const trimmed = to.trim();
  const before = surface.definition;
  // Renaming something to what it is already called needs no separate guard: its own
  // name is one of the taken ones. A `trimmed === from` check beside this would read as
  // if it were doing something and could never fail.
  if (trimmed.length === 0 || takenNames(before).has(trimmed)) {
    return false;
  }
  const page = surface.page?.name;
  const selected = surface.selectedName;
  surface.applyEdit(renameThroughout(before, from, trimmed), {
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
  return true;
}
