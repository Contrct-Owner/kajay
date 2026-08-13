/**
 * What a value's JSON type is called in a diagnostic.
 *
 * `typeof` alone calls `null` an object and an array an object, and a message telling an
 * author their array is an object is a message they cannot act on.
 */
export function describeType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  return Array.isArray(value) ? 'array' : typeof value;
}

/** True for a JSON object: not null, not an array. */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
