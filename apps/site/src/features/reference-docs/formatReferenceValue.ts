export function formatReferenceValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  return JSON.stringify(value);
}
