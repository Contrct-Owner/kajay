import { sameList } from '@kajay/creator-core';
import type { DesignSurface, DropSlot, PlacementSource } from '@kajay/creator-core';
import { reorderAnnouncement } from '@kajay/react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * A placement in progress — checklists K2, K4 and K2's nesting.
 *
 * `origin` is **where the thing being placed is now**, as a slot: a container and an
 * index, or `undefined` for something that does not exist yet. It was an index until a
 * panel became a place a drop could land, at which point "index of what" stopped having
 * one answer.
 */
export interface PlacementState {
  readonly source: PlacementSource | undefined;
  readonly slot: DropSlot | undefined;
  readonly origin: DropSlot | undefined;
  readonly announcement: string;
}

export const IDLE: PlacementState = {
  source: undefined,
  slot: undefined,
  origin: undefined,
  announcement: '',
};

/** The four things that can happen to a placement, whichever gesture drives them. */
export interface PlacementActions {
  readonly begin: (source: PlacementSource, origin: DropSlot | undefined, slot: DropSlot) => void;
  readonly aim: (slot: DropSlot) => void;
  readonly commit: () => void;
  readonly abandon: () => void;
}

/**
 * The state machine, with no idea whether a pointer or a keyboard is driving it.
 *
 * Its own module so that pointer dragging and keyboard moving are demonstrably the same
 * operation reached two ways rather than two implementations that agree by inspection —
 * which is how a canvas ends up draggable but not keyboard-operable.
 */
export function placementActions(
  surface: DesignSurface,
  state: PlacementState,
  setState: Dispatch<SetStateAction<PlacementState>>,
): PlacementActions {
  const say = (
    kind: NarrationKind,
    source: PlacementSource,
    origin: DropSlot | undefined,
    slot: DropSlot,
  ): string => narrate(kind, source, origin, slot, surface.countIn(slot.list));

  return {
    begin: (source, origin, slot) => {
      setState({ source, origin, slot, announcement: say('grabbed', source, origin, slot) });
    },
    aim: (slot) => {
      setState((previous) =>
        previous.source === undefined || isSameSlot(previous.slot, slot)
          ? previous
          : {
              ...previous,
              slot,
              announcement: say('moved', previous.source, previous.origin, slot),
            },
      );
    },
    commit: () => {
      commit(surface, state, setState, say);
    },
    abandon: () => {
      setState((previous) => finished(previous, say));
    },
  };
}

/** Whether two slots name the same place. Both are values, and compared as values. */
export function isSameSlot(left: DropSlot | undefined, right: DropSlot | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.index === right.index && sameList(left.list, right.list);
}

/**
 * Whether a slot is one the thing being placed already occupies.
 *
 * **Only within one list.** Moving across containers has no such pair, because removing
 * the element does not shift anything in the list it is arriving in — a question dropped
 * into the panel beside it lands where it was aimed, wherever it came from.
 */
export function isNoOp(slot: DropSlot | undefined, origin: DropSlot | undefined): boolean {
  if (slot === undefined || origin === undefined || !sameList(slot.list, origin.list)) {
    return false;
  }
  return slot.index === origin.index || slot.index === origin.index + 1;
}

type Narrator = (
  kind: NarrationKind,
  source: PlacementSource,
  origin: DropSlot | undefined,
  slot: DropSlot,
) => string;

/**
 * Applies the pending placement, and says what happened.
 *
 * A drop that changes nothing is reported as one. Saying "dropped at position 2" when
 * the model refused would be the interaction telling a designer it had done something
 * it had not.
 */
function commit(
  surface: DesignSurface,
  state: PlacementState,
  setState: Dispatch<SetStateAction<PlacementState>>,
  say: Narrator,
): void {
  const { source, origin, slot } = state;
  if (source === undefined || slot === undefined) {
    return;
  }
  const kind = surface.place(source, slot) ? 'dropped' : 'returned';
  setState({ ...IDLE, announcement: say(kind, source, origin, slot) });
}

/** Abandons a pending placement, leaving the item where the model still has it. */
function finished(previous: PlacementState, say: Narrator): PlacementState {
  const { source, origin, slot } = previous;
  if (source === undefined) {
    return previous;
  }
  const at = origin ?? slot;
  return {
    ...IDLE,
    announcement: at === undefined ? '' : say('returned', source, origin, at),
  };
}

type NarrationKind = 'grabbed' | 'moved' | 'dropped' | 'returned';

/**
 * What the live region says, in the ranking question's own words.
 *
 * The *position* is spoken, not the slot. They are not the same number: an item moved
 * downwards within one list lands one slot past the position it ends up in, because
 * removing it closes the gap behind it. Across containers there is no such gap, so the
 * slot is the position.
 *
 * The **container is named** when a drop is landing somewhere other than where the thing
 * came from. "Position 1 of 2" is ambiguous the moment a page has a panel on it, and the
 * live region is the whole of the interaction for anybody who cannot see the line.
 */
function narrate(
  kind: NarrationKind,
  source: PlacementSource,
  origin: DropSlot | undefined,
  slot: DropSlot,
  count: number,
): string {
  const label = source.kind === 'new' ? source.item.title : source.name;
  const within = origin !== undefined && sameList(origin.list, slot.list);
  const position = within && origin !== undefined && slot.index > origin.index
    ? slot.index - 1
    : slot.index;
  const total = within ? count : count + 1;
  const sentence = reorderAnnouncement(kind, label, position, total);
  if (within || slot.list.of === 'pages' || kind === 'returned') {
    return sentence;
  }
  return `${sentence.trimEnd()} In ${slot.list.container}.`;
}
