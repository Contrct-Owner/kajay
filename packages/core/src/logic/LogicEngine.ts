import type { DependencyError } from '../dependencies/DependencyError.js';
import { DependencyGraph } from '../dependencies/DependencyGraph.js';
import { runDependencyTransaction } from '../dependencies/runDependencyTransaction.js';
import { createDefaultFunctionRegistry } from '../expressions/builtInFunctions.js';
import { collectReferences } from '../expressions/collectReferences.js';
import { AsyncFunctionCache } from '../expressions/AsyncFunctionCache.js';
import { evaluateExpression } from '../expressions/evaluateExpression.js';
import { ExpressionCache } from '../expressions/ExpressionCache.js';
import type { ExpressionError } from '../expressions/ExpressionError.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { isTruthy } from '../expressions/expressionValues.js';
import type { FunctionRegistry } from '../expressions/FunctionRegistry.js';
import type { ConditionBinding } from './ConditionBinding.js';
import type { LogicRule, RuleContext, RuleEvaluation } from './LogicRule.js';

export type ValueResolver = (path: readonly PathSegment[]) => unknown;

export interface LogicEngineOptions {
  readonly functions?: FunctionRegistry;
  /** Explicit clock, so date-dependent conditions are deterministic under test. */
  readonly now?: () => Date;
}

/** Everything the last logic run reported. */
export interface LogicDiagnostics {
  readonly dependencyErrors: readonly DependencyError[];
  readonly expressionErrors: readonly ExpressionError[];
}

export interface LogicRunResult {
  /** Rule keys evaluated, in dependency order. */
  readonly evaluated: readonly string[];
  readonly dependencyErrors: readonly DependencyError[];
  readonly expressionErrors: readonly ExpressionError[];
}

interface RuleRunResult {
  readonly errors: readonly ExpressionError[];
  readonly undeclaredWrites: readonly (readonly PathSegment[])[];
}

/**
 * Holds the survey's logic: which expression drives which property or value, and what
 * has to be re-evaluated when an answer changes.
 *
 * It owns an ExpressionCache and a DependencyGraph rather than reaching for globals,
 * so two surveys in one process never share state and the suite stays parallel-safe.
 */
export class LogicEngine {
  readonly #graph: DependencyGraph = new DependencyGraph();
  readonly #cache: ExpressionCache = new ExpressionCache();
  readonly #rules: Map<string, LogicRule> = new Map();
  #functions: FunctionRegistry;
  #now: () => Date;
  readonly #asyncValues: AsyncFunctionCache;
  #onAsyncSettled: (() => void) | undefined;

  constructor(options: LogicEngineOptions = {}) {
    this.#functions = options.functions ?? createDefaultFunctionRegistry();
    this.#now = options.now ?? ((): Date => new Date());
    this.#asyncValues = new AsyncFunctionCache({
      functions: () => this.#functions,
      now: () => this.#now(),
      onSettled: () => {
        this.#onAsyncSettled?.();
      },
    });
  }

  /**
   * Installs the host's function registry.
   *
   * After construction because the metadata registry builds a survey through a
   * no-argument factory, so `parseSurvey` — the path every host actually uses — has
   * nowhere to pass one at construction. Without this, a custom function was reachable
   * only by calling the evaluator directly, which no host does.
   */
  setFunctions(functions: FunctionRegistry): void {
    this.#functions = functions;
  }

  /**
   * Installs the host's clock, for the same reason `setFunctions` exists.
   *
   * Until E8 needed a clock the survey could be *told*, a `now` passed to `parseSurvey`
   * reached nothing: the registry builds a survey through a no-argument factory, so
   * `today()` in a parsed definition always read the machine's real time however
   * carefully a test had injected one.
   */
  setClock(now: () => Date): void {
    this.#now = now;
  }

  /** The current time, as the host defines it. Never `Date.now()` past this point. */
  now(): Date {
    return this.#now();
  }

  get ruleKeys(): readonly string[] {
    return this.#graph.getNodeKeys();
  }

  /**
   * Registers a rule, declaring what it reads and writes.
   *
   * Reads are extracted statically from the parsed expressions, which is the whole
   * reason core needs no automatic tracking: the references are in the AST.
   */
  addRule(rule: LogicRule): void {
    this.#rules.set(rule.key, rule);
    this.#graph.setNode({
      key: rule.key,
      reads: rule.reads,
      ...(rule.writes === undefined ? {} : { writes: rule.writes }),
    });
  }

  /** A boolean condition driving a computed property. Sugar over `addRule`. */
  addCondition(binding: ConditionBinding): void {
    const parsed = this.#cache.parse(binding.expression);
    this.addRule({
      key: binding.key,
      reads: collectReferences(parsed.node),
      run: (context) => {
        const evaluation = context.evaluate(binding.expression);
        // A malformed condition must not silently change what the respondent sees.
        binding.apply(
          evaluation.errors.length > 0 ? binding.fallback : isTruthy(evaluation.value),
        );
      },
    });
  }

  removeRule(key: string): void {
    this.#rules.delete(key);
    this.#graph.removeNode(key);
  }

  clear(): void {
    for (const key of this.#graph.getNodeKeys()) {
      this.#graph.removeNode(key);
    }
    this.#rules.clear();
  }

  /** Evaluates every rule in dependency order. Used once the model is built. */
  evaluateAll(resolve: ValueResolver): LogicRunResult {
    const expressionErrors: ExpressionError[] = [];
    const plan = this.#graph.planAll();
    for (const key of plan.order) {
      expressionErrors.push(...this.#runRule(key, resolve).errors);
    }
    return {
      evaluated: plan.order,
      dependencyErrors: plan.errors,
      expressionErrors,
    };
  }

  /** Evaluates only the rules a change reaches, in dependency order. */
  applyValueChange(changedPath: readonly PathSegment[], resolve: ValueResolver): LogicRunResult {
    const expressionErrors: ExpressionError[] = [];
    const transaction = runDependencyTransaction(this.#graph, [changedPath], (key) => {
      const result = this.#runRule(key, resolve);
      expressionErrors.push(...result.errors);
      return result.undeclaredWrites;
    });
    return {
      evaluated: transaction.recomputed,
      dependencyErrors: transaction.errors,
      expressionErrors,
    };
  }

  /**
   * Evaluates one expression outside the rule graph.
   *
   * Validation is the caller: asking "is this answer acceptable *now*" has no cascade
   * to order and writes nothing, so registering it as a rule would add a graph node
   * that exists only to be ignored. It still goes through this engine's cache and
   * function registry, so a validator sees exactly the language a condition does.
   */
  /**
   * Installs what to do when an asynchronous function's answer arrives.
   *
   * The engine cannot re-run itself: it does not own the resolver or the settle, and a
   * transaction started from inside a promise callback would have neither. So the
   * arrival is announced and whoever owns those decides.
   */
  setAsyncSettledHandler(onSettled: () => void): void {
    this.#onAsyncSettled = onSettled;
  }

  evaluate(expression: string, resolve: ValueResolver): RuleEvaluation {
    const parsed = this.#cache.parse(expression);
    const evaluation = evaluateExpression(parsed.node, {
      getValue: resolve,
      functions: this.#functions,
      now: this.#now(),
      asyncValues: this.#asyncValues,
    });
    return { value: evaluation.value, errors: [...parsed.errors, ...evaluation.errors] };
  }

  #runRule(key: string, resolve: ValueResolver): RuleRunResult {
    const rule = this.#rules.get(key);
    if (rule === undefined) {
      return { errors: [], undeclaredWrites: [] };
    }

    const errors: ExpressionError[] = [];
    const context: RuleContext = {
      evaluate: (expression): RuleEvaluation => {
        const evaluation = this.evaluate(expression, resolve);
        errors.push(...evaluation.errors);
        return evaluation;
      },
    };

    const actualWrites = rule.run(context) ?? [];
    const undeclaredWrites =
      rule.writes === undefined
        ? actualWrites
        : actualWrites.filter((path) => !pathsAreEqual(path, rule.writes ?? []));
    return { errors, undeclaredWrites };
  }
}

function pathsAreEqual(left: readonly PathSegment[], right: readonly PathSegment[]): boolean {
  return (
    left.length === right.length &&
    left.every((segment, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        segment.kind === other.kind &&
        (segment.kind === 'name'
          ? other.kind === 'name' && segment.name === other.name
          : other.kind === 'index' && segment.index === other.index)
      );
    })
  );
}
