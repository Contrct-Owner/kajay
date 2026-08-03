import type { Survey } from './Survey.js';
import { SurveyTimer } from './SurveyTimer.js';

/**
 * Wires the survey's clocks to the survey — checklist E8.
 *
 * A function rather than a block inside `Survey` because it is a policy, not a part: it
 * decides which limit applies to the page in front of the respondent and what running
 * out of each clock does. The two callbacks are passed in because both reach things the
 * survey keeps to itself — the host's clock and the ungated page move.
 */
export function createSurveyTimer(
  survey: Survey,
  now: () => Date,
  advance: () => void,
): SurveyTimer {
  return new SurveyTimer({
    now,
    surveyLimit: () => survey.maxTimeToFinish,
    pageLimit: () => pageTimeLimit(survey),
    isCompleted: () => survey.isCompleted,
    // Movement, not the respondent's forward action, so the validation gate does not
    // apply: a page whose time is up has to be leavable even when an answer is missing.
    onPageExpired: advance,
    onSurveyExpired: () => {
      survey.complete();
    },
  });
}

/**
 * This page's own allowance, or the survey's default for pages that state none.
 *
 * **Zero unless the respondent is actually on a page.** A page limit is a fact about
 * answering a page, and a preview is not one: without this, a last page that ran out of
 * time would show the preview and then, one page-limit later, submit the survey out from
 * under somebody still reading it. The survey's own clock keeps running through a
 * preview, because reviewing your answers does spend the time you were given.
 */
function pageTimeLimit(survey: Survey): number {
  if (survey.status.state !== 'running') {
    return 0;
  }
  const own = survey.currentPage?.maxTimeToFinish ?? 0;
  return own > 0 ? own : survey.maxTimeToFinishPage;
}
