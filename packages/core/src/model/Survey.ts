import { EventEmitter } from '../events/EventEmitter.js';
import type {
  CompleteEvent,
  CurrentPageChangedEvent,
  ElementStateChangedEvent,
  ValueChangedEvent,
} from '../events/SurveyEvents.js';
import type { PathSegment } from '../expressions/ExpressionNode.js';
import { LogicEngine } from '../logic/LogicEngine.js';
import type { LogicDiagnostics } from '../logic/LogicEngine.js';
import type { ChoiceFetcher } from './ChoiceSourceController.js';
import { refreshSurveyLogic } from './surveyLogicWiring.js';
import type { SurveyOptions } from './SurveyOptions.js';
import type { CalculatedValue } from './CalculatedValue.js';
import { ChoiceSourceController } from './ChoiceSourceController.js';
import { createPathResolver } from './createPathResolver.js';
import { ElementStateController } from './ElementStateController.js';
import { SettleCoordinator } from './SettleCoordinator.js';
import { SurveyAnswers } from './SurveyAnswers.js';
import type { Page } from './Page.js';
import { toQuestionsOnPageMode } from './PageLayout.js';
import { SurveyPages } from './SurveyPages.js';
import type { Question } from './Question.js';
import { SurveyChildren } from './SurveyChildren.js';
import { SurveyElement } from './SurveyElement.js';
import type { Trigger } from './Trigger.js';
import type { ValueHost } from './ValueHost.js';

/** Root of the model, and the value host every question writes through. */
export class Survey extends SurveyElement implements ValueHost {
  readonly #children: SurveyChildren = new SurveyChildren();
  readonly #answers: SurveyAnswers = new SurveyAnswers();
  readonly #logic: LogicEngine;
  readonly #states: ElementStateController = new ElementStateController();
  readonly #settle: SettleCoordinator = new SettleCoordinator((values) => {
    // Before anything is announced: logic may have hidden the page the respondent is
    // standing on, and a listener must never see a current page that no longer exists.
    this.#pages.clampToVisible();
    for (const event of values) {
      this.onValueChanged.emit(event);
    }
    for (const event of this.#states.drain()) {
      this.onElementStateChanged.emit(event);
    }
  });
  readonly #choiceSources: ChoiceSourceController = new ChoiceSourceController();
  readonly #pages: SurveyPages = new SurveyPages(
    () => this.#children.pages,
    () => toQuestionsOnPageMode(this.questionsOnPageMode),
    (event) => {
      this.onCurrentPageChanged.emit(event);
    },
  );
  readonly #resolvePath: (path: readonly PathSegment[]) => unknown = createPathResolver(
    (name) => this.#answers.resolve(name),
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

  /** How the authored pages are presented: standard, singlePage or questionPerPage. */
  get questionsOnPageMode(): string {
    return this.getStringProperty('questionsOnPageMode');
  }

  set questionsOnPageMode(value: string) {
    this.setPropertyValue('questionsOnPageMode', value);
  }

  /** The pages exactly as authored. Serialization reads these. */
  get pages(): readonly Page[] {
    return this.#children.pages;
  }

  /**
   * The pages a respondent actually walks through.
   *
   * Under `standard` this is the visible authored pages. The other modes reshape it —
   * one merged page, or one page per question — without touching the definition.
   */
  get visiblePages(): readonly Page[] {
    return this.#pages.visiblePages;
  }

  /** Every question on every page, panels flattened, in document order. */
  get questions(): readonly Question[] {
    return this.#children.questions;
  }

  getQuestionByName(name: string): Question | undefined {
    return this.#children.findQuestion(name);
  }

  get calculatedValues(): readonly CalculatedValue[] {
    return this.#children.calculatedValues;
  }

  get triggers(): readonly Trigger[] {
    return this.#children.triggers;
  }

  /** The current result of a calculated value, whether or not it reaches `data`. */
  getCalculatedValue(name: string): unknown {
    return this.#answers.getCalculated(name);
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return this.#children.get(property);
  }

  override addChild(property: string, child: SurveyElement): void {
    this.#children.add(property, child, this);
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

  /** Rebuilds conditional logic from the current tree and evaluates it once. */
  refreshLogic(): void {
    refreshSurveyLogic(this.#children, {
      logic: this.#logic,
      states: this.#states,
      settle: this.#settle,
      choiceSources: this.#choiceSources,
      answers: this.#answers,
      resolvePath: this.#resolvePath,
      getValue: (name) => this.getValue(name),
      writeValue: (name, value) => this.#writeValue(name, value),
      complete: () => this.complete(),
      goTo: (name) => this.goTo(name),
      findQuestion: (name) => this.getQuestionByName(name),
    });
  }

  get currentPageNo(): number {
    return this.#pages.currentPageNo;
  }

  get currentPage(): Page | undefined {
    return this.#pages.currentPage;
  }

  setCurrentPageNo(pageNo: number): void {
    this.#pages.setCurrentPageNo(pageNo);
  }

  /** How many pages the respondent walks through, after visibility and layout mode. */
  get pageCount(): number {
    return this.#pages.pageCount;
  }

  get isFirstPage(): boolean {
    return this.#pages.isFirstPage;
  }

  get isLastPage(): boolean {
    return this.#pages.isLastPage;
  }

  /** Moves forward one page. False when there is nowhere further to go. */
  nextPage(): boolean {
    return this.#pages.nextPage();
  }

  prevPage(): boolean {
    return this.#pages.prevPage();
  }

  /**
   * Advances, or completes when this is the last page.
   *
   * One call rather than making the renderer decide, so every adapter agrees on what
   * the primary button does and none of them has to reimplement "am I at the end".
   */
  nextPageOrComplete(): void {
    if (!this.#pages.nextPage()) {
      this.complete();
    }
  }

  /** Navigates to a page by name, or to the page owning the named question. */
  goTo(name: string): void {
    this.#pages.goTo(name);
  }

  /**
   * The answers, plus any calculated value marked `includeIntoResult`.
   *
   * A shallow copy: mutating the result must not reach into the survey.
   */
  get data(): Readonly<Record<string, unknown>> {
    return this.#answers.toResult(this.#children.calculatedValues);
  }

  setData(next: Readonly<Record<string, unknown>>): void {
    for (const [name, value] of Object.entries(next)) {
      this.setValue(name, value);
    }
  }

  getValue(name: string): unknown {
    return this.#answers.get(name);
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
    const { changed, previousValue } = this.#answers.write(name, value);
    if (changed) {
      this.#settle.queueValue({ name, value, previousValue });
    }
    return changed;
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
