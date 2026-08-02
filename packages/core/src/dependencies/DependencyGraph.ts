import type { PathSegment } from '../expressions/ExpressionNode.js';
import type { DependencyError } from './DependencyError.js';
import type { DependencyNode } from './DependencyNode.js';
import { pathMatchesPattern } from './DependencyPattern.js';

export interface DependencyPlan {
  /** Nodes to recompute, dependencies before dependents. */
  readonly order: readonly string[];
  readonly errors: readonly DependencyError[];
}

/**
 * Which nodes must re-evaluate when a value changes, and in what order.
 *
 * Push-based and synchronous by design (ADR-0004): no scheduler, no microtask
 * batching. An adapter that wants frame-level batching does that at the adapter, so
 * core stays deterministic and its tests stay order-independent.
 */
export class DependencyGraph {
  readonly #nodes: Map<string, DependencyNode> = new Map();

  addNode(node: DependencyNode): void {
    if (this.#nodes.has(node.key)) {
      throw new Error(`Dependency node "${node.key}" is already registered.`);
    }
    this.#nodes.set(node.key, node);
  }

  /** Replaces a registration, or adds one. Re-registering an edited expression. */
  setNode(node: DependencyNode): void {
    this.#nodes.set(node.key, node);
  }

  removeNode(key: string): void {
    this.#nodes.delete(key);
  }

  hasNode(key: string): boolean {
    return this.#nodes.has(key);
  }

  /** Sorted, so every derived ordering is stable across runs. */
  getNodeKeys(): readonly string[] {
    return Array.from(this.#nodes.keys()).toSorted();
  }

  /** Nodes that read something a change at `path` touches. */
  dependentsOf(path: readonly PathSegment[]): readonly string[] {
    return this.getNodeKeys().filter((key) => {
      const node = this.#nodes.get(key);
      return node !== undefined && node.reads.some((pattern) => pathMatchesPattern(path, pattern));
    });
  }

  /**
   * Everything a set of changes affects, in dependency order.
   *
   * Expansion follows declared writes, so a calculated value feeding another is picked
   * up here rather than by re-running until the values settle.
   */
  plan(changedPaths: readonly (readonly PathSegment[])[]): DependencyPlan {
    const affected = this.#collectAffected(changedPaths);
    return this.#order(affected);
  }

  /**
   * Every node, in dependency order.
   *
   * Used for the initial evaluation, where there is no change to propagate from.
   * Ordering still matters there: a rule that writes a value another rule reads has to
   * run first, or the second sees a stale answer on the very first pass. It also
   * surfaces cycles at load time rather than on the first keystroke.
   */
  planAll(): DependencyPlan {
    return this.#order(new Set(this.getNodeKeys()));
  }

  #collectAffected(changedPaths: readonly (readonly PathSegment[])[]): Set<string> {
    const affected = new Set<string>();
    const queue: string[] = [];

    for (const path of changedPaths) {
      for (const key of this.dependentsOf(path)) {
        if (!affected.has(key)) {
          affected.add(key);
          queue.push(key);
        }
      }
    }

    while (queue.length > 0) {
      const key = queue.shift();
      const written = key === undefined ? undefined : this.#nodes.get(key)?.writes;
      if (written === undefined) {
        continue;
      }
      for (const dependent of this.dependentsOf(written)) {
        if (!affected.has(dependent)) {
          affected.add(dependent);
          queue.push(dependent);
        }
      }
    }

    return affected;
  }

  /**
   * Nodes inside `affected` whose writes feed this node's reads.
   *
   * A node is deliberately allowed to be its own predecessor. A calculated value that
   * reads what it writes — `total = total + 1` — is a cycle of one, and excluding self
   * here would let the single most obvious authoring mistake through undetected.
   */
  #predecessorsOf(key: string, affected: ReadonlySet<string>): readonly string[] {
    const node = this.#nodes.get(key);
    if (node === undefined) {
      return [];
    }
    return this.getNodeKeys().filter((candidate) => {
      if (!affected.has(candidate)) {
        return false;
      }
      const written = this.#nodes.get(candidate)?.writes;
      return (
        written !== undefined && node.reads.some((pattern) => pathMatchesPattern(written, pattern))
      );
    });
  }

  /**
   * Depth-first topological sort.
   *
   * DFS rather than Kahn's algorithm specifically so a cycle can be reported as the
   * path that closes it: the visiting stack *is* the cycle when a back edge is found.
   */
  #order(affected: ReadonlySet<string>): DependencyPlan {
    const order: string[] = [];
    const errors: DependencyError[] = [];
    const state = new Map<string, 'visiting' | 'done'>();
    const stack: string[] = [];

    const visit = (key: string): void => {
      const current = state.get(key);
      if (current === 'done') {
        return;
      }
      if (current === 'visiting') {
        const start = stack.indexOf(key);
        const cycle = [...stack.slice(start === -1 ? 0 : start), key];
        errors.push({
          code: 'cycle',
          message: `Dependency cycle: ${cycle.join(' -> ')}.`,
          nodes: cycle,
        });
        return;
      }

      state.set(key, 'visiting');
      stack.push(key);
      for (const predecessor of this.#predecessorsOf(key, affected)) {
        visit(predecessor);
      }
      stack.pop();
      state.set(key, 'done');
      order.push(key);
    };

    for (const key of this.getNodeKeys()) {
      if (affected.has(key)) {
        visit(key);
      }
    }

    return { order, errors };
  }
}
