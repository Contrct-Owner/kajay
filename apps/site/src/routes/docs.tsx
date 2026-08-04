import { createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { DocumentationPage } from '@/features/docs-catalog';

export const Route = createFileRoute('/docs')({
  component: DocsHome,
  head: () => ({ meta: [{ title: 'Documentation — Kajay' }] }),
});

function DocsHome(): ReactElement {
  return <DocumentationPage slug="" />;
}

