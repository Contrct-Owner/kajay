import type { SurveyDefinition } from '@kajay/core';
import { SurveyCreator } from '@kajay/creator-react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { ClientOnly } from '@/components/ClientOnly';
import { KAJAY_CREATOR_COMPONENTS } from '@/kajay/creatorComponents';

export const Route = createFileRoute('/playground')({ component: Playground });

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
 * Slice 0's measurement, not slice 3's playground.
 *
 * The full three-pane layout — Creator and JSON editor beside a live renderer — is slice 3.
 * What this route is for right now is one question: with a real design system supplied
 * through `components`, does the Creator read as part of this application or as a guest in
 * it? That is worth looking at before committing to converting twenty-odd renderers.
 */
function Playground(): ReactElement {
  const [definition, setDefinition] = useState<SurveyDefinition>(STARTER);

  return (
    <main className="flex min-h-svh flex-col gap-4 p-6">
      <header className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
        <p className="text-muted-foreground text-sm">
          The Creator, drawn with this site&rsquo;s own shadcn components.
        </p>
      </header>
      <div className="border-border rounded-lg border p-4">
        <ClientOnly fallback={<p className="text-muted-foreground text-sm">Loading the designer…</p>}>
          <SurveyCreator
            value={definition}
            onChange={setDefinition}
            components={KAJAY_CREATOR_COMPONENTS}
          />
        </ClientOnly>
      </div>
    </main>
  );
}
