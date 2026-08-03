import type { DesignSurface, DropList, DropSlot, PlacementSource } from '@kajay/creator-core';
import { reorderAnnouncement } from '@kajay/react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * A placement in progress — checklist K2 and K4.
 *
 * `origin` is where the thing being placed sits now: an existing item's index, or
 * `undefined` for one that does not exist yet. It is carried because two things need
 * it — skipping the slots a move would land back in, and working out which *position*
 * to speak, which is not the same number as the slot.
 */
export interface PlacementState {
  readonly source: PlacementSource | undefined;
  readonly slot: DropSlot | undefined;
  readonly origin: number | undefined;
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
  readonly begin: (source: PlacementSource, origin: number | undefined, index: number) => void;
  readonly aim: (index: number) => void;
  readonly commit: () => void;
  readonly abandon: () => void;
}

/**
 * The state machine, with no idea whether a pointer or a keyboard is driving it.
 *
 * Its own module so that pointer dragging and keyboard moving are demonstrably the same
 * operation reached two ways rather than two implementations that agree by inspection —
 * which is how a canvas ends up draggable but not keyboard-operable.
 *
 * Bound to **one list**, because a gesture is: a question is dragged among the page's
 * elements and a page among the survey's pages, and neither ever crosses into the other.
 * That is also why reordering pages needed no second state machine (K4).
 */
export function placementActions(
  surface: DesignSurface,
  list: DropList,
  count: number,
  state: PlacementState,
  setState: Dispatch<SetStateAction<PlacementState>>,
): PlacementActions {
  const say = (
    kind: NarrationKind,
    source: PlacementSource,
    origin: number | undefined,
    index: number,
  ): string => narrate(kind, source, origin, index, count);

  return {
    begin: (source, origin, index) => {
      setState({
        source,
        origin,
        slot: { list, index },
        announcement: say('grabbed', source, origin, index),
      });
    },
    aim: (index) => {
      setState((previous) =>
        previous.source === undefined || previous.slot?.index === index
          ? previous
          : {
              ...previous,
              slot: { list, index },
              announcement: say('moved', previous.source, previous.origin, index),
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

type Narrator = (
  kind: NarrationKind,
  source: PlacementSource,
  origin: number | undefined,
  index: number,
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
  setState({ ...IDLE, announcement: say(kind, source, origin, slot.index) });
}

/** Abandons a pending placement, leaving the item where the model still has it. */
function finished(previous: PlacementState, say: Narrator): PlacementState {
  if (previous.source === undefined) {
    return previous;
  }
  const at = previous.origin ?? previous.slot?.index ?? 0;
  return { ...IDLE, announcement: say('returned', previous.source, previous.origin, at) };
}

type NarrationKind = 'grabbed' | 'moved' | 'dropped' | 'returned';

/**
 * What the live region says, in the ranking question's own words.
 *
 * The *position* is spoken, not the slot. They are not the same number: an item moved
 * downwards lands one slot past the position it ends up in, because removing it closes
 * the gap behind it. "Position 3 of 4" is something a designer can check against what
 * they see; a slot index is bookkeeping that happens to agree half the time.
 */
function narrate(
  kind: NarrationKind,
  source: PlacementSource,
  origin: number | undefined,
  index: number,
  count: number,
): string {
  const label = source.kind === 'new' ? source.item.title : source.name;
  if (origin === undefined) {
    // A new element makes the list one longer, so it counts against a total including
    // itself — "position 3 of 3" for a drop at the end of two.
    return reorderAnnouncement(kind, label, index, count + 1);
  }
  return reorderAnnouncement(kind, label, index > origin ? index - 1 : index, count);
}
