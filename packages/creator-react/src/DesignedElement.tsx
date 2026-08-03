import type { DesignSurface } from '@kajay/creator-core';
import type { PageElement } from '@kajay/core';
import type { PageElementRendererRegistry } from '@kajay/react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { ELEMENT_INDEX_ATTRIBUTE } from './placementGeometry.js';
import type { DesignerPlacement } from './useDesignerPlacement.js';

export interface DesignedElementProps {
  readonly surface: DesignSurface;
  readonly element: PageElement;
  readonly index: number;
  readonly renderers: PageElementRendererRegistry;
  /** Absent when the host wired no placement: the canvas is then read-only furniture. */
  readonly placement?: DesignerPlacement | undefined;
  /** Whether a drop would land immediately before this element. */
  readonly isDropTarget: boolean;
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
 *
 * **Dragging is on a handle, not on the element.** It has to be: the arrow keys mean
 * something already inside a radio group, a rating and a ranking list, and a grab mode
 * that listened on the whole element would fight every question that has its own
 * keyboard behaviour — which, after §C, is most of them.
 */
export function DesignedElement({
  surface,
  element,
  index,
  renderers,
  placement,
  isDropTarget,
}: DesignedElementProps): ReactElement {
  const isSelected = surface.isSelected(element);

  return (
    <div
      className="kajay-designer__element"
      data-selected={isSelected ? 'true' : undefined}
      data-element-type={element.type}
      data-drop-before={isDropTarget ? 'true' : undefined}
      {...{ [ELEMENT_INDEX_ATTRIBUTE]: String(index) }}
      onClickCapture={() => {
        // A click anywhere on the element selects it. Nothing has to stop the control
        // underneath from answering, because the survey is in design mode and every
        // question already refuses (E7) — a `preventDefault` here looked like it was
        // doing that job and was measurably doing nothing at all.
        surface.select(element);
      }}
    >
      <Adorner surface={surface} element={element} index={index} placement={placement} />
      {renderers.render(surface.survey, element)}
    </div>
  );
}

/**
 * The controls wrapped around a rendered question: select it, move it, rename it.
 *
 * Its own component so the element stays readable, and because these are the only parts
 * a host's design system draws (ADR-0022) — everything below them is the respondent's
 * renderer, untouched.
 */
function Adorner({
  surface,
  element,
  index,
  placement,
}: Pick<DesignedElementProps, 'surface' | 'element' | 'index' | 'placement'>): ReactElement {
  const { Button, Input } = useCreatorComponents();

  return (
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
      {placement === undefined ? null : (
        <Button
          className="kajay-designer__handle"
          aria-label={`Move ${element.name}`}
          data-testid={`move-${element.name}`}
          {...placement.getHandleProps(element.name, index)}
        >
          ⠿
        </Button>
      )}
      {surface.isSelected(element) ? (
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
  );
}
