import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { GuideContent, GuideNote } from '../../src/features/consumer-guides/components/GuideContent.js';
import { CreatorCallout } from '../../src/features/creator-docs/components/CreatorCallout.js';
import { dotnetDocPages } from '../../src/features/dotnet-docs/index.js';
import {
  createDocumentationSearchIndex,
  docsReferenceManifest,
  queryDocumentationSearch,
} from '../../src/features/docs-reference/index.js';
import { DocsNavigation } from '../../src/features/docs-shell/DocsNavigation.js';
import { docsHomePage } from '../../src/features/docs-shell/docsHomePage.js';
import { referencePageRegistry } from '../../src/features/reference-docs/index.js';
import { ReferenceSearchResults } from '../../src/features/reference-docs/ReferenceSearchResults.js';
import { runtimeDocPages } from '../../src/features/runtime-docs/index.js';

function markup(value: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(value);
}

describe('documentation structure and content UX', () => {
  test('links every maintained SDK adoption path from the documentation home', () => {
    const html = markup(docsHomePage.content);
    expect(html).toContain('href="/docs/quickstart/runtime"');
    expect(html).toContain('href="/docs/quickstart/dotnet"');
    expect(html).toContain('href="/docs/quickstart/creator"');
  });

  test('publishes the stable .NET guide set through the authored catalog', () => {
    expect(dotnetDocPages.map(({ slug }) => slug)).toEqual([
      'quickstart/dotnet',
      'dotnet/snapshots',
      'dotnet/hosting',
      'dotnet/extensibility',
      'dotnet/compatibility',
    ]);
    const quickstart = dotnetDocPages.find((page) => page.slug === 'quickstart/dotnet');
    expect(markup(quickstart?.content)).toContain('dotnet add package Kajay.Core --version 1.0.0');
  });

  test('makes native API types discoverable through documentation search', () => {
    const index = createDocumentationSearchIndex(docsReferenceManifest);
    const results = queryDocumentationSearch(index, 'Kajay.Core SurveyDefinition');
    expect(results[0]).toMatchObject({
      title: 'SurveyDefinition',
      url: '/docs/reference/api/kajay-core/survey-definition',
      group: 'Kajay.Core',
    });
  });

  test('keeps navigation labels out of the article heading outline', () => {
    const html = markup(createElement(DocsNavigation, {
      activeSlug: 'first',
      sections: [{ title: 'Start', pages: [{ ...docsHomePage, slug: 'first' }] }],
    }));
    expect(html).toContain('<p class="text-foreground');
    expect(html).not.toContain('<h2');
  });

  test('reports expression reference gaps once per catalog, not once per entry', () => {
    const page = referencePageRegistry.resolve('reference/expression-language');
    const html = markup(page?.content);
    expect(html.match(/Preview reference gap/gu)).toHaveLength(2);
    expect(html).toContain('id="operator-add"');
    expect(html).toContain('id="function-today"');
  });

  test('makes definition-type availability navigable', () => {
    const page = referencePageRegistry.resolve('reference/properties/visible-if');
    expect(markup(page?.content)).toContain('href="/docs/reference/definition-types/question"');
  });
});

describe('documentation component semantics', () => {
  test('uses notes rather than skipped-level headings for callouts', () => {
    const creator = markup(createElement(CreatorCallout, { title: 'Preview', children: 'Unavailable' }));
    expect(creator).toContain('role="note"');
    expect(creator).not.toContain('<h3');

    const guide = markup(createElement(GuideNote, { children: 'Host responsibility' }));
    expect(guide).toContain('role="note"');
  });

  test('keeps guide code horizontally scrollable', () => {
    const html = markup(createElement(GuideContent, {
      sections: [{ id: 'example', title: 'Example', body: 'Body', code: 'const long = true;' }],
    }));
    expect(html).toContain('<pre class="overflow-x-auto"');
  });

  test('publishes timing table names and coherent Start navigation', () => {
    const validation = runtimeDocPages.find((page) => page.slug === 'surveys/validation');
    const quickstart = runtimeDocPages.find((page) => page.slug === 'quickstart/runtime');
    expect(markup(validation?.content)).toContain('Validation timing modes');
    expect(quickstart?.section).toBe('Start');
  });

  test('announces an empty local search without adding page headings', () => {
    const props = {
      activeId: '',
      groups: [],
      idPrefix: 'audit',
      onActivate: () => false,
      resultId: (result) => result.id,
    } satisfies Parameters<typeof ReferenceSearchResults>[0];
    expect(markup(createElement(ReferenceSearchResults, props))).toContain('role="status"');
    const populated = markup(createElement(ReferenceSearchResults, {
      ...props,
      groups: [{ kind: 'property', label: 'Properties', results: [{ id: 'visible', kind: 'property', title: 'visibleIf', description: 'Condition', url: '/visible', group: 'Properties' }] }],
    }));
    expect(populated).not.toContain('<h2');
  });
});
