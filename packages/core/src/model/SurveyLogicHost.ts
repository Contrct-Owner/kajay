import type { ElementStateChangedEvent, ValueChangedEvent } from '../events/SurveyEvents.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { LogicEngine } from '../logic/LogicEngine.js';
import type { LogicDiagnostics } from '../logic/LogicEngine.js';
import type { ChoicePageLoader } from './ChoicePageLoader.js';
import { ChoiceSourceController } from './ChoiceSourceController.js';
import type { ChoiceFetcher } from './ChoiceSourceController.js';
import { LazyChoiceController } from './LazyChoiceController.js';
import { createPathResolver } from './createPathResolver.js';
import { ElementStateController } from './ElementStateController.js';
import { SettleCoordinator } from './SettleCoordinator.js';
import type { SurveyAnswers } from './SurveyAnswers.js';
import type { SurveyChildren } from './SurveyChildren.js';
import type { SurveyElement } from './SurveyElement.js';
import type { SurveyOptions } from './SurveyOptions.js';
import { refreshSurveyLogic } from './surveyLogicWiring.js';
import type { SurveyLogicDependencies } from './surveyLogicWiring.js';
import type { ExpressionOutcome } from './Validator.js';

/**
 * The half of rule registration the survey itself has to supply.
 *
 * A `Pick` of the full dependency set rather than a hand-written twin, so adding a hook
 * cannot leave the two lists disagreeing about what a rule may reach for.
 */
export type SurveyRuleHooks = Pick<
  SurveyLogicDependencies,
  'getValue' | 'writeValue' | 'complete' | 'goTo' | 'findQuestion'
>;

/**
 * The survey's logic subsystem: the engine, the change buffer, the settle coordinator
 * and the choice sources, held together with the resolver they all read through.
 *
 * These four were separate fields on `Survey` and were only ever used together — every
 * one of them exists to serve one question, "what does this answer change" — so the
 * survey was carrying four collaborators and the wiring between them on top of being
 * the model root. Pulling them out leaves `Survey` describing *what* a survey is and
 * this describing *how* it recomputes.
 */
export class SurveyLogicHost {
  readonly #engine: LogicEngine;
  readonly #states: ElementStateController = new ElementStateController();
  readonly #settle: SettleCoordinator;
  readonly #choiceSources: ChoiceSourceController = new ChoiceSourceController();
  readonly #lazyChoices: LazyChoiceController = new LazyChoiceController();
  readonly #answers: SurveyAnswers;
  readonly #resolvePath: (path: readonly PathSegment[]) => unknown;

  constructor(
    answers: SurveyAnswers,
    options: SurveyOptions,
    flush: (values: readonly ValueChangedEvent[]) => void,
  ) {
    this.#answers = answers;
    this.#engine = new LogicEngine(options);
    this.#choiceSources.setFetcher(options.fetchJson);
    this.#lazyChoices.setLoader(options.loadChoicePage);
    this.#settle = new SettleCoordinator(flush);
    this.#resolvePath = createPathResolver((name) => answers.resolve(name));
  }

  /** Advances whenever an element's computed state changes. The renderer's snapshot. */
  get version(): number {
    return this.#states.version;
  }

  /** What the most recent logic run reported: cycles, and malformed expressions. */
  get diagnostics(): LogicDiagnostics {
    return this.#settle.diagnostics;
  }

  /** Messages from choice sources: a failed load, a failed page, a missing fetcher. */
  get choiceErrors(): readonly string[] {
    return [...this.#choiceSources.errors, ...this.#lazyChoices.errors];
  }

  setChoiceFetcher(fetchJson: ChoiceFetcher | undefined): void {
    this.#choiceSources.setFetcher(fetchJson);
  }

  setChoicePageLoader(load: ChoicePageLoader | undefined): void {
    this.#lazyChoices.setLoader(load);
  }

  /** Rebuilds every rule from the current tree and evaluates them once. */
  refresh(children: SurveyChildren, hooks: SurveyRuleHooks): void {
    refreshSurveyLogic(children, {
      logic: this.#engine,
      states: this.#states,
      settle: this.#settle,
      choiceSources: this.#choiceSources,
      lazyChoices: this.#lazyChoices,
      answers: this.#answers,
      resolvePath: this.#resolvePath,
      ...hooks,
    });
  }

  /** Recomputes everything one answer reaches, then releases what that produced. */
  applyValueChange(name: string): void {
    this.#settle.run(() =>
      this.#engine.applyValueChange([{ kind: 'name', name }], this.#resolvePath),
    );
  }

  /**
   * Evaluates one expression against the current answers, outside the rule graph.
   *
   * Reports *whether* it could be evaluated rather than folding a failure into the
   * value: a caller deciding what to do about a broken authored rule needs to tell
   * "the rule says no" from "the rule is unusable", and `undefined` cannot.
   */
  evaluate(expression: string): ExpressionOutcome {
    const evaluation = this.#engine.evaluate(expression, this.#resolvePath);
    return { value: evaluation.value, failed: evaluation.errors.length > 0 };
  }

  /** Buffers an answer change until the model has finished settling. */
  queueValue(event: ValueChangedEvent): void {
    this.#settle.queueValue(event);
  }

  notifyErrorsChanged(element: SurveyElement): void {
    this.#states.notifyErrorsChanged(element);
  }

  /** Hands over the buffered state changes and empties the buffer. */
  drainStates(): readonly ElementStateChangedEvent[] {
    return this.#states.drain();
  }

  /** Delivers whatever is buffered. For work that lands outside a settle. */
  release(): void {
    this.#settle.release();
  }
}
