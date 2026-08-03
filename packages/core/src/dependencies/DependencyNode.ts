import type { PathSegment } from '../expressions/ExpressionNode.js';
import type { DependencyPattern } from './DependencyPattern.js';

/**
 * One recomputable thing: a `visibleIf`, a calculated value, a trigger condition.
 *
 * `reads` normally comes straight from `collectReferences` on the expression's AST —
 * that static extraction is why core needs no automatic tracking and no signals
 * library.
 *
 * `writes` is what turns a flat list of nodes into a graph. A calculated value both
 * reads answers and writes one, so declaring the write lets the graph order it before
 * everything that reads it, in a single pass, rather than discovering the ordering by
 * re-running until things settle.
 */
export interface DependencyNode {
  readonly key: string;
  readonly reads: readonly DependencyPattern[];
  readonly writes?: readonly PathSegment[];
}
