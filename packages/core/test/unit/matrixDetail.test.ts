import { MatrixDynamicQuestion, parseSurvey, serializeSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

const EXPENSES = {
  type: 'matrixdynamic',
  name: 'expenses',
  title: 'Your expenses',
  detailPanelMode: 'underRow',
  minRowCount: 2,
  columns: [{ type: 'text', name: 'amount', title: 'Amount', inputType: 'number' }],
  detailElements: [
    { type: 'comment', name: 'reason', title: 'What was it for?', isRequired: true },
    { type: 'text', name: 'receipt', title: 'Receipt number', visibleIf: '{row.amount} > 50' },
  ],
};

function build(overrides: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ ...EXPENSES, ...overrides }] }] },
    createTestRegistry(),
  ).survey;
}

function matrix(survey: Survey): MatrixDynamicQuestion {
  const question = survey.getQuestionByName('expenses');
  if (!(question instanceof MatrixDynamicQuestion)) {
    throw new TypeError('expected a dynamic matrix');
  }
  return question;
}

function answer(survey: Survey, row: string, name: string, value: unknown): void {
  const cell = matrix(survey).cellAt(row, name);
  if (cell === undefined) {
    throw new Error(`no cell ${row}.${name}`);
  }
  cell.value = value;
}

describe('parity/F4-detail-panels', () => {
  test('a detail question stores into the same row as the columns', () => {
    const survey = build();
    answer(survey, '0', 'amount', 12);
    answer(survey, '0', 'reason', 'Taxi to the airport');

    // One row, one record. A detail is a cell that happens to be drawn under the row
    // rather than in a column, so nothing about the answer shape changes — and the
    // second row is still only *implied* by the minimum, so it is not in the response.
    expect(survey.data).toEqual({
      expenses: [{ amount: 12, reason: 'Taxi to the airport' }],
    });
  });

  test('a detail question is checked with the rest of its row', () => {
    const survey = build();
    answer(survey, '0', 'amount', 12);
    survey.validation.validateCurrentPage();

    expect((survey.getQuestionByName('expenses')?.errors ?? []).map((error) => error.path)).toEqual([
      '0.reason',
      '1.reason',
    ]);
  });

  test('a detail question sees its own row in a condition', () => {
    const survey = build();
    answer(survey, '0', 'amount', 90);

    expect(matrix(survey).cellAt('0', 'receipt')?.isVisible).toBe(true);
    expect(matrix(survey).cellAt('1', 'receipt')?.isVisible).toBe(false);
  });

  test('a row starts closed and opens when asked', () => {
    const survey = build();
    expect(matrix(survey).isRowExpanded('0')).toBe(false);

    matrix(survey).setRowExpanded('0', true);
    expect(matrix(survey).isRowExpanded('0')).toBe(true);
    expect(matrix(survey).isRowExpanded('1')).toBe(false);
  });

  test('underRowSingle keeps one row open at a time', () => {
    const survey = build({ detailPanelMode: 'underRowSingle' });
    matrix(survey).setRowExpanded('0', true);
    matrix(survey).setRowExpanded('1', true);

    expect(matrix(survey).isRowExpanded('0')).toBe(false);
    expect(matrix(survey).isRowExpanded('1')).toBe(true);
  });

  test('a detail holding something invalid opens itself', () => {
    const survey = build();
    survey.validation.validateCurrentPage();

    // An error nobody can see is one nobody can fix: the respondent has just been told
    // the page is wrong, and the field at fault is behind a closed panel.
    expect(matrix(survey).isRowExpanded('0')).toBe(true);

    answer(survey, '0', 'reason', 'Taxi');
    survey.validation.validateCurrentPage();
    expect(matrix(survey).isRowExpanded('0')).toBe(false);
  });

  test('no detail elements means no detail panel, whatever the mode says', () => {
    const survey = build({ detailElements: [] });
    matrix(survey).setRowExpanded('0', true);

    expect(matrix(survey).hasDetailPanel).toBe(false);
    expect(matrix(survey).isRowExpanded('0')).toBe(false);
  });

  test('the detail elements round-trip, and no expansion state is written', () => {
    const survey = build();
    matrix(survey).setRowExpanded('0', true);

    const once = serializeSurvey(survey, createTestRegistry());
    const twice = serializeSurvey(
      parseSurvey(once, createTestRegistry()).survey,
      createTestRegistry(),
    );

    expect(twice).toEqual(once);
    // Which row a respondent has open is a fact about their screen, not about the
    // survey. It is the same reasoning that keeps computed visibility out.
    expect(JSON.stringify(once)).not.toContain('expanded');
  });
});
