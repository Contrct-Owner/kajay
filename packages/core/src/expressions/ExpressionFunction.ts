/**
 * Everything a function may read besides its arguments.
 *
 * `now` is here rather than being read from the clock inside `today()` so that time is
 * an explicit input. Date-dependent expressions are then deterministic in tests
 * without fake timers, which is what the parallel-first test policy wants.
 */
export interface ExpressionFunctionContext {
  readonly now: Date;
}

export type ExpressionFunction = (
  args: readonly unknown[],
  context: ExpressionFunctionContext,
) => unknown;

/**
 * A function whose answer arrives later — a lookup, a score, a permission check.
 *
 * A separate type rather than allowing a promise back from the synchronous one, because
 * the two are used differently and confusing them is silent: an expression calling a
 * promise-returning function registered as synchronous would compare a `Promise` object
 * to a number and quietly decide the answer is no.
 */
export type AsyncExpressionFunction = (
  args: readonly unknown[],
  context: ExpressionFunctionContext,
) => Promise<unknown>;
