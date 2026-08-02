import { BooleanQuestion } from '@kajay/core';
import type { ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';

interface ModeProps {
  readonly question: BooleanQuestion;
  readonly inputId: string;
}

/**
 * The switch form: one checkbox.
 *
 * A real `<input type="checkbox">` under the styling, so it is reachable by keyboard,
 * announced as a checkbox, and toggled by space — none of which a `div` with a click
 * handler gets for free, and all of which a respondent using a screen reader needs.
 *
 * `indeterminate` would be the honest visual for "not yet answered", but it is not a
 * value a checkbox can be *set to* by a respondent — so unanswered renders unchecked
 * and the model, not the control, remembers the difference.
 *
 * Labelled with `labelTrue` in both states, because the box's own checked-ness already
 * says which way it is set and a label that changed as you toggled it would rename the
 * control mid-interaction. A question whose two states need different wording is a
 * question that wants the radio form, which is why both exist.
 */
function SwitchInput({ question, inputId }: ModeProps): ReactElement {
  return (
    <label className="kajay-boolean">
      <input
        id={inputId}
        className="kajay-boolean__switch"
        type="checkbox"
        checked={question.checkedValue === true}
        disabled={!question.isEnabled}
        onChange={(event) => {
          question.setChecked(event.target.checked);
        }}
      />
      <span className="kajay-boolean__label">{question.labelTrue}</span>
    </label>
  );
}

/** The radio form: two options, and the unanswered state is simply neither of them. */
function RadioInputs({ question, inputId }: ModeProps): ReactElement {
  return (
    <div className="kajay-choices kajay-boolean__options">
      {[true, false].map((isTrue) => (
        <label key={String(isTrue)} className="kajay-choice">
          <input
            type="radio"
            name={inputId}
            checked={question.checkedValue === isTrue}
            disabled={!question.isEnabled}
            onChange={() => {
              question.setChecked(isTrue);
            }}
          />
          <span>{isTrue ? question.labelTrue : question.labelFalse}</span>
        </label>
      ))}
    </div>
  );
}

export function BooleanQuestionRenderer({
  survey,
  question,
}: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);

  if (!(question instanceof BooleanQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const inputId = `kajay-question-${question.name}`;
  const errorId = `${inputId}-errors`;
  const isRadio = question.renderAs === 'radio';

  // A fieldset in both forms. The radio form is a group by definition; the switch form
  // is a group of one, and using the same wrapper keeps `enableIf` freezing the subtree
  // through `disabled` rather than through two different mechanisms.
  return (
    <fieldset
      className="kajay-question kajay-question--boolean"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
      aria-invalid={question.hasErrors || undefined}
      aria-describedby={question.hasErrors ? errorId : undefined}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>
      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />
      {isRadio ? (
        <RadioInputs question={question} inputId={inputId} />
      ) : (
        <SwitchInput question={question} inputId={inputId} />
      )}
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </fieldset>
  );
}
