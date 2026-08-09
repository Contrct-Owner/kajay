import { useLayoutEffect, useRef } from 'react';
import { positionsIn, settleInto } from './settleMotion.js';
import type { SettleMap } from './settleMotion.js';

type ElementRef = { current: HTMLElement | null };

/** A list a placement can rearrange, and what identifies the things in it. */
export interface SettleSurface {
  readonly node: ElementRef;
  readonly selector: string;
  readonly attribute: string;
}

/**
 * Lets the surfaces a drag rearranges move into their new positions — checklist K2.
 *
 * **The baseline is taken when the drag begins, not on the render before it.** The hook
 * only re-renders when the *placement* changes, so anything that moved the page in between
 * — a selection opening an action row, an inline edit growing a title — would still be in a
 * remembered position, and the first aim would animate every element from wherever it used
 * to be. Measuring at the grab is both correct and cheaper: one measurement per drag rather
 * than one per render.
 *
 * **It stays armed through the drop.** The last rearrangement a drag makes is the one that
 * commits, and by then the placement is idle again — so a guard that watched for "a drag is
 * in progress" would animate every step except the one the whole gesture was for. It
 * disarms on the first idle render instead, which is that one.
 *
 * Abandoning is the same event. Escape puts the page back the way it was, and putting it
 * back visibly is the difference between a cancelled drag and a page that has silently
 * changed shape.
 */
export function useSettledPlacement(
  surfaces: readonly SettleSurface[],
  ghost: ElementRef,
  isIdle: boolean,
): () => void {
  const previous = useRef<readonly SettleMap[]>([]);
  const armed = useRef(false);

  const measure = (): readonly SettleMap[] =>
    surfaces.map((surface) =>
      surface.node.current === null
        ? new Map()
        : positionsIn(surface.node.current, surface.selector, surface.attribute, ghost.current),
    );

  useLayoutEffect(() => {
    if (!armed.current) {
      return;
    }
    for (const [at, surface] of surfaces.entries()) {
      const node = surface.node.current;
      const was = previous.current[at];
      if (node !== null && was !== undefined) {
        settleInto(node, surface.selector, surface.attribute, was);
      }
    }
    previous.current = measure();
    if (isIdle) {
      armed.current = false;
    }
  });

  return () => {
    previous.current = measure();
    armed.current = true;
  };
}
