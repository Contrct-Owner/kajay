import { WITHDRAWN_ATTRIBUTE } from './placementGeometry.js';

/**
 * Moving elements from where they were to where a drop has put them — checklist K2.
 *
 * The fourth piece of placement that reads the DOM, and the only one that writes to it.
 * A placeholder that takes a cell moves everything after it, and without this the page
 * teleports on every aim: a designer sees a different arrangement each time the pointer
 * crosses a midpoint and has to work out what moved. Motion is what makes the reflow
 * legible as a *rearrangement* rather than a redraw.
 *
 * **First and last positions, then the difference** — the standard trick, hand-written
 * because it is twenty lines and a dependency here would own the Creator's markup in the
 * way [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 1 declined.
 * Elements are put back where they were and released, so the browser animates the gap it
 * has already laid out rather than anything here computing positions.
 *
 * **The stylesheet decides whether any of this happens.** Duration and easing are read
 * from custom properties, and a duration of zero — which is what an unset property means,
 * and therefore what a host who ships their own CSS gets — skips the work entirely. That
 * keeps the choice where [ADR-0022](../../../docs/adr/0022-design-system-primitives.md)
 * puts every other visual decision, and it is the difference between a library that offers
 * motion and one that imposes it.
 */

/** Where something was, in viewport coordinates. */
export interface SettlePoint {
  readonly x: number;
  readonly y: number;
}

/** Positions by whatever identifies an element across a re-parse: its name. */
export type SettleMap = ReadonlyMap<string, SettlePoint>;

/**
 * Marks our own animations, so a re-aim mid-flight cancels the one it is replacing and
 * leaves a host's transitions — and anything else on the element — untouched.
 */
const SETTLE_ID = 'kajay-settle';

const DURATION = '--kajay-settle-duration';
const EASING = '--kajay-settle-easing';

/** What each element in this container is currently keyed by, and where it sits. */
export function positionsIn(
  container: HTMLElement,
  selector: string,
  attribute: string,
  ghost: HTMLElement | null,
): SettleMap {
  const positions = new Map<string, SettlePoint>();
  for (const node of container.querySelectorAll<HTMLElement>(selector)) {
    const key = node.getAttribute(attribute);
    if (key === null) {
      continue;
    }
    // **A withdrawn element is recorded where the ghost is**, because that is where it is
    // on screen: its own box has been taken out of the layout and collapsed. Recording the
    // collapsed box would make the drop fling the question in from a corner; recording the
    // ghost makes it settle from the pointer that carried it there.
    const measured = isWithdrawn(node) && ghost !== null ? ghost : node;
    const rect = measured.getBoundingClientRect();
    positions.set(key, { x: rect.left, y: rect.top });
  }
  return positions;
}

/**
 * Animates everything that has moved since those positions were taken.
 *
 * Withdrawn elements are skipped rather than animated: they are invisible for as long as
 * the drag lasts, so the only thing an animation on one would cost is the work.
 */
export function settleInto(
  container: HTMLElement,
  selector: string,
  attribute: string,
  previous: SettleMap,
): void {
  const timing = settleTiming(container);
  if (timing === undefined) {
    return;
  }
  for (const node of container.querySelectorAll<HTMLElement>(selector)) {
    const key = node.getAttribute(attribute);
    const was = key === null ? undefined : previous.get(key);
    if (was === undefined || isWithdrawn(node)) {
      continue;
    }
    const now = node.getBoundingClientRect();
    const dx = was.x - now.left;
    const dy = was.y - now.top;
    // Sub-pixel differences are the browser rounding, not a move anybody made.
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      continue;
    }
    slide(node, dx, dy, timing);
  }
}

interface SettleTiming {
  readonly duration: number;
  readonly easing: string;
}

/**
 * How long the motion lasts, or `undefined` for "do not move anything".
 *
 * **`prefers-reduced-motion` is honoured here rather than left to the stylesheet**, and
 * the distinction matters: duration and easing are the *host's* choice, and this is not
 * one of theirs. Somebody who has asked their system for less motion has already answered,
 * and a host who forgets the media query should not be able to overrule them.
 */
function settleTiming(container: HTMLElement): SettleTiming | undefined {
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
    return undefined;
  }
  const styles = globalThis.getComputedStyle(container);
  const duration = milliseconds(styles.getPropertyValue(DURATION));
  if (duration <= 0) {
    return undefined;
  }
  const easing = styles.getPropertyValue(EASING).trim();
  return { duration, easing: easing.length > 0 ? easing : 'ease' };
}

/** A CSS time, in milliseconds. Anything unset or unreadable is "do not move anything". */
function milliseconds(value: string): number {
  const text = value.trim();
  const inSeconds = text.endsWith('s') && !text.endsWith('ms');
  const amount = Number(text.replace(/m?s$/u, ''));
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return inSeconds ? amount * 1000 : amount;
}

/**
 * Puts the element back where it was and lets it return.
 *
 * The `translate` property rather than `transform`, so a host who has transformed an
 * element keeps their transform for the length of the animation — the two compose instead
 * of one replacing the other.
 */
function slide(node: HTMLElement, dx: number, dy: number, timing: SettleTiming): void {
  for (const running of node.getAnimations()) {
    if (running.id === SETTLE_ID) {
      running.cancel();
    }
  }
  const animation = node.animate(
    [{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }],
    { duration: timing.duration, easing: timing.easing },
  );
  animation.id = SETTLE_ID;
}

function isWithdrawn(node: HTMLElement): boolean {
  return node.closest(`[${WITHDRAWN_ATTRIBUTE}]`) !== null;
}
