import { Question } from './Question.js';
import type { SurveyError } from './SurveyError.js';
import type { ValidationContext } from './Validator.js';

/**
 * A long, free-text answer.
 *
 * Separate from `text` rather than an `inputType` of it, because the difference is not
 * cosmetic: a textarea has a height, grows, and carries a length budget the respondent
 * needs to see. Folding that into `text` would put four properties on every date and
 * colour field that will never use them.
 */
export class CommentQuestion extends Question {
  override get type(): string {
    return 'comment';
  }

  get placeholder(): string {
    return this.getStringProperty('placeholder');
  }

  set placeholder(value: string) {
    this.setPropertyValue('placeholder', value);
  }

  /** Visible height, in lines. */
  get rows(): number {
    return this.getNumberProperty('rows');
  }

  /** Whether the field grows to fit what has been typed rather than scrolling. */
  get autoGrow(): boolean {
    return this.getBooleanProperty('autoGrow');
  }

  /** Whether the respondent may drag the field taller. */
  get allowResize(): boolean {
    return this.getBooleanProperty('allowResize');
  }

  /** Length budget. Zero means none, which is also what hides the counter. */
  get maxLength(): number {
    return this.getNumberProperty('maxLength');
  }

  /** How many characters are still available, or undefined when there is no budget. */
  get remainingCharacters(): number | undefined {
    const budget = this.maxLength;
    if (budget <= 0) {
      return undefined;
    }
    return Math.max(0, budget - String(this.value ?? '').length);
  }

  /**
   * The length budget, enforced rather than merely displayed.
   *
   * A `maxlength` attribute stops a respondent typing past the limit, but it does not
   * stop a trigger, a `setValueExpression` or a restored `data` payload from putting a
   * longer value there — and an over-long answer that no check objects to is one the
   * host discovers at submit time.
   */
  override checkValue({ value }: ValidationContext): readonly SurveyError[] {
    const budget = this.maxLength;
    const length = String(value ?? '').length;
    if (budget <= 0 || length <= budget) {
      return [];
    }
    return [
      {
        kind: 'maxLength',
        text: `Please shorten this to ${String(budget)} characters or fewer.`,
      },
    ];
  }
}
