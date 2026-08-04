import { createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { DocumentationPage } from '@/features/docs-catalog';

export const Route = createFileRoute('/docs_/$')({ component: DocsCatchAll });

function DocsCatchAll(): ReactElement {
  const { _splat } = Route.useParams();
  return <DocumentationPage slug={_splat ?? ''} />;
}
