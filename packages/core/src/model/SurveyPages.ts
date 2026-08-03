import type { CurrentPageChangedEvent } from '../events/SurveyEvents.js';
import { NavigationController } from './NavigationController.js';
import type { Page } from './Page.js';
import { PageLayout } from './PageLayout.js';
import type { QuestionsOnPageMode } from './PageLayout.js';

/**
 * Which pages exist, and where the respondent is standing.
 *
 * One object because the two are inseparable: `currentPageNo` indexes the *effective*
 * page list, so a layout that reshapes that list without navigation noticing would
 * leave the index pointing at a page that no longer exists. Keeping them apart made
 * that an invariant somebody had to remember.
 */
export class SurveyPages {
  readonly #layout: PageLayout;
  readonly #navigation: NavigationController;

  constructor(
    authored: () => readonly Page[],
    mode: () => QuestionsOnPageMode,
    announce: (event: CurrentPageChangedEvent) => void,
  ) {
    this.#layout = new PageLayout(authored, mode);
    this.#navigation = new NavigationController(() => this.#layout.pages, announce);
  }

  /** The pages a respondent actually walks through, after visibility and layout mode. */
  get visiblePages(): readonly Page[] {
    return this.#layout.pages;
  }

  get currentPageNo(): number {
    return this.#navigation.currentPageNo;
  }

  get currentPage(): Page | undefined {
    return this.#navigation.currentPage;
  }

  get pageCount(): number {
    return this.#navigation.pageCount;
  }

  get isFirstPage(): boolean {
    return this.#navigation.isFirstPage;
  }

  get isLastPage(): boolean {
    return this.#navigation.isLastPage;
  }

  setCurrentPageNo(pageNo: number): void {
    this.#navigation.setCurrentPageNo(pageNo);
  }

  nextPage(): boolean {
    return this.#navigation.nextPage();
  }

  prevPage(): boolean {
    return this.#navigation.prevPage();
  }

  goTo(name: string): void {
    this.#navigation.goTo(name);
  }

  clampToVisible(): void {
    this.#navigation.clampToVisible();
  }
}
