import type { ExpressionNode, PathSegment } from './ExpressionNode.js';
import { childNodes, formatPath } from './ExpressionNode.js';

/**
 * Gathers every value this expression reads, as structured paths.
 *
 * This is the seam ADR-0004's dependency graph consumes: dependencies are extracted
 * *statically* from the AST, which is why core needs no automatic tracking and no
 * signals library. Paths are returned in first-appearance order and de-duplicated.
 */
export function collectReferences(node: ExpressionNode): readonly (readonly PathSegment[])[] {
  const seen = new Set<string>();
  const found: (readonly PathSegment[])[] = [];

  const visit = (current: ExpressionNode): void => {
    if (current.kind === 'reference') {
      const key = formatPath(current.path);
      if (!seen.has(key)) {
        seen.add(key);
        found.push(current.path);
      }
      return;
    }
    for (const child of childNodes(current)) {
      visit(child);
    }
  };

  visit(node);
  return found;
}
