import type { ElementStateChangedEvent, ValueChangedEvent } from '../events/SurveyEvents.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { parseReferencePath } from '../expressions/parseReferencePath.js';
import { LogicEngine } from '../logic/LogicEngine.js';
import type { LogicDiagnostics } from '../logic/LogicEngine.js';
import type { CalculatedValue } from './CalculatedValue.js';
import { ChoiceSourceController } from './ChoiceSourceController.js';
import { createPathResolver } from './createPathResolver.js';
import { ElementStateController } from './ElementStateController.js';
import { HostValueStore } from './HostValueStore.js';
import { hostValueKey, hostValueReference, isHostValueName } from './hostValues.js';
import { SettleCoordinator } from './SettleCoordinator.js';
import type { SurveyAnswers } from './SurveyAnswers.js';
import type { SurveyChildren } from './SurveyChildren.js';
import type { Survey } from './Survey.js';
import type { SurveyElement } from './SurveyElement.js';
import type { SurveyOptions } from './SurveyOptions.js';
import { registerSurveyRules } from './registerSurveyRules.js';
import type { Question } from './Question.js';
import type { Panel } from './Panel.js';
import type { SelectQuestion } from './SelectQuestion.js';
import type { ExpressionOutcome } from './Validator.js';

/**
 * A set of names an expression may use that are not answers.
 *
 * One scope, because one is all anything has needed: `row` inside a matrix total. A
 * general scope chain would be a second name-resolution system to keep honest.
 */
export interface ExpressionScope {
  readonly name: string;
  readonly values: Readonly<Record<string, unknown>>;
}

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
  readonly #answers: SurveyAnswers;
  readonly #survey: Survey;
  readonly #writeValue: (name: string, value: unknown) => boolean;
  readonly #resolvePath: (path: readonly PathSegment[]) => unknown;
  readonly #hostValues: HostValueStore = new HostValueStore();
  #afterSettle: (() => void) | undefined;
  #inAfterSettle = false;

  constructor(
    survey: Survey,
    answers: SurveyAnswers,
    options: SurveyOptions,
    announcer: LogicAnnouncer,
    writeValue: (name: string, value: unknown) => boolean,
  ) {
    this.#survey = survey;
    this.#answers = answers;
    this.#writeValue = writeValue;
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
    this.#resolvePath = createPathResolver((name) => this.#lookup(name));
  }

  /** Advances whenever an element's computed state changes. The renderer's snapshot. */
  get version(): number {
    return this.#states.version;
  }

  /** The expression functions this survey may call — checklist L2. */
  get functionNames(): readonly string[] {
    return this.#engine.functionNames;
  }

  /** What the most recent logic run reported: cycles, and malformed expressions. */
  get diagnostics(): LogicDiagnostics {
    return this.#settle.diagnostics;
  }

  /** Messages from choice sources: a failed load, a failed page, a missing fetcher. */
  get choiceErrors(): readonly string[] {
    return this.#choiceSources.errors;
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
    if (options.now !== undefined) {
      this.#engine.setClock(options.now);
    }
    if (options.values !== undefined) {
      this.#hostValues.replaceAll(options.values);
    }
    this.#choiceSources.setFetcher(options.fetchJson);
    this.#choiceSources.setEndpoints(options.endpoints ?? {});
    this.#choiceSources.setPageLoader(options.loadChoicePage);
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
  refresh(children: SurveyChildren): void {
    this.#engine.clear();
    registerSurveyRules(children, this);
    this.#settle.run(() => {
      const result = this.#engine.evaluateAll(this.#resolvePath);
      // A restored response can name a question the definition hides, so the very first
      // evaluation has to enforce the policy too — not only later changes.
      this.#runAfterSettle();
      return result;
    });
  }

  /** Internal rule-registration access to the expression graph. */
  /** The host's clock. Everything time-dependent in the model reads it through here. */
  now(): Date {
    return this.#engine.now();
  }

  get logic(): LogicEngine {
    return this.#engine;
  }

  /** Internal rule-registration access to computed element state. */
  get states(): ElementStateController {
    return this.#states;
  }

  get choiceSources(): ChoiceSourceController {
    return this.#choiceSources;
  }

  getValue(name: string): unknown {
    return this.#survey.getValue(name);
  }

  setValue(name: string, value: unknown): boolean {
    return this.#writeValue(name, value);
  }

  setCalculated(calculated: CalculatedValue, value: unknown): boolean {
    const { changed, previousValue } = this.#answers.writeCalculated(calculated.name, value);
    if (changed && calculated.includeIntoResult) {
      this.#settle.queueValue({ name: calculated.name, value, previousValue });
    }
    return changed;
  }

  complete(): void {
    this.#survey.complete();
  }

  goTo(name: string): void {
    this.#survey.goTo(name);
  }

  findQuestion(name: string): Question | undefined {
    return this.#survey.getQuestionByName(name);
  }

  resolveValue(name: string): unknown {
    return this.#resolvePath([{ kind: 'name', name }]);
  }

  /**
   * Resolves a whole written reference — `$profile.plan.tier`, not just `$profile`.
   *
   * For templates, which hand over the text between the braces rather than a parsed
   * path. Parsed with the same `parseReferencePath` an expression goes through, so
   * `{$profile.plan.tier}` means one thing wherever it is written; a template that split
   * on dots itself would be a second, quietly divergent reader of the same syntax.
   *
   * Malformed references are not reported here. A template is prose with holes in it,
   * and the caller renders what it can — an unreadable hole resolves to nothing, which
   * is what an unknown name in a template has always done.
   */
  resolveReference(reference: string): unknown {
    return this.#resolvePath(
      parseReferencePath(reference, { start: 0, end: reference.length }, []),
    );
  }

  announcePanelCollapsed(panel: Panel): void {
    panel.setCollapseAnnouncer((isCollapsed) => {
      this.#states.notifyCollapsedChanged(panel, isCollapsed);
      this.#settle.release();
    });
  }

  announceChoices(question: SelectQuestion): void {
    this.#states.notifyChoicesChanged(question);
    if (!this.#settle.isSettling) {
      this.#settle.release();
    }
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
  evaluate(expression: string, scope?: ExpressionScope): ExpressionOutcome {
    const resolve = scope === undefined ? this.#resolvePath : this.#scopedResolver(scope);
    const evaluation = this.#engine.evaluate(expression, resolve);
    return { value: evaluation.value, failed: evaluation.errors.length > 0 };
  }

  /**
   * The first segment of every reference: a host value, or an answer.
   *
   * **The sigil is tested first**, so a host value can never be shadowed by a question
   * and a question can never be reached through the host scope. That ordering is what
   * makes the two namespaces genuinely separate rather than merely conventionally so —
   * and it is why `$` is reserved in `name`, since a question called `$tier` would
   * otherwise be silently unreachable from every expression.
   *
   * Descent is not handled here. `{$profile.plan.tier}` resolves because
   * `createPathResolver` walks the remaining segments into whatever this returns, which
   * is the same treatment an answer holding an object already gets.
   */
  #lookup(name: string): unknown {
    return isHostValueName(name)
      ? this.#hostValues.get(hostValueKey(name))
      : this.#answers.resolve(name);
  }

  /**
   * Records a host value and recomputes everything that reads it.
   *
   * **Through the same settle an answer goes through**, deliberately: this is a new kind
   * of graph root, and ADR-0004's guarantee — that no observer sees the model part-way
   * through a cascade — is a property of the settle rather than of answers. A write that
   * recomputed outside it would announce a visibility change while a later rule had yet
   * to run, which is the one state the transaction exists to make unobservable.
   *
   * The path is the reference an author writes, `$tier` rather than `tier`, because that
   * is the name every rule declared its dependency under. A write announcing the bare
   * key would recompute the rules that read the *answer* of that name and none of the
   * ones that read the host value.
   *
   * No `ValueChangedEvent` is queued. That event means "an answer changed", and a host
   * value is not in `data` for a listener to go and read — a partial save woken by one
   * would write a response nobody had altered. What the respondent can actually see
   * change, element state, is drained on release like any other settle's.
   */
  /**
   * Forgets what asynchronous functions returned, then runs every rule again.
   *
   * A full re-evaluation rather than a targeted one, on the same reasoning `#reevaluate`
   * already follows: no path was written, so the dependency graph has nothing to trace
   * from. The rules that call the discarded function ask again as they run, and the
   * answers land the way any asynchronous answer does.
   */
  invalidateAsyncResults(name?: string): void {
    this.#engine.invalidateAsyncResults(name);
    this.#reevaluate();
  }

  setHostValue(key: string, value: unknown): void {
    if (!this.#hostValues.set(key, value).changed) {
      return;
    }
    this.applyValueChange(hostValueReference(key));
  }

  /**
   * Resolves one scope name locally and everything else against the answers.
   *
   * `{row.price}` inside a matrix total is not an answer and never will be, so there is
   * nothing for the rewriting trick that serves cells to rewrite it into. A local
   * overlay is the honest alternative *here*, where the value is computed on read and
   * no rule depends on it.
   */
  #scopedResolver(scope: ExpressionScope): (path: readonly PathSegment[]) => unknown {
    const local = createPathResolver((name) => scope.values[name]);
    return (path) => {
      const [first, ...rest] = path;
      if (first?.kind === 'name' && first.name === scope.name) {
        return rest.length === 0 ? undefined : local(rest);
      }
      return this.#resolvePath(path);
    };
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
