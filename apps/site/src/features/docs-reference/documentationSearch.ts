import type { DocsReferenceManifest } from './docsReferenceTypes.js';

export type DocumentationSearchKind =
  | 'guide'
  | 'definition-type'
  | 'property'
  | 'diagnostic'
  | 'expression-operator'
  | 'expression-function'
  | 'api-symbol';

export interface AuthoredPageSearchRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly headings?: readonly string[];
  readonly keywords?: readonly string[];
}

export interface DocumentationSearchResult {
  readonly id: string;
  readonly kind: DocumentationSearchKind;
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly group: string;
}

interface SearchRecord extends DocumentationSearchResult {
  readonly searchText: string;
}

function normalized(value: string): string {
  return value
    .toLocaleLowerCase('en-US')
    .replaceAll(/[^a-z0-9@/._+\-!<>=&|^%*]+/gu, ' ')
    .trim();
}

function record(
  value: DocumentationSearchResult,
  aliases: readonly string[] = [],
): SearchRecord {
  return { ...value, searchText: normalized([value.title, value.description, ...aliases].join(' ')) };
}

function authoredRecord(page: AuthoredPageSearchRecord): SearchRecord {
  return record(
    {
      id: `guide:${page.id}`,
      kind: 'guide',
      title: page.title,
      description: page.description,
      url: page.url,
      group: 'Guides',
    },
    [...(page.headings ?? []), ...(page.keywords ?? [])],
  );
}

function definitionTypeRecords(manifest: DocsReferenceManifest): readonly SearchRecord[] {
  return manifest.definitionTypes.map((item) => record({
      id: `definition-type:${item.name}`,
      kind: 'definition-type',
      title: item.name,
      description: item.description ?? `${item.category} definition type`,
      url: item.url,
      group: 'Definition types',
    }, [item.parent ?? '', ...item.effectiveProperties.map(({ name }) => name)]));
}

function propertyRecords(manifest: DocsReferenceManifest): readonly SearchRecord[] {
  return manifest.definitionProperties.map((item) => {
    const summary = item.occurrences.find((occurrence) => occurrence.description !== null)?.description;
    return record({
      id: `property:${item.name}`,
      kind: 'property',
      title: item.name,
      description: summary ?? 'Survey definition property',
      url: item.url,
      group: 'Properties',
    }, [...item.declaredBy, ...item.availableOn]);
  });
}

function diagnosticRecords(manifest: DocsReferenceManifest): readonly SearchRecord[] {
  return manifest.diagnostics.map((item) => record({
      id: `diagnostic:${item.category}:${item.code}`,
      kind: 'diagnostic',
      title: item.code,
      description: item.description,
      url: item.url,
      group: 'Diagnostics',
    }, [item.category, item.phase ?? '', item.severity ?? '']));
}

function operatorRecords(manifest: DocsReferenceManifest): readonly SearchRecord[] {
  return manifest.expressionOperators.map((item) => record({
      id: `expression-operator:${item.kind}:${item.name}`,
      kind: 'expression-operator',
      title: item.name,
      description: item.description ?? `${item.kind} expression operator`,
      url: item.url,
      group: 'Expression operators',
    }, item.spellings));
}

function functionRecords(manifest: DocsReferenceManifest): readonly SearchRecord[] {
  return manifest.expressionFunctions.map((item) => record({
      id: `expression-function:${item.name}`,
      kind: 'expression-function',
      title: `${item.name}()`,
      description: item.description ?? `${item.category} expression function`,
      url: item.url,
      group: 'Expression functions',
    }, [item.category]));
}

function apiRecords(manifest: DocsReferenceManifest): readonly SearchRecord[] {
  return manifest.apiSymbols.map((item) => record({
      id: `api:${item.packageName}:${item.name}`,
      kind: 'api-symbol',
      title: item.name,
      description: item.description ?? `${item.exportKind} export from ${item.packageName}`,
      url: item.url,
      group: item.packageName,
    }, [item.packageName, item.classification, item.exportKind]));
}

/** Builds one deterministic, browser-local index from generated and authored records. */
export function createDocumentationSearchIndex(
  manifest: DocsReferenceManifest,
  authoredPages: readonly AuthoredPageSearchRecord[] = [],
): readonly SearchRecord[] {
  const records: SearchRecord[] = authoredPages.map((page) => authoredRecord(page));
  records.push(
    ...definitionTypeRecords(manifest),
    ...propertyRecords(manifest),
    ...diagnosticRecords(manifest),
    ...operatorRecords(manifest),
    ...functionRecords(manifest),
    ...apiRecords(manifest),
  );
  return records.toSorted((left, right) => left.title.localeCompare(right.title));
}

function score(searchText: string, title: string, terms: readonly string[]): number {
  const normalizedTitle = normalized(title);
  let total = 0;
  for (const term of terms) {
    if (!searchText.includes(term)) {
      return -1;
    }
    total += normalizedTitle === term ? 100 : normalizedTitle.startsWith(term) ? 50 : 10;
  }
  return total;
}

/** Queries a prebuilt index. All terms must match; exact and title-prefix matches rank first. */
export function queryDocumentationSearch(
  index: readonly SearchRecord[],
  query: string,
  limit = 20,
): readonly DocumentationSearchResult[] {
  const terms = normalized(query).split(' ').filter((term) => term.length > 0);
  if (terms.length === 0 || limit <= 0) {
    return [];
  }
  return index
    .map((item) => ({ item, score: score(item.searchText, item.title, terms) }))
    .filter(({ score: itemScore }) => itemScore >= 0)
    .toSorted((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title))
    .slice(0, limit)
    .map(({ item: { searchText: _searchText, ...item } }) => item);
}
