import type { BinaryOperator, PostfixOperator } from './ExpressionNode.js';

/**
 * Parsing precedences. Higher binds tighter.
 *
 * The printer keeps a separate scale on purpose: printing has to decide where
 * parentheses are *required*, which is a different question from how input binds.
 */
export const BINARY_PRECEDENCE: Readonly<Record<BinaryOperator, number>> = {
  or: 1,
  and: 2,
  '==': 3,
  '!=': 3,
  '>': 3,
  '>=': 3,
  '<': 3,
  '<=': 3,
  contains: 3,
  notcontains: 3,
  anyof: 3,
  allof: 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '%': 5,
  '^': 6,
};

export const POWER_PRECEDENCE = 6;
export const LOWEST_PRECEDENCE = 1;

/** Alternative spellings accepted on input, normalised to one canonical operator. */
export const PUNCTUATION_OPERATORS: Readonly<Record<string, BinaryOperator>> = {
  '==': '==',
  '=': '==',
  '!=': '!=',
  '<>': '!=',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  '&&': 'and',
  '||': 'or',
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '%': '%',
  '^': '^',
};

export const KEYWORD_OPERATORS: Readonly<Record<string, BinaryOperator>> = {
  and: 'and',
  or: 'or',
  contains: 'contains',
  notcontains: 'notcontains',
  anyof: 'anyof',
  allof: 'allof',
};

export const POSTFIX_OPERATORS: Readonly<Record<string, PostfixOperator>> = {
  empty: 'empty',
  notempty: 'notempty',
};
