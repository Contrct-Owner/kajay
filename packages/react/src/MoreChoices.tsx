import type { SelectQuestion } from '@kajay/core';
import type { ReactElement } from 'react';

export interface MoreChoicesProps {
  readonly question: SelectQuestion;
}

/**
 * Fetches the rest of a paged list.
 *
 * An explicit control rather than a scroll sentinel. A native `<select>` has no scroll
 * this could hang an observer on, and infinite scrolling reaches nobody who is not
 * pointing at the list — pressing a button is how a keyboard or screen-reader user asks
 * for more. Phase 2's combobox can add the scroll trigger *alongside* this; it must not
 * replace it.
 *
 * The region is polite rather than assertive: more options arriving is worth knowing
 * about, and not worth interrupting someone mid-sentence for.
 */
export function MoreChoices({ question }: MoreChoicesProps): ReactElement | null {
  if (!question.isPaged) {
    return null;
  }
  return (
    <div className="kajay-choice-paging" aria-live="polite">
      {question.hasMoreChoices ? (
        <button
          type="button"
          className="kajay-choice-paging__more"
          disabled={question.isLoadingChoices}
          onClick={() => {
            question.loadMoreChoices();
          }}
        >
          {question.uiText(question.isLoadingChoices ? 'loadingOptions' : 'loadMoreOptions')}
        </button>
      ) : (
        <p className="kajay-choice-paging__done">{question.uiText('allOptionsLoaded')}</p>
      )}
    </div>
  );
}
