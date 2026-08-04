/** What a key press means to the undo stacks — checklist K6. */
export type HistoryIntent = 'undo' | 'redo';

/** The parts of a key event this reads. Narrow, so it can be tested without a DOM. */
export interface HistoryKey {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

/**
 * Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y — and the same with Cmd.
 *
 * Both redo spellings, because both are somebody's muscle memory: Ctrl+Y is the Windows
 * convention and Ctrl+Shift+Z is everywhere else. Accepting one and refusing the other
 * makes redo feel broken to half the people who try it.
 *
 * Kept inside the top-level design-surface piece rather than bound to the document. A
 * global listener would take Ctrl+Z away from the rest of the host's application — which
 * may well have its own undo, and certainly has its own text fields. A host composes the
 * public `DesignSurfacePanel`, which owns the correctly scoped binding.
 */
export function historyShortcut(event: HistoryKey): HistoryIntent | undefined {
  if (!event.ctrlKey && !event.metaKey) {
    return undefined;
  }
  const key = event.key.toLowerCase();
  if (key === 'y') {
    return 'redo';
  }
  if (key !== 'z') {
    return undefined;
  }
  return event.shiftKey ? 'redo' : 'undo';
}

/**
 * Whether the key press belongs to a text field instead.
 *
 * **Ctrl+Z inside an input is the field's own undo, not the designer's.** Somebody
 * halfway through typing a title means "take back that letter", and stealing the key to
 * roll back the whole rename would be both surprising and unrecoverable — the letters
 * they had typed are not on any stack.
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}
