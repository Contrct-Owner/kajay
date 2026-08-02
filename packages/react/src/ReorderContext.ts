import type { ReorderEventKind } from './reorderAnnouncement.js';
import { reorderAnnouncement } from './reorderAnnouncement.js';

/** What a reorderable list is and what moving a row means. Supplied by the caller. */
export interface ReorderOptions {
  /** How many rows there are right now. */
  readonly itemCount: number;
  /**
   * Applies a move, returning whether anything actually moved.
   *
   * The only thing the interaction knows how to do. It reports positions rather than
   * items because positions are all it observed: it watched a row travel past its
   * neighbours and never needed to know what was on it.
   */
  readonly onMove: (from: number, to: number) => boolean;
  /**
   * Names the row at an index — read *after* a move, so it must read current state
   * rather than a snapshot taken when the interaction started.
   */
  readonly describe: (index: number) => string;
}

/** A row picked up by keyboard, and where it started. */
export interface GrabbedRow {
  readonly index: number;
  /** Where Escape puts it back. */
  readonly origin: number;
}

/** A row being dragged, and the pointer doing it. */
export interface DraggedRow {
  readonly pointerId: number;
  readonly index: number;
}

export interface ReorderState {
  readonly grabbed: GrabbedRow | undefined;
  readonly dragged: DraggedRow | undefined;
  readonly announcement: string;
}

/**
 * Everything a reorder gesture needs, independent of which gesture it is.
 *
 * Pointer dragging and keyboard moving are the same operation reached two ways, so
 * they share one state, one way to apply a move and one way to say what happened.
 * Splitting them into two implementations is how a list ends up draggable but not
 * keyboard-operable, which [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md)
 * exists to prevent.
 */
export interface ReorderContext {
  readonly options: ReorderOptions;
  readonly state: ReorderState;
  /** Merges a change. Composes with other calls in the same event. */
  readonly update: (next: Partial<ReorderState>) => void;
  /** The row elements, in the order they are on screen right now. */
  readonly rows: () => readonly HTMLElement[];
}

/**
 * Moves a row and says so, clamping a request that would leave the list.
 *
 * Clamping rather than refusing: an arrow key at the bottom of the list, or a pointer
 * dragged past the end, means "as far as it goes" — and a move that changes nothing is
 * reported as nothing happening, so no announcement is made for it.
 */
export function moveRow(context: ReorderContext, from: number, to: number): boolean {
  const target = Math.min(Math.max(to, 0), context.options.itemCount - 1);
  if (!context.options.onMove(from, target)) {
    return false;
  }
  announceRow(context, 'moved', target);
  return true;
}

export function announceRow(
  context: ReorderContext,
  kind: ReorderEventKind,
  index: number,
): void {
  context.update({
    announcement: reorderAnnouncement(
      kind,
      context.options.describe(index),
      index,
      context.options.itemCount,
    ),
  });
}
