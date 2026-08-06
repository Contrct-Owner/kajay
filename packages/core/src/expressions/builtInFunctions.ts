import type { ExpressionFunctionContext } from './ExpressionFunction.js';
import { isEmptyValue, isTruthy, toNumber } from './expressionValues.js';
import { FunctionRegistry } from './FunctionRegistry.js';
import { roundNumber } from './roundNumber.js';

const MILLISECONDS_PER_DAY = 86_400_000;

/** Flattens one level so `sum({a}, {b})` and `sum({multiSelect})` both work. */
function numericArguments(args: readonly unknown[]): number[] {
  const numbers: number[] = [];
  for (const argument of args) {
    for (const item of Array.isArray(argument) ? argument : [argument]) {
      const value = toNumber(item);
      if (value !== undefined) {
        numbers.push(value);
      }
    }
  }
  return numbers;
}

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

function atMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function registerLogicFunctions(registry: FunctionRegistry): void {
  registry.override('iif', (args) => (isTruthy(args[0]) ? args[1] : args[2]));

  /** Counts answered items — empty values do not count. */
  registry.override('count', (args) => {
    let total = 0;
    for (const argument of args) {
      for (const item of Array.isArray(argument) ? argument : [argument]) {
        if (!isEmptyValue(item)) {
          total += 1;
        }
      }
    }
    return total;
  });
}

function registerMathFunctions(registry: FunctionRegistry): void {
  registry.override('sum', (args) => numericArguments(args).reduce((total, n) => total + n, 0));

  registry.override('avg', (args) => {
    const numbers = numericArguments(args);
    return numbers.length === 0 ? 0 : numbers.reduce((total, n) => total + n, 0) / numbers.length;
  });

  registry.override('min', (args) => {
    const numbers = numericArguments(args);
    return numbers.length === 0 ? undefined : Math.min(...numbers);
  });

  registry.override('max', (args) => {
    const numbers = numericArguments(args);
    return numbers.length === 0 ? undefined : Math.max(...numbers);
  });

  registry.override('round', (args) => {
    const value = toNumber(args[0]);
    if (value === undefined) {
      return;
    }
    return roundNumber(value, toNumber(args[1]) ?? 0);
  });

  registry.override('abs', (args) => {
    const value = toNumber(args[0]);
    return value === undefined ? undefined : Math.abs(value);
  });
}

function registerDateFunctions(registry: FunctionRegistry): void {
  registry.override(
    'currentDate',
    (_args, context: ExpressionFunctionContext) => new Date(context.now.getTime()),
  );

  /** `today()` is midnight UTC; `today(n)` shifts by whole days. */
  registry.override('today', (args, context: ExpressionFunctionContext) => {
    const base = atMidnight(context.now);
    return new Date(base.getTime() + (toNumber(args[0]) ?? 0) * MILLISECONDS_PER_DAY);
  });

  registry.override('getDate', (args) => toDate(args[0]));

  registry.override('diffDays', (args) => {
    const from = toDate(args[0]);
    const to = toDate(args[1]);
    if (from === undefined || to === undefined) {
      return;
    }
    return Math.round(
      (atMidnight(to).getTime() - atMidnight(from).getTime()) / MILLISECONDS_PER_DAY,
    );
  });

  /** Completed years since a date, by calendar rather than by dividing days. */
  registry.override('age', (args, context: ExpressionFunctionContext) => {
    const birth = toDate(args[0]);
    if (birth === undefined) {
      return;
    }
    const now = context.now;
    const monthDelta = now.getUTCMonth() - birth.getUTCMonth();
    const beforeBirthday =
      monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate());
    return now.getUTCFullYear() - birth.getUTCFullYear() - (beforeBirthday ? 1 : 0);
  });
}

/**
 * The built-in function library.
 *
 * Date functions take `now` from the evaluation context rather than reading the clock,
 * so an expression using `today()` is deterministic under test.
 */
export function registerBuiltInFunctions(registry: FunctionRegistry): void {
  registerLogicFunctions(registry);
  registerMathFunctions(registry);
  registerDateFunctions(registry);
}

/** A registry preloaded with the built-ins. Callers own it; nothing here is global. */
export function createDefaultFunctionRegistry(): FunctionRegistry {
  const registry = new FunctionRegistry();
  registerBuiltInFunctions(registry);
  return registry;
}
