import type {
  DesignSurface,
  DropList,
  DropSlot,
  PlacementSource,
  ToolboxItem,
} from '@kajay/creator-core';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import { IDLE, placementActions } from './placementActions.js';
import type { PlacementActions, PlacementState } from './placementActions.js';
import { slotAtPoint } from './placementGeometry.js';
import { isNoOp, placementIntent, stepSlot } from './placementKeys.js';
import type { PlacementIntent } from './placementKeys.js';

/** Pointer handlers for anything draggable: a toolbox item, an element, a page. */
export interface PlacementDragProps {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

/**
 * Everything a toolbox item needs: the drag, and what a plain click does.
 *
 * `onClick` is here rather than left to the toolbox because the two are one decision.
 * A drag *is* a press and a release on a button, so the browser fires a click at the end
 * of every one — and a toolbox whose click appended would add a second copy of whatever
 * had just been dragged into place. Only something that knows a drag happened can tell
 * the two apart.
 */
export interface PlacementItemProps extends PlacementDragProps {
  readonly onClick: () => void;
}

/** Everything a drag handle needs: on an element on the canvas, or on a page. */
export interface PlacementHandleProps extends PlacementDragProps {
  readonly 'aria-roledescription': string;
  readonly 'data-grabbed': 'true' | undefined;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface DesignerPlacement {
  /** Goes on the canvas. What a pointer dragging an element is measured against. */
  readonly surfaceRef: (element: HTMLElement | null) => void;
  /** Goes on the page list. What a pointer dragging a page is measured against. */
  readonly pageListRef: (element: HTMLElement | null) => void;
  readonly source: PlacementSource | undefined;
  /**
   * Where a drop would land, or `undefined` when it would land nowhere.
   *
   * Nowhere covers two cases: nothing is being placed, and the pointer is over the
   * position the item already occupies. The second is why this is not simply "the slot
   * being aimed at" — an indicator drawn on a slot the model refuses would be promising
   * a move that is about to be declined.
   */
  readonly activeSlot: DropSlot | undefined;
  /** What just happened, for the caller to put in a live region. */
  readonly announcement: string;
  /** For a toolbox item: dragging it to a position, and clicking it to append. */
  readonly getItemProps: (item: ToolboxItem) => PlacementItemProps;
  /** For an element already on the canvas: a drag, and the keyboard equivalent. */
  readonly getHandleProps: (elementName: string, index: number) => PlacementHandleProps;
  /** The same for a page in the page list — checklist K4. */
  readonly getPageHandleProps: (pageName: string, index: number) => PlacementHandleProps;
}

/** A press in progress, and whether it has turned into a drag. */
interface Gesture {
  pending: boolean;
  dragged: boolean;
}

type ElementRef = { current: HTMLElement | null };

interface PlacementContext {
  /** What a pointer position is measured against, for *this* list. */
  readonly measure: ElementRef;
  readonly gesture: { current: Gesture };
  readonly actions: PlacementActions;
  readonly state: PlacementState;
}

/**
 * Dragging things onto the canvas, around it, and reordering pages — K2 and K4.
 *
 * The input adapter and nothing else
 * ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) constraint 1): what a
 * drop *means* is `creator-core`'s `place`, and this turns pointers and keys into calls
 * to it. The state machine those calls drive is `placementActions`, which has no idea
 * whether a pointer or a keyboard reached it — which is what stops the canvas becoming
 * draggable but not keyboard-operable.
 *
 * **Reordering pages is the same gesture as reordering questions**, because a slot names
 * its list (K4). Two lists, one interaction, one off-by-one — and that off-by-one had
 * already survived a mutant once, which is reason enough not to keep a second copy.
 *
 * **A drag previews and commits once**, the opposite of what C9's ranking does, and
 * deliberately. A structural edit re-parses the survey, so applying every intermediate
 * move would rebuild the whole canvas underneath the designer's pointer and destroy
 * focus on every keystroke of a keyboard drag. Escape therefore has nothing to undo: it
 * abandons a pending placement rather than reversing applied ones.
 */
export function useDesignerPlacement(surface: DesignSurface): DesignerPlacement {
  const canvas = useRef<HTMLElement | null>(null);
  const pageList = useRef<HTMLElement | null>(null);
  // Refs rather than state: a gesture changes on every click and nothing renders
  // differently for it.
  const gesture = useRef<Gesture>({ pending: false, dragged: false });
  const [state, setState] = useState<PlacementState>(IDLE);
  const surfaceRef = useCallback((element: HTMLElement | null): void => {
    canvas.current = element;
  }, []);
  const pageListRef = useCallback((element: HTMLElement | null): void => {
    pageList.current = element;
  }, []);

  const elements = surface.page?.elements.length ?? 0;
  const pages = surface.pages.length;
  const elementList: DropList = { of: 'elements', page: surface.page?.name ?? '' };
  const contextFor = (list: DropList, count: number, measure: ElementRef): PlacementContext => ({
    measure,
    gesture,
    actions: placementActions(surface, list, count, state, setState),
    state,
  });

  return {
    surfaceRef,
    pageListRef,
    source: state.source,
    activeSlot: isNoOp(state.slot?.index ?? -1, state.origin) ? undefined : state.slot,
    announcement: state.announcement,
    getItemProps: (item) =>
      itemProps(contextFor(elementList, elements, canvas), surface, item, elements),
    getHandleProps: (name, index) =>
      handleProps(contextFor(elementList, elements, canvas), name, index, elements),
    getPageHandleProps: (name, index) =>
      handleProps(contextFor({ of: 'pages' }, pages, pageList), name, index, pages),
  };
}

function itemProps(
  context: PlacementContext,
  surface: DesignSurface,
  item: ToolboxItem,
  count: number,
): PlacementItemProps {
  const page = surface.page;
  return {
    ...dragProps(context, { kind: 'new', item }),
    onClick: () => {
      // The click that ends a drag is not a second instruction. Appending here as well
      // is how one gesture puts two questions on the page.
      if (!context.gesture.current.dragged && page !== undefined) {
        surface.place(
          { kind: 'new', item },
          { list: { of: 'elements', page: page.name }, index: count },
        );
      }
    },
  };
}

function handleProps(
  context: PlacementContext,
  name: string,
  index: number,
  count: number,
): PlacementHandleProps {
  const source: PlacementSource = { kind: 'move', name };
  const { state } = context;
  return {
    ...dragProps(context, source, index),
    // Replaces "button" when the handle is announced. Calling it a button invites a
    // designer to press it and wait for something to happen.
    'aria-roledescription': 'Sortable item',
    'data-grabbed':
      state.source?.kind === 'move' && state.source.name === name ? 'true' : undefined,
    onKeyDown: (event) => {
      const intent = placementIntent(event.key);
      if (intent === undefined) {
        return;
      }
      // Claimed, every one: space must not scroll the canvas, and the arrows must not
      // walk it while somebody is using them to aim.
      event.preventDefault();
      applyIntent(context, intent, source, index, count);
    },
  };
}

/**
 * Pointer handlers for a draggable thing.
 *
 * **A drag starts on the first move, not on the press.** Pressing a handle is also how
 * a designer focuses it before using the keyboard, and beginning there would make every
 * such click announce a placement that was grabbed and immediately abandoned — a
 * sentence in the live region for something that did not happen.
 */
function dragProps(
  context: PlacementContext,
  source: PlacementSource,
  origin?: number,
): PlacementDragProps {
  const { measure, gesture, actions, state } = context;
  return {
    onPointerDown: (event) => {
      // Captured on the element the drag started from, so a pointer that leaves it —
      // which it does at once, the whole point being to go somewhere else — keeps
      // delivering moves here rather than to whatever it is passing over.
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { pending: true, dragged: false };
    },
    onPointerMove: (event) => {
      if (!gesture.current.pending || measure.current === null) {
        return;
      }
      gesture.current.dragged = true;
      const index = slotAtPoint(measure.current, { x: event.clientX, y: event.clientY });
      if (state.source === undefined) {
        actions.begin(source, origin, index);
      } else {
        actions.aim(index);
      }
    },
    onPointerUp: () => {
      gesture.current.pending = false;
      actions.commit();
    },
    onPointerCancel: () => {
      gesture.current.pending = false;
      actions.abandon();
    },
  };
}

function applyIntent(
  context: PlacementContext,
  intent: PlacementIntent,
  source: PlacementSource,
  index: number,
  count: number,
): void {
  const { actions, state } = context;
  if (intent === 'cancel') {
    actions.abandon();
    return;
  }
  if (intent === 'toggle') {
    if (state.source === undefined) {
      actions.begin(source, index, index);
    } else {
      actions.commit();
    }
    return;
  }
  if (state.slot !== undefined) {
    actions.aim(stepSlot(state.slot.index, intent, state.origin, count));
  }
}
