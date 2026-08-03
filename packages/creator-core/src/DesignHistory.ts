import type { SurveyDefinition } from '@kajay/core';
import type { DesignSurface } from './DesignSurface.js';
import { UndoHistory } from './UndoHistory.js';
import type { HistorySnapshot } from './UndoHistory.js';

/**
 * Undo and redo for a design surface — checklist K6.
 *
 * `UndoHistory` is the stack and knows nothing about surveys; this is the part that knows
 * **what a snapshot of this surface is**. An entry carries where the designer was as well
 * as what the survey held: restoring the definition alone would be correct and
 * disorienting, changing a page nobody could see.
 *
 * Its own class rather than three private methods on the surface, because it is the third
 * thing that reads a surface without being one — beside the clipboard and the property
 * grid — and the surface had grown into a file where none of the three could be found.
 */
export class DesignHistory {
  readonly #history: UndoHistory = new UndoHistory();

  get canUndo(): boolean {
    return this.#history.canUndo;
  }

  get canRedo(): boolean {
    return this.#history.canRedo;
  }

  /** Ends whatever was coalescing, because the designer's attention has moved. */
  breakRun(): void {
    this.#history.breakRun();
  }

  /**
   * Remembers the state an edit is about to change.
   *
   * The definition is passed in rather than read, because every caller has just computed
   * it — serializing a whole survey twice per drop is a real cost for nothing.
   */
  record(surface: DesignSurface, definition: SurveyDefinition, undoKey?: string): void {
    this.#history.record(snapshot(surface, definition), undoKey);
  }

  undo(surface: DesignSurface): HistorySnapshot | undefined {
    return this.#history.undo(snapshot(surface));
  }

  redo(surface: DesignSurface): HistorySnapshot | undefined {
    return this.#history.redo(snapshot(surface));
  }
}

function snapshot(
  surface: DesignSurface,
  definition: SurveyDefinition = surface.definition,
): HistorySnapshot {
  return { definition, page: surface.page?.name, selected: surface.selectedName };
}
