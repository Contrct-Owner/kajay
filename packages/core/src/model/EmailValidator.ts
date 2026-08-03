import type { SurveyError } from './SurveyError.js';
import { Validator } from './Validator.js';
import type { ValidationContext } from './Validator.js';

/**
 * Shape check for an email address.
 *
 * Deliberately loose. The only authority on whether an address exists is the server
 * that accepts mail for it, so the useful job here is catching the typo — a missing
 * `@`, a trailing space — without rejecting the many addresses that are legal and
 * strange.
 */
export class EmailValidator extends Validator {
  override get type(): string {
    return 'emailvalidator';
  }

  override validate({ value }: ValidationContext): SurveyError | undefined {
    const text = String(value).trim();
    const isShaped = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text);
    return isShaped ? undefined : this.fail(this.uiText('emailInvalid'));
  }
}
