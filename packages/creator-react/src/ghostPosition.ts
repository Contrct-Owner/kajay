/**
 * The thing under the pointer during a drag — checklist K2.
 *
 * The third piece of placement that reads the DOM, beside `placementGeometry` and
 * `placementShape`, and here for their reason: a viewport coordinate is not a model
 * concept ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) constraint 1).
 *
 * **It is written straight to the element, never through React state.** A ghost follows
 * the pointer, which means it changes on every `pointermove` — and the whole reason
 * aiming publishes only when the *slot* changes is that a canvas re-rendering per pointer
 * event would rebuild every question under the designer's hand. Two custom properties on
 * one node cost nothing and re-render nothing.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where the ghost sits when it has nothing to hold it — a copy of nothing has no grip. */
const LOOSE_OFFSET: Point = { x: 12, y: 12 };

/**
 * Where the pointer sits inside the thing it picked up.
 *
 * Kept so the copy hangs from the point it was grabbed by, rather than snapping a corner to
 * the cursor. When the ghost is the element at its own size, that difference is the whole
 * feeling of the gesture: one is lifting a question, the other is dragging a card that
 * jumped out from under your hand.
 */
export function grabOffsetIn(node: HTMLElement | null, at: Point): Point {
  if (node === null) {
    return LOOSE_OFFSET;
  }
  const rect = node.getBoundingClientRect();
  return { x: rect.left - at.x, y: rect.top - at.y };
}

/**
 * Where the ghost's own coordinates are measured from.
 *
 * A `position: fixed` element is placed against the viewport — **unless** an ancestor
 * carries a transform, a filter or `will-change`, any of which makes that ancestor the
 * containing block instead. Nothing in this package can know whether a host's layout does
 * that, so it is measured rather than assumed: reading the ghost's own box while it is
 * untranslated answers the question directly, and a host with a transformed wrapper gets a
 * ghost under the pointer instead of one displaced by wherever that wrapper sits.
 */
export function anchorGhost(ghost: HTMLElement): Point {
  carryGhost(ghost);
  const rect = ghost.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

/** Puts the ghost under the pointer, or back to its origin when nothing is held. */
export function carryGhost(ghost: HTMLElement, at?: Point | undefined): void {
  ghost.style.setProperty('--kajay-ghost-x', `${at?.x ?? 0}px`);
  ghost.style.setProperty('--kajay-ghost-y', `${at?.y ?? 0}px`);
}
