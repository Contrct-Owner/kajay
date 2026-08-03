import type { DesignSurface } from '@kajay/creator-core';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Re-renders when the surface changes: the selection, a title, the tree, the page.
 *
 * `useSyncExternalStore` over the model's own event, the same integration the renderer
 * uses: the model owns the state and React only reads it. The snapshot is the version
 * counter rather than anything the view draws, because what a view reads is rebuilt on
 * every access and a subscriber comparing snapshots by identity would never settle.
 *
 * Shared, so that every piece looking at one surface re-renders on the same signal. Two
 * copies of this would be two chances to subscribe to the wrong thing.
 */
export function useSurfaceVersion(surface: DesignSurface): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => surface.onChanged.add(onStoreChange),
    [surface],
  );
  const getSnapshot = useCallback((): number => surface.version, [surface]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
