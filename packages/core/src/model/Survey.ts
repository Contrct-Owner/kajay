import { EventEmitter } from '../events/EventEmitter.js';
import type {
  CompleteEvent,
  CurrentPageChangedEvent,
  ElementStateChangedEvent,
  ValueChangedEvent,
} from '../events/SurveyEvents.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { LogicEngine } from '../logic/LogicEngine.js';
import type { LogicDiagnostics, LogicEngineOptions } from '../logic/LogicEngine.js';
import type { ChoiceFetcher } from './ChoiceSourceController.js';

/**
 * Everything a survey may be given at construction.
 *
 * `fetchJson` is supplied by the host rather than defaulted here because core is
 * DOM-free and dependency-free — it cannot reach for `fetch`, which keeps the engine
 * backend-agnostic by construction.
 */
export interface SurveyOptions extends LogicEngineOptions {
  readonly fetchJson?: ChoiceFetcher;
}
import type { CalculatedValue } from './CalculatedValue.js';
import { CalculatedValueStore } from './CalculatedValueStore.js';
import { ChoiceSourceController } from './ChoiceSourceController.js';
import { createPathResolver } from './createPathResolver.js';
import { ElementStateController } from './ElementStateController.js';
import { NavigationController } from './NavigationController.js';
import { SettleCoordinator } from './SettleCoordinator.js';
import { Page } from './Page.js';
import type { Question } from './Question.js';
import { SurveyChildren } from './SurveyChildren.js';
import { registerSurveyRules } from './registerSurveyRules.js';
import { SurveyElement } from './SurveyElement.js';
import type { Trigger } from './Trigger.js';
import type { ValueHost } from './ValueHost.js';

/** Root of the model, and the value host every question writes through. */
export class Survey extends SurveyElement implements ValueHost {
  readonly #children: SurveyChildren = new SurveyChildren();
  readonly #data: Map<string, unknown> = new Map();
  readonly #calculated: CalculatedValueStore = new CalculatedValueStore();
  readonly #logic: LogicEngine;
  readonly #states: ElementStateController = new ElementStateController();
  readonly #settle: SettleCoordinator = new SettleCoordinator((values) => {
    for (const event of values) {
      this.onValueChanged.emit(event);
    }
    for (const event of this.#states.drain()) {
      this.onElementStateChanged.emit(event);
    }
  });
  readonly #choiceSources: ChoiceSourceController = new ChoiceSourceController();
  readonly #navigation: NavigationController = new NavigationController(
    () => this.#children.pages,
    (event) => {
      this.onCurrentPageChanged.emit(event);
    },
  );
  readonly #resolvePath: (path: readonly PathSegment[]) => unknown = createPathResolver((name) =>
    this.#data.has(name) ? this.#data.get(name) : this.#calculated.get(name),
  );

  #isCompleted = false;


  readonly onValueChanged: EventEmitter<ValueChangedEvent> = new EventEmitter();
  readonly onComplete: EventEmitter<CompleteEvent> = new EventEmitter();
  readonly onCurrentPageChanged: EventEmitter<CurrentPageChangedEvent> = new EventEmitter();
  readonly onElementStateChanged: EventEmitter<ElementStateChangedEvent> = new EventEmitter();

  constructor(options: SurveyOptions = {}) {
    super();
    this.#logic = new LogicEngine(options);
    this.#choiceSources.setFetcher(options.fetchJson);
  }

  /**
   * Supplies the fetcher for `choicesByUrl`.
   *
   * Set after construction because the registry builds the survey through a no-argument
   * factory. `parseSurvey` applies it before logic first runs, so a host never has to
   * remember to refresh.
   */
  setChoiceFetcher(fetchJson: ChoiceFetcher | undefined): void {
    this.#choiceSources.setFetcher(fetchJson);
  }

  /** Messages from choice sources: a failed load, or a missing fetcher. */
  get choiceErrors(): readonly string[] {
    return this.#choiceSources.errors;
  }

  override get type(): string {
    return 'survey';
  }

  get title(): string {
    return this.getStringProperty('title');
  }

  set title(value: string) {
    this.setPropertyValue('title', value);
  }

  get description(): string {
    return this.getStringProperty('description');
  }

  set description(value: string) {
    this.setPropertyValue('description', value);
  }

  get pages(): readonly Page[] {
    return this.#children.pages;
  }

  /** Pages a respondent can currently see. What the renderer draws. */
  get visiblePages(): readonly Page[] {
    return this.#children.pages.filter((page) => page.isVisible);
  }

  get questions(): readonly Question[] {
    return this.#children.pages.flatMap((page) => [...page.elements]);
  }

  getQuestionByName(name: string): Question | undefined {
    return this.questions.find((question) => question.name === name);
  }

  get calculatedValues(): readonly CalculatedValue[] {
    return this.#children.calculatedValues;
  }

  get triggers(): readonly Trigger[] {
    return this.#children.triggers;
  }

  /** The current result of a calculated value, whether or not it reaches `data`. */
  getCalculatedValue(name: string): unknown {
    return this.#calculated.get(name);
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return this.#children.get(property);
  }

  override addChild(property: string, child: SurveyElement): void {
    this.#children.add(property, child);
    if (child instanceof Page) {
      child.attachValueHost(this);
    }
  }

  /** Advances whenever logic changes an element's visible, enabled or required state. */
  get logicVersion(): number {
    return this.#states.version;
  }

  /**
   * What the most recent logic run reported: cycles, and malformed expressions.
   *
   * Checklist B8 asks for cycles to be *reported*, which is only true if a host can
   * actually read them. The graph knows; without this it had nowhere to say so.
   */
  get logicDiagnostics(): LogicDiagnostics {
    return this.#settle.diagnostics;
  }

  /**
   * Rebuilds conditional logic from the current tree and evaluates it once.
   *
   * `parseSurvey` calls this after building the model. A host that adds or removes
   * elements afterwards calls it again — registration is deliberately a whole-tree
   * rebuild for now rather than incremental, because correctness matters more here
   * than the cost of re-registering a handful of expressions.
   */
  refreshLogic(): void {
    this.#logic.clear();
    registerSurveyRules(this.#children, {
      logic: this.#logic,
      states: this.#states,
      getValue: (name) => this.getValue(name),
      setValue: (name, value) => this.#writeValue(name, value),
      setCalculated: (calculated, value) => {
        return this.#setCalculated(calculated, value);
      },
      complete: () => {
        this.complete();
      },
      goTo: (name) => {
        this.goTo(name);
      },
      findQuestion: (name) => this.getQuestionByName(name),
      announceChoices: (question) => {
        this.#states.notifyChoicesChanged(question);
        // A REST response lands after the settle that asked for it, so nothing else
        // would flush the event it produced.
        if (!this.#settle.isSettling) {
          this.#settle.release();
        }
      },
      choiceSources: this.#choiceSources,
      resolveValue: (name) => this.#resolvePath([{ kind: 'name', name }]),
    });
    this.#settle.run(() => this.#logic.evaluateAll(this.#resolvePath));
  }

  #setCalculated(calculated: CalculatedValue, value: unknown): boolean {
    const { changed, previousValue } = this.#calculated.set(calculated.name, value);
    // Announced only when it reaches `data`: onValueChanged means "an answer changed",
    // and reporting something the host cannot find in `data` would mislead.
    if (changed && calculated.includeIntoResult) {
      this.#settle.queueValue({ name: calculated.name, value, previousValue });
    }
    return changed;
  }

  get currentPageNo(): number {
    return this.#navigation.currentPageNo;
  }

  get currentPage(): Page | undefined {
    return this.#navigation.currentPage;
  }

  setCurrentPageNo(pageNo: number): void {
    this.#navigation.setCurrentPageNo(pageNo);
  }

  /** Navigates to a page by name, or to the page owning the named question. */
  goTo(name: string): void {
    this.#navigation.goTo(name);
  }

  /**
   * The answers, plus any calculated value marked `includeIntoResult`.
   *
   * A shallow copy: mutating the result must not reach into the survey.
   */
  get data(): Readonly<Record<string, unknown>> {
    return {
      ...Object.fromEntries(this.#data),
      ...this.#calculated.toResult(this.#children.calculatedValues),
    };
  }

  setData(next: Readonly<Record<string, unknown>>): void {
    for (const [name, value] of Object.entries(next)) {
      this.setValue(name, value);
    }
  }

  getValue(name: string): unknown {
    return this.#data.get(name);
  }

  /**
   * Records an answer and settles the logic it affects.
   *
   * Logic runs *before* any event fires, and events are buffered until it has
   * finished, so a listener never observes the model part-way through a cascade.
   */
  setValue(name: string, value: unknown): void {
    if (!this.#writeValue(name, value)) {
      return;
    }
    this.#settle.run(() =>
      this.#logic.applyValueChange([{ kind: 'name', name }], this.#resolvePath),
    );
  }

  /** Writes model state without starting a nested settle. Rule execution reports the path. */
  #writeValue(name: string, value: unknown): boolean {
    const previousValue = this.#data.get(name);
    if (Object.is(previousValue, value)) {
      return false;
    }
    if (value === undefined) {
      this.#data.delete(name);
    } else {
      this.#data.set(name, value);
    }
    this.#settle.queueValue({ name, value, previousValue });
    return true;
  }

  get isCompleted(): boolean {
    return this.#isCompleted;
  }

  complete(): void {
    if (this.#isCompleted) {
      return;
    }
    this.#isCompleted = true;
    this.onComplete.emit({ data: this.data });
  }
}
