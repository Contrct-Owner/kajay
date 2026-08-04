import { conditionOf, printCondition } from '@kajay/creator-core';
import type { Condition } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/**
 * An expression as a row of dropdowns, and back — checklist M1.
 *
 * Its own file, with no survey in it: this is a function of a string, and the rules about
 * what it refuses are the most important thing in the row.
 */
describe('parity/M1-condition-read', () => {
  test('a comparison becomes a term', () => {
    expect(conditionOf("{who} = 'yes'")).toEqual({
      terms: [{ left: 'who', operator: '==', right: 'yes' }],
      join: 'and',
    });
  });

  test('a run of comparisons becomes a row of terms', () => {
    expect(conditionOf("{who} = 'yes' and {age} > 18")).toEqual({
      terms: [
        { left: 'who', operator: '==', right: 'yes' },
        { left: 'age', operator: '>', right: '18' },
      ],
      join: 'and',
    });
  });

  test('`or` is a join like `and`, and the whole row shares it', () => {
    expect(conditionOf('{a} = 1 or {b} = 2 or {c} = 3')?.join).toBe('or');
    expect(conditionOf('{a} = 1 or {b} = 2 or {c} = 3')?.terms).toHaveLength(3);
  });

  test('a postfix test takes no value', () => {
    expect(conditionOf('{who} notempty')).toEqual({
      terms: [{ left: 'who', operator: 'notempty', right: '' }],
      join: 'and',
    });
  });

  test('a reference on the right keeps its braces', () => {
    expect(conditionOf('{a} = {b}')?.terms[0]?.right).toBe('{b}');
  });

  test('a path into a value survives', () => {
    expect(conditionOf('{panel.rating} >= 4')?.terms[0]?.left).toBe('panel.rating');
  });

  test('nothing is an empty condition, not a refusal', () => {
    // A rule with no condition yet is the state every new one starts in.
    expect(conditionOf('')).toEqual({ terms: [], join: 'and' });
    expect(conditionOf('   ')).toEqual({ terms: [], join: 'and' });
  });
});

describe('parity/M1-condition-refusals', () => {
  test('a mixture of joins is refused', () => {
    // A table with no parentheses in it cannot say whether `a and b or c` meant
    // `(a and b) or c`.
    expect(conditionOf('{a} = 1 and {b} = 2 or {c} = 3')).toBeUndefined();
  });

  test('a parenthesised group is refused', () => {
    expect(conditionOf('({a} = 1 or {b} = 2) and {c} notempty')).toBeUndefined();
  });

  test('a call is refused', () => {
    expect(conditionOf('iif({a} = 1, 2, 3) > 0')).toBeUndefined();
  });

  test('arithmetic on the right is refused', () => {
    expect(conditionOf('{a} > {b} + 1')).toBeUndefined();
  });

  test('a literal on the left is refused', () => {
    expect(conditionOf("'yes' = {who}")).toBeUndefined();
  });

  test('an expression that will not parse is refused', () => {
    expect(conditionOf('{a} = ')).toBeUndefined();
  });

  test('an expression that parses *with* errors is refused too', () => {
    // The parser recovers, so an unterminated string still yields a literal node and the
    // shape checks below would happily accept it — the errors check is the only thing that
    // stops a designer's broken expression being rewritten as a tidy one.
    expect(conditionOf("{a} = 'unterminated")).toBeUndefined();
  });

  test('a refusal is what keeps the text', () => {
    // The load-bearing claim of the file: a builder that "mostly" understood an expression
    // would flatten a designer's parentheses the first time they opened the row.
    const hard = '({a} = 1 or {b} = 2) and {c} notempty';
    expect(conditionOf(hard)).toBeUndefined();
  });
});

/** One term written back, which is the shape every value rule is checked through. */
function write(right: string): string {
  return printCondition({ terms: [{ left: 'a', operator: '==', right }], join: 'and' });
}

describe('parity/M1-condition-write', () => {
  test('terms print through core’s own printer, canonically', () => {
    const condition: Condition = {
      terms: [
        { left: 'who', operator: '==', right: 'yes' },
        { left: 'age', operator: '>', right: '18' },
      ],
      join: 'and',
    };

    expect(printCondition(condition)).toBe("{who} == 'yes' and {age} > 18");
  });

  test('an empty condition prints as nothing, not as `true`', () => {
    // `visibleIf: "true"` is a rule somebody wrote; the absence of one is not.
    expect(printCondition({ terms: [], join: 'and' })).toBe('');
  });

  test('what the builder reads, it writes back unchanged', () => {
    for (const source of [
      "{who} == 'yes'",
      '{age} > 18',
      '{who} notempty',
      "{a} == 'x' or {b} == 'y'",
      '{a} == {b}',
      '{flag} == true',
      '{n} != null',
    ]) {
      const condition = conditionOf(source);
      expect(condition).toBeDefined();
      expect(printCondition(condition!)).toBe(source);
    }
  });

  test('a value box holds a value, and the rules for reading one are exact', () => {
    expect(write('yes')).toBe("{a} == 'yes'");
    expect(write('18')).toBe('{a} == 18');
    expect(write('-2.5')).toBe('{a} == -2.5');
    expect(write('true')).toBe('{a} == true');
    expect(write('null')).toBe('{a} == null');
    expect(write('{b}')).toBe('{a} == {b}');
  });

  test('only a *plain* number is a number', () => {
    // `Number()` would take `1e5`, `0x10` and `Infinity`, and the last of those prints as
    // an identifier the parser cannot read back. A value box holds what was typed unless
    // it is unmistakably a number.
    expect(write('1e5')).toBe("{a} == '1e5'");
    expect(write('0x10')).toBe("{a} == '0x10'");
    expect(write('Infinity')).toBe("{a} == 'Infinity'");
  });

  test('a date is a string, because parsing it as an expression makes it arithmetic', () => {
    // `2026-01-01` evaluates to 2024. That is the kind of thing a respondent finds rather
    // than a designer, which is why the value box does not parse.
    expect(
      printCondition({
        terms: [{ left: 'when', operator: '>', right: '2026-01-01' }],
        join: 'and',
      }),
    ).toBe("{when} > '2026-01-01'");
  });

  test('a value with a quote in it survives the round trip', () => {
    const printed = printCondition({
      terms: [{ left: 'a', operator: '==', right: "it's" }],
      join: 'and',
    });

    expect(conditionOf(printed)?.terms[0]?.right).toBe("it's");
  });
});
