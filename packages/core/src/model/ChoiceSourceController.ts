import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { LogicRule } from '../logic/LogicRule.js';
import type { ChoiceSettings } from './choiceResponse.js';
import {
  choicesFromResponse,
  createCacheKey,
  placeholderDependencies,
  resolveUrl,
} from './choiceResponse.js';
import type { ItemValue } from './ItemValue.js';
import { choiceListsMatch } from './ItemValue.js';
import type { SelectQuestion } from './SelectQuestion.js';

/** The host-owned I/O adapter used by URL-backed choice sources. */
export type ChoiceFetcher = (url: string) => Promise<unknown>;

/** How a carried-forward list relates to the source question's answer. */
export type CarryForwardMode = 'all' | 'selected' | 'unselected';

export interface UrlChoiceSource {
  readonly key: string;
  readonly question: SelectQuestion;
  readonly url: string;
  readonly resolvePlaceholder: (name: string) => unknown;
  readonly announce: () => void;
}

export interface CarryForwardChoiceSource {
  readonly key: string;
  readonly question: SelectQuestion;
  readonly sourceName: string;
  readonly mode: CarryForwardMode;
  /** Choices currently offered by the source, or undefined when it is not a select. */
  readonly getSourceChoices: () => readonly ItemValue[] | undefined;
  readonly getSourceValue: () => unknown;
  readonly announce: () => void;
}

function selectedValues(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === null || value === undefined ? [] : [value];
}

/**
 * Owns every way a question's choices can come from somewhere other than its own
 * authored list: carried forward from another question, or loaded from a URL.
 *
 * Both live here so the two look alike at the call site and share one notion of which
 * source is installed. Fetching stays injected, so core remains I/O-free; everything
 * that makes an async source safe — request generations, response caching,
 * pending-request sharing, and error capture — is kept behind this one interface.
 */
export class ChoiceSourceController {
  readonly #cache: Map<string, readonly ItemValue[]> = new Map();
  readonly #errors: string[] = [];
  readonly #generations: Map<string, number> = new Map();
  readonly #pending: Map<string, Promise<unknown>> = new Map();
  #fetchJson: ChoiceFetcher | undefined;

  setFetcher(fetchJson: ChoiceFetcher | undefined): void {
    this.#fetchJson = fetchJson;
  }

  /** A failed load, malformed response, or URL configured without a fetcher. */
  get errors(): readonly string[] {
    return this.#errors;
  }

  /** Makes every outstanding request for a removed URL source obsolete. */
  invalidate(key: string): void {
    this.#nextGeneration(key);
  }

  /**
   * Derives one question's choices from another's.
   *
   * The derivation is installed as a **live provider**, not computed into a stored
   * list. Two independent things move it: the source's *answer*, which this rule
   * depends on, and the visibility of individual source choices, which their own
   * `visibleIf` drives. A snapshot would be correct for the first and stale for the
   * second.
   *
   * The rule therefore exists only to notice when the derived list changed as a result
   * of the answer, and say so — choice-visibility changes already announce themselves
   * through the element-state event.
   */
  createCarryForwardRule(source: CarryForwardChoiceSource): LogicRule {
    let announced: readonly ItemValue[] | undefined;

    const derive = (): readonly ItemValue[] => {
      const choices = source.getSourceChoices();
      if (choices === undefined) {
        return [];
      }
      if (source.mode === 'all') {
        return choices;
      }
      const answer = selectedValues(source.getSourceValue());
      const isPicked = (choice: ItemValue): boolean =>
        answer.some((selected) => valuesAreEqual(selected, choice.value));
      return source.mode === 'selected'
        ? choices.filter((choice) => isPicked(choice))
        : choices.filter((choice) => !isPicked(choice));
    };

    return {
      key: source.key,
      reads: [[{ kind: 'name', name: source.sourceName }]],
      run: () => {
        // Pointing at a question that has no choices is an authoring mistake; leaving
        // the authored list in place beats offering nothing.
        if (source.getSourceChoices() === undefined) {
          return;
        }
        source.question.setChoiceProvider(derive);

        const current = derive();
        if (announced === undefined || !choiceListsMatch(announced, current)) {
          announced = current;
          source.announce();
        }
      },
    };
  }

  /**
   * Creates the logic rule that keeps one question's remote choices current.
   *
   * The URL's `{question}` placeholders are declared as graph dependencies, so changing
   * an answer the URL interpolates re-runs this rule and re-fetches — the same
   * mechanism every other piece of logic uses, rather than a bespoke watcher.
   *
   * Loading is asynchronous and therefore lands *after* the settle that started it. The
   * cache is checked synchronously first, so a repeat of a URL already seen applies
   * within the transaction and never re-renders.
   */
  createUrlRule(source: UrlChoiceSource): LogicRule {
    const settings: ChoiceSettings = {
      path: source.question.choicesPath,
      valueName: source.question.choicesValueName,
      titleName: source.question.choicesTitleName,
    };
    let loaded: readonly ItemValue[] | undefined;

    const apply = (choices: readonly ItemValue[]): void => {
      if (loaded !== undefined && choiceListsMatch(loaded, choices)) {
        // A cached response identical to what is already shown must not re-render.
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
        this.#refreshSource(source, settings, apply, clear);
      },
    };
  }

  #refreshSource(
    source: UrlChoiceSource,
    settings: ChoiceSettings,
    apply: (choices: readonly ItemValue[]) => void,
    clear: () => void,
  ): void {
    const generation = this.#nextGeneration(source.key);
    const url = resolveUrl(source.url, source.resolvePlaceholder);
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
      return;
    }
    void request.then(
      (payload) => {
        try {
          const choices = choicesFromResponse(payload, url, settings);
          this.#cache.set(cacheKey, choices);
          // A response for a URL this question has since moved off must not install
          // itself: it answers a question nobody is asking any more.
          if (this.#isCurrent(source.key, generation)) {
            apply(choices);
          }
        } catch (error: unknown) {
          if (this.#isCurrent(source.key, generation)) {
            this.#errors.push(`Loading "${url}" failed: ${String(error)}`);
          }
        }
      },
      (error: unknown) => {
        if (this.#isCurrent(source.key, generation)) {
          this.#errors.push(`Loading "${url}" failed: ${String(error)}`);
        }
      },
    );
  }

  #nextGeneration(key: string): number {
    const generation = (this.#generations.get(key) ?? 0) + 1;
    this.#generations.set(key, generation);
    return generation;
  }

  #isCurrent(key: string, generation: number): boolean {
    return this.#generations.get(key) === generation;
  }

  /** Shares one in-flight request between every source awaiting the same response. */
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
      // A fetcher that throws synchronously is reported like one that rejects.
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
