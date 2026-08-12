import type { Survey as SurveyModel } from '@kajay/core';
import type { CreatorWorkspace } from '@kajay/creator-core';
import { Survey } from '@kajay/react';
import { useCallback, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { KAJAY_SURVEY_COMPONENTS } from '@/kajay/surveyComponents';

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

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Live survey">
      <div className="bg-card ring-border min-w-0 overflow-hidden rounded-xl shadow-sm ring-1">
        <div className="bg-muted/40 border-border flex items-center gap-2 border-b px-4 py-2">
          <span className="bg-primary size-2 shrink-0 rounded-full" aria-hidden />
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Live — answer it as a respondent would
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            data-testid="live-restart"
            onClick={onRestart}
          >
            Restart
          </Button>
        </div>
        <ChoiceProblems survey={session.survey} />
        <div className="min-w-0 p-5" data-testid="live-survey">
          <Survey key={session.run} model={session.survey} components={KAJAY_SURVEY_COMPONENTS} />
        </div>
      </div>
    </section>
  );
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
