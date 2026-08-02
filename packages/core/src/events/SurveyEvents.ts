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

/** Which computed state changed. Each is driven by its own `*If` expression. */
export type ElementStateKind = 'visible' | 'enabled' | 'required';

/**
 * Emitted after logic has settled, never part-way through a cascade.
 *
 * One event with a discriminator rather than one event per state: all three are
 * produced by the same engine and consumed for the same reason (something has to
 * re-render), so splitting them would multiply the subscription surface for nothing.
 */
export interface ElementStateChangedEvent {
  readonly element: SurveyElement;
  readonly state: ElementStateKind;
  readonly value: boolean;
}
