import type { SurveyError } from './SurveyError.js';
import { Validator } from './Validator.js';
import type { ValidationContext } from './Validator.js';

/** Length bounds, and optionally a ban on digits, over the answer read as text. */
export class TextValidator extends Validator {
  override get type(): string {
    return 'textvalidator';
  }

  get minLength(): number | undefined {
    return this.getBound('minLength');
  }

  get maxLength(): number | undefined {
    return this.getBound('maxLength');
  }

  /** Defaults to true: a text answer containing digits is ordinary, not suspect. */
  get allowDigits(): boolean {
    return this.getBooleanProperty('allowDigits');
  }

  override validate({ value }: ValidationContext): SurveyError | undefined {
    const text = String(value);
    const { minLength, maxLength } = this;
    if (minLength !== undefined && text.length < minLength) {
      return this.fail(this.uiText('textMin', minLength));
    }
    if (maxLength !== undefined && text.length > maxLength) {
      return this.fail(this.uiText('textMax', maxLength));
    }
    if (!this.allowDigits && /\d/u.test(text)) {
      return this.fail(this.uiText('textNoDigits'));
    }
    return undefined;
  }
}
