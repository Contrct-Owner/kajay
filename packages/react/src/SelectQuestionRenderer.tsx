import { CheckboxQuestion, RadiogroupQuestion, SelectQuestion } from '@kajay/core';
import type { ReactElement } from 'react';
import { ChoiceInput } from './ChoiceInput.js';
import { readOnlyRadioGroup } from './readOnly.js';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';
import { questionId } from './questionId.js';
import { useSurveyComponents } from './SurveyComponents.js';

function ClearButton({ question }: { readonly question: RadiogroupQuestion }): ReactElement {
  const { Button } = useSurveyComponents();
  return (
    <Button
      className="kajay-question__clear"
      type="button"
      onClick={() => {
        question.clear();
      }}
    >
      Clear
    </Button>
  );
}

function SelectAllChoice({ question }: { readonly question: CheckboxQuestion }): ReactElement {
  const { Checkbox } = useSurveyComponents();
  return (
    <label className="kajay-choice kajay-choice--select-all">
      <Checkbox
        checked={question.isAllSelected}
        onCheckedChange={() => {
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
  const isMultiple = question instanceof CheckboxQuestion;

  return (
    <fieldset
      className="kajay-question kajay-question--select"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
      aria-invalid={question.hasErrors || undefined}
      aria-describedby={question.hasErrors ? errorId : undefined}
      // A single-select group *is* a radio group, and saying so is both more accurate
      // and what makes `aria-readonly` legal — the helper supplies the role with it. A
      // multi-select group is a plain `group`, where ARIA has no read-only state at
      // all, so each checkbox says it instead.
      {...(isMultiple ? {} : readOnlyRadioGroup(question.isReadOnly))}
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
