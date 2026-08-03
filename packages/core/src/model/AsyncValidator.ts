import type { SurveyError } from './SurveyError.js';
import { Validator } from './Validator.js';
import type { ValidationContext } from './Validator.js';

/**
 * A check that has to leave the process to answer — a uniqueness lookup, a lookup
 * against a registry.
 *
 * A separate base rather than letting `validate` return a promise, so the ordinary case
 * stays ordinary: a survey with no async validator never awaits anything, and
 * `validateCurrentPage` remains a synchronous question with a synchronous answer. The
 * sync pass simply skips these; the async pass runs only when one is present.
 *
 * Core makes no requests itself (ADR-0010 keeps it I/O-free) — the host's own subclass
 * does, which is also what makes it testable without a network.
 */
export abstract class AsyncValidator extends Validator {
  /**
   * Nothing to say synchronously. Deliberately not abstract: an async validator that
   * also had to implement a sync check would invite a duplicate of the real one.
   */
  override validate(_context: ValidationContext): SurveyError | undefined {
    return undefined;
  }

  /** Undefined means the answer passed. */
  abstract validateAsync(context: ValidationContext): Promise<SurveyError | undefined>;
}
