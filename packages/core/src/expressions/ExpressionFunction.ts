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
