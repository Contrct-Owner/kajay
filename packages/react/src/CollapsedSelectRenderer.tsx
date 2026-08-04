import { MultiSelectQuestion, SelectQuestion } from '@kajay/core';
import type { ItemValue } from '@kajay/core';
import type { ReactElement } from 'react';
import { ChoiceFilterField } from './ChoiceFilterField.js';
import { MoreChoices } from './MoreChoices.js';
import { readOnlyControl } from './readOnly.js';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';
import { questionId } from './questionId.js';
import { useIdScope } from './idScope.js';

function currentSelection(question: SelectQuestion): string | string[] {
  return question instanceof MultiSelectQuestion
    ? question.selectedValues.map(String)
    : String(question.value ?? '');
}

interface ChoiceOptionsProps {
  readonly question: SelectQuestion;
  readonly inputId: string;
  readonly errorId: string;
}

/** The list itself. Its own component so the renderer around it stays readable. */
function ChoiceOptions({ question, inputId, errorId }: ChoiceOptionsProps): ReactElement {
  const isMultiple = question instanceof MultiSelectQuestion;
  return (
    <select
      id={inputId}
      className="kajay-question__select"
      multiple={isMultiple}
      disabled={!question.isEnabled}
      required={question.isRequired}
      aria-required={question.isRequired}
      aria-invalid={question.hasErrors || undefined}
      aria-describedby={question.hasErrors ? errorId : undefined}
      value={currentSelection(question)}
      onChange={(event) => {
        applySelection(question, event.target);
      }}
      {...readOnlyControl(question.isReadOnly)}
    >
      {isMultiple || question.isReadOnly ? null : (
        <option value="">{question.placeholder}</option>
      )}
      {/* Read-only offers only what was chosen. A native `<select>` has no readonly
          state to set, and a list with one entry is genuinely unchangeable rather than
          merely refusing — while staying focusable and announced, which `disabled`
          would not. */}
      {optionsFor(question).map((choice) => (
        <option key={String(choice.value)} value={String(choice.value)}>
          {choice.text}
        </option>
      ))}
    </select>
  );
}

/** Every choice while answering; only the chosen ones while reading. */
function optionsFor(question: SelectQuestion): readonly ItemValue[] {
  if (!question.isReadOnly) {
    return question.visibleChoices;
  }
  return question.visibleChoices.filter((choice) => question.isSelected(choice.value));
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
 *
 * A **paged** question gets two more controls around that list: a search field, because
 * the browser's type-ahead can only reach options that have arrived, and a control to
 * fetch the rest. Both read and drive the model and hold no list of their own.
 */
export function CollapsedSelectRenderer({
  survey,
  question,
}: QuestionRendererProps): ReactElement {
  const scope = useIdScope();
  useSurveyValue(survey, question.name);

  if (!(question instanceof SelectQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const inputId = questionId(question, scope);
  const errorId = `${inputId}-errors`;

  return (
    <div className="kajay-question" data-question-name={question.name}>
      <label className="kajay-question__title" htmlFor={inputId}>
        <QuestionTitleContent question={question} />
      </label>
      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />
      {question.isPaged ? <ChoiceFilterField question={question} id={`${inputId}-filter`} /> : null}
      <ChoiceOptions question={question} inputId={inputId} errorId={errorId} />
      <MoreChoices question={question} />
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </div>
  );
}
