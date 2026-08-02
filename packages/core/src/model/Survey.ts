import { EventEmitter } from '../events/EventEmitter.js';
import type {
  CompleteEvent,
  CurrentPageChangedEvent,
  ValueChangedEvent,
  VisibilityChangedEvent,
} from '../events/SurveyEvents.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { LogicEngine } from '../logic/LogicEngine.js';
import type { LogicEngineOptions } from '../logic/LogicEngine.js';
import { Page } from './Page.js';
import type { Question } from './Question.js';
import { SurveyElement } from './SurveyElement.js';
import type { ValueHost } from './ValueHost.js';

const VISIBLE_IF = 'visibleIf';

/** Root of the model, and the value host every question writes through. */
export class Survey extends SurveyElement implements ValueHost {
  readonly #pages: Page[] = [];
  readonly #data: Map<string, unknown> = new Map();
  readonly #logic: LogicEngine;
  #currentPageNo = 0;
  #isCompleted = false;
  #structureVersion = 0;
  #pendingVisibility: VisibilityChangedEvent[] = [];

  readonly onValueChanged: EventEmitter<ValueChangedEvent> = new EventEmitter();
  readonly onComplete: EventEmitter<CompleteEvent> = new EventEmitter();
  readonly onCurrentPageChanged: EventEmitter<CurrentPageChangedEvent> = new EventEmitter();
  readonly onVisibilityChanged: EventEmitter<VisibilityChangedEvent> = new EventEmitter();

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

  /**
   * Increments whenever logic changes what is visible.
   *
   * A monotonic counter is exactly the snapshot `useSyncExternalStore` wants, which is
   * how the React adapter re-renders without core knowing React exists.
   */
  get structureVersion(): number {
    return this.#structureVersion;
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
      this.#registerVisibility(page, `page:${page.name}`);
      for (const question of page.elements) {
        this.#registerVisibility(question, `question:${question.name}`);
      }
    }
    this.#logic.evaluateAll(this.#resolvePath);
    this.#flushVisibility();
  }

  #registerVisibility(element: SurveyElement, owner: string): void {
    const expression = element.getPropertyValue(VISIBLE_IF);
    if (typeof expression !== 'string' || expression.trim().length === 0) {
      this.#applyVisibility(element, true);
      return;
    }
    this.#logic.addCondition({
      key: `${owner}:${VISIBLE_IF}`,
      expression,
      // A malformed or unevaluable condition leaves the element visible: hiding a
      // question because its expression is broken loses answers silently.
      fallback: true,
      apply: (isVisible) => {
        this.#applyVisibility(element, isVisible);
      },
    });
  }

  #applyVisibility(element: SurveyElement, isVisible: boolean): void {
    if (element.isVisible === isVisible) {
      return;
    }
    element.setVisibility(isVisible);
    this.#structureVersion += 1;
    this.#pendingVisibility.push({ element, isVisible });
  }

  /** Emits buffered visibility events once the model has finished settling. */
  #flushVisibility(): void {
    const pending = this.#pendingVisibility;
    this.#pendingVisibility = [];
    for (const event of pending) {
      this.onVisibilityChanged.emit(event);
    }
  }

  readonly #resolvePath = (path: readonly PathSegment[]): unknown => {
    const [first, ...rest] = path;
    if (first === undefined || first.kind !== 'name') {
      return;
    }
    let current: unknown = this.#data.get(first.name);
    for (const segment of rest) {
      if (current === null || current === undefined) {
        return;
      }
      current =
        segment.kind === 'index'
          ? (current as Record<number, unknown>)[segment.index]
          : (current as Record<string, unknown>)[segment.name];
    }
    return current;
  };

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
   * Logic runs *before* any event fires, and visibility events are buffered until it
   * has finished, so a listener never observes the model part-way through a cascade
   * (ADR-0004's transaction model).
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

    this.#logic.applyValueChange([{ kind: 'name', name }], this.#resolvePath);

    this.onValueChanged.emit({ name, value, previousValue });
    this.#flushVisibility();
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
