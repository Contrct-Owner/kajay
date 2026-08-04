import type { Question, Survey, SurveyState } from '@kajay/core';
import { useCallback, useEffect, useReducer, useSyncExternalStore } from 'react';

/**
 * Subscribes to one question's answer.
 *
 * `useSyncExternalStore` over the core event surface is the whole integration: core
 * owns the state, React only reads it. That is what keeps the renderer swappable —
 * another framework's adapter subscribes to the same events.
 *
 * **Every hook in this file passes `getSnapshot` twice**, and the second one is the reason
 * a survey can be server-rendered at all. Without a server snapshot React does not warn —
 * it throws `Missing getServerSnapshot` and reverts the *entire page* to client rendering,
 * so a host on Next or TanStack Start gets a blank first paint, no indexable content, and
 * nothing that looks broken. The reference application found it the only way it could be
 * found: by putting a survey on a server-rendered route.
 *
 * The same function serves both because these snapshots are **already the same on both
 * sides**. Each reads synchronous state off a model built from the definition, and server
 * and client build that model from the same definition — so there is no client-only value
 * to diverge from, and nothing to hydrate around. Where that is *not* true the answer is a
 * different function, which is what `useMatrixLayout` does: a media query has no server
 * answer, so it states one.
 */
export function useSurveyValue(survey: Survey, name: string): unknown {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onValueChanged.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): unknown => survey.getValue(name), [survey, name]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribes to one question's answer, read through the question itself.
 *
 * The difference from `useSurveyValue` is where the answer is looked up. A matrix cell
 * is a question named for its column, and its answer lives inside the matrix's — so
 * asking the *survey* for a value called `quantity` returns nothing, and a controlled
 * input bound to that renders empty. It only looked right because React skips a DOM
 * write when the value it last rendered has not changed; the field went blank the first
 * time anything forced a real reconcile, which is how a row removal lost the row that
 * survived it.
 *
 * `question.value` goes through the question's own value host, which is the survey for
 * a question on a page and the matrix for a cell. One expression, right in both places.
 */
export function useQuestionValue(survey: Survey, question: Question): unknown {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onValueChanged.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): unknown => question.value, [question]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Re-renders on any answer change, without caring which.
 *
 * For the things that *measure* answers rather than showing one — the progress bar, and
 * the quiz score it can report. Until E8 needed a bar that counts correct answers,
 * nothing subscribed to this at all, and the question-counting bars silently held their
 * value until something else forced a render: `0 of 4 questions completed` for a page
 * the respondent had just filled in.
 *
 * Deliberately not `useSyncExternalStore`. That hook compares snapshots by identity and
 * the model has no answer *version* to hand it — `survey.data` builds a fresh object on
 * every read, which would re-render forever.
 *
 * Subscribed by the bar rather than by the form on purpose: the form would re-render
 * every question on the page on every keystroke to keep one number up to date.
 */
export function useSurveyAnswerChanges(survey: Survey): void {
  const [, bump] = useReducer((count: number): number => count + 1, 0);
  useEffect(() => survey.onValueChanged.add(bump), [survey, bump]);
}

/**
 * Re-renders when the survey switches language — checklist J1.
 *
 * Held by the survey root rather than by each question, because a locale switch changes
 * every string at once: subscribing per question would be a thousand listeners agreeing
 * on the same answer. It is the one change where re-rendering the whole survey is the
 * cheap option rather than the expensive one.
 */
export function useSurveyLocale(survey: Survey): string {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onLocaleChanged.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): string => survey.locale, [survey]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useSurveyCompleted(survey: Survey): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onComplete.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): boolean => survey.isCompleted, [survey]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
