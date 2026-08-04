import type { ReactElement } from 'react';
import type { DocPageDefinition } from './DocPageDefinition';

interface DocsArticleProps {
  readonly page: DocPageDefinition;
}

export function DocsArticle({ page }: DocsArticleProps): ReactElement {
  return (
    <article id="documentation-content" className="min-w-0 scroll-mt-20" tabIndex={-1}>
      <header className="border-border mb-10 border-b pb-8">
        <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span>{page.section}</span>
          <span aria-hidden="true">·</span>
          <span>{page.sdk === 'typescript' ? 'TypeScript SDK' : 'SDK neutral'}</span>
          {page.framework === 'neutral' ? null : (
            <>
              <span aria-hidden="true">·</span>
              <span>React</span>
            </>
          )}
          {page.audience === 'consumer' ? null : (
            <span className="border-border rounded-full border px-2 py-0.5 capitalize">
              {page.audience}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance break-words sm:text-4xl">
          {page.title}
        </h1>
        <p className="text-muted-foreground mt-4 max-w-3xl text-lg text-pretty">
          {page.description}
        </p>
      </header>
      <div className="docs-content">{page.content}</div>
    </article>
  );
}
