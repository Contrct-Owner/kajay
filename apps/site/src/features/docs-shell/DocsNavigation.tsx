import type { ReactElement } from 'react';
import type { DocsNavigationSection } from './createDocsNavigation';
import { docPageHref } from './createDocsNavigation';

interface DocsNavigationProps {
  readonly activeSlug: string;
  readonly sections: readonly DocsNavigationSection[];
}

export function DocsNavigation({ activeSlug, sections }: DocsNavigationProps): ReactElement {
  return (
    <nav aria-label="Documentation">
      <DocsNavigationLinks activeSlug={activeSlug} sections={sections} />
    </nav>
  );
}

export function MobileDocsNavigation({
  activeSlug,
  sections,
}: DocsNavigationProps): ReactElement {
  return (
    <details className="border-border bg-muted/30 rounded-lg border lg:hidden">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        Browse documentation
      </summary>
      <nav aria-label="Mobile documentation" className="border-border border-t px-4 py-4">
        <DocsNavigationLinks activeSlug={activeSlug} sections={sections} />
      </nav>
    </details>
  );
}

function DocsNavigationLinks({ activeSlug, sections }: DocsNavigationProps): ReactElement {
  return (
    <div className="space-y-7">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            {section.title}
          </h2>
          <ul className="space-y-1">
            {section.pages.map((page) => {
              const isActive = page.slug === activeSlug;
              return (
                <li key={page.slug}>
                  <a
                    aria-current={isActive ? 'page' : undefined}
                    className={
                      isActive
                        ? 'bg-accent text-accent-foreground block rounded-md px-3 py-2 text-sm font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground block rounded-md px-3 py-2 text-sm'
                    }
                    href={docPageHref(page)}
                  >
                    {page.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

