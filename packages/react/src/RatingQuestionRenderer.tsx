import { RatingQuestion } from '@kajay/core';
import type { ChangeEvent, ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { readOnlyControl, whenEditable } from './readOnly.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';
import { questionErrorId, questionId } from './questionId.js';
import { useSurveyComponents } from './SurveyComponents.js';
import { useIdScope } from './idScope.js';

const SMILEYS = ['😖', '🙁', '😐', '🙂', '😄'];

interface RatingProps {
  readonly survey: QuestionRendererProps['survey'];
  readonly question: RatingQuestion;
}

/**
 * What one step shows on top of its radio.
 *
 * Stars and smileys are decoration over the same control: the *label* changes, the
 * control does not. `aria-hidden` on the glyph, with the step's own text beside it, is
 * what keeps a five-star scale announcing "3" rather than "star star star".
 */
function StepGlyph({
  question,
  position,
}: {
  readonly question: RatingQuestion;
  readonly position: number;
}): ReactElement | null {
  if (question.rateType === 'stars') {
    return <span aria-hidden="true">{question.selectedPosition >= position ? '★' : '☆'}</span>;
  }
  if (question.rateType === 'smileys') {
    // Spread across however many steps there are, so a 1–3 scale still runs sad to
    // happy rather than stopping in the middle of the range.
    const index = Math.round(
      ((position - 1) / Math.max(1, question.rateValues.length - 1)) * (SMILEYS.length - 1),
    );
    return <span aria-hidden="true">{SMILEYS[index]}</span>;
  }
  return null;
}

/**
 * The scale laid out in full.
 *
 * A group of real radios. The input is moved out of sight rather than replaced, so it
 * keeps its keyboard behaviour, its focus ring and its place in the accessibility tree
 * — a respondent arrows through the scale exactly as they would through any radio
 * group, and the visible label is what the pointer lands on.
 */
function RatingButtons({ question }: { readonly question: RatingQuestion }): ReactElement {
  const scope = useIdScope();
  const { Radio } = useSurveyComponents();
  const groupName = questionId(question, scope);
  return (
    <div className="kajay-rating" data-rate-type={question.rateType}>
      {question.rateValues.map((step, index) => (
        <label key={String(step.value)} className="kajay-rating__step">
          <Radio
            className="kajay-rating__input"
            name={groupName}
            value={String(step.value)}
            checked={question.isSelected(step.value)}
            disabled={!question.isEnabled}
            // `onClick`, not only `onChange`: picking the step already chosen is how a
            // respondent takes an answer back, and a radio fires no change for that.
            reselect
            onCheckedChange={whenEditable(question.isReadOnly, () => {
              question.select(step.value);
            })}
          />
          <span className="kajay-rating__label">
            <StepGlyph question={question} position={index + 1} />
            {/* Always rendered, and hidden by CSS behind a glyph rather than dropped:
                it is the option's accessible name, so a five-star scale announces "3"
                instead of leaving the radio nameless. */}
            <span className="kajay-rating__value">{step.text}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** What the ends of the scale mean. Absent unless the author said. */
function RateDescriptions({ question }: { readonly question: RatingQuestion }): ReactElement | null {
  const { minRateDescription, maxRateDescription } = question;
  if (minRateDescription.length === 0 && maxRateDescription.length === 0) {
    return null;
  }
  return (
    <p className="kajay-rating__descriptions">
      <span>{minRateDescription}</span>
      <span>{maxRateDescription}</span>
    </p>
  );
}

/**
 * The collapsed form.
 *
 * A `div` with a `label`, not a fieldset with a legend: one `select` is a control, not
 * a group, and wrapping it in a group would leave the select itself nameless — a
 * legend names the fieldset and nothing inside it.
 */
function RatingDropdown({ survey, question }: RatingProps): ReactElement {
  const scope = useIdScope();
  const inputId = questionId(question, scope);
  const errorId = `${inputId}-errors`;

  const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const step = question.rateValues.find(
      (candidate) => String(candidate.value) === event.target.value,
    );
    question.value = step?.value;
  };

  return (
    <div className="kajay-question kajay-question--rating" data-question-name={question.name}>
      <label className="kajay-question__title" htmlFor={inputId}>
        <QuestionTitleContent question={question} />
      </label>
      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />
      <select
        id={inputId}
        className="kajay-question__select"
        disabled={!question.isEnabled}
        required={question.isRequired}
        aria-required={question.isRequired}
        aria-invalid={question.hasErrors || undefined}
        aria-describedby={question.hasErrors ? errorId : undefined}
        value={String(question.value ?? '')}
        onChange={handleChange}
        {...readOnlyControl(question.isReadOnly)}
      >
        {/* Reading: only the chosen step is on offer, so there is nothing to change. */}
        {question.isReadOnly ? null : <option value="">{question.uiText('chooseRating')}</option>}
        {question.rateValues
          .filter((step) => !question.isReadOnly || question.isSelected(step.value))
          .map((step) => (
          <option key={String(step.value)} value={String(step.value)}>
            {step.text}
          </option>
        ))}
      </select>
      <RateDescriptions question={question} />
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </div>
  );
}

function RatingGroup({ survey, question }: RatingProps): ReactElement {
  const scope = useIdScope();
  const errorId = questionErrorId(question, scope);
  return (
    <fieldset
      className="kajay-question kajay-question--rating"
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
      <RatingButtons question={question} />
      <RateDescriptions question={question} />
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </fieldset>
  );
}

export function RatingQuestionRenderer({
  survey,
  question,
}: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);

  if (!(question instanceof RatingQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }
  return question.effectiveDisplayMode === 'dropdown' ? (
    <RatingDropdown survey={survey} question={question} />
  ) : (
    <RatingGroup survey={survey} question={question} />
  );
}
