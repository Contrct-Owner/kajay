import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { SelectQuestion } from './SelectQuestion.js';
import { isOneSelected, selectOne } from './singleSelectSemantics.js';

/**
 * Select questions answered by one choice.
 *
 * Selection semantics belong to arity rather than to widget: a radiogroup and a
 * dropdown differ in how they look, not in what picking means.
 */
export abstract class SingleSelectQuestion extends SelectQuestion {
  override isSelected(choiceValue: PropertyValue): boolean {
    return isOneSelected(this.value, choiceValue);
  }

  override select(choiceValue: PropertyValue): void {
    this.value = selectOne(this.value, choiceValue);
  }

  override applySelection(choiceValues: readonly PropertyValue[]): void {
    this.value = choiceValues[0];
  }

  clear(): void {
    this.value = undefined;
  }
}
