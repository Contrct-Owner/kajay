import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn's own helper, verbatim — every generated component imports it. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
