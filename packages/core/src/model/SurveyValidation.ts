import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import type { Question } from './Question.js';
import type { ExpressionEvaluator } from './validateAnswer.js';
import { clearQuestionErrors, validateQuestions } from './validateAnswer.js';

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
  readonly evaluate: ExpressionEvaluator;
  /** Records that one question's errors changed. Buffered, not delivered. */
  readonly announce: (question: Question) => void;
  /** Delivers whatever `announce` buffered — once per check, not once per question. */
  readonly flush: () => void;
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
   * Under `onComplete` the intermediate pages are deliberately not gated, so the check
   * happens once, on the last page, against the whole survey. Under the other two
   * modes each page is checked on the way out — which is also what makes `onValueChanged`
   * safe: a field the respondent never touched still gets caught here.
   */
  allowsAdvance(): boolean {
    if (!this.isEnabled) {
      return true;
    }
    if (this.checkErrorsMode !== 'onComplete') {
      return this.validateCurrentPage();
    }
    return this.#host.isLastPage() ? this.validateAll() : true;
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
    clearQuestionErrors(this.#host.allQuestions(), this.#host.announce);
    this.#host.flush();
  }

  #run(questions: readonly Question[]): boolean {
    const isValid = validateQuestions(questions, this.#host.evaluate, this.#host.announce);
    this.#host.flush();
    return isValid;
  }
}
