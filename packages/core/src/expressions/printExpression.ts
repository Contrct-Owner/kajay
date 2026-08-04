import type { ExpressionNode, LiteralValue } from './ExpressionNode.js';
import { formatPath } from './ExpressionNode.js';
import {
  binaryOperatorSyntax,
  postfixOperatorSyntax,
  unaryOperatorSyntax,
} from './operators.js';

const PRIMARY_PRECEDENCE = 100;

function precedenceOf(node: ExpressionNode): number {
  switch (node.kind) {
    case 'binary':
      return binaryOperatorSyntax(node.operator).printPrecedence;
    case 'unary':
      return unaryOperatorSyntax(node.operator).printPrecedence;
    case 'postfix':
      return postfixOperatorSyntax(node.operator).printPrecedence;
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
      const syntax = unaryOperatorSyntax(node.operator);
      const operand = wrap(node.operand, syntax.printOperandPrecedence);
      return `${node.operator}${syntax.separator}${operand}`;
    }
    case 'postfix': {
      const syntax = postfixOperatorSyntax(node.operator);
      return `${wrap(node.operand, syntax.printPrecedence)} ${node.operator}`;
    }
    case 'binary': {
      const syntax = binaryOperatorSyntax(node.operator);
      const precedence = syntax.printPrecedence;
      const isRightAssociative = syntax.associativity === 'right';
      const left = wrap(node.left, isRightAssociative ? precedence + 1 : precedence);
      const right = wrap(node.right, isRightAssociative ? precedence : precedence + 1);
      return `${left} ${node.operator} ${right}`;
    }
    case 'error':
      return '«error»';
  }
}
