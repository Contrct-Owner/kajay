import type { Question, Survey as SurveyModel } from '@kajay/core';
import type { ReactElement, ReactNode } from 'react';
import { QuestionErrors } from './QuestionErrors.js';
import { questionErrorId } from './questionId.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { readOnlyGroup } from './readOnly.js';

export interface MatrixFrameProps {
  readonly survey: SurveyModel;
  readonly question: Question;
  readonly className: string;
  readonly children: ReactNode;
}

/**
 * Everything around a matrix that is the same whichever kind it is.
 *
 * The legend, the error slots and the group semantics are identical for a single-select
 * matrix, a table of cells and a table of respondent-added rows — three renderers that
 * had begun to differ from each other in small ways no reader would ever reconcile.
 *
 * Only what the matrix earned *as a whole* is drawn here: a message reported against a
 * row or a cell belongs beside it, and drawing it in both places would say everything
 * twice.
 */
export function MatrixFrame({
  survey,
  question,
  className,
  children,
}: MatrixFrameProps): ReactElement {
  const errorId = questionErrorId(question);
  const own = question.errors.filter((error) => error.path === undefined);

  return (
    <fieldset
      className={`kajay-question ${className}`}
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
      {...readOnlyGroup(question.isReadOnly)}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>

      <QuestionErrors survey={survey} question={question} at="top" id={errorId} errors={own} />
      {children}
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} errors={own} />
    </fieldset>
  );
}
