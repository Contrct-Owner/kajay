/**
 * Value semantics shared by the evaluator and the function library.
 *
 * These rules are the language's behaviour, so they live in one place and are covered
 * by table-driven tests rather than being re-derived at each call site.
 */

/** Empty means: absent, the empty string, or an empty collection. */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

/** Truthiness for `and`, `or`, `not` and `iif`. An empty collection is falsy. */
export function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Boolean(value);
}

/** Dates compare and arithmetise as their epoch milliseconds. */
export function normalizeValue(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;

/** A finite number, or undefined when the value is not numeric. */
export function toNumber(value: unknown): number | undefined {
  const normalized = normalizeValue(value);
  if (typeof normalized === 'number') {
    return Number.isFinite(normalized) ? normalized : undefined;
  }
  if (typeof normalized === 'string') {
    const text = normalized.trim();
    if (!DECIMAL_NUMBER.test(text)) {
      return undefined;
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** Invariant scalar text, or undefined for arrays, objects, and unsupported values. */
export function toText(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
  }
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : undefined;
    case 'string':
      return value;
    default:
      return undefined;
  }
}

/**
 * Equality.
 *
 * Absent values are equal to each other; numeric operands compare numerically even
 * when one arrived as a string (form values usually do); everything else compares as
 * text. Arrays compare element-wise.
 */
export function valuesAreEqual(left: unknown, right: unknown): boolean {
  const aAbsent = left === null || left === undefined;
  const bAbsent = right === null || right === undefined;
  if (aAbsent || bAbsent) {
    return aAbsent && bAbsent;
  }

  if (left instanceof Date || right instanceof Date) {
    return (
      left instanceof Date &&
      right instanceof Date &&
      left.getTime() === right.getTime()
    );
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => valuesAreEqual(item, right[index]));
  }

  if (typeof left === 'number' && typeof right === 'string') {
    return toNumber(right) === left;
  }
  if (typeof left === 'string' && typeof right === 'number') {
    return toNumber(left) === right;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (typeof left !== 'object' || typeof right !== 'object') {
    return left === right;
  }

  const leftRecord = left as Readonly<Record<string, unknown>>;
  const rightRecord = right as Readonly<Record<string, unknown>>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(
    (key) => Object.hasOwn(rightRecord, key) && valuesAreEqual(leftRecord[key], rightRecord[key]),
  );
}

/** Ordering for `<`, `<=`, `>`, `>=`. Numeric when both sides are; text otherwise. */
export function compareValues(left: unknown, right: unknown): number | undefined {
  const numericLeft = toNumber(left);
  const numericRight = toNumber(right);
  if (numericLeft !== undefined && numericRight !== undefined) {
    return Math.sign(numericLeft - numericRight);
  }

  const a = normalizeValue(left);
  const b = normalizeValue(right);
  if (a === null || a === undefined || b === null || b === undefined) {
    return undefined;
  }
  const textLeft = String(a);
  const textRight = String(b);
  if (textLeft === textRight) {
    return 0;
  }
  return textLeft < textRight ? -1 : 1;
}

/** Wraps a scalar so `anyof`/`allof`/`contains` treat one value as a set of one. */
export function toArray(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === null || value === undefined ? [] : [value];
}
