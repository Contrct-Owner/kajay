import { clearAnswersOnComplete } from './clearInvisibleAnswers.js';
import { interpolateHtml } from './interpolate.js';
import { quizPlaceholder } from './quizScore.js';
import type { Survey } from './Survey.js';
import type { SurveyAnswers } from './SurveyAnswers.js';
import type { SurveyLogicHost } from './SurveyLogicHost.js';
import { resolveSurveyState } from './SurveyState.js';
import type { SurveyState } from './SurveyState.js';

/**
 * What the respondent sees when they are not looking at a page.
 *
 * Its own object for the reason `SurveyValidation` is: "which of loading, empty,
 * running and completed is true, and what markup goes with it" is one decision with
 * several inputs, and spreading it across the survey root would put a policy in the
 * middle of a container.
 */
export class SurveyStatus {
  readonly #survey: Survey;
  readonly #logic: () => SurveyLogicHost;
  readonly #answers: SurveyAnswers;
  #isLoading = false;
  #isCompleted = false;
  #isPreviewing = false;

  constructor(survey: Survey, logic: () => SurveyLogicHost, answers: SurveyAnswers) {
    this.#survey = survey;
    this.#logic = logic;
    this.#answers = answers;
  }

  /**
   * Whether the host is still fetching something the survey needs.
   *
   * The survey cannot know this — a definition arriving over the wire, answers being
   * restored, results being saved are all the host's business — so it is told.
   */
  get isLoading(): boolean {
    return this.#isLoading;
  }

  setLoading(isLoading: boolean): void {
    if (this.#isLoading === isLoading) {
      return;
    }
    this.#isLoading = isLoading;
    this.#announce();
  }

  get isCompleted(): boolean {
    return this.#isCompleted;
  }

  /**
   * True while the respondent is looking at their answers instead of giving them.
   *
   * The survey reads this to report itself read-only, which is what makes a preview
   * unanswerable without any renderer being told to make it so.
   */
  get isPreviewing(): boolean {
    return this.#isPreviewing;
  }

  /** Shows the respondent what they are about to submit. */
  enterPreview(): void {
    if (this.#isPreviewing || this.#isCompleted) {
      return;
    }
    this.#isPreviewing = true;
    this.#announce();
  }

  /** Back to the pages, with everything answerable again. */
  cancelPreview(): void {
    if (!this.#isPreviewing) {
      return;
    }
    this.#isPreviewing = false;
    this.#announce();
  }

  /**
   * Ends the survey. Repeating it is not an event.
   *
   * The clearing policy runs *before* anyone is told, so the answers a host receives
   * are the ones the respondent could actually reach — and `onComplete` fires before
   * the state change, because a host submitting results wants the one event, and a
   * renderer wants every transition.
   */
  complete(): void {
    if (this.#isCompleted) {
      return;
    }
    clearAnswersOnComplete(this.#survey, (name) => {
      this.#survey.setValue(name, undefined);
    });
    this.#isCompleted = true;
    this.#isPreviewing = false;
    this.#survey.onComplete.emit({ data: this.#survey.data });
    this.#announce();
  }

  /** What to draw: one value, because these are mutually exclusive. */
  get state(): SurveyState {
    return resolveSurveyState({
      isLoading: this.#isLoading,
      isCompleted: this.#isCompleted,
      isPreviewing: this.#isPreviewing,
      hasVisiblePages: this.#survey.visiblePages.length > 0,
    });
  }

  /**
   * The markup for the finished survey, chosen and filled in.
   *
   * What should be shown *now* rather than what was authored: the first
   * `completedHtmlOnCondition` whose expression holds wins, `completedHtml` is the
   * fallback, and placeholders resolve against the answers. Serialization reads the
   * property bag, so none of that reaches the definition — the same division
   * `isRequired` makes between the authored value and the effective one.
   *
   * Empty means the author wrote nothing, and the renderer says something of its own.
   */
  get completedHtml(): string {
    const conditional = this.#survey.completedHtmlOnCondition
      .find((candidate) => candidate.expression.length > 0 && this.#holds(candidate.expression));
    return this.#fill(conditional?.html ?? this.#readProperty('completedHtml'));
  }

  /** Markup for a survey the host is still loading. */
  get loadingHtml(): string {
    return this.#fill(this.#readProperty('loadingHtml'));
  }

  /** Markup for a survey with nothing on it — every page hidden, or none authored. */
  get emptyHtml(): string {
    return this.#fill(this.#readProperty('emptyHtml'));
  }

  /**
   * Whether an authored condition holds right now.
   *
   * A broken expression selects nothing rather than everything, on the same reasoning
   * as the value rules: showing a respondent the wrong ending is worse than showing
   * them the default one.
   */
  #holds(expression: string): boolean {
    const outcome = this.#logic().evaluate(expression);
    return !outcome.failed && outcome.value === true;
  }

  /** Substitutes `{name}` placeholders, escaping whatever they resolve to. */
  #fill(template: string): string {
    return interpolateHtml(template, (name) => this.#resolve(name));
  }

  /**
   * An answer, or — failing that — the quiz result.
   *
   * **Answers first**, so a survey that happens to contain a question named
   * `correctAnswers` keeps reading its own data. The alternative silently replaces a
   * respondent's answer with a number on a completed page the author has already
   * proof-read, and a placeholder resolving to something other than the answer of that
   * name is the surprise that is hardest to diagnose.
   */
  #resolve(name: string): unknown {
    const answer = this.#answers.resolve(name);
    return answer === undefined ? quizPlaceholder(this.#survey, name) : answer;
  }

  #readProperty(name: string): string {
    const value = this.#survey.getResolvedProperty(name);
    return typeof value === 'string' ? value : '';
  }

  #announce(): void {
    this.#survey.onStateChanged.emit({ state: this.state });
  }
}
