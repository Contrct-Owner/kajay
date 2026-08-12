import type { SurveyDefinition } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { EditorMode } from './EditorMode';
import { ModeSwitch } from './ModeSwitch';
import { shareLink } from './playgroundDocument';

/**
 * Title, instructions, view switch and session controls — three rows with fixed roles.
 *
 * **Rows rather than one wrapping flex line**, which is what this was and what made it
 * unpredictable: a single `flex-wrap` row lets the browser decide what ends up beside what,
 * so the same markup put the mode switch next to "Copy share link" at one width and next to
 * the theme toggle at another. Where a control sits is a decision this file should be
 * making, not an outcome of how much room happened to be left.
 *
 * The arrangement is the same at every width, so there is no breakpoint here to get wrong.
 * It costs a desktop reader two rows it used to fit on one; that is the price of the
 * positions being fixed, and the header is three short rows rather than a panel.
 */
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
    <header className="flex flex-col gap-2">
      {/* The page's identity and the reader's own preference. Appearance belongs up here
          rather than beside the document controls below: it is a preference about the
          whole site that happens to be adjustable from this page, not something you do to
          the survey — and top-right is where a reader already looks for it. */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
        <ThemeToggle />
      </div>

      <p className="text-muted-foreground text-sm">
        Click a question type to add it — it appears on the right instantly. Nothing is saved.
      </p>

      {/* What you are looking at, and what you can take away with you. `justify-between`
          rather than an `ml-auto` spacer, so each end holds its own edge: the switch cannot
          drift right when the button's label grows from "Copy share link" to "Link copied".
          It wraps, because two controls plus a phone's ~327px content box is close enough
          that a longer label in another language would otherwise overflow. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
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
      </div>
    </header>
  );
}
