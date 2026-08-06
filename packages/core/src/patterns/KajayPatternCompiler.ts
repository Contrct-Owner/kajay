import type { PatternNode } from './KajayPatternNode.js';
import type { BranchState, PatternState } from './KajayPatternState.js';

const MAX_COMPILED_STATES = 4_096;

/** Compiles parsed patterns into a bounded Thompson state graph. */
export class KajayPatternCompiler {
  #stateCount = 0;

  compile(node: PatternNode): PatternState | undefined {
    try {
      const accept = this.#state<PatternState>({ kind: 'accept' });
      return this.#compile(node, accept);
    } catch (cause) {
      if (cause === PATTERN_LIMIT) {
        return undefined;
      }
      throw cause;
    }
  }

  #compile(node: PatternNode, next: PatternState): PatternState {
    switch (node.kind) {
      case 'empty':
        return next;
      case 'scalar':
        return this.#state({ kind: 'match', scalar: node.scalar, next });
      case 'anchor':
        return this.#state({ kind: 'anchor', edge: node.edge, next });
      case 'sequence':
        return node.items.reduceRight((tail, item) => this.#compile(item, tail), next);
      case 'alternation':
        return node.alternatives
          .map((alternative) => this.#compile(alternative, next))
          .reduceRight((second, first) => this.#state({ kind: 'branch', first, second }));
      case 'repeat':
        return this.#repeat(node.item, node.minimum, node.maximum, next);
    }
  }

  #repeat(
    item: PatternNode,
    minimum: number,
    maximum: number | undefined,
    next: PatternState,
  ): PatternState {
    let start = next;
    if (maximum === undefined) {
      const branch = this.#state<BranchState>({ kind: 'branch', second: next });
      branch.first = this.#compile(item, branch);
      start = branch;
    } else {
      for (let count = maximum; count > minimum; count -= 1) {
        const optional = this.#compile(item, start);
        start = this.#state({ kind: 'branch', first: optional, second: start });
      }
    }
    for (let count = 0; count < minimum; count += 1) {
      start = this.#compile(item, start);
    }
    return start;
  }

  #state<T extends PatternState>(state: T): T {
    this.#stateCount += 1;
    if (this.#stateCount > MAX_COMPILED_STATES) {
      throw PATTERN_LIMIT;
    }
    return state;
  }
}

const PATTERN_LIMIT = Symbol('Kajay pattern compiled-state limit');
