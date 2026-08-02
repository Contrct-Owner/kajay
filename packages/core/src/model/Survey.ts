import { EventEmitter } from '../events/EventEmitter.js';
import type {
  CompleteEvent,
  CurrentPageChangedEvent,
  ValueChangedEvent,
} from '../events/SurveyEvents.js';
import { Page } from './Page.js';
import type { Question } from './Question.js';
import { SurveyElement } from './SurveyElement.js';
import type { ValueHost } from './ValueHost.js';

/** Root of the model, and the value host every question writes through. */
export class Survey extends SurveyElement implements ValueHost {
  readonly #pages: Page[] = [];
  readonly #data: Map<string, unknown> = new Map();
  #currentPageNo = 0;
  #isCompleted = false;

  readonly onValueChanged: EventEmitter<ValueChangedEvent> = new EventEmitter();
  readonly onComplete: EventEmitter<CompleteEvent> = new EventEmitter();
  readonly onCurrentPageChanged: EventEmitter<CurrentPageChangedEvent> = new EventEmitter();

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
    this.onValueChanged.emit({ name, value, previousValue });
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
