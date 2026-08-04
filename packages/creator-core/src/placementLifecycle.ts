import type { SurveyDefinition } from '@kajay/core';
import { listOf, sameList } from './definitionTree.js';
import type { IsContainerType } from './definitionTree.js';
import { dropSlotsFor, dropSlotsOn } from './placement.js';
import type { DropSlot, PlacementSource } from './placement.js';
import type { PlacementDirection } from './PlacementSession.js';

/** What a drag just did, as facts. A UI adapter decides how to turn them into words. */
export type PlacementNarrationKind = 'grabbed' | 'moved' | 'dropped' | 'returned';

/**
 * Stable accessibility facts about a drag.
 *
 * Beside `placementNarration`, which is the only thing that builds one — a type declared
 * away from its sole producer is a type the two files have to agree about by hand.
 */
export interface PlacementNarration {
  readonly kind: PlacementNarrationKind;
  readonly label: string;
  /** Zero-based: the shared reorder formatter turns it into a spoken ordinal. */
  readonly position: number;
  readonly total: number;
  readonly container: string | undefined;
}

export function sameSlot(left: DropSlot | undefined, right: DropSlot | undefined): boolean {
  return left !== undefined && right !== undefined &&
    left.index === right.index && sameList(left.list, right.list);
}

export function containsSlot(slots: readonly DropSlot[], sought: DropSlot): boolean {
  return slots.some((slot) => sameSlot(slot, sought));
}

export function nextPlacementSlot(
  slots: readonly DropSlot[],
  current: DropSlot | undefined,
  direction: PlacementDirection,
  allowed: (slot: DropSlot) => boolean,
): DropSlot | undefined {
  const at = current === undefined ? -1 : slots.findIndex((slot) => sameSlot(slot, current));
  const from = direction === 'first' ? -1 : direction === 'last' ? slots.length : at;
  const increment = direction === 'previous' || direction === 'last' ? -1 : 1;
  for (let index = from + increment; index >= 0 && index < slots.length; index += increment) {
    const candidate = slots[index]!;
    if (allowed(candidate)) {
      return candidate;
    }
  }
  return current;
}

/** Builds accessibility facts from the pre-edit definition. */
export function placementNarration(
  kind: PlacementNarrationKind,
  source: PlacementSource,
  origin: DropSlot | undefined,
  slot: DropSlot,
  definition: SurveyDefinition,
): PlacementNarration {
  const within = origin !== undefined && sameList(origin.list, slot.list);
  const beforeCount = listOf(definition, slot.list)?.length ?? 0;
  const position = within && origin !== undefined && slot.index > origin.index
    ? slot.index - 1
    : slot.index;
  return {
    kind,
    label: source.kind === 'new' ? source.item.title : source.name,
    position,
    total: within ? beforeCount : beforeCount + 1,
    container:
      !within && slot.list.of === 'elements' && kind !== 'returned'
        ? slot.list.container
        : undefined,
  };
}

/**
 * Which slots a drag may be aimed at — checklist K2.
 *
 * **A question about the document, not about the drag**, which is why it lives here rather
 * than on the session: given a definition and what is being carried, the answer is the same
 * whoever asks. A page being moved is offered the page list; anything else is offered the
 * positions on the page being designed, including inside its containers.
 *
 * Offering a slot is not the same as allowing a drop on it — see `placementRefusal` and
 * `isRedundantPlacement`, which say whether one would be refused and whether it would
 * change anything.
 */
export function offerableSlots(
  definition: SurveyDefinition,
  source: PlacementSource,
  origin: DropSlot | undefined,
  canvas: { readonly pageName: string | undefined; readonly isContainerType: IsContainerType },
): readonly DropSlot[] {
  if (source.kind === 'move' && origin?.list.of === 'pages') {
    return dropSlotsFor({ of: 'pages' }, listOf(definition, { of: 'pages' })?.length ?? 0);
  }
  return canvas.pageName === undefined
    ? []
    : dropSlotsOn(definition, canvas.pageName, canvas.isContainerType);
}
