import type { LogicRule } from '../logic/LogicRule.js';
import type { ChoiceFetcher } from './ChoiceFetcher.js';
import type { ChoiceSettings } from './choiceResponse.js';
import {
  choicesFromResponse,
  createCacheKey,
  placeholderDependencies,
  resolveUrl,
} from './choiceResponse.js';
import type { Endpoints } from './endpoints.js';
import { undeclaredEndpoints } from './endpoints.js';
import type { ItemValue } from './ItemValue.js';
import { choiceListsMatch } from './ItemValue.js';
import type { SelectQuestion } from './SelectQuestion.js';

export interface UrlChoiceSource {
  readonly key: string;
  readonly question: SelectQuestion;
  readonly url: string;
  readonly resolvePlaceholder: (name: string) => unknown;
  readonly announce: () => void;
}

/** Async URL mechanics hidden behind the dynamic-choice module's one interface. */
export class UrlChoiceLoader {
  readonly #cache: Map<string, readonly ItemValue[]> = new Map();
  readonly #errors: string[] = [];
  readonly #generations: Map<string, number> = new Map();
  readonly #pending: Map<string, Promise<unknown>> = new Map();
  #fetchJson: ChoiceFetcher | undefined;
  #endpoints: Endpoints = {};

  setFetcher(fetchJson: ChoiceFetcher | undefined): void {
    this.#fetchJson = fetchJson;
  }

  setEndpoints(endpoints: Endpoints): void {
    this.#endpoints = endpoints;
  }

  get errors(): readonly string[] {
    return this.#errors;
  }

  invalidate(key: string): void {
    this.#nextGeneration(key);
  }

  createRule(source: UrlChoiceSource): LogicRule {
    const settings: ChoiceSettings = {
      path: source.question.choicesPath,
      valueName: source.question.choicesValueName,
      titleName: source.question.choicesTitleName,
    };
    let loaded: readonly ItemValue[] | undefined;
    const apply = (choices: readonly ItemValue[]): void => {
      if (loaded !== undefined && choiceListsMatch(loaded, choices)) {
        return;
      }
      loaded = choices;
      source.question.setChoiceProvider(() => loaded ?? []);
      source.announce();
    };
    const clear = (): void => {
      loaded = undefined;
      source.question.clearChoiceProvider();
      source.announce();
    };

    return {
      key: source.key,
      reads: placeholderDependencies(source.url),
      run: () => {
        this.#refresh(source, settings, apply, clear);
      },
    };
  }

  #refresh(
    source: UrlChoiceSource,
    settings: ChoiceSettings,
    apply: (choices: readonly ItemValue[]) => void,
    clear: () => void,
  ): void {
    const generation = this.#nextGeneration(source.key);
    if (this.#hasUnknownOrigin(source)) {
      clear();
      return;
    }
    const url = resolveUrl(source.url, source.resolvePlaceholder, this.#endpoints);
    if (url.trim().length === 0) {
      clear();
      return;
    }
    const cacheKey = createCacheKey(url, settings);
    const cached = this.#cache.get(cacheKey);
    if (cached !== undefined) {
      apply(cached);
      return;
    }
    const request = this.#request(url, cacheKey);
    if (request === undefined) {
      // Clears rather than returning silently. There is no fetcher, so there are no
      // choices and there never will be — and `clear` is what tells the view to look
      // again, which is how the recorded error reaches a reader instead of sitting in
      // an array nobody is watching.
      clear();
      return;
    }
    void request.then(
      (payload) => {
        try {
          const choices = choicesFromResponse(payload, url, settings);
          this.#cache.set(cacheKey, choices);
          if (this.#isCurrent(source.key, generation)) {
            apply(choices);
          }
        } catch (error: unknown) {
          this.#reportCurrentFailure(source, generation, url, error);
        }
      },
      (error: unknown) => {
        this.#reportCurrentFailure(source, generation, url, error);
      },
    );
  }

  #hasUnknownOrigin(source: UrlChoiceSource): boolean {
    const missing = undeclaredEndpoints(source.url, this.#endpoints);
    if (missing.length === 0) {
      return false;
    }
    this.#errors.push(
      `"${source.question.name}" loads choices from ${JSON.stringify(missing[0])}, which no endpoint supplies.`,
    );
    return true;
  }

  /**
   * Records a failed load, and says so.
   *
   * **The announcement is the point.** Recording an error into an array changes nothing a
   * reader can see: a view showing `choiceErrors` has no reason to render again, so a
   * question whose choices could not load is indistinguishable from one still loading
   * them. A failure is a state change like any other, and this is where it is admitted.
   *
   * The choices themselves are left alone rather than cleared. A refresh that fails after
   * an earlier one succeeded should not also throw away the list a respondent can see —
   * the error says the newer attempt failed, which is true, and the stale list is more
   * use than an empty one.
   */
  #reportCurrentFailure(
    source: UrlChoiceSource,
    generation: number,
    url: string,
    error: unknown,
  ): void {
    if (this.#isCurrent(source.key, generation)) {
      this.#errors.push(`Loading "${url}" failed: ${String(error)}`);
      source.announce();
    }
  }

  #nextGeneration(key: string): number {
    const generation = (this.#generations.get(key) ?? 0) + 1;
    this.#generations.set(key, generation);
    return generation;
  }

  #isCurrent(key: string, generation: number): boolean {
    return this.#generations.get(key) === generation;
  }

  #request(url: string, cacheKey: string): Promise<unknown> | undefined {
    const fetchJson = this.#fetchJson;
    if (fetchJson === undefined) {
      this.#errors.push(
        `No choice fetcher is configured, so "${url}" cannot be loaded. Pass one as the survey's fetchJson option.`,
      );
      return undefined;
    }
    const pending = this.#pending.get(cacheKey);
    if (pending !== undefined) {
      return pending;
    }
    let response: Promise<unknown>;
    try {
      response = fetchJson(url);
    } catch (error: unknown) {
      response = Promise.reject(error);
    }
    this.#pending.set(cacheKey, response);
    void response.then(
      () => {
        this.#pending.delete(cacheKey);
      },
      () => {
        this.#pending.delete(cacheKey);
      },
    );
    return response;
  }
}
