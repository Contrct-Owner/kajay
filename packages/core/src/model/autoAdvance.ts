import { collectVisibleQuestions } from './pageElements.js';
import type { Survey } from './Survey.js';

/**
 * Whether answering `name` should carry the respondent to the next page.
 *
 * Two conditions, and both matter.
 *
 * The question just answered has to be one a **single action finishes**. A text
 * question is answered a character at a time, and a survey that turned the page after
 * the first letter of a name would be unusable — so only questions that say their
 * answer is complete the moment it is given can trigger this. That is a fact about the
 * question type, which is why the question is asked rather than a list kept here.
 *
 * And every question on the page has to be answered, because moving on while something
 * is still blank would be taking the choice away rather than saving a click.
 *
 * The **last page never advances automatically**. Submitting is a decision, and a
 * survey that submitted itself the moment the final radio was clicked would take that
 * decision from the respondent — along with any chance to look back over it.
 */
export function shouldAdvanceAutomatically(survey: Survey, name: string): boolean {
  if (!survey.goNextPageAutomatic || survey.isLastPage) {
    return false;
  }
  const questions = collectVisibleQuestions(survey.currentPage?.elements ?? []);
  const answered = questions.find((question) => question.name === name);
  if (answered === undefined || !answered.answersInOneStep) {
    return false;
  }
  return questions.every((question) => question.value !== undefined);
}
