import type { PathSegment } from '../expressions/ExpressionNode.js';

/**
 * Matches any index at this position.
 *
 * This is what makes dynamic collections expressible. Rows of a matrix and instances
 * of a dynamic panel are created and destroyed at runtime, so "this column of every
 * row" cannot be a set of concrete edges — it has to be one edge that concrete paths
 * are matched against as instances appear.
 */
export interface AnyIndexSegment {
  readonly kind: 'anyIndex';
}

export type PatternSegment = PathSegment | AnyIndexSegment;

/** A dependency target: a concrete path, or one generalised over indices. */
export type DependencyPattern = readonly PatternSegment[];

/** The wildcard segment. A single frozen value; segments carry no identity. */
export const ANY_INDEX: AnyIndexSegment = { kind: 'anyIndex' };

function segmentsMatch(pathSegment: PathSegment, patternSegment: PatternSegment): boolean {
  if (patternSegment.kind === 'anyIndex') {
    return pathSegment.kind === 'index';
  }
  if (patternSegment.kind === 'index') {
    return pathSegment.kind === 'index' && pathSegment.index === patternSegment.index;
  }
  return pathSegment.kind === 'name' && pathSegment.name === patternSegment.name;
}

/**
 * True when a change at `path` should invalidate a dependency on `pattern`.
 *
 * Overlap is prefix-based in *both* directions, which is the behaviour a survey needs:
 *
 * - a node reading `panel[0].q` must re-evaluate when `panel` is replaced wholesale;
 * - a node reading `panel` must re-evaluate when `panel[0].q` changes underneath it.
 *
 * Comparing only up to the shorter length is what gives both.
 */
export function pathMatchesPattern(
  path: readonly PathSegment[],
  pattern: DependencyPattern,
): boolean {
  const shared = Math.min(path.length, pattern.length);
  for (let index = 0; index < shared; index += 1) {
    const pathSegment = path[index];
    const patternSegment = pattern[index];
    if (pathSegment === undefined || patternSegment === undefined) {
      return false;
    }
    if (!segmentsMatch(pathSegment, patternSegment)) {
      return false;
    }
  }
  return shared > 0;
}

/** Generalises a concrete path over its indices: `panel[0].q` becomes `panel[*].q`. */
export function generalizeIndices(path: readonly PathSegment[]): DependencyPattern {
  return path.map((segment) => (segment.kind === 'index' ? ANY_INDEX : segment));
}

/** Renders a pattern for diagnostics: `panel[*].q`. */
export function formatPattern(pattern: DependencyPattern): string {
  let output = '';
  for (const segment of pattern) {
    if (segment.kind === 'anyIndex') {
      output += '[*]';
    } else if (segment.kind === 'index') {
      output += `[${segment.index}]`;
    } else {
      output += output.length > 0 ? `.${segment.name}` : segment.name;
    }
  }
  return output;
}
