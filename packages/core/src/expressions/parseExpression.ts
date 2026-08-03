import type { ExpressionError } from './ExpressionError.js';
import type { BinaryOperator, ExpressionNode, SourceSpan, UnaryOperator } from './ExpressionNode.js';
import {
  BINARY_PRECEDENCE,
  KEYWORD_OPERATORS,
  LOWEST_PRECEDENCE,
  POSTFIX_OPERATORS,
  POWER_PRECEDENCE,
  PUNCTUATION_OPERATORS,
} from './operators.js';
import { parseReferencePath } from './parseReferencePath.js';
import type { Token } from './Token.js';
import { tokenize } from './tokenize.js';

export interface ParseExpressionResult {
  /** Always present. On failure it contains error nodes rather than being absent. */
  readonly node: ExpressionNode;
  readonly errors: readonly ExpressionError[];
}

function span(from: SourceSpan, to: SourceSpan): SourceSpan {
  return { start: from.start, end: to.end };
}

const END_OF_INPUT: Token = { kind: 'eof', text: '', span: { start: 0, end: 0 } };

class Parser {
  readonly #tokens: readonly Token[];
  readonly #errors: ExpressionError[];
  #position = 0;

  constructor(tokens: readonly Token[], errors: readonly ExpressionError[]) {
    this.#tokens = tokens;
    this.#errors = [...errors];
  }

  get errors(): readonly ExpressionError[] {
    return this.#errors;
  }

  #peek(): Token {
    // tokenize always appends an eof token, so this never falls off the end.
    return this.#tokens[this.#position] ?? END_OF_INPUT;
  }

  #advance(): Token {
    const token = this.#peek();
    if (token.kind !== 'eof') {
      this.#position += 1;
    }
    return token;
  }

  #fail(code: string, message: string, at: SourceSpan): ExpressionNode {
    this.#errors.push({ code, message, span: at });
    return { kind: 'error', span: at, message };
  }

  parse(): ExpressionNode {
    if (this.#peek().kind === 'eof') {
      return this.#fail('empty-expression', 'Expression is empty.', this.#peek().span);
    }
    const node = this.#parseBinary(LOWEST_PRECEDENCE);
    const trailing = this.#peek();
    if (trailing.kind !== 'eof') {
      this.#errors.push({
        code: 'unexpected-trailing-input',
        message: `Unexpected ${JSON.stringify(trailing.text)} after the end of the expression.`,
        span: trailing.span,
      });
    }
    return node;
  }

  #readBinaryOperator(): BinaryOperator | undefined {
    const token = this.#peek();
    if (token.kind === 'punctuation') {
      return PUNCTUATION_OPERATORS[token.text];
    }
    if (token.kind === 'identifier') {
      return KEYWORD_OPERATORS[token.text.toLowerCase()];
    }
    return undefined;
  }

  #parseBinary(minPrecedence: number): ExpressionNode {
    let left = this.#parseUnary();

    for (;;) {
      const operator = this.#readBinaryOperator();
      if (operator === undefined) {
        break;
      }
      const precedence = BINARY_PRECEDENCE[operator];
      if (precedence < minPrecedence) {
        break;
      }
      this.#advance();
      // `^` is right-associative; everything else is left-associative.
      const nextMinimum = operator === '^' ? precedence : precedence + 1;
      const right = this.#parseBinary(nextMinimum);
      left = { kind: 'binary', span: span(left.span, right.span), operator, left, right };
    }

    return left;
  }

  #parseUnary(): ExpressionNode {
    const token = this.#peek();
    const isNot =
      (token.kind === 'identifier' && token.text.toLowerCase() === 'not') ||
      (token.kind === 'punctuation' && token.text === '!');
    const isNegate = token.kind === 'punctuation' && token.text === '-';

    if (isNot || isNegate) {
      this.#advance();
      const operator: UnaryOperator = isNot ? 'not' : '-';
      // Parsing the operand at power precedence makes `-{a}^2` mean `-({a}^2)`,
      // matching ordinary mathematical convention.
      const operand = this.#parseBinary(POWER_PRECEDENCE);
      return { kind: 'unary', span: span(token.span, operand.span), operator, operand };
    }

    return this.#parsePostfix();
  }

  #parsePostfix(): ExpressionNode {
    let operand = this.#parsePrimary();
    for (;;) {
      const token = this.#peek();
      if (token.kind !== 'identifier') {
        break;
      }
      const operator = POSTFIX_OPERATORS[token.text.toLowerCase()];
      if (operator === undefined) {
        break;
      }
      this.#advance();
      operand = { kind: 'postfix', span: span(operand.span, token.span), operator, operand };
    }
    return operand;
  }

  #parsePrimary(): ExpressionNode {
    const token = this.#advance();

    switch (token.kind) {
      case 'number': {
        const value = Number(token.text);
        if (Number.isNaN(value)) {
          return this.#fail(
            'invalid-number',
            `${JSON.stringify(token.text)} is not a valid number.`,
            token.span,
          );
        }
        return { kind: 'literal', span: token.span, value };
      }
      case 'string':
        return { kind: 'literal', span: token.span, value: token.text };
      case 'reference':
        return {
          kind: 'reference',
          span: token.span,
          path: parseReferencePath(token.text, token.span, this.#errors),
        };
      case 'identifier':
        return this.#parseIdentifier(token);
      case 'punctuation':
        return this.#parsePunctuation(token);
      default:
        return this.#fail(
          'unexpected-end',
          'Expression ended before a value was given.',
          token.span,
        );
    }
  }

  #parseIdentifier(token: Token): ExpressionNode {
    const lowered = token.text.toLowerCase();
    if (lowered === 'true' || lowered === 'false') {
      return { kind: 'literal', span: token.span, value: lowered === 'true' };
    }
    if (lowered === 'null' || lowered === 'undefined') {
      return { kind: 'literal', span: token.span, value: null };
    }

    const next = this.#peek();
    if (next.kind === 'punctuation' && next.text === '(') {
      this.#advance();
      const args = this.#parseArguments(')');
      const closing = this.#expect(')', token.span);
      return { kind: 'call', span: span(token.span, closing), name: token.text, args };
    }

    return this.#fail(
      'unknown-identifier',
      `${JSON.stringify(token.text)} is not a value. Did you mean a reference, {${token.text}}, or a function call, ${token.text}(...)?`,
      token.span,
    );
  }

  #parsePunctuation(token: Token): ExpressionNode {
    if (token.text === '(') {
      const inner = this.#parseBinary(LOWEST_PRECEDENCE);
      this.#expect(')', token.span);
      return inner;
    }
    if (token.text === '[') {
      const items = this.#parseArguments(']');
      const closing = this.#expect(']', token.span);
      return { kind: 'array', span: span(token.span, closing), items };
    }
    return this.#fail('unexpected-token', `Unexpected ${JSON.stringify(token.text)}.`, token.span);
  }

  #parseArguments(closing: string): readonly ExpressionNode[] {
    const args: ExpressionNode[] = [];
    if (this.#peek().kind === 'punctuation' && this.#peek().text === closing) {
      return args;
    }
    for (;;) {
      args.push(this.#parseBinary(LOWEST_PRECEDENCE));
      const next = this.#peek();
      if (next.kind === 'punctuation' && next.text === ',') {
        this.#advance();
        continue;
      }
      break;
    }
    return args;
  }

  #expect(text: string, opened: SourceSpan): SourceSpan {
    const token = this.#peek();
    if (token.kind === 'punctuation' && token.text === text) {
      this.#advance();
      return token.span;
    }
    this.#errors.push({
      code: 'unclosed-group',
      message: `Expected ${JSON.stringify(text)}.`,
      span: token.span,
    });
    return opened;
  }
}

/**
 * Reads an expression into an AST.
 *
 * Never throws. A malformed expression still yields a tree containing error nodes,
 * because the visual logic editor has to render what it can rather than nothing, and
 * because reporting every problem at once beats one error per attempt.
 */
export function parseExpression(source: string): ParseExpressionResult {
  const { tokens, errors } = tokenize(source);
  const parser = new Parser(tokens, errors);
  const node = parser.parse();
  return { node, errors: parser.errors };
}
