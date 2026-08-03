import { measureProgress, parseSurvey, scoreQuiz } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * Correct answers and scoring — checklist E8, and E3's remaining bar.
 *
 * Everything here is arithmetic over the model with no clock in sight, which is the
 * reason this half of E8 could be built before the timers were designed.
 */
function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

function quiz(...elements: readonly Readonly<Record<string, unknown>>[]): Survey {
  return build({ pages: [{ name: 'p1', elements }] });
}

describe('parity/E8-correct-answers', () => {
  test('a question is graded only when a correct answer was authored', () => {
    const survey = quiz(
      { type: 'text', name: 'graded', correctAnswer: 'Ada' },
      { type: 'text', name: 'ungraded' },
    );

    expect(survey.getQuestionByName('graded')?.isQuizQuestion).toBe(true);
    expect(survey.getQuestionByName('ungraded')?.isQuizQuestion).toBe(false);
    expect(scoreQuiz(survey).questionCount).toBe(1);
  });

  test('a falsy correct answer is still a correct answer', () => {
    // The reason `isQuizQuestion` asks whether the property was authored rather than
    // whether it holds something truthy: a true/false question whose answer is `false`
    // would otherwise drop out of the paper it belongs to.
    const survey = quiz(
      { type: 'boolean', name: 'claim', correctAnswer: false },
      { type: 'text', name: 'count', correctAnswer: 0 },
    );

    expect(scoreQuiz(survey).total).toBe(2);
    survey.setValue('claim', false);
    survey.setValue('count', 0);
    expect(scoreQuiz(survey).correct).toBe(2);
  });

  test('an unanswered graded question scores nothing rather than being skipped', () => {
    const survey = quiz({ type: 'text', name: 'capital', correctAnswer: 'Paris' });

    expect(scoreQuiz(survey)).toMatchObject({ correct: 0, total: 1, ratio: 0 });
  });

  test('a wrong answer costs the mark and the score reports which', () => {
    const survey = quiz(
      { type: 'text', name: 'first', correctAnswer: 'Paris' },
      { type: 'text', name: 'second', correctAnswer: 'Rome' },
    );
    survey.setValue('first', 'Paris');
    survey.setValue('second', 'Madrid');

    const score = scoreQuiz(survey);
    expect(score).toMatchObject({ correct: 1, total: 2, questionCount: 2, ratio: 0.5 });
    expect(score.questions).toEqual([
      { name: 'first', correct: 1, total: 1, isCorrect: true },
      { name: 'second', correct: 0, total: 1, isCorrect: false },
    ]);
  });

  test('a question the respondent could not reach is not on the paper', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'boolean', name: 'expert' },
            {
              type: 'text',
              name: 'hard',
              correctAnswer: 'Paris',
              visibleIf: '{expert} = true',
            },
          ],
        },
      ],
    });

    // A branch nobody was shown must not cost marks — the same reachability rule that
    // keeps unreachable questions out of the progress total.
    expect(scoreQuiz(survey).total).toBe(0);
    survey.setValue('expert', true);
    expect(scoreQuiz(survey).total).toBe(1);
  });

  test('a question on a page the respondent never saw is not on the paper either', () => {
    const survey = build({
      pages: [
        { name: 'p1', elements: [{ type: 'boolean', name: 'expert' }] },
        {
          name: 'p2',
          visibleIf: '{expert} = true',
          elements: [{ type: 'text', name: 'hard', correctAnswer: 'Paris' }],
        },
      ],
    });

    // Page visibility, not only element visibility. A graded question inside a page
    // that was conditioned away is as unreachable as one hidden on its own, and
    // counting it marks a respondent down for a branch that never existed for them.
    expect(scoreQuiz(survey).total).toBe(0);
    survey.setValue('expert', true);
    expect(scoreQuiz(survey).total).toBe(1);
  });

  test('nothing graded scores zero, not full marks', () => {
    // Deliberately the opposite of `measureProgress`, where nothing outstanding is done.
    // A progress bar reports work left; a score reports achievement.
    expect(scoreQuiz(quiz({ type: 'text', name: 'plain' }))).toMatchObject({
      correct: 0,
      total: 0,
      ratio: 0,
    });
  });
});

describe('parity/E8-partial-credit', () => {
  function checkbox(correctAnswer: unknown): Survey {
    return quiz({
      type: 'checkbox',
      name: 'primes',
      choices: [2, 3, 4, 5, 6, 7, 8, 9],
      correctAnswer,
    });
  }

  test('a multi-select is worth a mark per expected choice', () => {
    const survey = checkbox([2, 3, 5]);
    survey.setValue('primes', [2, 3]);

    expect(scoreQuiz(survey)).toMatchObject({ correct: 2, total: 3, questionCount: 1 });
  });

  test('ticking every box does not score full marks', () => {
    // The whole reason wrong choices are charged for. Counting only matches would make
    // this the winning strategy on every partial-credit question in the survey.
    const survey = checkbox([2, 3, 5]);
    survey.setValue('primes', [2, 3, 4, 5, 6, 7, 8, 9]);

    expect(scoreQuiz(survey)).toMatchObject({ correct: 0, total: 3 });
  });

  test('the penalty cannot reach into other questions', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'checkbox', name: 'primes', choices: [2, 3, 4], correctAnswer: [2] },
            { type: 'text', name: 'capital', correctAnswer: 'Paris' },
          ],
        },
      ],
    });
    survey.setValue('primes', [3, 4]);
    survey.setValue('capital', 'Paris');

    // Two spurious choices against one expected: floored at zero rather than -1, or a
    // bad guess here would quietly take away a mark earned elsewhere.
    expect(scoreQuiz(survey)).toMatchObject({ correct: 1, total: 2 });
  });

  test('a single expected value on a multi-select is one mark, not a list', () => {
    const survey = checkbox(3);
    survey.setValue('primes', [3]);

    expect(scoreQuiz(survey)).toMatchObject({ correct: 1, total: 1 });
  });
});

describe('parity/E3-progress-correct', () => {
  test('the bar can count what is right rather than what is done', () => {
    const survey = build({
      showProgressBar: 'top',
      progressBarType: 'correctQuestions',
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'first', correctAnswer: 'Paris' },
            { type: 'text', name: 'second', correctAnswer: 'Rome' },
          ],
        },
      ],
    });

    expect(survey.progressBarType).toBe('correctQuestions');
    survey.setValue('first', 'Paris');
    expect(measureProgress(survey)).toEqual({
      done: 1,
      total: 2,
      ratio: 0.5,
      // Not "completed": these are earned, and a respondent reading "1 of 2 questions
      // completed" on a quiz bar would believe one is still in front of them.
      label: '1 of 2 correct',
    });
  });

  test('it is the only bar that can go down', () => {
    const survey = build({
      showProgressBar: 'top',
      progressBarType: 'correctQuestions',
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'first', correctAnswer: 'Paris' }] }],
    });

    survey.setValue('first', 'Paris');
    expect(measureProgress(survey).done).toBe(1);
    survey.setValue('first', 'Madrid');
    expect(measureProgress(survey).done).toBe(0);
  });
});

describe('parity/E8-quiz-placeholders', () => {
  test('the completed page can report the score', () => {
    const survey = build({
      completedHtml: '<p>You scored {correctAnswers} of {quizQuestionCount}.</p>',
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'first', correctAnswer: 'Paris' },
            { type: 'checkbox', name: 'primes', choices: [2, 3, 4], correctAnswer: [2, 3] },
          ],
        },
      ],
    });
    survey.setValue('first', 'Paris');
    survey.setValue('primes', [2, 3]);
    survey.complete();

    // Marks rather than questions on both sides of "of", so the pair always divides
    // into a true fraction even when a checkbox is worth two.
    expect(survey.status.completedHtml).toBe('<p>You scored 3 of 3.</p>');
  });

  test('an answer of the same name still wins', () => {
    const survey = build({
      completedHtml: '<p>{correctAnswers}</p>',
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'correctAnswers' },
            { type: 'text', name: 'graded', correctAnswer: 'Paris' },
          ],
        },
      ],
    });
    survey.setValue('correctAnswers', 'mine');
    survey.setValue('graded', 'Paris');
    survey.complete();

    expect(survey.status.completedHtml).toBe('<p>mine</p>');
  });

  test('an unrelated placeholder is left to resolve to nothing', () => {
    const survey = build({
      completedHtml: '<p>{missing}</p>',
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'graded', correctAnswer: 'x' }] }],
    });
    survey.complete();

    expect(survey.status.completedHtml).toBe('<p></p>');
  });
});
