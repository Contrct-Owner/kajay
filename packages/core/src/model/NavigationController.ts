import type { CurrentPageChangedEvent } from '../events/SurveyEvents.js';
import type { Page } from './Page.js';

/**
 * Which page the respondent is on.
 *
 * Separate from the survey because navigation has its own rules — a target may be
 * named by page or by a question the page contains — and because `skip` triggers drive
 * it from outside.
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

  setCurrentPageNo(pageNo: number): void {
    const pages = this.#pages();
    if (pageNo < 0 || pageNo >= pages.length || pageNo === this.#currentPageNo) {
      return;
    }
    const previousPageNo = this.#currentPageNo;
    this.#currentPageNo = pageNo;
    this.#announce({ previousPageNo, currentPageNo: pageNo });
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
        ? pages.findIndex((page) => page.elements.some((element) => element.name === name))
        : byPage;
    if (pageNo !== -1) {
      this.setCurrentPageNo(pageNo);
    }
  }
}
