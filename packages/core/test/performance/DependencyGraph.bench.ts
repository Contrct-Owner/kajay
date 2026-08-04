import { runDependencyTransaction } from '../../src/dependencies/runDependencyTransaction.js';
import {
  GRAPH_WORKLOAD_SIZES,
  createDependencyGraphWorkload,
  registerDependencyGraph,
} from './DependencyGraphWorkload.js';
import { bench, describe } from 'vitest';

/**
 * Run from the repository root:
 * `pnpm exec vitest bench packages/core/test/performance/DependencyGraph.bench.ts --config packages/core/test/performance/vitest.benchmark.config.ts --run`
 */
const BENCHMARK_OPTIONS = { time: 500, warmupTime: 100 } as const;

for (const size of GRAPH_WORKLOAD_SIZES) {
  describe(`${size.label}: ${size.questionCount * 4} authored rules`, () => {
    const workload = createDependencyGraphWorkload(size);
    const graph = registerDependencyGraph(workload);

    bench(
      'registration',
      () => {
        registerDependencyGraph(workload);
      },
      BENCHMARK_OPTIONS,
    );
    bench(
      'dependentsOf',
      () => {
        graph.dependentsOf(workload.typicalChange);
      },
      BENCHMARK_OPTIONS,
    );
    bench(
      'predecessors + topological ordering',
      () => {
        graph.planAll();
      },
      BENCHMARK_OPTIONS,
    );
    bench(
      'typical value-change transaction',
      () => {
        runDependencyTransaction(graph, [workload.typicalChange], () => {});
      },
      BENCHMARK_OPTIONS,
    );
  });
}
