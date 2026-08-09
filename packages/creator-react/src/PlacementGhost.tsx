import type { DesignSurface, PlacementSource } from '@kajay/creator-core';
import { IdScopeProvider, QuestionRenderersProvider } from '@kajay/react';
import type { PageElementRendererResolver } from '@kajay/react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { DesignerPlacement } from './useDesignerPlacement.js';

export interface PlacementGhostProps {
  readonly surface: DesignSurface;
  readonly renderers: PageElementRendererResolver;
  readonly placement: DesignerPlacement;
}

/**
 * What the pointer is carrying, drawn as the thing itself — checklist K2.
 *
 * The placeholder says where a drop would land; this says what is being dropped, and it
 * says it by **running the question's own renderer again**. A drag was otherwise an
 * invisible thing being held: the canvas opened a space and nothing was attached to the
 * cursor, so the gesture read as pushing the page around rather than carrying something
 * across it. A label naming the question is not that — the point of a canvas that renders
 * the real survey is that a designer works on what they can see, and a drag is the one
 * moment the thing they are working on would have become a word.
 *
 * **A copy, not the element lifted.** They look identical and only one is correct: the
 * original has to stay where it is when the drop would change nothing, which is how
 * `withdrawn` says so, and it cannot be in its place and under the pointer at once.
 *
 * **A copy is safe because it gets its own id scope.** Two renderings of one question emit
 * one set of ids, and every `<label for>` in the second would resolve to the first — the
 * defect P7 removed everywhere else, and the reason a ghost like this could not have been
 * written before `IdScopeProvider` existed. `inert` and `aria-hidden` finish the job: what
 * is inside is a picture, so nothing in it takes focus, answers a pointer, or is read out
 * beside the live region already narrating the drag.
 *
 * **Toolbox items keep a label**, and that is not a shortcut: a new element has not been
 * created yet, so there is no rendered question to copy. What the drag is carrying is the
 * *type*, and the type's name is exactly what represents it.
 *
 * **Always mounted, hidden until it is carrying.** It has to be measurable at the moment a
 * drag begins: where a `position: fixed` node's coordinates start from depends on whether
 * any ancestor of the host's has a transform, and that is answered by measuring this
 * element rather than by assuming (`anchorGhost`). One that appeared with the drag would
 * have to be measured a frame into the gesture.
 */
export function PlacementGhost({
  surface,
  renderers,
  placement,
}: PlacementGhostProps): ReactElement {
  const carrying = placement.carrying;

  return (
    <div
      className="kajay-designer__ghost"
      ref={placement.ghostRef}
      data-testid="drag-ghost"
      data-carrying={carrying === undefined ? undefined : 'true'}
      aria-hidden="true"
      inert
      // The width the element had where it was, because a copy carried over the page has
      // left the grid that was giving it one and would otherwise shrink to its own text —
      // which is the moment it stops looking like the question and starts looking like a
      // tooltip about it.
      //
      // **Always an object, never `undefined`.** React clears the whole `style` attribute
      // when the prop goes away, taking the two custom properties the adapter writes
      // straight to this node with it — and one of those is the last place the question was
      // seen, which the drop animation is measured from.
      style={
        {
          '--kajay-ghost-width': carrying?.width === undefined ? 'auto' : `${carrying.width}px`,
        } as CSSProperties
      }
    >
      {carrying === undefined || placement.source === undefined ? null : (
        <Carried surface={surface} renderers={renderers} source={placement.source} />
      )}
    </div>
  );
}

/**
 * The question being carried, or its name when there is no question yet.
 *
 * Its own component so the ghost above stays about position and safety. The renderer
 * registry is provided again here because a question that contains questions looks its
 * children up in the registry it is being drawn through (N5) — the ghost is outside the
 * canvas's provider, deliberately, since it must not inherit the canvas's adorners or its
 * inline text editors: a picture of a question is not a place to edit one.
 */
function Carried({
  surface,
  renderers,
  source,
}: {
  readonly surface: DesignSurface;
  readonly renderers: PageElementRendererResolver;
  readonly source: PlacementSource;
}): ReactNode {
  const element = source.kind === 'move' ? surface.elementNamed(source.name) : undefined;
  if (element === undefined) {
    // A toolbox item, or — defensively — a name the document no longer has, which a
    // preview invalidated mid-drag can produce.
    const label = source.kind === 'new' ? source.item.title : source.name;
    return <span className="kajay-designer__ghost-label">{label}</span>;
  }
  return (
    <IdScopeProvider>
      <QuestionRenderersProvider renderers={renderers}>
        {renderers.render(surface.survey, element)}
      </QuestionRenderersProvider>
    </IdScopeProvider>
  );
}
