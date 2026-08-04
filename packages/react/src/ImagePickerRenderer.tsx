import { ImagePickerQuestion } from '@kajay/core';
import type { ItemValue } from '@kajay/core';
import type { CSSProperties, ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { readOnlyRadioGroup, whenEditable } from './readOnly.js';
import { useSurveyValue } from './useSurveyState.js';
import { questionId } from './questionId.js';
import { useSurveyComponents } from './SurveyComponents.js';

function tileStyle(question: ImagePickerQuestion): CSSProperties {
  return {
    objectFit: question.imageFit,
    ...(question.imageWidth > 0 ? { width: question.imageWidth } : {}),
    ...(question.imageHeight > 0 ? { height: question.imageHeight } : {}),
  };
}

/**
 * The picture for one choice, or nothing when it has none.
 *
 * `alt=""` throughout: the choice's text is right there as the control's label, and an
 * image repeating it would have a screen reader say the same thing twice. A choice with
 * no picture — `none`, `other`, or one the author simply left bare — renders as a text
 * tile rather than a broken image.
 */
function ChoiceMedia({
  question,
  choice,
}: {
  readonly question: ImagePickerQuestion;
  readonly choice: ItemValue;
}): ReactElement | null {
  if (choice.imageLink.length === 0) {
    return null;
  }
  if (question.contentMode === 'video') {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption -- captions belong to the
      // author's own asset; §J revisits media accessibility.
      <video className="kajay-imagepicker__media" src={choice.imageLink} style={tileStyle(question)} />
    );
  }
  return (
    <img
      className="kajay-imagepicker__media"
      src={choice.imageLink}
      alt=""
      style={tileStyle(question)}
    />
  );
}

function ChoiceTile({
  question,
  choice,
  groupName,
}: {
  readonly question: ImagePickerQuestion;
  readonly choice: ItemValue;
  readonly groupName: string;
}): ReactElement {
  const { Checkbox, Radio } = useSurveyComponents();
  // C10's one type whose arity is a *property* rather than its type, so the branch is
  // here rather than in the registry.
  const Choice = question.multiSelect ? Checkbox : Radio;

  return (
    <label className="kajay-imagepicker__tile">
      <Choice
        className="kajay-imagepicker__input"
        name={groupName}
        value={String(choice.value)}
        checked={question.isSelected(choice.value)}
        disabled={!question.isEnabled}
        // `onClick`, not only `onChange`: picking the chosen tile again is how a
        // single-select respondent takes it back, and a radio fires no change. Reading
        // cancels that same click, so the tiles stay focusable and unchangeable.
        reselect
        onCheckedChange={whenEditable(question.isReadOnly, () => {
          question.select(choice.value);
        })}
      />
      <span className="kajay-imagepicker__body">
        <ChoiceMedia question={question} choice={choice} />
        {/* Always present. `showLabel` hides it from sight, never from the
            accessibility tree — a grid of unlabelled pictures is not an answerable
            question for anyone who cannot see them. */}
        <span className="kajay-imagepicker__label">{choice.text}</span>
      </span>
    </label>
  );
}

/**
 * Choices shown as pictures.
 *
 * Real radios or checkboxes underneath, moved out of sight rather than replaced, so the
 * grid is arrowable, announced and focusable exactly as an ordinary choice list is. The
 * input's type follows `multiSelect`, which is what makes "pick one" and "pick several"
 * sound different to a screen reader as well as behave differently.
 */
export function ImagePickerRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);

  if (!(question instanceof ImagePickerQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const groupName = questionId(question);
  const errorId = `${groupName}-errors`;

  return (
    <fieldset
      className="kajay-question kajay-question--imagepicker"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
      aria-invalid={question.hasErrors || undefined}
      aria-describedby={question.hasErrors ? errorId : undefined}
      // Radios when it takes one answer, checkboxes when it takes several — so the
      // read-only state goes in the two different places ARIA allows for the two.
      {...(question.multiSelect ? {} : readOnlyRadioGroup(question.isReadOnly))}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>
      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />

      <div className="kajay-imagepicker" data-show-label={question.showLabel ? 'true' : undefined}>
        {question.visibleChoices.map((choice) => (
          <ChoiceTile
            key={String(choice.value)}
            question={question}
            choice={choice}
            groupName={groupName}
          />
        ))}
      </div>

      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </fieldset>
  );
}
