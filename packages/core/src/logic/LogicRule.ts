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
  /** Paths whose values actually changed while the rule ran. */
  readonly run: (context: RuleContext) => readonly (readonly PathSegment[])[] | void;
}
