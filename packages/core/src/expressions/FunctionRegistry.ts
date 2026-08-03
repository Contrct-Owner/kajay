import type { AsyncExpressionFunction, ExpressionFunction } from './ExpressionFunction.js';

/**
 * Named functions available to expressions.
 *
 * Names are case-insensitive, matching the operator keywords. Instances are
 * independent so a test can build its own rather than mutating a shared one.
 */
export class FunctionRegistry {
  readonly #functions: Map<string, ExpressionFunction> = new Map();
  readonly #asyncFunctions: Map<string, AsyncExpressionFunction> = new Map();

  register(name: string, implementation: ExpressionFunction): void {
    const key = name.toLowerCase();
    if (this.has(name)) {
      throw new Error(`Expression function "${name}" is already registered.`);
    }
    this.#functions.set(key, implementation);
  }

  /** Replaces an existing registration, or adds one if absent. */
  override(name: string, implementation: ExpressionFunction): void {
    this.#functions.set(name.toLowerCase(), implementation);
  }

  /**
   * Registers a function whose answer arrives later.
   *
   * The name shares one namespace with the synchronous functions, because an expression
   * writes `isServed(...)` either way and having two registries would let one name mean
   * two things depending on which was asked first.
   */
  registerAsync(name: string, implementation: AsyncExpressionFunction): void {
    const key = name.toLowerCase();
    if (this.has(name)) {
      throw new Error(`Expression function "${name}" is already registered.`);
    }
    this.#asyncFunctions.set(key, implementation);
  }

  getAsync(name: string): AsyncExpressionFunction | undefined {
    return this.#asyncFunctions.get(name.toLowerCase());
  }

  isAsync(name: string): boolean {
    return this.#asyncFunctions.has(name.toLowerCase());
  }

  /** Removes a registration. Test teardown depends on this. */
  unregister(name: string): void {
    this.#functions.delete(name.toLowerCase());
    this.#asyncFunctions.delete(name.toLowerCase());
  }

  get(name: string): ExpressionFunction | undefined {
    return this.#functions.get(name.toLowerCase());
  }

  has(name: string): boolean {
    return this.#functions.has(name.toLowerCase()) || this.isAsync(name);
  }

  getNames(): readonly string[] {
    return [...this.#functions.keys(), ...this.#asyncFunctions.keys()].toSorted();
  }

  clone(): FunctionRegistry {
    const copy = new FunctionRegistry();
    for (const [name, implementation] of this.#functions) {
      copy.override(name, implementation);
    }
    for (const [name, implementation] of this.#asyncFunctions) {
      copy.registerAsync(name, implementation);
    }
    return copy;
  }
}
