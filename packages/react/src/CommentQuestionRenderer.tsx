import { CommentQuestion } from '@kajay/core';
import type { Question } from '@kajay/core';
import type { ChangeEvent, ReactElement } from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { useQuestionValue } from './useSurveyState.js';
import { questionId } from './questionId.js';

/**
 * Grows a textarea to fit what is in it.
 *
 * Measured rather than counted: line height, wrapping and the font are all the
 * browser's business, and a row count derived from newlines is wrong the moment a line
 * wraps. Resetting to `auto` first is what lets it shrink again — `scrollHeight` never
 * reports less than the current height.
 */
function useAutoGrow(isEnabled: boolean, value: unknown): (node: HTMLTextAreaElement) => void {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback((): void => {
    const node = ref.current;
    if (node === null || !isEnabled) {
      return;
    }
    node.style.height = 'auto';
    node.style.height = `${String(node.scrollHeight)}px`;
  }, [isEnabled]);

  // Layout, not effect: growing after the browser has painted the short version is a
  // visible jump.
  useLayoutEffect(resize, [resize, value]);

  return useCallback(
    (node: HTMLTextAreaElement) => {
      ref.current = node;
      resize();
    },
    [resize],
  );
}

/**
 * How much room is left.
 *
 * `aria-live="polite"`, not an alert: running low on room is information, and
 * interrupting someone mid-sentence to tell them so is not helpful. There is no
 * `maxlength` attribute on the field either — silently swallowing keystrokes is the
 * version of this that leaves a respondent wondering whether the keyboard broke. The
 * model objects instead, so the limit is stated rather than enforced by disappearance.
 */
function CharacterCounter({
  question,
  remaining,
  id,
}: {
  readonly question: Question;
  readonly remaining: number | undefined;
  readonly id: string;
}): ReactElement | null {
  if (remaining === undefined) {
    return null;
  }
  return (
    <p className="kajay-question__counter" id={id} aria-live="polite">
      {question.uiText('charactersRemaining', remaining)}
    </p>
  );
}

export function CommentQuestionRenderer({
  survey,
  question,
}: QuestionRendererProps): ReactElement {
  const value = useQuestionValue(survey, question);
  const isComment = question instanceof CommentQuestion;
  const autoGrow = useAutoGrow(isComment && question.autoGrow, value);

  const inputId = questionId(question);
  const errorId = `${inputId}-errors`;
  const counterId = `${inputId}-counter`;
  const remaining = isComment ? question.remainingCharacters : undefined;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    // Through the question, not `survey.setValue(question.name, …)`: a matrix cell is a
    // question named for its column, and its answer lives inside the matrix's rather
    // than at a survey name — writing by name would put a stray key in the response.
    question.value = event.target.value;
  };

  return (
    <div className="kajay-question" data-question-name={question.name}>
      <label className="kajay-question__title" htmlFor={inputId}>
        <QuestionTitleContent question={question} />
      </label>
      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />
      <textarea
        id={inputId}
        ref={autoGrow}
        className="kajay-question__textarea"
        rows={isComment ? question.rows : 4}
        readOnly={question.isReadOnly}
        placeholder={isComment ? question.placeholder : ''}
        disabled={!question.isEnabled}
        required={question.isRequired}
        aria-required={question.isRequired}
        aria-invalid={question.hasErrors || undefined}
        aria-describedby={describedBy(question.hasErrors, errorId, remaining, counterId)}
        style={isComment && !question.allowResize ? { resize: 'none' } : undefined}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={handleChange}
      />
      <CharacterCounter question={question} remaining={remaining} id={counterId} />
      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </div>
  );
}

function describedBy(
  hasErrors: boolean,
  errorId: string,
  remaining: number | undefined,
  counterId: string,
): string | undefined {
  const ids = [...(hasErrors ? [errorId] : []), ...(remaining === undefined ? [] : [counterId])];
  return ids.length > 0 ? ids.join(' ') : undefined;
}
