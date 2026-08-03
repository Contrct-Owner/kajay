import { MatrixDynamicQuestion, parseSurvey, serializeSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

const BASKET = {
  type: 'matrixdynamic',
  name: 'basket',
  title: 'What are you ordering?',
  columns: [
    { type: 'text', name: 'item', title: 'Item', isRequired: true },
    { type: 'text', name: 'quantity', title: 'Quantity', inputType: 'number' },
  ],
};

function build(overrides: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ ...BASKET, ...overrides }] }] },
    createTestRegistry(),
  ).survey;
}

function matrix(survey: Survey): MatrixDynamicQuestion {
  const question = survey.getQuestionByName('basket');
  if (!(question instanceof MatrixDynamicQuestion)) {
    throw new TypeError('expected a dynamic matrix');
  }
  return question;
}

function answer(survey: Survey, row: string, column: string, value: unknown): void {
  const cell = matrix(survey).cellAt(row, column);
  if (cell === undefined) {
    throw new Error(`no cell ${row}.${column}`);
  }
  cell.value = value;
}

function errorsOf(survey: Survey): readonly string[] {
  survey.validation.validateCurrentPage();
  return (survey.getQuestionByName('basket')?.errors ?? []).map(
    (error) => `${error.path ?? '(question)'}: ${error.text}`,
  );
}

describe('parity/F3-matrix-dynamic', () => {
  test('the rows are the answer: an array of row objects', () => {
    const survey = build();
    answer(survey, '0', 'item', 'Pens');

    expect(survey.data).toEqual({ basket: [{ item: 'Pens' }] });
  });

  test('a matrix nobody has touched is still no answer at all', () => {
    const survey = build({ minRowCount: 2 });

    // Two rows are on screen, and none of them is in the response. The minimum is a
    // statement about the form, not about what the respondent has said.
    expect(matrix(survey).rowCount).toBe(2);
    expect(survey.data).toEqual({});
  });

  test('adding a row keeps it even before anything is typed into it', () => {
    const survey = build();
    matrix(survey).addRow();

    // `[{}, {}]` rather than nothing: a respondent who pressed Add created something,
    // and a row that vanished on the next render would be the survey arguing with them.
    expect(matrix(survey).rowCount).toBe(2);
    expect(survey.data).toEqual({ basket: [{}, {}] });
  });

  test('a removed row takes its answers with it and the rest move up', () => {
    const survey = build({ minRowCount: 1 });
    answer(survey, '0', 'item', 'Pens');
    matrix(survey).addRow();
    answer(survey, '1', 'item', 'Paper');

    matrix(survey).removeRow('0');

    expect(survey.data).toEqual({ basket: [{ item: 'Paper' }] });
    expect(matrix(survey).cellAt('0', 'item')?.value).toBe('Paper');
  });

  test('the row count survives a save and resume with nothing stored beside it', () => {
    const survey = build();
    matrix(survey).addRow();
    answer(survey, '1', 'item', 'Paper');

    const resumed = build();
    resumed.restore(survey.progress);

    // The count is in the answer, so E6 restores it without a second source of truth
    // for how many rows there are.
    expect(matrix(resumed).rowCount).toBe(2);
    expect(matrix(resumed).cellAt('1', 'item')?.value).toBe('Paper');
  });
});

describe('parity/F3-row-limits', () => {
  test('minRowCount is a floor on removal', () => {
    const survey = build({ minRowCount: 2 });
    expect(matrix(survey).canRemoveRow).toBe(false);

    matrix(survey).addRow();
    expect(matrix(survey).canRemoveRow).toBe(true);

    matrix(survey).removeRow('0');
    expect(matrix(survey).rowCount).toBe(2);
    expect(matrix(survey).canRemoveRow).toBe(false);
  });

  test('maxRowCount is a ceiling on adding, and 0 means no limit', () => {
    const survey = build({ maxRowCount: 2 });
    matrix(survey).addRow();

    expect(matrix(survey).rowCount).toBe(2);
    expect(matrix(survey).canAddRow).toBe(false);

    matrix(survey).addRow();
    expect(matrix(survey).rowCount).toBe(2);
  });

  test('allowAddRows and allowRemoveRows close the doors outright', () => {
    const survey = build({ allowAddRows: false, allowRemoveRows: false, minRowCount: 2 });
    expect(matrix(survey).canAddRow).toBe(false);
    expect(matrix(survey).canRemoveRow).toBe(false);
  });
});

describe('parity/F3-row-defaults', () => {
  test('defaultRowValue fills a new row in', () => {
    const survey = build({ defaultRowValue: { quantity: 1 } });
    matrix(survey).addRow();

    expect(matrix(survey).cellAt('1', 'quantity')?.value).toBe(1);
  });

  test('defaultValueFromLastRow copies the row before it', () => {
    const survey = build({ defaultValueFromLastRow: true });
    answer(survey, '0', 'item', 'Pens');
    answer(survey, '0', 'quantity', 4);
    matrix(survey).addRow();

    expect(survey.data).toEqual({
      basket: [
        { item: 'Pens', quantity: 4 },
        { item: 'Pens', quantity: 4 },
      ],
    });
  });

  test('copying the last row wins over the fixed default', () => {
    const survey = build({ defaultValueFromLastRow: true, defaultRowValue: { quantity: 1 } });
    answer(survey, '0', 'quantity', 9);
    matrix(survey).addRow();

    // The more specific statement: an author asking for "like the last one" means it
    // even where a fixed default exists.
    expect(matrix(survey).cellAt('1', 'quantity')?.value).toBe(9);
  });

  test('a new row does not hand the definition out with the answers', () => {
    const survey = build({ defaultRowValue: { quantity: 1 } });
    matrix(survey).addRow();
    const rows = survey.data['basket'] as readonly Record<string, unknown>[];

    // `data` goes to the host, and the default row is part of the *definition*. Handing
    // the same object out means a host tidying up its results edits the survey it was
    // given — so a new row starts as a copy of the default, never as the default.
    expect(rows[1]).toEqual({ quantity: 1 });
    expect(rows[1]).not.toBe(matrix(survey).defaultRowValue);
  });

  test('a copied row is a copy, not the same object', () => {
    const survey = build({ defaultValueFromLastRow: true });
    answer(survey, '0', 'item', 'Pens');
    matrix(survey).addRow();
    answer(survey, '1', 'item', 'Paper');

    expect(matrix(survey).cellAt('0', 'item')?.value).toBe('Pens');
  });
});

describe('parity/F3-dynamic-validation', () => {
  test('every row is checked, and the message names the row', () => {
    const survey = build();
    matrix(survey).addRow();
    answer(survey, '0', 'item', 'Pens');

    expect(errorsOf(survey)).toEqual(['1.item: This question requires an answer.']);
  });

  test('a cell condition follows its row through a removal', () => {
    const survey = build({
      columns: [
        { type: 'text', name: 'item', title: 'Item' },
        {
          type: 'text',
          name: 'why',
          title: 'Why so many?',
          visibleIf: '{row.quantity} > 10',
        },
        { type: 'text', name: 'quantity', title: 'Quantity', inputType: 'number' },
      ],
    });
    matrix(survey).addRow();
    answer(survey, '1', 'quantity', 50);

    expect(matrix(survey).cellAt('1', 'why')?.isVisible).toBe(true);
    expect(matrix(survey).cellAt('0', 'why')?.isVisible).toBe(false);

    matrix(survey).removeRow('0');

    // The surviving row is row 0 now, and its condition was rewritten against `[1]`
    // when it was built — so every cell is rebuilt, and the rule re-registered, or the
    // question would follow the position rather than the answers.
    expect(matrix(survey).cellAt('0', 'quantity')?.value).toBe(50);
    expect(matrix(survey).cellAt('0', 'why')?.isVisible).toBe(true);
  });

  test('a total counts the rows there are now', () => {
    const survey = build({
      totals: [{ column: 'quantity', kind: 'sum' }],
    });
    answer(survey, '0', 'quantity', 2);
    matrix(survey).addRow();
    answer(survey, '1', 'quantity', 3);

    expect(matrix(survey).totalFor('quantity')).toBe(5);

    matrix(survey).removeRow('1');
    expect(matrix(survey).totalFor('quantity')).toBe(2);
  });
});

describe('parity/F3-definition', () => {
  test('the definition round-trips, and holds no row state', () => {
    const { survey } = parseSurvey(
      { pages: [{ name: 'p1', elements: [{ ...BASKET, minRowCount: 2, confirmDelete: true }] }] },
      createTestRegistry(),
    );
    matrix(survey).addRow();

    const once = serializeSurvey(survey, createTestRegistry());
    const twice = serializeSurvey(
      parseSurvey(once, createTestRegistry()).survey,
      createTestRegistry(),
    );

    expect(twice).toEqual(once);
    // Rows the respondent added are answers, and answers are not part of a definition.
    expect(JSON.stringify(once)).not.toContain('"rows"');
  });
});
