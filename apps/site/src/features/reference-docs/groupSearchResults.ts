import type {
  DocumentationSearchKind,
  DocumentationSearchResult,
} from '../docs-reference';

export interface DocumentationSearchGroup {
  readonly kind: DocumentationSearchKind;
  readonly label: string;
  readonly results: readonly DocumentationSearchResult[];
}

const KIND_LABELS: Readonly<Record<DocumentationSearchKind, string>> = {
  guide: 'Guides',
  'definition-type': 'Definition types',
  property: 'Properties',
  diagnostic: 'Diagnostics',
  'expression-operator': 'Expression operators',
  'expression-function': 'Expression functions',
  'api-symbol': 'API symbols',
};

export function groupSearchResults(
  results: readonly DocumentationSearchResult[],
): readonly DocumentationSearchGroup[] {
  const groups = new Map<DocumentationSearchKind, DocumentationSearchResult[]>();
  for (const result of results) {
    const existing = groups.get(result.kind);
    if (existing === undefined) {
      groups.set(result.kind, [result]);
    } else {
      existing.push(result);
    }
  }
  return [...groups].map(([kind, groupResults]) => ({
    kind,
    label: KIND_LABELS[kind],
    results: groupResults,
  }));
}
