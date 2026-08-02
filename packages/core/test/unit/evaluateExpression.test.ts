import {
  ExpressionCache,
  collectReferences,
  createDefaultFunctionRegistry,
  createValueResolver,
  evaluateExpression,
  formatPath,
  parseExpression,
} from '@kajay/core';
import { describe, expect, test } from 'vitest';

/** A fixed clock: date-dependent expressions must not depend on when tests run. */
const NOW = new Date('2026-08-02T12:34:56.000Z');

function evaluate(source: string, data: Readonly<Record<string, unknown>> = {}): unknown {
  const parsed = parseExpression(source);
  expect(parsed.errors, `parse errors in ${source}`).toEqual([]);
  return evaluateExpression(parsed.node, {
    getValue: createValueResolver(data),
    functions: createDefaultFunctionRegistry(),
    now: NOW,
  }).value;
}

const data = {
  age: 30,
  name: 'Ada',
  numericText: '42',
  flag: true,
  picks: ['a', 'b'],
  blank: '',
  nested: { child: { value: 7 } },
  panel: [{ q: 1 }, { q: 2 }],
};

describe('parity/B1-operators', () => {
  const cases: readonly (readonly [source: string, expected: unknown])[] = [
    // Comparison, including the string-typed numeric a form control would produce.
    ['{age} == 30', true],
    ['{age} != 30', false],
    ['{numericText} == 42', true],
    ['{numericText} > 41', true],
    ['{name} == "Ada"', true],
    ['{name} < "Bob"', true],
    ['{missing} == null', true],
    ['{missing} == 1', false],
    ['{blank} == null', false],

    // Ordering against an absent value is false rather than throwing.
    ['{missing} > 1', false],
    ['{missing} < 1', false],

    // Logic.
    ['{flag} and {age} > 18', true],
    ['{flag} or {missing}', true],
    ['not {flag}', false],
    ['not {missing}', true],

    // Emptiness.
    ['{missing} empty', true],
    ['{blank} empty', true],
    ['{age} empty', false],
    ['{picks} notempty', true],

    // Arithmetic.
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['2 ^ 3 ^ 2', 512],
    ['-{age}', -30],
    ['7 % 4', 3],
    ['1 / 0', undefined],
    ['{name} + "!"', 'Ada!'],
    ['{numericText} + 1', 43],

    // Membership.
    ['{picks} contains "a"', true],
    ['{picks} contains "z"', false],
    ['{picks} notcontains "z"', true],
    ['{name} contains "d"', true],
    ['{picks} anyof ["b", "z"]', true],
    ['{picks} anyof ["y", "z"]', false],
    ['{picks} allof ["a", "b"]', true],
    ['{picks} allof ["a", "z"]', false],

    // Composite paths.
    ['{nested.child.value} == 7', true],
    ['{panel[1].q} == 2', true],
    ['{panel[9].q} empty', true],
  ];

  test.each(cases)('%s evaluates to %s', (source, expected) => {
    expect(evaluate(source, data)).toEqual(expected);
  });
});

describe('short-circuit evaluation', () => {
  test('and stops before evaluating an unknown function on the right', () => {
    const parsed = parseExpression('false and definitelyNotRegistered()');
    const result = evaluateExpression(parsed.node, {
      getValue: createValueResolver({}),
      functions: createDefaultFunctionRegistry(),
      now: NOW,
    });
    expect(result.value).toBe(false);
    expect(result.errors).toEqual([]);
  });

  test('or stops once the left side is true', () => {
    const parsed = parseExpression('true or definitelyNotRegistered()');
    const result = evaluateExpression(parsed.node, {
      getValue: createValueResolver({}),
      functions: createDefaultFunctionRegistry(),
      now: NOW,
    });
    expect(result.value).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// Not named `parity/B2-*`: B2 also requires async function registration, which is not
// built yet, so this suite is partial evidence rather than a closing proof.
describe('built-in function library', () => {
  const cases: readonly (readonly [source: string, expected: unknown])[] = [
    ['iif({age} > 18, "adult", "minor")', 'adult'],
    ['iif({age} < 18, "adult", "minor")', 'minor'],
    ['sum(1, 2, 3)', 6],
    ['sum({scores})', 6],
    ['avg(2, 4)', 3],
    ['avg()', 0],
    ['min(3, 1, 2)', 1],
    ['max(3, 1, 2)', 3],
    ['min()', undefined],
    ['count({picks})', 2],
    ['count({sparse})', 2],
    ['round(1.2345, 2)', 1.23],
    ['round(1.5)', 2],
    ['abs(-4)', 4],
    ['diffDays("2026-01-01", "2026-01-31")', 30],
    ['age("1996-08-03")', 29],
    ['age("1996-08-01")', 30],
  ];

  test.each(cases)('%s evaluates to %s', (source, expected) => {
    expect(evaluate(source, { ...data, scores: [1, 2, 3], sparse: ['a', '', null, 'b'] })).toEqual(
      expected,
    );
  });

  test('today() and currentDate() read the context clock, not the system clock', () => {
    expect(evaluate('today()')).toEqual(new Date('2026-08-02T00:00:00.000Z'));
    expect(evaluate('today(1)')).toEqual(new Date('2026-08-03T00:00:00.000Z'));
    expect(evaluate('today(-2)')).toEqual(new Date('2026-07-31T00:00:00.000Z'));
    expect(evaluate('currentDate()')).toEqual(NOW);
  });

  test('dates compare as values', () => {
    expect(evaluate('getDate("2026-08-01") < today()')).toBe(true);
    expect(evaluate('diffDays(today(), today(5))')).toBe(5);
  });

  test('an unregistered function is reported, not thrown', () => {
    const parsed = parseExpression('nope(1)');
    const result = evaluateExpression(parsed.node, {
      getValue: createValueResolver({}),
      functions: createDefaultFunctionRegistry(),
      now: NOW,
    });
    expect(result.value).toBeUndefined();
    expect(result.errors.map((error) => error.code)).toEqual(['unknown-function']);
  });

  test('a custom function registers and is callable', () => {
    const functions = createDefaultFunctionRegistry();
    functions.register('double', (args) => Number(args[0]) * 2);
    const parsed = parseExpression('double(21)');
    expect(
      evaluateExpression(parsed.node, {
        getValue: createValueResolver({}),
        functions,
        now: NOW,
      }).value,
    ).toBe(42);
  });

  test('registering a duplicate name is refused; override replaces', () => {
    const functions = createDefaultFunctionRegistry();
    expect(() => functions.register('sum', () => 0)).toThrow(/already registered/u);
    functions.override('sum', () => 99);
    expect(functions.get('SUM')?.([], { now: NOW })).toBe(99);
  });

  test('function names are case-insensitive', () => {
    expect(evaluate('IIF(true, 1, 2)')).toBe(1);
  });
});

// Not named `parity/B8-*`: B8 needs the dependency graph itself (ADR-0004). This
// proves the static extraction the graph will be built on.
describe('reference collection for the dependency graph', () => {
  test('collects each distinct reference once, in order of appearance', () => {
    const parsed = parseExpression('{a} + {b} * {a} + sum({c}, {panel[0].q})');
    expect(collectReferences(parsed.node).map((path) => formatPath(path))).toEqual([
      'a',
      'b',
      'c',
      'panel[0].q',
    ]);
  });

  test('reaches into arrays, calls, and both sides of every operator', () => {
    const parsed = parseExpression('not ({x} anyof [{y}, iif({z}, {w}, 0)]) empty');
    expect(collectReferences(parsed.node).map((path) => formatPath(path))).toEqual([
      'x',
      'y',
      'z',
      'w',
    ]);
  });

  test('an expression with no references collects nothing', () => {
    expect(collectReferences(parseExpression('1 + 2').node)).toEqual([]);
  });
});

describe('ExpressionCache', () => {
  test('returns the same parse for the same source', () => {
    const cache = new ExpressionCache();
    const first = cache.parse('{a} == 1');
    const second = cache.parse('{a} == 1');
    expect(second).toBe(first);
    expect(cache.size).toBe(1);
  });

  test('distinct sources are parsed separately and clear empties the cache', () => {
    const cache = new ExpressionCache();
    cache.parse('{a}');
    cache.parse('{b}');
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
