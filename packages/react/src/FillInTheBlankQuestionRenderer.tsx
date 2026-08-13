import { FillInTheBlankQuestion } from '@kajay/core';
import type { Question, Survey, SurveyError } from '@kajay/core';
import { createElement } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type {
  PageElementRendererProps,
  PageElementRendererResolver,
} from './PageElementRendererRegistry.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';
import { questionErrorId, questionId } from './questionId.js';
import { useIdScope } from './idScope.js';

interface BlankFieldProps {
  readonly survey: Survey;
  readonly blank: Question;
  /** The sentence's default width in characters, which a blank's own `size` beats. */
  readonly defaultSize: number;
  readonly errors: readonly SurveyError[];
  readonly renderers: PageElementRendererResolver;
}

/**
 * One field, sitting in the run of the sentence.
 *
 * **Drawn by its own type's inline renderer**, which is a second registration rather than
 * a mode on the first: a flag would oblige every renderer a host has written to handle a
 * case it has never heard of, and ignoring it draws a fieldset inside a paragraph. A type
 * with no inline renderer draws nothing here — core already refuses one at parse, so this
 * is the same statement made twice rather than a silent hole.
 *
 * Errors sit immediately after their own control. In a sentence that is the only place
 * they can go and still say which word they mean.
 */
function BlankField({
  survey,
  blank,
  defaultSize,
  errors,
  renderers,
}: BlankFieldProps): ReactElement {
  const scope = useIdScope();
  const errorId = `${questionId(blank, scope)}-errors`;
  const inline = renderers.inline?.(blank.type);
  // Resolved here and published as a custom property rather than passed to the control:
  // an inline renderer is handed one question and a question does not know its sentence,
  // so this is the only place that can answer "how wide, and who said". A host's own
  // inline renderer inherits it without being told the property exists.
  const size = blank.size > 0 ? blank.size : defaultSize;
  // Characters plus the furniture the control draws inside itself — its padding, a
  // dropdown's chevron, a number field's spinner. Without the allowance a gap authored
  // as four characters wide has room for the spinner and nothing else.
  const width = { '--kajay-blank-width': `calc(${String(size)}ch + 1.6em)` } as CSSProperties;

  return (
    <span
      className="kajay-fillintheblank__gap"
      data-blank-name={blank.name}
      {...(size > 0 ? { style: width } : {})}
    >
      {inline === undefined ? null : createElement(inline, { survey, question: blank })}
      {errors.length > 0 ? (
        <span className="kajay-question__errors" id={errorId} role="alert">
          {errors.map((error) => (
            <span key={`${error.kind}:${error.text}`} className="kajay-question__error">
              {error.text}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/**
 * A sentence with gaps in it — checklist C13.
 *
 * A fieldset for `MultipleTextQuestionRenderer`'s reason: several inputs under one
 * question need a group name, or a reader meets a row of unattached boxes.
 *
 * **A blank the template names but nobody declared draws nothing.** The model reports
 * that as a definition diagnostic, and drawing an input with no label, no marking and
 * nowhere to store an answer would be worse than the gap in the prose.
 */
export function FillInTheBlankQuestionRenderer({
  survey,
  element,
  renderers,
}: PageElementRendererProps): ReactElement {
  const question = element;
  const scope = useIdScope();
  useSurveyValue(survey, question.name);

  if (!(question instanceof FillInTheBlankQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const errorId = questionErrorId(question, scope);
  const own = question.errors.filter((error) => error.path === undefined);

  return (
    <fieldset
      className="kajay-question kajay-question--fillintheblank"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>
      <QuestionErrors survey={survey} question={question} at="top" id={errorId} errors={own} />
      <p className="kajay-fillintheblank">
        {question.segments.map((segment, index) => {
          if (segment.kind === 'text') {
            // Keyed by position because prose repeats itself: "the" appears twice in a
            // sentence and the index is the only thing telling the two apart.
            return <span key={`text-${String(index)}`}>{segment.text}</span>;
          }
          const blank = question.getBlank(segment.name);
          return blank === undefined ? null : (
            <BlankField
              key={`blank-${segment.name}`}
              survey={survey}
              blank={blank}
              defaultSize={question.blankSize}
              errors={question.errors.filter((error) => error.path === blank.name)}
              renderers={renderers}
            />
          );
        })}
      </p>
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} errors={own} />
    </fieldset>
  );
}
