import { KajayPattern } from './KajayPattern.js';

/** Validates the portable, bounded Kajay Pattern Profile v1 grammar. */
export function isValidKajayPattern(source: string): boolean {
  return KajayPattern.compile(source) !== undefined;
}
