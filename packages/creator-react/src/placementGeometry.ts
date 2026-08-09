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

/**
 * Marks a slot that has stood aside for the drag in progress.
 *
 * Its element is still in the document — it is holding the pointer capture the drag is
 * being delivered through — but it has given up its box, so it is nowhere the designer can
 * see. Measuring it would let the pointer aim at something invisible, and at whatever
 * corner of the page a collapsed box happens to occupy rather than where the element
 * used to be.
 */
export const WITHDRAWN_ATTRIBUTE = 'data-withdrawn';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Candidate {
  readonly container: string;
  readonly index: number;
  readonly centre: Point;
  readonly box: Box;
}

interface Box {
  readonly top: number;
  readonly bottom: number;
}

/**
 * The slot nearest a point, or `undefined` when the canvas holds nothing.
 *
 * **Nearest centre, then which side of it.** In a column the two together put every slot
 * boundary exactly on an element's midpoint, which is the rule a designer expects: the
 * bottom half of the element above and the top half of the one below aim at the position
 * between them. That falls out rather than being coded — for a point between two centres,
 * "nearest, then which side" and "which half am I in" give the same answer.
 *
 * **Which axis decides is a question about the layout, not about the pointer.** It used to
 * be whichever axis the pointer was further out on, which reads as above/below in a stacked
 * list only while the pointer stays near the vertical middle of the page. Elements are as
 * wide as the canvas, so `|dx|` beat `|dy|` almost everywhere and the answer quietly became
 * *left or right of centre* — in a single column, where left and right mean nothing. Aiming
 * at the end of a list then meant dropping far enough below the last element to out-distance
 * however far from its centre you happened to be sideways.
 *
 * So the axis comes from where the element's **own neighbour** sits: side by side means the
 * list runs across at that point and the horizontal midpoint decides; otherwise it runs down
 * and the vertical one does. One rule reads a column, a `colCount: 2` grid — where a row's
 * two cells are horizontal neighbours and the row below is a vertical one — and the page
 * navigator's horizontal strip, without being told which it is looking at.
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
  const candidates = elementCandidates(surface, fixed !== undefined);
  const nearest = nearestTo(candidates, point);
  if (nearest === undefined) {
    return undefined;
  }
  const isAfter = runsSideways(nearest, candidates)
    ? point.x > nearest.centre.x
    : point.y > nearest.centre.y;
  return {
    list: fixed ?? { of: 'elements', container: nearest.container },
    index: isAfter ? nearest.index + 1 : nearest.index,
  };
}

/**
 * Whether this element's list runs across the page rather than down it.
 *
 * **A question about the container, not about the element.** Asking each element for its own
 * neighbour was the first attempt and it breaks on the case a grid always has: the last row
 * is usually a partial one, so its element has nothing beside it and would be read as a
 * column — even though "after it" is plainly the empty cell to its right. A container either
 * puts things side by side or it does not, and that is answered once by looking for any two
 * of its elements sharing a row.
 *
 * Two boxes share a row when their vertical bands overlap, so moving between them is a
 * horizontal move. A single column never produces such a pair, whatever the container's
 * declared `colCount`, which is the right answer: a page whose elements all take a new line
 * *is* a column, and reads like one.
 */
function runsSideways(candidate: Candidate, candidates: readonly Candidate[]): boolean {
  const siblings = candidates.filter((one) => one.container === candidate.container);
  return siblings.some((one, at) =>
    siblings.slice(at + 1).some((other) => sharesRow(one.box, other.box)),
  );
}

function sharesRow(one: Box, other: Box): boolean {
  return one.top < other.bottom && other.top < one.bottom;
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
    if (
      (container.length === 0 && !anyContainer) ||
      !Number.isInteger(index) ||
      element.closest(`[${WITHDRAWN_ATTRIBUTE}]`) !== null
    ) {
      continue;
    }
    const rect = element.getBoundingClientRect();
    candidates.push({
      container,
      index,
      centre: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      box: { top: rect.top, bottom: rect.bottom },
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
