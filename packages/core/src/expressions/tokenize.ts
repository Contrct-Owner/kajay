import type { ExpressionError } from './ExpressionError.js';
import type { Token } from './Token.js';

export interface TokenizeResult {
  readonly tokens: readonly Token[];
  readonly errors: readonly ExpressionError[];
}

/**
 * Symbolic operators, longest first so `>=` is never read as `>` followed by `=`.
 * Alternative spellings are accepted here and normalised by the parser, so authors can
 * write `<>` or `&&` while the canonical form stays single-valued.
 */
const PUNCTUATION = [
  '<>',
  '>=',
  '<=',
  '==',
  '!=',
  '&&',
  '||',
  '(',
  ')',
  '[',
  ']',
  ',',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '>',
  '<',
  '=',
  '!',
];

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_]/u.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_]/u.test(char);
}

function matchPunctuation(source: string, index: number): string | undefined {
  return PUNCTUATION.find((candidate) => source.startsWith(candidate, index));
}

function readString(source: string, start: number, errors: ExpressionError[]): Token {
  const quote = source[start];
  let index = start + 1;
  let value = '';
  while (index < source.length && source[index] !== quote) {
    if (source[index] === '\\' && index + 1 < source.length) {
      value += source[index + 1];
      index += 2;
      continue;
    }
    value += source[index];
    index += 1;
  }
  if (index >= source.length) {
    errors.push({
      code: 'unterminated-string',
      message: 'String literal is missing its closing quote.',
      span: { start, end: source.length },
    });
    return { kind: 'string', text: value, span: { start, end: source.length } };
  }
  return { kind: 'string', text: value, span: { start, end: index + 1 } };
}

function readReference(source: string, start: number, errors: ExpressionError[]): Token {
  const closing = source.indexOf('}', start + 1);
  if (closing === -1) {
    errors.push({
      code: 'unterminated-reference',
      message: 'Reference is missing its closing brace.',
      span: { start, end: source.length },
    });
    return { kind: 'reference', text: source.slice(start + 1), span: { start, end: source.length } };
  }
  return {
    kind: 'reference',
    text: source.slice(start + 1, closing),
    span: { start, end: closing + 1 },
  };
}

function readNumber(source: string, start: number): Token {
  let index = start;
  while (index < source.length && isDigit(source[index] ?? '')) {
    index += 1;
  }
  if (source[index] === '.' && isDigit(source[index + 1] ?? '')) {
    index += 1;
    while (index < source.length && isDigit(source[index] ?? '')) {
      index += 1;
    }
  }
  if (source[index] === 'e' || source[index] === 'E') {
    let lookahead = index + 1;
    if (source[lookahead] === '+' || source[lookahead] === '-') {
      lookahead += 1;
    }
    if (isDigit(source[lookahead] ?? '')) {
      index = lookahead;
      while (index < source.length && isDigit(source[index] ?? '')) {
        index += 1;
      }
    }
  }
  return { kind: 'number', text: source.slice(start, index), span: { start, end: index } };
}

function readIdentifier(source: string, start: number): Token {
  let end = start;
  while (end < source.length && isIdentifierPart(source[end] ?? '')) {
    end += 1;
  }
  return { kind: 'identifier', text: source.slice(start, end), span: { start, end } };
}

/** Reads one token at `index`, or reports an unexpected character and returns undefined. */
function readToken(source: string, index: number, errors: ExpressionError[]): Token | undefined {
  const char = source[index] ?? '';

  if (char === '"' || char === "'") {
    return readString(source, index, errors);
  }
  if (char === '{') {
    return readReference(source, index, errors);
  }
  if (isDigit(char)) {
    return readNumber(source, index);
  }
  if (isIdentifierStart(char)) {
    return readIdentifier(source, index);
  }

  const punctuation = matchPunctuation(source, index);
  if (punctuation !== undefined) {
    return {
      kind: 'punctuation',
      text: punctuation,
      span: { start: index, end: index + punctuation.length },
    };
  }

  errors.push({
    code: 'unexpected-character',
    message: `Unexpected character ${JSON.stringify(char)}.`,
    span: { start: index, end: index + 1 },
  });
  return undefined;
}

/**
 * Turns source text into tokens.
 *
 * Never throws: an unterminated string or reference produces a best-effort token plus
 * an error, so the parser still receives a usable stream and the caller sees every
 * problem at once.
 */
export function tokenize(source: string): TokenizeResult {
  const tokens: Token[] = [];
  const errors: ExpressionError[] = [];
  let index = 0;

  while (index < source.length) {
    if (/\s/u.test(source[index] ?? '')) {
      index += 1;
      continue;
    }
    const token = readToken(source, index, errors);
    if (token === undefined) {
      index += 1;
      continue;
    }
    tokens.push(token);
    index = token.span.end;
  }

  tokens.push({ kind: 'eof', text: '', span: { start: source.length, end: source.length } });
  return { tokens, errors };
}
