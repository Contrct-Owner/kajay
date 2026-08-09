import type { DesignSurface, DropSlot } from '@kajay/creator-core';
import {
  defaultPageElementRenderers,
  PageElementDecoratorProvider,
  PageElementSlot,
  PageElementSlotDecoratorProvider,
  TextRendererProvider,
  QuestionRenderersProvider,
} from '@kajay/react';
import type { PageElementDecorator, PageElementRendererResolver } from '@kajay/react';
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
import { useCreatorText } from './CreatorStringsContext.js';
import { DesignedElement } from './DesignedElement.js';
import { PlacementPlaceholder } from './PlacementPlaceholder.js';
import { historyShortcut, isTextEntry } from './historyShortcut.js';
import { PageAdorner } from './PageAdorner.js';
import { useSurfaceVersion } from './useSurfaceVersion.js';
import type { DesignerPlacement } from './useDesignerPlacement.js';
import { useDesignerSlotDecorator } from './useDesignerSlotDecorator.js';
import { useInlineTextRenderer } from './useInlineTextRenderer.js';

export interface DesignSurfacePanelProps {
  readonly surface: DesignSurface;
  /** Defaults to the built-in renderers; pass a clone to draw a custom type. */
  readonly renderers?: PageElementRendererResolver;
  /**
   * Drag and drop, from {@link useDesignerPlacement} — checklist K2.
   *
   * Optional, and passed in rather than created here, because the same object has to
   * reach the toolbox: a drag that begins on a toolbox item and ends on the canvas is
   * one gesture crossing two pieces (ADR-0021), and each holding its own copy would
   * make it two.
   */
  readonly placement?: DesignerPlacement | undefined;
  readonly className?: string;
}

/**
 * The page being designed — checklist K3, and where a drop lands for K2.
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
 *
 * Two keyboard shortcuts are bound here rather than on the document — see
 * {@link handleCanvasKey}.
 *
 * **The drop indicator is drawn from the model, not from the pointer.** Which slot is
 * active is a number the placement already tracks, so where the placeholder goes is
 * rendered from state — assertable in a test, and identical whether a pointer or the
 * arrow keys put it there.
 *
 * It is drawn by **two** things, and the split is a fact about layout rather than a
 * convenience. Every position beside an element is a cell of that container's own layout,
 * so it comes through the slot decorator ({@link useDesignerSlotDecorator}). The two
 * positions with no element to be beside — an empty page, and an empty panel — cannot be,
 * so the canvas and the container's own element draw those.
 */
export function DesignSurfacePanel({
  surface,
  renderers = defaultPageElementRenderers,
  placement,
  className,
}: DesignSurfacePanelProps): ReactElement {
  useSurfaceVersion(surface);
  // Only a drop aimed at an element list is drawn here. A page being dragged in the
  // navigator is aiming at a different list entirely, and a placeholder that ignored
  // which would open a gap on the canvas while somebody reordered pages.
  const slot = placement?.activeSlot;
  const activeSlot = slot?.list.of === 'elements' ? slot : undefined;
  const decorate = useDesignerDecorator(surface, placement, activeSlot);
  const decorateSlot = useDesignerSlotDecorator(surface, placement, activeSlot);
  const renderText = useInlineTextRenderer(surface);

  return (
    <div
      className={joinClasses('kajay-designer', className)}
      ref={placement?.surfaceRef}
      // **The canvas is the page's grid, so it has to be told how many columns the page
      // has** — set exactly as `SurveyPage` sets it, because this is the same layout.
      // The stylesheet had always read this variable here and nothing had ever written it,
      // so a `colCount: 2` page was drawn in one column and only the *elements* kept their
      // layout properties. It went unseen because the one test about canvas layout asserted
      // `startWithNewLine`, which is a property of an element rather than of the grid.
      style={{ '--kajay-col-count': String(surface.page?.colCount ?? 1) } as CSSProperties}
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
      // Undo is bound *here*, on the canvas, rather than on the document — a library
      // that grabbed Ctrl+Z globally would take it from the rest of the host's
      // application (K6). And a press inside a text field is that field's own undo:
      // somebody mid-rename means "that letter", not "the whole rename", and the
      // letters they typed are on no stack of ours.
      onKeyDown={(event) => {
        handleCanvasKey(surface, event);
      }}
    >
      {/*
        A question that contains questions looks its children up in *this* registry —
        checklist N5's second finding. `<Survey>` supplies it and the canvas did not, so a
        matrix or a repeating panel dropped on the canvas threw rather than drawing: the
        one place in the Creator where a designer meets §F and §G at all. It went unseen
        because no scenario before this row put a container question on a canvas, which is
        exactly the gap an overall AC exists to close.
      */}
      <QuestionRenderersProvider renderers={renderers}>
        {/*
          **The words on the canvas are the editor** — checklist P10. The renderer asks how
          authored text should be drawn, and the Creator answers "as something you can type
          in". Nothing here knows the shape of any renderer's markup, which is what keeps
          this working for a host's own question type.
        */}
        <TextRendererProvider renderText={renderText}>
          <PageElementDecoratorProvider decorate={decorate}>
            <PageElementSlotDecoratorProvider decorate={decorateSlot}>
              <CanvasBody surface={surface} renderers={renderers} />
            </PageElementSlotDecoratorProvider>
          </PageElementDecoratorProvider>
        </TextRendererProvider>
      </QuestionRenderersProvider>
      <EmptyPagePlaceholder surface={surface} placement={placement} activeSlot={activeSlot} />
      {placement === undefined ? null : (
        // `aria-live` on its own, not `role="status"`. The ranking question's live
        // region is the same shape, and for a reason that shows up immediately: a
        // status role is a *landmark-ish* thing a page-wide `getByRole('status')`
        // finds, and adding a second one to the demo broke seven scenarios that had
        // nothing to do with the Creator. A live region needs `aria-live`; the role
        // adds only a name for something nobody looks up by name.
        <p className="kajay-designer__announcement" aria-live="polite" aria-atomic="true">
          {placement.announcement}
        </p>
      )}
    </div>
  );
}

/**
 * The placeholder for a page that has nothing on it yet.
 *
 * Every other position on the canvas is drawn beside a slot, by the container's own
 * layout — see {@link useDesignerSlotDecorator}. A page with no elements has no slot to be
 * beside, and it is the position every new survey needs first, so the canvas draws this
 * one itself.
 */
function EmptyPagePlaceholder({
  surface,
  placement,
  activeSlot,
}: {
  readonly surface: DesignSurface;
  readonly placement: DesignerPlacement | undefined;
  readonly activeSlot: DropSlot | undefined;
}): ReactElement | null {
  const page = surface.page;
  if (
    page === undefined ||
    page.elements.length > 0 ||
    activeSlot?.list.of !== 'elements' ||
    activeSlot.list.container !== page.name
  ) {
    return null;
  }
  return (
    <PlacementPlaceholder
      className="kajay-designer__placeholder"
      shape={placement?.shape}
      container={page.name}
      index={0}
    />
  );
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}

/**
 * The page's header and the elements on it.
 *
 * Its own component only so the panel above stays about the *canvas* — the click that
 * clears a selection, the ref a pointer is measured against, the live region — rather
 * than about what happens to be drawn inside it.
 */
function CanvasBody({
  surface,
  renderers,
}: {
  readonly surface: DesignSurface;
  readonly renderers: PageElementRendererResolver;
}): ReactElement {
  const text = useCreatorText();
  const page = surface.page;
  if (page === undefined) {
    return (
      <p className="kajay-designer__empty" role="status">
        {text('emptySurvey')}
      </p>
    );
  }

  return (
    <>
      <PageAdorner surface={surface} page={page} />
      {page.elements.map((element) => (
        <PageElementSlot key={element.name} element={element}>
          {renderers.render(surface.survey, element)}
        </PageElementSlot>
      ))}
    </>
  );
}

/**
 * Wraps every page element in its adorner, at any depth — checklist K2's nesting.
 *
 * One function for the whole tree, because `PageElementSlot` is the one place every page
 * element passes through in every container. A question inside a panel is adorned by
 * exactly the same code as one on the page, and the panel renderer needed no change at
 * all — which is the whole reason the decorator seam was worth adding rather than
 * re-implementing panels for design mode.
 */
function useDesignerDecorator(
  surface: DesignSurface,
  placement: DesignerPlacement | undefined,
  activeSlot: DropSlot | undefined,
): PageElementDecorator {
  return (element, children) => {
    const at = surface.locate(element.name);
    if (at === undefined || at.list.of !== 'elements') {
      return children;
    }
    return (
      <DesignedElement
        surface={surface}
        element={element}
        index={at.index}
        container={at.list.container}
        placement={placement}
        // Only the *empty* container: everywhere else the placeholder is a cell of the
        // container's own layout, drawn beside a slot rather than inside one. A container
        // with no children has no slot to be beside, and is the one case that has to be
        // drawn from within the container's own element.
        isEmptyDropTarget={
          surface.isContainer(element) &&
          element.getChildren('elements').length === 0 &&
          activeSlot?.list.of === 'elements' &&
          activeSlot.list.container === element.name
        }
      >
        {children}
      </DesignedElement>
    );
  };
}

/**
 * The two shortcuts the canvas owns: undo/redo, and `Delete` for the selection.
 *
 * Bound here rather than on the document, for the reason in {@link historyShortcut}: a
 * library that grabbed these globally would take them from the rest of a host's
 * application. Both stand aside when focus is in a text field, where every one of these
 * keys already means something — somebody mid-rename means "that character", not "the
 * question I am in the middle of naming".
 *
 * **`Backspace` deliberately does nothing.** It is the "go back" reflex and the easiest
 * key on the board to hit by accident. Undo makes either recoverable; only one of them
 * makes a designer wonder what just happened.
 */
function handleCanvasKey(surface: DesignSurface, event: KeyboardEvent<HTMLElement>): void {
  if (isTextEntry(event.target)) {
    return;
  }
  const intent = historyShortcut(event);
  if (intent !== undefined) {
    event.preventDefault();
    if (intent === 'undo') {
      surface.undo();
    } else {
      surface.redo();
    }
    return;
  }
  const selected = surface.selected?.getPropertyValue('name');
  if (event.key === 'Delete' && typeof selected === 'string') {
    event.preventDefault();
    surface.removeElement(selected);
  }
}
