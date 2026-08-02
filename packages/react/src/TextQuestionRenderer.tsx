import { TextQuestion } from '@kajay/core';
import type { ChangeEvent, ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { useSurveyValue } from './useSurveyState.js';

export function TextQuestionRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  const value = useSurveyValue(survey, question.name);
  const inputId = `kajay-question-${question.name}`;
  const errorId = `${inputId}-description`;

  const isTextQuestion = question instanceof TextQuestion;
  const inputType = isTextQuestion ? question.inputType : 'text';
  const placeholder = isTextQuestion ? question.placeholder : '';

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    survey.setValue(question.name, event.target.value);
  };

  return (
    <div className="kajay-question" data-question-name={question.name}>
      <label className="kajay-question__title" htmlFor={inputId}>
        {question.title}
        {question.isRequired ? (
          <span className="kajay-question__required" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>
      <input
        id={inputId}
        className="kajay-question__input"
        type={inputType}
        placeholder={placeholder}
        disabled={!question.isEnabled}
        required={question.isRequired}
        aria-required={question.isRequired}
        aria-describedby={placeholder.length > 0 ? errorId : undefined}
        value={typeof value === 'string' ? value : ''}
        onChange={handleChange}
      />
    </div>
  );
}
