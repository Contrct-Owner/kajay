import type { SourceSpan } from './ExpressionNode.js';

export type TokenKind =
  /** Numeric literal. */
  | 'number'
  /** Quoted string literal. */
  | 'string'
  /** Bare word: a keyword operator, a boolean/null literal, or a function name. */
  | 'identifier'
  /** `{path.to.value}` — `text` holds the raw inner text, braces stripped. */
  | 'reference'
  /** Punctuation or a symbolic operator. */
  | 'punctuation'
  /** End of input. Always the final token, so the parser never indexes past the end. */
  | 'eof';

export interface Token {
  readonly kind: TokenKind;
  /** Source text of the token; for references, the text inside the braces. */
  readonly text: string;
  readonly span: SourceSpan;
}
