import { isValidKajayPattern } from '../patterns/KajayPatternSyntax.js';
import type { Diagnostic } from './Diagnostic.js';

/** Reports authored pattern syntax without discarding the authored property. */
export function collectPatternDiagnostics(
  className: string,
  propertyName: string,
  value: unknown,
  path: string,
): readonly Diagnostic[] {
  if (
    className !== 'regexvalidator' ||
    propertyName !== 'regex' ||
    typeof value !== 'string' ||
    isValidKajayPattern(value)
  ) {
    return [];
  }
  return [
    {
      severity: 'error',
      code: 'invalid-pattern',
      message: 'The pattern is not valid Kajay Pattern Profile v1 syntax.',
      path: `${path}/${propertyName}`,
    },
  ];
}
