import { describe, expect, test } from 'vitest';
import {
  createDocumentationSearchIndex,
  docsReferenceManifest,
  queryDocumentationSearch,
} from '../../src/features/docs-reference/index.js';

const authoredPages = [{
  id: 'expressions',
  title: 'Expressions and conditional logic',
  description: 'Show questions only when they apply.',
  url: '/docs/surveys/expressions',
  headings: ['Reference values'],
  keywords: ['visibleIf'],
}] as const;
const index = createDocumentationSearchIndex(docsReferenceManifest, authoredPages);

describe('documentation search', () => {
  test('indexes generated and authored documentation through stable URLs', () => {
    expect(queryDocumentationSearch(index, 'visibleIf')).toContainEqual(expect.objectContaining({
      kind: 'guide',
      url: '/docs/surveys/expressions',
    }));
    expect(queryDocumentationSearch(index, 'parseSurvey')[0]).toMatchObject({
      kind: 'api-symbol',
      url: '/docs/reference/api/core/parse-survey',
    });
  });

  test('finds aliases and ranks an exact title ahead of incidental matches', () => {
    const results = queryDocumentationSearch(index, 'and');
    expect(results[0]).toMatchObject({ kind: 'expression-operator', title: 'and' });
    expect(queryDocumentationSearch(index, '&&')[0]).toMatchObject({ title: 'and' });
  });

  test('requires every term and honors empty and bounded queries', () => {
    expect(queryDocumentationSearch(index, 'parseSurvey consumer', 1)).toHaveLength(1);
    expect(queryDocumentationSearch(index, 'parseSurvey impossible')).toEqual([]);
    expect(queryDocumentationSearch(index, '  ')).toEqual([]);
    expect(queryDocumentationSearch(index, 'survey', 0)).toEqual([]);
  });
});
