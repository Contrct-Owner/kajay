import { toArray } from '../expressions/expressionValues.js';
import type { SurveyError } from './SurveyError.js';
import { Validator } from './Validator.js';
import type { ValidationContext } from './Validator.js';

/** How many options a multi-select answer must carry. */
export class AnswerCountValidator extends Validator {
  override get type(): string {
    return 'answercountvalidator';
  }

  get minCount(): number | undefined {
    return this.getBound('minCount');
  }

  get maxCount(): number | undefined {
    return this.getBound('maxCount');
  }

  override validate({ value }: ValidationContext): SurveyError | undefined {
    // A single answer counts as one, so the same validator reads sensibly on a
    // question that later gains or loses multi-select.
    const count = toArray(value).length;
    const { minCount, maxCount } = this;
    if (minCount !== undefined && count < minCount) {
      return this.fail(`Please select at least ${String(minCount)} options.`);
    }
    if (maxCount !== undefined && count > maxCount) {
      return this.fail(`Please select no more than ${String(maxCount)} options.`);
    }
    return undefined;
  }
}
