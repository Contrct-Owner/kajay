import type { DesignSurface } from '@kajay/creator-core';
import type { PageElement } from '@kajay/core';
import { defaultPageElementRenderers, PageElementSlot } from '@kajay/react';
import type { PageElementRendererRegistry } from '@kajay/react';
import { useCallback, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';

/** Re-renders when the surface changes: the selection, a title, the tree. */
function useSurfaceVersion(surface: DesignSurface): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => surface.onChanged.add(onStoreChange),
    [surface],
  );
  const getSnapshot = useCallback((): number => surface.version, [surface]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

interface DesignedElementProps {
  readonly surface: DesignSurface;
  readonly element: PageElement;
  readonly renderers: PageElementRendererRegistry;
}

/**
 * One element on the surface: what it is, what it is called, and what it looks like.
 *
 * The rendered question is the **real one**, drawn by the same renderer a respondent
 * gets. That is what makes this WYSIWYG rather than a drawing of it, and it is why a
 * question type the Creator has never heard of needs no code here.
 *
 * Selection has two paths on purpose. Clicking anywhere on the element selects it —
 * that is what a designer expects, and the click is captured so it does not also toggle
 * the control underneath. But a click is not reachable from a keyboard, so the header
 * carries a real `<button>` as well: it is what tab order and a screen reader find, and
 * without it the surface would be selectable only with a pointer.
 */
function DesignedElement({ surface, element, renderers }: DesignedElementProps): ReactElement {
  const { Button, Input } = useCreatorComponents();
  const isSelected = surface.isSelected(element);

  return (
    <div
      className="kajay-designer__element"
      data-selected={isSelected ? 'true' : undefined}
      data-element-type={element.type}
      onClickCapture={() => {
        // A click anywhere on the element selects it. Nothing has to stop the control
        // underneath from answering, because the survey is in design mode and every
        // question already refuses (E7) — a `preventDefault` here looked like it was
        // doing that job and was measurably doing nothing at all.
        surface.select(element);
      }}
    >
      <div className="kajay-designer__adorner">
        <Button
          className="kajay-designer__select"
          aria-label={`Select ${element.name}`}
          data-testid={`select-${element.name}`}
          onClick={() => {
            surface.select(element);
          }}
        >
          {element.type}
        </Button>
        {isSelected ? (
          <Input
            className="kajay-designer__title"
            value={element.title}
            onValueChange={(value) => {
              surface.setTitle(element, value);
            }}
            aria-label={`Title of ${element.name}`}
          />
        ) : null}
      </div>
      {renderers.render(surface.survey, element)}
    </div>
  );
}

export interface DesignSurfacePanelProps {
  readonly surface: DesignSurface;
  /** Defaults to the built-in renderers; pass a clone to draw a custom type. */
  readonly renderers?: PageElementRendererRegistry;
  readonly className?: string;
}

/**
 * The page being designed — checklist K3.
 *
 * A piece ([ADR-0021](../../../docs/adr/0021-creator-composition.md)): it takes the
 * surface and holds nothing, so a host can put it wherever their layout wants it.
 *
 * Elements are drawn one at a time through the registry rather than by handing the whole
 * survey to `<Survey>`, because each needs its own adorner around it — and each sits in
 * `PageElementSlot`, the renderer's own layout wrapper, so `colCount`, `width` and
 * `startWithNewLine` mean here exactly what they will mean to a respondent. Re-writing
 * that wrapper here would put I5's decisions in a second place to drift from the first.
 *
 * The title editor lives in the adorner rather than replacing the rendered title, and
 * the rendered question keeps its own. A designer therefore sees both while typing —
 * the field they are editing and the label a respondent will read, updating live. That
 * is a departure from editing the label in place, and the better trade: an editor drawn
 * *over* the rendered title would have to guess at its position, and one that suppressed
 * it would make the layout on screen a lie.
 */
export function DesignSurfacePanel({
  surface,
  renderers = defaultPageElementRenderers,
  className,
}: DesignSurfacePanelProps): ReactElement {
  useSurfaceVersion(surface);
  const page = surface.page;

  return (
    <div
      className={joinClasses('kajay-designer', className)}
      // Clicking the *background* clears the selection — the only way out of one
      // without picking something else. Guarded on the target being this element
      // rather than a descendant: a click on an element selects it in the capture
      // phase and then bubbles up to here, so without the guard every selection
      // immediately cleared itself and nothing could be selected at all.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          surface.clearSelection();
        }
      }}
    >
      {page === undefined ? (
        <p className="kajay-designer__empty" role="status">
          This survey has no pages yet.
        </p>
      ) : (
        page.elements.map((element) => (
          <PageElementSlot key={element.name} element={element}>
            <DesignedElement surface={surface} element={element} renderers={renderers} />
          </PageElementSlot>
        ))
      )}
    </div>
  );
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}
