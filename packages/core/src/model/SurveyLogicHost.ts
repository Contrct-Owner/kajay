import type { ElementStateChangedEvent, ValueChangedEvent } from '../events/SurveyEvents.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { LogicEngine } from '../logic/LogicEngine.js';
import type { LogicDiagnostics } from '../logic/LogicEngine.js';
import { ChoiceSourceController } from './ChoiceSourceController.js';
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
/**
 * How a settle reaches the outside world.
 *
 * The host drains its own state buffer rather than handing it back, because forgetting
 * to drain leaves a renderer stale in a way nothing else would catch — and the order
 * matters: whatever `beforeAnnounce` fixes up has to be fixed before a listener can see
 * it. Logic can hide the page the respondent is standing on, and nobody should be told
 * about a change while still pointed at a page that no longer exists.
 */
export interface LogicAnnouncer {
  readonly beforeAnnounce: () => void;
  readonly value: (event: ValueChangedEvent) => void;
  readonly elementState: (event: ElementStateChangedEvent) => void;
}

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
  #afterSettle: (() => void) | undefined;
  #inAfterSettle = false;

  constructor(answers: SurveyAnswers, options: SurveyOptions, announcer: LogicAnnouncer) {
    this.#answers = answers;
    this.#engine = new LogicEngine(options);
    this.configure(options);
    this.#engine.setAsyncSettledHandler(() => {
      this.#reevaluate();
    });
    this.#settle = new SettleCoordinator((values) => {
      announcer.beforeAnnounce();
      for (const event of values) {
        announcer.value(event);
      }
      for (const event of this.#states.drain()) {
        announcer.elementState(event);
      }
    });
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

  /**
   * Installs everything the host supplies, in one call.
   *
   * One call rather than four setters because they are one decision — what this survey
   * is allowed to reach — and four of them is four chances to install three.
   */
  configure(options: SurveyOptions): void {
    if (options.functions !== undefined) {
      this.#engine.setFunctions(options.functions);
    }
    this.#choiceSources.setFetcher(options.fetchJson);
    this.#choiceSources.setEndpoints(options.endpoints ?? {});
    this.#lazyChoices.setLoader(options.loadChoicePage);
  }

  /**
   * Installs work that runs at the end of every settle, inside it.
   *
   * Inside on purpose: whatever it writes belongs to the transaction that caused it, so
   * an observer never sees the moment where a question has gone and its answer has not
   * (ADR-0004). Running it after `run` returned would announce that state to everyone.
   */
  setAfterSettle(afterSettle: () => void): void {
    this.#afterSettle = afterSettle;
  }

  /**
   * Runs the after-settle work once, however deeply the settle nests.
   *
   * The work writes values, and writing a value settles again — so without this it
   * would call itself for every write it made. The guard belongs here rather than in
   * the work, because "this does not re-enter itself" is a property of the settle
   * mechanism and every future user of the hook would otherwise reinvent it.
   */
  #runAfterSettle(): void {
    const afterSettle = this.#afterSettle;
    if (afterSettle === undefined || this.#inAfterSettle) {
      return;
    }
    this.#inAfterSettle = true;
    try {
      afterSettle();
    } finally {
      this.#inAfterSettle = false;
    }
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
      afterSettle: () => {
        this.#runAfterSettle();
      },
      ...hooks,
    });
  }

  /**
   * Runs every rule again, for a change that came from outside the graph.
   *
   * An asynchronous function's answer is not an answer *change* — no path was written,
   * so there is nothing for the dependency graph to trace from. Re-evaluating
   * everything is the honest response: it is rare, it is correct, and the alternative
   * is a second dependency mechanism for a case that happens seldom.
   */
  #reevaluate(): void {
    this.#settle.run(() => {
      const result = this.#engine.evaluateAll(this.#resolvePath);
      this.#runAfterSettle();
      return result;
    });
  }

  /** Recomputes everything one answer reaches, then releases what that produced. */
  applyValueChange(name: string): void {
    this.#settle.run(() => {
      const result = this.#engine.applyValueChange([{ kind: 'name', name }], this.#resolvePath);
      this.#runAfterSettle();
      return result;
    });
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

  /** Announces a read-only flip immediately: nothing else is settling to carry it. */
  announceReadOnly(element: SurveyElement): void {
    this.#states.notifyReadOnlyChanged(element, true);
    this.release();
  }

  notifyErrorsChanged(element: SurveyElement): void {
    this.#states.notifyErrorsChanged(element);
  }

  /** Delivers whatever is buffered. For work that lands outside a settle. */
  release(): void {
    this.#settle.release();
  }
}
