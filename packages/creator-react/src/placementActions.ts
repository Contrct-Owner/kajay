import type { DesignSurface, PlacementSource } from '@kajay/creator-core';
import { reorderAnnouncement } from '@kajay/react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * A placement in progress — checklist K2.
 *
 * `origin` is where the thing being placed sits now: an existing element's index, or
 * `undefined` for one that does not exist yet. It is carried because two things need
 * it — skipping the slots a move would land back in, and working out which *position*
 * to speak, which is not the same number as the slot.
 */
export interface PlacementState {
  readonly source: PlacementSource | undefined;
  readonly origin: number | undefined;
  readonly slot: number;
  readonly announcement: string;
}

export const IDLE: PlacementState = {
  source: undefined,
  origin: undefined,
  slot: 0,
  announcement: '',
};

/** The four things that can happen to a placement, whichever gesture drives them. */
export interface PlacementActions {
  readonly begin: (source: PlacementSource, origin: number | undefined, slot: number) => void;
  readonly aim: (slot: number) => void;
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
  const count = surface.page?.elements.length ?? 0;
  const container = surface.page?.name;

  return {
    begin: (source, origin, slot) => {
      setState({ source, origin, slot, announcement: narrate('grabbed', source, origin, slot, count) });
    },
    aim: (slot) => {
      setState((previous) =>
        previous.source === undefined || previous.slot === slot
          ? previous
          : {
              ...previous,
              slot,
              announcement: narrate('moved', previous.source, previous.origin, slot, count),
            },
      );
    },
    commit: () => {
      const { source, origin, slot } = state;
      if (source === undefined || container === undefined) {
        return;
      }
      // A drop that changes nothing is reported as one. Saying "dropped at position 2"
      // when the model refused would be the interaction telling a designer it had done
      // something it had not.
      const kind = surface.place(source, { container, index: slot }) ? 'dropped' : 'returned';
      setState({ ...IDLE, announcement: narrate(kind, source, origin, slot, count) });
    },
    abandon: () => {
      setState((previous) => {
        if (previous.source === undefined) {
          return previous;
        }
        const at = previous.origin ?? previous.slot;
        const announcement = narrate('returned', previous.source, previous.origin, at, count);
        return { ...IDLE, announcement };
      });
    },
  };
}

/**
 * What the live region says, in the ranking question's own words.
 *
 * The *position* is spoken, not the slot. They are not the same number: an element
 * moved downwards lands one slot past the position it ends up in, because removing it
 * closes the gap behind it. "Position 3 of 4" is something a designer can check against
 * what they see; a slot index is bookkeeping that happens to agree half the time.
 */
function narrate(
  kind: 'grabbed' | 'moved' | 'dropped' | 'returned',
  source: PlacementSource,
  origin: number | undefined,
  slot: number,
  count: number,
): string {
  const label = source.kind === 'new' ? source.item.title : source.element;
  if (origin === undefined) {
    // A new element makes the list one longer, so it counts against a total including
    // itself — "position 3 of 3" for a drop at the end of two.
    return reorderAnnouncement(kind, label, slot, count + 1);
  }
  return reorderAnnouncement(kind, label, slot > origin ? slot - 1 : slot, count);
}
