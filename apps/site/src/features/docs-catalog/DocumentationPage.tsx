import type { ReactElement } from 'react';
import type { DocPageDefinition } from '@/features/docs-shell';
import { DocsShell } from '@/features/docs-shell';
import { ReferenceSearch } from '@/features/reference-docs';
import { docsCatalog } from './docsCatalog';

interface DocumentationPageProps {
  readonly slug: string;
}

export function DocumentationPage({ slug }: DocumentationPageProps): ReactElement {
  const page = docsCatalog.resolve(slug) ?? notFoundPage(slug);
  return (
    <DocsShell
      page={page}
      pages={docsCatalog.navigationPages}
      toolbar={<ReferenceSearch pages={docsCatalog.navigationPages} />}
    />
  );
}

function notFoundPage(slug: string): DocPageDefinition {
  return {
    slug,
    title: 'Documentation page not found',
    description: 'This documentation route does not match a current Kajay guide or reference entry.',
    section: 'Help',
    status: 'preview',
    audience: 'consumer',
    sdk: 'neutral',
    framework: 'neutral',
    content: (
      <section aria-labelledby="docs-not-found" role="status">
        <h2 id="docs-not-found">Try another route</h2>
        <p>
          Check the documentation navigation or search for the concept, API, property, or
          diagnostic you need.
        </p>
        <p><a href="/docs">Return to documentation home</a></p>
      </section>
    ),
  };
}

