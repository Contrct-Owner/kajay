import { parseExpression, printExpression } from '@kajay/core';
import { describe, expect, test } from 'vitest';

/**
 * Precedence and associativity are proven by printing: the printer parenthesises
 * strictly by precedence, so a round-tripped string states exactly how the parser
 * grouped the input. One table covers every rule.
 */
const grouping: readonly (readonly [source: string, canonical: string])[] = [
  // Alternative spellings normalise to one canonical operator.
  ['{a} = 1', "{a} == 1"],
  ['{a} <> 1', '{a} != 1'],
  ['{a} && {b}', '{a} and {b}'],
  ['{a} || {b}', '{a} or {b}'],
  ['{a} AND {b}', '{a} and {b}'],
  ['!{a}', 'not {a}'],

  // or < and < comparison < additive < multiplicative < power
  ['{a} or {b} and {c}', '{a} or {b} and {c}'],
  ['({a} or {b}) and {c}', '({a} or {b}) and {c}'],
  ['{a} and {b} or {c}', '{a} and {b} or {c}'],
  ['{a} == 1 and {b} == 2', '{a} == 1 and {b} == 2'],
  ['{a} + 1 == 2', '{a} + 1 == 2'],
  ['{a} + {b} * {c}', '{a} + {b} * {c}'],
  ['({a} + {b}) * {c}', '({a} + {b}) * {c}'],
  ['{a} * {b} + {c}', '{a} * {b} + {c}'],
  ['{a} % {b} + {c}', '{a} % {b} + {c}'],

  // Left associativity.
  ['{a} - {b} - {c}', '{a} - {b} - {c}'],
  ['{a} - ({b} - {c})', '{a} - ({b} - {c})'],
  ['{a} / {b} / {c}', '{a} / {b} / {c}'],

  // `^` is right associative and binds tighter than unary minus.
  ['{a} ^ {b} ^ {c}', '{a} ^ {b} ^ {c}'],
  ['({a} ^ {b}) ^ {c}', '({a} ^ {b}) ^ {c}'],
  ['-{a} ^ 2', '-{a} ^ 2'],
  ['(-{a}) ^ 2', '(-{a}) ^ 2'],
  ['-({a} + {b})', '-({a} + {b})'],

  // Postfix binds tighter than prefix `not`.
  ['{a} empty', '{a} empty'],
  ['{a} notempty', '{a} notempty'],
  ['not {a} empty', 'not {a} empty'],
  ['({a} and {b}) empty', '({a} and {b}) empty'],

  // Membership operators sit at comparison precedence.
  ['{a} contains 1 and {b} notcontains 2', '{a} contains 1 and {b} notcontains 2'],
  ['{a} anyof [1, 2]', '{a} anyof [1, 2]'],
  ['{a} allof [1, 2]', '{a} allof [1, 2]'],

  // Literals, calls, nesting.
  ["'text'", "'text'"],
  ['"text"', "'text'"],
  ['true', 'true'],
  ['FALSE', 'false'],
  ['null', 'null'],
  ['undefined', 'null'],
  ['1.5', '1.5'],
  ['1e3', '1000'],
  ['iif({a} > 1, 2, 3)', 'iif({a} > 1, 2, 3)'],
  ['sum({a}, {b}, {c})', 'sum({a}, {b}, {c})'],
  ['noArgs()', 'noArgs()'],
  ['[]', '[]'],

  // Composite reference paths survive intact.
  ['{matrix.row.col}', '{matrix.row.col}'],
  ['{panel[0].question}', '{panel[0].question}'],
  ['{a[10].b[2].c}', '{a[10].b[2].c}'],
];

describe.each(grouping)('parity/B1-expression-grammar: %s', (source, canonical) => {
  test(`parses and prints as ${canonical}`, () => {
    const parsed = parseExpression(source);
    expect(parsed.errors).toEqual([]);
    expect(printExpression(parsed.node)).toBe(canonical);
  });

  test('printing is idempotent', () => {
    const once = printExpression(parseExpression(source).node);
    const twice = printExpression(parseExpression(once).node);
    expect(twice).toBe(once);
  });
});

describe('reference paths', () => {
  test('splits names and indices into structured segments', () => {
    const parsed = parseExpression('{panel[0].question}');
    expect(parsed.node).toMatchObject({
      kind: 'reference',
      path: [
        { kind: 'name', name: 'panel' },
        { kind: 'index', index: 0 },
        { kind: 'name', name: 'question' },
      ],
    });
  });

  test('reports a non-numeric index', () => {
    const parsed = parseExpression('{panel[x].q}');
    expect(parsed.errors.map((error) => error.code)).toContain('invalid-reference-index');
  });

  test('reports an empty reference', () => {
    expect(parseExpression('{}').errors.map((error) => error.code)).toContain('empty-reference');
  });
});

describe('source spans', () => {
  test('every node carries the span of the text it came from', () => {
    const parsed = parseExpression('{a} + 12');
    expect(parsed.node.span).toEqual({ start: 0, end: 8 });
    expect(parsed.node.kind).toBe('binary');
    if (parsed.node.kind === 'binary') {
      expect(parsed.node.left.span).toEqual({ start: 0, end: 3 });
      expect(parsed.node.right.span).toEqual({ start: 6, end: 8 });
    }
  });
});

describe('error recovery', () => {
  const cases: readonly (readonly [source: string, code: string])[] = [
    ['', 'empty-expression'],
    ['{a} +', 'unexpected-end'],
    ["'unterminated", 'unterminated-string'],
    ['{unterminated', 'unterminated-reference'],
    ['({a}', 'unclosed-group'],
    ['{a} @ {b}', 'unexpected-character'],
    ['bareWord', 'unknown-identifier'],
    ['{a} {b}', 'unexpected-trailing-input'],
  ];

  test.each(cases)('%s reports %s', (source, code) => {
    const parsed = parseExpression(source);
    expect(parsed.errors.map((error) => error.code)).toContain(code);
  });

  test('always returns a tree so the logic editor can render what parsed', () => {
    const parsed = parseExpression('{a} and bareWord');
    expect(parsed.node.kind).toBe('binary');
    if (parsed.node.kind === 'binary') {
      expect(parsed.node.left.kind).toBe('reference');
      expect(parsed.node.right.kind).toBe('error');
    }
  });

  test('every error carries a span that points into the source', () => {
    const source = '{a} @ {b}';
    for (const error of parseExpression(source).errors) {
      expect(error.span.start).toBeGreaterThanOrEqual(0);
      expect(error.span.end).toBeLessThanOrEqual(source.length);
      expect(error.span.end).toBeGreaterThanOrEqual(error.span.start);
    }
  });

  test('an unparseable tree prints as something that cannot round-trip', () => {
    expect(printExpression(parseExpression('bareWord').node)).toBe('«error»');
  });
});
