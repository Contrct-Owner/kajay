import { EventEmitter } from '../events/EventEmitter.js';
import type {
  CompleteEvent,
  CurrentPageChangedEvent,
  ElementStateChangedEvent,
  ElementStateKind,
  ValueChangedEvent,
} from '../events/SurveyEvents.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { LogicEngine } from '../logic/LogicEngine.js';
import type { LogicEngineOptions } from '../logic/LogicEngine.js';
import { Page } from './Page.js';
import { Question } from './Question.js';
import { SurveyElement } from './SurveyElement.js';
import type { ValueHost } from './ValueHost.js';

interface ConditionalProperty {
  readonly property: string;
  readonly state: ElementStateKind;
  /**
   * Result used when the expression is malformed or unevaluable.
   *
   * Visibility and enablement fall back to *permissive*: hiding or freezing a question
   * because its expression is broken loses answers silently. Requiredness falls back
   * to *lenient* for the mirror-image reason — blocking submission over a broken
   * expression is worse than letting the answer through.
   */
  readonly fallback: boolean;
}

const CONDITIONAL_PROPERTIES: readonly ConditionalProperty[] = [
  { property: 'visibleIf', state: 'visible', fallback: true },
  { property: 'enableIf', state: 'enabled', fallback: true },
  { property: 'requiredIf', state: 'required', fallback: false },
];

/** Root of the model, and the value host every question writes through. */
export class Survey extends SurveyElement implements ValueHost {
  readonly #pages: Page[] = [];
  readonly #data: Map<string, unknown> = new Map();
  readonly #logic: LogicEngine;
  #currentPageNo = 0;
  #isCompleted = false;
  #logicVersion = 0;
  #pendingStateChanges: ElementStateChangedEvent[] = [];

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

  /**
   * Increments whenever logic changes an element's visible, enabled or required state.
   *
   * A monotonic counter is exactly the snapshot `useSyncExternalStore` wants, which is
   * how the React adapter re-renders without core knowing React exists.
   */
  get logicVersion(): number {
    return this.#logicVersion;
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
        this.#registerConditions(question, `question:${question.name}`);
      }
    }
    this.#logic.evaluateAll(this.#resolvePath);
    this.#flushStateChanges();
  }

  #registerConditions(element: SurveyElement, owner: string): void {
    for (const conditional of CONDITIONAL_PROPERTIES) {
      const expression = element.getPropertyValue(conditional.property);
      if (typeof expression !== 'string' || expression.trim().length === 0) {
        this.#clearCondition(element, conditional.state);
        continue;
      }
      this.#logic.addCondition({
        key: `${owner}:${conditional.property}`,
        expression,
        fallback: conditional.fallback,
        apply: (result) => {
          this.#applyState(element, conditional.state, result);
        },
      });
    }
  }

  /** No expression: revert to the element's authored, unconditional state. */
  #clearCondition(element: SurveyElement, state: ElementStateKind): void {
    if (state === 'required') {
      if (element instanceof Question) {
        element.setRequiredOverride(undefined);
      }
      return;
    }
    this.#applyState(element, state, true);
  }

  #applyState(element: SurveyElement, state: ElementStateKind, value: boolean): void {
    if (state === 'visible') {
      if (element.isVisible === value) {
        return;
      }
      element.setVisibility(value);
    } else if (state === 'enabled') {
      if (element.isEnabled === value) {
        return;
      }
      element.setEnabled(value);
    } else {
      // `requiredIf` is meaningless on anything that cannot hold an answer.
      if (!(element instanceof Question) || element.isRequired === value) {
        return;
      }
      element.setRequiredOverride(value);
    }

    this.#logicVersion += 1;
    this.#pendingStateChanges.push({ element, state, value });
  }

  /** Emits buffered state events once the model has finished settling. */
  #flushStateChanges(): void {
    const pending = this.#pendingStateChanges;
    this.#pendingStateChanges = [];
    for (const event of pending) {
      this.onElementStateChanged.emit(event);
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
    this.#flushStateChanges();
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
