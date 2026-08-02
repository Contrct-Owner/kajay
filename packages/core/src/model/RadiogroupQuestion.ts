import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { SelectQuestion } from './SelectQuestion.js';

/** Single-select. The answer is the chosen value itself, not a list of one. */
export class RadiogroupQuestion extends SelectQuestion {
  override get type(): string {
    return 'radiogroup';
  }

  get showClearButton(): boolean {
    return this.getBooleanProperty('showClearButton');
  }

  override isSelected(choiceValue: PropertyValue): boolean {
    return valuesAreEqual(this.value, choiceValue);
  }

  /** Picking the current answer again clears it, which is how radio groups behave. */
  override select(choiceValue: PropertyValue): void {
    this.value = this.isSelected(choiceValue) ? undefined : choiceValue;
  }

  clear(): void {
    this.value = undefined;
  }
}
