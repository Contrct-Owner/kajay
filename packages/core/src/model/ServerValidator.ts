/** One objection the server raised, against a question named in the request. */
export interface ServerValidationError {
  readonly questionName: string;
  readonly text: string;
}

export interface ServerValidationRequest {
  /** The answers as the host would submit them, including calculated values. */
  readonly data: Readonly<Record<string, unknown>>;
  /** The questions under the current gate — one page's, or the whole survey's. */
  readonly questionNames: readonly string[];
}

/**
 * The host's hook for validation only a server can perform.
 *
 * A promise rather than SurveyJS's `options.complete()` callback: a callback the host
 * has to remember to invoke is a hung survey waiting to happen, and the failure mode is
 * a respondent staring at a disabled button with nothing on screen to explain it.
 *
 * A **rejected** promise is a host or network failure, not a respondent one. It blocks
 * the move — the server is the authority and nothing has confirmed the answers — but it
 * never becomes an error against an answer, because no answer is at fault. It surfaces
 * on `validation.serverError` instead, where a renderer can say what actually happened
 * and offer another go.
 *
 * Core issues no requests of its own; this is where the host's fetch goes.
 */
export type ServerValidator = (
  request: ServerValidationRequest,
) => Promise<readonly ServerValidationError[]>;
