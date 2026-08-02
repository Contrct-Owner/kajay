/**
 * A boolean condition attached to something in the model.
 *
 * `fallback` is per-binding rather than a global default because the safe answer
 * differs by property: a `visibleIf` that cannot be evaluated must leave the question
 * **visible**, since hiding content because an expression is malformed loses answers
 * silently. A `requiredIf` in the same state must fall back to *not* required.
 */
export interface ConditionBinding {
  /** Unique key, and the dependency-graph node key. Convention: `<owner>:<property>`. */
  readonly key: string;
  readonly expression: string;
  /** Result used when the expression is malformed or fails to evaluate. */
  readonly fallback: boolean;
  readonly apply: (result: boolean) => void;
}
