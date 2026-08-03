import type { SurveyError } from './SurveyError.js';
import { Validator } from './Validator.js';
import type { ValidationContext } from './Validator.js';

/**
 * A pattern the answer has to match.
 *
 * An unparseable pattern is treated as *no rule* rather than as a failure. The
 * respondent did not write it and cannot fix it, so blocking them on it turns an
 * author's typo into a dead end. That the pattern was rejected is not swallowed:
 * `hasInvalidPattern` says so, and it is what a test asserts on.
 */
export class RegexValidator extends Validator {
  #compiled: RegExp | undefined;
  #compiledFrom: string | undefined;

  override get type(): string {
    return 'regexvalidator';
  }

  get regex(): string {
    return this.getStringProperty('regex');
  }

  /** True once a non-empty pattern has been tried and rejected by the engine. */
  get hasInvalidPattern(): boolean {
    return this.regex.length > 0 && this.#pattern() === undefined;
  }

  override validate({ value }: ValidationContext): SurveyError | undefined {
    const pattern = this.#pattern();
    if (pattern === undefined || pattern.test(String(value))) {
      return undefined;
    }
    return this.fail(this.uiText('regexInvalid'));
  }

  /** Compiled on demand and cached against its source, so an edit recompiles. */
  #pattern(): RegExp | undefined {
    const source = this.regex;
    if (source !== this.#compiledFrom) {
      this.#compiledFrom = source;
      try {
        this.#compiled = new RegExp(source, 'u');
      } catch {
        this.#compiled = undefined;
      }
    }
    return this.#compiled;
  }
}
