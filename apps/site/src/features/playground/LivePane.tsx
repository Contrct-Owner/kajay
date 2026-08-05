import type { CreatorWorkspace } from '@kajay/creator-core';
import { Survey } from '@kajay/react';
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
        <div className="min-w-0 p-5" data-testid="live-survey">
          <Survey key={session.run} model={session.survey} components={KAJAY_SURVEY_COMPONENTS} />
        </div>
      </div>
    </section>
  );
}
