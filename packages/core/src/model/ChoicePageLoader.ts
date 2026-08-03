import type { PropertyValue } from '../metadata/PropertyDescriptor.js';

/** What the question is asking its host for. */
export interface ChoicePageRequest {
  readonly questionName: string;
  /** How many choices the question already holds. */
  readonly skip: number;
  /** How many more it wants — the question's `choicesLazyLoadPageSize`. */
  readonly take: number;
  /**
   * What the respondent has typed, trimmed, or empty.
   *
   * Sent with every page, so a host filters where the data is rather than after it has
   * travelled: the whole point of paging a list is that the far end of it never comes
   * over the wire, and a filter applied here could only narrow what already had.
   */
  readonly filter: string;
}

/** One choice, in the smallest form a host can be asked to produce. */
export interface ChoicePageItem {
  readonly value: PropertyValue;
  /** Display text. Falls back to the value, as an authored choice does. */
  readonly text?: string;
}

export interface ChoicePage {
  readonly items: readonly ChoicePageItem[];
  /**
   * Whether asking again would bring more.
   *
   * Reported rather than inferred from a short page: a host that filters server-side
   * can legitimately return fewer than asked for and still have more behind it, and
   * guessing would stop the list one page early.
   */
  readonly hasMore: boolean;
}

/**
 * Fetches one page of choices. Supplied by the host.
 *
 * Injected for the same reason `fetchJson` is: core carries no dependencies and cannot
 * reach for `fetch`. It is a callback rather than a URL template because paging needs
 * three parameters the host's own API decides the shape of — offset, size and filter —
 * and a template would have this package guessing at someone else's query string.
 */
export type ChoicePageLoader = (request: ChoicePageRequest) => Promise<ChoicePage>;
