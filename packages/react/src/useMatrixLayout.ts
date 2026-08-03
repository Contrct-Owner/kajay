import type { MatrixLayout } from '@kajay/core';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * The width below which a table is asked to become a list.
 *
 * In `rem` so it moves with the reader's own font size: someone who has turned text up
 * runs out of horizontal room sooner, and a breakpoint in pixels would ignore that.
 */
const NARROW = '(max-width: 40rem)';

function subscribeToWidth(onChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {
      /* nothing to unsubscribe from */
    };
  }
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

function isNarrow(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(NARROW).matches;
}

/**
 * Which way a matrix should draw itself — checklist F6.
 *
 * `auto` asks the screen, through a real media query rather than a class the page might
 * or might not have a stylesheet for: this library ships no CSS, so a hook that only
 * added a class name would be a feature nobody could see. Subscribed rather than read
 * once, because a window gets resized and a tablet gets rotated.
 *
 * On the server there is no screen to ask, so `auto` renders the table — the layout that
 * degrades to a horizontal scroll rather than to the wrong thing.
 */
export function useMatrixLayout(mode: MatrixLayout): 'table' | 'list' {
  const narrow = useSyncExternalStore(
    subscribeToWidth,
    isNarrow,
    // The server snapshot: no window, so not narrow.
    useCallback(() => false, []),
  );
  if (mode !== 'auto') {
    return mode;
  }
  return narrow ? 'list' : 'table';
}
