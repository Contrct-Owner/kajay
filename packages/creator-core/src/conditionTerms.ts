import { parseExpression, printExpression } from '@kajay/core';
import type { ExpressionNode, SourceSpan } from '@kajay/core';

/**
 * An expression as a row of dropdowns, and back — checklist M1.
 *
 * **The visual builder handles what it can represent, and never rewrites what it cannot.**
 * A condition is a flat run of comparisons joined by one operator — `{who} == 'yes' and
 * {age} > 18` — because that is what a table of dropdowns *is*. Anything else,
 * `({a} = 1 or {b} = 2) and {c} notempty`, comes back `undefined` from {@link conditionOf}
 * and stays a text field.
 *
 * That refusal is the load-bearing part of this file. A builder that "mostly" understood an
 * expression would silently flatten a designer's parentheses the first time they opened the
 * row, and the survey would change meaning without anybody touching it.
 *
 * **Printing goes through core's own printer**, never string concatenation: the round trip
 * is then core's problem, already tested, and the spelling is canonical (`=` comes back
 * as `==`).
 */

/** Comparisons a dropdown can offer. The canonical spellings, as the printer emits them. */
export const CONDITION_OPERATORS = [
  '==',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'contains',
  'notcontains',
  'anyof',
  'allof',
  'empty',
  'notempty',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

/**
 * The two that take nothing on the right, so the value cell is not drawn for them.
 *
 * A type guard rather than a predicate, because the two halves of the union are two
 * different node kinds in the AST — a postfix and a binary — and the compiler is the right
 * thing to be checking that, not a comment.
 */
export function isUnaryOperator(
  operator: ConditionOperator,
): operator is 'empty' | 'notempty' {
  return operator === 'empty' || operator === 'notempty';
}

export interface ConditionTerm {
  /** The reference path being tested, without braces: `who`, `panel[0].rating`. */
  readonly left: string;
  readonly operator: ConditionOperator;
  /**
   * What it is compared against, as a designer types it.
   *
   * `yes`, `18`, or `{other}` — see {@link valueNodeOf} for exactly how those are read.
   * Empty for `empty` and `notempty`.
   */
  readonly right: string;
}

export type ConditionJoin = 'and' | 'or';

export interface Condition {
  readonly terms: readonly ConditionTerm[];
  /**
   * How the terms are joined. One operator for the whole row, never a mixture.
   *
   * A mixture is where precedence starts to matter, and a table with no parentheses in it
   * cannot say whether `a and b or c` meant `(a and b) or c`. So a mixed expression is not
   * representable and keeps its text — see the file comment.
   */
  readonly join: ConditionJoin;
}

/** Spans are for error reporting; a node this file builds has never been in a file. */
const NO_SPAN: SourceSpan = { start: 0, end: 0 };

/**
 * An expression as terms, or `undefined` when the builder cannot say it.
 *
 * An empty expression is an empty condition rather than a refusal: a rule with no
 * condition yet is the state every new one starts in.
 */
export function conditionOf(source: string): Condition | undefined {
  if (source.trim().length === 0) {
    return { terms: [], join: 'and' };
  }
  const parsed = parseExpression(source);
  if (parsed.errors.length > 0) {
    return undefined;
  }
  const join = joinOf(parsed.node);
  const leaves = flatten(parsed.node, join);
  const terms: ConditionTerm[] = [];
  for (const leaf of leaves) {
    const term = termOf(leaf);
    if (term === undefined) {
      return undefined;
    }
    terms.push(term);
  }
  return { terms, join };
}

/** The joining operator, which is whatever the top of the tree is. */
function joinOf(node: ExpressionNode): ConditionJoin {
  return node.kind === 'binary' && node.operator === 'or' ? 'or' : 'and';
}

/**
 * The tree flattened along one joining operator.
 *
 * Anything that is not that operator is a leaf, including the *other* joining operator —
 * which is what makes a mixed expression fail: the `or` inside an `and` arrives here as a
 * leaf, and no leaf is a comparison, so {@link termOf} refuses it.
 */
function flatten(node: ExpressionNode, join: ConditionJoin): readonly ExpressionNode[] {
  if (node.kind === 'binary' && node.operator === join) {
    return [...flatten(node.left, join), ...flatten(node.right, join)];
  }
  return [node];
}

function termOf(node: ExpressionNode): ConditionTerm | undefined {
  if (node.kind === 'postfix' && node.operand.kind === 'reference') {
    return { left: pathOf(node.operand), operator: node.operator, right: '' };
  }
  if (node.kind !== 'binary' || node.left.kind !== 'reference') {
    return undefined;
  }
  const operator = CONDITION_OPERATORS.find((candidate) => candidate === node.operator);
  if (operator === undefined || isUnaryOperator(operator)) {
    return undefined;
  }
  const right = valueTextOf(node.right);
  return right === undefined ? undefined : { left: pathOf(node.left), operator, right };
}

function pathOf(node: ExpressionNode): string {
  return node.kind === 'reference' ? printExpression(node).slice(1, -1) : '';
}

/**
 * The right-hand side as a designer reads it.
 *
 * A literal loses its quotes — a value box holds `yes`, not `'yes'` — and a reference keeps
 * its braces, because that is how a designer says "the answer to that question" and it is
 * how they would type it. Anything else (a call, arithmetic, an array) is not a value a box
 * can hold, so the whole condition falls back to text.
 */
function valueTextOf(node: ExpressionNode): string | undefined {
  if (node.kind === 'literal') {
    return node.value === null ? 'null' : String(node.value);
  }
  return node.kind === 'reference' ? printExpression(node) : undefined;
}

/**
 * Terms back into an expression, through core's printer.
 *
 * An empty condition prints as the empty string rather than as `true`: a rule with no
 * condition is one that has not been written yet, and `visibleIf: "true"` is a rule that
 * has — the definition would stop round-tripping to the same thing.
 */
export function printCondition(condition: Condition): string {
  const nodes = condition.terms.map((term) => nodeOf(term));
  const [first, ...rest] = nodes;
  if (first === undefined) {
    return '';
  }
  return printExpression(
    rest.reduce<ExpressionNode>(
      (left, right) => ({ kind: 'binary', span: NO_SPAN, operator: condition.join, left, right }),
      first,
    ),
  );
}

function nodeOf(term: ConditionTerm): ExpressionNode {
  const left: ExpressionNode = {
    kind: 'reference',
    span: NO_SPAN,
    path: term.left.split('.').map((name) => ({ kind: 'name' as const, name })),
  };
  const operator = term.operator;
  if (isUnaryOperator(operator)) {
    return { kind: 'postfix', span: NO_SPAN, operator, operand: left };
  }
  return { kind: 'binary', span: NO_SPAN, operator, left, right: valueNodeOf(term.right) };
}

/**
 * What a designer typed in a value box, as a node.
 *
 * Four rules, in order, and they are deliberately **not** "parse it as an expression":
 * a date typed as `2026-01-01` parses as arithmetic and comes out as 2024, which is the
 * kind of thing that is discovered by a respondent rather than by a designer.
 *
 * - `{something}` is a reference, because braces are how the language says so.
 * - `true`, `false` and `null` are themselves.
 * - a plain number is a number.
 * - **everything else is a string**, which is what a word in a value box is.
 */
export function valueNodeOf(text: string): ExpressionNode {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const parsed = parseExpression(trimmed);
    if (parsed.errors.length === 0 && parsed.node.kind === 'reference') {
      return parsed.node;
    }
  }
  if (trimmed === 'true' || trimmed === 'false') {
    return { kind: 'literal', span: NO_SPAN, value: trimmed === 'true' };
  }
  if (trimmed === 'null') {
    return { kind: 'literal', span: NO_SPAN, value: null };
  }
  if (/^-?\d+(\.\d+)?$/u.test(trimmed)) {
    return { kind: 'literal', span: NO_SPAN, value: Number(trimmed) };
  }
  return { kind: 'literal', span: NO_SPAN, value: text };
}
