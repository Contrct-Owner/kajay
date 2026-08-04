import type { DocPageDefinition } from './DocPageDefinition';

export interface DocsNavigationSection {
  readonly title: string;
  readonly pages: readonly DocPageDefinition[];
}

/** Groups pages in declaration order so authored navigation remains intentional. */
export function createDocsNavigation(
  pages: readonly DocPageDefinition[],
): readonly DocsNavigationSection[] {
  const sections = new Map<string, DocPageDefinition[]>();

  for (const page of pages) {
    const existing = sections.get(page.section);
    if (existing === undefined) {
      sections.set(page.section, [page]);
    } else {
      existing.push(page);
    }
  }

  return Array.from(sections, ([title, sectionPages]) => ({ title, pages: sectionPages }));
}

export function docPageHref(page: Pick<DocPageDefinition, 'slug'>): string {
  return page.slug.length === 0 ? '/docs' : `/docs/${page.slug}`;
}

