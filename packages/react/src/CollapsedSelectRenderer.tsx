import { MultiSelectQuestion, SelectQuestion } from '@kajay/core';
import type { ChangeEvent, ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';

function currentSelection(question: SelectQuestion): string | string[] {
  return question instanceof MultiSelectQuestion
    ? question.selectedValues.map(String)
    : String(question.value ?? '');
}

function applySelection(question: SelectQuestion, target: HTMLSelectElement): void {
  const selected = [...target.selectedOptions].flatMap((option) => {
    const choice = question.visibleChoices.find(
      (candidate) => String(candidate.value) === option.value,
    );
    return choice === undefined ? [] : [choice.value];
  });
  question.applySelection(selected);
}

/**
 * Draws dropdown and tagbox as native `<select>` elements.
 *
 * Native deliberately. A searchable combobox is a roving-focus ARIA widget, and
 * building one here would put a large amount of interaction behaviour into an adapter
 * the guidelines require to stay a thin view — while `<select>` is keyboard-operable and
 * screen-reader-correct for free. Filtering already lives on the model
 * (`filterChoices`), so a richer combobox in Phase 2's accessibility pass replaces the
 * markup without touching the semantics.
 */
export function CollapsedSelectRenderer({
  survey,
  question,
}: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);

  if (!(question instanceof SelectQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const isMultiple = question instanceof MultiSelectQuestion;
  const inputId = `kajay-question-${question.name}`;
  const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    applySelection(question, event.target);
  };

  return (
    <div className="kajay-question" data-question-name={question.name}>
      <label className="kajay-question__title" htmlFor={inputId}>
        <QuestionTitleContent question={question} />
      </label>
      <select
        id={inputId}
        className="kajay-question__select"
        multiple={isMultiple}
        disabled={!question.isEnabled}
        required={question.isRequired}
        aria-required={question.isRequired}
        value={currentSelection(question)}
        onChange={handleChange}
      >
        {isMultiple ? null : <option value="">{question.placeholder}</option>}
        {question.visibleChoices.map((choice) => (
          <option key={String(choice.value)} value={String(choice.value)}>
            {choice.text}
          </option>
        ))}
      </select>
    </div>
  );
}
