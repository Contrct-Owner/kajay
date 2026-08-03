import { collectVisibleQuestions } from './pageElements.js';
import type { Question } from './Question.js';
import { scoreQuiz } from './quizScore.js';
import type { Survey } from './Survey.js';

/**
 * What the bar measures.
 *
 * Three different questions, and a survey should answer the one its shape makes
 * meaningful: `pages` for a wizard whose pages are steps, `questions` for a long single
 * page where pages would say nothing, `requiredQuestions` for a form whose optional
 * questions would otherwise make it look further from done than it is.
 *
 * `correctQuestions` is the quiz variant (E8): what the respondent has got right rather
 * than how much they have done, which is the only one of the four that can go *down*.
 */
export type ProgressBarType = 'pages' | 'questions' | 'requiredQuestions' | 'correctQuestions';

/** Where the bar is drawn, if at all. */
export type ProgressBarLocation = 'off' | 'top' | 'bottom' | 'both';

const PROGRESS_BAR_TYPES: readonly ProgressBarType[] = [
  'pages',
  'questions',
  'requiredQuestions',
  'correctQuestions',
];

export function toProgressBarType(declared: string): ProgressBarType {
  return PROGRESS_BAR_TYPES.find((candidate) => candidate === declared) ?? 'pages';
}

export function toProgressBarLocation(declared: string): ProgressBarLocation {
  return declared === 'top' || declared === 'bottom' || declared === 'both' ? declared : 'off';
}

export interface ProgressCount {
  readonly done: number;
  readonly total: number;
  /**
   * How far through, from 0 to 1.
   *
   * Nothing to do is *done*, not zero: a survey with no required questions has nothing
   * outstanding, and a bar reading empty for a form that cannot be advanced any further
   * is a lie in the more misleading direction.
   */
  readonly ratio: number;
  /** What the bar says out loud. */
  readonly label: string;
}

/**
 * How far through the survey the respondent is.
 *
 * A pure function over the survey rather than a member on it, so the renderer needs no
 * new model surface and the arithmetic is testable without one.
 *
 * `pages` counts what is **behind** them. The page they are on is not finished — they
 * are looking at it — so a three-page survey reads two thirds on its last page. The
 * alternative flatters the number and tells a respondent they are done while a page of
 * questions is still in front of them.
 */
export function measureProgress(survey: Survey): ProgressCount {
  if (survey.progressBarType === 'pages') {
    return count(survey.currentPageNo, survey.pageCount, 'page');
  }
  if (survey.progressBarType === 'correctQuestions') {
    const score = scoreQuiz(survey);
    return {
      done: score.correct,
      total: score.total,
      ratio: score.ratio,
      // Not "completed": these marks are earned, and a respondent who reads "3 of 8
      // questions completed" on a quiz bar will believe five are still in front of them.
      label: `${String(score.correct)} of ${String(score.total)} correct`,
    };
  }
  const questions = reachableQuestions(survey);
  const counted =
    survey.progressBarType === 'requiredQuestions'
      ? questions.filter((question) => question.isRequired)
      : questions;
  const answered = counted.filter((question) => question.value !== undefined);
  return count(answered.length, counted.length, 'question');
}

function reachableQuestions(survey: Survey): readonly Question[] {
  return survey.visiblePages.flatMap((page) => collectVisibleQuestions(page.elements));
}

function count(done: number, total: number, noun: string): ProgressCount {
  const plural = total === 1 ? noun : `${noun}s`;
  return {
    done,
    total,
    ratio: total === 0 ? 1 : done / total,
    label: `${String(done)} of ${String(total)} ${plural} completed`,
  };
}
