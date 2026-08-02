import { TextQuestion } from '@kajay/core';
import type { ChangeEvent, ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';

export function TextQuestionRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  const value = useSurveyValue(survey, question.name);
  const inputId = `kajay-question-${question.name}`;
  const errorId = `${inputId}-errors`;

  const isTextQuestion = question instanceof TextQuestion;
  const inputType = isTextQuestion ? question.inputType : 'text';
  const placeholder = isTextQuestion ? question.placeholder : '';

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    survey.setValue(question.name, event.target.value);
  };

  return (
    <div className="kajay-question" data-question-name={question.name}>
      <label className="kajay-question__title" htmlFor={inputId}>
        <QuestionTitleContent question={question} />
      </label>
      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />
      <input
        id={inputId}
        className="kajay-question__input"
        type={inputType}
        placeholder={placeholder}
        disabled={!question.isEnabled}
        required={question.isRequired}
        aria-required={question.isRequired}
        aria-invalid={question.hasErrors || undefined}
        aria-describedby={question.hasErrors ? errorId : undefined}
        // Not `typeof value === 'string'`: logic writes numbers and booleans too — a
        // setValueExpression of `0` or a runexpression trigger's result — and those
        // rendered as an empty field.
        value={value === null || value === undefined ? '' : String(value)}
        onChange={handleChange}
      />
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </div>
  );
}
