import { describe, expect, test } from 'vitest';
import { evaluateInteractiveExpression } from '../../src/features/runtime-docs/expression/evaluateInteractiveExpression.js';

describe('runtime documentation expression evaluator', () => {
  test('uses the public expression semantics for coercion and canonical printing', () => {
    expect(evaluateInteractiveExpression('{amount} + 1', '{"amount":"41"}')).toEqual({
      kind: 'success',
      canonical: '{amount} + 1',
      value: '42',
    });
    expect(evaluateInteractiveExpression('{a} = 1 && {b} <> 2', '{"a":1,"b":3}')).toEqual({
      kind: 'success',
      canonical: '{a} == 1 and {b} != 2',
      value: 'true',
    });
  });

  test('uses the documented fixed UTC clock for date functions', () => {
    expect(evaluateInteractiveExpression('today()', '{}')).toEqual({
      kind: 'success',
      canonical: 'today()',
      value: '2026-08-02T00:00:00.000Z',
    });
  });

  test('reports invalid data and expression diagnostics as failures', () => {
    expect(evaluateInteractiveExpression('{x}', '[]')).toEqual({
      kind: 'failure',
      errors: ['Values must be a JSON object.'],
    });

    const malformed = evaluateInteractiveExpression("'unfinished", '{}');
    expect(malformed.kind).toBe('failure');
    if (malformed.kind === 'failure') {
      expect(malformed.errors[0]).toContain('unterminated-string');
    }
  });

  test('does not confuse a consumer value named kind with evaluator state', () => {
    expect(evaluateInteractiveExpression('{kind}', '{"kind":"consumer-data"}')).toEqual({
      kind: 'success',
      canonical: '{kind}',
      value: '"consumer-data"',
    });
  });
});
