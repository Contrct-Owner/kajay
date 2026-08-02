import type { ChoiceFetcher } from '../logic/createChoicesByUrlRule.js';
import type { ItemValue } from './ItemValue.js';

/**
 * Everything the runtime choice sources need that outlives a single rule run.
 *
 * The cache is per-survey rather than global so two surveys never share a response,
 * and so a test's fixture cannot leak into the next test — the parallel-first policy
 * rules out shared mutable state.
 */
export class ChoiceSourceState {
  readonly cache: Map<string, readonly ItemValue[]> = new Map();
  readonly #errors: string[] = [];
  #fetchJson: ChoiceFetcher | undefined;

  get fetchJson(): ChoiceFetcher | undefined {
    return this.#fetchJson;
  }

  setFetcher(fetchJson: ChoiceFetcher | undefined): void {
    this.#fetchJson = fetchJson;
  }

  /** A failed load, or a URL configured with no fetcher to load it. */
  get errors(): readonly string[] {
    return this.#errors;
  }

  report(message: string): void {
    this.#errors.push(message);
  }
}
