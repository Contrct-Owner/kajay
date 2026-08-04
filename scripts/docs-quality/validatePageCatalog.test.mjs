import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePageCatalog } from './validatePageCatalog.mjs';

const manifest = {
  definitionTypes: [{ url: '/docs/reference/definition-types/text' }],
  definitionProperties: [{ url: '/docs/reference/properties/title' }],
  apiSymbols: [{ packageName: '@kajay/core', url: '/docs/reference/api/core/parse-survey' }],
};

test('authored guides do not collide with generated reference pages', () => {
  assert.deepEqual(validatePageCatalog([
    { source: 'guide.tsx', slug: 'surveys/expressions' },
  ], manifest), []);
});

test('generated index and detail routes are reserved', () => {
  const errors = validatePageCatalog([
    { source: 'index.tsx', slug: 'reference/expression-language' },
    { source: 'detail.tsx', slug: 'reference/properties/title' },
  ], manifest);
  assert.equal(errors.length, 2);
  assert.ok(errors[0].includes('owned by generated reference'));
});
