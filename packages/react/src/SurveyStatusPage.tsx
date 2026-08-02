import type { Survey as SurveyModel, SurveyState } from '@kajay/core';
import type { ReactElement } from 'react';
import { useHtmlSanitizer } from './HtmlSanitizerContext.js';

/**
 * The states that replace the form with a message.
 *
 * Preview is not one of them: it replaces the form with the *answers*, which is a page
 * of its own rather than a sentence.
 */
export type SurveyStatusState = Exclude<SurveyState, 'running' | 'preview'>;

/** What each state says when the author has written nothing of their own. */
const FALLBACKS: Readonly<Record<SurveyStatusState, string>> = {
  completed: 'Thank you for completing this survey.',
  loading: 'Loading…',
  empty: 'This survey has no questions to answer.',
};

export interface SurveyStatusPageProps {
  readonly survey: SurveyModel;
  readonly state: SurveyStatusState;
}

function markupFor(survey: SurveyModel, state: SurveyStatusState): string {
  if (state === 'completed') {
    return survey.status.completedHtml;
  }
  return state === 'loading' ? survey.status.loadingHtml : survey.status.emptyHtml;
}

/**
 * What replaces the form when there is no page to answer.
 *
 * One component for all three states because they differ in exactly two things — the
 * markup and the fallback sentence — and three near-identical components would drift
 * apart the first time one of them gained a class name.
 *
 * `role="status"` throughout: reaching the end, or finding there is nothing to answer,
 * is a change a respondent who is not looking at that part of the page has to be told
 * about. Polite rather than assertive, because nothing here is urgent.
 *
 * The default sentences live here rather than in the model, so an author who writes no
 * `completedHtml` gets one and it never reaches their definition. §J moves them into
 * the UI string dictionary; today they are English, and that is a stated gap rather
 * than a hidden one.
 */
export function SurveyStatusPage({ survey, state }: SurveyStatusPageProps): ReactElement {
  const sanitize = useHtmlSanitizer();
  const markup = markupFor(survey, state);

  return (
    <div className={`kajay-survey kajay-survey--${state}`} role="status" data-state={state}>
      {markup.length > 0 ? (
        // Markup, because that is what the author wrote it as — and through the same
        // sanitizer seam an `html` element uses, since it is the same trust boundary.
        // Whatever a placeholder resolved to was escaped by the model first: the
        // template is the author's, the answers are the respondent's.
        <div className="kajay-html" dangerouslySetInnerHTML={{ __html: sanitize(markup) }} />
      ) : (
        <p className="kajay-survey__status-text">{FALLBACKS[state]}</p>
      )}
    </div>
  );
}
