/**
 * A running record of what happened during a validation check.
 *
 * Diagnostic scaffolding for one specific defect: roughly once every few full E2E runs
 * a scenario fails with the Next button reading "Checking…" and never coming back, and
 * the failure snapshot could only ever show that final state — not whether the check
 * started, whether the host's own validator was entered, or whether it ever returned.
 * Those three facts separate "a timer starved under load" from "something never
 * resolved", and nothing in the page recorded any of them.
 *
 * Entirely the host's. The library exposes `onValidatingChanged`, and everything below
 * observes it the way any consumer would — instrumentation belongs on this side of the
 * seam, not inside the thing being diagnosed.
 */
export interface CheckLogEntry {
  /** Milliseconds since the page loaded, rounded. */
  readonly at: number;
  readonly label: string;
}

/** Enough to see a whole check and the one before it, without growing forever. */
const LIMIT = 40;

let entries: readonly CheckLogEntry[] = [];
const listeners = new Set<() => void>();

export function recordCheckEvent(label: string): void {
  entries = [...entries, { at: Math.round(performance.now()), label }].slice(-LIMIT);
  for (const listener of listeners) {
    listener();
  }
}

/**
 * The log so far.
 *
 * The same array until something is appended, because `useSyncExternalStore` compares
 * snapshots by identity and a fresh copy per read would loop forever.
 */
export function checkLog(): readonly CheckLogEntry[] {
  return entries;
}

export function subscribeToCheckLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
