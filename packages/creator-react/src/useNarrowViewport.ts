import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether the viewport is too narrow for the designer's three columns — checklist N1.
 *
 * **Measured rather than styled, and only because it has to be.** A breakpoint that changes
 * how something *looks* belongs in the stylesheet, where it costs nothing, works before
 * JavaScript arrives, and a host can override it. This one changes which components exist:
 * the three panels side by side and the one panel with the other two behind buttons are
 * different trees, and rendering both would put two toolboxes in one document — two search
 * boxes with the same label, two of every item, and every `getByTestId` ambiguous.
 *
 * The threshold matches the stylesheet's own, which is the whole point: `styles.css` stops
 * laying out three columns at exactly this width, so this is where the assembly has to stop
 * asking for them. Two numbers that must agree, written twice — see `NARROW_VIEWPORT` for
 * why that is the lesser evil.
 *
 * `useSyncExternalStore` because the media query list *is* an external store and React
 * already knows how to read one: no effect that can miss a change between render and
 * commit, and a server snapshot that is explicit rather than implied.
 */
export function useNarrowViewport(): boolean {
  const subscribe = useCallback((onStoreChange: () => void): (() => void) => {
    const list = globalThis.matchMedia(NARROW_VIEWPORT);
    list.addEventListener('change', onStoreChange);
    return () => {
      list.removeEventListener('change', onStoreChange);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => globalThis.matchMedia(NARROW_VIEWPORT).matches,
    // A server has no viewport. `false` means a server-rendered Creator is the wide one,
    // which is the right guess to be wrong about: the wide layout is what the stylesheet
    // renders without JavaScript, so the two agree until the browser says otherwise.
    () => false,
  );
}

/**
 * The width below which three columns stop fitting.
 *
 * **Duplicated in `@kajay/themes`**, deliberately and unhappily. The stylesheet cannot tell
 * this file a number and this file cannot reach into the stylesheet, so the alternative is
 * a CSS custom property read back through `getComputedStyle` on every render — which makes
 * the assembly depend on a stylesheet it is otherwise free of, and breaks entirely for a
 * host who ships their own. Two numbers that must agree, each with a comment pointing at
 * the other, is the smaller cost.
 */
const NARROW_VIEWPORT = '(width < 60rem)';
