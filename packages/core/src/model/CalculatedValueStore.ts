import type { CalculatedValue } from './CalculatedValue.js';

export interface CalculatedWrite {
  readonly changed: boolean;
  readonly previousValue: unknown;
}

/**
 * Results of the survey's calculated values, held apart from its answers.
 *
 * Separate storage is what makes `includeIntoResult` expressible at all: a calculated
 * value is usually an intermediate step in logic, and keeping them in the answer map
 * would put every one of them into the submitted result.
 */
export class CalculatedValueStore {
  readonly #values: Map<string, unknown> = new Map();

  get(name: string): unknown {
    return this.#values.get(name);
  }

  has(name: string): boolean {
    return this.#values.has(name);
  }

  /** Records a result, reporting whether it actually changed and what it replaced. */
  set(name: string, value: unknown): CalculatedWrite {
    const previousValue = this.#values.get(name);
    if (Object.is(previousValue, value)) {
      return { changed: false, previousValue };
    }
    this.#values.set(name, value);
    return { changed: true, previousValue };
  }

  /** The subset that belongs in the survey's answers. */
  toResult(declarations: readonly CalculatedValue[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const declaration of declarations) {
      if (declaration.includeIntoResult && this.#values.has(declaration.name)) {
        result[declaration.name] = this.#values.get(declaration.name);
      }
    }
    return result;
  }
}
