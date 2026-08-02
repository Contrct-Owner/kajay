import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { NONE_VALUE, SelectQuestion } from './SelectQuestion.js';

/** Select questions answered by any number of choices. The answer is an array. */
export abstract class MultiSelectQuestion extends SelectQuestion {
  get showSelectAllItem(): boolean {
    return this.getBooleanProperty('showSelectAllItem');
  }

  get selectAllText(): string {
    return this.getStringProperty('selectAllText');
  }

  /** 0 means no limit. */
  get maxSelectedChoices(): number {
    return this.getNumberProperty('maxSelectedChoices');
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
      this.applySelection(this.isSelected(NONE_VALUE) ? [] : [NONE_VALUE]);
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
    this.applySelection(next);
  }

  /**
   * Applies a complete selection while preserving the same invariants as one click.
   *
   * Native multi-select adapters report the whole selected set. If `none` was newly
   * selected it wins; selecting an ordinary choice while `none` was already active
   * clears `none`. Limits are enforced here so every adapter records the same answer.
   */
  override applySelection(choiceValues: readonly PropertyValue[]): void {
    const unique = choiceValues.filter(
      (value, index) =>
        choiceValues.findIndex((candidate) => valuesAreEqual(candidate, value)) === index,
    );
    const wantsNone = unique.some((value) => valuesAreEqual(value, NONE_VALUE));
    const hadNone = this.isSelected(NONE_VALUE);
    if (wantsNone && (!hadNone || unique.length === 1)) {
      this.value = [NONE_VALUE];
      return;
    }

    const ordinary = unique.filter((value) => !valuesAreEqual(value, NONE_VALUE));
    const max = this.maxSelectedChoices;
    this.value = max > 0 ? ordinary.slice(0, max) : ordinary;
  }

  /** Selects every visible choice, or clears them if all are already selected. */
  selectAll(): void {
    this.applySelection(this.isAllSelected ? [] : this.#selectableValues());
  }

  /** Ordinary choices only: `none` and `other` are not part of "all". */
  #selectableValues(): readonly PropertyValue[] {
    return this.choices.filter((choice) => choice.isVisible).map((choice) => choice.value);
  }
}
