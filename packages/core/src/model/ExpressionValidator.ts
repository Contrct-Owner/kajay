import { isTruthy } from '../expressions/expressionValues.js';
import type { SurveyError } from './SurveyError.js';
import { Validator } from './Validator.js';
import type { ValidationContext } from './Validator.js';

/**
 * An arbitrary condition over the whole survey.
 *
 * The escape hatch for rules that are not about one answer in isolation — an end date
 * after a start date, a total that has to reach a target. Evaluated on demand rather
 * than registered in the dependency graph, because validation asks "is this acceptable
 * *now*", which has no cascade to order.
 *
 * An expression that cannot be evaluated at all is treated as no rule, on the same
 * reasoning as an unparseable pattern in `RegexValidator`: the respondent did not write
 * it and cannot fix it.
 */
export class ExpressionValidator extends Validator {
  override get type(): string {
    return 'expressionvalidator';
  }

  get expression(): string {
    return this.getStringProperty('expression');
  }

  override validate({ evaluate }: ValidationContext): SurveyError | undefined {
    const source = this.expression;
    if (source.length === 0) {
      return undefined;
    }
    const outcome = evaluate(source);
    if (outcome.failed || isTruthy(outcome.value)) {
      return undefined;
    }
    return this.fail('This answer does not meet the required condition.');
  }
}
