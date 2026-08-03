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

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The slot nearest a point, in the range 0..count.
 *
 * **Nearest centre, then which side of it**, rather than the usual "is the pointer past
 * this element's top half". The simple version assumes a single column, and a page with
 * `colCount: 2` puts elements side by side — where a vertical midpoint says nothing at
 * all about whether a drop belongs left or right of the one under the pointer.
 *
 * Which side is decided along whichever axis the pointer is further out on, so the same
 * code reads "above/below" in a stacked layout and "left/right" in a row without being
 * told which it is looking at.
 */
export function slotAtPoint(surface: HTMLElement, point: Point): number {
  const rects = elementRects(surface);
  if (rects.length === 0) {
    return 0;
  }
  let nearest = 0;
  let best = Number.POSITIVE_INFINITY;
  for (const [index, rect] of rects.entries()) {
    const distance = (rect.x - point.x) ** 2 + (rect.y - point.y) ** 2;
    if (distance < best) {
      best = distance;
      nearest = index;
    }
  }
  const rect = rects[nearest]!;
  const dx = point.x - rect.x;
  const dy = point.y - rect.y;
  const isAfter = Math.abs(dx) > Math.abs(dy) ? dx > 0 : dy > 0;
  return isAfter ? nearest + 1 : nearest;
}

/** The centre of every element on the canvas, in the order they are drawn. */
function elementRects(surface: HTMLElement): readonly Point[] {
  const found = surface.querySelectorAll<HTMLElement>(`[${ELEMENT_INDEX_ATTRIBUTE}]`);
  return [...found].map((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
}
