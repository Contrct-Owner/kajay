import type { ExpressionError } from './ExpressionError.js';
import type { BinaryNode, CallNode, ExpressionNode, PathSegment } from './ExpressionNode.js';
import { formatPath } from './ExpressionNode.js';
import type { FunctionRegistry } from './FunctionRegistry.js';
import {
  compareValues,
  isEmptyValue,
  isTruthy,
  toArray,
  toNumber,
  valuesAreEqual,
} from './expressionValues.js';

export interface EvaluationContext {
  /** Resolves a reference path to a value. Absent values return undefined. */
  getValue: (path: readonly PathSegment[]) => unknown;
  readonly functions: FunctionRegistry;
  /** Explicit clock, so date-dependent expressions are deterministic under test. */
  readonly now: Date;
  /**
   * Where an asynchronous function's answer comes from, when one is in play.
   *
   * Absent for a bare `evaluateExpression` call, which has nowhere to put pending work
   * and no way to re-run itself — so an asynchronous call there is an error rather than
   * a silent `undefined`.
   */
  readonly asyncValues?: AsyncFunctionValues;
}

/** The seam an evaluator reaches asynchronous results through. */
export interface AsyncFunctionValues {
  readonly request: (
    name: string,
    args: readonly unknown[],
    report: (message: string) => void,
  ) => unknown;
}

export interface EvaluationResult {
  readonly value: unknown;
  readonly errors: readonly ExpressionError[];
}

interface EvaluationState {
  readonly context: EvaluationContext;
  readonly errors: ExpressionError[];
}

function evaluateArithmetic(
  operator: '+' | '-' | '*' | '/' | '%' | '^',
  left: unknown,
  right: unknown,
): unknown {
  // `+` concatenates when either side is genuinely textual, which is what authors
  // expect when building a label out of answers.
  if (
    operator === '+' &&
    (typeof left === 'string' || typeof right === 'string') &&
    (toNumber(left) === undefined || toNumber(right) === undefined)
  ) {
    return `${left ?? ''}${right ?? ''}`;
  }

  const a = toNumber(left);
  const b = toNumber(right);
  if (a === undefined || b === undefined) {
    return;
  }

  switch (operator) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? undefined : a / b;
    case '%':
      return b === 0 ? undefined : a % b;
    case '^':
      return a ** b;
  }
}

function evaluateMembership(
  operator: 'contains' | 'notcontains' | 'anyof' | 'allof',
  left: unknown,
  right: unknown,
): boolean {
  const haystack = toArray(left);

  if (operator === 'contains' || operator === 'notcontains') {
    // A string contains a substring; a collection contains an element.
    const found =
      typeof left === 'string' && typeof right === 'string'
        ? left.includes(right)
        : haystack.some((item) => valuesAreEqual(item, right));
    return operator === 'contains' ? found : !found;
  }

  const needles = toArray(right);
  if (operator === 'anyof') {
    return needles.some((needle) => haystack.some((item) => valuesAreEqual(item, needle)));
  }
  return needles.every((needle) => haystack.some((item) => valuesAreEqual(item, needle)));
}

function evaluateComparison(operator: '>' | '>=' | '<' | '<=', left: unknown, right: unknown): boolean {
  const order = compareValues(left, right);
  if (order === undefined) {
    return false;
  }
  switch (operator) {
    case '>':
      return order > 0;
    case '>=':
      return order >= 0;
    case '<':
      return order < 0;
    case '<=':
      return order <= 0;
  }
}

function evaluateBinary(node: BinaryNode, state: EvaluationState): unknown {
  // Short-circuit before evaluating the right side.
  if (node.operator === 'and') {
    return isTruthy(evaluateNode(node.left, state)) && isTruthy(evaluateNode(node.right, state));
  }
  if (node.operator === 'or') {
    return isTruthy(evaluateNode(node.left, state)) || isTruthy(evaluateNode(node.right, state));
  }

  const left = evaluateNode(node.left, state);
  const right = evaluateNode(node.right, state);

  switch (node.operator) {
    case '==':
      return valuesAreEqual(left, right);
    case '!=':
      return !valuesAreEqual(left, right);
    case '>':
    case '>=':
    case '<':
    case '<=':
      return evaluateComparison(node.operator, left, right);
    case 'contains':
    case 'notcontains':
    case 'anyof':
    case 'allof':
      return evaluateMembership(node.operator, left, right);
    default:
      return evaluateArithmetic(node.operator, left, right);
  }
}

function evaluateNode(node: ExpressionNode, state: EvaluationState): unknown {
  switch (node.kind) {
    // Handled first so the switch's final case still returns a value: a trailing
    // `return;` reads as redundant to the linter, while removing it makes the
    // function fall off its end for the compiler.
    case 'error':
      state.errors.push({
        code: 'unparsed-expression',
        message: node.message,
        span: node.span,
      });
      return;
    case 'literal':
      return node.value;
    case 'reference':
      return state.context.getValue(node.path);
    case 'array':
      return node.items.map((item) => evaluateNode(item, state));
    case 'unary': {
      const operand = evaluateNode(node.operand, state);
      if (node.operator === 'not') {
        return !isTruthy(operand);
      }
      const numeric = toNumber(operand);
      return numeric === undefined ? undefined : -numeric;
    }
    case 'postfix': {
      const empty = isEmptyValue(evaluateNode(node.operand, state));
      return node.operator === 'empty' ? empty : !empty;
    }
    case 'binary':
      return evaluateBinary(node, state);
    case 'call': {
      if (state.context.functions.isAsync(node.name)) {
        return evaluateAsyncCall(node, state);
      }
      const implementation = state.context.functions.get(node.name);
      if (implementation === undefined) {
        state.errors.push({
          code: 'unknown-function',
          message: `${JSON.stringify(node.name)} is not a registered expression function.`,
          span: node.span,
        });
        return;
      }
      const args = node.args.map((argument) => evaluateNode(argument, state));
      return implementation(args, { now: state.context.now });
    }
  }
}

/**
 * Reads an asynchronous function's answer, or nothing yet.
 *
 * `undefined` while the work is outstanding, which every operator already treats as an
 * unanswered question — so an expression half-way through a lookup behaves exactly like
 * one waiting on an unanswered question, and no operator needed teaching a third state.
 */
function evaluateAsyncCall(node: CallNode, state: EvaluationState): unknown {
  const values = state.context.asyncValues;
  if (values === undefined) {
    state.errors.push({
      code: 'async-unavailable',
      message: `${JSON.stringify(node.name)} answers asynchronously, which needs a survey to run in.`,
      span: node.span,
    });
    return undefined;
  }
  const args = node.args.map((argument) => evaluateNode(argument, state));
  return values.request(node.name, args, (message) => {
    state.errors.push({ code: 'function-failed', message, span: node.span });
  });
}

/**
 * Evaluates an AST.
 *
 * Never throws: problems become errors in the result, because a bad expression in one
 * question must not take down evaluation of the rest of the survey.
 */
export function evaluateExpression(
  node: ExpressionNode,
  context: EvaluationContext,
): EvaluationResult {
  const state: EvaluationState = { context, errors: [] };
  const value = evaluateNode(node, state);
  return { value, errors: state.errors };
}

/** Convenience for the common case: resolve a path against a flat answer map. */
export function createValueResolver(
  data: Readonly<Record<string, unknown>>,
): (path: readonly PathSegment[]) => unknown {
  return (path) => {
    const [first, ...rest] = path;
    if (first === undefined || first.kind !== 'name') {
      return;
    }
    let current: unknown = data[first.name];
    for (const segment of rest) {
      if (current === null || current === undefined) {
        return;
      }
      current =
        segment.kind === 'index'
          ? (current as Record<number, unknown>)[segment.index]
          : (current as Record<string, unknown>)[segment.name];
    }
    return current;
  };
}

/** Formats a path the way it appears in source. Re-exported for diagnostics. */
export { formatPath };
