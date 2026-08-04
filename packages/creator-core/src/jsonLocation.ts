/**
 * Where in the text a JSON error is — checklist M2.
 *
 * `JSON.parse` reports a *character offset*, and every editor a designer has ever used
 * reports a line and a column. Converting between the two is this file, and it is separate
 * from the session so it can be reasoned about as a function of a string.
 */

/** A position in the draft, counted the way an editor counts. */
export interface JsonLocation {
  /** 1-based, because "line 0" is not a thing anybody has ever said about a file. */
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

/**
 * The offset a `SyntaxError` is talking about, if it says.
 *
 * **Read out of the message, and defensively**, because the message is not a contract. V8
 * has changed its wording more than once — "Unexpected token } in JSON at position 42"
 * became "Expected ',' or '}' after property value in JSON at position 42 (line 3 column
 * 5)" — and other engines word it differently again. What has stayed put across all of
 * them is `position <n>`, so that is the one thing this looks for, and it reports nothing
 * rather than guessing when it is absent.
 *
 * The line and column are then computed from the text here rather than trusted from the
 * message, so they are right on every engine that reports a position at all.
 */
export function syntaxErrorOffset(message: string): number | undefined {
  const found = /position (\d+)/u.exec(message);
  const offset = found?.[1];
  return offset === undefined ? undefined : Number(offset);
}

/**
 * The line and column an offset falls on.
 *
 * Newlines are counted, not characters — a column is a position within its line. An offset
 * past the end of the text lands at the end of it, which is where an unterminated object
 * actually is: the parser ran out of input rather than objecting to something it saw.
 */
export function locationOf(text: string, offset: number): JsonLocation {
  const at = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, at);
  const lastBreak = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length,
    column: at - lastBreak,
    offset: at,
  };
}
