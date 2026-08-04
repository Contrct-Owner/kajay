import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
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
  const [query, setQuery] = useState('');
  const [isOpen, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useResults(pages, query, resultLimit);
  const groups = groupSearchResults(results);
  const orderedResults = groups.flatMap((group) => group.results);
  const active = orderedResults[Math.min(activeIndex, orderedResults.length - 1)];
  useActiveResultVisibility(isOpen, active, id);
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
