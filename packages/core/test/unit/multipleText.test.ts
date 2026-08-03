import { MultipleTextQuestion, parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

const ADDRESS = {
  type: 'multipletext',
  name: 'address',
  title: 'Where do you live?',
  colCount: 2,
  itemSize: 20,
  items: [
    { name: 'street', title: 'Street', isRequired: true },
    { name: 'city', title: 'City' },
    {
      name: 'postcode',
      title: 'Postcode',
      size: 8,
      validators: [{ type: 'regexvalidator', regex: '^[0-9]{5}$', text: 'Five digits, please.' }],
    },
  ],
};

function build(
  element: Readonly<Record<string, unknown>> = ADDRESS,
  extra: readonly Readonly<Record<string, unknown>>[] = [],
): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [element, ...extra] }] },
    createTestRegistry(),
  ).survey;
}

function address(survey: Survey): MultipleTextQuestion {
  const question = survey.getQuestionByName('address');
  if (!(question instanceof MultipleTextQuestion)) {
    throw new TypeError('expected a multipletext question');
  }
  return question;
}

/** Each error as `path: text`, which is the pair the row is actually about. */
function errorsOf(survey: Survey): readonly string[] {
  survey.validation.validateCurrentPage();
  return (survey.getQuestionByName('address')?.errors ?? []).map(
    (error) => `${error.path ?? '(question)'}: ${error.text}`,
  );
}

describe('parity/C11-multipletext', () => {
  test('the answer is one object under the question name', () => {
    const survey = build();
    const question = address(survey);
    question.setItemValue('street', '12 Long Road');
    question.setItemValue('city', 'Cambridge');

    expect(survey.data).toEqual({ address: { street: '12 Long Road', city: 'Cambridge' } });
  });

  test('an emptied field leaves, and an empty question stops being an answer at all', () => {
    const survey = build();
    const question = address(survey);
    question.setItemValue('street', '12 Long Road');
    question.setItemValue('street', '');

    // `{}` is not empty by any test the engine applies, so a required question would
    // be satisfied by an object full of blanks and `data` would carry a key for a
    // question nobody answered.
    expect(survey.data).toEqual({});
    expect(question.value).toBeUndefined();
  });

  test('an expression elsewhere can reach a single field', () => {
    const survey = build(ADDRESS, [
      { type: 'text', name: 'echo', defaultValueExpression: '{address.city}' },
    ]);
    address(survey).setItemValue('city', 'Cambridge');

    // Nothing was added for this: the path resolver already walks dotted references,
    // which is what storing a real object rather than a flattened prefix buys.
    expect(survey.data['echo']).toBe('Cambridge');
  });

  test('a required item reports against itself, not against the question', () => {
    const survey = build();
    address(survey).setItemValue('city', 'Cambridge');

    expect(errorsOf(survey)).toEqual(['street: This question requires an answer.']);
  });

  test('per-item validators run against the item value, not the whole object', () => {
    const survey = build();
    const question = address(survey);
    question.setItemValue('street', '12 Long Road');
    question.setItemValue('postcode', 'nope');

    expect(errorsOf(survey)).toEqual(['postcode: Five digits, please.']);

    question.setItemValue('postcode', '12345');
    expect(errorsOf(survey)).toEqual([]);
  });

  test('a required item objects even when nothing at all has been typed', () => {
    const survey = build();

    // The whole answer is empty, so the question-level check would ordinarily stop
    // there — and a required field that says nothing until some *other* field is filled
    // in is a required field that does not work. Found while building the matrix, whose
    // rows have exactly the same shape.
    expect(errorsOf(survey)).toEqual(['street: This question requires an answer.']);
  });

  test('a question required as a whole objects about itself, with no field named', () => {
    const survey = build({
      type: 'multipletext',
      name: 'address',
      isRequired: true,
      items: [{ name: 'street', title: 'Street' }],
    });

    expect(errorsOf(survey)).toEqual(['(question): This question requires an answer.']);
  });

  test('an empty optional item is not validated, exactly as an empty question is not', () => {
    const survey = build();
    address(survey).setItemValue('street', '12 Long Road');
    // `postcode` is empty and has a pattern. Reporting it would be objecting to an
    // omission the author never said was one.
    expect(errorsOf(survey)).toEqual([]);
  });

  test('every failing item reports, not just the first', () => {
    const survey = build();
    address(survey).setItemValue('postcode', 'nope');

    expect(errorsOf(survey)).toEqual([
      'street: This question requires an answer.',
      'postcode: Five digits, please.',
    ]);
  });

  test('an item falls back to the question size, and its own wins', () => {
    const question = address(build());
    const [street, , postcode] = question.items;
    expect(question.itemSize).toBe(20);
    expect(street?.size).toBe(0);
    expect(postcode?.size).toBe(8);
  });

  test('an item title falls back to its name', () => {
    const survey = build({
      type: 'multipletext',
      name: 'address',
      items: [{ name: 'street' }],
    });
    expect(address(survey).items[0]?.title).toBe('street');
  });
});
