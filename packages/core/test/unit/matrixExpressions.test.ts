import { MatrixDynamicQuestion, parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { scopeReferences } from '../../src/expressions/scopeReferences.js';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * A line has a unit price, a quantity, and a total the respondent never types.
 *
 * The interesting property is that none of these three columns is special: the computed
 * one is an ordinary `expression` question, and what makes it a *row* calculation is
 * that `{row.unit}` was rewritten into a real path when the cell was built.
 */
const ORDER = {
  type: 'matrixdynamic',
  name: 'order',
  title: 'Your order',
  columns: [
    { type: 'text', name: 'unit', title: 'Unit price', inputType: 'number' },
    { type: 'text', name: 'quantity', title: 'Quantity', inputType: 'number' },
    { type: 'expression', name: 'line', title: 'Line total', expression: '{row.unit} * {row.quantity}' },
  ],
  totals: [
    { column: 'quantity', kind: 'sum' },
    { column: 'line', kind: 'sum' },
  ],
};

function build(overrides: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ ...ORDER, ...overrides }] }] },
    createTestRegistry(),
  ).survey;
}

function matrix(survey: Survey): MatrixDynamicQuestion {
  const question = survey.getQuestionByName('order');
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

describe('parity/F5-row-expressions', () => {
  test('a computed cell computes from its own row', () => {
    const survey = build();
    answer(survey, '0', 'unit', 3);
    answer(survey, '0', 'quantity', 4);

    expect(matrix(survey).cellAt('0', 'line')?.value).toBe(12);
    expect(survey.data).toEqual({ order: [{ unit: 3, quantity: 4, line: 12 }] });
  });

  test('each row computes from itself and no other', () => {
    const survey = build();
    answer(survey, '0', 'unit', 3);
    answer(survey, '0', 'quantity', 4);
    matrix(survey).addRow();
    answer(survey, '1', 'unit', 10);
    answer(survey, '1', 'quantity', 2);

    expect(matrix(survey).cellAt('0', 'line')?.value).toBe(12);
    expect(matrix(survey).cellAt('1', 'line')?.value).toBe(20);
  });

  test('the computed cell settles in the same pass as the answer that drives it', () => {
    const survey = build();
    answer(survey, '0', 'unit', 3);
    answer(survey, '0', 'quantity', 4);

    // Not after a second event, and not on the next render: the rewritten expression is
    // a declared graph read, so the write is ordered inside one transaction.
    let seen: unknown;
    survey.onValueChanged.add(() => {
      seen = matrix(survey).cellAt('0', 'line')?.value;
    });
    answer(survey, '0', 'quantity', 5);

    expect(seen).toBe(15);
  });

  test('a default expression fills a cell from its row and yields to the respondent', () => {
    const survey = build({
      columns: [
        { type: 'text', name: 'unit', title: 'Unit price', inputType: 'number' },
        {
          type: 'text',
          name: 'quantity',
          title: 'Quantity',
          inputType: 'number',
          defaultValueExpression: 'iif({row.unit} > 0, 1, 0)',
        },
      ],
      totals: [],
    });
    answer(survey, '0', 'unit', 5);
    expect(matrix(survey).cellAt('0', 'quantity')?.value).toBe(1);

    answer(survey, '0', 'quantity', 9);
    answer(survey, '0', 'unit', 6);
    // The default stops the moment the respondent types over it, exactly as on a page.
    expect(matrix(survey).cellAt('0', 'quantity')?.value).toBe(9);
  });

  test('a validator on a column is checked against its own row', () => {
    const survey = build({
      columns: [
        { type: 'text', name: 'unit', title: 'Unit price', inputType: 'number' },
        {
          type: 'text',
          name: 'quantity',
          title: 'Quantity',
          inputType: 'number',
          validators: [
            {
              type: 'expressionvalidator',
              expression: '{row.quantity} <= {row.unit}',
              text: 'Not more than the unit price. It is a strange shop.',
            },
          ],
        },
      ],
      totals: [],
    });
    answer(survey, '0', 'unit', 5);
    answer(survey, '0', 'quantity', 2);
    survey.validation.validateCurrentPage();

    // Accepted, which is the half that matters: an expression left unscoped reads a
    // `row` nothing supplies, compares two undefineds and objects to a perfectly good
    // answer. The validator is an element hanging off the column, and its expression
    // was rewritten with everything else in the copied tree.
    expect(survey.getQuestionByName('order')?.errors ?? []).toEqual([]);

    answer(survey, '0', 'quantity', 9);
    survey.validation.validateCurrentPage();
    expect(
      (survey.getQuestionByName('order')?.errors ?? []).map((error) => error.path),
    ).toEqual(['0.quantity']);
  });
});

describe('parity/F5-total-expressions', () => {
  test('a total may be computed from the other totals', () => {
    const survey = build({
      totals: [
        { column: 'quantity', kind: 'sum' },
        { column: 'line', kind: 'sum' },
        { column: 'unit', expression: '{row.line} / {row.quantity}', format: '{0} each' },
      ],
    });
    answer(survey, '0', 'unit', 4);
    answer(survey, '0', 'quantity', 2);
    matrix(survey).addRow();
    answer(survey, '1', 'unit', 10);
    answer(survey, '1', 'quantity', 2);

    // 8 + 20 over 4 items. `{row.line}` in a total means that column's own total, which
    // is the same word meaning the same thing one level up from a cell condition.
    expect(matrix(survey).totalFor('unit')).toBe(7);
    expect(matrix(survey).totalText('unit')).toBe('7 each');
  });

  test('totals are computed in declaration order, and one may not read ahead', () => {
    const survey = build({
      totals: [
        { column: 'unit', expression: '{row.line} + 1' },
        { column: 'line', kind: 'sum' },
      ],
    });
    answer(survey, '0', 'unit', 4);
    answer(survey, '0', 'quantity', 2);

    // `line` has not been computed when `unit` asks for it. Nothing rather than a wrong
    // number: a figure under a column is read as a fact and cannot be caveated.
    expect(matrix(survey).totalFor('unit')).toBeUndefined();
  });

  test('a total expression may read the rest of the survey too', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'rate', inputType: 'number' },
              {
                ...ORDER,
                totals: [
                  { column: 'line', kind: 'sum' },
                  { column: 'quantity', expression: '{row.line} * {rate}' },
                ],
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    survey.setValue('rate', 2);
    answer(survey, '0', 'unit', 3);
    answer(survey, '0', 'quantity', 4);

    // `row` is an overlay, not a replacement: everything that is not a column total is
    // still an ordinary answer.
    expect(matrix(survey).totalFor('quantity')).toBe(24);
  });

  test('a broken total expression shows nothing', () => {
    const survey = build({
      totals: [{ column: 'line', expression: '{row.line} +' }],
    });
    answer(survey, '0', 'unit', 3);

    expect(matrix(survey).totalText('line')).toBe('');
  });

  test('a total expression that is not a number shows nothing either', () => {
    const survey = build({
      totals: [{ column: 'line', expression: "'about ' + 3" }],
    });
    answer(survey, '0', 'unit', 3);

    // A total is a figure. Handing a string to the formatter is how a table cell ends
    // up reading `[object Object]`, or how `toFixed` takes the page down.
    expect(matrix(survey).totalFor('line')).toBeUndefined();
    expect(matrix(survey).totalText('line')).toBe('');
  });
});

describe('parity/F5-scope-rewriting', () => {
  test('the rewrite is a pure function over the expression text', () => {
    expect(
      scopeReferences("{row.price} > 3 and {other} = 'x'", 'row', [
        { kind: 'name', name: 'basket' },
      ]),
    ).toBe("{basket.price} > 3 and {other} = 'x'");
  });

  test('an index is a path segment like any other', () => {
    expect(
      scopeReferences('{row.a} + {row.b}', 'row', [
        { kind: 'name', name: 'm' },
        { kind: 'index', index: 2 },
      ]),
    ).toBe('{m[2].a} + {m[2].b}');
  });

  test('a bare scope reference is left alone', () => {
    // `{row}` names the scope itself rather than anything in it, and there is no shape
    // to give it that a condition could be written against.
    expect(scopeReferences('{row}', 'row', [{ kind: 'name', name: 'm' }])).toBe('{row}');
  });

  test('everything outside the references survives untouched', () => {
    // Rewritten by span rather than by reprinting the parsed tree, so an author's
    // spacing, parentheses and quoting come back exactly as they were written.
    expect(
      scopeReferences("iif( {row.a}=='x' , 1,2 )", 'row', [{ kind: 'name', name: 'm' }]),
    ).toBe("iif( {m.a}=='x' , 1,2 )");
  });
});
