import type { AnswerScore } from './answerScore.js';
import { collectVisibleQuestions } from './pageElements.js';
import type { Question } from './Question.js';
import type { Survey } from './Survey.js';

export interface QuestionScore extends AnswerScore {
  readonly name: string;
  /** Whether every mark on offer was earned. Not the same as `correct > 0`. */
  readonly isCorrect: boolean;
}

export interface QuizScore {
  readonly correct: number;
  /** Marks available. With partial credit this is larger than `questionCount`. */
  readonly total: number;
  readonly questionCount: number;
  /** 0 to 1. */
  readonly ratio: number;
  readonly questions: readonly QuestionScore[];
}

/**
 * What the respondent has got right — checklist E8.
 *
 * A pure function over the survey rather than a member on it, following `measureProgress`:
 * the renderer gains no model surface, the arithmetic is testable without a DOM, and a
 * host that wants to grade a restored response can call it on a survey nobody is looking
 * at.
 *
 * **Only reachable questions are graded**, on the same reasoning that keeps unreachable
 * questions out of the progress total: a branch the respondent never saw must not cost
 * them marks. It also means the score can only be read against the answers that produced
 * it — grading a response whose branching answers have been stripped will grade a
 * different paper.
 *
 * Marks, not questions, because a multi-select is worth several
 * ([`scoreSelection`](./answerScore.ts)). `questionCount` is carried alongside for a
 * host that wants to say "7 of 10 questions" instead.
 */
export function scoreQuiz(survey: Survey): QuizScore {
  const questions = survey.visiblePages
    .flatMap((page) => collectVisibleQuestions(page.elements))
    .filter((question) => question.isQuizQuestion);
  const scores = questions.map((question) => toQuestionScore(question));
  const correct = total(scores, (score) => score.correct);
  const available = total(scores, (score) => score.total);
  return {
    correct,
    total: available,
    questionCount: scores.length,
    // Nothing graded is **zero**, deliberately inverting `measureProgress`, where nothing
    // outstanding means done. A progress bar reports work remaining and an empty quiz has
    // none; a score reports achievement, and awarding full marks for a paper with no
    // questions on it is the flattering lie in the direction that actually misleads.
    ratio: available === 0 ? 0 : correct / available,
    questions: scores,
  };
}

/**
 * The two names a completed page may use to report the score — checklist E8.
 *
 * `undefined` for every other name, so an unrelated placeholder falls through to
 * whatever else can resolve it rather than being swallowed here.
 *
 * `quizQuestionCount` counts **marks**, not questions, so the pair always divides into
 * a true fraction. A checkbox worth three would otherwise let a respondent read
 * "3 of 2 correct" on the page that tells them how they did.
 */
export function quizPlaceholder(survey: Survey, name: string): number | undefined {
  if (name !== 'correctAnswers' && name !== 'quizQuestionCount') {
    return undefined;
  }
  const score = scoreQuiz(survey);
  return name === 'correctAnswers' ? score.correct : score.total;
}

function toQuestionScore(question: Question): QuestionScore {
  const score = question.scoreAnswer();
  return {
    name: question.name,
    correct: score.correct,
    total: score.total,
    isCorrect: score.correct === score.total,
  };
}

function total(scores: readonly QuestionScore[], read: (score: QuestionScore) => number): number {
  return scores.reduce((running, score) => running + read(score), 0);
}
