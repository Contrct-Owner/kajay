import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type { DocPageDefinition } from '../docs-shell';
import {
  createDocumentationSearchIndex,
  docsReferenceManifest,
  queryDocumentationSearch,
  type AuthoredPageSearchRecord,
  type DocumentationSearchResult,
} from '../docs-reference';
import { groupSearchResults, type DocumentationSearchGroup } from './groupSearchResults';

export interface ReferenceSearchModel {
  readonly id: string;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly query: string;
  readonly isOpen: boolean;
  readonly active: DocumentationSearchResult | undefined;
  readonly groups: readonly DocumentationSearchGroup[];
  readonly resultId: (result: DocumentationSearchResult) => string;
  readonly onBlur: (event: FocusEvent<HTMLDivElement>) => void;
  readonly onChange: (value: string) => void;
  readonly onFocus: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onActivate: (result: DocumentationSearchResult) => void;
}

function authoredRecord(page: DocPageDefinition): AuthoredPageSearchRecord {
  return {
    id: page.slug.length === 0 ? 'home' : page.slug,
    title: page.title,
    description: page.description,
    url: page.slug.length === 0 ? '/docs' : `/docs/${page.slug}`,
    headings: page.toc?.map((item) => item.label) ?? [],
  };
}

function useResults(pages: readonly DocPageDefinition[], query: string, limit: number) {
  const index = useMemo(
    () => createDocumentationSearchIndex(docsReferenceManifest, pages.map((item) => authoredRecord(item))),
    [pages],
  );
  return useMemo(() => queryDocumentationSearch(index, query, limit), [index, query, limit]);
}

export function useReferenceSearch(
  pages: readonly DocPageDefinition[],
  resultLimit: number,
): ReferenceSearchModel {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useResults(pages, query, resultLimit);
  const groups = groupSearchResults(results);
  const orderedResults = groups.flatMap((group) => group.results);
  const active = orderedResults[Math.min(activeIndex, orderedResults.length - 1)];
  useActiveResultVisibility(isOpen, active, id);
  useQueryTypedBeforeHydration(inputRef, setQuery, setOpen);
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') setOpen(false);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => nextIndex(current, orderedResults.length, event.key === 'ArrowDown'));
    } else if (event.key === 'Enter' && isOpen && active !== undefined) {
      event.preventDefault();
      globalThis.location.assign(active.url);
    }
  }
  return {
    id,
    inputRef,
    query,
    isOpen,
    active,
    groups,
    resultId: (result) => `${id}-${safeId(result.id)}`,
    onBlur: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    },
    onChange: (value) => {
      setQuery(value);
      setActiveIndex(0);
      setOpen(value.trim().length > 0);
    },
    onFocus: () => setOpen(query.trim().length > 0),
    onKeyDown,
    onActivate: (result) => setActiveIndex(orderedResults.findIndex((item) => item.id === result.id)),
  };
}

/**
 * Adopts a query the visitor typed before this component was hydrated.
 *
 * **The documentation site is server-rendered, so the search box works as a text field
 * before it works as a search.** It is on screen and accepting keystrokes from the first
 * paint, and every handler above arrives with the bundle. A keystroke that lands in that
 * window updates the DOM value and raises an event React is not yet listening for: the
 * input holds the query, the state does not, and nothing later reconciles the two — the
 * only paths that open the list are a `change` or a `focus` that has already happened. On a
 * slow connection the search box accepts what is typed and then does nothing at all.
 *
 * So on mount the input is asked what it is holding, which is the one moment the answer is
 * knowable and the first moment it can be acted on. Whitespace is carried across too and
 * only the *opening* is conditional on it: a controlled input whose state disagrees with
 * its DOM is a second bug waiting for the next render to erase what someone typed.
 *
 * The dependencies are the ref object and two `useState` setters, all stable for the life
 * of the component, so this is a mount effect stated as what it depends on rather than as
 * an empty array that has to be taken on trust.
 */
function useQueryTypedBeforeHydration(
  inputRef: RefObject<HTMLInputElement | null>,
  setQuery: (value: string) => void,
  setOpen: (open: boolean) => void,
): void {
  useEffect(() => {
    const typed = inputRef.current?.value ?? '';
    if (typed.length > 0) {
      setQuery(typed);
      setOpen(typed.trim().length > 0);
    }
  }, [inputRef, setQuery, setOpen]);
}

function useActiveResultVisibility(
  isOpen: boolean,
  active: DocumentationSearchResult | undefined,
  id: string,
): void {
  useEffect(() => {
    if (isOpen && active !== undefined) {
      globalThis.document
        .querySelector<HTMLElement>(`[id="${id}-${safeId(active.id)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [active, id, isOpen]);
}

function nextIndex(current: number, count: number, forward: boolean): number {
  if (count === 0) return 0;
  return (current + (forward ? 1 : count - 1)) % count;
}

function safeId(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9_-]/gu, '-');
}
