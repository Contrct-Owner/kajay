import {
  collectReferences,
  parseExpression,
} from '@kajay/core';
import { DependencyGraph } from '../../src/dependencies/DependencyGraph.js';
import {
  ANY_INDEX,
  formatPattern,
  generalizeIndices,
  pathMatchesPattern,
} from '../../src/dependencies/DependencyPattern.js';
import type { DependencyPattern } from '../../src/dependencies/DependencyPattern.js';
import type { PathSegment } from '../../src/expressions/ExpressionNode.js';
import { describe, expect, test } from 'vitest';

function path(...segments: readonly (string | number)[]): readonly PathSegment[] {
  return segments.map((segment) =>
    typeof segment === 'number'
      ? ({ kind: 'index', index: segment } as const)
      : ({ kind: 'name', name: segment } as const),
  );
}

/** The reads a real expression produces, which is how the graph is fed in practice. */
function readsOf(expression: string): readonly DependencyPattern[] {
  return collectReferences(parseExpression(expression).node);
}

describe('dependency patterns', () => {
  const cases: readonly (readonly [
    label: string,
    changed: readonly PathSegment[],
    pattern: DependencyPattern,
    expected: boolean,
  ])[] = [
    ['exact name', path('a'), path('a'), true],
    ['different name', path('a'), path('b'), false],
    ['nested exact', path('a', 'b'), path('a', 'b'), true],
    ['nested mismatch', path('a', 'b'), path('a', 'c'), false],
    ['same index', path('p', 0, 'q'), path('p', 0, 'q'), true],
    ['different index', path('p', 0, 'q'), path('p', 1, 'q'), false],
    ['wildcard matches any index', path('p', 3, 'q'), [...path('p'), ANY_INDEX, ...path('q')], true],
    ['wildcard does not match a name', path('p', 'q'), [...path('p'), ANY_INDEX], false],
    // Prefix relation, both directions.
    ['change to a parent invalidates a child reader', path('p'), path('p', 0, 'q'), true],
    ['change to a child invalidates a parent reader', path('p', 0, 'q'), path('p'), true],
    ['unrelated roots never overlap', path('x', 0), path('y', 0), false],
    ['empty change matches nothing', [], path('a'), false],
  ];

  test.each(cases)('%s', (_label, changed, pattern, expected) => {
    expect(pathMatchesPattern(changed, pattern)).toBe(expected);
  });

  test('generalizeIndices turns a concrete path into a per-instance pattern', () => {
    expect(formatPattern(generalizeIndices(path('panel', 2, 'q')))).toBe('panel[*].q');
    expect(pathMatchesPattern(path('panel', 7, 'q'), generalizeIndices(path('panel', 2, 'q')))).toBe(
      true,
    );
  });

  test('formatPattern renders names, indices and wildcards', () => {
    expect(formatPattern([...path('m'), ANY_INDEX, ...path('col')])).toBe('m[*].col');
    expect(formatPattern(path('m', 1, 'col'))).toBe('m[1].col');
  });
});

describe('parity/B8-dependency-graph', () => {
  function buildGraph(): DependencyGraph {
    const graph = new DependencyGraph();
    // total = subtotal + shipping; subtotal = price * quantity
    graph.addNode({ key: 'subtotal', reads: readsOf('{price} * {quantity}'), writes: path('subtotal') });
    graph.addNode({ key: 'total', reads: readsOf('{subtotal} + {shipping}'), writes: path('total') });
    graph.addNode({ key: 'showDiscount', reads: readsOf('{total} > 100') });
    graph.addNode({ key: 'unrelated', reads: readsOf('{somethingElse} == 1') });
    return graph;
  }

  test('a value change re-evaluates only its dependents', () => {
    const plan = buildGraph().plan([path('price')]);
    expect(plan.order).toEqual(['subtotal', 'total', 'showDiscount']);
    expect(plan.order).not.toContain('unrelated');
    expect(plan.errors).toEqual([]);
  });

  test('an unrelated change re-evaluates nothing', () => {
    expect(buildGraph().plan([path('nobodyReadsThis')]).order).toEqual([]);
  });

  test('dependencies are ordered before dependents', () => {
    const order = buildGraph().plan([path('price'), path('shipping')]).order;
    expect(order.indexOf('subtotal')).toBeLessThan(order.indexOf('total'));
    expect(order.indexOf('total')).toBeLessThan(order.indexOf('showDiscount'));
  });

  test('a change to a written value picks up only what reads it', () => {
    expect(buildGraph().plan([path('shipping')]).order).toEqual(['total', 'showDiscount']);
  });

  test('ordering is deterministic across runs', () => {
    const first = buildGraph().plan([path('price')]).order;
    const second = buildGraph().plan([path('price')]).order;
    expect(second).toEqual(first);
  });

  test('dependentsOf reports direct readers only', () => {
    expect(buildGraph().dependentsOf(path('price'))).toEqual(['subtotal']);
    expect(buildGraph().dependentsOf(path('total'))).toEqual(['showDiscount']);
  });
});

describe('parity/B8-cycle-reporting', () => {
  test('a cycle names the participating nodes, in the order they close the loop', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'a', reads: readsOf('{b} + 1'), writes: path('a') });
    graph.addNode({ key: 'b', reads: readsOf('{a} + 1'), writes: path('b') });

    const plan = graph.plan([path('a')]);
    const cycle = plan.errors.find((error) => error.code === 'cycle');

    expect(cycle).toBeDefined();
    expect(cycle?.nodes).toEqual(['a', 'b', 'a']);
    expect(cycle?.message).toBe('Dependency cycle: a -> b -> a.');
  });

  test('a node that reads what it writes is a cycle of one', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'selfish', reads: readsOf('{selfish} + 1'), writes: path('selfish') });
    const cycle = graph.plan([path('selfish')]).errors.find((error) => error.code === 'cycle');
    expect(cycle?.nodes).toEqual(['selfish', 'selfish']);
  });

  test('a longer cycle reports every participant', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'a', reads: readsOf('{c}'), writes: path('a') });
    graph.addNode({ key: 'b', reads: readsOf('{a}'), writes: path('b') });
    graph.addNode({ key: 'c', reads: readsOf('{b}'), writes: path('c') });
    const cycle = graph.plan([path('a')]).errors.find((error) => error.code === 'cycle');
    expect(cycle?.nodes).toHaveLength(4);
    expect(new Set(cycle?.nodes)).toEqual(new Set(['a', 'b', 'c']));
  });

  test('an acyclic diamond reports no cycle', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'left', reads: readsOf('{seed}'), writes: path('left') });
    graph.addNode({ key: 'right', reads: readsOf('{seed}'), writes: path('right') });
    graph.addNode({ key: 'join', reads: readsOf('{left} + {right}') });

    const plan = graph.plan([path('seed')]);
    expect(plan.errors).toEqual([]);
    expect(plan.order.at(-1)).toBe('join');
  });
});

describe('parity/B8-pattern-edges', () => {
  test('an aggregate over every panel instance sees a change in any one of them', () => {
    const graph = new DependencyGraph();
    graph.addNode({
      key: 'panelTotal',
      reads: [[...path('panel'), ANY_INDEX, ...path('amount')]],
      writes: path('panelTotal'),
    });

    expect(graph.plan([path('panel', 0, 'amount')]).order).toEqual(['panelTotal']);
    expect(graph.plan([path('panel', 42, 'amount')]).order).toEqual(['panelTotal']);
    expect(graph.plan([path('panel', 0, 'other')]).order).toEqual([]);
  });

  test('an instance materialised later is matched without re-registering', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'rowSum', reads: [generalizeIndices(path('matrix', 0, 'score'))] });

    // A row added at runtime: no new edge was registered, and it still invalidates.
    expect(graph.plan([path('matrix', 5, 'score')]).order).toEqual(['rowSum']);
  });

  test('a per-instance expression is not disturbed by a sibling instance', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'row0Visible', reads: [path('matrix', 0, 'score')] });
    graph.addNode({ key: 'row1Visible', reads: [path('matrix', 1, 'score')] });

    expect(graph.plan([path('matrix', 1, 'score')]).order).toEqual(['row1Visible']);
  });

  test('replacing the whole collection invalidates every instance reader', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'row0', reads: [path('matrix', 0, 'score')] });
    graph.addNode({ key: 'row1', reads: [path('matrix', 1, 'score')] });

    expect(graph.plan([path('matrix')]).order).toEqual(['row0', 'row1']);
  });
});

describe('graph maintenance', () => {
  test('registering a duplicate key is refused; setNode replaces', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'a', reads: [path('x')] });
    expect(() => graph.addNode({ key: 'a', reads: [path('y')] })).toThrow(/already registered/u);

    graph.setNode({ key: 'a', reads: [path('y')] });
    expect(graph.plan([path('x')]).order).toEqual([]);
    expect(graph.plan([path('y')]).order).toEqual(['a']);
  });

  test('a removed node stops being invalidated', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'a', reads: [path('x')] });
    graph.removeNode('a');
    expect(graph.hasNode('a')).toBe(false);
    expect(graph.plan([path('x')]).order).toEqual([]);
  });
});
