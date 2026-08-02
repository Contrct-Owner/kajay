import type { CurrentPageChangedEvent } from '../events/SurveyEvents.js';
import { collectQuestions } from './pageElements.js';
import type { Page } from './Page.js';

/**
 * Which page the respondent is on.
 *
 * Separate from the survey because navigation has its own rules — a target may be
 * named by page or by a question the page contains — and because `skip` triggers drive
 * it from outside.
 *
 * Every index here counts **visible** pages, not authored ones. A page hidden by
 * `visibleIf` is not somewhere a respondent can stand, so counting it would make
 * "page 2 of 3" wrong and would let `next` land on nothing.
 */
export class NavigationController {
  #currentPageNo = 0;
  readonly #pages: () => readonly Page[];
  readonly #announce: (event: CurrentPageChangedEvent) => void;

  // Assigned explicitly: parameter properties need runtime emit, which
  // `erasableSyntaxOnly` forbids.
  constructor(
    pages: () => readonly Page[],
    announce: (event: CurrentPageChangedEvent) => void,
  ) {
    this.#pages = pages;
    this.#announce = announce;
  }

  get currentPageNo(): number {
    return this.#currentPageNo;
  }

  get currentPage(): Page | undefined {
    return this.#pages()[this.#currentPageNo];
  }

  get pageCount(): number {
    return this.#pages().length;
  }

  get isFirstPage(): boolean {
    return this.#currentPageNo === 0;
  }

  get isLastPage(): boolean {
    return this.#currentPageNo >= this.#pages().length - 1;
  }

  setCurrentPageNo(pageNo: number): void {
    const pages = this.#pages();
    if (pageNo < 0 || pageNo >= pages.length || pageNo === this.#currentPageNo) {
      return;
    }
    const previousPageNo = this.#currentPageNo;
    this.#currentPageNo = pageNo;
    this.#announce({ previousPageNo, currentPageNo: pageNo });
  }

  /** Moves forward one page. False when already on the last one. */
  nextPage(): boolean {
    if (this.isLastPage) {
      return false;
    }
    this.setCurrentPageNo(this.#currentPageNo + 1);
    return true;
  }

  /** Moves back one page. False when already on the first one. */
  prevPage(): boolean {
    if (this.isFirstPage) {
      return false;
    }
    this.setCurrentPageNo(this.#currentPageNo - 1);
    return true;
  }

  /**
   * Pulls the current index back inside the visible range.
   *
   * Logic can hide the page a respondent is standing on — answering "no" to a question
   * whose `visibleIf` governs a later page, say. Without this the index points past the
   * end and the renderer draws nothing at all.
   *
   * Clamps to the last visible page rather than the first: the pages that disappear are
   * usually later branches, and sending someone back to the start would throw away the
   * position they had reached.
   */
  clampToVisible(): void {
    const lastIndex = this.#pages().length - 1;
    if (lastIndex < 0 || this.#currentPageNo <= lastIndex) {
      return;
    }
    const previousPageNo = this.#currentPageNo;
    this.#currentPageNo = lastIndex;
    this.#announce({ previousPageNo, currentPageNo: lastIndex });
  }

  /**
   * Navigates to a page by name, or to the page owning the named question.
   *
   * Accepting either is what makes a `skip` trigger usable: authors think in terms of
   * "jump to this question", and which page it sits on is not their concern.
   */
  goTo(name: string): void {
    const pages = this.#pages();
    const byPage = pages.findIndex((page) => page.name === name);
    const pageNo =
      byPage === -1
        ? pages.findIndex((page) =>
            collectQuestions(page.elements).some((question) => question.name === name),
          )
        : byPage;
    if (pageNo !== -1) {
      this.setCurrentPageNo(pageNo);
    }
  }
}
