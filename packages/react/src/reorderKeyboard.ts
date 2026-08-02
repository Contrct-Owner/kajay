import type { KeyboardEvent } from 'react';
import type { ReorderContext } from './ReorderContext.js';
import { announceRow, moveRow } from './ReorderContext.js';

/** What a key press means to a reorderable list. */
type ReorderIntent = 'toggle' | 'cancel' | 'previous' | 'next' | 'first' | 'last';

/**
 * Grab, move, drop — the keyboard half of reordering.
 *
 * A grab mode rather than a modifier chord (Ctrl+Arrow and the like), because a
 * respondent has to be able to *find* this: pressing space on something and being told
 * "grabbed, use the arrow keys" teaches the whole interaction, while a chord is
 * discoverable only by already knowing it. Escape puts the row back where it started,
 * so trying it out costs nothing.
 *
 * Both axes are accepted for the same reason the interaction takes no axis option: the
 * same list may be stacked here and side by side elsewhere, and a respondent should not
 * have to work out which one they are looking at before pressing a key.
 */
export function handleReorderKey(
  context: ReorderContext,
  index: number,
  event: KeyboardEvent<HTMLElement>,
): void {
  const intent = reorderIntent(event.key);
  if (intent === undefined) {
    return;
  }
  // Every key this understands is claimed: space must not scroll the page, and Enter
  // must not submit the survey out from under someone arranging a list.
  event.preventDefault();
  const { grabbed } = context.state;

  if (intent === 'toggle') {
    toggleGrab(context, index);
    return;
  }
  if (intent === 'cancel') {
    cancelGrab(context);
    return;
  }
  if (grabbed === undefined) {
    // Nothing is grabbed, so the arrows walk the list rather than rearranging it.
    context.rows()[targetIndex(context, index, intent)]?.focus();
    return;
  }
  moveGrabbed(context, targetIndex(context, grabbed.index, intent));
}

function reorderIntent(key: string): ReorderIntent | undefined {
  switch (key) {
    case ' ':
    case 'Enter':
      return 'toggle';
    case 'Escape':
      return 'cancel';
    case 'ArrowUp':
    case 'ArrowLeft':
      return 'previous';
    case 'ArrowDown':
    case 'ArrowRight':
      return 'next';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return undefined;
  }
}

function targetIndex(context: ReorderContext, from: number, intent: ReorderIntent): number {
  switch (intent) {
    case 'previous':
      return from - 1;
    case 'next':
      return from + 1;
    case 'first':
      return 0;
    case 'last':
      return context.options.itemCount - 1;
    default:
      return from;
  }
}

function toggleGrab(context: ReorderContext, index: number): void {
  const { grabbed } = context.state;
  if (grabbed === undefined) {
    context.update({ grabbed: { index, origin: index } });
    announceRow(context, 'grabbed', index);
    return;
  }
  context.update({ grabbed: undefined });
  announceRow(context, 'dropped', grabbed.index);
}

function moveGrabbed(context: ReorderContext, to: number): void {
  const { grabbed } = context.state;
  if (grabbed === undefined || !moveRow(context, grabbed.index, to)) {
    return;
  }
  // The row travelled, so the grab travels with it — or the next arrow key would move
  // whatever has taken its place. Focus needs no help: the caller keys its rows by
  // identity, so React moves the focused element itself.
  const landed = Math.min(Math.max(to, 0), context.options.itemCount - 1);
  context.update({ grabbed: { index: landed, origin: grabbed.origin } });
}

/**
 * Puts a grabbed row back where it was picked up.
 *
 * Every move was applied to the model as it happened — that is what makes the list
 * announce and behave identically whichever gesture drove it — so undoing them means
 * one move back to the origin, not a stack of reversals.
 */
function cancelGrab(context: ReorderContext): void {
  const { grabbed } = context.state;
  if (grabbed === undefined) {
    return;
  }
  context.options.onMove(grabbed.index, grabbed.origin);
  context.update({ grabbed: undefined });
  announceRow(context, 'returned', grabbed.origin);
}
