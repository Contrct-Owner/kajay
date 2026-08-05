import type { DesignSurface } from '@kajay/creator-core';
import type { PageElement } from '@kajay/core';
import type { ReactElement, ReactNode } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';
import { ElementActions } from './ElementActions.js';
import { DropEndIndicator } from './DropEndIndicator.js';
import {
  CONTAINER_ATTRIBUTE,
  ELEMENT_INDEX_ATTRIBUTE,
  EMPTY_CONTAINER_ATTRIBUTE,
} from './placementGeometry.js';
import type { DesignerPlacement } from './useDesignerPlacement.js';

export interface DesignedElementProps {
  readonly surface: DesignSurface;
  readonly element: PageElement;
  readonly index: number;
  /** The container holding it: a page, or a panel — checklist K2's nesting. */
  readonly container: string;
  /** What the respondent's renderer drew. Passed in, never called for. */
  readonly children: ReactNode;
  /** Absent when the host wired no placement: the canvas is then read-only furniture. */
  readonly placement?: DesignerPlacement | undefined;
  /** Whether a drop would land immediately before this element. */
  readonly isDropTarget: boolean;
  /** Whether a drop would land after this container's final child. */
  readonly isDropAtEnd: boolean;
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
  container,
  children,
  placement,
  isDropTarget,
  isDropAtEnd,
}: DesignedElementProps): ReactElement {
  const isSelected = surface.isSelected(element);
  // A container with nothing in it has no child to aim at, so it says so itself —
  // otherwise a panel a designer has just added is the one place a drop cannot land.
  const isEmptyContainer =
    surface.isContainer(element) && element.getChildren('elements').length === 0;

  return (
    <div
      className="kajay-designer__element"
      data-selected={isSelected ? 'true' : undefined}
      data-element-type={element.type}
      data-drop-before={isDropTarget ? 'true' : undefined}
      {...{
        [ELEMENT_INDEX_ATTRIBUTE]: String(index),
        [CONTAINER_ATTRIBUTE]: container,
        ...(isEmptyContainer ? { [EMPTY_CONTAINER_ATTRIBUTE]: element.name } : {}),
      }}
      onClickCapture={() => {
        // A click anywhere on the element selects it. Nothing has to stop the control
        // underneath from answering, because the survey is in design mode and every
        // question already refuses (E7) — a `preventDefault` here looked like it was
        // doing that job and was measurably doing nothing at all.
        surface.select(element);
      }}
    >
      <Adorner surface={surface} element={element} placement={placement} />
      {children}
      {isDropAtEnd ? <DropEndIndicator container={element.name} /> : null}
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
  placement,
}: Pick<DesignedElementProps, 'surface' | 'element' | 'placement'>): ReactElement {
  const { Button } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <div className="kajay-designer__adorner">
      {/*
        **The grip is a rail down the left, not a button in the row** — checklist P4. It is
        the whole element that moves, so the handle reads better as the element's own edge
        than as one more control competing with the actions; and taking it out of the row is
        half of what stopped the row overflowing.
      */}
      {placement === undefined ? null : (
        <Button
          className="kajay-designer__handle"
          aria-label={text('moveElement', element.name)}
          data-testid={`move-${element.name}`}
          {...placement.getHandleProps(element.name)}
        >
          ⠿
        </Button>
      )}
      <div className="kajay-designer__bar">
        {/*
          **The chip stays on the selected element too.** Replacing it with the type picker
          was tempting — both say the same word — but selecting is not only something you do
          to an *un*selected element: a host, a keyboard walk and this repo's own scenarios
          all address the element by it. Losing it on selection broke ten of them, which is
          the chip earning its place rather than an accident.
        */}
        <Button
          className="kajay-designer__select"
          aria-label={text('selectElement', element.name)}
          data-testid={`select-${element.name}`}
          onClick={() => {
            surface.select(element);
          }}
        >
          {/*
            **Always the name.** It used to be the type until the element was selected and
            then the name, on the reasoning that the type picker beside it already says the
            type — true, and beside the point: a chip that means one thing until you click
            it and another afterwards is a worse label than either, and a designer tracking
            an element watches it change word under them.

            The name is the right one to keep. The type is legible from the question itself
            — a radiogroup looks like radios — while the name appears nowhere else on the
            canvas, and it is what logic references and what the results are keyed by.
          */}
          {element.name}
        </Button>
        {surface.isSelected(element) ? (
          <SelectedBar surface={surface} element={element} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * The selected element's own controls: what it is, what it is called, what to do to it.
 *
 * Its own component because it is a different thing from the chip an unselected element
 * shows — and because the two together outgrew the function-length limit, which is usually
 * the file saying the same thing.
 */
function SelectedBar({
  surface,
  element,
}: Pick<DesignedElementProps, 'surface' | 'element'>): ReactElement {
  const { Select } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <>
      <Select
        className="kajay-designer__type"
        aria-label={text('typeOf', element.name)}
        data-testid={`type-${element.name}`}
        value={element.type}
        options={surface.convertibleTypes.map((type) => ({ value: type, label: type }))}
        onValueChange={(type) => {
          surface.convert(element.name, type);
        }}
      />
      {/*
        **The title input is gone** — checklist P10. K3 put one here, so a designer read the
        title on the canvas and typed it into a box above it. The title on the canvas is the
        editor now; this bar keeps what has no visible representation to click.
      */}
      <ElementActions surface={surface} element={element} />
    </>
  );
}
