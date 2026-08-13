import { FillInTheBlankQuestion } from '@kajay/core';
import { TextQuestion } from '@kajay/core';
import type { Question, SurveyError } from '@kajay/core';
import type { ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useSurveyValue } from './useSurveyState.js';
import { questionErrorId, questionId } from './questionId.js';
import { useSurveyComponents } from './SurveyComponents.js';
import { useIdScope } from './idScope.js';

interface BlankFieldProps {
  readonly question: FillInTheBlankQuestion;
  readonly blank: Question;
  readonly errors: readonly SurveyError[];
}

/**
 * One gap, sitting in the run of the sentence.
 *
 * **Text blanks only, for now.** A blank is a question as of ADR-0048's amendment, so a
 * dropdown or a multi-select belongs here too — through the inline renderer registration
 * that decision calls for, which is the next piece. Until it exists this draws the case it
 * has always drawn, and core refuses any blank whose type cannot go inline at all.
 *
 * **The name comes from `aria-label`, not a hidden `<label>`.** The prose names this blank
 * to anyone reading it and to nobody using a screen reader, which would otherwise hear
 * "edit text, blank" — the respondent who most needs the sentence read aloud learning
 * least from it. A rendered-then-hidden label was the first attempt and was wrong: hiding
 * it takes a stylesheet, `@kajay/themes` is an explicit opt-in, and a host that had not
 * imported it would see every label printed inside the sentence. An accessible name must
 * not depend on CSS anyone can decline to load.
 *
 * Errors sit immediately after their own input rather than under the question. In a
 * sentence that is the only place they can go and still say which word they mean.
 */
function BlankField({ question, blank, errors }: BlankFieldProps): ReactElement {
  const scope = useIdScope();
  const { Input } = useSurveyComponents();
  const inputId = `${questionId(question, scope)}-${blank.name}`;
  const errorId = `${inputId}-errors`;
  const size = question.blankSize;

  return (
    <span className="kajay-fillintheblank__gap">
      <Input
        id={inputId}
        className="kajay-question__input kajay-fillintheblank__input"
        type={blank instanceof TextQuestion ? blank.inputType : 'text'}
        aria-label={blank.title}
        readOnly={question.isReadOnly}
        disabled={!question.isEnabled}
        required={blank.isRequired}
        aria-required={blank.isRequired}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={errors.length > 0 ? errorId : undefined}
        {...(size > 0 ? { size } : {})}
        value={String(question.getBlankValue(blank.name) ?? '')}
        onValueChange={(next) => {
          question.setBlankValue(blank.name, next);
        }}
      />
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
  question,
}: QuestionRendererProps): ReactElement {
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
              question={question}
              blank={blank}
              errors={question.errors.filter((error) => error.path === blank.name)}
            />
          );
        })}
      </p>
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} errors={own} />
    </fieldset>
  );
}
