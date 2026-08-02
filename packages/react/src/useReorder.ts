import type { KeyboardEvent, PointerEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { ReorderContext, ReorderOptions, ReorderState } from './ReorderContext.js';
import { handleReorderKey } from './reorderKeyboard.js';
import { beginReorderDrag, continueReorderDrag, endReorderDrag } from './reorderPointer.js';

/**
 * Everything one reorderable row needs. Spread onto the row's own element.
 *
 * The element must be focusable and a **direct child** of the element `listRef` is on —
 * that is how the interaction finds the rows and their positions without the caller
 * having to hand it a ref per row.
 */
export interface ReorderItemProps {
  readonly tabIndex: 0;
  readonly 'aria-roledescription': string;
  readonly 'data-reorder-item': '';
  /** Present while this row is held by the keyboard, for the caller to style. */
  readonly 'data-grabbed': 'true' | undefined;
  readonly 'data-dragged': 'true' | undefined;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  readonly onBlur: () => void;
}

export interface Reorder {
  /**
   * Goes on the element whose direct children are the rows.
   *
   * A callback ref rather than a ref object, so it fits whichever element the caller
   * chose: a `RefObject<HTMLElement>` cannot be handed to a `<div>`, whose ref is
   * `RefObject<HTMLDivElement>`, and the interaction has no business caring which.
   */
  readonly listRef: (element: HTMLElement | null) => void;
  readonly grabbedIndex: number | undefined;
  readonly draggedIndex: number | undefined;
  /**
   * What just happened, for the caller to put in a live region.
   *
   * Returned rather than rendered, because where the message goes is a layout decision
   * — and an interaction that rendered its own DOM would stop being an interaction.
   */
  readonly announcement: string;
  readonly getItemProps: (index: number) => ReorderItemProps;
}

const IDLE: ReorderState = { grabbed: undefined, dragged: undefined, announcement: '' };

/**
 * Reordering a list by pointer or by keyboard, knowing nothing about what is in it.
 *
 * Built as a primitive rather than as part of the ranking question on purpose: the
 * Creator has to reorder questions, panels and pages with the same gesture two phases
 * later ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) constraint 3), and
 * a second drag system introduced then would be a second set of accessibility bugs to
 * find. Everything specific to *what* is being reordered arrives through `onMove` and
 * `describe`.
 *
 * It owns no list. The caller renders the rows in whatever order its own model says,
 * applies moves to that model, and re-renders — so what is on screen mid-drag is always
 * the answer as recorded, never a preview of one.
 *
 * **Key the rows by identity, not by index.** React then moves the row's own element
 * when the order changes, and focus travels with it — which is what lets a respondent
 * press the arrow key again and move the same row rather than whatever has taken its
 * place. Re-keying by index would leave focus behind at a position, and an explicit
 * refocus here could not tell the two apart: a mutation test proved a refocus changed
 * nothing at all, because React had already done it.
 */
export function useReorder(options: ReorderOptions): Reorder {
  const list = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<ReorderState>(IDLE);
  // Stable, or React would detach and reattach it on every render — which happens on
  // every keystroke of a drag.
  const listRef = useCallback((element: HTMLElement | null): void => {
    list.current = element;
  }, []);

  const rows = (): readonly HTMLElement[] =>
    list.current === null
      ? []
      : [...list.current.querySelectorAll<HTMLElement>(':scope > [data-reorder-item]')];

  const context: ReorderContext = {
    options,
    state,
    update: (next) => {
      setState((previous) => ({ ...previous, ...next }));
    },
    rows,
  };

  return {
    listRef,
    grabbedIndex: state.grabbed?.index,
    draggedIndex: state.dragged?.index,
    announcement: state.announcement,
    getItemProps: (index) => itemProps(context, index),
  };
}

function itemProps(context: ReorderContext, index: number): ReorderItemProps {
  const { grabbed, dragged } = context.state;
  return {
    tabIndex: 0,
    // Replaces "button" when the row is announced: what it does is move, and calling
    // it a button invites a respondent to press it and wait for something to happen.
    'aria-roledescription': 'Sortable item',
    'data-reorder-item': '',
    'data-grabbed': grabbed?.index === index ? 'true' : undefined,
    'data-dragged': dragged?.index === index ? 'true' : undefined,
    onKeyDown: (event) => {
      handleReorderKey(context, index, event);
    },
    onPointerDown: (event) => {
      beginReorderDrag(context, index, event);
    },
    onPointerMove: (event) => {
      continueReorderDrag(context, event);
    },
    onPointerUp: (event) => {
      endReorderDrag(context, event);
    },
    onPointerCancel: (event) => {
      endReorderDrag(context, event);
    },
    onBlur: () => {
      if (context.state.grabbed !== undefined) {
        // Focus left the list with a row still held. The moves already made stand —
        // they are in the model — but nothing is holding it any more.
        context.update({ grabbed: undefined });
      }
    },
  };
}
