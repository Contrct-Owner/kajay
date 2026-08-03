import type { ExpressionError } from './ExpressionError.js';
import type { PathSegment, SourceSpan } from './ExpressionNode.js';

interface IndexScan {
  readonly segment: PathSegment | undefined;
  readonly nextIndex: number;
  readonly error: string | undefined;
}

function scanIndex(raw: string, openBracket: number): IndexScan {
  const closing = raw.indexOf(']', openBracket);
  const digits = closing === -1 ? raw.slice(openBracket + 1) : raw.slice(openBracket + 1, closing);
  const nextIndex = closing === -1 ? raw.length : closing + 1;

  if (closing === -1 || !/^\d+$/u.test(digits.trim())) {
    return { segment: undefined, nextIndex, error: digits };
  }
  return {
    segment: { kind: 'index', index: Math.trunc(Number(digits)) },
    nextIndex,
    error: undefined,
  };
}

/**
 * Splits `panel[0].question` into structured segments.
 *
 * Producing segments rather than a string is what lets the dependency graph match
 * patterns across dynamic collections (ADR-0004) — "this column of every matrix row"
 * cannot be expressed reliably against a flat string.
 */
export function parseReferencePath(
  raw: string,
  referenceSpan: SourceSpan,
  errors: ExpressionError[],
): readonly PathSegment[] {
  const segments: PathSegment[] = [];
  let name = '';
  let index = 0;

  const flushName = (): void => {
    if (name.length > 0) {
      segments.push({ kind: 'name', name });
      name = '';
    }
  };

  while (index < raw.length) {
    const char = raw[index] ?? '';
    if (char === '.') {
      flushName();
      index += 1;
    } else if (char === '[') {
      flushName();
      const scan = scanIndex(raw, index);
      if (scan.segment === undefined) {
        errors.push({
          code: 'invalid-reference-index',
          message: `Reference index ${JSON.stringify(scan.error)} is not a whole number.`,
          span: referenceSpan,
        });
      } else {
        segments.push(scan.segment);
      }
      index = scan.nextIndex;
    } else {
      name += char;
      index += 1;
    }
  }
  flushName();

  if (segments.length === 0) {
    errors.push({
      code: 'empty-reference',
      message: 'Reference is empty; expected a name such as {question}.',
      span: referenceSpan,
    });
  }
  return segments;
}
