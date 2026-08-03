import { MultipleTextQuestion } from '@kajay/core';
import type { MultipleTextItem, SurveyError } from '@kajay/core';
import type { ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';

interface ItemFieldProps {
  readonly question: MultipleTextQuestion;
  readonly item: MultipleTextItem;
  readonly errors: readonly SurveyError[];
}

/**
 * One field, with whatever the model said about it.
 *
 * Errors are matched by `path`, which is why the model reports them that way: the
 * alternative — prefixing each message with the item's title — would repeat a label the
 * field is already showing, and could not be undone by a host that wanted to place them
 * itself.
 */
function ItemField({ question, item, errors }: ItemFieldProps): ReactElement {
  const inputId = `kajay-question-${question.name}-${item.name}`;
  const errorId = `${inputId}-errors`;
  const size = item.size > 0 ? item.size : question.itemSize;

  return (
    <div className="kajay-multipletext__item">
      <label className="kajay-multipletext__label" htmlFor={inputId}>
        {item.title}
        {item.isRequired ? (
          <span className="kajay-question__required" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>
      <input
        id={inputId}
        className="kajay-question__input"
        type={item.inputType}
        readOnly={question.isReadOnly}
        placeholder={item.placeholder}
        disabled={!question.isEnabled}
        required={item.isRequired}
        aria-required={item.isRequired}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={errors.length > 0 ? errorId : undefined}
        {...(size > 0 ? { size } : {})}
        value={String(question.getItemValue(item.name) ?? '')}
        onChange={(event) => {
          question.setItemValue(item.name, event.target.value);
        }}
      />
      {errors.length > 0 ? (
        <div className="kajay-question__errors" id={errorId} role="alert">
          {errors.map((error) => (
            <p key={`${error.kind}:${error.text}`} className="kajay-question__error">
              {error.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Several short fields under one label.
 *
 * A fieldset, because that is what it is: the legend names the group and each field
 * carries its own label, so a screen reader announces "Address, Street" rather than
 * leaving four boxes called Street, City, Postcode and Country floating unattached.
 */
export function MultipleTextQuestionRenderer({
  survey,
  question,
}: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);

  if (!(question instanceof MultipleTextQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const errorId = `kajay-question-${question.name}-errors`;
  const own = question.errors.filter((error) => error.path === undefined);

  return (
    <fieldset
      className="kajay-question kajay-question--multipletext"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>
      {/* What the question earned as a whole — a required multipletext nobody filled in.
          Each item's own messages sit beside their field; without this slot a
          question-level error had nowhere to appear at all. */}
      <QuestionErrors survey={survey} question={question} at="top" id={errorId} errors={own} />
      <div
        className="kajay-multipletext"
        style={{ gridTemplateColumns: `repeat(${String(question.colCount)}, minmax(0, 1fr))` }}
      >
        {question.items.map((item) => (
          <ItemField
            key={item.name}
            question={question}
            item={item}
            errors={question.errors.filter((error) => error.path === item.name)}
          />
        ))}
      </div>
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} errors={own} />
    </fieldset>
  );
}
