import { BooleanQuestion, parseSurvey, RatingQuestion } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(element: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ name: 'q', ...element }] }] },
    createTestRegistry(),
  ).survey;
}

function boolean(element: Readonly<Record<string, unknown>> = {}): BooleanQuestion {
  const question = build({ type: 'boolean', ...element }).getQuestionByName('q');
  if (!(question instanceof BooleanQuestion)) {
    throw new TypeError('expected a boolean question');
  }
  return question;
}

function rating(element: Readonly<Record<string, unknown>> = {}): RatingQuestion {
  const question = build({ type: 'rating', ...element }).getQuestionByName('q');
  if (!(question instanceof RatingQuestion)) {
    throw new TypeError('expected a rating question');
  }
  return question;
}

describe('parity/C7-boolean', () => {
  test('unanswered is a third state, not false', () => {
    const question = boolean();
    // Collapsing "was never asked" into "did not agree" is how a required consent
    // question becomes unanswerable and a submitted record becomes dishonest.
    expect(question.checkedValue).toBeUndefined();
    expect(question.value).toBeUndefined();
    expect(question.isRequired).toBe(false);
  });

  test('the stored value is what the definition asked for, not always a boolean', () => {
    const question = boolean({ valueTrue: 'yes', valueFalse: 'no' });
    question.setChecked(true);
    expect(question.value).toBe('yes');
    expect(question.checkedValue).toBe(true);

    question.setChecked(false);
    expect(question.value).toBe('no');
    expect(question.checkedValue).toBe(false);
  });

  test('booleans are the default on both ends', () => {
    const question = boolean();
    question.setChecked(true);
    expect(question.value).toBe(true);
    question.setChecked(false);
    expect(question.value).toBe(false);
  });

  test('an answer restored as a string is still recognised', () => {
    const survey = build({ type: 'boolean' });
    // A JSON round trip through somebody's backend can turn `true` into `"true"`, and
    // a survey that forgot the answer over that would be a poor kind of resume.
    survey.setData({ q: 'true' });
    const question = survey.getQuestionByName('q');
    expect(question instanceof BooleanQuestion && question.checkedValue).toBe(true);
  });

  test('clearing puts it back to unanswered', () => {
    const question = boolean();
    question.setChecked(true);
    question.setChecked(undefined);
    expect(question.checkedValue).toBeUndefined();
  });

  test('labels default to Yes and No, and the switch is the default form', () => {
    const question = boolean();
    expect([question.labelTrue, question.labelFalse]).toEqual(['Yes', 'No']);
    expect(question.renderAs).toBe('switch');
    expect(boolean({ renderAs: 'radio' }).renderAs).toBe('radio');
  });
});

describe('parity/C8-rating', () => {
  test('the scale is generated from the range when none was authored', () => {
    const question = rating();
    expect(question.rateValues.map((step) => step.value)).toEqual([1, 2, 3, 4, 5]);
  });

  test('the step is honoured, and a non-positive one is treated as 1', () => {
    expect(rating({ rateMin: 0, rateMax: 10, rateStep: 5 }).rateValues.map((s) => s.value)).toEqual(
      [0, 5, 10],
    );
    expect(rating({ rateMax: 3, rateStep: 0 }).rateValues.map((s) => s.value)).toEqual([1, 2, 3]);
  });

  test('authored rateValues replace the range entirely', () => {
    const question = rating({
      rateValues: [
        { value: 'poor', text: 'Poor' },
        { value: 'good', text: 'Good' },
      ],
    });
    expect(question.rateValues.map((step) => step.text)).toEqual(['Poor', 'Good']);
  });

  test('a generated scale never serializes, so the range stays the source of truth', () => {
    const survey = build({ type: 'rating', rateMax: 3 });
    // Writing three rows into the definition would leave an author who later edits
    // rateMax with rows that quietly disagree with it.
    expect(survey.getQuestionByName('q')?.getChildren('rateValues')).toHaveLength(0);
  });

  test('picking the chosen step again clears it, which is the only way back', () => {
    const question = rating();
    question.select(3);
    expect(question.value).toBe(3);
    question.select(3);
    expect(question.value).toBeUndefined();
  });

  test('a star scale needs a position, not a value, to know what to fill', () => {
    const question = rating({ rateType: 'stars' });
    expect(question.selectedPosition).toBe(0);
    question.select(3);
    expect(question.selectedPosition).toBe(3);
  });

  test('auto collapses a long scale and leaves a short one alone', () => {
    expect(rating().effectiveDisplayMode).toBe('buttons');
    expect(rating({ rateMin: 0, rateMax: 10 }).effectiveDisplayMode).toBe('dropdown');
    // An explicit choice is never second-guessed.
    expect(rating({ rateMin: 0, rateMax: 10, displayMode: 'buttons' }).effectiveDisplayMode).toBe(
      'buttons',
    );
  });

  test('the end descriptions are absent unless the author wrote them', () => {
    expect(rating().minRateDescription).toBe('');
    expect(rating({ minRateDescription: 'Not at all' }).minRateDescription).toBe('Not at all');
  });
});
