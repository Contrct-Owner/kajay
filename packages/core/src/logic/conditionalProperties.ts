import type { ElementStateKind } from '../events/SurveyEvents.js';

export interface ConditionalProperty {
  readonly property: string;
  readonly state: ElementStateKind;
  /**
   * Result used when the expression is malformed or unevaluable.
   *
   * Visibility and enablement fall back to *permissive*: hiding or freezing a question
   * because its expression is broken loses answers silently. Requiredness falls back
   * to *lenient* for the mirror-image reason — blocking submission over a broken
   * expression is worse than letting the answer through.
   *
   * That the safe answer differs by property is why the fallback lives per-property
   * here rather than as one engine-wide default.
   */
  readonly fallback: boolean;
}

/** The boolean conditions an element may declare, and what each one drives. */
export const CONDITIONAL_PROPERTIES: readonly ConditionalProperty[] = [
  { property: 'visibleIf', state: 'visible', fallback: true },
  { property: 'enableIf', state: 'enabled', fallback: true },
  { property: 'requiredIf', state: 'required', fallback: false },
];
