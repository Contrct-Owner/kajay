import type { Survey, SurveyState } from '@kajay/core';
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
 * Re-renders when conditional logic changes what is visible, editable or required.
 *
 * The model exposes a monotonic version rather than the visible set itself, because
 * `useSyncExternalStore` compares snapshots by identity — a freshly filtered array
 * would differ on every read and loop forever.
 */
export function useSurveyLogicState(survey: Survey): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onElementStateChanged.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): number => survey.logicVersion, [survey]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Re-renders when the respondent moves between pages.
 *
 * Separate from the logic-state subscription because navigation moves for reasons
 * logic knows nothing about — a next button, a `skip` trigger — and the two would
 * otherwise have to share a version counter that means neither thing clearly.
 */
export function useSurveyCurrentPageNo(survey: Survey): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onCurrentPageChanged.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): number => survey.currentPageNo, [survey]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Re-renders while a check that left the process is outstanding.
 *
 * Its own subscription rather than a flag on the logic channel: an out-of-process check
 * is not a change to the model, and folding it in would make `logicVersion` advance for
 * something no element's state depends on.
 */
export function useSurveyValidating(survey: Survey): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onValidatingChanged.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): boolean => survey.validation.isValidating, [survey]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Re-renders when the survey moves between loading, empty, running and completed.
 *
 * Supersedes watching completion alone: a renderer has to draw exactly one of four
 * things, and asking four booleans in sequence is how it ends up drawing a completed
 * page for a survey that is still loading.
 */
export function useSurveyStatus(survey: Survey): SurveyState {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      const stopState = survey.onStateChanged.add(onStoreChange);
      // Element state as well: a page becoming invisible can empty the survey, and
      // that transition is announced on the logic channel rather than this one.
      const stopLogic = survey.onElementStateChanged.add(onStoreChange);
      return () => {
        stopState();
        stopLogic();
      };
    },
    [survey],
  );
  const getSnapshot = useCallback((): SurveyState => survey.status.state, [survey]);
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
