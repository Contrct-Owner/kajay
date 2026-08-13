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

/** How a blank's answer is compared with the one that scores it — checklist C13. */
export interface TextMatchOptions {
  readonly trim: boolean;
  readonly caseSensitive: boolean;
}

/**
 * Whether a typed answer matches the authored one — ADR-0048 §6.
 *
 * **Compared as text whenever either side is text**, which is what makes a numeric
 * `correctAnswer` work: a respondent types into an input and gets a string back, so
 * `42` authored against `"42"` typed is the same answer and only a comparison that
 * refused to look would say otherwise.
 *
 * Trimming and case are the author's call per blank, because one sentence can hold a
 * prose answer and a case-sensitive code. Both default toward forgiving: an assessment
 * marking `paris` wrong is measuring typing rather than geography.
 */
export function matchesAuthoredText(
  value: unknown,
  correctAnswer: unknown,
  options: TextMatchOptions,
): boolean {
  if (typeof correctAnswer !== 'string' && typeof value !== 'string') {
    return valuesAreEqual(value, correctAnswer);
  }
  return normalize(value, options) === normalize(correctAnswer, options);
}

function normalize(value: unknown, { trim, caseSensitive }: TextMatchOptions): string {
  const text = trim ? String(value ?? '').trim() : String(value ?? '');
  return caseSensitive ? text : text.toLowerCase();
}
