import type { SurveyDefinition } from '@kajay/core';
import { listOf, sameList } from './definitionTree.js';
import type { DropSlot, PlacementSource } from './placement.js';
import type {
  PlacementDirection,
  PlacementNarration,
  PlacementNarrationKind,
} from './PlacementSession.js';

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
