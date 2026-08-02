import type { DependencyPattern } from '../dependencies/DependencyPattern.js';
import type { ExpressionError } from '../expressions/ExpressionError.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';

export interface RuleEvaluation {
  readonly value: unknown;
  readonly errors: readonly ExpressionError[];
}

export interface RuleContext {
  /** Evaluates one of the rule's expressions against the current answers. */
  readonly evaluate: (expression: string) => RuleEvaluation;
}

/**
 * One recomputable piece of survey logic.
 *
 * The general form behind `ConditionBinding`. A condition only reads; a value rule
 * also **writes**, and declaring that write is what lets the dependency graph order it
 * before everything downstream in a single pass — rather than re-running until the
 * values stop changing.
 */
export interface LogicRule {
  readonly key: string;
  readonly reads: readonly DependencyPattern[];
  /** The value this rule assigns, if any. */
  readonly writes?: readonly PathSegment[];
  /**
   * Paths whose values actually changed while the rule ran.
   *
   * The engine drops any path equal to `writes` — the graph already ordered around a
   * declared write — and feeds the rest back into the transaction as a further round.
   *
   * **Every rule that exists today declares everything it writes**, so that filter
   * currently removes the whole return value and no second round is ever provoked.
   * The channel is here for §D dynamic panels, where a rule writes into a row that did
   * not exist when the graph was built and so cannot be declared statically. Until
   * then it is proven by `logicEngineWrites.test.ts` rather than by any survey
   * definition, and returning nothing remains correct for a rule that only writes
   * where it said it would.
   */
  readonly run: (context: RuleContext) => readonly (readonly PathSegment[])[] | void;
}
