import type { DependencyPattern } from '../dependencies/DependencyPattern.js';
import { collectReferences } from '../expressions/collectReferences.js';
import { formatPath } from '../expressions/ExpressionNode.js';
import { parseExpression } from '../expressions/parseExpression.js';
import type { LogicRule } from '../logic/LogicRule.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { choiceListsMatch, ItemValue } from './ItemValue.js';
import type { SelectQuestion } from './SelectQuestion.js';

/** The host-owned I/O adapter used by URL-backed choice sources. */
export type ChoiceFetcher = (url: string) => Promise<unknown>;

export interface UrlChoiceSource {
  readonly key: string;
  readonly question: SelectQuestion;
  readonly url: string;
  readonly resolvePlaceholder: (name: string) => unknown;
  readonly announce: () => void;
}

interface ChoiceSettings {
  readonly path: string;
  readonly valueName: string;
  readonly titleName: string;
}

const PLACEHOLDER = /\{([^{}]+)\}/gu;

/**
 * Owns the complete lifecycle of URL-backed choices for one survey.
 *
 * Fetching remains injected so core stays I/O-free. Everything that makes an async
 * source safe — request generations, response caching, pending-request sharing,
 * response conversion, and error capture — is kept behind this one interface.
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

  /** Creates the logic rule that keeps one question's remote choices current. */
  createUrlRule(source: UrlChoiceSource): LogicRule {
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

  #request(
    url: string,
    cacheKey: string,
  ): Promise<unknown> | undefined {
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

function createCacheKey(url: string, settings: ChoiceSettings): string {
  return JSON.stringify([url, settings.path, settings.valueName, settings.titleName]);
}

/** Substitutes `{question}` placeholders with current answers. */
function resolveUrl(template: string, resolve: (name: string) => unknown): string {
  return template.replaceAll(PLACEHOLDER, (_match, reference: string) => {
    const value = resolve(reference.trim());
    return value === null || value === undefined ? '' : encodeURIComponent(String(value));
  });
}

/** Walks a dotted path into the response. */
function readPath(payload: unknown, path: string): unknown {
  if (path.trim().length === 0) {
    return payload;
  }
  let current = payload;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function toChoices(rows: readonly unknown[], settings: ChoiceSettings): readonly ItemValue[] {
  return rows.map((row) => {
    const item = new ItemValue();
    if (typeof row !== 'object' || row === null) {
      item.value = toPropertyValue(row);
      item.text = String(row ?? '');
      return item;
    }
    const record = row as Record<string, unknown>;
    const value = settings.valueName.length > 0 ? record[settings.valueName] : row;
    const title = settings.titleName.length > 0 ? record[settings.titleName] : value;
    item.value = toPropertyValue(value);
    item.text = title === null || title === undefined ? '' : String(title);
    return item;
  });
}

function choicesFromResponse(
  payload: unknown,
  url: string,
  settings: ChoiceSettings,
): readonly ItemValue[] {
  const rows = readPath(payload, settings.path);
  if (!Array.isArray(rows)) {
    throw new TypeError(`"${url}" did not return an array at path "${settings.path}".`);
  }
  return toChoices(rows, settings);
}

function toPropertyValue(value: unknown): PropertyValue {
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : String(value ?? '');
}

/** `{question}` in a URL is a dependency exactly as it is in an expression. */
function placeholderDependencies(url: string): readonly DependencyPattern[] {
  const seen = new Set<string>();
  const reads: DependencyPattern[] = [];
  for (const match of url.matchAll(PLACEHOLDER)) {
    const reference = match[1];
    if (reference === undefined) {
      continue;
    }
    for (const path of collectReferences(parseExpression(`{${reference}}`).node)) {
      const formatted = formatPath(path);
      if (!seen.has(formatted)) {
        seen.add(formatted);
        reads.push(path);
      }
    }
  }
  return reads;
}
