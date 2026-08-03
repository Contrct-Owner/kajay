import { valuesAreEqual } from '../expressions/expressionValues.js';

/**
 * How much of one question the respondent got right — checklist E8.
 *
 * A pair rather than a boolean because a multi-select is several decisions wearing one
 * question: collapsing eight tick boxes to a single mark throws away the difference
 * between nearly right and entirely wrong, which is the difference a quiz exists to
 * measure.
 *
 * Kept apart from `quizScore.ts` deliberately. Everything here is arithmetic over two
 * values and imports nothing from the model, so `Question` can score itself without
 * reaching for the survey it lives in.
 */
export interface AnswerScore {
  readonly correct: number;
  readonly total: number;
}

/** One question, one mark. The rule for every answer that is a single value. */
export function scoreSingleAnswer(value: unknown, correctAnswer: unknown): AnswerScore {
  return { correct: valuesAreEqual(value, correctAnswer) ? 1 : 0, total: 1 };
}

/**
 * A mark per expected choice, **less one for every choice that should not be there**.
 *
 * The subtraction is the whole design. Counting only the matches would give full marks
 * for ticking every box, which turns a partial-credit question into a free one; scoring
 * per *offered* choice instead would give a respondent who answered nothing at all most
 * of the marks on a question with three right answers out of eight. Rewarding the right
 * choices and charging for the wrong ones is the only arrangement where the best
 * strategy is to answer honestly.
 *
 * Floored at zero, because a question is worth no marks at its worst and taking a
 * respondent's marks from *elsewhere* is not something a quiz should be able to do
 * silently.
 */
export function scoreSelection(
  selected: readonly unknown[],
  expected: readonly unknown[],
): AnswerScore {
  const matched = expected.filter((choice) =>
    selected.some((chosen) => valuesAreEqual(chosen, choice)),
  ).length;
  const spurious = selected.filter(
    (chosen) => !expected.some((choice) => valuesAreEqual(chosen, choice)),
  ).length;
  return { correct: Math.max(0, matched - spurious), total: expected.length };
}
