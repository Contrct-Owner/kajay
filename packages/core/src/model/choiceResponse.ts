import type { DependencyPattern } from '../dependencies/DependencyPattern.js';
import { collectReferences } from '../expressions/collectReferences.js';
import { formatPath } from '../expressions/ExpressionNode.js';
import { parseExpression } from '../expressions/parseExpression.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import type { Endpoints } from './endpoints.js';
import { isEndpointName, resolveEndpoint } from './endpoints.js';

import { interpolate, placeholderNames } from './interpolate.js';
import { ItemValue } from './ItemValue.js';

/** How a URL response is turned into choices. Part of the cache identity. */
export interface ChoiceSettings {
  /** Dotted path to the array inside the response. Empty means the response itself. */
  readonly path: string;
  readonly valueName: string;
  readonly titleName: string;
}

/**
 * Identity of a converted response.
 *
 * The conversion settings belong in the key, not just the URL: two questions reading
 * one URL with different `choicesValueName` produce different choices, and keying on
 * the URL alone served each of them the other's list.
 */
export function createCacheKey(url: string, settings: ChoiceSettings): string {
  return JSON.stringify([url, settings.path, settings.valueName, settings.titleName]);
}

/**
 * Substitutes `{question}` placeholders with current answers, encoded for a URL.
 *
 * Shares the substitution with the completed page and differs only in the encoding,
 * which is the part that depends on where the value lands: percent-encoding here,
 * HTML escaping there. Neither is optional — an unencoded answer in a URL is a broken
 * request, and an unescaped one in markup is an injection.
 */
export function resolveUrl(
  template: string,
  resolve: (name: string) => unknown,
  endpoints: Endpoints = {},
): string {
  return interpolate(template, (name) => {
    const endpoint = resolveEndpoint(name, endpoints);
    if (endpoint !== undefined) {
      return endpoint;
    }
    const value = resolve(name);
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

function toPropertyValue(value: unknown): PropertyValue {
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : String(value ?? '');
}

function toChoices(rows: readonly unknown[], settings: ChoiceSettings): readonly ItemValue[] {
  return rows.map((row) => {
    const item = new ItemValue();
    if (typeof row !== 'object' || row === null) {
      // A bare array of scalars is a legitimate response shape.
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

/** Throws rather than reporting: the caller owns error capture for the whole load. */
export function choicesFromResponse(
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

/**
 * `{question}` in a URL is a dependency exactly as it is in an expression.
 *
 * `{@name}` is not. An endpoint is constant for the session, so registering a
 * dependency on it would add a graph node waiting for an answer nobody will ever
 * supply — which is precisely the failure ADR-0017 wrote this filter down to prevent.
 */
export function placeholderDependencies(url: string): readonly DependencyPattern[] {
  const seen = new Set<string>();
  const reads: DependencyPattern[] = [];
  for (const reference of placeholderNames(url).filter((name) => !isEndpointName(name))) {
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
