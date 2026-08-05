import { createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { PlaygroundFeature } from '@/features/playground';

export const Route = createFileRoute('/playground')({
  component: PlaygroundRoute,
  validateSearch: (search: Record<string, unknown>): { readonly d?: string } => {
    const value = search.d;
    return typeof value === 'string' ? { d: value } : {};
  },
});

/** Route composition only; the feature owns the document and its behavior. */
function PlaygroundRoute(): ReactElement {
  const { d } = Route.useSearch();
  return <PlaygroundFeature encodedDefinition={d} />;
}
