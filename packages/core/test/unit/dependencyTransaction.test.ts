import { DependencyGraph, collectReferences, parseExpression } from '@kajay/core';
import type { DependencyPattern, PathSegment } from '@kajay/core';
import { describe, expect, test } from 'vitest';
// Reached through the source path, not the package entry: the transaction runner is
// implementation detail a host has no business calling, but it is also the only thing
// standing between a self-feeding survey and a hung tab. Not exporting it is right;
// leaving it unproven is not.
import { runDependencyTransaction } from '../../src/dependencies/runDependencyTransaction.js';

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

describe('transaction model', () => {
  test('one change runs each affected node exactly once, in order', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'subtotal', reads: readsOf('{price}'), writes: path('subtotal') });
    graph.addNode({ key: 'total', reads: readsOf('{subtotal}'), writes: path('total') });
    graph.addNode({ key: 'banner', reads: readsOf('{total} > 10') });

    const ran: string[] = [];
    const result = runDependencyTransaction(graph, [path('price')], (key) => {
      ran.push(key);
    });

    expect(ran).toEqual(['subtotal', 'total', 'banner']);
    expect(result.rounds).toBe(1);
    expect(result.errors).toEqual([]);
  });

  test('an undeclared write re-enters and settles', () => {
    const graph = new DependencyGraph();
    // A trigger writing a value it never declared — the graph cannot order around it.
    graph.addNode({ key: 'trigger', reads: readsOf('{start}') });
    graph.addNode({ key: 'consumer', reads: readsOf('{sideEffect}') });

    const result = runDependencyTransaction(graph, [path('start')], (key) =>
      key === 'trigger' ? [path('sideEffect')] : undefined,
    );

    expect(result.recomputed).toEqual(['trigger', 'consumer']);
    expect(result.rounds).toBe(2);
    expect(result.errors).toEqual([]);
  });

  test('a cascade that never settles is bounded and reported, not hung', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'ping', reads: readsOf('{pong}') });
    graph.addNode({ key: 'pong', reads: readsOf('{ping}') });

    const result = runDependencyTransaction(
      graph,
      [path('ping')],
      (key) => (key === 'ping' ? [path('ping')] : [path('pong')]),
      { maxRounds: 4 },
    );

    const limit = result.errors.find((error) => error.code === 'cascade-limit');
    expect(limit).toBeDefined();
    expect(limit?.message).toMatch(/did not settle after 4 rounds/u);
    expect(limit?.nodes.length).toBeGreaterThan(0);
    expect(result.rounds).toBe(4);
  });

  test('the default round limit bounds a cascade nobody configured', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'ping', reads: readsOf('{ping}') });

    // No maxRounds: the point is that the shipped default is itself a real bound, so
    // a host that never passes options still gets a report rather than a hang.
    const result = runDependencyTransaction(graph, [path('ping')], () => [path('ping')]);

    expect(result.errors.some((error) => error.code === 'cascade-limit')).toBe(true);
    expect(result.rounds).toBe(10);
  });

  test('a change affecting nothing does no work at all', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'a', reads: readsOf('{x}') });

    let calls = 0;
    const result = runDependencyTransaction(graph, [path('somethingElse')], () => {
      calls += 1;
    });

    expect(calls).toBe(0);
    expect(result.recomputed).toEqual([]);
    expect(result.rounds).toBe(1);
  });

  test('a cycle surfaces through the transaction rather than looping', () => {
    const graph = new DependencyGraph();
    graph.addNode({ key: 'a', reads: readsOf('{b}'), writes: path('a') });
    graph.addNode({ key: 'b', reads: readsOf('{a}'), writes: path('b') });

    const result = runDependencyTransaction(graph, [path('a')], () => {
      // No writes; the cycle is structural, not a runtime cascade.
    });
    expect(result.errors.some((error) => error.code === 'cycle')).toBe(true);
  });
});
