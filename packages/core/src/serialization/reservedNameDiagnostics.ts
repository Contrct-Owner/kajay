import { isHostValueName } from '../model/hostValues.js';
import type { Diagnostic } from './Diagnostic.js';

/**
 * Reports an element named into the host-value scope — checklist B12, ADR-0047.
 *
 * At **error** severity, because the name does not merely collide: resolution tests the
 * sigil before it consults the answers, so a question called `$tier` is unreachable
 * from every expression in the survey. Reporting it as a warning would leave an author
 * with a question whose `visibleIf` silently reads someone else's value, which is the
 * hardest kind of defect to trace back to its cause.
 *
 * The authored name is **kept, not rewritten**. A definition round-trips as authored
 * ([ADR-0002](../../../../docs/adr/0002-round-trip-fixed-point.md)), and a parser that
 * quietly renamed an element would break every response already recorded against it.
 */
export function collectReservedNameDiagnostics(
  className: string,
  propertyName: string,
  value: unknown,
  path: string,
): readonly Diagnostic[] {
  if (propertyName !== 'name' || typeof value !== 'string' || !isHostValueName(value)) {
    return [];
  }
  return [
    {
      severity: 'error',
      code: 'reserved-name-sigil',
      message:
        `"${className}" is named ${JSON.stringify(value)}, but "$" is reserved for the ` +
        'host-value scope. Expressions cannot reach an element with this name; rename it.',
      path: `${path}/${propertyName}`,
    },
  ];
}
