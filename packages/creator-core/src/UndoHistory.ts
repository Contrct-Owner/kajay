import type { SurveyDefinition } from '@kajay/core';

/**
 * Everything an undo has to put back — checklist K6.
 *
 * The definition, and *where the designer was in it*. Restoring the survey alone would
 * be correct and disorienting: an edit made on page two, undone while looking at page
 * three, would silently change a page nobody could see. What changed should be on screen
 * when it changes back.
 */
export interface HistorySnapshot {
  readonly definition: SurveyDefinition;
  readonly page: string | undefined;
  readonly selected: string | undefined;
}

/** How many edits are kept. Beyond this the oldest is forgotten. */
const DEPTH = 100;

/**
 * The undo and redo stacks — checklist K6.
 *
 * **A stack of definitions, not a stack of commands.** That was decided in
 * [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3 and is the
 * whole return on it: because every structural edit already produces a definition and
 * re-parses, undo is "parse the previous one" rather than an inverse operation per
 * command. A command stack needs every future editing feature to remember to write its
 * own inverse, and the one that forgets is not discovered until somebody presses undo.
 *
 * The cost is honest and worth stating: an entry is a whole survey definition, so this
 * trades memory for never being wrong. {@link DEPTH} bounds it.
 */
export class UndoHistory {
  readonly #undo: HistorySnapshot[] = [];
  readonly #redo: HistorySnapshot[] = [];
  /** What the last recorded edit was, for coalescing. */
  #lastKey: string | undefined;

  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }

  /**
   * Remembers the state an edit is about to change, and abandons any redo.
   *
   * **Edits sharing a `key` coalesce.** Typing a title produces one call per keystroke,
   * and an undo stack that kept them all would give back the letters one at a time —
   * which is not what anybody means by undoing a rename. Consecutive edits with the same
   * key keep the *earliest* snapshot, so undo returns to before the typing started.
   *
   * Coalescing is by key rather than by elapsed time. A timer would make how much an
   * undo gives back depend on how fast somebody types, and would need a clock in the
   * Creator to be testable at all. An edit with no key never coalesces.
   */
  record(snapshot: HistorySnapshot, key?: string): void {
    // A new edit makes the redo stack a description of a future that no longer follows.
    this.#redo.length = 0;
    if (key !== undefined && key === this.#lastKey) {
      return;
    }
    this.#lastKey = key;
    this.#undo.push(snapshot);
    if (this.#undo.length > DEPTH) {
      this.#undo.shift();
    }
  }

  /**
   * Ends the run of edits that were coalescing.
   *
   * Called when the designer's attention moves — a different selection, a different
   * page. Without it, renaming a question, going away to do something else and coming
   * back to rename it again would be one undo, because the key had not changed.
   */
  breakRun(): void {
    this.#lastKey = undefined;
  }

  /** The state to go back to, given the state being left. */
  undo(current: HistorySnapshot): HistorySnapshot | undefined {
    return this.#step(this.#undo, this.#redo, current);
  }

  /** The state to go forward to, given the state being left. */
  redo(current: HistorySnapshot): HistorySnapshot | undefined {
    return this.#step(this.#redo, this.#undo, current);
  }

  /**
   * Moves one state from one stack to the other.
   *
   * One method for both directions because they are the same operation: pop where you
   * are going, push where you have been. Written twice, they drift — and the direction
   * that drifts is redo, which is the one nobody tries by hand.
   */
  #step(
    from: HistorySnapshot[],
    to: HistorySnapshot[],
    current: HistorySnapshot,
  ): HistorySnapshot | undefined {
    const next = from.pop();
    if (next === undefined) {
      return undefined;
    }
    to.push(current);
    // Whatever was coalescing has been interrupted by a jump through time; an edit made
    // now continues nothing.
    this.#lastKey = undefined;
    return next;
  }
}
