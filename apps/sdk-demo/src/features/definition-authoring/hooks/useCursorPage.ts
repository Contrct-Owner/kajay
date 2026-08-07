import { useCallback, useEffect, useRef, useState } from 'react';
import type { CursorPage } from '../api/DefinitionAuthoringTypes.js';

export interface CursorPageState<T, TFilters> {
  readonly page: CursorPage<T>;
  readonly filters: TFilters;
  readonly error: string | undefined;
  readonly isLoading: boolean;
  readonly applyFilters: (filters: TFilters) => Promise<void>;
  readonly loadMore: () => Promise<void>;
}

export function useCursorPage<T, TFilters>(
  resetKey: string,
  initialPage: CursorPage<T> | undefined,
  initialFilters: TFilters,
  loader: (cursor: string | undefined, filters: TFilters) => Promise<CursorPage<T>>,
): CursorPageState<T, TFilters> {
  const [page, setPage] = useState<CursorPage<T>>(initialPage ?? emptyPage());
  const [filters, setFilters] = useState(initialFilters);
  const [error, setError] = useState<string>();
  const [isLoading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    setPage(initialPage ?? emptyPage());
    setFilters(initialFilters);
    setError(undefined);
    setLoading(false);
  }, [initialFilters, initialPage, resetKey]);

  const request = useCallback(async (
    cursor: string | undefined, nextFilters: TFilters, append: boolean,
  ): Promise<void> => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const result = await loader(cursor, nextFilters);
      if (requestId.current !== currentRequest) return;
      setPage((current) => append ? appendPage(current, result) : result);
      setFilters(nextFilters);
      setError(undefined);
    } catch (reason: unknown) {
      if (requestId.current === currentRequest) setError(readError(reason));
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [loader]);

  return {
    page, filters, error, isLoading,
    applyFilters: (value) => request(undefined, value, false),
    loadMore: () => page.nextCursor === undefined
      ? Promise.resolve()
      : request(page.nextCursor, filters, true),
  };
}

function emptyPage<T>(): CursorPage<T> {
  return { items: [], nextCursor: undefined };
}

function appendPage<T>(current: CursorPage<T>, next: CursorPage<T>): CursorPage<T> {
  return { items: [...current.items, ...next.items], nextCursor: next.nextCursor };
}

function readError(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'History request failed.';
}
