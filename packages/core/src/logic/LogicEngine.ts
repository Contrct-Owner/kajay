import type { DependencyError } from '../dependencies/DependencyError.js';
import { DependencyGraph } from '../dependencies/DependencyGraph.js';
import { runDependencyTransaction } from '../dependencies/runDependencyTransaction.js';
import { collectReferences } from '../expressions/collectReferences.js';
import { evaluateExpression } from '../expressions/evaluateExpression.js';
import { ExpressionCache } from '../expressions/ExpressionCache.js';
import type { ExpressionError } from '../expressions/ExpressionError.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { isTruthy } from '../expressions/expressionValues.js';
import { createDefaultFunctionRegistry } from '../expressions/builtInFunctions.js';
import type { FunctionRegistry } from '../expressions/FunctionRegistry.js';
import type { ConditionBinding } from './ConditionBinding.js';

export type ValueResolver = (path: readonly PathSegment[]) => unknown;

export interface LogicEngineOptions {
  readonly functions?: FunctionRegistry;
  /** Explicit clock, so date-dependent conditions are deterministic under test. */
  readonly now?: () => Date;
}

export interface LogicRunResult {
  /** Condition keys evaluated, in dependency order. */
  readonly evaluated: readonly string[];
  readonly dependencyErrors: readonly DependencyError[];
  readonly expressionErrors: readonly ExpressionError[];
}

/**
 * Holds the survey's conditional logic: which expression drives which property, and
 * what has to be re-evaluated when an answer changes.
 *
 * It owns an ExpressionCache and a DependencyGraph rather than reaching for globals,
 * so two surveys in one process never share state and the suite stays parallel-safe.
 */
export class LogicEngine {
  readonly #graph: DependencyGraph = new DependencyGraph();
  readonly #cache: ExpressionCache = new ExpressionCache();
  readonly #bindings: Map<string, ConditionBinding> = new Map();
  readonly #functions: FunctionRegistry;
  readonly #now: () => Date;

  constructor(options: LogicEngineOptions = {}) {
    this.#functions = options.functions ?? createDefaultFunctionRegistry();
    this.#now = options.now ?? ((): Date => new Date());
  }

  get conditionKeys(): readonly string[] {
    return this.#graph.getNodeKeys();
  }

  /**
   * Registers a condition, extracting its dependencies from the parsed expression.
   *
   * Static extraction is the whole reason core needs no automatic tracking: the
   * references are in the AST, so the graph can be built without observing evaluation.
   */
  addCondition(binding: ConditionBinding): void {
    const parsed = this.#cache.parse(binding.expression);
    this.#bindings.set(binding.key, binding);
    this.#graph.setNode({ key: binding.key, reads: collectReferences(parsed.node) });
  }

  removeCondition(key: string): void {
    this.#bindings.delete(key);
    this.#graph.removeNode(key);
  }

  clear(): void {
    for (const key of this.#graph.getNodeKeys()) {
      this.#graph.removeNode(key);
    }
    this.#bindings.clear();
  }

  /** Evaluates every condition. Used once the model is built, before anything renders. */
  evaluateAll(resolve: ValueResolver): LogicRunResult {
    const expressionErrors: ExpressionError[] = [];
    const evaluated: string[] = [];
    for (const key of this.#graph.getNodeKeys()) {
      evaluated.push(key);
      expressionErrors.push(...this.#evaluateCondition(key, resolve));
    }
    return { evaluated, dependencyErrors: [], expressionErrors };
  }

  /** Evaluates only the conditions a change reaches, in dependency order. */
  applyValueChange(changedPath: readonly PathSegment[], resolve: ValueResolver): LogicRunResult {
    const expressionErrors: ExpressionError[] = [];
    const transaction = runDependencyTransaction(this.#graph, [changedPath], (key) => {
      expressionErrors.push(...this.#evaluateCondition(key, resolve));
    });
    return {
      evaluated: transaction.recomputed,
      dependencyErrors: transaction.errors,
      expressionErrors,
    };
  }

  #evaluateCondition(key: string, resolve: ValueResolver): readonly ExpressionError[] {
    const binding = this.#bindings.get(key);
    if (binding === undefined) {
      return [];
    }

    const parsed = this.#cache.parse(binding.expression);
    const evaluation = evaluateExpression(parsed.node, {
      getValue: resolve,
      functions: this.#functions,
      now: this.#now(),
    });

    const errors = [...parsed.errors, ...evaluation.errors];
    // A malformed condition must not silently change what the respondent sees.
    binding.apply(errors.length > 0 ? binding.fallback : isTruthy(evaluation.value));
    return errors;
  }
}
