export function shortDigest(value: string | undefined): string {
  return value === undefined ? 'none' : `${value.slice(0, 18)}…`;
}

export function formatTimestamp(value: string | undefined): string {
  if (value === undefined) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
