import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { NONE_VALUE, SelectQuestion } from './SelectQuestion.js';

/** Select questions answered by any number of choices. The answer is an array. */
export abstract class MultiSelectQuestion extends SelectQuestion {
  get showSelectAllItem(): boolean {
    return this.getBooleanProperty('showSelectAllItem');
  }

  get selectAllText(): string {
    const text = this.getStringProperty('selectAllText');
    return text.length > 0 ? text : 'Select all';
  }

  /** 0 means no limit. */
  get maxSelectedChoices(): number {
    const max = this.getPropertyValue('maxSelectedChoices');
    return typeof max === 'number' ? max : 0;
  }

  get selectedValues(): readonly PropertyValue[] {
    return Array.isArray(this.value) ? (this.value as PropertyValue[]) : [];
  }

  override isSelected(choiceValue: PropertyValue): boolean {
    return this.selectedValues.some((selected) => valuesAreEqual(selected, choiceValue));
  }

  get isAllSelected(): boolean {
    const selectable = this.#selectableValues();
    return selectable.length > 0 && selectable.every((value) => this.isSelected(value));
  }

  /**
   * Toggles one choice.
   *
   * `none` is exclusive in both directions: choosing it clears everything else, and
   * choosing anything else clears it. A "none of the above" that could coexist with a
   * selection would make the answer meaningless.
   */
  override select(choiceValue: PropertyValue): void {
    if (valuesAreEqual(choiceValue, NONE_VALUE)) {
      this.value = this.isSelected(NONE_VALUE) ? [] : [NONE_VALUE];
      return;
    }

    const next = this.selectedValues.filter(
      (selected) => !valuesAreEqual(selected, NONE_VALUE) && !valuesAreEqual(selected, choiceValue),
    );

    if (!this.isSelected(choiceValue)) {
      const max = this.maxSelectedChoices;
      if (max > 0 && next.length >= max) {
        // Silently refusing beats replacing an earlier answer the respondent chose.
        return;
      }
      next.push(choiceValue);
    }
    this.value = next;
  }

  /** Selects every visible choice, or clears them if all are already selected. */
  selectAll(): void {
    this.value = this.isAllSelected ? [] : [...this.#selectableValues()];
  }

  /** Ordinary choices only: `none` and `other` are not part of "all". */
  #selectableValues(): readonly PropertyValue[] {
    return this.choices.filter((choice) => choice.isVisible).map((choice) => choice.value);
  }
}
