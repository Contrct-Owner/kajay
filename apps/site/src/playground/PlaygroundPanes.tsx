import type { CreatorWorkspace } from '@kajay/creator-core';
import {
  DesignSurfacePanel,
  JsonEditorPanel,
  PropertyGridPanel,
  ToolboxPanel,
  useDesignerPlacement,
} from '@kajay/creator-react';
import { Survey } from '@kajay/react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { KAJAY_SURVEY_COMPONENTS } from '@/kajay/surveyComponents';

export type EditorMode = 'design' | 'json';

/**
 * The left pane: the designer, or the JSON, over the same document.
 *
 * **Assembled from pieces rather than from `<SurveyCreator>`**, and that is the point of
 * putting it here. [ADR-0021](../../../../docs/adr/0021-creator-composition.md) claims the
 * Creator is "pieces with a default assembly on top", and that the assembly gets no
 * privileged access. A layout the default assembly does not offer — a designer *beside* a
 * live survey rather than one tab away from a preview — is the only way to find out whether
 * that is true. It is: everything below is a public export taking a public model.
 *
 * The designer and the JSON share one `workspace`, so switching between them is switching a
 * view rather than handing a document across. Editing JSON and switching back shows the
 * change on the canvas because M2's session applies through the same surface K6's undo
 * stack wraps.
 */
export function EditorPane({
  workspace,
  mode,
  onModeChange,
}: {
  readonly workspace: CreatorWorkspace;
  readonly mode: EditorMode;
  readonly onModeChange: (mode: EditorMode) => void;
}): ReactElement {
  const placement = useDesignerPlacement(workspace.surface);

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Editor">
      <div className="flex items-center gap-2">
        {(['design', 'json'] as const).map((name) => (
          <Button
            key={name}
            size="sm"
            variant={mode === name ? 'default' : 'outline'}
            data-testid={`editor-mode-${name}`}
            aria-current={mode === name ? 'page' : undefined}
            onClick={() => {
              onModeChange(name);
            }}
          >
            {name === 'design' ? 'Design' : 'JSON'}
          </Button>
        ))}
      </div>
      {mode === 'design' ? (
        <div className="grid min-w-0 grid-cols-[10rem_minmax(0,1fr)_14rem] gap-3">
          <ToolboxPanel toolbox={workspace.toolbox} getItemProps={placement.getItemProps} />
          <DesignSurfacePanel surface={workspace.surface} placement={placement} />
          <PropertyGridPanel surface={workspace.surface} />
        </div>
      ) : (
        <JsonEditorPanel session={workspace.json} />
      )}
    </section>
  );
}

/**
 * The right pane: the survey as a respondent gets it, answerable, updating as you design.
 *
 * **A real `<Survey>` over M3's preview session**, not a second parse of our own. The
 * session already owns what is hard here — its own model so answers never reach the
 * document, a run counter so restarting is a remount rather than a reset, and staleness
 * so "the design changed under this run" is a fact rather than a guess.
 *
 * `key={session.run}` is what makes Restart mean restart: a survey mid-completion has
 * answers, a current page and a status, and the honest way to begin again is a new
 * component rather than a sequence of setters.
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
      <div className="flex items-center gap-2">
        <p className="text-muted-foreground text-sm">Live — answer it as a respondent would.</p>
        <Button size="sm" variant="outline" data-testid="live-restart" onClick={onRestart}>
          Restart
        </Button>
      </div>
      <div className="border-border min-w-0 rounded-lg border p-4" data-testid="live-survey">
        <Survey
          key={session.run}
          model={session.survey}
          components={KAJAY_SURVEY_COMPONENTS}
        />
      </div>
    </section>
  );
}
