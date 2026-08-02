import type { PathSegment } from '../expressions/ExpressionNode.js';

/**
 * Resolves an expression's reference path against the survey's answers.
 *
 * Takes a lookup rather than a map because the first segment may name either an
 * answer or a calculated value, and it must read live state: logic evaluates
 * repeatedly during a single settle, and each rule must see what the rules before it
 * wrote.
 */
export function createPathResolver(
  lookup: (name: string) => unknown,
): (path: readonly PathSegment[]) => unknown {
  return (path) => {
    const [first, ...rest] = path;
    if (first === undefined || first.kind !== 'name') {
      return;
    }
    let current: unknown = lookup(first.name);
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
