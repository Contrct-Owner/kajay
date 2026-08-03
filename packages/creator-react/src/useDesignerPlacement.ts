import type {
  DesignSurface,
  DropList,
  DropSlot,
  PlacementSource,
  ToolboxItem,
} from '@kajay/creator-core';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import { IDLE, isNoOp, isSameSlot, placementActions } from './placementActions.js';
import type { PlacementActions, PlacementState } from './placementActions.js';
import { slotAtPoint } from './placementGeometry.js';
import { placementIntent, stepSlot } from './placementKeys.js';
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
  /**
   * For an element already on the canvas — checklist K2.
   *
   * No index: where an element sits is something the model knows and a view would only
   * be repeating. It stopped being a single number when a panel became a container, and
   * a view passing one would have had to know which list it was counting in.
   */
  readonly getHandleProps: (elementName: string) => PlacementHandleProps;
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
  readonly surface: DesignSurface;
  /** What a pointer position is measured against, for *this* list. */
  readonly measure: ElementRef;
  readonly gesture: { current: Gesture };
  readonly actions: PlacementActions;
  readonly state: PlacementState;
  /** Every position this gesture may aim at, in the order they are on screen. */
  readonly slots: readonly DropSlot[];
  /** Fixed when the list cannot be read off the DOM — see {@link slotAtPoint}. */
  readonly fixedList?: DropList | undefined;
}

/**
 * Dragging things onto the canvas, around it, into panels, and reordering pages.
 *
 * The input adapter and nothing else
 * ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) constraint 1): what a
 * drop *means* is `creator-core`'s `place`, and this turns pointers and keys into calls
 * to it. The state machine those calls drive is `placementActions`, which has no idea
 * whether a pointer or a keyboard reached it — which is what stops the canvas becoming
 * draggable but not keyboard-operable.
 *
 * **Reordering pages, reordering questions and dropping into a panel are one gesture**,
 * because a slot names its list. Three lists, one interaction, one off-by-one — and that
 * off-by-one had already survived a mutant once, which is reason enough not to keep a
 * second copy of it, let alone a third.
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

  const onCanvas: PlacementContext = {
    surface,
    measure: canvas,
    gesture,
    actions: placementActions(surface, state, setState),
    state,
    slots: surface.slots,
  };
  const inPageList: PlacementContext = {
    ...onCanvas,
    measure: pageList,
    slots: surface.pageSlots,
    fixedList: { of: 'pages' },
  };

  return {
    surfaceRef,
    pageListRef,
    source: state.source,
    activeSlot: isNoOp(state.slot, state.origin) ? undefined : state.slot,
    announcement: state.announcement,
    getItemProps: (item) => itemProps(onCanvas, item),
    getHandleProps: (name) => handleProps(onCanvas, name),
    getPageHandleProps: (name, index) =>
      handleProps(inPageList, name, { list: { of: 'pages' }, index }),
  };
}

function itemProps(context: PlacementContext, item: ToolboxItem): PlacementItemProps {
  const { surface } = context;
  const page = surface.page;
  return {
    ...dragProps(context, { kind: 'new', item }),
    onClick: () => {
      // The click that ends a drag is not a second instruction. Appending here as well
      // is how one gesture puts two questions on the page.
      if (!context.gesture.current.dragged && page !== undefined) {
        surface.place(
          { kind: 'new', item },
          { list: { of: 'elements', container: page.name }, index: page.elements.length },
        );
      }
    },
  };
}

function handleProps(
  context: PlacementContext,
  name: string,
  known?: DropSlot,
): PlacementHandleProps {
  const source: PlacementSource = { kind: 'move', name };
  const { state } = context;
  const origin = known ?? context.surface.locate(name);
  return {
    ...dragProps(context, source, origin),
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
      applyIntent(context, intent, source, origin);
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
  origin?: DropSlot,
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
      const slot = slotAtPoint(
        measure.current,
        { x: event.clientX, y: event.clientY },
        context.fixedList,
      );
      if (slot === undefined) {
        return;
      }
      if (state.source === undefined) {
        actions.begin(source, origin, slot);
      } else {
        actions.aim(slot);
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
  origin: DropSlot | undefined,
): void {
  const { actions, state, slots } = context;
  if (intent === 'cancel') {
    actions.abandon();
    return;
  }
  if (intent === 'toggle') {
    if (state.source === undefined) {
      const start = slots.find((slot) => isSameSlot(slot, origin)) ?? slots[0];
      if (start !== undefined) {
        actions.begin(source, origin, start);
      }
    } else {
      actions.commit();
    }
    return;
  }
  if (state.source === undefined) {
    return;
  }
  const next = stepSlot(slots, state.slot, intent, isSameSlot, (slot) =>
    isNoOp(slot, state.origin),
  );
  if (next !== undefined) {
    actions.aim(next);
  }
}
