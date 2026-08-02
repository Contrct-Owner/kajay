import type { Survey } from '@kajay/core';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to one question's answer.
 *
 * `useSyncExternalStore` over the core event surface is the whole integration: core
 * owns the state, React only reads it. That is what keeps the renderer swappable —
 * another framework's adapter subscribes to the same events.
 */
export function useSurveyValue(survey: Survey, name: string): unknown {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onValueChanged.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): unknown => survey.getValue(name), [survey, name]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Re-renders when conditional logic changes what is visible.
 *
 * The model exposes a monotonic version rather than the visible set itself, because
 * `useSyncExternalStore` compares snapshots by identity — a freshly filtered array
 * would differ on every read and loop forever.
 */
export function useSurveyStructure(survey: Survey): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onVisibilityChanged.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): number => survey.structureVersion, [survey]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useSurveyCompleted(survey: Survey): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onComplete.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): boolean => survey.isCompleted, [survey]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
