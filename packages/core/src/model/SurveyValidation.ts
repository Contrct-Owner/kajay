import { collectVisibleQuestions } from './pageElements.js';
import type { Question } from './Question.js';
import type { ServerValidator } from './ServerValidator.js';
import type { Survey } from './Survey.js';
import type { SurveyError } from './SurveyError.js';
import type { SurveyLogicHost } from './SurveyLogicHost.js';
import { clearQuestionErrors, validateQuestions } from './validateAnswer.js';
import type { AsyncValidationResult } from './validateAnswerAsync.js';
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

/**
 * Decides what gets checked, and when.
 *
 * Separate from `Survey` because "when" is a survey-wide policy with three distinct
 * answers, and threading that decision through navigation, value writes and completion
 * from inside the model would spread one rule across three call sites.
 */
export class SurveyValidation {
  readonly #survey: Survey;
  readonly #logic: () => SurveyLogicHost;
  #serverValidator: ServerValidator | undefined;
  #isValidating = false;
  #checkError: string | undefined;

  constructor(survey: Survey, logic: () => SurveyLogicHost) {
    this.#survey = survey;
    this.#logic = logic;
  }

  /** While false, validation neither runs nor blocks anything. */
  get isEnabled(): boolean {
    return this.#survey.getResolvedProperty('validationEnabled') !== false;
  }

  setEnabled(isEnabled: boolean): void {
    this.#survey.setPropertyValue('validationEnabled', isEnabled);
  }

  get checkErrorsMode(): CheckErrorsMode {
    const mode = this.#survey.getResolvedProperty('checkErrorsMode');
    return mode === 'onValueChanged' || mode === 'onComplete' ? mode : 'onNextPage';
  }

  setCheckErrorsMode(mode: CheckErrorsMode): void {
    this.#survey.setPropertyValue('checkErrorsMode', mode);
  }

  /** Whether a question draws its errors above its input or below it. */
  get errorLocation(): QuestionErrorLocation {
    return this.#survey.getResolvedProperty('questionErrorLocation') === 'bottom' ? 'bottom' : 'top';
  }

  setErrorLocation(location: QuestionErrorLocation): void {
    this.#survey.setPropertyValue('questionErrorLocation', location);
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
    return this.#run(this.#currentPageQuestions());
  }

  /** Checks every question in the survey, whatever page it lives on. */
  validateAll(): boolean {
    return this.#run(this.#allQuestions());
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
    const question = this.#currentPageQuestions()
      .find((candidate) => candidate.valueKey === name);
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
    return this.#currentPageQuestions().find((question) => question.hasErrors);
  }

  /** Forgets every recorded error. Nothing is re-checked. */
  clear(): void {
    this.#checkError = undefined;
    clearQuestionErrors(this.#allQuestions(), (question) => {
      this.#logic().notifyErrorsChanged(question);
    });
    this.#logic().release();
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
      return this.#currentPageQuestions();
    }
    return this.#survey.isLastPage ? this.#allQuestions() : [];
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
    const page = this.#survey.currentPage?.name ?? '';
    const asked = questions.map((question) => [question.valueKey, question.value] as const);
    return () =>
      page !== (this.#survey.currentPage?.name ?? '') ||
      asked.some(
        ([name, value]) =>
          questions.find((question) => question.valueKey === name)?.value !== value,
      );
  }

  #startAsync(questions: readonly Question[], onSettled: (isValid: boolean) => void): void {
    const isStale = this.#snapshot(questions);
    this.#setValidating(true);

    void collectAsyncErrors({
      questions,
      evaluate: (expression) => this.#logic().evaluate(expression),
      data: this.#survey.data,
      serverValidator: this.#serverValidator,
    }).then(
      (result) => {
        this.#settleAsync(questions, isStale, onSettled, result);
      },
      // `collectAsyncErrors` turns every failure it can foresee into data, but it is not
      // the last word on what can go wrong out here: a server hook that resolves with
      // something which is not a list of errors fails *inside* it, past its own guards.
      // A rejection is therefore treated as exactly what it is — a check that could not
      // be performed, blaming no answer.
      (cause: unknown) => {
        this.#settleAsync(questions, isStale, onSettled, {
          errors: new Map(),
          failure: describeFailure(cause),
        });
      },
    );
  }

  /**
   * Applies what the checks reported, and stops validating **whatever happens**.
   *
   * The `finally` is load-bearing rather than tidy. Between entering this method and
   * leaving it the model runs every check again and flushes to whatever the host has
   * subscribed — a renderer, in practice — so a listener that throws would otherwise
   * leave `isValidating` true for good. A respondent sees that as a Next button reading
   * "Checking…" that never comes back: a hung survey with no error and no way forward,
   * which is precisely the failure the async validators had before `runOne` caught it.
   *
   * A throw is reported the same way that one is — as a check failure rather than an
   * objection to an answer — because it is the host's bug and nothing the respondent
   * typed is at fault. Swallowing it silently would leave them pressing a button that
   * refuses to move with nothing on screen to say why.
   */
  #settleAsync(
    questions: readonly Question[],
    isStale: () => boolean,
    onSettled: (isValid: boolean) => void,
    result: AsyncValidationResult,
  ): void {
    let isValid = false;
    try {
      if (isStale()) {
        return;
      }
      // Everything the renderer reads is settled *before* the event that makes it
      // read: `isValidating` going false is what un-disables the button and re-renders
      // the navigation, and that render must not catch `checkError` half-assigned.
      // It happened to work — React flushes after the current task — but relying on a
      // scheduler for state consistency is a bug waiting for a slow frame.
      this.#checkError = result.failure;
      isValid = this.#run(questions, result.errors) && result.failure === undefined;
    } catch (cause) {
      this.#checkError = describeFailure(cause);
      isValid = false;
    } finally {
      this.#setValidating(false);
    }
    onSettled(isValid);
  }

  #setValidating(isValidating: boolean): void {
    this.#isValidating = isValidating;
    this.#survey.onValidatingChanged.emit({ isValidating });
  }

  #run(
    questions: readonly Question[],
    carried?: ReadonlyMap<string, readonly SurveyError[]>,
  ): boolean {
    const isValid = validateQuestions(questions, {
      evaluate: (expression) => this.#logic().evaluate(expression),
      announce: (question) => {
        this.#logic().notifyErrorsChanged(question);
      },
      hostErrors: (question) => this.#collectHostErrors(question),
      ...(carried === undefined ? {} : { carried }),
    });
    this.#logic().release();
    return isValid;
  }

  #currentPageQuestions(): readonly Question[] {
    return collectVisibleQuestions(this.#survey.currentPage?.elements ?? []);
  }

  #allQuestions(): readonly Question[] {
    return this.#survey.visiblePages.flatMap((page) => collectVisibleQuestions(page.elements));
  }

  #collectHostErrors(question: Question): readonly SurveyError[] {
    if (this.#survey.onValidateQuestion.listenerCount === 0) {
      return [];
    }
    const errors: SurveyError[] = [];
    this.#survey.onValidateQuestion.emit({
      question,
      value: question.value,
      addError: (text) => {
        errors.push({ kind: 'host', text });
      },
    });
    return errors;
  }
}

/** The same wording a validator that threw gets, for the same reason. */
function describeFailure(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
