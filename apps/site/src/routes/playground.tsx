import type { SurveyDefinition } from '@kajay/core';
import { CreatorComponentsProvider, useCreatorWorkspace, usePreviewVersion } from '@kajay/creator-react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { ClientOnly } from '@/components/ClientOnly';
import { ThemeToggle } from '@/components/ThemeToggle';
import { KAJAY_CREATOR_COMPONENTS } from '@/kajay/creatorComponents';
import { EditorPane, LivePane } from '@/playground/PlaygroundPanes';
import type { EditorMode } from '@/playground/PlaygroundPanes';
import { DEFINITION_PARAM, decodeDefinition, shareLink } from '@/playground/usePlaygroundDocument';
import { CreatorNotices } from '@kajay/creator-react';

export const Route = createFileRoute('/playground')({
  component: Playground,
  validateSearch: (search: Record<string, unknown>): { readonly d?: string } => {
    const value = search[DEFINITION_PARAM];
    return typeof value === 'string' ? { d: value } : {};
  },
});

const STARTER: SurveyDefinition = {
  title: 'Customer feedback',
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'name', title: 'What is your name?' },
        {
          type: 'radiogroup',
          name: 'rating',
          title: 'How was it?',
          choices: ['Great', 'Fine', 'Poor'],
        },
        { type: 'comment', name: 'notes', title: 'Anything else?' },
      ],
    },
  ],
};

/**
 * Design on the left, the running survey on the right — checklist P3.
 *
 * **The two panes are one document.** The designer, the JSON editor and the live survey all
 * come off a single `CreatorWorkspace`, so a question dragged onto the canvas is answerable
 * on the right without anything being wired between them: M3's preview session already
 * watches the surface, and it parses its own survey so answers can never reach the thing
 * being designed.
 *
 * Client-only, deliberately. A designer with an undo stack, a drag gesture and a selection
 * is not a document a server has anything true to say about — unlike the survey by itself,
 * which P1 made server-renderable and the marketing pages use.
 */
function Playground(): ReactElement {
  return (
    <main className="flex min-h-svh flex-col gap-4 p-6">
      <ClientOnly fallback={<p className="text-muted-foreground text-sm">Loading the playground…</p>}>
        <Workbench />
      </ClientOnly>
    </main>
  );
}

function Workbench(): ReactElement {
  const { d } = Route.useSearch();
  // Read once: a share link is where the document *came from*, not a binding. Re-reading
  // would fight every edit, and writing on every keystroke would fill the history with a
  // hundred entries nobody wants to walk back through.
  const [opened] = useState<SurveyDefinition>(() => decodeDefinition(d) ?? STARTER);
  const workspace = useCreatorWorkspace({ definition: opened });
  const [mode, setMode] = useState<EditorMode>('design');
  usePreviewVersion(workspace.preview);

  return (
    <CreatorComponentsProvider components={KAJAY_CREATOR_COMPONENTS}>
      <PlaygroundHeader
        definition={workspace.surface.definition}
        mode={mode}
        onModeChange={setMode}
      />
      {/*
        **The library announces what it did unasked; this renders it** — ADR-0023 and P6.
        It was built and then dropped on the floor here, so the application demonstrating
        the principle was the one place staying silent: a paste that renumbered two names,
        a conversion that dropped a setting. Above the panes rather than inside one, because
        an edit made on the canvas can just as easily have come from the JSON.
      */}
      <CreatorNotices surface={workspace.surface} />
      {/*
        Not an even split. The editor holds a canvas, a toolbox and a property grid; the
        live pane holds one survey at the width a respondent reads it. Giving them equal
        room makes the canvas the most cramped thing on a page about designing.
      */}
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <EditorPane workspace={workspace} mode={mode} />
        <LivePane
          workspace={workspace}
          onRestart={() => {
            workspace.preview.restart();
          }}
        />
      </div>
    </CreatorComponentsProvider>
  );
}

/**
 * Title, what to do, the view switch, and the two session controls — one row.
 *
 * **It was four rows.** Title, a stranded share button, the Design/JSON pair and the
 * canvas toolbar all stacked before any survey appeared, which on a laptop put the thing
 * the page exists to show below the fold. For a *demonstration* — and that is this page's
 * job, not a workbench's — that is close to fatal.
 *
 * The share button used to wrap onto its own line because it sat *after* the `ml-auto`
 * span rather than inside it. A layout artefact rather than a decision, and visible as a
 * button floating alone under the title.
 */
function PlaygroundHeader({
  definition,
  mode,
  onModeChange,
}: {
  readonly definition: SurveyDefinition;
  readonly mode: EditorMode;
  readonly onModeChange: (mode: EditorMode) => void;
}): ReactElement {
  const [copied, setCopied] = useState(false);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
      {/*
        **An instruction, not a description.** "Design on the left, answer it on the right"
        told a visitor what they were looking at and left the most important fact unsaid —
        that clicking a type in the toolbox is how anything happens at all. Nobody arrives
        knowing that, and a demonstration nobody can start is a screenshot.
      */}
      <p className="text-muted-foreground text-sm">
        Click a question type to add it — it appears on the right instantly. Nothing is saved.
      </p>
      <span className="ml-auto flex items-center gap-2">
        <ModeSwitch mode={mode} onModeChange={onModeChange} />
        <Button
          size="sm"
          variant="outline"
          data-testid="share-link"
          onClick={() => {
            const link = shareLink(definition, globalThis.location.origin, '/playground');
            globalThis.history.replaceState(undefined, '', link);
            void globalThis.navigator.clipboard?.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? 'Link copied' : 'Copy share link'}
        </Button>
        <ThemeToggle />
      </span>
    </header>
  );
}

/**
 * Design or JSON — one control, not two buttons.
 *
 * They are two views of *one document*, which is the claim this whole page is making, and
 * two separately-outlined buttons said the opposite. A shared track with the active segment
 * raised reads as a switch between views.
 *
 * **Still `aria-current` rather than `role="tablist"`.** K4 and N1 both made this call: a
 * tablist promises arrow-key navigation between the tabs, and a control that claims the
 * role without the keyboard contract is worse for a screen-reader user than one that never
 * claimed it. Styling it as a segmented control changes what it looks like, not what it
 * promises.
 */
function ModeSwitch({
  mode,
  onModeChange,
}: {
  readonly mode: EditorMode;
  readonly onModeChange: (mode: EditorMode) => void;
}): ReactElement {
  return (
    <div className="bg-muted inline-flex items-center rounded-md p-0.5">
      {(['design', 'json'] as const).map((name) => (
        <Button
          key={name}
          size="sm"
          variant={mode === name ? 'default' : 'ghost'}
          className={mode === name ? '' : 'text-muted-foreground'}
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
  );
}
