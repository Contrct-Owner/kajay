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

/** Far enough that the pointer is never inside the ghost, close enough to read as held. */
const CARRY_OFFSET = 12;

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

/** Puts the ghost beside the pointer, or back to its origin when nothing is held. */
export function carryGhost(ghost: HTMLElement, at?: Point | undefined): void {
  ghost.style.setProperty('--kajay-ghost-x', `${at === undefined ? 0 : at.x + CARRY_OFFSET}px`);
  ghost.style.setProperty('--kajay-ghost-y', `${at === undefined ? 0 : at.y + CARRY_OFFSET}px`);
}
