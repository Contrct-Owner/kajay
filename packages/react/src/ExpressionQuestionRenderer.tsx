import { ExpressionQuestion } from '@kajay/core';
import type { ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { useSurveyValue } from './useSurveyState.js';
import { questionId } from './questionId.js';

/**
 * A computed value, shown rather than asked.
 *
 * An `output` element, which is exactly what it is for and what a screen reader
 * announces as a result. No input, no required marker, no error slot: nothing the
 * respondent did can make this wrong, so there is nothing to tell them to fix.
 */
export function ExpressionQuestionRenderer({
  survey,
  question,
}: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);

  if (!(question instanceof ExpressionQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const outputId = questionId(question);
  return (
    <div className="kajay-question kajay-question--expression" data-question-name={question.name}>
      <label className="kajay-question__title" htmlFor={outputId}>
        {question.title}
      </label>
      <output id={outputId} className="kajay-question__output">
        {question.displayValue}
      </output>
    </div>
  );
}
