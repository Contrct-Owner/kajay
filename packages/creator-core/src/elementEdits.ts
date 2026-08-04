import type { MetadataRegistry, SurveyDefinition } from '@kajay/core';
import { isTypeAllowed } from './CreatorConfiguration.js';
import type { CreatorConfiguration } from './CreatorConfiguration.js';
import type { DesignSurface } from './DesignSurface.js';
import { listOf, nameOf, withList } from './definitionTree.js';
import type { DropList } from './definitionTree.js';
import { findByName, freshenFragment, takenNames } from './fragments.js';
import type { DropSlot } from './placement.js';
import { refuse } from './EditRefusal.js';
import type { EditRefusal } from './EditRefusal.js';

/**
 * Copy, paste, duplicate and convert — checklist K5.
 *
 * All four go through {@link DesignSurface.applyEdit}, so all four are undoable without
 * writing a line about undo. That is what K6 bought: an edit is a definition in and a
 * definition out, and nothing has to remember to be reversible.
 */

/** The definition of one element on the page being designed, ready to be pasted. */
export function copyFrom(surface: DesignSurface, name: string): SurveyDefinition | undefined {
  const page = surface.page;
  if (page === undefined) {
    return undefined;
  }
  return findByName(listOf(surface.definition, { of: 'elements', container: page.name }) ?? [], name);
}

/**
 * Puts a copy of an element straight after it — checklist K5.
 *
 * Straight after, rather than at the end: a duplicate is nearly always the start of "and
 * one more like that", and the two belong together while the designer edits the second.
 */
export function duplicateIn(surface: DesignSurface, name: string): EditRefusal | undefined {
  const page = surface.page;
  const fragment = copyFrom(surface, name);
  if (page === undefined || fragment === undefined) {
    return refuse('not-found', name);
  }
  const list: DropList = { of: 'elements', container: page.name };
  const at = (listOf(surface.definition, list) ?? []).findIndex(
    (element) => nameOf(element) === name,
  );
  return pasteInto(surface, fragment, { list, index: at + 1 });
}

/**
 * Inserts a fragment at a slot, giving it names nothing has taken — checklist K5.
 *
 * The fragment is freshened rather than inserted as it stands, and the *pasted* copy is
 * what ends up selected: a designer who pastes is about to work on the new one.
 */
export function pasteInto(
  surface: DesignSurface,
  fragment: SurveyDefinition,
  slot: DropSlot,
): EditRefusal | undefined {
  const before = surface.definition;
  const items = listOf(before, slot.list);
  if (items === undefined || slot.index < 0 || slot.index > items.length) {
    return refuse('not-found', 'container' in slot.list ? slot.list.container : '');
  }
  const fresh = freshenFragment(fragment, takenNames(before));
  const after = withList(before, slot.list, [
    ...items.slice(0, slot.index),
    fresh,
    ...items.slice(slot.index),
  ]);
  return surface.applyEdit(after, { select: nameOf(fresh), from: before });
}

/**
 * Removes an element, and everything inside it — checklist K7.
 *
 * Says why it did not happen, or `undefined` when it did. **Deleting a panel takes its
 * questions with it**, which
 * is the operation rather than a side effect — the same argument K4 made about a page,
 * and the same thing that makes it safe to mean: it goes through `applyEdit`, so undo
 * brings the whole subtree back without anything having written an inverse.
 *
 * What is selected afterwards is the element that took its place, or the one before it
 * when the last went. Clearing the selection would be defensible and worse: a designer
 * deleting the third of five questions is still working in the middle of a page, and an
 * empty property grid reads as having lost their place rather than removed one thing.
 */
export function removeElementFrom(
  surface: DesignSurface,
  name: string,
): EditRefusal | undefined {
  const page = surface.page;
  const before = surface.definition;
  const list: DropList = { of: 'elements', container: page?.name ?? '' };
  const items = listOf(before, list);
  const at = items?.findIndex((element) => nameOf(element) === name) ?? -1;
  if (items === undefined || at < 0) {
    return refuse('not-found', name);
  }
  const remaining = items.filter((_unused, index) => index !== at);
  return surface.applyEdit(withList(before, list, remaining), {
    select: nameOf(remaining[Math.min(at, remaining.length - 1)] ?? {}),
    from: before,
  });
}

/**
 * Changes a question's type, keeping what the new type understands — checklist K5.
 *
 * **Properties the target type does not declare are dropped.** Converting a radio group
 * to a text question loses its choices, because a text question has none — that is what
 * a conversion *is*, and pretending otherwise would mean carrying invisible state that
 * reappears if somebody converts back. K6's undo is what makes it safe to mean; the same
 * argument as deleting a page.
 *
 * The name, the title and everything else the two types share survive, which is the
 * point: a designer who picked the wrong type should not have to retype the question.
 */
export function convertIn(
  surface: DesignSurface,
  name: string,
  type: string,
  registry: MetadataRegistry,
): EditRefusal | undefined {
  const page = surface.page;
  const before = surface.definition;
  const list: DropList = { of: 'elements', container: page?.name ?? '' };
  const items = listOf(before, list);
  const element = items === undefined ? undefined : findByName(items, name);
  // Three reasons that used to be one `false`, and a designer can act on each differently:
  // find the question again, pick a compatible type, or ask whoever configured the
  // deployment. "Nothing happened" told them none of that.
  if (items === undefined || element === undefined) {
    return refuse('not-found', name);
  }
  if (!canConvert(element, type, registry)) {
    return refuse('not-convertible', name);
  }
  // A type a designer may not *add* is one they may not convert into either — otherwise
  // the restriction is a detour rather than a rule.
  if (!isTypeAllowed(type, surface.configuration)) {
    return refuse('type-not-allowed', type);
  }
  const converted = convertDefinition(element, type, registry);
  return surface.applyEdit(
    withList(
      before,
      list,
      items.map((item) => (nameOf(item) === name ? converted : item)),
    ),
    { select: name, from: before },
  );
}

/**
 * Whether this element can become that type.
 *
 * **A panel cannot be converted.** It holds elements, and a conversion that dropped the
 * properties the target does not declare would drop them too — a delete dressed up as a
 * change of type. Converting *to* a panel is refused for the mirror reason: it would
 * produce an empty container where a question used to be, which is a delete and an add
 * wearing one button.
 */
export function canConvert(
  element: SurveyDefinition,
  type: string,
  registry: MetadataRegistry,
): boolean {
  const current = element['type'];
  if (typeof current !== 'string' || current === type) {
    return false;
  }
  return isConvertibleType(current, registry) && isConvertibleType(type, registry);
}

/** The types a question can be turned into. Questions only, for the reason above. */
export function convertibleTypes(
  registry: MetadataRegistry,
  configuration?: CreatorConfiguration,
): readonly string[] {
  return registry
    .getConcreteSubclasses('question')
    .filter((type) => isTypeAllowed(type, configuration));
}

function isConvertibleType(type: string, registry: MetadataRegistry): boolean {
  return registry.isSubclassOf(type, 'question');
}

/**
 * Keeps what the target type declares, in both senses.
 *
 * **Properties and child collections.** `choices` is a child collection rather than a
 * property, so a version of this that consulted `getProperties` alone converted a radio
 * group to a dropdown and threw its choices away — two types that both have choices,
 * which is the single most obvious conversion a designer will ever do.
 */
function convertDefinition(
  element: SurveyDefinition,
  type: string,
  registry: MetadataRegistry,
): SurveyDefinition {
  const kept = new Set<string>([
    ...registry.getProperties(type).map((property) => property.name),
    ...registry.getChildCollections(type).map((collection) => collection.property),
  ]);
  const output: SurveyDefinition = { type };
  for (const [key, value] of Object.entries(element)) {
    if (key !== 'type' && kept.has(key)) {
      output[key] = value;
    }
  }
  return output;
}
