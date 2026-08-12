import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode, RefObject } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';

/**
 * One of the compact designer's two panels, over the canvas — checklist N1.
 *
 * **A real `<dialog>`, opened modally.** Everything that makes an overlay usable is already
 * in the element: the focus trap, the restore on close, Escape, the inert background, the
 * backdrop, and the accessibility semantics. A `<div>` with a high `z-index` is the same
 * markup with all of that missing and no dependency saved — this package has no UI library
 * and is not about to grow one for a box.
 *
 * The `open` prop drives it rather than the attribute: `showModal()` is what makes a dialog
 * modal, and an `<dialog open>` rendered by React is a *non*-modal dialog that merely looks
 * right. So the state is React's, the element is told about it in an effect, and the
 * element's own `close` event — which Escape fires without asking anybody — reports back.
 */
export function DesignerPanelDialog({
  isOpen,
  onClose,
  title,
  testId,
  children,
}: {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly testId: string;
  readonly children: ReactNode;
}): ReactElement {
  const { Button } = useCreatorComponents();
  const text = useCreatorText();
  const dialog = useModalDialog(isOpen);

  return (
    <dialog
      ref={dialog}
      className="kajay-creator__panel"
      data-testid={testId}
      aria-label={title}
      // Escape closes a modal dialog whatever React thinks, so the state has to hear about
      // it from the element rather than from the button below.
      onClose={onClose}
    >
      <div className="kajay-creator__panel-bar">
        <h2 className="kajay-creator__panel-title">{title}</h2>
        <Button
          className="kajay-creator__panel-close"
          data-testid={`${testId}-close`}
          onClick={onClose}
        >
          {text('closePanel')}
        </Button>
      </div>
      <div className="kajay-creator__panel-body">{children}</div>
    </dialog>
  );
}

/**
 * A dialog element kept in step with React's idea of whether it is open.
 *
 * `showModal()` is the only thing that makes a dialog modal — an `<dialog open>` rendered
 * from JSX is a *non*-modal dialog that merely looks right, with no focus trap, no backdrop
 * and no Escape. So the element is driven imperatively from the state rather than the other
 * way round.
 */
function useModalDialog(isOpen: boolean): RefObject<HTMLDialogElement | null> {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    // Guarded both ways: `showModal()` on an open dialog throws, and `close()` on a shut
    // one fires a second `close` event that would report a close nobody asked for.
    if (isOpen && !element.open) {
      element.showModal();
    } else if (!isOpen && element.open) {
      element.close();
    }
  }, [isOpen]);

  return dialog;
}
