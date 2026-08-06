export type SurveySnapshotScalar = null | boolean | number | string;

export type SurveySnapshotValue =
  | { readonly kind: 'absent' }
  | { readonly kind: 'json'; readonly value: SurveySnapshotScalar }
  | { readonly kind: 'instant'; readonly value: string }
  | { readonly kind: 'array'; readonly value: readonly SurveySnapshotValue[] }
  | { readonly kind: 'object'; readonly value: Readonly<Record<string, SurveySnapshotValue>> };

export function encodeSnapshotValue(value: unknown): SurveySnapshotValue {
  if (value === undefined) return { kind: 'absent' };
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return { kind: 'json', value };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('A Response Snapshot cannot contain a non-finite number.');
    return { kind: 'json', value: Object.is(value, -0) ? 0 : value };
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new TypeError('A Response Snapshot cannot contain an invalid instant.');
    return { kind: 'instant', value: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return { kind: 'array', value: value.map((item) => encodeSnapshotValue(item)) };
  }
  if (typeof value === 'object') {
    return {
      kind: 'object',
      value: Object.fromEntries(Object.entries(value).map(([name, item]) => [name, encodeSnapshotValue(item)])),
    };
  }
  throw new TypeError(`A Response Snapshot cannot contain a ${typeof value} value.`);
}

export function decodeSnapshotValue(value: SurveySnapshotValue): unknown {
  if (typeof value !== 'object' || value === null || typeof value.kind !== 'string') {
    throw new TypeError('A Response Snapshot value must be a tagged object.');
  }
  switch (value.kind) {
    case 'absent': return undefined;
    case 'json': return decodeScalar((value as { readonly value?: unknown }).value);
    case 'instant': return decodeInstant((value as { readonly value?: unknown }).value);
    case 'array': {
      const items = (value as { readonly value?: unknown }).value;
      if (!Array.isArray(items)) {
        throw new TypeError('A tagged array snapshot value must contain an array.');
      }
      return items.map((item) => decodeSnapshotValue(item as SurveySnapshotValue));
    }
    case 'object': {
      const entries = (value as { readonly value?: unknown }).value;
      if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) {
        throw new TypeError('A tagged object snapshot value must contain an object.');
      }
      return Object.fromEntries(
        Object.entries(entries).map(([name, item]) => [
          name,
          decodeSnapshotValue(item as SurveySnapshotValue),
        ]),
      );
    }
  }
  throw new TypeError(
    `Unknown Response Snapshot value kind "${String((value as { readonly kind?: unknown }).kind)}".`,
  );
}

function decodeScalar(scalar: unknown): SurveySnapshotScalar {
  if (
    scalar !== null
    && typeof scalar !== 'boolean'
    && typeof scalar !== 'string'
    && (typeof scalar !== 'number' || !Number.isFinite(scalar))
  ) {
    throw new TypeError('A tagged JSON snapshot value must contain a finite scalar.');
  }
  return Object.is(scalar, -0) ? 0 : scalar as SurveySnapshotScalar;
}

function decodeInstant(encoded: unknown): Date {
  if (typeof encoded !== 'string') {
    throw new TypeError('A tagged instant snapshot value must contain a string.');
  }
  const instant = new Date(encoded);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== encoded) {
    throw new TypeError(`Invalid Response Snapshot instant "${encoded}".`);
  }
  return instant;
}
