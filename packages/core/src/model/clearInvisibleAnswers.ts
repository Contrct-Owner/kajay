import { collectVisibleQuestions } from './pageElements.js';
import type { Survey } from './Survey.js';

/**
 * What happens to an answer the respondent can no longer reach.
 *
 * `onComplete` is the default, matching what most hosts want without thinking about it:
 * an answer to a question that ended up hidden is not part of what the respondent said,
 * and shipping it to a backend invites a report that counts opinions nobody expressed.
 * `onHidden` destroys it the moment it becomes unreachable, which is what a form
 * handling sensitive branches wants — but it is genuinely destructive, and a respondent
 * who hides a branch and unhides it finds their answers gone. `none` keeps everything,
 * which is right when a definition's branches are a filter rather than a fork.
 */
export type ClearInvisibleValues = 'none' | 'onHidden' | 'onComplete';

/** Unknown values fall back to the default rather than to "keep everything". */
export function toClearPolicy(declared: string): ClearInvisibleValues {
  return declared === 'none' || declared === 'onHidden' ? declared : 'onComplete';
}

/**
 * How many times the clearing pass will run before giving up.
 *
 * Clearing an answer re-runs the logic that read it, which can hide something else, so
 * one pass is not enough. It can also *unhide* something, and a definition whose
 * `setValueIf` writes into a question its own condition then hides would otherwise
 * clear and rewrite for ever. The cap turns an authoring mistake into a survey that
 * settles somewhere rather than one that hangs.
 */
const MAX_PASSES = 10;

/**
 * Names of answered questions the respondent cannot reach.
 *
 * Reachability, not the question's own `isVisible`: a question inside a hidden panel,
 * or on a page conditioned away, is out of reach however visible it is itself — which
 * is exactly the distinction `visibleIf` on a container draws.
 */
export function unreachableAnswers(survey: Survey): readonly string[] {
  const reachable = new Set(
    survey.visiblePages.flatMap((page) =>
      collectVisibleQuestions(page.elements).map((question) => question.valueKey),
    ),
  );
  return survey.questions
    .filter((question) => !reachable.has(question.valueKey) && question.value !== undefined)
    .map((question) => question.valueKey);
}

/**
 * Clears every out-of-reach answer, and everything that becomes out of reach as a
 * result.
 *
 * Repeats rather than sweeping once, because clearing an answer is itself a change the
 * logic reacts to: hiding a question can hide the one after it, and that second one
 * only becomes clearable once the first has gone.
 */
function clearInvisibleAnswers(survey: Survey, clear: (name: string) => void): void {
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const names = unreachableAnswers(survey);
    if (names.length === 0) {
      return;
    }
    for (const name of names) {
      clear(name);
    }
  }
}

/**
 * Enforces `onHidden`: an answer dies with the question, as it happens.
 *
 * The caller supplies the write because *how* it writes matters — inside the settle
 * that hid the question, so nobody sees the moment where the question has gone and its
 * answer has not.
 */
export function clearHiddenAnswers(survey: Survey, clear: (name: string) => void): void {
  if (survey.clearInvisibleValues !== 'onHidden') {
    return;
  }
  clearInvisibleAnswers(survey, clear);
}

/**
 * Enforces `onComplete`: unreachable answers are dropped as the survey ends.
 *
 * Late rather than never, and late rather than immediately: the respondent keeps their
 * answers while they are still moving between branches — a branch they come back to
 * still has what they typed — and what gets submitted is only what they could reach.
 */
export function clearAnswersOnComplete(survey: Survey, clear: (name: string) => void): void {
  if (survey.clearInvisibleValues !== 'onComplete') {
    return;
  }
  clearInvisibleAnswers(survey, clear);
}
