import type { ExpressionFunction } from './ExpressionFunction.js';

/**
 * Named functions available to expressions.
 *
 * Names are case-insensitive, matching the operator keywords. Instances are
 * independent so a test can build its own rather than mutating a shared one.
 */
export class FunctionRegistry {
  readonly #functions: Map<string, ExpressionFunction> = new Map();

  register(name: string, implementation: ExpressionFunction): void {
    const key = name.toLowerCase();
    if (this.#functions.has(key)) {
      throw new Error(`Expression function "${name}" is already registered.`);
    }
    this.#functions.set(key, implementation);
  }

  /** Replaces an existing registration, or adds one if absent. */
  override(name: string, implementation: ExpressionFunction): void {
    this.#functions.set(name.toLowerCase(), implementation);
  }

  /** Removes a registration. Test teardown depends on this. */
  unregister(name: string): void {
    this.#functions.delete(name.toLowerCase());
  }

  get(name: string): ExpressionFunction | undefined {
    return this.#functions.get(name.toLowerCase());
  }

  has(name: string): boolean {
    return this.#functions.has(name.toLowerCase());
  }

  getNames(): readonly string[] {
    return Array.from(this.#functions.keys()).toSorted();
  }

  clone(): FunctionRegistry {
    const copy = new FunctionRegistry();
    for (const [name, implementation] of this.#functions) {
      copy.override(name, implementation);
    }
    return copy;
  }
}
