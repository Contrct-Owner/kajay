import { EventEmitter } from '../events/EventEmitter.js';
import type {
  CompleteEvent,
  CurrentPageChangedEvent,
  ElementStateChangedEvent,
  ValueChangedEvent,
} from '../events/SurveyEvents.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { LogicDiagnosticsCollector } from '../logic/LogicDiagnosticsCollector.js';
import { LogicEngine } from '../logic/LogicEngine.js';
import type {
  LogicDiagnostics,
  LogicEngineOptions,
  LogicRunResult,
} from '../logic/LogicEngine.js';
import type { CalculatedValue } from './CalculatedValue.js';
import { CalculatedValueStore } from './CalculatedValueStore.js';
import { createPathResolver } from './createPathResolver.js';
import { ElementStateController } from './ElementStateController.js';
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
  readonly #diagnostics: LogicDiagnosticsCollector = new LogicDiagnosticsCollector();
  readonly #resolvePath: (path: readonly PathSegment[]) => unknown = createPathResolver((name) =>
    this.#data.has(name) ? this.#data.get(name) : this.#calculated.get(name),
  );

  #currentPageNo = 0;
  #isCompleted = false;
  #isSettling = false;
  #pendingValueChanges: ValueChangedEvent[] = [];

  readonly onValueChanged: EventEmitter<ValueChangedEvent> = new EventEmitter();
  readonly onComplete: EventEmitter<CompleteEvent> = new EventEmitter();
  readonly onCurrentPageChanged: EventEmitter<CurrentPageChangedEvent> = new EventEmitter();
  readonly onElementStateChanged: EventEmitter<ElementStateChangedEvent> = new EventEmitter();

  constructor(options: LogicEngineOptions = {}) {
    super();
    this.#logic = new LogicEngine(options);
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
    return this.#diagnostics.current;
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
      setValue: (name, value) => {
        this.setValue(name, value);
      },
      setCalculated: (calculated, value) => {
        this.#setCalculated(calculated, value);
      },
      complete: () => {
        this.complete();
      },
      goTo: (name) => {
        this.goTo(name);
      },
    });
    this.#settle(() => this.#logic.evaluateAll(this.#resolvePath));
  }

  #setCalculated(calculated: CalculatedValue, value: unknown): void {
    const { changed, previousValue } = this.#calculated.set(calculated.name, value);
    // Announced only when it reaches `data`: onValueChanged means "an answer changed",
    // and reporting something the host cannot find in `data` would mislead.
    if (changed && calculated.includeIntoResult) {
      this.#pendingValueChanges.push({ name: calculated.name, value, previousValue });
    }
  }

  /**
   * Runs logic to completion, then emits everything it produced.
   *
   * The guard is what makes a rule's own `setValue` safe: writes are declared to the
   * graph, so the running plan already contains everything downstream of them.
   * Starting a nested transaction per write would re-plan mid-flight and, for two
   * rules feeding each other, recurse.
   */
  #settle(run: () => LogicRunResult): void {
    if (this.#isSettling) {
      this.#diagnostics.record(run());
      return;
    }
    this.#isSettling = true;
    this.#diagnostics.reset();
    try {
      this.#diagnostics.record(run());
    } finally {
      this.#isSettling = false;
    }
    this.#flushEvents();
  }

  /** Emits buffered events once the model has finished settling. */
  #flushEvents(): void {
    const values = this.#pendingValueChanges;
    this.#pendingValueChanges = [];
    for (const event of values) {
      this.onValueChanged.emit(event);
    }
    for (const event of this.#states.drain()) {
      this.onElementStateChanged.emit(event);
    }
  }

  get currentPageNo(): number {
    return this.#currentPageNo;
  }

  get currentPage(): Page | undefined {
    return this.#children.pages[this.#currentPageNo];
  }

  setCurrentPageNo(pageNo: number): void {
    if (pageNo < 0 || pageNo >= this.#children.pages.length || pageNo === this.#currentPageNo) {
      return;
    }
    const previousPageNo = this.#currentPageNo;
    this.#currentPageNo = pageNo;
    this.onCurrentPageChanged.emit({ previousPageNo, currentPageNo: pageNo });
  }

  /**
   * Navigates to a page by name, or to the page owning the named question.
   *
   * Accepting either is what makes a `skip` trigger usable: authors think in terms of
   * "jump to this question", and which page it sits on is not their concern.
   */
  goTo(name: string): void {
    const byPage = this.#children.pages.findIndex((page) => page.name === name);
    const pageNo =
      byPage === -1
        ? this.#children.pages.findIndex((page) => page.elements.some((element) => element.name === name))
        : byPage;
    if (pageNo !== -1) {
      this.setCurrentPageNo(pageNo);
    }
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
    const previousValue = this.#data.get(name);
    if (Object.is(previousValue, value)) {
      return;
    }
    if (value === undefined) {
      this.#data.delete(name);
    } else {
      this.#data.set(name, value);
    }
    this.#pendingValueChanges.push({ name, value, previousValue });

    this.#settle(() => this.#logic.applyValueChange([{ kind: 'name', name }], this.#resolvePath));
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
