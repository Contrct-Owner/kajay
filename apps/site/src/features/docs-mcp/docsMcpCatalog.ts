import {
  authoredDocsManifest,
  createDocumentationSearchIndex,
  docsReferenceManifest,
  queryDocumentationSearch,
  type DocumentationSearchResult,
} from '../docs-reference/index.js';

const KAJAY_ORIGIN = 'https://kajay.io';

const searchIndex = createDocumentationSearchIndex(
  docsReferenceManifest,
  authoredDocsManifest,
);

export interface KajayDocsSearchResult extends Omit<DocumentationSearchResult, 'url'> {
  readonly url: string;
}

function canonicalUrl(path: string): string {
  return new URL(path, KAJAY_ORIGIN).toString();
}

export function searchKajayDocs(
  query: string,
  limit: number,
): readonly KajayDocsSearchResult[] {
  return queryDocumentationSearch(searchIndex, query, limit).map((result) => ({
    id: result.id,
    kind: result.kind,
    title: result.title,
    description: result.description,
    url: canonicalUrl(result.url),
    group: result.group,
  }));
}

export function createDocsIndexMarkdown(): string {
  const guideList = authoredDocsManifest
    .map((page) => `- [${page.title}](${canonicalUrl(page.url)}): ${page.description}`)
    .join('\n');
  return [
    '# Kajay documentation',
    '',
    'Kajay is a multi-runtime survey engine with TypeScript, React, Creator, and native .NET SDK surfaces.',
    '',
    'Use the `search_kajay_docs` tool to search guides and generated reference facts.',
    'Read `kajay://docs/reference-manifest` for the complete machine-readable reference.',
    '',
    '## Authored guides',
    '',
    guideList,
  ].join('\n');
}

export function createReferenceManifestJson(): string {
  return JSON.stringify(docsReferenceManifest);
}
