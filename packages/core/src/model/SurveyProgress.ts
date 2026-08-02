import type { Survey } from './Survey.js';

/**
 * Enough to put a respondent back where they were.
 *
 * The page is identified by **name, not by index**. An index is a fact about the
 * definition that saved it: add a page, reorder two, or let a different set of answers
 * make different pages visible, and index 2 is somewhere else entirely — so a resumed
 * respondent lands on a page they have never seen with no way to tell that anything went
 * wrong. A name either still exists or does not, and "does not" is answerable.
 *
 * Answers only. Calculated values are recomputed from them, and writing one back as if
 * it were an answer would put a value in the response that nothing computed.
 */
export interface SurveyProgress {
  readonly data: Readonly<Record<string, unknown>>;
  /** The page the respondent was on. Empty when the survey had none. */
  readonly pageName: string;
}

/**
 * A snapshot the host can store and hand back later.
 *
 * Deliberately plain data: it is going into a database column, a local storage key or a
 * POST body, and anything cleverer than JSON would not survive the trip.
 */
export function readProgress(survey: Survey): SurveyProgress {
  const computed = new Set(
    survey.calculatedValues
      .filter((calculated) => calculated.includeIntoResult)
      .map((calculated) => calculated.name),
  );
  return {
    data: Object.fromEntries(
      Object.entries(survey.data).filter(([name]) => !computed.has(name)),
    ),
    pageName: survey.currentPage?.name ?? '',
  };
}

/**
 * Puts the respondent back.
 *
 * Answers first, then the page, and the order is the whole trick: page visibility is
 * computed from the answers, so navigating before restoring them would aim at a page
 * that does not exist yet — or skip past one that is about to.
 *
 * A page that is no longer visible leaves them at the start rather than nowhere. That
 * is a real case and not an error: the definition may have changed, or an answer they
 * gave may since have conditioned that page away.
 */
export function restoreProgress(survey: Survey, progress: SurveyProgress): void {
  survey.setData(progress.data);
  if (progress.pageName.length > 0) {
    survey.goTo(progress.pageName);
  }
}
