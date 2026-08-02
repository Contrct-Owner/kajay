import type { Question } from '../model/Question.js';
import type { SurveyElement } from '../model/SurveyElement.js';
import type { SurveyState } from '../model/SurveyState.js';

/** Payloads of the typed event surface hosts and renderers program against. */

export interface ValueChangedEvent {
  readonly name: string;
  readonly value: unknown;
  readonly previousValue: unknown;
}

export interface CompleteEvent {
  readonly data: Readonly<Record<string, unknown>>;
}

/** Raised when the survey moves between loading, empty, running and completed. */
export interface SurveyStateChangedEvent {
  readonly state: SurveyState;
}

export interface CurrentPageChangedEvent {
  readonly previousPageNo: number;
  readonly currentPageNo: number;
}

/**
 * Raised for each question as it is checked, after its own validators have run.
 *
 * The synchronous half of the host's validation seam: a rule that needs application
 * knowledge but no round trip belongs here, rather than in a registered validator type
 * that nothing else will ever instantiate.
 *
 * Listeners report by calling `addError`. Returning a value would not compose — several
 * listeners can each have something to say about the same answer.
 */
export interface ValidateQuestionEvent {
  readonly question: Question;
  readonly value: unknown;
  readonly addError: (text: string) => void;
}

/** Whether a check that left the process is still outstanding. */
export interface ValidatingChangedEvent {
  readonly isValidating: boolean;
}

/** Which computed aspect of an element changed. */
export type ElementStateKind =
  | 'visible'
  | 'enabled'
  | 'required'
  | 'choices'
  | 'collapsed'
  | 'errors'
  | 'readonly';

/**
 * The subset an expression can drive.
 *
 * Narrower than `ElementStateKind` on purpose: `choices`, `collapsed`, `errors` and
 * `readonly` also travel on the state channel, but none has a condition behind it, so
 * none may reach the code that applies a rule's result.
 */
export type ConditionalStateKind = 'visible' | 'enabled' | 'required';

/**
 * Emitted after logic has settled, never part-way through a cascade.
 *
 * A discriminated union rather than one shape with an optional field: `visible`,
 * `enabled` and `required` are booleans, while a choice list or an error list changing
 * is not — there is no value to report, only the fact that it happened.
 */
export type ElementStateChangedEvent =
  | {
      readonly element: SurveyElement;
      readonly state: 'visible' | 'enabled' | 'required' | 'collapsed' | 'readonly';
      readonly value: boolean;
    }
  | {
      readonly element: SurveyElement;
      readonly state: 'choices' | 'errors';
    };
