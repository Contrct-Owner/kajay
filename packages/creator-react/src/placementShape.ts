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
   * The box the placed element will occupy, where that is knowable.
   *
   * `undefined` for a toolbox item, which has no rendered size to measure — nothing has
   * drawn one yet, and guessing at the size of a question type would be a worse lie
   * than the honest minimum the stylesheet gives it.
   *
   * The width is what the ghost needs and the placeholder does not: a placeholder is a
   * cell and takes the column's width from the grid, while a copy carried over the page
   * has left the grid and would otherwise be as wide as its own text.
   */
  readonly height: number | undefined;
  readonly width: number | undefined;
}

/** Marks the layout slot a page element occupies, from `@kajay/react`'s own wrapper. */
const SLOT_ATTRIBUTE = 'data-element-slot';

/**
 * What the gesture picked up, as a box on screen.
 *
 * The **layout slot**, not the adorned element inside it: the slot is what the container
 * lays out and therefore what the placeholder is standing in for. The page navigator has
 * no such wrapper — its items are its own list rows — so the element index attribute is
 * the fallback, and it is the one both surfaces agree on.
 *
 * Separate from {@link shapeOfSource} because the ghost needs the same node for a different
 * reason: where the pointer was *within* it decides where the copy hangs.
 */
export function sourceNodeOf(from: HTMLElement): HTMLElement | null {
  return (
    from.closest<HTMLElement>(`[${SLOT_ATTRIBUTE}]`) ??
    from.closest<HTMLElement>(`[${ELEMENT_INDEX_ATTRIBUTE}]`)
  );
}

/** Measures what is being placed, from whatever the gesture started on. */
export function shapeOfSource(source: PlacementSource, from: HTMLElement): PlacementShape {
  if (source.kind === 'new') {
    return { label: source.item.title, height: undefined, width: undefined };
  }
  const measured = sourceNodeOf(from);
  const rect = measured?.getBoundingClientRect();
  return { label: source.name, height: rect?.height, width: rect?.width };
}
