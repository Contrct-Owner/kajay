import type { ParseExpressionResult } from './parseExpression.js';
import { parseExpression } from './parseExpression.js';

/**
 * Memoises parses by source text.
 *
 * ADR-0002 stores expression source verbatim and parses lazily, so the same string is
 * asked for repeatedly as logic re-evaluates. The cache is an owned instance rather
 * than a module-level map: process-global mutable state would make the suite
 * order-dependent, which the test policy forbids.
 */
export class ExpressionCache {
  readonly #entries: Map<string, ParseExpressionResult> = new Map();

  parse(source: string): ParseExpressionResult {
    const cached = this.#entries.get(source);
    if (cached !== undefined) {
      return cached;
    }
    const parsed = parseExpression(source);
    this.#entries.set(source, parsed);
    return parsed;
  }

  clear(): void {
    this.#entries.clear();
  }

  get size(): number {
    return this.#entries.size;
  }
}
