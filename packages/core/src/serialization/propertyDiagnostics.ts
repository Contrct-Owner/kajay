import type { HostValues } from '../model/hostValues.js';
import type { Diagnostic } from './Diagnostic.js';
import { collectHostValueDiagnostics } from './hostValueDiagnostics.js';
import { collectPatternDiagnostics } from './patternDiagnostics.js';
import { collectReservedNameDiagnostics } from './reservedNameDiagnostics.js';

/** One authored property, as the reader has it in hand. */
export interface PropertyDiagnosticContext {
  readonly className: string;
  readonly propertyName: string;
  readonly value: unknown;
  /** JSON Pointer to the element, without the property. */
  readonly path: string;
  readonly values: HostValues;
  readonly isExpression: boolean;
}

/**
 * Everything worth reporting about one property, as it is read.
 *
 * The rules are separate files because they are separate judgements — a malformed
 * pattern, a name in a reserved scope, an expression naming a value nobody supplied —
 * and this is the one place that knows all three run at the same moment. Composing them
 * here rather than in `parseSurvey` keeps the reader about *reading*: adding a fourth
 * rule is a line in this file instead of another branch in the property loop.
 */
export function collectPropertyDiagnostics(
  context: PropertyDiagnosticContext,
): readonly Diagnostic[] {
  const { className, propertyName, value, path, values, isExpression } = context;
  return [
    ...collectPatternDiagnostics(className, propertyName, value, path),
    ...collectReservedNameDiagnostics(className, propertyName, value, path),
    ...collectHostValueDiagnostics(className, propertyName, value, path, values, isExpression),
  ];
}
