import {
  createDefaultFunctionRegistry,
  createValueResolver,
  evaluateExpression,
  isTruthy,
} from '@kajay/core';
import type { ExpressionCache, MetadataRegistry, SurveyElement } from '@kajay/core';

/**
 * When a property applies, and when it is fixed — checklist L3.
 *
 * The registry declares the condition (`PropertyDescriptor.visibleIf`) and this decides
 * what it means, which is the same split L1 made about `isExpression`: core says what is
 * true of the format, `creator-core` says what an authoring tool does about it.
 *
 * **The language is the survey's own.** `{showOtherItem} = true` is parsed and evaluated by
 * the same tokenizer, parser and evaluator a `visibleIf` on a question goes through — so a
 * host writing a condition for their own property is not learning a second language, and
 * the operators, the functions and the truthiness rules cannot drift from the ones the
 * runtime uses.
 *
 * The **scope is the element's own properties**, not the survey's answers. A property grid
 * is editing a definition, and there are no answers on a design surface at all.
 */

/**
 * The values a property condition is evaluated against.
 *
 * Resolved values rather than authored ones, so a condition on `{displayStyle}` is true of
 * a question that never set it and takes the registered default — which is what a designer
 * sees in the field beside it.
 */
export function propertyScopeOf(
  element: SurveyElement,
  registry: MetadataRegistry,
): Readonly<Record<string, unknown>> {
  const scope: Record<string, unknown> = {};
  for (const descriptor of registry.getProperties(element.type)) {
    scope[descriptor.name] = element.getResolvedProperty(descriptor.name) ?? descriptor.defaultValue;
  }
  return scope;
}

/**
 * Whether a condition is satisfied, or **`undefined` when it could not be decided**.
 *
 * Three answers rather than two, and the third is the point. No condition at all, one that
 * will not parse, and one that fails to evaluate are all "no answer" — and the *safe*
 * direction differs by caller: an undecidable `visibleIf` must show the property and an
 * undecidable `readOnlyIf` must leave it editable, so both point the same way and neither
 * would get it from a bare boolean. Folding them together is how a typo in somebody's
 * registration makes a property unreachable with nothing on screen to say why.
 */
export function conditionOutcome(
  condition: string,
  scope: Readonly<Record<string, unknown>>,
  cache: ExpressionCache,
): boolean | undefined {
  if (condition.length === 0) {
    return undefined;
  }
  const parsed = cache.parse(condition);
  if (parsed.errors.length > 0) {
    return undefined;
  }
  const outcome = evaluateExpression(parsed.node, {
    getValue: createValueResolver(scope),
    functions: FUNCTIONS,
    now: new Date(),
  });
  return outcome.errors.length > 0 ? undefined : isTruthy(outcome.value);
}

/**
 * The expression functions a property condition may call.
 *
 * The built-in set rather than the survey's own. A condition is a fact about the *format*
 * that ships with the registry, so it can only reasonably use what ships with the
 * language — and a host's `isServed(...)`, which needs a fetch and a survey to run against,
 * has no meaning while nobody is answering anything.
 */
const FUNCTIONS = createDefaultFunctionRegistry();

