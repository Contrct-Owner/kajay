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
      <PlaygroundHeader definition={workspace.surface.definition} />
      {/*
        Not an even split. The editor holds a canvas, a toolbox and a property grid; the
        live pane holds one survey at the width a respondent reads it. Giving them equal
        room makes the canvas the most cramped thing on a page about designing.
      */}
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <EditorPane workspace={workspace} mode={mode} onModeChange={setMode} />
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

/** The title, and the one button that turns this session into something you can send. */
function PlaygroundHeader({ definition }: { readonly definition: SurveyDefinition }): ReactElement {
  const [copied, setCopied] = useState(false);

  return (
    <header className="flex flex-wrap items-baseline gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
      <p className="text-muted-foreground text-sm">
        Design on the left, answer it on the right. Nothing is saved anywhere.
      </p>
      <span className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </span>
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
    </header>
  );
}
