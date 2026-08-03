import { toQuestionsOnPageMode } from './PageLayout.js';
import type { Page } from './Page.js';
import type { Survey } from './Survey.js';
import { SurveyPages } from './SurveyPages.js';

/**
 * Builds the survey's page list and wires it back to the survey.
 *
 * A factory beside `createSurveyLogic` and `createSurveyTimer`, for the reason those
 * exist: the interesting part is the *ordering* — the page clock restarts before anyone
 * is told the page changed, so a listener that reads the timer sees the new page's
 * allowance rather than the old page's remainder.
 */
export function createSurveyPages(
  survey: Survey,
  pages: () => readonly Page[],
  beforeAnnounce: () => void,
): SurveyPages {
  return new SurveyPages(
    pages,
    () => toQuestionsOnPageMode(survey.questionsOnPageMode),
    (event) => {
      beforeAnnounce();
      survey.onCurrentPageChanged.emit(event);
    },
  );
}
