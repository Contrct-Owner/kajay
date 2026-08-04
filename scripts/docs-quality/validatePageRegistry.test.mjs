import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePageRegistry } from './validatePageRegistry.mjs';

function page(overrides = {}) {
  return {
    source: 'page.tsx',
    slug: 'surveys/validation',
    title: 'Validation',
    description: 'Validation behavior.',
    section: 'Surveys',
    status: 'preview',
    audience: 'consumer',
    sdk: 'typescript',
    framework: 'react',
    toc: [{ id: 'timing', label: 'Timing', depth: 2 }],
    related: [],
    ...overrides,
  };
}

test('valid authored page metadata passes', () => {
  assert.deepEqual(validatePageRegistry([
    page(),
    page({ source: 'home.tsx', slug: '', section: 'Start', sdk: 'neutral', framework: 'neutral' }),
  ]), []);
});

test('duplicate paths, anchors, and invalid metadata are all reported', () => {
  const errors = validatePageRegistry([
    page({
      slug: '/Not-Canonical/',
      status: 'draft',
      toc: [
        { id: 'same', label: 'One', depth: 2 },
        { id: 'same', label: 'Two', depth: 4 },
      ],
      related: ['missing'],
    }),
    page({ source: 'second.tsx' }),
    page({ source: 'third.tsx' }),
  ]);
  assert.ok(errors.some((error) => error.includes('slug "/Not-Canonical/"')));
  assert.ok(errors.some((error) => error.includes('status "draft"')));
  assert.ok(errors.some((error) => error.includes('heading anchor "same" is duplicated')));
  assert.ok(errors.some((error) => error.includes('invalid depth 4')));
  assert.ok(errors.some((error) => error.includes('path /docs/surveys/validation is already owned')));
  assert.ok(errors.some((error) => error.includes('related page "missing" does not exist')));
});
