import type { HostValues } from './hostValues.js';

/** What a write did, so the caller can decide whether anything needs recomputing. */
export interface HostValueWrite {
  readonly changed: boolean;
  readonly previousValue: unknown;
}

/**
 * The host's values, held apart from the answers and from the calculated results.
 *
 * A third store rather than a corner of one of the others, because the three differ in
 * exactly the way that matters: an answer is the respondent's and reaches the response,
 * a calculated value is the definition's and reaches it only when asked to, and this is
 * the host's and never reaches it at all. Keeping it out of `SurveyAnswers` is what
 * makes that last guarantee structural rather than a filter somebody maintains.
 *
 * It reports whether a write *changed* anything for the same reason the calculated store
 * does: a host handing back the value already in force must not start a settle, or a
 * host that refreshes its context on a timer would recompute the survey forever.
 */
export class HostValueStore {
  readonly #values: Map<string, unknown> = new Map();

  get(key: string): unknown {
    return this.#values.get(key);
  }

  /** Records a value, reporting whether it actually changed and what it replaced. */
  set(key: string, value: unknown): HostValueWrite {
    const previousValue = this.#values.get(key);
    if (this.#values.has(key) && Object.is(previousValue, value)) {
      return { changed: false, previousValue };
    }
    this.#values.set(key, value);
    return { changed: true, previousValue };
  }

  /**
   * Installs a whole set, replacing whatever was there.
   *
   * Replacing rather than merging: this runs when a host configures the survey, and a
   * configure that inherited values from a previous one would carry a stale tier into a
   * session the host thought it had reset.
   */
  replaceAll(values: HostValues): void {
    this.#values.clear();
    for (const [key, value] of Object.entries(values)) {
      this.#values.set(key, value);
    }
  }
}
