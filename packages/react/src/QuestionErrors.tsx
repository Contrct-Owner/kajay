import type { Question, QuestionErrorLocation, Survey as SurveyModel } from '@kajay/core';
import type { ReactElement } from 'react';

export interface QuestionErrorsProps {
  readonly survey: SurveyModel;
  readonly question: Question;
  /** Where this slot sits. It draws only when the survey asks for errors here. */
  readonly at: QuestionErrorLocation;
  readonly id: string;
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
}: QuestionErrorsProps): ReactElement | null {
  if (survey.validation.errorLocation !== at || !question.hasErrors) {
    return null;
  }
  return (
    <div className="kajay-question__errors" id={id} role="alert">
      {question.errors.map((error) => (
        <p key={`${error.kind}:${error.text}`} className="kajay-question__error">
          {error.text}
        </p>
      ))}
    </div>
  );
}
