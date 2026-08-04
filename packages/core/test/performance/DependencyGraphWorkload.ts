import { DependencyGraph } from '../../src/dependencies/DependencyGraph.js';
import type { DependencyNode } from '../../src/dependencies/DependencyNode.js';
import type { DependencyPattern } from '../../src/dependencies/DependencyPattern.js';
import type { PathSegment } from '../../src/expressions/ExpressionNode.js';

export interface GraphWorkloadSize {
  readonly label: 'small' | 'medium' | 'large';
  readonly questionCount: number;
}

export interface PatternCheckCounter {
  count: number;
}

export interface DependencyGraphWorkload {
  readonly size: GraphWorkloadSize;
  readonly nodes: readonly DependencyNode[];
  readonly typicalChange: readonly PathSegment[];
  readonly typicalOrder: readonly string[];
}

/**
 * Dense but authored-scale surveys: four logic rules per question.
 *
 * 1,024 rules is deliberately beyond an ordinary form, while still plausible for a
 * generated enterprise survey. It is the ceiling whose steady-state behavior CI
 * protects; the benchmark shows the cost rather than encoding machine speed in tests.
 */
export const GRAPH_WORKLOAD_SIZES: readonly GraphWorkloadSize[] = [
  { label: 'small', questionCount: 10 },
  { label: 'medium', questionCount: 64 },
  { label: 'large', questionCount: 256 },
];

function path(root: string, index: number): readonly PathSegment[] {
  return [
    { kind: 'name', name: root },
    { kind: 'index', index },
  ];
}

function key(index: number, kind: string): string {
  return `${index.toString().padStart(4, '0')}:${kind}`;
}

function counted(
  patterns: readonly DependencyPattern[],
  counter: PatternCheckCounter | undefined,
): readonly DependencyPattern[] {
  if (counter === undefined) {
    return patterns;
  }
  const source = [...patterns];
  return new Proxy(source, {
    get(target, property, receiver): unknown {
      if (property !== 'some') {
        return Reflect.get(target, property, receiver);
      }
      return (
        predicate: (value: DependencyPattern, index: number, array: DependencyPattern[]) => unknown,
      ): boolean =>
        target.some((value, index, array) => {
          counter.count += 1;
          return predicate(value, index, array);
        });
    },
  });
}

function questionNodes(
  index: number,
  counter: PatternCheckCounter | undefined,
): readonly DependencyNode[] {
  const answer = path('answer', index);
  const computed = path('computed', index);
  return [
    { key: key(index, 'calculated'), reads: counted([answer], counter), writes: computed },
    { key: key(index, 'enabled'), reads: counted([answer], counter) },
    {
      key: key(index, 'trigger'),
      reads: counted([computed], counter),
      writes: path('audit', index),
    },
    { key: key(index, 'visible'), reads: counted([computed], counter) },
  ];
}

export function createDependencyGraphWorkload(
  size: GraphWorkloadSize,
  counter?: PatternCheckCounter,
): DependencyGraphWorkload {
  const nodes = Array.from({ length: size.questionCount }, (_, index) =>
    questionNodes(index, counter),
  ).flat();
  const typicalIndex = Math.floor(size.questionCount / 2);
  return {
    size,
    nodes,
    typicalChange: path('answer', typicalIndex),
    typicalOrder: [
      key(typicalIndex, 'calculated'),
      key(typicalIndex, 'enabled'),
      key(typicalIndex, 'trigger'),
      key(typicalIndex, 'visible'),
    ],
  };
}

export function registerDependencyGraph(workload: DependencyGraphWorkload): DependencyGraph {
  const graph = new DependencyGraph();
  for (const node of workload.nodes) {
    graph.addNode(node);
  }
  return graph;
}
