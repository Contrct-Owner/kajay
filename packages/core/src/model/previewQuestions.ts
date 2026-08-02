import { collectVisibleQuestions } from './pageElements.js';
import type { Question } from './Question.js';
import type { Survey } from './Survey.js';

/**
 * Which questions a respondent is shown before they submit.
 *
 * `showAnsweredQuestions` is the kinder default for a long survey — a review screen
 * listing forty untouched optional questions buries the eight that matter — while
 * `showAllQuestions` is what a form with a legal weight wants, because "I was never
 * asked" and "I left it blank" have to look different.
 */
export type PreviewMode = 'noPreview' | 'showAllQuestions' | 'showAnsweredQuestions';

export function toPreviewMode(declared: string): PreviewMode {
  return declared === 'showAllQuestions' || declared === 'showAnsweredQuestions'
    ? declared
    : 'noPreview';
}

/**
 * The questions the preview shows, in document order.
 *
 * Reachable ones only, on the same reasoning as everything else that walks the tree: a
 * question on a page conditioned away was never asked, and showing it under "your
 * answers" would be inventing a question the respondent never saw.
 */
export function collectPreviewQuestions(survey: Survey): readonly Question[] {
  const reachable = survey.visiblePages.flatMap((page) =>
    collectVisibleQuestions(page.elements),
  );
  if (survey.showPreviewBeforeComplete !== 'showAnsweredQuestions') {
    return reachable;
  }
  return reachable.filter((question) => question.value !== undefined);
}
