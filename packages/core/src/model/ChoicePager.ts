import type { ChoicePage, ChoicePageItem, ChoicePageLoader } from './ChoicePageLoader.js';
import { ItemValue } from './ItemValue.js';

export interface ChoicePagerOptions {
  readonly questionName: string;
  readonly pageSize: number;
  readonly load: ChoicePageLoader;
  /** Says that something a renderer reads has changed. */
  readonly announce: () => void;
  /** Records a page that could not be loaded. Never an objection to an answer. */
  readonly reportError: (message: string) => void;
}

/**
 * One question's worth of paged choices.
 *
 * Accumulates rather than replaces: page two is appended to page one, because the
 * respondent is looking at page one and a list that emptied itself to show more would
 * lose their place. Changing the filter is the one thing that discards — a term is a
 * different list, not more of the same one.
 *
 * **Nothing here may leave the question loading.** A loader that rejects is the host's
 * problem to hear about, and a spinner that never stops is a list a respondent can
 * neither read nor get past — the same failure the async validators had.
 */
export class ChoicePager {
  readonly #options: ChoicePagerOptions;
  #items: readonly ItemValue[] = [];
  #filter = '';
  #hasMore = true;
  #isLoading = false;
  /**
   * Which request the pager is waiting for.
   *
   * A reply for an earlier filter must not append itself to the list for a later one:
   * the respondent typed on, and choices for the term they abandoned would arrive as a
   * list that does not match what is in the box.
   */
  #generation = 0;

  constructor(options: ChoicePagerOptions) {
    this.#options = options;
  }

  /** The choices loaded so far, in the order the host reported them. */
  get items(): readonly ItemValue[] {
    return this.#items;
  }

  get isLoading(): boolean {
    return this.#isLoading;
  }

  get hasMore(): boolean {
    return this.#hasMore;
  }

  get filter(): string {
    return this.#filter;
  }

  /**
   * Asks for the next page.
   *
   * Silent while one is outstanding, so a respondent leaning on the control — or a
   * scroll handler firing on every pixel — starts one request rather than twenty.
   */
  loadMore(): void {
    if (this.#isLoading || !this.#hasMore) {
      return;
    }
    this.#request(this.#items.length);
  }

  setFilter(query: string): void {
    const filter = query.trim();
    if (filter === this.#filter) {
      return;
    }
    this.#filter = filter;
    this.#items = [];
    this.#hasMore = true;
    // Whatever is in flight answers the previous term.
    this.#generation += 1;
    this.#request(0);
  }

  #request(skip: number): void {
    const generation = this.#generation;
    this.#isLoading = true;
    this.#options.announce();
    void this.#options
      .load({
        questionName: this.#options.questionName,
        skip,
        take: this.#options.pageSize,
        filter: this.#filter,
      })
      .then(
        (page) => {
          this.#append(generation, page);
        },
        (cause: unknown) => {
          this.#fail(generation, describeFailure(cause));
        },
      );
  }

  #append(generation: number, page: ChoicePage): void {
    if (!this.#settle(generation)) {
      return;
    }
    this.#items = [...this.#items, ...page.items.map(toChoice)];
    this.#hasMore = page.hasMore;
    this.#options.announce();
  }

  #fail(generation: number, message: string): void {
    if (!this.#settle(generation)) {
      return;
    }
    // `hasMore` is left as it was, so the control stays available and pressing it again
    // retries. A page that failed to arrive is not the end of the list.
    this.#options.reportError(message);
    this.#options.announce();
  }

  /**
   * Accepts a reply, or discards it as an answer to a question nobody is asking.
   *
   * A stale reply leaves `isLoading` alone: the request that superseded it is still
   * outstanding, and clearing the flag here would show a settled list while one more
   * page was on its way.
   */
  #settle(generation: number): boolean {
    if (generation !== this.#generation) {
      return false;
    }
    this.#isLoading = false;
    return true;
  }
}

function toChoice(item: ChoicePageItem): ItemValue {
  const choice = new ItemValue();
  choice.value = item.value;
  if (item.text !== undefined) {
    choice.text = item.text;
  }
  return choice;
}

function describeFailure(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
