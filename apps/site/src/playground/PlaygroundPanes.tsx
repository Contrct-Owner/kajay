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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { DesignerToolbar } from './DesignerToolbar';
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
 * **The switch that chooses between them is in the page header**, not here: it is one of
 * four control rows this page used to stack above any content, and on a laptop that put the
 * survey below the fold. A pane should not own the control that decides whether it is the
 * pane on screen.
 *
 * The designer and the JSON share one `workspace`, so switching between them is switching a
 * view rather than handing a document across. Editing JSON and switching back shows the
 * change on the canvas because M2's session applies through the same surface K6's undo
 * stack wraps.
 */
export function EditorPane({
  workspace,
  mode,
}: {
  readonly workspace: CreatorWorkspace;
  readonly mode: EditorMode;
}): ReactElement {
  const placement = useDesignerPlacement(workspace.surface);

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Editor">
      {mode === 'design' ? (
        // **The canvas takes the width; the two side panels stack.** A toolbox is read
        // top-to-bottom and a property grid is a column of labelled fields — neither wants
        // horizontal room, and the canvas wants all of it, because what is on it is the
        // survey at the width a respondent will see.
        <DesignerLayout workspace={workspace} placement={placement} />
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

/**
 * The canvas, and the two panels beside it.
 *
 * Its own component for the file's function-length limit, and it reads better for it: the
 * pane above is about *which* editor is showing, this is about how the designer is laid out.
 *
 * **`items-start` matters more than it looks.** Without it the canvas column stretches to
 * the sidebar's height, and the designer's own element grid then spreads that slack across
 * its rows — which reads as huge gaps between questions and looks like a defect in the
 * library rather than in this layout. It was one, briefly.
 */
function DesignerLayout({
  workspace,
  placement,
}: {
  readonly workspace: CreatorWorkspace;
  readonly placement: ReturnType<typeof useDesignerPlacement>;
}): ReactElement {
  return (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_15rem] items-start gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            {/*
              **One row above the canvas.** Undo, redo and the pages are all about the
              document rather than about any element on it, so they read as one control
              strip rather than two stacked panels — see `DesignerToolbar` for why the
              library's own `HistoryPanel` is not what draws them here.
            */}
            <DesignerToolbar workspace={workspace} placement={placement} />
            <DesignSurfacePanel surface={workspace.surface} placement={placement} />
          </div>
          {/*
            **Its own scroll container, and sticky.** The properties of a question near the
            bottom of a long survey used to be reachable only by scrolling the whole page —
            which scrolled the canvas away, so a designer was editing something they could
            no longer see. The canvas scrolls with the page; this column scrolls by itself.
          */}
          <Accordion
            type="multiple"
            // Both open by default, and `multiple` rather than `single` because these are
            // not alternatives: a designer drags from the toolbox *and* reads the grid, and
            // a panel that closed the other every time would be a worse toolbox than a
            // list. Collapsing is for reclaiming height on a laptop, not for choosing.
            defaultValue={['toolbox', 'properties']}
            className="sticky top-4 max-h-[calc(100svh-2rem)] min-w-0 overflow-y-auto pr-1"
          >
            <AccordionItem value="toolbox">
              <AccordionTrigger data-testid="pane-toolbox">Toolbox</AccordionTrigger>
              {/*
                No cap of its own any more. It had one so a long type list could not push
                Properties below the fold; now the column scrolls, so a nested scroller
                would be a second thing to drag past for no reason.
              */}
              <AccordionContent>
                <ToolboxPanel toolbox={workspace.toolbox} getItemProps={placement.getItemProps} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="properties">
              <AccordionTrigger data-testid="pane-properties">Properties</AccordionTrigger>
              <AccordionContent>
                <PropertyGridPanel surface={workspace.surface} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
  );
}

