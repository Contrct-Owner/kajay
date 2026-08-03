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

/** A finite number, or undefined when the value is not numeric. */
export function toNumber(value: unknown): number | undefined {
  const normalized = normalizeValue(value);
  if (typeof normalized === 'number') {
    return Number.isFinite(normalized) ? normalized : undefined;
  }
  if (typeof normalized === 'boolean') {
    return normalized ? 1 : 0;
  }
  if (typeof normalized === 'string' && normalized.trim().length > 0) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Equality.
 *
 * Absent values are equal to each other; numeric operands compare numerically even
 * when one arrived as a string (form values usually do); everything else compares as
 * text. Arrays compare element-wise.
 */
export function valuesAreEqual(left: unknown, right: unknown): boolean {
  const a = normalizeValue(left);
  const b = normalizeValue(right);

  const aAbsent = a === null || a === undefined;
  const bAbsent = b === null || b === undefined;
  if (aAbsent || bAbsent) {
    return aAbsent && bAbsent;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => valuesAreEqual(item, b[index]));
  }

  const numericLeft = toNumber(a);
  const numericRight = toNumber(b);
  if (numericLeft !== undefined && numericRight !== undefined) {
    return numericLeft === numericRight;
  }
  return String(a) === String(b);
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
