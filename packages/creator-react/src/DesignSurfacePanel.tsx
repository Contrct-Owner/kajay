import type { DesignSurface } from '@kajay/creator-core';
import { defaultPageElementRenderers, PageElementSlot } from '@kajay/react';
import type { PageElementRendererRegistry } from '@kajay/react';
import type { KeyboardEvent, ReactElement } from 'react';
import { DesignedElement } from './DesignedElement.js';
import { historyShortcut, isTextEntry } from './historyShortcut.js';
import { PageAdorner } from './PageAdorner.js';
import { useSurfaceVersion } from './useSurfaceVersion.js';
import type { DesignerPlacement } from './useDesignerPlacement.js';

export interface DesignSurfacePanelProps {
  readonly surface: DesignSurface;
  /** Defaults to the built-in renderers; pass a clone to draw a custom type. */
  readonly renderers?: PageElementRendererRegistry;
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
 * active is a number the placement already tracks, so the line between two elements is
 * rendered from state — assertable in a test, and identical whether a pointer or the
 * arrow keys put it there.
 */
export function DesignSurfacePanel({
  surface,
  renderers = defaultPageElementRenderers,
  placement,
  className,
}: DesignSurfacePanelProps): ReactElement {
  useSurfaceVersion(surface);
  const page = surface.page;
  // Only a drop aimed at *this* page's elements draws a line here. A page being
  // dragged in the navigator is aiming at a different list entirely, and an indicator
  // that ignored which would light up the canvas while somebody reordered pages.
  const slot = placement?.activeSlot;
  const activeSlot = slot?.list.of === 'elements' ? slot.index : undefined;

  return (
    <div
      className={joinClasses('kajay-designer', className)}
      ref={placement?.surfaceRef}
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
      <CanvasBody
        surface={surface}
        renderers={renderers}
        placement={placement}
        activeSlot={activeSlot}
      />
      {activeSlot !== undefined && activeSlot === (page?.elements.length ?? 0) ? (
        // The end of the list has no element to draw a line above, so it gets its own
        // marker. Without it the last position would be the one place a drop could not
        // be aimed at, which is also the most common place to add a question.
        <div className="kajay-designer__drop-end" data-testid="drop-at-end" />
      ) : null}
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
  placement,
  activeSlot,
}: {
  readonly surface: DesignSurface;
  readonly renderers: PageElementRendererRegistry;
  readonly placement: DesignerPlacement | undefined;
  readonly activeSlot: number | undefined;
}): ReactElement {
  const page = surface.page;
  if (page === undefined) {
    return (
      <p className="kajay-designer__empty" role="status">
        This survey has no pages yet.
      </p>
    );
  }

  return (
    <>
      <PageAdorner surface={surface} page={page} />
      {page.elements.map((element, index) => (
        <PageElementSlot key={element.name} element={element}>
          <DesignedElement
            surface={surface}
            element={element}
            index={index}
            renderers={renderers}
            placement={placement}
            isDropTarget={activeSlot === index}
          />
        </PageElementSlot>
      ))}
    </>
  );
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
