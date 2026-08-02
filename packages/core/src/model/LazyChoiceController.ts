import type { ChoicePageLoader } from './ChoicePageLoader.js';
import { ChoicePager } from './ChoicePager.js';
import type { SelectQuestion } from './SelectQuestion.js';

const DEFAULT_PAGE_SIZE = 25;

/**
 * Owns the pagers, one per question, and the host loader they all use.
 *
 * Separate from `ChoiceSourceController` because the two answer different questions —
 * that one decides *where a list comes from*, this one decides *how much of it has
 * arrived* — and because a pager has to outlive rule registration. Rules are rebuilt
 * from scratch whenever the tree changes; a pager rebuilt with them would throw away
 * pages the respondent is looking at and ask for them again.
 */
export class LazyChoiceController {
  readonly #pagers: Map<string, ChoicePager> = new Map();
  readonly #errors: string[] = [];
  #load: ChoicePageLoader | undefined;

  setLoader(load: ChoicePageLoader | undefined): void {
    this.#load = load;
  }

  /** Pages that could not be loaded. */
  get errors(): readonly string[] {
    return this.#errors;
  }

  /**
   * Gives a question a pager, and asks for its first page.
   *
   * The first page is fetched as soon as the question is registered rather than when
   * the list is opened, because a native `<select>` has no notion of being opened: the
   * respondent finds it already populated or not at all. A combobox that can say "I am
   * open" is Phase 2's, and this is the seam it will call instead.
   *
   * Reuses an existing pager, so a rebuild keeps the pages already loaded.
   */
  attach(question: SelectQuestion, announce: () => void): void {
    const load = this.#load;
    if (load === undefined) {
      this.#errors.push(
        `"${question.name}" loads its choices lazily, so the survey needs a page loader. Pass one as the loadChoicePage option.`,
      );
      return;
    }
    const existing = this.#pagers.get(question.name);
    if (existing !== undefined) {
      this.#install(question, existing);
      return;
    }

    const pager = new ChoicePager({
      questionName: question.name,
      pageSize: question.choicesLazyLoadPageSize > 0
        ? question.choicesLazyLoadPageSize
        : DEFAULT_PAGE_SIZE,
      load,
      announce,
      reportError: (message) => {
        this.#errors.push(`Loading choices for "${question.name}" failed: ${message}`);
      },
    });
    this.#pagers.set(question.name, pager);
    this.#install(question, pager);
    pager.loadMore();
  }

  /** Takes a question's pager away — it is no longer paged, or no longer exists. */
  detach(question: SelectQuestion): void {
    if (this.#pagers.delete(question.name)) {
      question.detachChoicePaging();
      question.clearChoiceProvider();
    }
  }

  #install(question: SelectQuestion, pager: ChoicePager): void {
    // A provider rather than a stored list, for the same reason every other choice
    // source uses one: the next page has to reach the respondent without anybody
    // remembering to copy it across.
    question.setChoiceProvider(() => pager.items);
    question.attachChoicePaging(pager);
  }
}
