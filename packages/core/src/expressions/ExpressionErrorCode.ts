export const EXPRESSION_ERROR_DEFINITIONS = [
  { code: 'unterminated-string', phase: 'parse', description: 'A string has no closing quote.' },
  {
    code: 'unterminated-reference',
    phase: 'parse',
    description: 'A reference has no closing brace.',
  },
  {
    code: 'unexpected-character',
    phase: 'parse',
    description: 'The tokenizer encountered a character outside the grammar.',
  },
  {
    code: 'invalid-reference-index',
    phase: 'parse',
    description: 'A reference index is not a non-negative integer.',
  },
  { code: 'empty-reference', phase: 'parse', description: 'A reference contains no path.' },
  { code: 'empty-expression', phase: 'parse', description: 'The expression is empty.' },
  {
    code: 'unexpected-trailing-input',
    phase: 'parse',
    description: 'Valid input is followed by an unexpected token.',
  },
  { code: 'invalid-number', phase: 'parse', description: 'A numeric token is not finite.' },
  {
    code: 'unexpected-end',
    phase: 'parse',
    description: 'The expression ended where an operand was required.',
  },
  {
    code: 'unknown-identifier',
    phase: 'parse',
    description: 'A bare identifier is neither a literal nor a function call.',
  },
  { code: 'unexpected-token', phase: 'parse', description: 'A token cannot begin an operand.' },
  { code: 'unclosed-group', phase: 'parse', description: 'A group or array is not closed.' },
  {
    code: 'unparsed-expression',
    phase: 'evaluate',
    description: 'Evaluation reached an error node produced by parsing.',
  },
  {
    code: 'unknown-function',
    phase: 'evaluate',
    description: 'A call names no registered expression function.',
  },
  {
    code: 'async-unavailable',
    phase: 'evaluate',
    description: 'An asynchronous function was evaluated without an asynchronous value source.',
  },
  {
    code: 'function-failed',
    phase: 'evaluate',
    description: 'An asynchronous expression function rejected or threw.',
  },
] as const;

export type ExpressionErrorCode = (typeof EXPRESSION_ERROR_DEFINITIONS)[number]['code'];
