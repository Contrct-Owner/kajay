import { MatrixQuestion, matrixRowKey, parseSurvey, serializeSurvey } from '@kajay/core';
import type { ItemValue, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

const COMPARISON = {
  type: 'matrix',
  name: 'comparison',
  title: 'How do these compare?',
  columns: [
    { value: 1, text: 'First' },
    { value: 2, text: 'Second' },
    { value: 3, text: 'Third' },
  ],
  rows: [
    { value: 'docs', text: 'Documentation' },
    { value: 'support', text: 'Support' },
    { value: 'price', text: 'Price' },
  ],
};

function build(overrides: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ ...COMPARISON, ...overrides }] }] },
    createTestRegistry(),
  ).survey;
}

function matrix(survey: Survey): MatrixQuestion {
  const question = survey.getQuestionByName('comparison');
  if (!(question instanceof MatrixQuestion)) {
    throw new TypeError('expected a matrix question');
  }
  return question;
}

/** A row by its value, so a test says `answer('docs', …)` rather than counting. */
function rowOf(question: MatrixQuestion, value: string): ItemValue {
  const row = question.rows.find((candidate) => matrixRowKey(candidate) === value);
  if (row === undefined) {
    throw new Error(`no row ${value}`);
  }
  return row;
}

function answer(question: MatrixQuestion, row: string, column: unknown): void {
  question.setRowValue(rowOf(question, row), column);
}

/** Each error as `row: text`, which is the pair every §F row is actually about. */
function errorsOf(survey: Survey): readonly string[] {
  survey.validation.validateCurrentPage();
  return (survey.getQuestionByName('comparison')?.errors ?? []).map(
    (error) => `${error.path ?? '(question)'}: ${error.text}`,
  );
}

describe('parity/F1-matrix', () => {
  test('the answer is one object keyed by row, under the question name', () => {
    const survey = build();
    const question = matrix(survey);
    answer(question, 'docs', 1);
    answer(question, 'price', 3);

    expect(survey.data).toEqual({ comparison: { docs: 1, price: 3 } });
  });

  test('a row holds one answer: picking again replaces it', () => {
    const survey = build();
    const question = matrix(survey);
    answer(question, 'docs', 1);
    answer(question, 'docs', 2);

    expect(survey.data).toEqual({ comparison: { docs: 2 } });
    expect(question.isSelected(rowOf(question, 'docs'), question.columns[1] as ItemValue)).toBe(
      true,
    );
  });

  test('a matrix with every row cleared stops being an answer at all', () => {
    const survey = build();
    const question = matrix(survey);
    answer(question, 'docs', 1);
    question.clearRow(rowOf(question, 'docs'));

    // `{}` is not empty by any test the engine applies, so a required matrix would be
    // satisfied by an object with no rows in it.
    expect(survey.data).toEqual({});
    expect(question.value).toBeUndefined();
  });

  test('an expression elsewhere can reach a single row', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              COMPARISON,
              { type: 'text', name: 'echo', defaultValueExpression: '{comparison.docs}' },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    answer(matrix(survey), 'docs', 2);

    // Nothing was added for this: storing a real object rather than a flat prefix is
    // what the dotted path resolver already walks.
    expect(survey.data['echo']).toBe(2);
  });

  test('an answer restored as a string still matches the column it names', () => {
    const survey = build();
    // What JSON storage and a host handing back `data` both do to a numeric column.
    survey.setValue('comparison', { docs: '2' });
    const question = matrix(survey);

    expect(question.isSelected(rowOf(question, 'docs'), question.columns[1] as ItemValue)).toBe(
      true,
    );
  });
});

describe('parity/F1-matrix-required', () => {
  test('a required matrix objects once, about the question', () => {
    const survey = build({ isRequired: true });

    // One message and no row is singled out: nothing has been answered, so no row is
    // more at fault than any other.
    expect(errorsOf(survey)).toEqual(['(question): This question requires an answer.']);
  });

  test('a required matrix is satisfied by one row', () => {
    const survey = build({ isRequired: true });
    answer(matrix(survey), 'docs', 1);

    expect(errorsOf(survey)).toEqual([]);
  });

  test('isAllRowRequired names every row that is missing, not just the first', () => {
    const survey = build({ isAllRowRequired: true });
    answer(matrix(survey), 'support', 2);

    expect(errorsOf(survey)).toEqual([
      'docs: This row requires an answer.',
      'price: This row requires an answer.',
    ]);
  });

  test('isAllRowRequired reports every row even when nothing at all was answered', () => {
    const survey = build({ isAllRowRequired: true });

    // The case that needs saying: the whole answer is empty, so the question-level
    // check would ordinarily stop here and no row would be mentioned.
    expect(errorsOf(survey)).toEqual([
      'docs: This row requires an answer.',
      'support: This row requires an answer.',
      'price: This row requires an answer.',
    ]);
  });

  test('the row messages replace the question one rather than joining it', () => {
    const survey = build({ isRequired: true, isAllRowRequired: true });

    // Told where to act, not merely that something is missing — and not both.
    expect(errorsOf(survey)).toEqual([
      'docs: This row requires an answer.',
      'support: This row requires an answer.',
      'price: This row requires an answer.',
    ]);
  });

  test('requiredErrorText applies to the row, which is what asked for an answer', () => {
    const survey = build({ isAllRowRequired: true, requiredErrorText: 'Please rank this one.' });
    answer(matrix(survey), 'docs', 1);
    answer(matrix(survey), 'support', 2);

    expect(errorsOf(survey)).toEqual(['price: Please rank this one.']);
  });

  test('a hidden row is not asked for an answer nobody can give', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'mode' },
              {
                ...COMPARISON,
                isAllRowRequired: true,
                rows: [
                  { value: 'docs', text: 'Documentation' },
                  { value: 'price', text: 'Price', visibleIf: "{mode} = 'full'" },
                ],
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    expect(errorsOf(survey)).toEqual(['docs: This row requires an answer.']);

    survey.setValue('mode', 'full');
    expect(errorsOf(survey)).toEqual([
      'docs: This row requires an answer.',
      'price: This row requires an answer.',
    ]);
  });
});

describe('parity/F1-matrix-each-row-unique', () => {
  test('the second row to use a column is the one that objects', () => {
    const survey = build({ eachRowUnique: true });
    const question = matrix(survey);
    answer(question, 'docs', 1);
    answer(question, 'support', 1);

    // Not both: the first row to use it is not the mistake, and marking it would send
    // the respondent to change an answer they had just made.
    expect(errorsOf(survey)).toEqual(['support: Each row needs a different answer.']);
  });

  test('a third row using the same column objects as well', () => {
    const survey = build({ eachRowUnique: true });
    const question = matrix(survey);
    answer(question, 'docs', 1);
    answer(question, 'support', 1);
    answer(question, 'price', 1);

    expect(errorsOf(survey)).toEqual([
      'support: Each row needs a different answer.',
      'price: Each row needs a different answer.',
    ]);
  });

  test('different columns are fine, and so are unanswered rows', () => {
    const survey = build({ eachRowUnique: true });
    const question = matrix(survey);
    answer(question, 'docs', 1);
    answer(question, 'support', 2);

    // Two rows left empty is not two rows sharing a column: `eachRowUnique` is a
    // statement about answers, and there is nothing to compare.
    expect(errorsOf(survey)).toEqual([]);
  });

  test('without eachRowUnique two rows may share a column', () => {
    const survey = build();
    const question = matrix(survey);
    answer(question, 'docs', 1);
    answer(question, 'support', 1);

    expect(errorsOf(survey)).toEqual([]);
  });

  test('a row reports one thing at a time', () => {
    const survey = build({ eachRowUnique: true, isAllRowRequired: true });
    const question = matrix(survey);
    answer(question, 'docs', 1);
    answer(question, 'support', 1);

    // `price` is missing and `support` is a duplicate, each said once.
    expect(errorsOf(survey)).toEqual([
      'support: Each row needs a different answer.',
      'price: This row requires an answer.',
    ]);
  });
});

describe('parity/F1-matrix-definition', () => {
  test('rows and columns round-trip, including the short form', () => {
    const definition = {
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'matrix',
              name: 'comparison',
              alternateRows: true,
              eachRowUnique: true,
              columns: ['yes', 'no'],
              rows: [{ value: 'docs', text: 'Documentation' }],
            },
          ],
        },
      ],
    };
    const { survey } = parseSurvey(definition, createTestRegistry());
    const question = matrix(survey);

    expect(question.columns.map((column) => column.text)).toEqual(['yes', 'no']);
    expect(question.alternateRows).toBe(true);
    // ADR-0002's fixed point: what came in comes out, and stays out.
    const once = serializeSurvey(survey);
    const twice = serializeSurvey(parseSurvey(once, createTestRegistry()).survey);
    expect(twice).toEqual(once);
  });

  test('the matrix is a question like any other, and the registry knows it', () => {
    const survey = build();
    expect(matrix(survey).type).toBe('matrix');
    // Not answered in one action: three rows are three decisions, so a survey set to
    // advance automatically must not turn the page on the first of them.
    expect(matrix(survey).answersInOneStep).toBe(false);
  });
});
