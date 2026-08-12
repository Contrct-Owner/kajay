import type { SurveyDefinition } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { EditorMode } from './EditorMode';
import { ModeSwitch } from './ModeSwitch';
import { shareLink } from './playgroundDocument';

/** Title, instructions, view switch and session controls in one row. */
export function PlaygroundHeader({
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
      <p className="text-muted-foreground text-sm">
        Click a question type to add it — it appears on the right instantly. Nothing is saved.
      </p>
      {/* Wraps, like the header around it. Three controls side by side measure ~356px and
          a phone's content box is ~327px, so without this the row ran off the right edge
          and took the page's horizontal scrollbar with it — the theme toggle was half
          off-screen at 375px. The `header` was already `flex-wrap`; this row was not, so
          it wrapped as one block and then overflowed as one block. */}
      <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
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
