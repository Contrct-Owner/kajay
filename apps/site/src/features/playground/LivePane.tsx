import type { Survey as SurveyModel } from '@kajay/core';
import type { CreatorWorkspace } from '@kajay/creator-core';
import { Survey } from '@kajay/react';
import { useCallback, useState, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { KAJAY_SURVEY_COMPONENTS } from '@/kajay/surveyComponents';
import { ModeSwitch } from './ModeSwitch';
import type { SwitchMode } from './ModeSwitch';

/** The form a respondent fills in, and the response it produces. */
type LiveView = 'answer' | 'json';

const LIVE_VIEWS: readonly SwitchMode<LiveView>[] = [
  { value: 'answer', label: 'Answer', testId: 'live-mode-answer' },
  { value: 'json', label: 'JSON', testId: 'live-mode-json' },
];

/**
 * A real Survey over the Creator preview session. The preview owns an independent model,
 * so respondent answers never reach the definition, and its run number remounts the
 * survey when a visitor restarts it.
 */
export function LivePane({
  workspace,
  onRestart,
}: {
  readonly workspace: CreatorWorkspace;
  readonly onRestart: () => void;
}): ReactElement {
  const session = workspace.preview;
  const [view, setView] = useState<LiveView>('answer');

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Live survey">
      <div className="bg-card ring-border min-w-0 overflow-hidden rounded-xl shadow-sm ring-1">
        <div className="bg-muted/40 border-border flex items-center gap-2 border-b px-4 py-2">
          <span className="bg-primary size-2 shrink-0 rounded-full" aria-hidden />
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Live — answer it as a respondent would
          </p>
          <div className="ml-auto flex items-center gap-2">
            <ModeSwitch
              label="Response view"
              modes={LIVE_VIEWS}
              mode={view}
              onModeChange={setView}
            />
            <Button size="sm" variant="ghost" data-testid="live-restart" onClick={onRestart}>
              Restart
            </Button>
          </div>
        </div>
        <ChoiceProblems survey={session.survey} />
        {/* Both are mounted, and only one is shown. The answers live in the model rather
            than in the DOM, so unmounting would not lose them — but a half-typed field
            would lose its caret, its selection and its scroll position, which is exactly
            what somebody switching over to check the JSON is in the middle of. */}
        <div className={view === 'answer' ? 'min-w-0 p-5' : 'hidden'} data-testid="live-survey">
          <Survey key={session.run} model={session.survey} components={KAJAY_SURVEY_COMPONENTS} />
        </div>
        {view === 'json' ? <ResponseJson survey={session.survey} /> : null}
      </div>
    </section>
  );
}

/**
 * The response as a host would receive it — checklist P3.
 *
 * The definition has had a JSON view since the playground existed; the *answer* had none,
 * so the one thing a visitor is actually building towards — what my application gets when
 * somebody fills this in — was the one thing they could not see.
 *
 * `data` rather than the durable snapshot: this is the shape a host posts to its own
 * backend, and a nested blank or a matrix row reads here exactly as it would there. It is
 * read-only, because an answer is something a respondent gives rather than something a
 * visitor writes — the survey beside it is the way to change it.
 */
function ResponseJson({ survey }: { readonly survey: SurveyModel }): ReactElement {
  const json = useResponseJson(survey);
  return (
    <div className="min-w-0 p-5">
      <pre
        className="border-border bg-muted/35 min-w-0 overflow-x-auto rounded-lg border p-4 text-sm leading-6"
        data-testid="live-response-json"
      >
        <code>{json}</code>
      </pre>
    </div>
  );
}

/**
 * The response, re-read whenever an answer moves.
 *
 * **The snapshot is the JSON text**, not `survey.data`: that getter builds a fresh object
 * every call, so `useSyncExternalStore` would see a new snapshot on every render and loop.
 * A string compares by value, which is the same reason `useChoiceErrorCount` snapshots a
 * count rather than the array it counts.
 */
function useResponseJson(survey: SurveyModel): string {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onValueChanged.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): string => JSON.stringify(survey.data, null, 2), [survey]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Why a question's choices are missing, when they are.
 *
 * **The failure this exists for used to be completely silent.** A URL that cannot load
 * leaves an empty dropdown, which looks exactly like one still loading and exactly like
 * one authored with no choices — so the first question anybody asks is "why isn't this
 * working", with nothing on screen to answer it. `choiceErrors` always held the answer;
 * nothing rendered it.
 *
 * Deduplicated because the list accumulates: a URL built from an answer is retried
 * whenever that answer changes, and a reader does not need to be told five times that one
 * endpoint is unreachable.
 */
function ChoiceProblems({ survey }: { readonly survey: SurveyModel }): ReactElement | null {
  useChoiceErrorCount(survey);
  const problems = [...new Set(survey.choiceErrors)];
  if (problems.length === 0) {
    return null;
  }

  return (
    <div
      // Polite rather than assertive: this arrives while somebody is reading or typing,
      // and it is information about the survey rather than about what they just did.
      role="status"
      className="border-border bg-destructive/10 text-destructive border-b px-4 py-3 text-sm"
      data-testid="live-choice-errors"
    >
      <p className="font-medium">Some choices could not be loaded.</p>
      <ul className="mt-1 list-disc space-y-1 ps-5">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Re-renders when a choice load fails.
 *
 * Not `usePreviewVersion`: that watches the *session* — the device, the run, whether it is
 * stale — and says so, deliberately excluding what happens inside the survey. A choice
 * error happens inside the survey, so it needs the survey's own channel. `<Survey>`
 * subscribes to the same one to redraw the question; this is the panel beside it.
 *
 * **The snapshot is the count, not the array.** `choiceErrors` is appended to in place, so
 * its identity never changes and a snapshot returning it would compare equal forever —
 * `useSyncExternalStore` would subscribe faithfully and re-render never.
 */
function useChoiceErrorCount(survey: SurveyModel): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => survey.onElementStateChanged.add(onStoreChange),
    [survey],
  );
  const getSnapshot = useCallback((): number => survey.choiceErrors.length, [survey]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
