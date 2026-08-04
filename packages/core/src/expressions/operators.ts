/**
 * Syntax facts shared by the tokenizer, Pratt parser, and canonical printer.
 *
 * Evaluation deliberately does not live here: precedence, spelling, and
 * associativity describe syntax, while value semantics are a separate concern. The
 * records are exhaustive over the operator unions, so adding an operator cannot leave
 * a second syntax list silently incomplete.
 */

export type BinaryOperator =
  | 'or'
  | 'and'
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'contains'
  | 'notcontains'
  | 'anyof'
  | 'allof'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '^';

export type UnaryOperator = 'not' | '-';

export type PostfixOperator = 'empty' | 'notempty';

export interface BinaryOperatorSyntax {
  readonly spellings: readonly string[];
  /** Integer Pratt binding rank. Kept distinct from the printer's parentheses scale. */
  readonly parsePrecedence: number;
  /** Parentheses rank. Kept distinct from the parser's binding scale. */
  readonly printPrecedence: number;
  readonly associativity: 'left' | 'right';
}

export interface UnaryOperatorSyntax {
  readonly spellings: readonly string[];
  readonly parseOperandPrecedence: number;
  readonly printPrecedence: number;
  readonly printOperandPrecedence: number;
  readonly separator: '' | ' ';
}

export interface PostfixOperatorSyntax {
  readonly spellings: readonly string[];
  readonly printPrecedence: number;
}

const BINARY_OPERATORS: Readonly<Record<BinaryOperator, BinaryOperatorSyntax>> = {
  or: { spellings: ['or', '||'], parsePrecedence: 1, printPrecedence: 10, associativity: 'left' },
  and: { spellings: ['and', '&&'], parsePrecedence: 2, printPrecedence: 20, associativity: 'left' },
  '==': { spellings: ['==', '='], parsePrecedence: 3, printPrecedence: 30, associativity: 'left' },
  '!=': { spellings: ['!=', '<>'], parsePrecedence: 3, printPrecedence: 30, associativity: 'left' },
  '>': { spellings: ['>'], parsePrecedence: 3, printPrecedence: 30, associativity: 'left' },
  '>=': { spellings: ['>='], parsePrecedence: 3, printPrecedence: 30, associativity: 'left' },
  '<': { spellings: ['<'], parsePrecedence: 3, printPrecedence: 30, associativity: 'left' },
  '<=': { spellings: ['<='], parsePrecedence: 3, printPrecedence: 30, associativity: 'left' },
  contains: { spellings: ['contains'], parsePrecedence: 3, printPrecedence: 30, associativity: 'left' },
  notcontains: { spellings: ['notcontains'], parsePrecedence: 3, printPrecedence: 30, associativity: 'left' },
  anyof: { spellings: ['anyof'], parsePrecedence: 3, printPrecedence: 30, associativity: 'left' },
  allof: { spellings: ['allof'], parsePrecedence: 3, printPrecedence: 30, associativity: 'left' },
  '+': { spellings: ['+'], parsePrecedence: 4, printPrecedence: 40, associativity: 'left' },
  '-': { spellings: ['-'], parsePrecedence: 4, printPrecedence: 40, associativity: 'left' },
  '*': { spellings: ['*'], parsePrecedence: 5, printPrecedence: 50, associativity: 'left' },
  '/': { spellings: ['/'], parsePrecedence: 5, printPrecedence: 50, associativity: 'left' },
  '%': { spellings: ['%'], parsePrecedence: 5, printPrecedence: 50, associativity: 'left' },
  '^': { spellings: ['^'], parsePrecedence: 6, printPrecedence: 60, associativity: 'right' },
};

const UNARY_OPERATORS: Readonly<Record<UnaryOperator, UnaryOperatorSyntax>> = {
  not: {
    spellings: ['not', '!'],
    parseOperandPrecedence: 6,
    printPrecedence: 55,
    printOperandPrecedence: 60,
    separator: ' ',
  },
  '-': {
    spellings: ['-'],
    parseOperandPrecedence: 6,
    printPrecedence: 55,
    printOperandPrecedence: 60,
    separator: '',
  },
};

const POSTFIX_OPERATORS: Readonly<Record<PostfixOperator, PostfixOperatorSyntax>> = {
  empty: { spellings: ['empty'], printPrecedence: 70 },
  notempty: { spellings: ['notempty'], printPrecedence: 70 },
};

export const LOWEST_PRECEDENCE = 1;

function operatorFor<T extends string>(
  spelling: string,
  operators: Readonly<Record<T, { readonly spellings: readonly string[] }>>,
): T | undefined {
  for (const operator of Object.keys(operators) as T[]) {
    if (operators[operator].spellings.includes(spelling)) {
      return operator;
    }
  }
  return undefined;
}

export function binaryOperatorFor(spelling: string): BinaryOperator | undefined {
  return operatorFor(spelling, BINARY_OPERATORS);
}

export function unaryOperatorFor(spelling: string): UnaryOperator | undefined {
  return operatorFor(spelling, UNARY_OPERATORS);
}

export function postfixOperatorFor(spelling: string): PostfixOperator | undefined {
  return operatorFor(spelling, POSTFIX_OPERATORS);
}

export function binaryOperatorSyntax(operator: BinaryOperator): BinaryOperatorSyntax {
  return BINARY_OPERATORS[operator];
}

export function unaryOperatorSyntax(operator: UnaryOperator): UnaryOperatorSyntax {
  return UNARY_OPERATORS[operator];
}

export function postfixOperatorSyntax(operator: PostfixOperator): PostfixOperatorSyntax {
  return POSTFIX_OPERATORS[operator];
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u;

/** Symbolic spellings, longest first so the tokenizer always takes the full operator. */
export const OPERATOR_PUNCTUATION: readonly string[] = [
  ...new Set([
    ...Object.values(BINARY_OPERATORS).flatMap(({ spellings }) => spellings),
    ...Object.values(UNARY_OPERATORS).flatMap(({ spellings }) => spellings),
    ...Object.values(POSTFIX_OPERATORS).flatMap(({ spellings }) => spellings),
  ].filter((spelling) => !IDENTIFIER.test(spelling))),
].toSorted((left, right) => right.length - left.length);
