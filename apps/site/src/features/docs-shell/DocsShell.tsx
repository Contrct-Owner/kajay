import type { ReactElement, ReactNode } from 'react';
import type { DocPageDefinition } from './DocPageDefinition';
import { DocsArticle } from './DocsArticle';
import { DocsHeader } from './DocsHeader';
import { DocsNavigation, MobileDocsNavigation } from './DocsNavigation';
import { DocsTableOfContents } from './DocsTableOfContents';
import { createDocsNavigation } from './createDocsNavigation';

interface DocsShellProps {
  readonly page: DocPageDefinition;
  readonly pages: readonly DocPageDefinition[];
  /** Reserved for search and future SDK/framework selectors. */
  readonly toolbar?: ReactNode;
}

export function DocsShell({ page, pages, toolbar }: DocsShellProps): ReactElement {
  const sections = createDocsNavigation(pages);
  const hasTableOfContents = page.toc !== undefined && page.toc.length > 0;
  const wideColumns = hasTableOfContents
    ? 'xl:grid-cols-[15rem_minmax(0,1fr)_13rem]'
    : 'xl:grid-cols-[15rem_minmax(0,1fr)]';

  return (
    <div className="min-h-svh">
      <a
        className="bg-background text-foreground fixed top-2 left-2 z-50 -translate-y-20 rounded-md border px-3 py-2 text-sm focus:translate-y-0"
        href="#documentation-content"
      >
        Skip to content
      </a>
      <DocsHeader toolbar={toolbar} />
      <div className={`mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 lg:py-10 ${wideColumns}`}>
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100svh-7rem)] overflow-y-auto pr-3">
            <DocsNavigation activeSlug={page.slug} sections={sections} />
          </div>
        </aside>
        <main className="min-w-0">
          <div className="mb-8">
            <MobileDocsNavigation activeSlug={page.slug} sections={sections} />
          </div>
          <DocsArticle page={page} />
        </main>
        {hasTableOfContents ? (
          <aside className="hidden xl:block">
            <div className="sticky top-24 max-h-[calc(100svh-7rem)] overflow-y-auto">
              <DocsTableOfContents items={page.toc ?? []} />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
