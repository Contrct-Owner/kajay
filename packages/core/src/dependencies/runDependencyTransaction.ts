import type { PathSegment } from '../expressions/ExpressionNode.js';
import type { DependencyError } from './DependencyError.js';
import type { DependencyGraph } from './DependencyGraph.js';

/**
 * Recomputes one node.
 *
 * Return any paths the node wrote that it did not declare — a trigger setting an
 * arbitrary value, say. Declared writes need not be returned; the graph already
 * ordered around them.
 */
export type ComputeNode = (key: string) => readonly (readonly PathSegment[])[] | void;

export interface TransactionOptions {
  /**
   * How many times undeclared writes may re-enter before the transaction gives up.
   *
   * Triggers can set values that fire further triggers, so a survey definition can
   * describe a loop that never settles. Bounding it turns a hang into a report.
   */
  readonly maxRounds?: number;
}

export interface TransactionResult {
  /** Node keys in the order they ran, across all rounds. */
  readonly recomputed: readonly string[];
  readonly rounds: number;
  readonly errors: readonly DependencyError[];
}

const DEFAULT_MAX_ROUNDS = 10;

/**
 * Runs one logical change to completion.
 *
 * A single value change produces an ordered recompute, not a cascade of interleaved
 * updates — the caller fires its events once this returns, so observers never see the
 * model halfway through settling.
 */
export function runDependencyTransaction(
  graph: DependencyGraph,
  changedPaths: readonly (readonly PathSegment[])[],
  compute: ComputeNode,
  options: TransactionOptions = {},
): TransactionResult {
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const recomputed: string[] = [];
  const errors: DependencyError[] = [];

  let pending: readonly (readonly PathSegment[])[] = changedPaths;
  let rounds = 0;
  let lastOrder: readonly string[] = [];

  while (pending.length > 0) {
    if (rounds >= maxRounds) {
      errors.push({
        code: 'cascade-limit',
        message:
          `Logic did not settle after ${maxRounds} rounds. Nodes still writing: ` +
          `${lastOrder.join(', ') || '(none)'}.`,
        nodes: lastOrder,
      });
      break;
    }
    rounds += 1;

    const plan = graph.plan(pending);
    errors.push(...plan.errors);
    lastOrder = plan.order;

    const written: (readonly PathSegment[])[] = [];
    for (const key of plan.order) {
      recomputed.push(key);
      const undeclaredWrites = compute(key);
      if (undeclaredWrites !== undefined) {
        written.push(...undeclaredWrites);
      }
    }
    pending = written;
  }

  return { recomputed, rounds, errors };
}
