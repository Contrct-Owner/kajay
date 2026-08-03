import type { SurveyDefinition } from '@kajay/core';
import type { ToolboxItem } from './ToolboxItem.js';
import { collectNames, elementsOf, withElements } from './definitionTree.js';

/**
 * A position between elements — checklist K2.
 *
 * A container and an index into it, so *n* elements offer *n + 1* slots. Positions
 * rather than neighbours, because "before element X" cannot name the end of the list
 * and "after element Y" cannot name the start, and a list with nothing in it has no
 * element to be relative to at all.
 *
 * The container is named rather than referenced for the same reason
 * {@link PlacementSource} names its element:
 * [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3 re-parses on
 * every structural edit, so no object outlives the edit that produced it. A name does.
 */
export interface DropSlot {
  /** The page a drop lands in. A panel reads correctly here and is K2-deferred. */
  readonly container: string;
  readonly index: number;
}

/**
 * What is being placed.
 *
 * The two cases are deliberately one type. A drop from the toolbox and a drag across
 * the surface are the same operation — put this at that slot — differing only in
 * whether the thing being placed already exists, and modelling them separately is how
 * they end up with two sets of rules about where a drop is allowed.
 */
export type PlacementSource =
  | { readonly kind: 'new'; readonly item: ToolboxItem }
  | { readonly kind: 'move'; readonly element: string };

/** Every position a drop could target in a container holding `elementCount` elements. */
export function dropSlotsFor(container: string, elementCount: number): readonly DropSlot[] {
  return Array.from({ length: elementCount + 1 }, (_unused, index) => ({ container, index }));
}

/**
 * Whether placing this here would do anything.
 *
 * Refusing a move that changes nothing is not fussiness: **the slot an element already
 * occupies and the slot immediately after it are the same position**, because removing
 * the element shifts everything below it up by one. A model that treated them as
 * distinct would report an edit, push an undo entry and re-parse the survey, all to
 * arrive back where it started.
 */
export function canPlace(
  definition: SurveyDefinition,
  source: PlacementSource,
  slot: DropSlot,
): boolean {
  const elements = elementsOf(definition, slot.container);
  if (elements === undefined || slot.index < 0 || slot.index > elements.length) {
    return false;
  }
  if (source.kind === 'new') {
    return true;
  }
  const from = elements.findIndex((element) => nameOf(element) === source.element);
  return from >= 0 && slot.index !== from && slot.index !== from + 1;
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
  const elements = elementsOf(definition, slot.container) ?? [];
  if (source.kind === 'new') {
    const created = createElement(source.item, collectNames(definition));
    return withElements(definition, slot.container, insertAt(elements, created, slot.index));
  }
  const from = elements.findIndex((element) => nameOf(element) === source.element);
  const moved = elements[from]!;
  const without = elements.filter((_unused, index) => index !== from);
  // The target index was measured against the list *with* the element still in it, so
  // a move downwards has to account for the hole it leaves behind. Off by one here is
  // the classic reorder bug and it only shows up in one direction.
  const to = slot.index > from ? slot.index - 1 : slot.index;
  return withElements(definition, slot.container, insertAt(without, moved, to));
}

function insertAt(
  elements: readonly SurveyDefinition[],
  element: SurveyDefinition,
  index: number,
): readonly SurveyDefinition[] {
  return [...elements.slice(0, index), element, ...elements.slice(index)];
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
 * `text1`, `text2`, … — the first one nothing has taken.
 *
 * Numbered from the type rather than from the toolbox item's title, because the name is
 * what expressions refer to and what arrives in the response data. A designer renames
 * it; a title with a space in it would have to be escaped in every `visibleIf` that
 * mentioned it.
 *
 * Uniqueness is checked across the **whole survey**, not the page: two pages holding a
 * question called `text1` each is exactly the collision that makes `getQuestionByName`
 * return the wrong one.
 */
function uniqueName(type: string, taken: ReadonlySet<string>): string {
  for (let suffix = 1; ; suffix += 1) {
    const candidate = `${type}${String(suffix)}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

function nameOf(element: SurveyDefinition): string | undefined {
  const name = element['name'];
  return typeof name === 'string' ? name : undefined;
}
