import { EventEmitter } from '../events/EventEmitter.js';
import type {
  CompleteEvent,
  CurrentPageChangedEvent,
  ElementStateChangedEvent,
  SurveyStateChangedEvent,
  ValidateQuestionEvent,
  ValidatingChangedEvent,
  ValueChangedEvent,
} from '../events/SurveyEvents.js';
import type { LogicDiagnostics } from '../logic/LogicEngine.js';
import type { SurveyOptions } from './SurveyOptions.js';
import { clearHiddenAnswers } from './clearInvisibleAnswers.js';
import { shouldAdvanceAutomatically } from './autoAdvance.js';
import { collectPreviewQuestions } from './previewQuestions.js';
import { SurveyProperties } from './SurveyProperties.js';
import { readProgress, restoreProgress } from './SurveyProgress.js';
import type { SurveyProgress } from './SurveyProgress.js';
import { SurveyStatus } from './SurveyStatus.js';
import { createStatusHost } from './surveyStatusWiring.js';
import type { HtmlCondition } from './HtmlCondition.js';
import type { CalculatedValue } from './CalculatedValue.js';
import { SurveyAnswers } from './SurveyAnswers.js';
import { SurveyLogicHost } from './SurveyLogicHost.js';
import type { Page } from './Page.js';
import { toQuestionsOnPageMode } from './PageLayout.js';
import { SurveyPages } from './SurveyPages.js';
import type { Question } from './Question.js';
import { SurveyChildren } from './SurveyChildren.js';
import type { SurveyElement } from './SurveyElement.js';
import { SurveyValidation } from './SurveyValidation.js';
import type { AdvanceOutcome } from './SurveyValidation.js';
import { createValidationHost, createValidationWiring } from './surveyValidationWiring.js';
import type { Trigger } from './Trigger.js';
import type { ValueHost } from './ValueHost.js';

/** Root of the model, and the value host every question writes through. */
export class Survey extends SurveyProperties implements ValueHost {
  readonly #children: SurveyChildren = new SurveyChildren();
  readonly #answers: SurveyAnswers = new SurveyAnswers();
  readonly #logic: SurveyLogicHost;
  readonly #pages: SurveyPages = new SurveyPages(
    () => this.#children.pages,
    () => toQuestionsOnPageMode(this.questionsOnPageMode),
    (event) => {
      this.onCurrentPageChanged.emit(event);
    },
  );
  readonly #validation: SurveyValidation = new SurveyValidation(
    createValidationHost(this, createValidationWiring(this, () => this.#logic)),
  );

  readonly #status: SurveyStatus = new SurveyStatus(
    createStatusHost(this, {
      evaluate: (expression) => this.#logic.evaluate(expression),
      // Answers *and* calculated values: a completed page saying "you answered 3 of 5"
      // is reading something computed, and B6 exists to make that possible.
      resolve: (name) => this.#answers.resolve(name),
      announce: (state) => {
        this.onStateChanged.emit({ state });
      },
    }),
  );

  readonly onValueChanged: EventEmitter<ValueChangedEvent> = new EventEmitter();
  readonly onComplete: EventEmitter<CompleteEvent> = new EventEmitter();
  /**
   * Raised when the survey moves between loading, empty, running and completed.
   *
   * Separate from `onComplete`, which is the host's cue to *submit* — a renderer needs
   * to know about every one of these transitions, and a host saving results needs
   * exactly one of them.
   */
  readonly onStateChanged: EventEmitter<SurveyStateChangedEvent> = new EventEmitter();
  readonly onCurrentPageChanged: EventEmitter<CurrentPageChangedEvent> = new EventEmitter();
  readonly onElementStateChanged: EventEmitter<ElementStateChangedEvent> = new EventEmitter();
  /** Raised per question as it is checked. Listeners report by calling `addError`. */
  readonly onValidateQuestion: EventEmitter<ValidateQuestionEvent> = new EventEmitter();
  /** Raised when a check leaves the process, and again when it lands. */
  readonly onValidatingChanged: EventEmitter<ValidatingChangedEvent> = new EventEmitter();

  constructor(options: SurveyOptions = {}) {
    super();
    this.#logic = new SurveyLogicHost(this.#answers, options, {
      // Logic may have hidden the page the respondent is standing on, and a listener
      // must never see a page that no longer exists.
      beforeAnnounce: () => {
        this.#pages.clampToVisible();
      },
      value: (event) => {
        this.onValueChanged.emit(event);
      },
      elementState: (event) => {
        this.onElementStateChanged.emit(event);
      },
    });
    // Inside the settle, so nobody ever sees the moment where the question has gone
    // and its answer has not — and recomputed against, because something may have been
    // reading the answer that just disappeared.
    this.#logic.setAfterSettle(() => {
      clearHiddenAnswers(this, (name) => {
        // The ordinary write path: nested inside the settle that hid the question, so
        // it buffers rather than announcing, and whatever read the answer recomputes.
        this.setValue(name, undefined);
      });
    });
  }

  /**
   * Installs everything the host supplies: the choice fetcher, the page loader, the
   * `{@name}` endpoints and the expression functions.
   *
   * After construction because the metadata registry builds a survey through a
   * no-argument factory, so `parseSurvey` — the path every host actually uses — has
   * nowhere to pass them at construction. One call rather than four setters: they are
   * one decision, and four of them is four chances to install three.
   */
  configure(options: SurveyOptions): void {
    this.#logic.configure(options);
  }

  /**
   * Supplies the loader for `choicesLazyLoadEnabled`, on the same terms.
   *
   * Set before logic first runs, because a lazily-paged question asks for its first
   * page as soon as it is registered.
   */
  /** Messages from choice sources: a failed load, or a missing fetcher. */
  get choiceErrors(): readonly string[] {
    return this.#logic.choiceErrors;
  }

  override get type(): string {
    return 'survey';
  }

  /** Flips the whole survey between answering and reading, and says so. */
  setReadOnly(isReadOnly: boolean): void {
    this.setPropertyValue('readOnly', isReadOnly);
    this.#logic.announceReadOnly(this);
  }

  /**
   * Validation: when answers are checked, where errors are drawn, and what the last
   * check found.
   *
   * A namespace rather than a dozen more members here, because those members are one
   * subject and the survey root is already the facade over five subsystems. The
   * policy it carries is authored on the survey and serializes there — `validation`
   * reads and writes the same property bag, so nothing is duplicated.
   */
  get validation(): SurveyValidation {
    return this.#validation;
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

  /** Conditional endings, in the order the conditions are tried. */
  get completedHtmlOnCondition(): readonly HtmlCondition[] {
    return this.#children.completedHtmlOnCondition;
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
    return this.#logic.version;
  }

  /**
   * What the most recent logic run reported: cycles, and malformed expressions.
   *
   * Checklist B8 asks for cycles to be *reported*, which is only true if a host can
   * actually read them. The graph knows; without this it had nowhere to say so.
   */
  get logicDiagnostics(): LogicDiagnostics {
    return this.#logic.diagnostics;
  }

  /** Rebuilds conditional logic from the current tree and evaluates it once. */
  refreshLogic(): void {
    this.#logic.refresh(this.#children, {
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
   * The respondent's forward action: advance, or complete on the last page.
   *
   * One call rather than making the renderer decide, so every adapter agrees on what
   * the primary button does and none of them has to reimplement "am I at the end".
   *
   * The only path validation gates. `nextPage`, `prevPage`, `goTo` and
   * `setCurrentPageNo` are movement, and a `skip` trigger moving a respondent has
   * nothing to do with whether the page they are leaving is complete.
   *
   * Three outcomes rather than a boolean, because `blocked` and `pending` call for
   * opposite responses from a renderer: one means put the respondent in front of the
   * error, the other means there is no error yet, only a wait. A `pending` move
   * completes itself if the check comes back clean.
   */
  nextPageOrComplete(): AdvanceOutcome {
    const gate = this.#validation.checkAdvance((isValid) => {
      if (isValid) {
        this.#advance();
      }
    });
    if (gate !== 'allowed') {
      return gate;
    }
    this.#advance();
    return 'advanced';
  }

  /**
   * Whether the whole survey is for reading rather than answering.
   *
   * True while previewing, whatever the definition says: a preview the respondent could
   * type into is not a preview, and making that a fact about the survey means no
   * renderer has to be told — every question already reports itself read-only.
   */
  override get isReadOnly(): boolean {
    return super.isReadOnly || this.#status.isPreviewing;
  }

  /** The questions shown before submitting: all of them, or only the answered ones. */
  get previewQuestions(): readonly Question[] {
    return collectPreviewQuestions(this);
  }

  #advance(): void {
    if (this.#pages.nextPage()) {
      return;
    }
    // The end of the last page is where a preview belongs — after the gate that checks
    // it, so a respondent never reviews answers the survey is about to refuse.
    if (this.showPreviewBeforeComplete === 'noPreview' || this.#status.isPreviewing) {
      this.complete();
      return;
    }
    this.#status.enterPreview();
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

  /** A snapshot to store, so a respondent can pick the survey up where they left it. */
  get progress(): SurveyProgress {
    return readProgress(this);
  }

  /** Applies a stored snapshot: the answers, then the page they were on. */
  restore(progress: SurveyProgress): void {
    restoreProgress(this, progress);
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
    this.#logic.applyValueChange(name);
    // After the settle, not inside it: logic may still change this answer — a
    // `setValueIf` forcing it to zero — and checking the value on the way past would
    // report an error against a number the respondent never sees.
    this.#validation.revalidateChanged(name);
    if (shouldAdvanceAutomatically(this, name)) {
      // Through the ordinary gate, so a page that would refuse the move still refuses
      // it — saving a click must not skip a check.
      this.nextPageOrComplete();
    }
  }

  /** Writes model state without starting a nested settle. Rule execution reports the path. */
  #writeValue(name: string, value: unknown): boolean {
    const { changed, previousValue } = this.#answers.write(name, value);
    if (changed) {
      this.#logic.queueValue({ name, value, previousValue });
    }
    return changed;
  }

  get isCompleted(): boolean {
    return this.#status.isCompleted;
  }

  /** Ends the survey: applies the clearing policy, then announces it. */
  complete(): void {
    this.#status.complete();
  }

  /** Loading, empty, running or completed — and the markup that goes with each. */
  get status(): SurveyStatus {
    return this.#status;
  }
}
