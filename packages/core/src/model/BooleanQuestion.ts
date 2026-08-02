import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { Question } from './Question.js';

/** Whether the control reads as a switch or as a pair of radio buttons. */
export type BooleanRenderMode = 'switch' | 'radio';

/**
 * A yes/no answer.
 *
 * Three states, not two: `true`, `false`, and *not yet answered*. Collapsing the third
 * into `false` is the classic way to make a required checkbox unanswerable and a
 * consent question dishonest — "did not agree" and "was never asked" are different
 * facts, and only the model can keep them apart.
 *
 * What gets *stored* is `valueTrue`/`valueFalse`, which default to the booleans but can
 * be anything the host's backend expects. The mapping lives here so a renderer only
 * ever deals in "checked or not".
 */
export class BooleanQuestion extends Question {
  override get type(): string {
    return 'boolean';
  }

  get labelTrue(): string {
    return this.getStringProperty('labelTrue');
  }

  get labelFalse(): string {
    return this.getStringProperty('labelFalse');
  }

  /** The value stored for yes. Defaults to the boolean `true`. */
  get valueTrue(): PropertyValue {
    return this.getResolvedProperty('valueTrue') ?? true;
  }

  get valueFalse(): PropertyValue {
    return this.getResolvedProperty('valueFalse') ?? false;
  }

  get renderAs(): BooleanRenderMode {
    return this.getStringProperty('renderAs') === 'radio' ? 'radio' : 'switch';
  }

  /**
   * The answer as a plain boolean, or undefined while it is unanswered.
   *
   * `valuesAreEqual` rather than `===`: a restored `data` payload may carry `"true"`
   * where the definition said `true`, and a survey that forgot the respondent's answer
   * because it came back from JSON as a string would be a poor kind of resume.
   */
  get checkedValue(): boolean | undefined {
    const value = this.value;
    if (value === null || value === undefined) {
      return undefined;
    }
    if (valuesAreEqual(value, this.valueTrue)) {
      return true;
    }
    return valuesAreEqual(value, this.valueFalse) ? false : undefined;
  }

  /** Records an answer, or clears it when given undefined. */
  setChecked(isChecked: boolean | undefined): void {
    if (isChecked === undefined) {
      this.value = undefined;
      return;
    }
    this.value = isChecked ? this.valueTrue : this.valueFalse;
  }

  /** The label for whichever state the answer is in. Empty while unanswered. */
  get displayText(): string {
    const checked = this.checkedValue;
    if (checked === undefined) {
      return '';
    }
    return checked ? this.labelTrue : this.labelFalse;
  }
}
