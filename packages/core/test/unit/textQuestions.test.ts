import { CommentQuestion, parseSurvey, TextQuestion } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(element: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ name: 'q', ...element }] }] },
    createTestRegistry(),
  ).survey;
}

function errorsOf(survey: Survey): readonly string[] {
  survey.validation.validateCurrentPage();
  return (survey.getQuestionByName('q')?.errors ?? []).map((error) => error.text);
}

function textQuestion(survey: Survey): TextQuestion {
  const question = survey.getQuestionByName('q');
  if (!(question instanceof TextQuestion)) {
    throw new TypeError('expected a text question');
  }
  return question;
}

function comment(survey: Survey): CommentQuestion {
  const question = survey.getQuestionByName('q');
  if (!(question instanceof CommentQuestion)) {
    throw new TypeError('expected a comment question');
  }
  return question;
}

describe('parity/C1-text-input-types', () => {
  test('every declared input type survives the round trip', () => {
    const types = [
      'text',
      'number',
      'email',
      'date',
      'datetime-local',
      'time',
      'tel',
      'url',
      'color',
      'range',
      'password',
    ];
    for (const inputType of types) {
      expect(textQuestion(build({ type: 'text', inputType })).inputType).toBe(inputType);
    }
  });

  test('an unrecognised input type falls back to text rather than reaching the DOM', () => {
    // The renderer hands this straight to `<input type>`. A definition naming a type
    // the browser does not know produces a text field either way; the difference is
    // whether the model can be reasoned about.
    expect(textQuestion(build({ type: 'text', inputType: 'nonsense' })).inputType).toBe('text');
  });

  test('a numeric input stores a number, not the string the DOM reported', () => {
    const survey = build({ type: 'text', inputType: 'number' });
    textQuestion(survey).setInputValue('42');

    // `data` is what a host submits and what expressions read. `"42" > 10` and
    // `42 > 10` happen to agree; `"9" > "10"` and `9 > 10` do not.
    expect(survey.data).toEqual({ q: 42 });
  });

  test('clearing a numeric input clears the answer rather than storing an empty string', () => {
    const survey = build({ type: 'text', inputType: 'number' });
    const question = textQuestion(survey);
    question.setInputValue('42');
    question.setInputValue('');

    expect(survey.data['q']).toBeUndefined();
  });

  test('a text input keeps the empty string, so an emptied field is still an answer key', () => {
    const survey = build({ type: 'text' });
    const question = textQuestion(survey);
    question.setInputValue('Ada');
    question.setInputValue('');

    expect(survey.data).toEqual({ q: '' });
  });
});

describe('parity/C1-text-bounds', () => {
  test('numeric bounds are checked numerically', () => {
    const survey = build({ type: 'text', inputType: 'number', min: 5, max: 10 });
    const question = textQuestion(survey);

    question.setInputValue('4');
    expect(errorsOf(survey)).toEqual(['Please enter a value no less than 5.']);

    question.setInputValue('11');
    expect(errorsOf(survey)).toEqual(['Please enter a value no greater than 10.']);

    question.setInputValue('7');
    expect(errorsOf(survey)).toEqual([]);
  });

  test('date bounds read as dates, and say so', () => {
    const survey = build({
      type: 'text',
      inputType: 'date',
      min: '2026-01-01',
      max: '2026-12-31',
    });
    const question = textQuestion(survey);

    question.setInputValue('2025-12-31');
    expect(errorsOf(survey)).toEqual(['Please enter a value no earlier than 2026-01-01.']);

    question.setInputValue('2026-06-15');
    expect(errorsOf(survey)).toEqual([]);
  });

  test('an omitted bound is not a bound of zero', () => {
    const survey = build({ type: 'text', inputType: 'number', max: 10 });
    textQuestion(survey).setInputValue('-100');
    expect(errorsOf(survey)).toEqual([]);
  });

  test('a bound and a validator both report, because both were authored', () => {
    const survey = build({
      type: 'text',
      inputType: 'number',
      min: 5,
      validators: [{ type: 'numericvalidator', minValue: 8 }],
    });
    textQuestion(survey).setInputValue('1');
    // The question's own constraint reads first: it was stated as a property, which is
    // the earlier and more specific statement.
    expect(errorsOf(survey)).toEqual([
      'Please enter a value no less than 5.',
      'Please enter a value no less than 8.',
    ]);
  });
});

describe('parity/C2-comment', () => {
  test('rows defaults to four and autoGrow is opt-in', () => {
    const question = comment(build({ type: 'comment' }));
    expect(question.rows).toBe(4);
    expect(question.autoGrow).toBe(false);
    expect(question.allowResize).toBe(true);
  });

  test('the counter reports what is left, and never goes negative', () => {
    const survey = build({ type: 'comment', maxLength: 10 });
    const question = comment(survey);
    expect(question.remainingCharacters).toBe(10);

    survey.setValue('q', 'four');
    expect(question.remainingCharacters).toBe(6);

    survey.setValue('q', 'far too long to fit');
    expect(question.remainingCharacters).toBe(0);
  });

  test('no budget means no counter', () => {
    expect(comment(build({ type: 'comment' })).remainingCharacters).toBeUndefined();
  });

  test('the budget is enforced, not merely displayed', () => {
    const survey = build({ type: 'comment', maxLength: 5 });
    // A `maxlength` attribute stops typing; it does not stop a trigger, a
    // setValueExpression or a restored `data` payload from putting a longer value there.
    survey.setValue('q', 'far too long');
    expect(errorsOf(survey)).toEqual(['Please shorten this to 5 characters or fewer.']);

    survey.setValue('q', 'short');
    expect(errorsOf(survey)).toEqual([]);
  });
});
