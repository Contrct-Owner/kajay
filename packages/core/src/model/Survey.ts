import type { DependencyError } from '../dependencies/DependencyError.js';
import { EventEmitter } from '../events/EventEmitter.js';
import type {
  CompleteEvent,
  CurrentPageChangedEvent,
  ElementStateChangedEvent,
  ValueChangedEvent,
} from '../events/SurveyEvents.js';
import type { ExpressionError } from '../expressions/ExpressionError.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { CONDITIONAL_PROPERTIES } from '../logic/conditionalProperties.js';
import { createValueRule } from '../logic/createValueRule.js';
import { LogicEngine } from '../logic/LogicEngine.js';
import type {
  LogicDiagnostics,
  LogicEngineOptions,
  LogicRunResult,
} from '../logic/LogicEngine.js';
import { createPathResolver } from './createPathResolver.js';
import { ElementStateController } from './ElementStateController.js';
import { Page } from './Page.js';
import type { Question } from './Question.js';
import { SurveyElement } from './SurveyElement.js';
import type { ValueHost } from './ValueHost.js';

/** A non-blank string property, or undefined. */
function stringProperty(element: SurveyElement, name: string): string | undefined {
  const value = element.getPropertyValue(name);
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/** Root of the model, and the value host every question writes through. */
export class Survey extends SurveyElement implements ValueHost {
  readonly #pages: Page[] = [];
  readonly #data: Map<string, unknown> = new Map();
  readonly #logic: LogicEngine;
  readonly #states: ElementStateController = new ElementStateController();
  readonly #resolvePath: (path: readonly PathSegment[]) => unknown = createPathResolver(this.#data);

  #currentPageNo = 0;
  #isCompleted = false;
  #isSettling = false;
  #pendingValueChanges: ValueChangedEvent[] = [];
  #dependencyErrors: DependencyError[] = [];
  #expressionErrors: ExpressionError[] = [];

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
    return this.#pages;
  }

  /** Pages a respondent can currently see. What the renderer draws. */
  get visiblePages(): readonly Page[] {
    return this.#pages.filter((page) => page.isVisible);
  }

  get questions(): readonly Question[] {
    return this.#pages.flatMap((page) => [...page.elements]);
  }

  getQuestionByName(name: string): Question | undefined {
    return this.questions.find((question) => question.name === name);
  }

  override getChildren(): readonly SurveyElement[] {
    return this.#pages;
  }

  override addChild(child: SurveyElement): void {
    if (!(child instanceof Page)) {
      throw new Error(`A survey accepts pages; received "${child.type}".`);
    }
    this.#pages.push(child);
    child.attachValueHost(this);
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
    return { dependencyErrors: this.#dependencyErrors, expressionErrors: this.#expressionErrors };
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
    for (const page of this.#pages) {
      this.#registerConditions(page, `page:${page.name}`);
      for (const question of page.elements) {
        const owner = `question:${question.name}`;
        this.#registerConditions(question, owner);
        this.#registerValueRule(question, owner);
      }
    }
    this.#settle(() => this.#logic.evaluateAll(this.#resolvePath));
  }

  #registerConditions(element: SurveyElement, owner: string): void {
    for (const conditional of CONDITIONAL_PROPERTIES) {
      const expression = stringProperty(element, conditional.property);
      if (expression === undefined) {
        this.#states.clear(element, conditional.state);
        continue;
      }
      this.#logic.addCondition({
        key: `${owner}:${conditional.property}`,
        expression,
        fallback: conditional.fallback,
        apply: (result) => {
          this.#states.apply(element, conditional.state, result);
        },
      });
    }
  }

  #registerValueRule(question: Question, owner: string): void {
    const rule = createValueRule(
      `${owner}:value`,
      {
        resetValueIf: stringProperty(question, 'resetValueIf'),
        setValueIf: stringProperty(question, 'setValueIf'),
        setValueExpression: stringProperty(question, 'setValueExpression'),
        defaultValueExpression: stringProperty(question, 'defaultValueExpression'),
      },
      {
        path: [{ kind: 'name', name: question.name }],
        getValue: () => this.getValue(question.name),
        setValue: (value) => {
          this.setValue(question.name, value);
        },
        clearValue: () => {
          this.setValue(question.name, undefined);
        },
      },
    );
    if (rule !== undefined) {
      this.#logic.addRule(rule);
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
      this.#recordDiagnostics(run());
      return;
    }
    this.#isSettling = true;
    this.#dependencyErrors = [];
    this.#expressionErrors = [];
    try {
      this.#recordDiagnostics(run());
    } finally {
      this.#isSettling = false;
    }
    this.#flushEvents();
  }

  #recordDiagnostics(result: LogicRunResult): void {
    this.#dependencyErrors.push(...result.dependencyErrors);
    this.#expressionErrors.push(...result.expressionErrors);
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
    return this.#pages[this.#currentPageNo];
  }

  setCurrentPageNo(pageNo: number): void {
    if (pageNo < 0 || pageNo >= this.#pages.length || pageNo === this.#currentPageNo) {
      return;
    }
    const previousPageNo = this.#currentPageNo;
    this.#currentPageNo = pageNo;
    this.onCurrentPageChanged.emit({ previousPageNo, currentPageNo: pageNo });
  }

  /** A shallow copy: mutating the result must not reach into the survey. */
  get data(): Readonly<Record<string, unknown>> {
    return Object.fromEntries(this.#data);
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
