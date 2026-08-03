import { CheckboxQuestion, RadiogroupQuestion, SelectQuestion } from '@kajay/core';
import type { ReactElement } from 'react';
import { ChoiceInput } from './ChoiceInput.js';
import { readOnlyGroup } from './readOnly.js';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';
import { questionId } from './questionId.js';

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

interface ChoiceGridProps {
  readonly question: SelectQuestion;
  readonly groupName: string;
  readonly columns: number;
}

/** The options themselves, laid out in `colCount` columns. */
function ChoiceGrid({ question, groupName, columns }: ChoiceGridProps): ReactElement {
  const isMultiple = question instanceof CheckboxQuestion;
  return (
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

  const groupName = questionId(question);
  const errorId = `${groupName}-errors`;
  const columns = question.colCount > 0 ? question.colCount : 1;

  return (
    <fieldset
      className="kajay-question kajay-question--select"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
      aria-invalid={question.hasErrors || undefined}
      aria-describedby={question.hasErrors ? errorId : undefined}
      {...readOnlyGroup(question.isReadOnly)}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>

      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />

      <ChoiceGrid question={question} groupName={groupName} columns={columns} />

      {question instanceof RadiogroupQuestion && question.showClearButton ? (
        <ClearButton question={question} />
      ) : null}

      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </fieldset>
  );
}
