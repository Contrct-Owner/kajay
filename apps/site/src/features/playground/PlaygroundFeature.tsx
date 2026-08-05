import type { ReactElement } from 'react';
import { ClientOnly } from '@/components/ClientOnly';
import { PlaygroundWorkbench } from './PlaygroundWorkbench';

/**
 * Design on the left, the running survey on the right — checklist P3.
 *
 * Client-only, deliberately. A designer with an undo stack, a drag gesture and a selection
 * is not a document a server has anything true to say about — unlike the survey by itself,
 * which P1 made server-renderable and the marketing pages use.
 */
export function PlaygroundFeature({
  encodedDefinition,
}: {
  readonly encodedDefinition: string | undefined;
}): ReactElement {
  return (
    <main className="flex min-h-svh flex-col gap-4 p-6">
      <ClientOnly fallback={<p className="text-muted-foreground text-sm">Loading the playground…</p>}>
        <PlaygroundWorkbench encodedDefinition={encodedDefinition} />
      </ClientOnly>
    </main>
  );
}
