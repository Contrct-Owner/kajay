import type { Question } from '@kajay/core';
import type { ReactElement } from 'react';
import { useTextRenderer } from './TextRendererContext.js';

/**
 * Title text plus the required marker.
 *
 * A fragment rather than an element, so each question type keeps whatever wrapper its
 * markup needs — a `label` for a single input, a `legend` for a group.
 */
/** Public from P9: a custom renderer draws the same title block the built-ins do. */
export interface QuestionTitleContentProps {
  readonly question: Question;
}

export function QuestionTitleContent({
  question,
}: QuestionTitleContentProps): ReactElement {
  const renderText = useTextRenderer();
  return (
    <>
      {renderText(question.title, {
        kind: 'title',
        owner: question.name,
        property: 'title',
      })}
      {question.isRequired ? (
        <span className="kajay-question__required" aria-hidden="true">
          {' *'}
        </span>
      ) : null}
    </>
  );
}
