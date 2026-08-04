import { runDependencyTransaction } from '../../src/dependencies/runDependencyTransaction.js';
import {
  GRAPH_WORKLOAD_SIZES,
  createDependencyGraphWorkload,
  registerDependencyGraph,
} from '../performance/DependencyGraphWorkload.js';
import { describe, expect, test } from 'vitest';

/**
 * Machine-independent performance characteristic for authored surveys:
 *
 * - registration retains every rule;
 * - one direct lookup performs at most one pattern check per registered rule;
 * - a typical four-rule value change remains linear, below four checks per rule; and
 * - full initial ordering stays within one pairwise pass over the rules.
 *
 * Wall-clock figures belong in the opt-in benchmark. These ceilings instead fail only
 * when the graph begins doing structurally more work, so they remain stable in CI.
 */
describe('DependencyGraph authored-scale performance characteristic', () => {
  test.each(GRAPH_WORKLOAD_SIZES)('$label registration and direct lookup', (size) => {
    const counter = { count: 0 };
    const workload = createDependencyGraphWorkload(size, counter);
    const graph = registerDependencyGraph(workload);

    expect(graph.getNodeKeys()).toHaveLength(workload.nodes.length);
    expect(graph.dependentsOf(workload.typicalChange)).toEqual(
      workload.typicalOrder.slice(0, 2),
    );
    expect(counter.count).toBeGreaterThan(0);
    expect(counter.count).toBeLessThanOrEqual(workload.nodes.length);
  });

  test.each(GRAPH_WORKLOAD_SIZES)('$label full predecessor discovery and ordering', (size) => {
    const counter = { count: 0 };
    const workload = createDependencyGraphWorkload(size, counter);
    const graph = registerDependencyGraph(workload);
    const plan = graph.planAll();

    expect(plan.errors).toEqual([]);
    expect(plan.order).toHaveLength(workload.nodes.length);
    expect(new Set(plan.order).size).toBe(workload.nodes.length);
    expect(counter.count).toBeGreaterThan(0);
    expect(counter.count).toBeLessThanOrEqual(workload.nodes.length ** 2);
  });

  test.each(GRAPH_WORKLOAD_SIZES)('$label typical value-change transaction', (size) => {
    const counter = { count: 0 };
    const workload = createDependencyGraphWorkload(size, counter);
    const graph = registerDependencyGraph(workload);
    const transaction = runDependencyTransaction(graph, [workload.typicalChange], () => {});

    expect(transaction.errors).toEqual([]);
    expect(transaction.rounds).toBe(1);
    expect(transaction.recomputed).toEqual(workload.typicalOrder);
    expect(counter.count).toBeGreaterThan(0);
    expect(counter.count).toBeLessThanOrEqual(workload.nodes.length * 4);
  });
});
