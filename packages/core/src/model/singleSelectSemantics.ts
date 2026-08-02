import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';

/**
 * What picking means when exactly one choice can be the answer.
 *
 * Free functions rather than only a base class, because one type needs these semantics
 * without being able to inherit them: an imagepicker's arity is a *property*, so it
 * cannot pick a base class at design time the way a radiogroup can. Stating the rules
 * once is what stops the two implementations drifting — which they would, quietly,
 * the first time "picking the current answer again clears it" was revisited.
 */
export function isOneSelected(current: unknown, choiceValue: PropertyValue): boolean {
  return valuesAreEqual(current, choiceValue);
}

/** The next answer after a click. Picking the current answer again clears it. */
export function selectOne(current: unknown, choiceValue: PropertyValue): PropertyValue | undefined {
  return isOneSelected(current, choiceValue) ? undefined : choiceValue;
}
