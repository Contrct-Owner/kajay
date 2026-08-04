import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import {
  ReferenceSearch,
  createReferencePageRegistry,
  referenceDocPages,
  referencePageRegistry,
} from '../../src/features/reference-docs/index.js';
import { groupSearchResults } from '../../src/features/reference-docs/groupSearchResults.js';

function rendered(slug: string): string {
  const page = referencePageRegistry.resolve(slug);
  expect(page).toBeDefined();
  return renderToStaticMarkup(page?.content);
}

describe('generated reference pages', () => {
  test('keeps navigation small while resolving generated details', () => {
    expect(referenceDocPages.map((page) => page.slug)).toEqual([
      'reference',
      'reference/definition-types',
      'reference/properties',
      'reference/expression-language',
      'reference/diagnostics',
      'reference/api',
    ]);
    expect(referencePageRegistry.resolve('reference/definition-types/text')?.title).toBe('text definition');
    expect(referencePageRegistry.resolve('reference/properties/visible-if')?.title).toBe('visibleIf property');
    expect(referencePageRegistry.resolve('reference/api/core')?.title).toBe('@kajay/core');
    expect(referencePageRegistry.resolve('reference/api/creator-core/preview-device')?.title).toBe('previewDevice');
    expect(referencePageRegistry.resolve('reference/api/creator-core/preview-device-type')?.title).toBe('PreviewDevice');
    expect(referencePageRegistry.resolve('reference/not-real')).toBeUndefined();
  });

  test('renders inherited definition facts and explicit API gaps', () => {
    const definition = rendered('reference/definition-types/text');
    expect(definition).toContain('Declared by');
    expect(definition).toContain('question');

    const api = rendered('reference/api/core/parse-survey');
    expect(api).toContain('Preview reference gap');
    expect(api).toContain('consumer description');
    expect(api).toContain('published signature');
  });

  test('preserves stable expression and diagnostic anchors', () => {
    const expressions = rendered('reference/expression-language');
    expect(expressions).toContain('id="operator-add"');
    expect(expressions).toContain('id="function-today"');
    expect(rendered('reference/diagnostics')).toContain('id="expression-unknown-function"');
  });

  test('accepts authored and interactive additions on the canonical expression page', () => {
    const registry = createReferencePageRegistry(undefined, {
      expressionLanguageOverview: createElement('p', null, 'Authored semantics'),
      expressionLanguageEvaluator: createElement('div', null, 'Interactive evaluator'),
    });
    const html = renderToStaticMarkup(registry.resolve('reference/expression-language')?.content);
    expect(html).toContain('Authored semantics');
    expect(html).toContain('Interactive evaluator');
  });
});

describe('reference search UI', () => {
  test('groups ranked results by their stable kind', () => {
    const groups = groupSearchResults([
      { id: 'one', kind: 'property', title: 'visibleIf', description: 'Condition', url: '/one', group: 'Properties' },
      { id: 'two', kind: 'api-symbol', title: 'parseSurvey', description: 'Parser', url: '/two', group: 'Core' },
      { id: 'three', kind: 'property', title: 'requiredIf', description: 'Condition', url: '/three', group: 'Properties' },
    ]);
    expect(groups.map((group) => [group.label, group.results.length])).toEqual([
      ['Properties', 2],
      ['API symbols', 1],
    ]);
  });

  test('server-renders a labeled, collapsed combobox without browser globals', () => {
    const html = renderToStaticMarkup(createElement(ReferenceSearch, { pages: referenceDocPages }));
    expect(html).toContain('Search documentation');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="listbox"');
  });
});
