import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { MatrixCellsQuestion, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

const REVIEW = {
  type: 'matrixcells',
  name: 'review',
  title: 'Tell us about each area',
  rows: [
    { value: 'docs', text: 'Documentation' },
    { value: 'support', text: 'Support' },
  ],
  columns: [
    {
      type: 'dropdown',
      name: 'quality',
      title: 'Quality',
      choices: [
        { value: 'good', text: 'Good' },
        { value: 'poor', text: 'Poor' },
      ],
    },
    {
      // Asked only where the answer beside it says something went wrong. `{row.quality}`
      // is the cell to its left, in this row.
      type: 'comment',
      name: 'notes',
      title: 'What went wrong?',
      visibleIf: "{row.quality} = 'poor'",
      isRequired: true,
    },
  ],
};

function build(overrides: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ ...REVIEW, ...overrides }] }] },
    createTestRegistry(),
  ).survey;
}

function matrix(survey: Survey, name = 'review'): MatrixCellsQuestion {
  const question = survey.getQuestionByName(name);
  if (question?.type !== 'matrixcells') {
    throw new TypeError('expected a cell matrix');
  }
  return question as MatrixCellsQuestion;
}

function answer(survey: Survey, row: string, column: string, value: unknown): void {
  const cell = matrix(survey).cellAt(row, column);
  if (cell === undefined) {
    throw new Error(`no cell ${row}.${column}`);
  }
  cell.value = value;
}

function errorsOf(survey: Survey, name = 'review'): readonly string[] {
  survey.validation.validateCurrentPage();
  return (survey.getQuestionByName(name)?.errors ?? []).map(
    (error) => `${error.path ?? '(question)'}: ${error.text}`,
  );
}

describe('parity/F2-matrix-cells', () => {
  test('a column is an ordinary question, and each cell is one of its own', () => {
    const question = matrix(build());
    const cell = question.cellAt('docs', 'quality');

    // Not a bespoke cell object: the dropdown's own type, with the choices the column
    // declared, which is what makes every renderer and validator work inside a table.
    expect(cell?.type).toBe('dropdown');
    expect(question.cellAt('docs', 'notes')?.type).toBe('comment');
  });

  test('the answer is an object of objects, keyed by row and then column', () => {
    const survey = build();
    answer(survey, 'docs', 'quality', 'good');
    answer(survey, 'support', 'quality', 'poor');

    expect(survey.data).toEqual({
      review: { docs: { quality: 'good' }, support: { quality: 'poor' } },
    });
  });

  test('cells of the same column in different rows are separate answers', () => {
    const survey = build();
    answer(survey, 'docs', 'quality', 'good');

    expect(matrix(survey).cellAt('docs', 'quality')?.value).toBe('good');
    expect(matrix(survey).cellAt('support', 'quality')?.value).toBeUndefined();
  });

  test('an expression elsewhere reaches a single cell', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              REVIEW,
              { type: 'text', name: 'echo', defaultValueExpression: '{review.docs.quality}' },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    answer(survey, 'docs', 'quality', 'good');

    expect(survey.data['echo']).toBe('good');
  });

  test('an emptied cell leaves its row, and an emptied row leaves the matrix', () => {
    const survey = build();
    answer(survey, 'docs', 'quality', 'good');
    matrix(survey).clearCell('docs', 'quality');

    // Not `{ review: { docs: {} } }`: an object is not empty by any test the engine
    // applies, so a required matrix would be satisfied by a table full of nothing.
    expect(survey.data).toEqual({});
  });

  test('the cells keep their identity across reads', () => {
    const question = matrix(build());
    // A renderer keys rows by these and focus lives in them; rebuilding on every read
    // would lose both on every keystroke.
    expect(question.cellAt('docs', 'quality')).toBe(question.cellAt('docs', 'quality'));
  });
});

describe('parity/F2-cell-conditions', () => {
  test('a cell condition is asked about its own row', () => {
    const survey = build();
    answer(survey, 'docs', 'quality', 'poor');

    // The column says `{row.quality} = 'poor'`, and only the row that said so shows it.
    expect(matrix(survey).cellAt('docs', 'notes')?.isVisible).toBe(true);
    expect(matrix(survey).cellAt('support', 'notes')?.isVisible).toBe(false);
  });

  test('the rewritten condition is a real dependency, not a re-read', () => {
    const survey = build();
    answer(survey, 'support', 'quality', 'poor');
    answer(survey, 'support', 'quality', 'good');

    // Back to hidden in the same settle that changed the cell beside it: the condition
    // became `{review.support.quality}` when the cell was built, so the graph knows what
    // it reads.
    expect(matrix(survey).cellAt('support', 'notes')?.isVisible).toBe(false);
  });

  test('a hidden cell is not checked, and a visible one is', () => {
    const survey = build();
    answer(survey, 'docs', 'quality', 'poor');

    // `notes` is required, but only where it is shown — an error against a cell the
    // respondent cannot see is one they cannot act on.
    expect(errorsOf(survey)).toEqual(['docs.notes: This question requires an answer.']);

    answer(survey, 'docs', 'notes', 'The examples are out of date.');
    expect(errorsOf(survey)).toEqual([]);
  });

  test('a message is recorded on the cell as well, where its renderer will find it', () => {
    const survey = build();
    answer(survey, 'docs', 'quality', 'poor');
    errorsOf(survey);

    // Reported twice on purpose: the survey needs to know the matrix is unanswered,
    // and the cell's own renderer draws messages the way it does anywhere else.
    expect(matrix(survey).cellAt('docs', 'notes')?.errors.map((error) => error.text)).toEqual([
      'This question requires an answer.',
    ]);
  });

  test('clearing the matrix errors clears the cells', () => {
    const survey = build();
    answer(survey, 'docs', 'quality', 'poor');
    errorsOf(survey);
    survey.getQuestionByName('review')?.setErrors([]);

    expect(matrix(survey).cellAt('docs', 'notes')?.errors).toEqual([]);
  });

  test('a hidden row asks nothing of anybody', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'mode' },
              {
                ...REVIEW,
                rows: [
                  { value: 'docs', text: 'Documentation' },
                  { value: 'extra', text: 'Extra', visibleIf: "{mode} = 'full'" },
                ],
                columns: [{ type: 'text', name: 'note', title: 'Note', isRequired: true }],
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    expect(errorsOf(survey)).toEqual(['docs.note: This question requires an answer.']);

    survey.setValue('mode', 'full');
    expect(errorsOf(survey)).toEqual([
      'docs.note: This question requires an answer.',
      'extra.note: This question requires an answer.',
    ]);
  });
});

describe('parity/F2-column-totals', () => {
  const BASKET = {
    type: 'matrixcells',
    name: 'basket',
    rows: [{ value: 'a' }, { value: 'b' }],
    columns: [{ type: 'text', name: 'price', title: 'Price', inputType: 'number' }],
    totals: [{ column: 'price', kind: 'sum', format: 'Total: {0}', precision: 2 }],
  };

  test('a total is computed over the column and formatted by its own template', () => {
    const survey = parseSurvey(
      { pages: [{ name: 'p1', elements: [BASKET] }] },
      createTestRegistry(),
    ).survey;
    const question = matrix(survey, 'basket');
    question.cellAt('a', 'price')!.value = 10;
    question.cellAt('b', 'price')!.value = 2.5;

    expect(question.totalFor('price')).toBe(12.5);
    expect(question.totalText('price')).toBe('Total: 12.50');
  });

  test('a column nobody answered totals to nothing, not to zero', () => {
    const survey = parseSurvey(
      { pages: [{ name: 'p1', elements: [BASKET] }] },
      createTestRegistry(),
    ).survey;

    // Zero is an answer. Printing it under a column with no answers states a result
    // nobody produced.
    expect(matrix(survey, 'basket').totalFor('price')).toBeUndefined();
    expect(matrix(survey, 'basket').totalText('price')).toBe('');
  });

  test('count counts answers rather than rows', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [{ ...BASKET, totals: [{ column: 'price', kind: 'count' }] }],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    const question = matrix(survey, 'basket');
    question.cellAt('a', 'price')!.value = 10;

    expect(question.totalFor('price')).toBe(1);
  });

  test('a column with no total declared has none', () => {
    const survey = parseSurvey(
      { pages: [{ name: 'p1', elements: [{ ...BASKET, totals: [] }] }] },
      createTestRegistry(),
    ).survey;

    expect(matrix(survey, 'basket').totalFor('price')).toBeUndefined();
  });
});

describe('parity/F2-definition', () => {
  test('columns round-trip as the question definitions they are', () => {
    const { survey } = parseSurvey(
      { pages: [{ name: 'p1', elements: [REVIEW] }] },
      createTestRegistry(),
    );
    const once = serializeSurvey(survey, createTestRegistry());
    const twice = serializeSurvey(
      parseSurvey(once, createTestRegistry()).survey,
      createTestRegistry(),
    );

    expect(twice).toEqual(once);
  });

  test('the definition keeps the row scope the author wrote, never the rewritten form', () => {
    const { survey } = parseSurvey(
      { pages: [{ name: 'p1', elements: [REVIEW] }] },
      createTestRegistry(),
    );
    const column = matrix(survey).columns.find((candidate) => candidate.name === 'notes');

    // The cell's copy carries `{review.docs.quality}`; the column — the thing that
    // serializes — still says what was authored.
    expect(column?.getPropertyValue('visibleIf')).toBe("{row.quality} = 'poor'");
    expect(matrix(survey).cellAt('docs', 'notes')?.getPropertyValue('visibleIf')).toBe(
      "{review.docs.quality} = 'poor'",
    );
  });

  test('the column templates are not questions of the survey', () => {
    const survey = build();
    // They never render and hold no answer. A column reaching `survey.questions` would
    // put a phantom into `data`, the progress count and the preview.
    expect(survey.questions.map((question) => question.name)).toEqual(['review']);
    expect(survey.getQuestionByName('quality')).toBeUndefined();
  });
});
