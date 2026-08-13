import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { PLAYGROUND_EXAMPLES, type PlaygroundExample } from './playgroundExamples';

/**
 * Definitions a visitor can load, in one place.
 *
 * **Opt-in rather than the starter document.** What every visitor lands on is also what
 * the drag-and-drop scenarios measure, so a feature that needs an example brings its own
 * and says what it is for.
 */
export function ExamplesPanel({
  onLoad,
}: {
  readonly onLoad: (example: PlaygroundExample) => void;
}): ReactElement {
  return (
    <details className="bg-card ring-border min-w-0 overflow-hidden rounded-xl shadow-sm ring-1">
      <summary className="bg-muted/40 text-muted-foreground cursor-pointer px-4 py-2 text-xs font-medium tracking-wide uppercase">
        Examples — load one into the designer
      </summary>
      {/* Closed by default, and that is not only tidiness. The playground's page height is
          load-bearing: the drag-and-drop scenarios reach across the canvas with a synthetic
          pointer, and an always-open panel put the drop target beyond their reach in
          Firefox. Examples are secondary to the document anyway. */}
      <div className="flex min-w-0 flex-wrap gap-2 p-4">
        {PLAYGROUND_EXAMPLES.map((example) => (
          <Button
            key={example.id}
            size="sm"
            variant="secondary"
            title={example.summary}
            data-testid={`load-example-${example.id}`}
            onClick={() => {
              onLoad(example);
            }}
          >
            {example.title}
          </Button>
        ))}
      </div>
    </details>
  );
}
