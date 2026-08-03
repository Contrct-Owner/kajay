import type { ExpressionNode, PathSegment, ReferenceNode } from './ExpressionNode.js';
import { childNodes, formatPath } from './ExpressionNode.js';
import { parseExpression } from './parseExpression.js';

/**
 * Rewrites references made in a local scope into paths against the survey's answers.
 *
 * A matrix column is authored once and asked of every row, so its conditions talk about
 * `{row.price}` — the cell beside this one — rather than a name the survey knows. Given
 * the row's own path this turns that into `{basket.docs.price}`, which is an ordinary
 * reference in every respect: the dependency graph reads it statically, a change to the
 * cell it names re-evaluates the condition in the same settle, and nothing in the
 * evaluator had to learn about scopes.
 *
 * The alternative — an evaluation context carrying a `row` overlay — would have put a
 * second kind of name resolution inside the engine, and left the graph unable to see
 * what a cell condition depends on.
 *
 * Rewritten by **span**, back to front, so everything the author wrote outside the
 * references survives untouched and the offsets stay valid as the string is edited.
 */
export function scopeReferences(
  expression: string,
  scope: string,
  prefix: readonly PathSegment[],
): string {
  const { node } = parseExpression(expression);
  let output = expression;
  for (const reference of referencesInScope(node, scope).toReversed()) {
    const scoped = `{${formatPath([...prefix, ...reference.path.slice(1)])}}`;
    output = output.slice(0, reference.span.start) + scoped + output.slice(reference.span.end);
  }
  return output;
}

/** References whose first segment names the scope, in source order. */
function referencesInScope(node: ExpressionNode, scope: string): readonly ReferenceNode[] {
  const found: ReferenceNode[] = [];
  const visit = (current: ExpressionNode): void => {
    if (current.kind === 'reference') {
      const [first] = current.path;
      // A bare `{row}` is left alone: it names the scope itself rather than anything in
      // it, and the row's own value is not something a cell condition can be written
      // against without inventing a shape for it.
      if (first?.kind === 'name' && first.name === scope && current.path.length > 1) {
        found.push(current);
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
