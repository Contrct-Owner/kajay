import type { PointerEvent } from 'react';
import type { ReorderContext } from './ReorderContext.js';
import { announceRow, moveRow } from './ReorderContext.js';

/**
 * Starts a drag.
 *
 * Pointer events rather than HTML5 drag-and-drop, which
 * [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) rules out: native DnD has
 * no keyboard story and behaves badly under touch, and the same interaction has to work
 * for both.
 *
 * Capture is taken immediately so the gesture keeps arriving at this row even once the
 * pointer has left it — which it does the moment the drag starts moving. The row is
 * focused explicitly because suppressing the default also suppresses the focus that
 * would normally come with pressing a button, and someone who starts with the mouse
 * must be able to carry on with the keyboard.
 */
export function beginReorderDrag(
  context: ReorderContext,
  index: number,
  event: PointerEvent<HTMLElement>,
): void {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.focus();
  context.update({ dragged: { pointerId: event.pointerId, index }, grabbed: undefined });
}

/**
 * Follows a drag, rearranging the list under the pointer as it goes.
 *
 * The model is updated during the gesture rather than at the end, so what the
 * respondent sees while dragging *is* the answer being recorded — there is no separate
 * preview that could disagree with it, and dropping is not a commit step that could
 * fail.
 */
export function continueReorderDrag(
  context: ReorderContext,
  event: PointerEvent<HTMLElement>,
): void {
  const dragged = context.state.dragged;
  if (dragged === undefined || dragged.pointerId !== event.pointerId) {
    return;
  }
  const to = nearestRow(context.rows(), event.clientX, event.clientY);
  if (to === undefined || to === dragged.index || !moveRow(context, dragged.index, to)) {
    return;
  }
  context.update({ dragged: { pointerId: dragged.pointerId, index: to } });
}

/** Ends a drag, however it ended: released, cancelled, or capture lost. */
export function endReorderDrag(
  context: ReorderContext,
  event: PointerEvent<HTMLElement>,
): void {
  const dragged = context.state.dragged;
  if (dragged === undefined || dragged.pointerId !== event.pointerId) {
    return;
  }
  context.update({ dragged: undefined });
  announceRow(context, 'dropped', dragged.index);
}

/**
 * The row the pointer is closest to, by the distance to each row's centre.
 *
 * Centres rather than edges, and distance rather than an axis test, so one
 * implementation serves a stacked list, a row of tiles and a grid alike. It is also
 * what makes a drag feel right: a row changes places exactly when the pointer passes
 * the middle of its neighbour, not when it grazes the edge.
 */
function nearestRow(
  rows: readonly HTMLElement[],
  x: number,
  y: number,
): number | undefined {
  let nearest: number | undefined;
  let shortest = Number.POSITIVE_INFINITY;
  rows.forEach((row, index) => {
    const box = row.getBoundingClientRect();
    const dx = x - (box.left + box.width / 2);
    const dy = y - (box.top + box.height / 2);
    const distance = dx * dx + dy * dy;
    if (distance < shortest) {
      shortest = distance;
      nearest = index;
    }
  });
  return nearest;
}
