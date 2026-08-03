import { isEmptyValue } from '../expressions/expressionValues.js';

/**
 * Answers that are one object stored under a single question name.
 *
 * A multipletext's fields and a matrix's rows are the same shape: several answers under
 * one name, reached from an expression as `{workplace.city}` because the value is a real
 * object rather than a flattened prefix. The arithmetic of writing one entry is shared
 * here so both types collapse to nothing at the same moment and for the same reason.
 */

/** The stored object, or an empty one for anything that is not a plain record. */
export function asAnswerRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * The answer after one entry is written, with empty entries dropped.
 *
 * An object with nothing left in it becomes `undefined` rather than `{}`, which matters
 * twice: `{}` is not empty by any test the engine applies, so a question-level
 * `isRequired` would be satisfied by an object full of blanks, and `data` would carry a
 * key for a question nobody answered.
 */
export function withAnswerEntry(
  value: unknown,
  key: string,
  entry: unknown,
): Record<string, unknown> | undefined {
  const next = { ...asAnswerRecord(value), [key]: entry };
  const filled = Object.entries(next).filter(([, held]) => !isEmptyValue(held));
  return filled.length > 0 ? Object.fromEntries(filled) : undefined;
}
