import type { DropList, DropSlot } from '@kajay/creator-core';

/**
 * Which slot a pointer is asking for — checklist K2.
 *
 * The only part of placement that reads the DOM. It is here rather than in
 * `creator-core` because a rectangle is not a model concept
 * ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) constraint 1), and it is
 * separate from the hook so it can be reasoned about as a function of positions.
 */

/** Marks an element on the canvas, and says which position it holds. */
export const ELEMENT_INDEX_ATTRIBUTE = 'data-element-index';

/** Says which container an element sits in — a page, or a panel. */
export const CONTAINER_ATTRIBUTE = 'data-in-container';

/**
 * Marks a container with nothing in it.
 *
 * An empty panel has no children to aim at, so without this it would be the one place on
 * the canvas a drop could not land — and a panel a designer has just added is empty by
 * definition.
 */
export const EMPTY_CONTAINER_ATTRIBUTE = 'data-empty-container';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Candidate {
  readonly container: string;
  readonly index: number;
  readonly centre: Point;
}

/**
 * The slot nearest a point, or `undefined` when the canvas holds nothing.
 *
 * **Nearest centre, then which side of it**, rather than the usual "is the pointer past
 * this element's top half". The simple version assumes a single column, and a page with
 * `colCount: 2` puts elements side by side — where a vertical midpoint says nothing at
 * all about whether a drop belongs left or right of the one under the pointer.
 *
 * Which side is decided along whichever axis the pointer is further out on, so the same
 * code reads "above/below" in a stacked layout and "left/right" in a row without being
 * told which it is looking at.
 *
 * **The container comes from the element, not from the canvas.** Once a panel became a
 * place a drop can land, "which list" stopped being a property of the surface being
 * measured and became a property of whatever is nearest the pointer.
 *
 * `fixed` is the exception, and the page list is why: a page's container is the *survey*,
 * which has no name to put in an attribute. A caller that already knows the list passes
 * it and only the index is measured.
 */
export function slotAtPoint(
  surface: HTMLElement,
  point: Point,
  fixed?: DropList,
): DropSlot | undefined {
  if (fixed === undefined) {
    const empty = emptyContainerAt(surface, point);
    if (empty !== undefined) {
      return { list: { of: 'elements', container: empty }, index: 0 };
    }
  }
  const nearest = nearestTo(elementCandidates(surface, fixed !== undefined), point);
  if (nearest === undefined) {
    return undefined;
  }
  const dx = point.x - nearest.centre.x;
  const dy = point.y - nearest.centre.y;
  const isAfter = Math.abs(dx) > Math.abs(dy) ? dx > 0 : dy > 0;
  return {
    list: fixed ?? { of: 'elements', container: nearest.container },
    index: isAfter ? nearest.index + 1 : nearest.index,
  };
}

/**
 * An empty container the pointer is inside, if any.
 *
 * Checked before the nearest element, because the nearest element to a pointer sitting
 * in an empty panel is whatever is *outside* it — so aiming into one would be impossible
 * if the two were the other way round. The innermost wins, for the same reason.
 */
function emptyContainerAt(surface: HTMLElement, point: Point): string | undefined {
  const found = surface.querySelectorAll<HTMLElement>(`[${EMPTY_CONTAINER_ATTRIBUTE}]`);
  let innermost: { name: string; area: number } | undefined;
  for (const element of found) {
    const rect = element.getBoundingClientRect();
    const name = element.getAttribute(EMPTY_CONTAINER_ATTRIBUTE);
    const inside =
      name !== null &&
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom;
    const area = rect.width * rect.height;
    if (inside && (innermost === undefined || area < innermost.area)) {
      innermost = { name, area };
    }
  }
  return innermost?.name;
}

function elementCandidates(surface: HTMLElement, anyContainer: boolean): readonly Candidate[] {
  const found = surface.querySelectorAll<HTMLElement>(`[${ELEMENT_INDEX_ATTRIBUTE}]`);
  const candidates: Candidate[] = [];
  for (const element of found) {
    const container = element.getAttribute(CONTAINER_ATTRIBUTE) ?? '';
    const index = Number(element.getAttribute(ELEMENT_INDEX_ATTRIBUTE));
    if ((container.length === 0 && !anyContainer) || !Number.isInteger(index)) {
      continue;
    }
    const rect = element.getBoundingClientRect();
    candidates.push({
      container,
      index,
      centre: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    });
  }
  return candidates;
}

/**
 * The nearest candidate.
 *
 * A tie is between two coincident centres, which real layout does not produce — a panel
 * wrapper includes its own adorner and legend, so it never sits exactly on top of the
 * question inside it. Which one wins is therefore arbitrary, and first is as good as
 * last; a mutation that swaps them survives, correctly, because nothing observable
 * distinguishes the two.
 */
function nearestTo(candidates: readonly Candidate[], point: Point): Candidate | undefined {
  let nearest: Candidate | undefined;
  let best = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = (candidate.centre.x - point.x) ** 2 + (candidate.centre.y - point.y) ** 2;
    if (distance < best) {
      best = distance;
      nearest = candidate;
    }
  }
  return nearest;
}
