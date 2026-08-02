import { CheckboxQuestion, RadiogroupQuestion, SelectQuestion } from '@kajay/core';
import type { ReactElement } from 'react';
import { ChoiceInput } from './ChoiceInput.js';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';

function ClearButton({ question }: { readonly question: RadiogroupQuestion }): ReactElement {
  return (
    <button
      className="kajay-question__clear"
      type="button"
      onClick={() => {
        question.clear();
      }}
    >
      Clear
    </button>
  );
}

function SelectAllChoice({ question }: { readonly question: CheckboxQuestion }): ReactElement {
  return (
    <label className="kajay-choice kajay-choice--select-all">
      <input
        type="checkbox"
        checked={question.isAllSelected}
        onChange={() => {
          question.selectAll();
        }}
      />
      <span>{question.selectAllText}</span>
    </label>
  );
}

/**
 * Draws radiogroup and checkbox.
 *
 * One component for both because the difference is entirely in the model — which
 * `select` does, and whether the input is a radio or a checkbox. Selection rules
 * (exclusive `none`, the max-selected limit, select-all) live in core, so this stays a
 * view: it reports a click and re-reads the answer.
 */
export function SelectQuestionRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  // Subscribed so a change made anywhere — logic, a trigger, another question —
  // re-renders the options.
  useSurveyValue(survey, question.name);

  if (!(question instanceof SelectQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const isMultiple = question instanceof CheckboxQuestion;
  const groupName = `kajay-question-${question.name}`;
  const columns = question.colCount > 0 ? question.colCount : 1;

  return (
    <fieldset
      className="kajay-question kajay-question--select"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>

      <div
        className="kajay-choices"
        style={{ gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))` }}
      >
        {question instanceof CheckboxQuestion && question.showSelectAllItem ? (
          <SelectAllChoice question={question} />
        ) : null}

        {question.visibleChoices.map((choice) => (
          <ChoiceInput
            key={String(choice.value)}
            question={question}
            choice={choice}
            groupName={groupName}
            isMultiple={isMultiple}
          />
        ))}
      </div>

      {question instanceof RadiogroupQuestion && question.showClearButton ? (
        <ClearButton question={question} />
      ) : null}
    </fieldset>
  );
}
