import { isEmptyValue } from '../expressions/expressionValues.js';
import type { Question } from './Question.js';
import type { SurveyError } from './SurveyError.js';
import type { ExpressionOutcome } from './Validator.js';

/** Evaluates an expression against the survey's current answers. */
export type ExpressionEvaluator = (expression: string) => ExpressionOutcome;

const REQUIRED_KIND = 'required';
const DEFAULT_REQUIRED_TEXT = 'This question requires an answer.';

/**
 * Every reason one question's current answer is unacceptable.
 *
 * Requiredness is checked first and, when it fails, alone: a respondent who has not
 * answered at all does not also need to be told their empty answer is too short. For
 * the same reason the validators themselves never see an empty value.
 *
 * Whether the question is *reachable* is the caller's decision, not this function's.
 * A hidden question must never be checked — an error the respondent cannot see is one
 * they cannot act on — but "hidden" also covers a visible question inside a hidden
 * panel, which is `collectVisibleQuestions`' job to know. A guard here would have been
 * the same rule stated twice and less completely; a mutation test found it never ran.
 */
export function collectAnswerErrors(
  question: Question,
  evaluate: ExpressionEvaluator,
): readonly SurveyError[] {
  const value = question.value;
  if (isEmptyValue(value)) {
    if (!question.isRequired) {
      return [];
    }
    const authored = question.requiredErrorText;
    return [{ kind: REQUIRED_KIND, text: authored.length > 0 ? authored : DEFAULT_REQUIRED_TEXT }];
  }

  // The question's own constraints first: a `min` the author wrote as a property is
  // the same statement as a validator, made earlier, and it reads first for that reason.
  const context = { value, evaluate };
  return [
    ...question.checkValue(context),
    ...question.validators.flatMap((validator) => {
      const error = validator.validate(context);
      return error === undefined ? [] : [error];
    }),
  ];
}

export interface QuestionCheck {
  readonly evaluate: ExpressionEvaluator;
  readonly announce: (question: Question) => void;
  /** Host rules that need no round trip. Returns extra reasons to reject the answer. */
  readonly hostErrors: (question: Question) => readonly SurveyError[];
  /** Errors gathered out of process on a previous pass, merged in by question name. */
  readonly carried?: ReadonlyMap<string, readonly SurveyError[]>;
}

/**
 * Checks a set of questions and records what it found.
 *
 * Every question is checked, not just up to the first failure: a respondent fixing one
 * field at a time and being handed the next objection each round is the worst version
 * of this, and the model has no reason to hide the rest.
 */
export function validateQuestions(
  questions: readonly Question[],
  check: QuestionCheck,
): boolean {
  let isValid = true;
  for (const question of questions) {
    const own = collectAnswerErrors(question, check.evaluate);
    // Host rules only run once the answer has cleared its own validators, on the same
    // reasoning that keeps validators away from an empty answer: one omission, one
    // message.
    const errors = [
      ...own,
      ...(own.length > 0 ? [] : check.hostErrors(question)),
      ...(check.carried?.get(question.name) ?? []),
    ];
    if (question.setErrors(errors)) {
      check.announce(question);
    }
    isValid &&= errors.length === 0;
  }
  return isValid;
}

/** Drops recorded errors without checking anything. */
export function clearQuestionErrors(
  questions: readonly Question[],
  announce: (question: Question) => void,
): void {
  for (const question of questions) {
    if (question.setErrors([])) {
      announce(question);
    }
  }
}
