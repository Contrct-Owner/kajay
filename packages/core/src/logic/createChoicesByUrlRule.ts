import type { DependencyPattern } from '../dependencies/DependencyPattern.js';
import { collectReferences } from '../expressions/collectReferences.js';
import { formatPath } from '../expressions/ExpressionNode.js';
import { parseExpression } from '../expressions/parseExpression.js';
import type { ItemValue } from '../model/ItemValue.js';
import { choiceListsMatch } from '../model/ItemValue.js';
import type { LogicRule } from './LogicRule.js';

/**
 * Fetches JSON for a URL.
 *
 * Injected rather than implemented here because `@kajay/core` is DOM-free and carries
 * no runtime dependencies — it cannot reference `fetch`. That constraint is a feature:
 * the engine stays backend-agnostic, and a test supplies a fixture instead of a
 * network, which the test policy requires anyway.
 */
export type ChoiceFetcher = (url: string) => Promise<unknown>;

export interface ChoicesByUrlSettings {
  readonly url: string;
  /** Dotted path to the array inside the response. Empty means the response itself. */
  readonly path: string;
  readonly valueName: string;
  readonly titleName: string;
}

export interface ChoicesByUrlSource {
  readonly fetchJson: ChoiceFetcher | undefined;
  /** Resolves a `{question}` placeholder against current answers. */
  readonly resolvePlaceholder: (name: string) => unknown;
  readonly createChoice: (value: unknown, text: unknown) => ItemValue;
  readonly installProvider: (provider: () => readonly ItemValue[]) => void;
  readonly clearProvider: () => void;
  readonly announce: () => void;
  readonly reportError: (message: string) => void;
  /** Per-survey, so two surveys never share a response and tests stay isolated. */
  readonly cache: Map<string, readonly ItemValue[]>;
}

const PLACEHOLDER = /\{([^{}]+)\}/gu;

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

function toChoices(rows: readonly unknown[], source: ChoicesByUrlSource, settings: ChoicesByUrlSettings): readonly ItemValue[] {
  return rows.map((row) => {
    if (typeof row !== 'object' || row === null) {
      // A bare array of scalars is a legitimate response shape.
      return source.createChoice(row, row);
    }
    const record = row as Record<string, unknown>;
    const value = settings.valueName.length > 0 ? record[settings.valueName] : row;
    const title = settings.titleName.length > 0 ? record[settings.titleName] : value;
    return source.createChoice(value, title);
  });
}

/**
 * Loads a question's choices from a URL.
 *
 * The URL's `{question}` placeholders are declared as graph dependencies, so changing
 * an answer the URL interpolates re-runs this rule and re-fetches — the same mechanism
 * every other piece of logic uses, rather than a bespoke watcher.
 *
 * Loading is asynchronous and therefore lands *after* the settle that started it. The
 * cache is checked synchronously first, so a repeat of a URL already seen applies
 * within the transaction and never re-renders.
 */
export function createChoicesByUrlRule(
  key: string,
  settings: ChoicesByUrlSettings,
  source: ChoicesByUrlSource,
): LogicRule {
  let loaded: readonly ItemValue[] | undefined;

  const apply = (choices: readonly ItemValue[]): void => {
    if (loaded !== undefined && choiceListsMatch(loaded, choices)) {
      // A cached response identical to what is already shown must not re-render.
      return;
    }
    loaded = choices;
    source.installProvider(() => loaded ?? []);
    source.announce();
  };

  return {
    key,
    reads: placeholderDependencies(settings.url),
    run: () => {
      const url = resolveUrl(settings.url, source.resolvePlaceholder);
      if (url.trim().length === 0) {
        source.clearProvider();
        loaded = undefined;
        source.announce();
        return;
      }

      const cached = source.cache.get(url);
      if (cached !== undefined) {
        apply(cached);
        return;
      }

      load(url, settings, source, apply);
    },
  };
}

/** Fetches and applies, reporting rather than throwing on every failure path. */
function load(
  url: string,
  settings: ChoicesByUrlSettings,
  source: ChoicesByUrlSource,
  apply: (choices: readonly ItemValue[]) => void,
): void {
  const fetchJson = source.fetchJson;
  if (fetchJson === undefined) {
    source.reportError(
      `No choice fetcher is configured, so "${url}" cannot be loaded. Pass one as the survey's fetchJson option.`,
    );
    return;
  }

  void fetchJson(url).then(
    (payload) => {
      const rows = readPath(payload, settings.path);
      if (!Array.isArray(rows)) {
        source.reportError(`"${url}" did not return an array at path "${settings.path}".`);
        return;
      }
      const choices = toChoices(rows, source, settings);
      source.cache.set(url, choices);
      apply(choices);
    },
    (error: unknown) => {
      source.reportError(`Loading "${url}" failed: ${String(error)}`);
    },
  );
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
