import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { SelectQuestion } from './SelectQuestion.js';

/**
 * Select questions answered by one choice.
 *
 * Selection semantics belong to arity rather than to widget: a radiogroup and a
 * dropdown differ in how they look, not in what picking means.
 */
export abstract class SingleSelectQuestion extends SelectQuestion {
  override isSelected(choiceValue: PropertyValue): boolean {
    return valuesAreEqual(this.value, choiceValue);
  }

  /** Picking the current answer again clears it. */
  override select(choiceValue: PropertyValue): void {
    this.value = this.isSelected(choiceValue) ? undefined : choiceValue;
  }

  override applySelection(choiceValues: readonly PropertyValue[]): void {
    this.value = choiceValues[0];
  }

  clear(): void {
    this.value = undefined;
  }
}
