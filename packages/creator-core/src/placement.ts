import type { SurveyDefinition } from '@kajay/core';
import type { ToolboxItem } from './ToolboxItem.js';
import {
  collectNames,
  containersWithin,
  listOf,
  locate,
  nameOf,
  sameList,
  slotsOnPage,
  uniqueName,
  withList,
} from './definitionTree.js';
import type { DropList, IsContainerType } from './definitionTree.js';
import { isTypeAllowed } from './CreatorConfiguration.js';
import type { CreatorConfiguration } from './CreatorConfiguration.js';
import { refuse } from './EditRefusal.js';
import type { EditRefusal } from './EditRefusal.js';

/**
 * A position between items — checklist K2 and K4.
 *
 * A list and an index into it, so *n* items offer *n + 1* slots. Positions rather than
 * neighbours, because "before item X" cannot name the end of the list and "after item Y"
 * cannot name the start, and a list with nothing in it has no item to be relative to at
 * all.
 *
 * The list is named rather than referenced for the same reason {@link PlacementSource}
 * names its item: [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3
 * re-parses on every structural edit, so no object outlives the edit that produced it.
 * A name does.
 */
export interface DropSlot {
  readonly list: DropList;
  readonly index: number;
}

/**
 * What is being placed.
 *
 * The cases are deliberately one type. A drop from the toolbox, a drag across the
 * canvas and a page dragged into a new order are the same operation — put this at that
 * slot — differing only in whether the thing already exists. Modelling them separately
 * is how they end up with three sets of rules about where a drop is allowed.
 */
export type PlacementSource =
  | { readonly kind: 'new'; readonly item: ToolboxItem }
  | { readonly kind: 'move'; readonly name: string };

/** Every position a drop could target in a list holding `count` items. */
export function dropSlotsFor(list: DropList, count: number): readonly DropSlot[] {
  return Array.from({ length: count + 1 }, (_unused, index) => ({ list, index }));
}

/**
 * Whether placing this here would do anything.
 *
 * Refusing a move that changes nothing is not fussiness: **the slot an item already
 * occupies and the slot immediately after it are the same position**, because removing
 * the item shifts everything below it up by one. A model that treated them as distinct
 * would report an edit, push an undo entry and re-parse the survey, all to arrive back
 * where it started.
 */
/**
 * Why a placement must not happen — [ADR-0023](../../../docs/adr/0023-the-creator-says-what-happened.md).
 *
 * **Separate from "would this change anything", and that separation is the point.**
 * `canPlace` used to answer both questions with one `false`, so dropping an element onto
 * the position it already occupies looked exactly like dropping a page into a question.
 * One is a designer changing their mind mid-drag; the other is a definition no parser
 * could read. Telling them apart is what lets the first stay silent and the second speak.
 *
 * Read-only is **not** here: it is a fact about the deployment rather than about the drop,
 * and it is minted at the two chokepoints so every edit inherits it.
 */
export function placementRefusal(
  definition: SurveyDefinition,
  source: PlacementSource,
  slot: DropSlot,
  configuration?: CreatorConfiguration | undefined,
): EditRefusal | undefined {
  const items = listOf(definition, slot.list);
  if (items === undefined || slot.index < 0 || slot.index > items.length) {
    return refuse('not-found', slot.list.of);
  }
  if (source.kind === 'new') {
    if (!isTypeAllowed(source.item.type, configuration)) {
      return refuse('type-not-allowed', source.item.type);
    }
    // A toolbox item builds a *page element*. Dropping one into the survey's page list
    // would produce a survey whose pages are questions — nothing offers that, but the
    // type can express it, so it is refused here rather than left to produce nonsense.
    return slot.list.of === 'elements' ? undefined : refuse('not-placeable', source.item.type);
  }
  if (
    slot.list.of === 'elements' &&
    containersWithin(definition, source.name).has(slot.list.container)
  ) {
    // Into itself, or into one of its own descendants. That detaches the subtree from
    // the survey and leaves it pointing at itself — a definition no parser can make
    // sense of, rather than merely a page that looks wrong.
    return refuse('not-placeable', source.name);
  }
  const at = locate(definition, source.name);
  if (at === undefined) {
    return refuse('not-found', source.name);
  }
  // **A move cannot change what kind of thing something is.** A page belongs among pages
  // and an element among elements; carrying one into the other's list would produce a
  // survey whose pages are questions — the same nonsense the `new` branch above refuses,
  // and until this row nothing refused it for a move. Unreachable by dragging, because the
  // session only offers slots of the matching kind, and reachable by anyone calling
  // `place` directly.
  return at.list.of === slot.list.of ? undefined : refuse('not-placeable', source.name);
}

/**
 * Whether this drop would leave the definition exactly as it is.
 *
 * **Not a refusal.** Nothing went wrong and there is nothing to tell anybody: a designer
 * who picks a question up and puts it back has done what they meant to. It reports no
 * change so the drop records no undo entry, which is the distinction the old single
 * `false` could not draw.
 *
 * **The two slots that mean "where it already is" only exist within one list.** Moving
 * across containers has no such pair, because removing the element does not shift
 * anything in the list it is arriving in.
 */
export function isRedundantPlacement(
  definition: SurveyDefinition,
  source: PlacementSource,
  slot: DropSlot,
): boolean {
  if (source.kind === 'new') {
    return false;
  }
  const at = locate(definition, source.name);
  return (
    at !== undefined &&
    sameList(at.list, slot.list) &&
    (slot.index === at.index || slot.index === at.index + 1)
  );
}

/**
 * Whether a drop would land and change something.
 *
 * Kept, and now *defined* as the two questions above rather than asking them itself, so
 * the slot a preview offers and the drop a commit accepts cannot come apart. Every caller
 * here wants both halves: an inactive slot is one that is either forbidden or pointless,
 * and a preview has no way to say which.
 */
export function canPlace(
  definition: SurveyDefinition,
  source: PlacementSource,
  slot: DropSlot,
): boolean {
  return (
    placementRefusal(definition, source, slot) === undefined &&
    !isRedundantPlacement(definition, source, slot)
  );
}

/**
 * Every position a drop could land in on a page, in the order they are on screen.
 *
 * Flattened across containers, so the arrow keys walk into a panel and out again without
 * a second gesture to learn — the same reason the slot names its list at all.
 */
export function dropSlotsOn(
  definition: SurveyDefinition,
  page: string,
  isContainerType: IsContainerType,
): readonly DropSlot[] {
  return slotsOnPage(definition, page, isContainerType).map((slot) => ({
    list: { of: 'elements', container: slot.container },
    index: slot.index,
  }));
}

/**
 * The definition that results from a placement, leaving the one given untouched.
 *
 * Returns the input unchanged when {@link canPlace} refuses, rather than throwing: a
 * drop landing where it started is an ordinary thing for a designer to do, and a caller
 * comparing identity can see that nothing happened.
 */
export function applyPlacement(
  definition: SurveyDefinition,
  source: PlacementSource,
  slot: DropSlot,
): SurveyDefinition {
  if (!canPlace(definition, source, slot)) {
    return definition;
  }
  if (source.kind === 'new') {
    const created = createElement(source.item, collectNames(definition));
    const items = listOf(definition, slot.list) ?? [];
    return withList(definition, slot.list, insertAt(items, created, slot.index));
  }
  const at = locate(definition, source.name)!;
  const from = listOf(definition, at.list) ?? [];
  const moved = from[at.index]!;
  // Taken out first, and the destination read from the result. A move across containers
  // touches two lists, and reading the second before the first was rewritten would put
  // the element in twice.
  const lifted = withList(
    definition,
    at.list,
    from.filter((_unused, index) => index !== at.index),
  );
  // The target index was measured against the list *with* the item still in it, so a
  // move downwards within one list has to account for the hole it leaves behind. Off by
  // one here is the classic reorder bug and it only shows up in one direction — and only
  // when the element is arriving in the list it left.
  const shift = sameList(at.list, slot.list) && slot.index > at.index ? 1 : 0;
  const items = listOf(lifted, slot.list) ?? [];
  return withList(lifted, slot.list, insertAt(items, moved, slot.index - shift));
}

function insertAt(
  items: readonly SurveyDefinition[],
  item: SurveyDefinition,
  index: number,
): readonly SurveyDefinition[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

/**
 * The definition of a brand-new element.
 *
 * The toolbox item's `defaults` are written first so that a name it carries is
 * overwritten rather than duplicated — an item may legitimately supply anything else,
 * but the name has to be one nothing else in the survey is using.
 */
function createElement(item: ToolboxItem, taken: ReadonlySet<string>): SurveyDefinition {
  return { type: item.type, ...item.defaults, name: uniqueName(item.type, taken) };
}

/**
 * What to select once the placement has landed.
 *
 * The thing that was just placed, in both cases. A designer who drops a question wants
 * to name it next, and one who moves a question has not stopped working on it — leaving
 * the selection where it was would make the very next keystroke edit the wrong element.
 *
 * A new element's name is read back out of the edited definition rather than predicted,
 * because {@link applyPlacement} is what decides it.
 */
export function placedName(
  source: PlacementSource,
  after: SurveyDefinition,
  slot: DropSlot,
): string | undefined {
  if (source.kind === 'move') {
    return source.name;
  }
  return nameOf(listOf(after, slot.list)?.[slot.index] ?? {});
}
