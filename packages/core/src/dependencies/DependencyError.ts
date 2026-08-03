export const DEPENDENCY_ERROR_DEFINITIONS = [
  { code: 'cycle', description: 'The dependency graph contains a cycle.' },
  {
    code: 'cascade-limit',
    description: 'A dependency transaction exceeded its configured settle limit.',
  },
] as const;

export type DependencyErrorCode = (typeof DEPENDENCY_ERROR_DEFINITIONS)[number]['code'];

/**
 * A structural problem in the graph or its execution.
 *
 * `nodes` is the point of this type. Checklist B8 requires cycles to be *reported*,
 * not merely detected, and "there is a cycle somewhere in your survey logic" is not a
 * report — the participating node keys, in order, are.
 */
export interface DependencyError {
  readonly code: DependencyErrorCode;
  readonly message: string;
  /** Participating node keys. For a cycle, in the order they close the loop. */
  readonly nodes: readonly string[];
}
