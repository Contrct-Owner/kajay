import type { SurveyElement } from '../model/SurveyElement.js';

/** Payloads of the typed event surface hosts and renderers program against. */

export interface ValueChangedEvent {
  readonly name: string;
  readonly value: unknown;
  readonly previousValue: unknown;
}

export interface CompleteEvent {
  readonly data: Readonly<Record<string, unknown>>;
}

export interface CurrentPageChangedEvent {
  readonly previousPageNo: number;
  readonly currentPageNo: number;
}

/** Which computed aspect of an element changed. */
export type ElementStateKind = 'visible' | 'enabled' | 'required' | 'choices';

/**
 * Emitted after logic has settled, never part-way through a cascade.
 *
 * A discriminated union rather than one shape with an optional field: `visible`,
 * `enabled` and `required` are booleans, while a choice list changing is not — it has
 * no value to report, only the fact that it happened.
 */
export type ElementStateChangedEvent =
  | {
      readonly element: SurveyElement;
      readonly state: 'visible' | 'enabled' | 'required';
      readonly value: boolean;
    }
  | {
      readonly element: SurveyElement;
      readonly state: 'choices';
    };
