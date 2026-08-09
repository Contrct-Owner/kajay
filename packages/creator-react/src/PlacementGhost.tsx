import type { ReactElement } from 'react';
import type { DesignerPlacement } from './useDesignerPlacement.js';

export interface PlacementGhostProps {
  readonly placement: DesignerPlacement;
}

/**
 * What the pointer is carrying, drawn beside it — checklist K2.
 *
 * The placeholder says where a drop would land; this says what is being dropped. Before
 * it, a drag was an invisible thing being held: the canvas showed a space opening up and
 * nothing at all attached to the cursor, so the gesture read as pushing the page around
 * rather than carrying something across it.
 *
 * **A chip, not a copy of the question.** Lifting the real element under the pointer was
 * the tempting version and is worse three times over: a full-size question follows the
 * cursor across the very canvas it is being aimed at and covers it; the element cannot
 * both be under the pointer and back in its place, which is how a drop that would change
 * nothing says so; and cloning its markup would put a second copy of every `id` in the
 * document, which is the defect P7 removed everywhere else. What is being carried is
 * already drawn twice on screen — at full size in the placeholder, and in the live region
 * — so the ghost's job is to say *held*, and a chip says it.
 *
 * **Always mounted, hidden until it is carrying.** It has to be measurable at the moment a
 * drag begins: where a `position: fixed` node's coordinates start from depends on whether
 * any ancestor of the host's has a transform, and that is answered by measuring this
 * element rather than by assuming (`anchorGhost`). One that appeared with the drag would
 * have to be measured after a render, a frame into the gesture.
 *
 * `aria-hidden` for the placeholder's reason: every position is already spoken into the
 * live region, and a second voice reading the same name is noise rather than news.
 */
export function PlacementGhost({ placement }: PlacementGhostProps): ReactElement {
  const carrying = placement.carrying;

  return (
    <div
      className="kajay-designer__ghost"
      ref={placement.ghostRef}
      data-testid="drag-ghost"
      data-carrying={carrying === undefined ? undefined : 'true'}
      aria-hidden="true"
    >
      {/* The handle's own glyph, so what is in hand is legibly the thing that was grabbed. */}
      <span className="kajay-designer__ghost-grip">⠿</span>
      <span>{carrying?.label ?? ''}</span>
    </div>
  );
}
