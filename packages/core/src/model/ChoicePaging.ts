/**
 * What a select question needs from whatever is paging its choices.
 *
 * An interface rather than the pager itself, so `SelectQuestion` does not depend on the
 * thing that performs I/O for it — the question exposes the state and the two commands,
 * and knows nothing about requests, cancellation or where the choices came from.
 */
export interface ChoicePaging {
  /** True while a page is on its way. */
  readonly isLoading: boolean;
  /** True while asking again would bring more. */
  readonly hasMore: boolean;
  /** The term the loaded choices were narrowed by, or empty. */
  readonly filter: string;
  /** Asks for the next page. Does nothing while one is outstanding. */
  readonly loadMore: () => void;
  /** Narrows the list, discarding what was loaded for the previous term. */
  readonly setFilter: (query: string) => void;
}
