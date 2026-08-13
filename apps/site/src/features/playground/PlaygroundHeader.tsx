import type { SurveyDefinition } from '@kajay/core';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { EditorMode } from './EditorMode';
import { ModeSwitch } from './ModeSwitch';
import type { SwitchMode } from './ModeSwitch';
import { shareLink } from './playgroundDocument';

/** The document, and the JSON behind it. */
const EDITOR_MODES: readonly SwitchMode<EditorMode>[] = [
  { value: 'design', label: 'Design', testId: 'editor-mode-design' },
  { value: 'json', label: 'JSON', testId: 'editor-mode-json' },
];

/**
 * Where you are, instructions, view switch and session controls — three rows with fixed
 * roles.
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
      <TitleRow />

      <p className="text-muted-foreground text-sm">
        Click a question type to add it — it appears on the right instantly. Nothing is saved.
      </p>

      {/* What you are looking at, and what you can take away with you. `justify-between`
          rather than an `ml-auto` spacer, so each end holds its own edge: the switch cannot
          drift right when the button's label grows from "Copy share link" to "Link copied".
          It wraps, because two controls plus a phone's ~327px content box is close enough
          that a longer label in another language would otherwise overflow. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ModeSwitch
          label="Definition view"
          modes={EDITOR_MODES}
          mode={mode}
          onModeChange={onModeChange}
        />
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

/**
 * Where you are, how you leave, and the reader's own preference.
 *
 * **The title row carries the way out**, which is the whole point of it: the playground was
 * the one route on the site with no route off it. Docs has `Kajay / Docs` and the landing
 * page has its own bar; somebody who opened a shared playground link had the browser's Back
 * button and nothing else — and a shared link is exactly how most people arrive, so Back
 * goes wherever they came from rather than into the site.
 *
 * Built into the row that already existed rather than added above it. A sticky site-wide bar
 * like the one Docs uses would be the obvious move and costs 4rem of height on every screen,
 * which is the height this header spent three commits getting back on a phone.
 */
function TitleRow(): ReactElement {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-baseline gap-2">
        <Link className="text-muted-foreground hover:text-foreground shrink-0 text-sm" to="/">
          Kajay
        </Link>
        <span className="text-muted-foreground shrink-0 text-sm" aria-hidden="true">
          /
        </span>
        {/* Still the page's `h1`. The crumb reads as one line, but the heading a screen
            reader announces is the page's own name rather than the site's. */}
        <h1 className="truncate text-2xl font-semibold tracking-tight">Playground</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Hidden on the narrowest screens, exactly as Docs hides its Playground link: two
            links, a 2xl title and a toggle do not fit a 327px content box, and the way home
            is the one that has to survive.
            Appearance stays beside it at every width: it is a preference about the whole
            site that happens to be adjustable from this page, and top-right is where a
            reader already looks for it. */}
        <Link
          className="text-muted-foreground hover:text-foreground hidden text-sm sm:inline"
          to="/docs"
        >
          Docs
        </Link>
        <ThemeToggle />
      </div>
    </div>
  );
}
