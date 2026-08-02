import { SurveyElement } from './SurveyElement.js';
import type { SurveyError } from './SurveyError.js';

/** What came back from evaluating an author's expression. */
export interface ExpressionOutcome {
  readonly value: unknown;
  /**
   * True when the expression could not be evaluated — a parse error, an unknown
   * function. Separate from the value because "the rule is broken" and "the rule says
   * no" call for opposite responses, and `undefined` cannot tell them apart.
   */
  readonly failed: boolean;
}

/** Everything a validator is allowed to look at. */
export interface ValidationContext {
  /** The answer being checked. */
  readonly value: unknown;
  /**
   * Evaluates an expression against the survey's current answers.
   *
   * Passed in rather than reached for, so a validator stays a pure rule over one value
   * and the expression engine never becomes a dependency of the validator itself.
   */
  readonly evaluate: (expression: string) => ExpressionOutcome;
}

/**
 * A rule an answer has to satisfy.
 *
 * Subclasses rather than one class parameterised by type — the opposite of `Trigger` —
 * because here the *behaviour* is what differs. A trigger's kinds differ only in which
 * properties they declare, and what to do with them lives in the logic engine; a
 * validator's whole reason to exist is the check it performs.
 *
 * Empty answers never reach `validate`: whether an answer is required at all is
 * `isRequired`'s question, and a validator that also answered it would give a
 * respondent two messages for one omission.
 */
export abstract class Validator extends SurveyElement {
  /** Author's replacement for the built-in message. Empty means "use the default". */
  get text(): string {
    return this.getStringProperty('text');
  }

  set text(value: string) {
    this.setPropertyValue('text', value);
  }

  /** Reports failure, letting an authored `text` win over the built-in wording. */
  protected fail(defaultText: string): SurveyError {
    const authored = this.text;
    return { kind: this.type, text: authored.length > 0 ? authored : defaultText };
  }

  /** Undefined means the answer passed. */
  abstract validate(context: ValidationContext): SurveyError | undefined;

  /** An optional numeric bound: absent is not the same as zero. */
  protected getBound(name: string): number | undefined {
    return this.hasPropertyValue(name) ? this.getNumberProperty(name) : undefined;
  }
}
