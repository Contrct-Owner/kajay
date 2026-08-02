import type { PathSegment } from '../expressions/ExpressionNode.js';

/**
 * Resolves an expression's reference path against the survey's answers.
 *
 * Reads the live map rather than a copy, because logic evaluates repeatedly during a
 * single settle and each rule must see the writes the rules before it made.
 */
export function createPathResolver(
  data: ReadonlyMap<string, unknown>,
): (path: readonly PathSegment[]) => unknown {
  return (path) => {
    const [first, ...rest] = path;
    if (first === undefined || first.kind !== 'name') {
      return;
    }
    let current: unknown = data.get(first.name);
    for (const segment of rest) {
      if (current === null || current === undefined) {
        return;
      }
      current =
        segment.kind === 'index'
          ? (current as Record<number, unknown>)[segment.index]
          : (current as Record<string, unknown>)[segment.name];
    }
    return current;
  };
}
