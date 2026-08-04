import { createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { DocsShell, docsHomePage } from '@/features/docs-shell';

export const Route = createFileRoute('/docs')({
  component: DocsHome,
  head: () => ({ meta: [{ title: 'Documentation — Kajay' }] }),
});

function DocsHome(): ReactElement {
  return <DocsShell page={docsHomePage} pages={[docsHomePage]} />;
}

