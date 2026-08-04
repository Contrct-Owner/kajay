import { TextQuestion } from '@kajay/core';
import type { Question } from '@kajay/core';
import type { ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useQuestionValue } from './useSurveyState.js';
import { questionId } from './questionId.js';
import { useSurveyComponents } from './SurveyComponents.js';

/**
 * The bounds and granularity the browser also understands.
 *
 * Handed straight to the input as attributes so a date picker offers the right range
 * and a number field steps correctly. They are not the *check* — the form is
 * `noValidate` and the engine owns the message — they are the affordance.
 */
function boundAttributes(question: Question): Record<string, string | number> {
  if (!(question instanceof TextQuestion)) {
    return {};
  }
  const { min, max, step } = question;
  return {
    ...(min === undefined ? {} : { min: String(min) }),
    ...(max === undefined ? {} : { max: String(max) }),
    ...(step > 0 ? { step } : {}),
  };
}

export function TextQuestionRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  const { Input } = useSurveyComponents();
  const value = useQuestionValue(survey, question);
  const inputId = questionId(question);
  const errorId = `${inputId}-errors`;

  const isTextQuestion = question instanceof TextQuestion;
  const inputType = isTextQuestion ? question.inputType : 'text';
  const placeholder = isTextQuestion ? question.placeholder : '';

  const handleChange = (next: string): void => {
    // Through the model, not `survey.setValue`: a `number` input reports a string like
    // every other input, and which type reaches `data` must not depend on the adapter.
    if (isTextQuestion) {
      question.setInputValue(next);
      return;
    }
    // Through the question for the same reason a cell reads through it: its answer may
    // live inside another question's.
    question.value = next;
  };

  return (
    <div className="kajay-question" data-question-name={question.name}>
      <label className="kajay-question__title" htmlFor={inputId}>
        <QuestionTitleContent question={question} />
      </label>
      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />
      <Input
        id={inputId}
        className="kajay-question__input"
        type={inputType}
        // Native, because this is the control HTML defines it for: the value stays
        // selectable, focusable and announced, and only editing is refused.
        readOnly={question.isReadOnly}
        placeholder={placeholder}
        disabled={!question.isEnabled}
        required={question.isRequired}
        aria-required={question.isRequired}
        aria-invalid={question.hasErrors || undefined}
        aria-describedby={question.hasErrors ? errorId : undefined}
        {...boundAttributes(question)}
        // Not `typeof value === 'string'`: logic writes numbers and booleans too — a
        // setValueExpression of `0` or a runexpression trigger's result — and those
        // rendered as an empty field.
        value={value === null || value === undefined ? '' : String(value)}
        onValueChange={handleChange}
      />
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </div>
  );
}
