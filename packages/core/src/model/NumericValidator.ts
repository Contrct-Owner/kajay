import { toNumber } from '../expressions/expressionValues.js';
import type { SurveyError } from './SurveyError.js';
import { Validator } from './Validator.js';
import type { ValidationContext } from './Validator.js';

/**
 * A range on the answer read as a number.
 *
 * `toNumber` rather than `typeof value === 'number'`: a text input hands back `"42"`,
 * and a range that only worked on questions storing real numbers would silently pass
 * every string it was pointed at.
 */
export class NumericValidator extends Validator {
  override get type(): string {
    return 'numericvalidator';
  }

  get minValue(): number | undefined {
    return this.getBound('minValue');
  }

  get maxValue(): number | undefined {
    return this.getBound('maxValue');
  }

  override validate({ value }: ValidationContext): SurveyError | undefined {
    const numeric = toNumber(value);
    if (numeric === undefined) {
      return this.fail('Please enter a number.');
    }
    const { minValue, maxValue } = this;
    if (minValue !== undefined && numeric < minValue) {
      return this.fail(`Please enter a value no less than ${String(minValue)}.`);
    }
    if (maxValue !== undefined && numeric > maxValue) {
      return this.fail(`Please enter a value no greater than ${String(maxValue)}.`);
    }
    return undefined;
  }
}
