import type { BinaryOperator, ExpressionNode, LiteralValue } from './ExpressionNode.js';
import { formatPath } from './ExpressionNode.js';

/**
 * Printing precedences, on a scale of their own rather than the parser's.
 *
 * Unary sits *below* `^` so that `(-{a})^2` keeps its parentheses: the parser reads
 * `-{a}^2` as `-({a}^2)`, and printing without the parentheses would silently change
 * the expression's meaning.
 */
const BINARY_PRECEDENCE: Readonly<Record<BinaryOperator, number>> = {
  or: 10,
  and: 20,
  '==': 30,
  '!=': 30,
  '>': 30,
  '>=': 30,
  '<': 30,
  '<=': 30,
  contains: 30,
  notcontains: 30,
  anyof: 30,
  allof: 30,
  '+': 40,
  '-': 40,
  '*': 50,
  '/': 50,
  '%': 50,
  '^': 60,
};

const POWER_PRECEDENCE = 60;
const UNARY_PRECEDENCE = 55;
const POSTFIX_PRECEDENCE = 70;
const PRIMARY_PRECEDENCE = 100;

function precedenceOf(node: ExpressionNode): number {
  switch (node.kind) {
    case 'binary':
      return BINARY_PRECEDENCE[node.operator];
    case 'unary':
      return UNARY_PRECEDENCE;
    case 'postfix':
      return POSTFIX_PRECEDENCE;
    default:
      return PRIMARY_PRECEDENCE;
  }
}

function printLiteral(value: LiteralValue): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
  }
  return String(value);
}

function wrap(node: ExpressionNode, minimumPrecedence: number): string {
  const printed = printExpression(node);
  return precedenceOf(node) < minimumPrecedence ? `(${printed})` : printed;
}

/**
 * Renders an AST as canonical source.
 *
 * Canonical means one spelling per operator (`=` and `<>` come back as `==` and `!=`),
 * single-quoted strings, and parentheses only where precedence requires them. Parsing
 * the output and printing it again yields the identical string, which is what lets the
 * Creator's logic editor write expressions back without churn.
 *
 * An error node prints as `«error»`, which is deliberately not valid syntax: an
 * unparseable tree must never round-trip as though it were fine.
 */
export function printExpression(node: ExpressionNode): string {
  switch (node.kind) {
    case 'literal':
      return printLiteral(node.value);
    case 'reference':
      return `{${formatPath(node.path)}}`;
    case 'array':
      return `[${node.items.map((item) => printExpression(item)).join(', ')}]`;
    case 'call':
      return `${node.name}(${node.args.map((argument) => printExpression(argument)).join(', ')})`;
    case 'unary': {
      const operand = wrap(node.operand, POWER_PRECEDENCE);
      return node.operator === 'not' ? `not ${operand}` : `-${operand}`;
    }
    case 'postfix':
      return `${wrap(node.operand, POSTFIX_PRECEDENCE)} ${node.operator}`;
    case 'binary': {
      const precedence = BINARY_PRECEDENCE[node.operator];
      const isRightAssociative = node.operator === '^';
      const left = wrap(node.left, isRightAssociative ? precedence + 1 : precedence);
      const right = wrap(node.right, isRightAssociative ? precedence : precedence + 1);
      return `${left} ${node.operator} ${right}`;
    }
    case 'error':
      return '«error»';
  }
}
