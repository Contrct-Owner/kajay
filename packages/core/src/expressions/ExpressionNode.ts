/**
 * The expression AST.
 *
 * Every node is a plain serializable object in a discriminated union — no classes and
 * no methods — so it survives `isolatedDeclarations`, can be structurally compared in
 * tests, and can cross the core/creator seam intact when the visual logic editor
 * (checklist M1) round-trips AST → UI → AST.
 */

/** Character offsets into the source text. Half-open: `[start, end)`. */
export interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

/**
 * One step of a reference path.
 *
 * `{panel[0].question}` becomes name/index/name rather than the string `panel[0].q`.
 * That structure is the whole point: ADR-0004's dependency graph needs to match
 * patterns like "every row of this matrix, this column", which is impossible to do
 * reliably against a flat string.
 */
export type PathSegment =
  | { readonly kind: 'name'; readonly name: string }
  | { readonly kind: 'index'; readonly index: number };

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

export type LiteralValue = string | number | boolean | null;

export interface LiteralNode {
  readonly kind: 'literal';
  readonly span: SourceSpan;
  readonly value: LiteralValue;
}

export interface ReferenceNode {
  readonly kind: 'reference';
  readonly span: SourceSpan;
  readonly path: readonly PathSegment[];
}

export interface ArrayNode {
  readonly kind: 'array';
  readonly span: SourceSpan;
  readonly items: readonly ExpressionNode[];
}

export interface UnaryNode {
  readonly kind: 'unary';
  readonly span: SourceSpan;
  readonly operator: UnaryOperator;
  readonly operand: ExpressionNode;
}

export interface PostfixNode {
  readonly kind: 'postfix';
  readonly span: SourceSpan;
  readonly operator: PostfixOperator;
  readonly operand: ExpressionNode;
}

export interface BinaryNode {
  readonly kind: 'binary';
  readonly span: SourceSpan;
  readonly operator: BinaryOperator;
  readonly left: ExpressionNode;
  readonly right: ExpressionNode;
}

export interface CallNode {
  readonly kind: 'call';
  readonly span: SourceSpan;
  readonly name: string;
  readonly args: readonly ExpressionNode[];
}

/**
 * Stands in for a subtree the parser could not read.
 *
 * It exists so a malformed expression still yields a tree: the logic editor renders
 * what it can and marks the rest, instead of showing nothing.
 */
export interface ErrorNode {
  readonly kind: 'error';
  readonly span: SourceSpan;
  readonly message: string;
}

export type ExpressionNode =
  | LiteralNode
  | ReferenceNode
  | ArrayNode
  | UnaryNode
  | PostfixNode
  | BinaryNode
  | CallNode
  | ErrorNode;

/**
 * Direct children of a node, in source order.
 *
 * One place that knows the shape of the tree, so every walker — reference collection
 * now, the dependency graph and the logic editor later — cannot disagree about it.
 */
export function childNodes(node: ExpressionNode): readonly ExpressionNode[] {
  switch (node.kind) {
    case 'array':
      return node.items;
    case 'call':
      return node.args;
    case 'unary':
    case 'postfix':
      return [node.operand];
    case 'binary':
      return [node.left, node.right];
    default:
      return [];
  }
}

/** Renders a reference path the way it is written in source, without the braces. */
export function formatPath(path: readonly PathSegment[]): string {
  let output = '';
  for (const segment of path) {
    if (segment.kind === 'index') {
      output += `[${segment.index}]`;
      continue;
    }
    output += output.length > 0 ? `.${segment.name}` : segment.name;
  }
  return output;
}
