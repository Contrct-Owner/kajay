import type { PlacementSource } from '@kajay/creator-core';
import { ELEMENT_INDEX_ATTRIBUTE } from './placementGeometry.js';

/**
 * How big the thing being placed is, and what to call it — checklist K2.
 *
 * The second half of placement that reads the DOM, and here rather than in `creator-core`
 * for `placementGeometry`'s reason: a height in pixels is not a model concept
 * ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) constraint 1).
 *
 * It exists because a placeholder that reserves the wrong amount of space is worse than
 * no placeholder at all: the layout it shows is not the layout the drop produces, so the
 * elements around it settle into positions that move again on commit.
 */
export interface PlacementShape {
  /** What the placeholder says it is holding a place for. */
  readonly label: string;
  /**
   * The height the placed element will occupy, where that is knowable.
   *
   * `undefined` for a toolbox item, which has no rendered size to measure — nothing has
   * drawn one yet, and guessing at the height of a question type would be a worse lie
   * than the honest minimum the stylesheet gives it.
   */
  readonly height: number | undefined;
}

/** Marks the layout slot a page element occupies, from `@kajay/react`'s own wrapper. */
const SLOT_ATTRIBUTE = 'data-element-slot';

/**
 * Measures what is being placed, from whatever the gesture started on.
 *
 * The **layout slot**, not the adorned element inside it: the slot is what the container
 * lays out and therefore what the placeholder is standing in for. The page navigator has
 * no such wrapper — its items are its own list rows — so the element index attribute is
 * the fallback, and it is the one both surfaces agree on.
 */
export function shapeOfSource(source: PlacementSource, from: HTMLElement): PlacementShape {
  if (source.kind === 'new') {
    return { label: source.item.title, height: undefined };
  }
  const measured =
    from.closest<HTMLElement>(`[${SLOT_ATTRIBUTE}]`) ??
    from.closest<HTMLElement>(`[${ELEMENT_INDEX_ATTRIBUTE}]`);
  return {
    label: source.name,
    height: measured === null ? undefined : measured.getBoundingClientRect().height,
  };
}
