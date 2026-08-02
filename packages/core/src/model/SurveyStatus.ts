import type { HtmlCondition } from './HtmlCondition.js';
import { interpolateHtml } from './interpolate.js';
import { resolveSurveyState } from './SurveyState.js';
import type { SurveyState } from './SurveyState.js';
import type { ExpressionOutcome } from './Validator.js';

/** What the status needs from the survey, without reaching into it. */
export interface SurveyStatusHost {
  readonly readProperty: (name: string) => string;
  readonly hasVisiblePages: () => boolean;
  /** Applies the `onComplete` clearing policy. Runs before anyone is told. */
  readonly clearAnswers: () => void;
  /** Hands the finished answers to the host. */
  readonly announceComplete: () => void;
  /** The authored `completedHtmlOnCondition` entries, in order. */
  readonly conditions: () => readonly HtmlCondition[];
  readonly evaluate: (expression: string) => ExpressionOutcome;
  /** An answer or calculated value by name, for a placeholder. */
  readonly resolve: (name: string) => unknown;
  readonly announce: (state: SurveyState) => void;
}

/**
 * What the respondent sees when they are not looking at a page.
 *
 * Its own object for the reason `SurveyValidation` is: "which of loading, empty,
 * running and completed is true, and what markup goes with it" is one decision with
 * several inputs, and spreading it across the survey root would put a policy in the
 * middle of a container.
 */
export class SurveyStatus {
  readonly #host: SurveyStatusHost;
  #isLoading = false;
  #isCompleted = false;

  constructor(host: SurveyStatusHost) {
    this.#host = host;
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
    this.#host.announce(this.state);
  }

  get isCompleted(): boolean {
    return this.#isCompleted;
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
    this.#host.clearAnswers();
    this.#isCompleted = true;
    this.#host.announceComplete();
    this.#host.announce(this.state);
  }

  /** What to draw: one value, because these are mutually exclusive. */
  get state(): SurveyState {
    return resolveSurveyState({
      isLoading: this.#isLoading,
      isCompleted: this.#isCompleted,
      hasVisiblePages: this.#host.hasVisiblePages(),
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
    const conditional = this.#host
      .conditions()
      .find((candidate) => candidate.expression.length > 0 && this.#holds(candidate.expression));
    return this.#fill(conditional?.html ?? this.#host.readProperty('completedHtml'));
  }

  /** Markup for a survey the host is still loading. */
  get loadingHtml(): string {
    return this.#fill(this.#host.readProperty('loadingHtml'));
  }

  /** Markup for a survey with nothing on it — every page hidden, or none authored. */
  get emptyHtml(): string {
    return this.#fill(this.#host.readProperty('emptyHtml'));
  }

  /**
   * Whether an authored condition holds right now.
   *
   * A broken expression selects nothing rather than everything, on the same reasoning
   * as the value rules: showing a respondent the wrong ending is worse than showing
   * them the default one.
   */
  #holds(expression: string): boolean {
    const outcome = this.#host.evaluate(expression);
    return !outcome.failed && outcome.value === true;
  }

  /** Substitutes `{name}` placeholders, escaping whatever they resolve to. */
  #fill(template: string): string {
    return interpolateHtml(template, (name) => this.#host.resolve(name));
  }
}
