import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a media query matches, as state.
 *
 * **For layouts that cannot be expressed in CSS**, which is a narrow case worth naming: a
 * breakpoint that only changes how something *looks* belongs in a `sm:` utility, where it
 * costs nothing and works before JavaScript arrives. This hook is for the other kind —
 * where the two layouts are different component trees, so both would otherwise be in the
 * DOM at once and every `getByTestId` would match twice.
 *
 * `useSyncExternalStore` over `useState` + `useEffect` because the list *is* an external
 * store and React already knows how to read one: no effect to miss a change that happened
 * between render and commit, and the server snapshot is explicit rather than implied.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => {
        list.removeEventListener('change', onStoreChange);
      };
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // A server has no viewport, so every query is false there. Callers phrase the query so
    // that false is the layout a server would be right about — and the one caller is
    // client-only anyway, so this is a guard rather than a behaviour.
    () => false,
  );
}
