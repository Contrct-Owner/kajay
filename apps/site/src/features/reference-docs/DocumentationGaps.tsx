import type { ReactElement } from 'react';
import type { DocumentationGap } from '../docs-reference';

interface DocumentationGapsProps {
  readonly gaps: readonly DocumentationGap[];
}

const GAP_LABELS: Readonly<Record<DocumentationGap, string>> = {
  classification: 'audience classification',
  description: 'consumer description',
  example: 'tested example',
  signature: 'published signature',
};

/** Makes incomplete generated facts visible instead of filling them with inferred prose. */
export function DocumentationGaps({ gaps }: DocumentationGapsProps): ReactElement | null {
  if (gaps.length === 0) {
    return null;
  }
  return (
    <aside className="border-border bg-muted/40 rounded-lg border p-4" aria-label="Reference gaps" role="note">
      <p className="m-0 text-sm font-medium">Preview reference gap</p>
      <p className="text-muted-foreground mt-1 mb-0 text-sm">
        The authoritative source does not provide: {gaps.map((gap) => GAP_LABELS[gap]).join(', ')}.
      </p>
    </aside>
  );
}
