import type {
  Question,
  QuestionErrorLocation,
  Survey as SurveyModel,
  SurveyError,
} from '@kajay/core';
import type { ReactElement } from 'react';

export interface QuestionErrorsProps {
  readonly survey: SurveyModel;
  readonly question: Question;
  /** Where this slot sits. It draws only when the survey asks for errors here. */
  readonly at: QuestionErrorLocation;
  readonly id: string;
  /**
   * Which errors this slot owns. Every one of the question's by default.
   *
   * A composite question splits them: what a matrix reported against a row belongs
   * beside that row, and only what it reported against the question as a whole belongs
   * here. Without the split the row messages would appear twice.
   */
  readonly errors?: readonly SurveyError[];
}

/**
 * One question's validation errors, drawn where the survey says they go.
 *
 * A renderer places a slot above *and* below its input and lets this decide, rather
 * than branching on the location itself. Exactly one slot ever draws, which is why both
 * can carry the same `id` — the input's `aria-describedby` points at one element
 * wherever the author moved it.
 *
 * `role="alert"` because an error appearing after a failed Next is exactly the case the
 * role exists for: the respondent's attention is on the button, not on the field.
 */
export function QuestionErrors({
  survey,
  question,
  at,
  id,
  errors,
}: QuestionErrorsProps): ReactElement | null {
  const shown = errors ?? question.errors;
  if (survey.validation.errorLocation !== at || shown.length === 0) {
    return null;
  }
  return (
    <div className="kajay-question__errors" id={id} role="alert">
      {shown.map((error) => (
        <p key={`${error.kind}:${error.text}`} className="kajay-question__error">
          {error.text}
        </p>
      ))}
    </div>
  );
}
