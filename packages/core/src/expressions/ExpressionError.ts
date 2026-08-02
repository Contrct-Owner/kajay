import type { SourceSpan } from './ExpressionNode.js';

/**
 * A problem found while reading an expression.
 *
 * Carries a span rather than just a message because the Creator's JSON editor (M2) and
 * expression editor (L2) both need to point at the offending characters.
 */
export interface ExpressionError {
  /** Stable machine-readable identifier, e.g. `unterminated-string`. */
  readonly code: string;
  readonly message: string;
  readonly span: SourceSpan;
}
