export type PatternNode =
  | { readonly kind: 'empty' }
  | { readonly kind: 'sequence'; readonly items: readonly PatternNode[] }
  | { readonly kind: 'alternation'; readonly alternatives: readonly PatternNode[] }
  | { readonly kind: 'scalar'; readonly scalar: ScalarPattern }
  | { readonly kind: 'anchor'; readonly edge: 'start' | 'end' }
  | {
      readonly kind: 'repeat';
      readonly item: PatternNode;
      readonly minimum: number;
      readonly maximum?: number;
    };

export type ScalarPattern =
  | { readonly kind: 'literal'; readonly value: number }
  | { readonly kind: 'dot' }
  | { readonly kind: 'shorthand'; readonly name: ShorthandName }
  | {
      readonly kind: 'class';
      readonly negated: boolean;
      readonly items: readonly CharacterClassItem[];
    };

export type ShorthandName = 'd' | 'D' | 'w' | 'W' | 's' | 'S';

export type CharacterClassItem =
  | { readonly kind: 'range'; readonly first: number; readonly last: number }
  | { readonly kind: 'shorthand'; readonly name: ShorthandName };

export const EMPTY_PATTERN: PatternNode = { kind: 'empty' };

export function sequence(items: readonly PatternNode[]): PatternNode {
  return items.length === 0
    ? EMPTY_PATTERN
    : items.length === 1
      ? items[0]!
      : { kind: 'sequence', items };
}

export function alternation(alternatives: readonly PatternNode[]): PatternNode {
  return alternatives.length === 1 ? alternatives[0]! : { kind: 'alternation', alternatives };
}
