import type { DocPageDefinition } from '@/features/docs-shell';
import { docsHomePage } from '@/features/docs-shell';
import { runtimeDocPages, ExpressionEvaluator } from '@/features/runtime-docs';
import { creatorDocPages } from '@/features/creator-docs';
import { consumerGuidePages } from '@/features/consumer-guides';
import { dotnetDocPages } from '@/features/dotnet-docs';
import { createReferencePageRegistry } from '@/features/reference-docs';

const referencePages = createReferencePageRegistry(undefined, {
  expressionLanguageEvaluator: <ExpressionEvaluator />,
});

const navigationPages = [
  docsHomePage,
  ...runtimeDocPages,
  ...dotnetDocPages,
  ...creatorDocPages,
  ...consumerGuidePages,
  ...referencePages.navigationPages,
] satisfies readonly DocPageDefinition[];

function uniquePages(pages: readonly DocPageDefinition[]): readonly DocPageDefinition[] {
  const seen = new Set<string>();
  for (const page of pages) {
    if (seen.has(page.slug)) {
      throw new Error(`Duplicate documentation slug: "${page.slug}".`);
    }
    seen.add(page.slug);
  }
  return pages;
}

const pages = uniquePages(navigationPages);
const authoredBySlug = new Map(pages.map((page) => [page.slug, page]));

export interface DocsCatalog {
  readonly navigationPages: readonly DocPageDefinition[];
  readonly resolve: (slug: string) => DocPageDefinition | undefined;
}

export const docsCatalog: DocsCatalog = {
  navigationPages: pages,
  resolve(slug) {
    return authoredBySlug.get(slug) ?? referencePages.resolve(slug);
  },
};
