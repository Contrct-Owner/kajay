import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import type { Question } from './Question.js';
import type { ServerValidator } from './ServerValidator.js';
import type { SurveyError } from './SurveyError.js';
import type { ExpressionEvaluator } from './validateAnswer.js';
import { clearQuestionErrors, validateQuestions } from './validateAnswer.js';
import { collectAsyncErrors, hasAsyncWork } from './validateAnswerAsync.js';

/**
 * When answers are checked.
 *
 * `onNextPage` is the default because it is the least startling: a respondent is told
 * what is wrong at the moment they try to move on, having had a chance to finish.
 * `onValueChanged` re-checks a field as soon as its answer changes, which suits short
 * forms and is actively unpleasant on long ones. `onComplete` holds everything back to
 * the end, for a survey whose pages are not meant to gate each other.
 */
export type CheckErrorsMode = 'onNextPage' | 'onValueChanged' | 'onComplete';

/** Whether a question's errors are drawn above its input or below it. */
export type QuestionErrorLocation = 'top' | 'bottom';

/**
 * What the gate decided about a forward move.
 *
 * `pending` is not a kind of failure. Nothing is wrong with the answers yet — a check
 * has left the process, and the move happens on its own if it comes back clean. A
 * renderer must not react to it the way it reacts to `blocked`: there is no error to
 * put a respondent in front of, only a wait to show.
 */
export type ValidationGate = 'allowed' | 'blocked' | 'pending';

/**
 * What happened when the respondent asked to move on.
 *
 * `allowed` never reaches a caller — by the time the move is reported it has either
 * happened or it has not — so the gate's third state becomes `advanced` here.
 */
export type AdvanceOutcome = 'advanced' | 'blocked' | 'pending';

/** The parts of the survey validation reads. */
export interface SurveyValidationHost {
  /**
   * Reads and writes the survey's own declared properties.
   *
   * The policy below is authored in the definition and serializes on the survey, so it
   * has to live in the survey's property bag; a copy held here would be a second source
   * of truth that a round-trip could not see.
   */
  readonly readProperty: (name: string) => PropertyValue | undefined;
  readonly writeProperty: (name: string, value: PropertyValue) => void;
  readonly currentPageQuestions: () => readonly Question[];
  readonly allQuestions: () => readonly Question[];
  readonly isLastPage: () => boolean;
  /** Identifies where the respondent is standing, for comparison after a round trip. */
  readonly currentPageName: () => string;
  readonly evaluate: ExpressionEvaluator;
  /** The answers as a host would submit them. Handed to the server validator. */
  readonly data: () => Readonly<Record<string, unknown>>;
  /** Host rules that need no round trip: whatever `onValidateQuestion` reported. */
  readonly hostErrors: (question: Question) => readonly SurveyError[];
  /** Records that one question's errors changed. Buffered, not delivered. */
  readonly announce: (question: Question) => void;
  /** Delivers whatever `announce` buffered — once per check, not once per question. */
  readonly flush: () => void;
  readonly announceValidating: (isValidating: boolean) => void;
}

/**
 * Decides what gets checked, and when.
 *
 * Separate from `Survey` because "when" is a survey-wide policy with three distinct
 * answers, and threading that decision through navigation, value writes and completion
 * from inside the model would spread one rule across three call sites.
 */
export class SurveyValidation {
  readonly #host: SurveyValidationHost;
  #serverValidator: ServerValidator | undefined;
  #isValidating = false;
  #checkError: string | undefined;

  constructor(host: SurveyValidationHost) {
    this.#host = host;
  }

  /** While false, validation neither runs nor blocks anything. */
  get isEnabled(): boolean {
    return this.#host.readProperty('validationEnabled') !== false;
  }

  setEnabled(isEnabled: boolean): void {
    this.#host.writeProperty('validationEnabled', isEnabled);
  }

  get checkErrorsMode(): CheckErrorsMode {
    const mode = this.#host.readProperty('checkErrorsMode');
    return mode === 'onValueChanged' || mode === 'onComplete' ? mode : 'onNextPage';
  }

  setCheckErrorsMode(mode: CheckErrorsMode): void {
    this.#host.writeProperty('checkErrorsMode', mode);
  }

  /** Whether a question draws its errors above its input or below it. */
  get errorLocation(): QuestionErrorLocation {
    return this.#host.readProperty('questionErrorLocation') === 'bottom' ? 'bottom' : 'top';
  }

  setErrorLocation(location: QuestionErrorLocation): void {
    this.#host.writeProperty('questionErrorLocation', location);
  }

  /** Installs the host's out-of-process check. Undefined removes it. */
  setServerValidator(validate: ServerValidator | undefined): void {
    this.#serverValidator = validate;
  }

  /** True while a check that left the process is outstanding. */
  get isValidating(): boolean {
    return this.#isValidating;
  }

  /**
   * Why the last out-of-process check could not be performed, if it could not.
   *
   * Covers both a server hook that failed and a validator that threw. Never an
   * objection to an answer — the respondent's may be perfectly good and the network
   * merely down. Kept apart from question errors so a renderer can say which of those
   * two things happened, rather than sending someone looking for a mistake they did
   * not make.
   */
  get checkError(): string | undefined {
    return this.#checkError;
  }

  /** Checks the visible questions on the page the respondent is standing on. */
  validateCurrentPage(): boolean {
    return this.#run(this.#host.currentPageQuestions());
  }

  /** Checks every question in the survey, whatever page it lives on. */
  validateAll(): boolean {
    return this.#run(this.#host.allQuestions());
  }

  /**
   * The gate a forward move has to pass.
   *
   * The synchronous checks run first and can refuse outright, so a survey with nothing
   * async never awaits and never reports `pending`. Only once they have all passed is
   * anything asked to leave the process — there is no point paying for a round trip to
   * confirm an answer that is already known to be wrong.
   *
   * A second request while one is outstanding is `pending` again rather than a second
   * round trip: a respondent pressing Next twice must not start two.
   */
  checkAdvance(onSettled: (isValid: boolean) => void): ValidationGate {
    if (this.#isValidating) {
      return 'pending';
    }
    const questions = this.#gatedQuestions();
    if (questions.length === 0) {
      return 'allowed';
    }
    if (!this.#run(questions)) {
      return 'blocked';
    }
    if (!hasAsyncWork(questions, this.#serverValidator)) {
      return 'allowed';
    }
    this.#startAsync(questions, onSettled);
    return 'pending';
  }

  /**
   * Re-checks one question because its answer changed.
   *
   * Only under `onValueChanged`, and only the question that changed. Re-checking the
   * whole page would surface errors on fields the respondent has not reached yet, which
   * is precisely the behaviour the other two modes exist to avoid.
   *
   * Resolved against the current page rather than by name across the whole survey, so
   * a trigger writing into a hidden question — or one on a page the respondent has not
   * reached — cannot post an error against something they are not looking at. They
   * will meet it on the way out of that page.
   *
   * Synchronous only. A lookup per keystroke is a request storm, and the answer would
   * be stale before it arrived; out-of-process checks belong at the gate.
   */
  revalidateChanged(name: string): void {
    if (!this.isEnabled || this.checkErrorsMode !== 'onValueChanged') {
      return;
    }
    const question = this.#host
      .currentPageQuestions()
      .find((candidate) => candidate.name === name);
    if (question !== undefined) {
      this.#run([question]);
    }
  }

  /**
   * The first question on the current page carrying an error, in document order.
   *
   * Document order, not the order the checks ran, because that is the order the
   * respondent reads the page in — and the renderer uses this to decide where to put
   * focus.
   */
  get firstErrorQuestion(): Question | undefined {
    return this.#host.currentPageQuestions().find((question) => question.hasErrors);
  }

  /** Forgets every recorded error. Nothing is re-checked. */
  clear(): void {
    this.#checkError = undefined;
    clearQuestionErrors(this.#host.allQuestions(), this.#host.announce);
    this.#host.flush();
  }

  /**
   * Which questions the gate covers right now.
   *
   * Empty means nothing is gated — validation is off, or the mode defers the check to
   * a page the respondent has not reached.
   */
  #gatedQuestions(): readonly Question[] {
    if (!this.isEnabled) {
      return [];
    }
    if (this.checkErrorsMode !== 'onComplete') {
      return this.#host.currentPageQuestions();
    }
    return this.#host.isLastPage() ? this.#host.allQuestions() : [];
  }

  /**
   * What the world looked like when the request went out.
   *
   * Both halves matter and neither implies the other. The answers, because a
   * respondent can keep typing while a request is in flight and an objection to a value
   * they have already replaced is worse than no objection. The page, because a check
   * that comes back clean *advances* them — and a respondent who pressed Next, changed
   * their mind and pressed Previous must not be dragged forward a moment later by a
   * reply to a question they withdrew.
   */
  #snapshot(questions: readonly Question[]): () => boolean {
    const page = this.#host.currentPageName();
    const asked = questions.map((question) => [question.name, question.value] as const);
    return () =>
      page !== this.#host.currentPageName() ||
      asked.some(
        ([name, value]) =>
          questions.find((question) => question.name === name)?.value !== value,
      );
  }

  #startAsync(questions: readonly Question[], onSettled: (isValid: boolean) => void): void {
    const isStale = this.#snapshot(questions);
    this.#setValidating(true);

    void collectAsyncErrors({
      questions,
      evaluate: this.#host.evaluate,
      data: this.#host.data(),
      serverValidator: this.#serverValidator,
    }).then((result) => {
      if (isStale()) {
        this.#setValidating(false);
        onSettled(false);
        return;
      }
      // Everything the renderer reads is settled *before* the event that makes it
      // read: `isValidating` going false is what un-disables the button and re-renders
      // the navigation, and that render must not catch `checkError` half-assigned.
      // It happened to work — React flushes after the current task — but relying on a
      // scheduler for state consistency is a bug waiting for a slow frame.
      this.#checkError = result.failure;
      const isValid = this.#run(questions, result.errors) && result.failure === undefined;
      this.#setValidating(false);
      onSettled(isValid);
    });
  }

  #setValidating(isValidating: boolean): void {
    this.#isValidating = isValidating;
    this.#host.announceValidating(isValidating);
  }

  #run(
    questions: readonly Question[],
    carried?: ReadonlyMap<string, readonly SurveyError[]>,
  ): boolean {
    const isValid = validateQuestions(questions, {
      evaluate: this.#host.evaluate,
      announce: this.#host.announce,
      hostErrors: this.#host.hostErrors,
      ...(carried === undefined ? {} : { carried }),
    });
    this.#host.flush();
    return isValid;
  }
}
