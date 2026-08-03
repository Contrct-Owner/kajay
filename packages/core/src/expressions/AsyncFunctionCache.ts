import type { AsyncExpressionFunction } from './ExpressionFunction.js';
import type { FunctionRegistry } from './FunctionRegistry.js';

export interface AsyncFunctionCacheOptions {
  /** Read each time rather than held: a host may install its registry after parsing. */
  readonly functions: () => FunctionRegistry;
  readonly now: () => Date;
  /** Called when a result lands, so whatever asked for it can be evaluated again. */
  readonly onSettled: () => void;
}

/**
 * Results of asynchronous expression functions, and the requests still in flight.
 *
 * **The evaluator cannot await.** An expression is evaluated inside a dependency
 * transaction, and a transaction that stopped half way to wait for a network call would
 * leave every rule after it unevaluated and the model part-way through a cascade — the
 * one state ADR-0004 exists to make unobservable. So an asynchronous call is evaluated
 * the way anything else unknown is: it yields `undefined` this time round, the work
 * starts, and the rules that asked run again when the answer arrives.
 *
 * Which makes the cache load-bearing rather than an optimisation. Without it, the
 * re-evaluation would start the call again, and again, for ever.
 */
export class AsyncFunctionCache {
  readonly #options: AsyncFunctionCacheOptions;
  readonly #results: Map<string, unknown> = new Map();
  readonly #failures: Map<string, string> = new Map();
  readonly #pending: Set<string> = new Set();

  constructor(options: AsyncFunctionCacheOptions) {
    this.#options = options;
  }

  /**
   * The result if it has arrived, starting the work if it has not.
   *
   * Keyed on the name *and the arguments*, so `postcodeIsServed('SW1')` and
   * `postcodeIsServed('EH1')` are two questions rather than one answer overwriting the
   * other — and so the second time an expression asks the same thing, nothing leaves
   * the process.
   */
  request(
    name: string,
    args: readonly unknown[],
    report: (message: string) => void,
  ): unknown {
    const key = JSON.stringify([name.toLowerCase(), args]);
    const failure = this.#failures.get(key);
    if (failure !== undefined) {
      // Reported at the call site's own span, on the evaluation that asked: a rejected
      // lookup is a broken rule, and the author needs to know which one.
      report(failure);
      return undefined;
    }
    if (this.#results.has(key)) {
      return this.#results.get(key);
    }
    if (!this.#pending.has(key)) {
      this.#start(name, args, key);
    }
    return undefined;
  }

  #start(name: string, args: readonly unknown[], key: string): void {
    const implementation = this.#options.functions().getAsync(name);
    if (implementation === undefined) {
      return;
    }
    this.#pending.add(key);
    void run(implementation, args, this.#options.now()).then((outcome) => {
      this.#pending.delete(key);
      if (outcome.failure === undefined) {
        this.#results.set(key, outcome.value);
      } else {
        this.#failures.set(key, `${JSON.stringify(name)} failed: ${outcome.failure}`);
      }
      this.#options.onSettled();
    });
  }
}

/**
 * Runs one call, turning every way it can go wrong into a value.
 *
 * Nothing here may reject. An unhandled rejection in a survey's logic is a browser
 * console message at best and a dead Node process at worst, and either way the rules
 * that asked for the value would wait for ever.
 */
async function run(
  implementation: AsyncExpressionFunction,
  args: readonly unknown[],
  now: Date,
): Promise<{ value?: unknown; failure?: string }> {
  try {
    return { value: await implementation(args, { now }) };
  } catch (cause) {
    return { failure: cause instanceof Error ? cause.message : String(cause) };
  }
}
