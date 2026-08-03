import type { FileEntry } from '../model/FileEntry.js';
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

/**
 * Raised when the survey switches language — checklist J1.
 *
 * Its own channel rather than folded into element state: nothing about the survey's
 * logic changed, only which of the strings an author already wrote is being read, and
 * putting it on `logicVersion` would advance a counter that means something else.
 */
export interface LocaleChangedEvent {
  readonly locale: string;
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

/**
 * A record appearing in or leaving a repeating question — checklist A7.
 *
 * **One event for matrix rows and dynamic-panel instances**, because they are one
 * thing: §F and §G already share `RepeatingQuestion`, and a host that wanted to react to
 * both would otherwise write the same listener twice and forget the second one when a
 * third repeating type arrives. Which kind it is, is a fact about `question`.
 *
 * Emitted from the model rather than from a button, so a host hears it however the
 * change was caused — a respondent, a trigger, a restored response, a host calling
 * `addRow` itself.
 */
export interface RecordsChangedEvent {
  readonly question: Question;
  /** The row or panel key: for both types today, its index as a string. */
  readonly key: string;
  readonly change: 'added' | 'removed';
  /** How many records there are now, so a listener need not go and ask. */
  readonly count: number;
}

/**
 * Files attached to or taken off a question — checklist A7.
 *
 * **Not the upload seam.** Where a file is *stored* is `SurveyOptions.uploadFiles`,
 * because only the host knows; this is the notification that the answer changed, which
 * anything may watch — a partial save, an audit log, a preview elsewhere on the page.
 * A host that conflated them would find its storage called twice the day something else
 * wanted to know.
 *
 * Reports what moved rather than what remains: "these three arrived" is the fact, and
 * the question still has the whole list for a listener that wants it.
 */
export interface FilesChangedEvent {
  readonly question: Question;
  readonly files: readonly FileEntry[];
  readonly change: 'attached' | 'removed';
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
