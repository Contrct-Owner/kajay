import { collectReferences } from '../expressions/collectReferences.js';
import { parseExpression } from '../expressions/parseExpression.js';
import { declaresHostValue, isHostValueName } from '../model/hostValues.js';
import type { HostValues } from '../model/hostValues.js';
import type { Diagnostic } from './Diagnostic.js';

/**
 * Reports `{$name}` references the host did not supply — checklist B12, ADR-0047.
 *
 * At **warning** severity, where the endpoint scope's equivalent is an error, and the
 * difference is not an inconsistency. An endpoint absent at parse time dooms the fetch
 * that needs it, so nothing is lost by refusing. A host value may legitimately arrive
 * after parsing — a quote computed once the respondent has answered enough to ask for
 * one — so error severity would fail definitions that are correct.
 *
 * Read from the **AST rather than by scanning text**, so `{$tier}` inside a string
 * literal is not mistaken for a reference and a reference the parser could not read is
 * not reported twice. An expression that does not parse yields no references, which is
 * right: its own error is the diagnostic worth having, and a second complaint about
 * names inside it would bury the first.
 */
export function collectHostValueDiagnostics(
  className: string,
  propertyName: string,
  value: unknown,
  path: string,
  values: HostValues,
  isExpression: boolean,
): readonly Diagnostic[] {
  if (!isExpression || typeof value !== 'string' || value.length === 0) {
    return [];
  }
  const undeclared = collectReferences(parseExpression(value).node)
    .map(([first]) => (first?.kind === 'name' ? first.name : ''))
    .filter((name) => isHostValueName(name) && !declaresHostValue(name, values));

  return [...new Set(undeclared)].map((name) => ({
    severity: 'warning' as const,
    code: 'undeclared-host-value' as const,
    message:
      `"${propertyName}" on "${className}" reads ${JSON.stringify(name)}, which no ` +
      'host value supplies. Pass it as the values option, or set it before the ' +
      'expression is evaluated.',
    path: `${path}/${propertyName}`,
  }));
}
