import { useEffect } from 'react';
import type { DesignSurface } from '@kajay/creator-core';

/**
 * Ends a pointer drag however the pointer sequence ends — checklist K2.
 *
 * **A drag that cannot end is the worst state this feature has**, and it is worth naming
 * precisely: the element being moved has given up its box, so a question is *invisible* on
 * the canvas, the ghost is frozen wherever the pointer was, and nothing on screen offers a
 * way out. The definition is untouched — a Creator drag previews and commits once — so
 * nothing is lost, which is exactly why it is so disorienting: the survey is fine and the
 * canvas says otherwise.
 *
 * Pointer capture is supposed to make this impossible: the handle keeps receiving events
 * wherever the pointer goes, so `pointerup` always arrives. It stops being true when the
 * handle **stops existing** mid-gesture — a hot reload in development, a host re-rendering
 * the tree, a question hidden by logic somebody just edited. Capture is released with the
 * node, the release lands on nothing, and the session waits for an event that will never
 * come.
 *
 * So the last word belongs to the window rather than to the element. It is a listener the
 * length of one drag and no longer, which is the distinction that matters against the rule
 * this package otherwise keeps — a Creator that grabbed `pointerup` permanently would be
 * taking it from the rest of a host's application (K6's reason for binding undo to the
 * canvas), while one that holds it between a press and a release is describing the gesture
 * it is already in the middle of.
 *
 * **It abandons rather than commits.** Reaching here at all means the gesture did not end
 * the way it was supposed to, so what the last aim pointed at is not evidence of intent.
 * Putting the question back is recoverable in a way that moving it somewhere nobody chose
 * is not.
 */
export function useReleasedDrag(
  surface: DesignSurface,
  dragging: boolean,
  release: () => void,
): void {
  useEffect(() => {
    if (!dragging) {
      return;
    }
    const finish = (): void => {
      release();
      surface.placement.transition({ kind: 'finish', action: 'abandon' });
    };
    // The element's own handlers run first — React listens at its root, below this — so on
    // an ordinary drop this fires second, finds the gesture already over, and does nothing.
    globalThis.addEventListener('pointerup', finish);
    globalThis.addEventListener('pointercancel', finish);
    return (): void => {
      globalThis.removeEventListener('pointerup', finish);
      globalThis.removeEventListener('pointercancel', finish);
    };
  }, [surface, dragging, release]);
}
