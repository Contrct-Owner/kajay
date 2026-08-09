import type { DesignSurface, DropList, PlacementSource, ToolboxItem } from '@kajay/creator-core';
import type { KeyboardEvent, PointerEvent } from 'react';
import { anchorGhost, carryGhost, grabOffsetIn } from './ghostPosition.js';
import type { Point } from './ghostPosition.js';
import { slotAtPoint } from './placementGeometry.js';
import { placementIntent } from './placementKeys.js';
import type { PlacementIntent } from './placementKeys.js';
import { shapeOfSource, sourceNodeOf } from './placementShape.js';
import type { PlacementShape } from './placementShape.js';

/**
 * Translating a pointer and a keyboard into the placement session's commands — K2.
 *
 * Split from the hook that assembles them because they are the half that is *about the
 * browser* — capture, geometry, the ghost's coordinates, which key means what — while the
 * hook is about wiring that half to React. Nothing here holds state of its own; everything
 * it needs arrives in a {@link PlacementContext}.
 */

/** Pointer handlers for anything draggable: a toolbox item, an element, a page. */
export interface PlacementDragProps {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

/** Drag handlers plus the atomic click-to-append interaction for a toolbox item. */
export interface PlacementItemProps extends PlacementDragProps {
  readonly onClick: () => void;
}

/** Everything an element or page drag handle needs. */
export interface PlacementHandleProps extends PlacementDragProps {
  readonly 'aria-roledescription': string;
  readonly 'data-grabbed': 'true' | undefined;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface Gesture {
  pending: boolean;
  dragged: boolean;
}

export type ElementRef = { current: HTMLElement | null };

/** The ghost node, how its coordinates are worked out, and whether it is shown. */
export interface Carry {
  readonly node: ElementRef;
  /** Where a fixed node's coordinates start from in this host's layout. */
  readonly anchor: { current: Point | null };
  /** Where the pointer sat inside what it picked up, so the copy hangs from that point. */
  readonly grab: { current: Point };
  readonly show: (carrying: boolean) => void;
}

export interface PlacementContext {
  readonly surface: DesignSurface;
  readonly measure: ElementRef;
  readonly gesture: { current: Gesture };
  readonly remember: (shape: PlacementShape) => void;
  readonly carry: Carry;
  /** Notes where everything sits, so the rearrangement can be moved into rather than cut to. */
  readonly settle: () => void;
  readonly fixedList?: DropList | undefined;
}



export function itemProps(context: PlacementContext, item: ToolboxItem): PlacementItemProps {
  const { surface } = context;
  const source: PlacementSource = { kind: 'new', item };
  return {
    ...dragProps(context, source),
    onClick: () => {
      const page = surface.page;
      if (!context.gesture.current.dragged && page !== undefined) {
        surface.placement.transition({
          kind: 'place',
          source,
          slot: {
            list: { of: 'elements', container: page.name },
            index: page.elements.length,
          },
        });
      }
    },
  };
}

export function handleProps(context: PlacementContext, name: string): PlacementHandleProps {
  const source: PlacementSource = { kind: 'move', name };
  const snapshot = context.surface.placement.snapshot;
  return {
    ...dragProps(context, source),
    'aria-roledescription': 'Sortable item',
    'data-grabbed':
      snapshot.source?.kind === 'move' && snapshot.source.name === name ? 'true' : undefined,
    onKeyDown: (event) => {
      const intent = placementIntent(event.key);
      if (intent === undefined) {
        return;
      }
      event.preventDefault();
      applyIntent(context, intent, source, event.currentTarget);
    },
  };
}

/** A drag begins on movement, leaving a press available for focus and selection. */
function dragProps(context: PlacementContext, source: PlacementSource): PlacementDragProps {
  const { measure, gesture, surface } = context;
  return {
    onPointerDown: (event) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { pending: true, dragged: false };
      grip(context, event);
    },
    onPointerMove: (event) => {
      if (!gesture.current.pending || measure.current === null) {
        return;
      }
      gesture.current.dragged = true;
      aim(context, source, event, measure.current);
    },
    onPointerUp: () => {
      gesture.current.pending = false;
      drop(context);
      surface.placement.transition({ kind: 'finish', action: 'commit' });
    },
    onPointerCancel: () => {
      gesture.current.pending = false;
      drop(context);
      surface.placement.transition({ kind: 'finish', action: 'abandon' });
    },
  };
}

/**
 * Notes where the pointer took hold, on the press.
 *
 * A drag only *begins* on the first move, by which time the pointer has left the element —
 * an offset measured then is the distance to wherever it went, which draws the copy that
 * far from the cursor, in the opposite direction, for the rest of the drag.
 */
function grip(context: PlacementContext, event: PointerEvent<HTMLElement>): void {
  context.carry.grab.current = grabOffsetIn(sourceNodeOf(event.currentTarget), {
    x: event.clientX,
    y: event.clientY,
  });
}

/** Where this move points, and what that means for a drag that may not have begun yet. */
function aim(
  context: PlacementContext,
  source: PlacementSource,
  event: PointerEvent<HTMLElement>,
  within: HTMLElement,
): void {
  const placement = context.surface.placement;
  const slot = slotAtPoint(within, { x: event.clientX, y: event.clientY }, context.fixedList);
  if (slot === undefined) {
    // The ghost keeps following even here. A pointer past the edge of the surface has
    // nowhere to drop, and the thing in hand has not stopped being in hand — freezing it
    // where the last valid aim was would read as the drag having let go.
    follow(context, event);
    if (placement.snapshot.kind === 'preview') {
      placement.transition({ kind: 'aim', slot: undefined });
    }
    return;
  }
  if (placement.snapshot.kind === 'idle') {
    // Measured before anything has been told about the drag, which is the only moment the
    // page is still arranged the way the designer last saw it.
    context.settle();
    context.remember(shapeOfSource(source, event.currentTarget));
    lift(context);
    follow(context, event);
    placement.transition({ kind: 'start', source, slot });
    return;
  }
  follow(context, event);
  placement.transition({ kind: 'aim', slot });
}

/**
 * Picks the ghost up: measures where its coordinates are counted from, and shows it.
 *
 * The anchor is taken per drag rather than once, because a host's layout can change
 * between one and the next — and it is taken *before* the first move is applied, which is
 * the only moment the ghost is reliably back at its origin. Where the pointer grabbed the
 * element is not taken here: by now it has moved, so that belongs to the press.
 */
function lift(context: PlacementContext): void {
  const { node, anchor, show } = context.carry;
  if (node.current !== null) {
    anchor.current = anchorGhost(node.current);
  }
  show(true);
}

/**
 * Moves the ghost, by writing to the element rather than through React.
 *
 * A ghost follows the pointer, so this runs on every `pointermove` — and re-rendering the
 * canvas that often is exactly what the placement session's aim-only publishing exists to
 * avoid. Two custom properties on one node render nothing.
 */
function follow(context: PlacementContext, event: PointerEvent<HTMLElement>): void {
  const { node, anchor } = context.carry;
  if (node.current === null || anchor.current === null) {
    return;
  }
  const { grab } = context.carry;
  carryGhost(node.current, {
    x: event.clientX - anchor.current.x + grab.current.x,
    y: event.clientY - anchor.current.y + grab.current.y,
  });
}

/**
 * Lets go: hides the ghost, and deliberately leaves it where it was.
 *
 * Putting it back to its origin here looks tidier and takes away the one thing the drop
 * animation needs — the last place the question was seen. The element being settled into
 * its new home has been invisible for the whole drag, so the ghost's final position is
 * where it was on screen, and something has to still know it after the pointer is up. The
 * next drag re-anchors before it measures (`anchorGhost`), so nothing is left stale.
 */
function drop(context: PlacementContext): void {
  const { anchor, show } = context.carry;
  anchor.current = null;
  show(false);
}

function applyIntent(
  context: PlacementContext,
  intent: PlacementIntent,
  source: PlacementSource,
  from: HTMLElement,
): void {
  const placement = context.surface.placement;
  if (intent === 'cancel') {
    placement.transition({ kind: 'finish', action: 'abandon' });
    return;
  }
  if (intent === 'toggle') {
    if (placement.snapshot.kind === 'idle') {
      // Measured on the grab, before anything has stood aside, exactly as the pointer
      // path does — the two gestures have to produce the same placeholder or the keyboard
      // walk would show a different page from the one a drag shows.
      context.settle();
      context.remember(shapeOfSource(source, from));
      placement.transition({ kind: 'start', source });
      return;
    }
    placement.transition({ kind: 'finish', action: 'commit' });
    return;
  }
  placement.transition({ kind: 'step', direction: intent });
}

